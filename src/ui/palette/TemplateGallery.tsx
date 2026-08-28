import { ChevronRight, Layers, Plus, Replace, type Sparkles, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { type DocumentKind, KIND_LABEL } from "@/engine";
import { previewTemplate, TEMPLATES, type Template, templatesForKind } from "@/engine/templates";
import { useDocument } from "@/store/document";

/* ------------------------------------------------------------------ *
 * ui/palette/TemplateGallery.tsx — the Phase 3 presets.
 *
 * A gallery, not a dropdown: the useful part of a template is seeing what it
 * commits you to, so every card lists its sections in order and reveals the
 * exact Markdown the preset compiles to. Both numbers come from the engine
 * (`previewTemplate`), never from a hand-maintained description, so the
 * gallery cannot lie about a preset.
 *
 * Two gestures: *Replace* (start from this preset) and *Append* (add its
 * sections after what you have). Replace is destructive, so it asks when the
 * document is not empty — and ⌘Z always puts the old one back.
 * ------------------------------------------------------------------ */

const KIND_ICON: Record<DocumentKind, typeof Sparkles> = { project: Layers, profile: UserRound };

function TemplateCard({
  template,
  open,
  onToggle,
}: {
  template: Template;
  open: boolean;
  onToggle: () => void;
}) {
  const blocks = useDocument((s) => s.blocks);
  const applyTemplate = useDocument((s) => s.applyTemplate);
  const [confirming, setConfirming] = useState(false);
  const dirty = blocks.length > 0;

  // Compiling a whole preset is ~1 ms; doing it for all twelve on every render
  // of the rail is the kind of cost that turns a nice feature into a laggy
  // one, so the Markdown is computed when the card is opened.
  const preview = useMemo(() => (open ? previewTemplate(template) : null), [open, template]);
  const sectionCount = useMemo(() => template.blocks().length, [template]);

  const apply = (mode: "replace" | "append") => {
    if (mode === "replace" && dirty && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    applyTemplate(template, mode);
  };

  return (
    <li className="overflow-hidden rounded-lg border border-zinc-800/70 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onToggle();
        }}
        aria-expanded={open}
        className="w-full px-2.5 py-2 text-left hover:bg-zinc-800/30"
      >
        <span className="flex items-start gap-2">
          <ChevronRight
            size={13}
            className={`mt-0.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-zinc-100">{template.label}</span>
            <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{template.blurb}</span>
          </span>
          <span className="shrink-0 rounded bg-zinc-800 px-1 font-mono text-[9.5px] text-zinc-400">
            {sectionCount}
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-zinc-800/70 px-2.5 py-2.5">
          <ol className="flex flex-wrap gap-1" aria-label="Sections in this preset">
            {preview?.sections.map((section, index) => (
              <li
                // Sections repeat by design (two Text blocks in a row), so the
                // key is positional on purpose — the list is never reordered.
                key={`${section.type}-${index}`}
                className="rounded border border-zinc-800 bg-zinc-950/60 px-1.5 py-0.5 text-[10px] text-zinc-400"
              >
                {section.label}
              </li>
            ))}
          </ol>

          {template.notes.length > 0 ? (
            <ul className="space-y-1">
              {template.notes.map((note) => (
                <li key={note} className="flex gap-1.5 text-[11px] leading-snug text-zinc-500">
                  <span className="mt-[3px] size-1 shrink-0 rounded-full bg-indigo-400/70" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <details className="group">
            <summary className="cursor-pointer text-[10.5px] font-semibold tracking-[0.08em] text-zinc-500 uppercase hover:text-zinc-300">
              Markdown this produces
            </summary>
            <pre className="rs-scroll mt-1.5 max-h-52 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/70 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-zinc-400">
              {preview?.markdown ?? ""}
            </pre>
          </details>

          {confirming ? (
            <p className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
              Replace your {blocks.length} block{blocks.length === 1 ? "" : "s"}? ⌘Z undoes it.
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    applyTemplate(template, "replace");
                  }}
                  className="rounded bg-amber-400/90 px-2 py-0.5 font-medium text-zinc-950 hover:bg-amber-300"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded px-2 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Keep
                </button>
              </span>
            </p>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => apply("replace")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-500/90 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                title={dirty ? "Replace the current document with this preset" : "Load this preset"}
              >
                <Replace size={12} /> {dirty ? "Use instead" : "Use this"}
              </button>
              <button
                type="button"
                onClick={() => applyTemplate(template, "append")}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:text-white"
                title="Add these sections after your current ones"
              >
                <Plus size={12} /> Append
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export function TemplateGallery() {
  const kind = useDocument((s) => s.kind);
  // One card open at a time: the gallery lives in a narrow rail, and two open
  // Markdown dumps side by side is a scroll, not a comparison.
  const [openId, setOpenId] = useState<string | null>(null);
  const onOpen = (id: string | null) => setOpenId((current) => (current === id ? null : id));

  // The document's own kind opens the matching tab: a profile README should
  // not have to go hunting for profile presets. It stays a *filter*, not a
  // restriction — and switching it deliberately does not touch the document.
  // Applying a preset is what sets `kind`; the toolbar is what sets it by hand.
  const [filter, setFilter] = useState<DocumentKind>(kind);
  const shown = templatesForKind(filter);
  const other = TEMPLATES.length - shown.length;

  const otherLabel = KIND_LABEL[filter === "project" ? "profile" : "project"];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-zinc-800/80 px-2.5 py-2">
        <div
          role="radiogroup"
          aria-label="Preset family"
          className="flex gap-0.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-0.5"
        >
          {(["project", "profile"] as const).map((value) => {
            const Icon = KIND_ICON[value];
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-indigo-500/20 text-indigo-200 shadow-[inset_0_0_0_1px_rgb(99_102_241/0.45)]"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                }`}
              >
                <Icon size={12} /> {KIND_LABEL[value]}
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] leading-snug text-zinc-600">
          {shown.length} {filter} preset{shown.length === 1 ? "" : "s"} · {other} for an{" "}
          <button
            type="button"
            onClick={() => setFilter(filter === "project" ? "profile" : "project")}
            className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-200"
          >
            {otherLabel.toLowerCase()}
          </button>
          . Presets are block compositions, so everything stays editable.
        </p>
      </div>

      <ul className="rs-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5" aria-label="README presets">
        {shown.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            open={openId === template.id}
            onToggle={() => onOpen(template.id)}
          />
        ))}
      </ul>

      <footer className="shrink-0 border-t border-zinc-800/80 px-2.5 py-2">
        <p className="text-[10.5px] leading-relaxed text-zinc-600">
          Nothing is uploaded: a preset is the same block data you would have typed, with{" "}
          <span className="rounded bg-zinc-800 px-1 font-mono text-[9.5px] text-zinc-400">⌘Z</span> wired
          through it.
        </p>
      </footer>
    </div>
  );
}
