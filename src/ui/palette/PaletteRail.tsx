import { LayoutTemplate, Shapes } from "lucide-react";
import { lazy, Suspense } from "react";
import { useDocument } from "@/store/document";
import { BlockPalette } from "./BlockPalette";

/* ------------------------------------------------------------------ *
 * ui/palette/PaletteRail.tsx — the left rail: blocks or presets.
 *
 * The gallery is `lazy`: twelve hand-written presets plus the generated brand
 * table are 23 kB gzip of *content*, and content you open with a click should
 * not be in the chunk that paints the editor. Measured: boot 154 kB gzip with
 * an eager import, 132 kB with this one line.
 *
 * One rail, two tabs, because both answer the same question at different
 * stages of a document ("what do I add next?" / "what does a finished one look
 * like?"). The canvas's empty state can switch this rail from the outside via
 * `setRail("templates")`, which is why the tab lives in the store and not in
 * local state — and why it is excluded from undo history.
 * ------------------------------------------------------------------ */

const TemplateGallery = lazy(() => import("./TemplateGallery").then((m) => ({ default: m.TemplateGallery })));

const TABS = [
  { id: "blocks", label: "Blocks", icon: Shapes },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
] as const;

export function PaletteRail() {
  const rail = useDocument((s) => s.rail);
  const setRail = useDocument((s) => s.setRail);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-800/80 bg-zinc-900/20">
      <header className="shrink-0 border-b border-zinc-800/80 px-2 py-2">
        <div
          role="tablist"
          aria-label="Left rail"
          className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-0.5"
        >
          {TABS.map((tab) => {
            const active = rail === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`rs-rail-tab-${tab.id}`}
                aria-selected={active}
                aria-controls={`rs-rail-panel-${tab.id}`}
                onClick={() => setRail(tab.id)}
                title={tab.id === "templates" ? "Start from a preset" : "Add a block to the canvas"}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-indigo-500/20 text-indigo-200 shadow-[inset_0_0_0_1px_rgb(99_102_241/0.45)]"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div
        id={`rs-rail-panel-${rail}`}
        role="tabpanel"
        aria-labelledby={`rs-rail-tab-${rail}`}
        className="min-h-0 flex-1"
      >
        {rail === "blocks" ? (
          <BlockPalette />
        ) : (
          <Suspense
            fallback={
              <p className="px-3 py-3 text-[11px] text-zinc-600">
                Loading presets…{" "}
                <span className="text-zinc-700">(they are the biggest file in this app)</span>
              </p>
            }
          >
            <TemplateGallery />
          </Suspense>
        )}
      </div>
    </div>
  );
}
