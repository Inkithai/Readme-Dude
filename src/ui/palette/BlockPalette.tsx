import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Plus } from "lucide-react";
import { BLOCK_ORDER, BLOCKS, type BlockCategory, type BlockType, CATEGORY_LABEL } from "@/engine";
import { BLOCK_ICONS } from "@/lib/uiIcons";
import { useDocument } from "@/store/document";

/* ------------------------------------------------------------------ *
 * ui/palette/BlockPalette.tsx — the block sidebar.
 *
 * Two insertion affordances on purpose: drag for placement, click for speed.
 * (Keyboard users get Enter on the button, which is the same click path.)
 * ------------------------------------------------------------------ */

const CATEGORIES: BlockCategory[] = ["structure", "content", "media", "project"];

function PaletteItem({ type, onAdd }: { type: BlockType; onAdd: (type: BlockType) => void }) {
  const definition = BLOCKS[type];
  const Icon = BLOCK_ICONS[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { paletteType: type },
  });

  return (
    <div
      ref={setNodeRef}
      data-rs-dragging={isDragging ? "true" : "false"}
      className={`group flex items-stretch rounded-lg border transition-colors ${
        isDragging
          ? "border-indigo-500/60 opacity-60"
          : "border-zinc-800/70 bg-zinc-900/40 hover:border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={() => onAdd(type)}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-l-lg px-2 py-2 text-left"
        title={`Append ${definition.label}`}
      >
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded bg-zinc-800 text-zinc-400 group-hover:text-indigo-300">
          <Icon size={12} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[12px] font-medium text-zinc-200">{definition.label}</span>
          <span className="block truncate text-[10.5px] text-zinc-500">{definition.hint}</span>
        </span>
      </button>
      <div className="flex items-center pr-1">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label={`Drag ${definition.label} to place it`}
          title="Drag onto the canvas to place precisely"
          className="cursor-grab touch-none rounded p-1 text-zinc-700 hover:text-zinc-300 active:cursor-grabbing"
        >
          <GripVertical size={12} />
        </button>
        <button
          type="button"
          onClick={() => onAdd(type)}
          className="rounded p-1 text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-200"
          title="Append"
          tabIndex={-1}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

export function BlockPalette() {
  const addBlock = useDocument((s) => s.addBlock);
  const onAdd = (type: BlockType) => {
    addBlock(type);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-800/80 bg-zinc-900/20">
      <header className="shrink-0 border-b border-zinc-800/80 px-3 py-2">
        <h2 className="text-[11px] font-semibold tracking-[0.09em] text-zinc-400 uppercase">Blocks</h2>
      </header>
      <nav aria-label="Block palette" className="rs-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
        {CATEGORIES.map((category) => {
          const types = BLOCK_ORDER.filter((type) => BLOCKS[type].category === category);
          if (types.length === 0) return null;
          return (
            <section key={category}>
              <h3 className="mb-1.5 px-0.5 text-[9.5px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                {CATEGORY_LABEL[category]}
              </h3>
              <div className="space-y-1.5">
                {types.map((type) => (
                  <PaletteItem key={type} type={type} onAdd={onAdd} />
                ))}
              </div>
            </section>
          );
        })}
      </nav>
      <footer className="shrink-0 border-t border-zinc-800/80 px-3 py-2">
        <p className="text-[10.5px] leading-relaxed text-zinc-600">
          <span className="rounded bg-zinc-800 px-1 font-mono text-[9.5px] text-zinc-400">⌘Z</span> undo ·{" "}
          <span className="rounded bg-zinc-800 px-1 font-mono text-[9.5px] text-zinc-400">⌫</span> delete
          selected · <span className="rounded bg-zinc-800 px-1 font-mono text-[9.5px] text-zinc-400">H</span>{" "}
          hide
        </p>
      </footer>
    </div>
  );
}
