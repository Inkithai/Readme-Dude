import { useId, useState } from "react";

/* ------------------------------------------------------------------ *
 * ui/designer/kit.tsx — the controls that make this a *designer*.
 *
 * Phase 4's thesis is that the arrangement is a first-class choice, so the
 * control for it cannot be a dropdown of words: you should see the layout
 * before you commit to it. The thumbnails are drawn with divs rather than
 * icons, screenshots or images, because they have to render offline, inside
 * jsdom tests, and in the roadmap's prerendered marketing site alike — and a
 * fake picture of a layout would go stale the first time the compiler changes.
 * ------------------------------------------------------------------ */

/**
 * Live preview of any absolute image URL — the same URL the README will ask
 * GitHub to fetch. It renders nothing on purpose when the URL is empty or the
 * image fails: an error icon in a property panel reads as a broken app, and
 * `onError` cannot tell "offline sandbox" from "404".
 */
export function ImageThumb({ url, height = 44, label }: { url: string; height?: number; label?: string }) {
  const [failed, setFailed] = useState(false);
  const src = url.trim();
  if (!src || failed) return null;
  // A div, not a figure: this renders inside `Field`'s <label>, and a figure is
  // flow content where only phrasing content is allowed.
  return (
    <div className="mt-1.5">
      <div className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-950" style={{ height }}>
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="mx-auto block h-full w-auto max-w-full object-contain"
        />
      </div>
      {label ? <span className="mt-1 block text-[10px] text-zinc-600">{label}</span> : null}
    </div>
  );
}

/* ------------------------------- layout ------------------------------- */

export type LayoutShape = "single" | "columns" | "gallery" | "split";

const Tile = ({ className = "" }: { className?: string }) => (
  <span className={`block rounded-[2px] bg-zinc-500/70 ${className}`} />
);

const Line = ({ className = "" }: { className?: string }) => (
  <span className={`block h-[2px] rounded-full bg-zinc-700 ${className}`} />
);

/** A 3:2 diagram of the arrangement, drawn from boxes and rules. */
function ShapeDiagram({ shape }: { shape: LayoutShape }) {
  const frame =
    "flex h-9 w-full items-center justify-center gap-1 rounded-[4px] border border-zinc-700/80 bg-zinc-950/70 p-1";
  if (shape === "single") {
    return (
      <span className={frame}>
        <span className="flex w-3/5 flex-col items-center gap-1">
          <Tile className="h-4 w-full" />
          <Line className="w-2/3" />
        </span>
      </span>
    );
  }
  if (shape === "columns") {
    return (
      <span className={frame}>
        <Tile className="h-5 w-2/5" />
        <Tile className="h-5 w-2/5" />
      </span>
    );
  }
  if (shape === "gallery") {
    return (
      <span className={`${frame} flex-col`}>
        <span className="flex w-full flex-1 gap-1">
          <Tile className="h-full flex-1" />
          <Tile className="h-full flex-1" />
          <Tile className="h-full flex-1" />
        </span>
        <span className="flex w-full gap-1">
          <Line className="flex-1" />
          <Line className="flex-1" />
          <Line className="flex-1" />
        </span>
      </span>
    );
  }
  return (
    <span className={frame}>
      <Tile className="h-6 w-2/5" />
      <span className="flex flex-1 flex-col gap-[3px]">
        <Line />
        <Line className="w-4/5" />
        <Line className="w-3/5" />
      </span>
    </span>
  );
}

/**
 * A radio group of layout choices. The field name is the group's accessible
 * name, so a screen reader announces "Layout, radio 2 of 5, 3 columns" instead
 * of a wall of unlabelled buttons.
 */
export function LayoutPicker<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; shape: LayoutShape; hint?: string }[];
}) {
  const id = useId();
  return (
    <div>
      {label ? (
        <span
          id={`${id}-label`}
          className="mb-1 block text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase"
        >
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={label ? undefined : "Layout"}
        className="grid grid-cols-2 gap-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={`cursor-pointer rounded-md border p-1.5 text-left transition-colors ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <ShapeDiagram shape={option.shape} />
              <span className="mt-1 block text-[11px] font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
