import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Braces, Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BLOCKS, type Block, compileBlockWithHidden, summarizeBlock } from "@/engine";
import { BLOCK_ICONS } from "@/lib/uiIcons";
import { useDocument } from "@/store/document";
import { BlockEditor } from "@/ui/editor/blockEditors";
import { Btn } from "@/ui/editor/Fields";

/* ------------------------------------------------------------------ *
 * ui/canvas/BlockCard.tsx — one row of the document.
 *
 * The card owns *structure* actions (drag, move, duplicate, hide, delete);
 * the editor inside owns *content*. Keeping those apart is what lets the
 * canvas stay usable when a block's form is mid-edit and unsaved.
 * ------------------------------------------------------------------ */

export function BlockCard({ block, index, total }: { block: Block; index: number; total: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: block.id,
      data: { block },
    });

  const expanded = useDocument((s) => s.expandedId === block.id);
  const selected = useDocument((s) => s.selectedId === block.id);
  const toggleExpand = useDocument((s) => s.toggleExpand);
  const removeBlock = useDocument((s) => s.removeBlock);
  const duplicateBlock = useDocument((s) => s.duplicateBlock);
  const toggleHidden = useDocument((s) => s.toggleHidden);
  const moveByIndex = useDocument((s) => s.moveByIndex);
  const [peek, setPeek] = useState(false);

  const definition = BLOCKS[block.type];
  const Icon = BLOCK_ICONS[block.type];
  const summary = useMemo(() => summarizeBlock(block), [block]);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} data-rs-dragging={isDragging ? "true" : "false"} className="relative">
      <div
        className={`group overflow-hidden rounded-lg border transition-colors ${
          isDragging ? "z-10 border-indigo-500/70 shadow-lg shadow-black/40" : ""
        } ${
          expanded
            ? "border-zinc-700 bg-zinc-900/80"
            : selected
              ? "border-zinc-700/80 bg-zinc-900/50"
              : "border-zinc-800/70 bg-zinc-900/30 hover:border-zinc-700/70"
        } ${block.hidden ? "opacity-55" : ""}`}
      >
        <div className="flex items-center gap-1 px-1.5 py-1.5">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label={`Drag ${definition.label} block`}
            title="Drag to reorder"
            className="shrink-0 cursor-grab touch-none rounded p-1 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>

          <button
            type="button"
            onClick={() => toggleExpand(block.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
            aria-expanded={expanded}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-zinc-800/80 text-zinc-300">
              <Icon size={13} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-zinc-200">{definition.label}</span>
                <span className="rounded bg-zinc-800 px-1 font-mono text-[9px] text-zinc-500">
                  {index + 1}/{total}
                </span>
                {block.hidden ? (
                  <span className="rounded bg-amber-500/15 px-1 text-[9px] font-semibold tracking-wide text-amber-300 uppercase">
                    hidden
                  </span>
                ) : null}
              </span>
              {summary ? (
                <span className="truncate font-mono text-[10.5px] text-zinc-500">{summary}</span>
              ) : (
                <span className="text-[10.5px] text-zinc-600 italic">{definition.hint}</span>
              )}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            <Btn
              size="xs"
              title="Move up (Alt+↑)"
              onClick={() => moveByIndex(index, index - 1)}
              disabled={index === 0}
            >
              <ArrowUp size={13} />
            </Btn>
            <Btn
              size="xs"
              title="Move down (Alt+↓)"
              onClick={() => moveByIndex(index, index + 1)}
              disabled={index === total - 1}
            >
              <ArrowDown size={13} />
            </Btn>
            <Btn
              size="xs"
              title={block.hidden ? "Show in README" : "Hide from README"}
              onClick={() => toggleHidden(block.id)}
            >
              {block.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </Btn>
            <Btn size="xs" title="Duplicate" onClick={() => duplicateBlock(block.id)}>
              <Copy size={13} />
            </Btn>
            <Btn size="xs" variant="danger" title="Delete" onClick={() => removeBlock(block.id)}>
              <Trash2 size={13} />
            </Btn>
          </div>
        </div>

        {expanded ? (
          <div className="border-t border-zinc-800/80 bg-zinc-950/40 px-3 py-3">
            <BlockEditor block={block} />
            <div className="mt-3 flex items-center gap-2 border-t border-zinc-800/70 pt-2.5">
              <Btn size="xs" variant="outline" onClick={() => setPeek((value) => !value)}>
                <Braces size={12} /> {peek ? "Hide" : "Markdown"}
              </Btn>
              <span className="text-[10px] text-zinc-600">
                exactly what this block contributes to README.md
              </span>
            </div>
            {peek ? (
              <pre className="rs-scroll mt-2 max-h-64 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-400">
                {compileBlockWithHidden(block) || "(empty — this block contributes nothing)"}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
