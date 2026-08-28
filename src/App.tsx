import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { BLOCKS, type BlockType, compileDocument } from "@/engine";
import { downloadText, readmeFilename } from "@/lib/export";
import { flushAutosave, history, useDocument } from "@/store/document";
import { Canvas } from "@/ui/canvas/Canvas";
import { PaletteRail } from "@/ui/palette/PaletteRail";
import { PreviewPane } from "@/ui/preview/PreviewPane";
import { Toolbar } from "@/ui/shell/Toolbar";

/* ------------------------------------------------------------------ *
 * App.tsx — the application shell (Phase 1 core, Phase 3 template rail).
 *
 *   palette → canvas (dnd-kit) → engine.compileDocument → preview / export
 *
 * One DndContext spans both the palette and the canvas, which is what lets a
 * single drag interaction mean "insert" or "reorder" depending on where it
 * started. The Markdown is derived from state on every change — never stored —
 * so it cannot drift out of sync with the document.
 * ------------------------------------------------------------------ */

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return /^(input|textarea|select)$/.test(target.tagName.toLowerCase());
};

/**
 * True when no modifier is held. Destructive canvas shortcuts are bare-only:
 * ⌘⌫ is "delete to start of line" and ⌥⌫ is "delete word" on macOS, and a
 * ⌘H/⌥H typed while a block happens to be selected must not quietly hide it.
 */
const isBare = (event: KeyboardEvent): boolean => !event.metaKey && !event.ctrlKey && !event.altKey;

export default function App() {
  const blocks = useDocument((s) => s.blocks);
  const handleDrop = useDocument((s) => s.handleDrop);
  const [activeDrag, setActiveDrag] = useState<{
    kind: "palette" | "block";
    label: string;
    type: BlockType;
  } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [view, setView] = useState<"build" | "preview">("build");

  const markdown = useMemo(() => compileDocument(blocks), [blocks]);

  const sensors = useSensors(
    // 6px activation distance keeps a click on the handle from becoming a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Prefer the thin gap band under the pointer (insert/between), else nearest card. */
  const collisionDetection = useMemo<CollisionDetection>(
    () => (arguments_) => {
      const pointerHits = pointerWithin(arguments_);
      const hits = pointerHits.length > 0 ? pointerHits : closestCenter(arguments_);
      const gap = hits.find((hit) => String(hit.id).startsWith("gap:"));
      return gap ? [gap] : hits;
    },
    [],
  );

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { paletteType?: BlockType; block?: { type: BlockType } }
      | undefined;
    if (data?.paletteType) {
      setActiveDrag({ kind: "palette", type: data.paletteType, label: BLOCKS[data.paletteType].label });
      return;
    }
    if (data?.block) {
      setActiveDrag({ kind: "block", type: data.block.type, label: BLOCKS[data.block.type].label });
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over ? String(event.over.id) : null;
    const data = event.active.data.current as { paletteType?: BlockType; block?: never } | undefined;
    if (data?.paletteType) {
      handleDrop({ type: data.paletteType }, over);
    } else if (data?.block) {
      handleDrop(data.block, over);
    }
    setActiveDrag(null);
    setOverId(null);
  };

  const onDragCancel = () => {
    setActiveDrag(null);
    setOverId(null);
  };

  /* ------------------------------ keyboard ------------------------------ */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useDocument.getState();
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (meta && key === "y") {
        event.preventDefault();
        history.redo();
        return;
      }
      if (meta && key === "s") {
        event.preventDefault();
        flushAutosave();
        downloadText(readmeFilename(state.name), compileDocument(state.blocks));
        return;
      }
      if (meta && key === "e") {
        // ⌘E toggles the preview on narrow screens.
        event.preventDefault();
        setView((current) => (current === "build" ? "preview" : "build"));
        return;
      }
      if (isTypingTarget(event.target)) return;

      if ((event.key === "Backspace" || event.key === "Delete") && isBare(event) && state.selectedId) {
        event.preventDefault();
        state.removeBlock(state.selectedId);
        return;
      }
      if (meta && key === "d" && state.selectedId) {
        event.preventDefault();
        state.duplicateBlock(state.selectedId);
        return;
      }
      if (event.altKey && state.selectedId && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const from = state.blocks.findIndex((block) => block.id === state.selectedId);
        if (from < 0) return;
        state.moveByIndex(from, from + (event.key === "ArrowUp" ? -1 : 1));
        return;
      }
      if (key === "h" && isBare(event) && state.selectedId) {
        event.preventDefault();
        state.toggleHidden(state.selectedId);
        return;
      }
      if (event.key === "Escape" && state.expandedId) {
        state.expand(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const buildVisible = view === "build";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex h-full min-h-0 flex-col bg-zinc-950">
        <Toolbar
          markdown={markdown}
          onTogglePreviewPane={() => setView(buildVisible ? "preview" : "build")}
        />

        <main className="flex min-h-0 flex-1">
          <div
            className={`${buildVisible ? "flex" : "hidden"} min-h-0 flex-1 xl:flex`}
            aria-hidden={!buildVisible}
          >
            <div className="w-[9.5rem] shrink-0 lg:w-[13.5rem]">
              <PaletteRail />
            </div>
            <div className="min-w-0 flex-1">
              <Canvas overId={overId} />
            </div>
          </div>

          <div
            className={`${!buildVisible ? "flex" : "hidden"} min-h-0 w-full flex-1 xl:flex xl:min-w-0 xl:flex-[1.15]`}
            aria-hidden={!buildVisible}
          >
            <PreviewPane markdown={markdown} />
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeDrag ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/60 bg-zinc-900 px-2.5 py-1.5 shadow-xl shadow-black/60">
            <span className="text-[12px] font-medium text-zinc-100">{activeDrag.label}</span>
            <span className="rounded bg-indigo-500/20 px-1 text-[9.5px] font-semibold tracking-wide text-indigo-200 uppercase">
              {activeDrag.kind === "palette" ? "insert" : "move"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
