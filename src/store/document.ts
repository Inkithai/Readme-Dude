import { arrayMove } from "@dnd-kit/sortable";
import { type TemporalState, temporal } from "zundo";
import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  type Block,
  type BlockType,
  cloneBlock,
  compileDocument,
  createBlock,
  parseDocument,
  parseDocumentJson,
  serializeDocument,
} from "@/engine";
import { storage } from "@/lib/storage";

/* ------------------------------------------------------------------ *
 * store/document.ts — the only mutable state in the app.
 *
 * Shape: { name, blocks } is the document (and the only thing history
 * tracks); selection/expansion/save status are UI-ephemeral and excluded
 * from undo so clicking around never pollutes the timeline.
 * ------------------------------------------------------------------ */

export const AUTOSAVE_KEY = "readme-buddy:autosave:v1";

/** The app shipped as "ReadMe Studio"; readers keep picking up those documents. */
const LEGACY_AUTOSAVE_KEY = "readme-studio:autosave:v1";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "unavailable";

interface DocumentState {
  name: string;
  blocks: Block[];
  selectedId: string | null;
  expandedId: string | null;
  saveStatus: SaveStatus;
  savedAt: number | null;
  /** Blocks present in autosave data that failed validation on load. */
  droppedOnLoad: number;
}

interface DocumentActions {
  setName: (name: string) => void;
  select: (id: string | null) => void;
  toggleExpand: (id: string) => void;
  expand: (id: string | null) => void;
  addBlock: (type: BlockType, index?: number) => string;
  insertBlock: (block: Block, index?: number) => string;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => string | null;
  toggleHidden: (id: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  patchProps: (id: string, patch: Record<string, unknown>) => void;
  moveByIndex: (from: number, to: number) => void;
  reorderById: (activeId: string, overId: string) => void;
  /** Drop target from the palette: `gap:<index>`; sortable item: the block id. */
  handleDrop: (activeBlock: { type: BlockType } | Block, overId: string | null | undefined) => void;
  clearAll: () => void;
  replaceBlocks: (blocks: Block[], name?: string) => void;
  importJson: (text: string) => { ok: boolean; dropped: number; message?: string };
}

export type DocumentStore = DocumentState & DocumentActions;

const EMPTY: DocumentState = {
  name: "untitled",
  blocks: [],
  selectedId: null,
  expandedId: null,
  saveStatus: "idle",
  savedAt: null,
  droppedOnLoad: 0,
};

/**
 * Reads the autosave payload, adopting the retired key once so a document saved
 * while this app was named "ReadMe Studio" still opens instead of looking empty.
 * Exported for tests; the write-back happens here so a successful read is enough
 * to move off the old namespace.
 */
export function readAutosavePayload(): string | null {
  const raw = storage.get(AUTOSAVE_KEY) ?? storage.get(LEGACY_AUTOSAVE_KEY);
  if (raw && !storage.get(AUTOSAVE_KEY)) storage.set(AUTOSAVE_KEY, raw);
  return raw;
}

function hydrate(): Pick<DocumentState, "blocks" | "name" | "droppedOnLoad" | "saveStatus"> {
  const raw = readAutosavePayload();
  if (!raw) return { blocks: [], name: "untitled", droppedOnLoad: 0, saveStatus: "idle" };
  try {
    const { document, dropped } = parseDocument(JSON.parse(raw));
    return { blocks: document.blocks, name: document.name, droppedOnLoad: dropped, saveStatus: "saved" };
  } catch {
    return { blocks: [], name: "untitled", droppedOnLoad: 0, saveStatus: "idle" };
  }
}

const initial = hydrate();

const indexForBlock = (blocks: Block[], id: string): number => blocks.findIndex((b) => b.id === id);
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const useDocument = create<DocumentStore>()(
  temporal(
    immer((set, get) => ({
      ...EMPTY,
      blocks: initial.blocks,
      name: initial.name,
      droppedOnLoad: initial.droppedOnLoad,
      saveStatus: initial.saveStatus,

      setName: (name) =>
        set((s: DocumentStore) => {
          s.name = name || "untitled";
        }),
      select: (id) =>
        set((s: DocumentStore) => {
          s.selectedId = id;
        }),
      expand: (id) =>
        set((s: DocumentStore) => {
          s.expandedId = id;
        }),
      toggleExpand: (id) =>
        set((s: DocumentStore) => {
          s.expandedId = s.expandedId === id ? null : id;
          s.selectedId = id;
        }),

      addBlock: (type, index) => get().insertBlock(createBlock(type), index),

      insertBlock: (block, index) => {
        set((s: DocumentStore) => {
          const at = index === undefined || index < 0 ? s.blocks.length : clamp(index, 0, s.blocks.length);
          s.blocks.splice(at, 0, block);
          s.expandedId = block.id;
          s.selectedId = block.id;
        });
        return block.id;
      },

      removeBlock: (id) =>
        set((s: DocumentStore) => {
          const at = indexForBlock(s.blocks, id);
          if (at < 0) return;
          s.blocks.splice(at, 1);
          if (s.expandedId === id) s.expandedId = null;
          // Keep the selection on something real: the block that slid into
          // this slot, else the previous one. Deleting then pressing ⌫ again
          // therefore walks forward through the document instead of stranding
          // the user with nothing selected.
          if (s.selectedId === id) {
            const next = s.blocks[at] ?? s.blocks[at - 1] ?? null;
            s.selectedId = next ? next.id : null;
          }
        }),

      duplicateBlock: (id) => {
        const state = get();
        const source = state.blocks.find((b) => b.id === id);
        if (!source) return null;
        const copy = cloneBlock(source);
        set((s: DocumentStore) => {
          const at = indexForBlock(s.blocks, id);
          s.blocks.splice(at + 1, 0, copy);
          s.expandedId = copy.id;
          s.selectedId = copy.id;
        });
        return copy.id;
      },

      toggleHidden: (id) =>
        set((s: DocumentStore) => {
          const block = s.blocks.find((b) => b.id === id);
          if (block) block.hidden = !block.hidden;
        }),

      setHidden: (id, hidden) =>
        set((s: DocumentStore) => {
          const block = s.blocks.find((b) => b.id === id);
          if (block) block.hidden = hidden;
        }),

      patchProps: (id, patch) =>
        set((s: DocumentStore) => {
          const block = s.blocks.find((b) => b.id === id);
          if (!block) return;
          Object.assign(block.props as unknown as Record<string, unknown>, patch);
        }),

      moveByIndex: (from, to) =>
        set((s: DocumentStore) => {
          if (from === to || from < 0 || to < 0 || from >= s.blocks.length || to >= s.blocks.length) return;
          s.blocks = arrayMove(s.blocks, from, to);
        }),

      reorderById: (activeId, overId) =>
        set((s: DocumentStore) => {
          const from = indexForBlock(s.blocks, activeId);
          const to = indexForBlock(s.blocks, overId);
          if (from < 0 || to < 0 || from === to) return;
          s.blocks = arrayMove(s.blocks, from, to);
        }),

      handleDrop: (active, overId) => {
        const state = get();
        if (!overId) return;
        const isPalette = !("id" in active);
        const positionOf = (id: string): number => {
          if (id.startsWith("gap:")) return Number(id.slice(4));
          const at = indexForBlock(state.blocks, id);
          return at < 0 ? state.blocks.length : at;
        };

        if (isPalette) {
          const block = createBlock(active.type);
          set((s: DocumentStore) => {
            s.blocks.splice(clamp(positionOf(overId), 0, s.blocks.length), 0, block);
            s.expandedId = block.id;
            s.selectedId = block.id;
          });
          return;
        }

        const movingId = (active as Block).id;
        if (overId.startsWith("gap:")) {
          const target = Number(overId.slice(4));
          set((s: DocumentStore) => {
            const from = indexForBlock(s.blocks, movingId);
            if (from < 0) return;
            const to = clamp(from < target ? target - 1 : target, 0, s.blocks.length - 1);
            s.blocks = arrayMove(s.blocks, from, to);
          });
          return;
        }
        get().reorderById(movingId, overId);
      },

      clearAll: () =>
        set((s: DocumentStore) => {
          s.blocks = [];
          s.selectedId = null;
          s.expandedId = null;
        }),

      replaceBlocks: (blocks, name) =>
        set((s: DocumentStore) => {
          s.blocks = blocks;
          if (name !== undefined) s.name = name;
          s.selectedId = null;
          s.expandedId = blocks[0]?.id ?? null;
        }),

      importJson: (text) => {
        const { document, dropped, errors } = parseDocumentJson(text);
        if (document.blocks.length === 0 && errors.length > 0) {
          return { ok: false, dropped, message: errors[0] };
        }
        get().replaceBlocks(document.blocks, document.name);
        return { ok: true, dropped };
      },
    })),
    {
      // Undo/redo covers the document only — never selection or save status.
      partialize: (state) => ({ blocks: state.blocks, name: state.name }),
      // zundo pushes an entry on *every* setState unless told otherwise, so a
      // plain click on a block would create an empty undo step and make ⌘Z look
      // broken. Reference equality is enough here: immer hands back the same
      // `blocks` array whenever a mutation did not touch it, so this is O(1)
      // and exact — no deep compare, no stringify on every keystroke.
      equality: (past, current) => past.blocks === current.blocks && past.name === current.name,
      limit: 120,
    },
  ),
);

/* ------------------------------ selectors ------------------------------ */

export const useBlocks = (): Block[] => useDocument((s) => s.blocks);
export const useVisibleBlocks = (): Block[] => useDocument((s) => s.blocks.filter((b) => !b.hidden));
export const useBlock = (id: string | null): Block | null =>
  useDocument((s) => (id ? (s.blocks.find((b) => b.id === id) ?? null) : null));

export const useMarkdown = (): string => {
  const blocks = useDocument((s) => s.blocks);
  return compileDocument(blocks);
};

/* ------------------------------ history api ------------------------------ */

type HistoryState = TemporalState<Pick<DocumentState, "blocks" | "name">>;

export const history = {
  undo: (): void => useDocument.temporal.getState().undo(),
  redo: (): void => useDocument.temporal.getState().redo(),
  clear: (): void => useDocument.temporal.getState().clear(),
};

export const useCanUndo = (): boolean =>
  useStore(useDocument.temporal, (s: HistoryState) => s.pastStates.length > 0);
export const useCanRedo = (): boolean =>
  useStore(useDocument.temporal, (s: HistoryState) => s.futureStates.length > 0);
export const useHistoryDepth = (): { past: number; future: number } =>
  useStore(useDocument.temporal, (s: HistoryState) => ({
    past: s.pastStates.length,
    future: s.futureStates.length,
  }));

/* -------------------------------- autosave -------------------------------- */

/**
 * Debounced write-behind autosave. Deliberately *not* zustand/persist: we need
 * (a) history to start clean after hydration, (b) a debounce so a keystroke
 * never serializes the whole doc synchronously, and (c) a visible save status.
 * Phase 6 moves this payload into IndexedDB via Dexie and adds projects.
 */
let pending: ReturnType<typeof setTimeout> | null = null;
let lastWritten = "";

export function flushAutosave(): void {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  const { name, blocks } = useDocument.getState();
  const payload = serializeDocument(name, blocks);
  if (payload === lastWritten) return;
  useDocument.setState({ saveStatus: "saving" });
  storage.set(AUTOSAVE_KEY, payload);
  lastWritten = payload;
  useDocument.setState({ saveStatus: storage.available ? "saved" : "unavailable", savedAt: Date.now() });
}

useDocument.subscribe((state, previous) => {
  if (state.blocks === previous.blocks && state.name === previous.name) return;
  useDocument.setState({ saveStatus: "dirty" });
  if (pending) clearTimeout(pending);
  pending = setTimeout(flushAutosave, 500);
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => flushAutosave());
  window.addEventListener("pagehide", () => flushAutosave());
}
