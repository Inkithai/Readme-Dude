import {
  Check,
  ClipboardCopy,
  Eye,
  FileDown,
  FolderOpen,
  HardDriveUpload,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { serializeDocument } from "@/engine";
import {
  copyToClipboard,
  downloadText,
  formatBytes,
  readmeFilename,
  readTextFile,
  slugify,
  utf8Bytes,
} from "@/lib/export";
import { flushAutosave, history, useCanRedo, useCanUndo, useDocument } from "@/store/document";
import { Btn } from "@/ui/editor/Fields";

/* ------------------------------------------------------------------ *
 * ui/shell/Toolbar.tsx — title, history, save status and the two Phase 1
 * outputs (Copy Markdown / Download README.md).
 * ------------------------------------------------------------------ */

function SaveIndicator() {
  const saveStatus = useDocument((s) => s.saveStatus);
  const savedAt = useDocument((s) => s.savedAt);
  const label = useMemo(() => {
    switch (saveStatus) {
      case "saving":
        return "saving…";
      case "saved":
        return savedAt
          ? `saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "saved";
      case "dirty":
        return "unsaved changes";
      case "unavailable":
        return "storage blocked";
      default:
        return "autosave on";
    }
  }, [saveStatus, savedAt]);

  return (
    <span
      className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10.5px] text-zinc-500 sm:inline-flex"
      title="Your work stays in this browser only — no server, no account."
    >
      <span
        className={`size-1.5 rounded-full ${
          saveStatus === "saved"
            ? "bg-emerald-400"
            : saveStatus === "dirty" || saveStatus === "saving"
              ? "bg-amber-400"
              : "bg-zinc-600"
        }`}
      />
      {label}
    </span>
  );
}

export function Toolbar({
  markdown,
  onTogglePreviewPane,
}: {
  markdown: string;
  onTogglePreviewPane: () => void;
}) {
  const name = useDocument((s) => s.name);
  const setName = useDocument((s) => s.setName);
  const blocks = useDocument((s) => s.blocks);
  const clearAll = useDocument((s) => s.clearAll);
  const importJson = useDocument((s) => s.importJson);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const bytes = utf8Bytes(markdown);
  const overLimit = bytes > 1024 * 1024;

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-indigo-500/90 font-mono text-[13px] font-bold text-white">
          R
        </span>
        <span className="hidden text-[13px] font-semibold tracking-tight text-zinc-100 md:inline">
          ReadMe Studio
        </span>
        <span className="hidden rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-zinc-500 uppercase lg:inline">
          phase 1
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          spellCheck={false}
          aria-label="Document name"
          className="w-full min-w-0 max-w-[16rem] rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] text-zinc-300 hover:border-zinc-800 focus:border-zinc-700 focus:bg-zinc-950 focus:outline-none"
        />
        <SaveIndicator />
      </div>

      <div className="flex items-center gap-0.5">
        <Btn size="xs" title="Undo (⌘Z)" onClick={() => history.undo()} disabled={!canUndo}>
          <Undo2 size={13} />
        </Btn>
        <Btn size="xs" title="Redo (⌘⇧Z)" onClick={() => history.redo()} disabled={!canRedo}>
          <Redo2 size={13} />
        </Btn>
        <Btn size="xs" title="Reset history" onClick={() => history.clear()} disabled={!canUndo && !canRedo}>
          <RotateCcw size={13} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-zinc-800" />

        <Btn
          size="xs"
          variant="outline"
          title="Show / hide the preview pane"
          onClick={onTogglePreviewPane}
          className="xl:hidden"
          ariaLabel="Toggle preview pane"
        >
          <Eye size={12} /> Preview
        </Btn>
        <Btn
          size="xs"
          variant="outline"
          title="Export this document as .json so you can save or version it"
          onClick={() => {
            flushAutosave();
            downloadText(
              `${slugify(name) || "readme-studio"}.json`,
              serializeDocument(name, blocks),
              "application/json",
            );
          }}
        >
          <FolderOpen size={12} /> <span className="hidden sm:inline">JSON</span>
        </Btn>
        <Btn
          size="xs"
          variant="outline"
          title="Import a .json document exported from this tool"
          onClick={() => fileInput.current?.click()}
        >
          <HardDriveUpload size={12} /> <span className="hidden sm:inline">Import</span>
        </Btn>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const result = await importJson(await readTextFile(file));
            if (!result.ok) window.alert(`Could not import that file: ${result.message ?? "unknown error"}`);
            else if (result.dropped > 0)
              window.alert(
                `Imported, but ${result.dropped} block(s) did not match the schema and were skipped.`,
              );
          }}
        />

        {confirming ? (
          <span className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-1">
            <span className="text-[10.5px] text-rose-200">Erase everything?</span>
            <Btn
              size="xs"
              onClick={() => {
                clearAll();
                history.clear();
                flushAutosave();
                setConfirming(false);
              }}
              className="text-rose-200"
            >
              Yes
            </Btn>
            <Btn size="xs" onClick={() => setConfirming(false)} className="text-zinc-400">
              No
            </Btn>
          </span>
        ) : (
          <Btn size="xs" variant="danger" title="Start an empty document" onClick={() => setConfirming(true)}>
            <Trash2 size={12} />
          </Btn>
        )}

        <span className="mx-1 h-4 w-px bg-zinc-800" />

        <span
          className="mr-1 hidden font-mono text-[10px] lg:inline"
          title="GitHub warns above ~1 MB for rendered files"
        >
          <span className={overLimit ? "text-rose-400" : "text-zinc-600"}>{formatBytes(bytes)}</span>
        </span>

        <Btn
          size="sm"
          variant="outline"
          title="Download README.md"
          onClick={() => {
            flushAutosave();
            downloadText(readmeFilename(name), markdown);
          }}
        >
          <FileDown size={13} /> <span className="hidden sm:inline">README.md</span>
        </Btn>
        <Btn
          size="sm"
          variant="solid"
          title="Copy the Markdown to your clipboard"
          onClick={async () => {
            flushAutosave();
            if (await copyToClipboard(markdown)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
          {copied ? "Copied" : "Copy Markdown"}
        </Btn>
      </div>
    </header>
  );
}
