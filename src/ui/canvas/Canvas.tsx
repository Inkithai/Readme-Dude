import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { FoldVertical, LayoutTemplate, MousePointerClick, Plus } from "lucide-react";
import { Fragment } from "react";
import { BLOCKS, type BlockType } from "@/engine";
import { useBlocks, useDocument } from "@/store/document";
import { BlockCard } from "./BlockCard";

/* ------------------------------------------------------------------ *
 * ui/canvas/Canvas.tsx — the document outline.
 *
 * Between every pair of cards sits a `gap:<index>` droppable. That single
 * mechanism serves both required interactions: dragging a card reorders it,
 * dragging a palette item inserts it — no separate "insert zone" UI needed.
 * ------------------------------------------------------------------ */

const QUICK_START: BlockType[] = ["hero", "badges", "features", "techstack"];

function Gap({ index, overId }: { index: number; overId: string | null }) {
  const { setNodeRef } = useDroppable({ id: `gap:${index}` });
  return <div ref={setNodeRef} className="rs-gap" data-over={overId === `gap:${index}` ? "true" : "false"} />;
}

export function Canvas({ overId }: { overId: string | null }) {
  const blocks = useBlocks();
  const addBlock = useDocument((s) => s.addBlock);
  const expand = useDocument((s) => s.expand);
  const setRail = useDocument((s) => s.setRail);

  const visible = blocks.filter((block) => !block.hidden).length;
  const hidden = blocks.length - visible;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.09em] text-zinc-400 uppercase">
          <LayoutTemplate size={13} /> Canvas
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-zinc-600">
            {visible} visible{hidden > 0 ? ` · ${hidden} hidden` : ""}
          </span>
          {blocks.length > 0 ? (
            <button
              type="button"
              onClick={() => expand(null)}
              title="Collapse every block"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300"
            >
              <FoldVertical size={12} /> Collapse
            </button>
          ) : null}
        </div>
      </header>

      <div className="rs-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-24">
        {blocks.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-6 text-center">
            <MousePointerClick size={20} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-[13px] font-medium text-zinc-300">Your README is empty</p>
            <p className="mt-1 mb-3 text-[12px] leading-relaxed text-zinc-500">
              Click a block on the left to append it, or drag it onto the canvas to place it exactly. A hero
              and a features section cover most of what readers scan.
            </p>
            <button
              type="button"
              onClick={() => setRail("templates")}
              className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/50 bg-indigo-500/10 px-3 py-1.5 text-[11.5px] font-medium text-indigo-200 transition-colors hover:bg-indigo-500/20"
            >
              <LayoutTemplate size={12} /> Or start from a preset
            </button>
            <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Quick start">
              {QUICK_START.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-indigo-500/60 hover:text-white"
                >
                  <Plus size={11} /> {BLOCKS[type].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2" aria-label="Document blocks">
              {blocks.map((block, index) => (
                <Fragment key={block.id}>
                  <Gap index={index} overId={overId} />
                  <BlockCard block={block} index={index} total={blocks.length} />
                </Fragment>
              ))}
              <Gap index={blocks.length} overId={overId} />
            </ol>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
