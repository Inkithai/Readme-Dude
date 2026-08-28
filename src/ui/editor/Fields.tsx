import { ArrowDown, ArrowUp, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useId, useState } from "react";

/* ------------------------------------------------------------------ *
 * ui/editor/Fields.tsx — ReadMe Buddy's form kit.
 *
 * The product is a property-panel editor (see docs/TECH-STACK.md §3), so
 * these few controls are the whole editing surface. `Segmented` is the
 * component that realises roadmap Pillar 2 ("choose *how* it appears"), and
 * `ListEditor` is what makes repeatable children (features, badges, steps,
 * tech groups) editable without a bespoke UI per block.
 * ------------------------------------------------------------------ */

export const inputClass =
  "w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[13px] text-zinc-200 placeholder:text-zinc-600 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none";

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label ? (
        <span className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">{label}</span>
          {hint ? <span className="text-[10px] text-zinc-600">{hint}</span> : null}
        </span>
      ) : null}
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "url" | "number";
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  mono = false,
  placeholder,
  spellcheck = false,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
  spellcheck?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      spellCheck={spellcheck}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} resize-y leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
    />
  );
}

/** Code-ish fields: Tab must indent, not escape to the next control. */
export function CodeArea({
  value,
  onChange,
  rows = 8,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const target = event.currentTarget;
      const { selectionStart, selectionEnd } = target;
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = selectionStart + 2;
      });
    },
    [onChange, value],
  );

  return (
    <textarea
      value={value}
      rows={rows}
      spellCheck={false}
      placeholder={placeholder}
      onKeyDown={handleKeyDown}
      onChange={(event) => onChange(event.target.value)}
      className={`${inputClass} resize-y overflow-auto font-mono text-xs leading-[1.55] whitespace-pre`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        className={`${inputClass} w-24 font-mono text-xs`}
      />
      {suffix ? <span className="text-[11px] text-zinc-500">{suffix}</span> : null}
      {min !== undefined && max !== undefined ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-indigo-400"
          aria-label={`${suffix ?? "value"} slider`}
        />
      ) : null}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; title?: string }[];
  label?: string;
}) {
  const id = useId();
  return (
    <div>
      {label ? (
        <span className="mb-1 block text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${id}-label` : undefined}
        className="flex flex-wrap gap-0.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-0.5"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.title}
              onClick={() => onChange(option.value)}
              className={`flex-1 rounded-[5px] px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-indigo-500/20 text-indigo-200 shadow-[inset_0_0_0_1px_rgb(99_102_241/0.45)]"
                  : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={`${inputClass} cursor-pointer appearance-none`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-zinc-900">
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-zinc-300 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 cursor-pointer rounded border-zinc-700 bg-zinc-900 accent-indigo-500"
      />
      {children}
    </label>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  size = "sm",
  title,
  disabled,
  type = "button",
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "solid" | "outline" | "danger";
  size?: "xs" | "sm";
  title?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  /**
   * Declared explicitly because `Btn` does not spread props onto the DOM node:
   * an `aria-label` passed as a bare hyphenated prop typechecks but is
   * silently dropped, which is how an accessible name goes missing unnoticed.
   */
  ariaLabel?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
  const sizes = { xs: "px-1.5 py-1 text-[11px]", sm: "px-2.5 py-1.5 text-xs" };
  const variants = {
    ghost: "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100",
    outline: "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60",
    solid: "bg-indigo-500/90 text-white hover:bg-indigo-500",
    danger: "text-zinc-400 hover:bg-rose-500/15 hover:text-rose-300",
  };
  return (
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- lists ------------------------------- */

/**
 * A collapsible, reorderable editor for arrays of objects — the workhorse used
 * by Features, Badges, Installation, Usage, Hero buttons, Tech groups, …
 */
export function ListEditor<T extends object>({
  items,
  onChange,
  create,
  singular,
  titleOf,
  render,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  create: () => T;
  singular: string;
  titleOf: (item: T, index: number) => string;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
}) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const toggle = (index: number) => setOpen((current) => ({ ...current, [index]: !current[index] }));

  const replace = (index: number, next: T) => onChange(items.map((item, i) => (i === index ? next : item)));
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setOpen({});
  };
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [spliced] = next.splice(index, 1);
    if (spliced) next.splice(to, 0, spliced);
    onChange(next);
    setOpen({ [to]: true });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
          {singular}s <span className="text-zinc-700">· {items.length}</span>
        </span>
        <Btn
          size="xs"
          variant="outline"
          onClick={() => {
            setOpen({ [items.length]: true });
            onChange([...items, create()]);
          }}
        >
          <Plus size={12} /> Add
        </Btn>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] text-zinc-600">
          No {singular.toLowerCase()}s yet — exported Markdown will skip this block.
        </p>
      ) : null}

      <ul className="space-y-1">
        {items.map((item, index) => {
          const expanded = open[index] ?? false;
          const title = titleOf(item, index) || `${singular} ${index + 1}`;
          return (
            <li
              key={index}
              className={`overflow-hidden rounded-md border transition-colors ${
                expanded ? "border-zinc-700 bg-zinc-900/70" : "border-zinc-800/80 bg-zinc-900/30"
              }`}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-zinc-800/50"
                  aria-expanded={expanded}
                >
                  <ChevronRight
                    size={13}
                    className={`shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-90" : ""}`}
                  />
                  <span className="truncate text-[12px] text-zinc-300">{title}</span>
                </button>
                <Btn size="xs" title="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp size={12} />
                </Btn>
                <Btn
                  size="xs"
                  title="Move down"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                >
                  <ArrowDown size={12} />
                </Btn>
                <Btn
                  size="xs"
                  title={`Duplicate ${singular.toLowerCase()}`}
                  onClick={() => {
                    const next = [...items];
                    next.splice(index + 1, 0, structuredClone(item));
                    onChange(next);
                  }}
                >
                  <Copy size={12} />
                </Btn>
                <Btn size="xs" variant="danger" title="Remove" onClick={() => remove(index)}>
                  <Trash2 size={12} />
                </Btn>
              </div>
              {expanded ? (
                <div className="space-y-2 border-t border-zinc-800/80 px-2.5 py-2.5">
                  {render(item, (patch) => replace(index, { ...item, ...patch }), index)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const width = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[cols];
  return <div className={`grid grid-cols-1 gap-2 ${width}`}>{children}</div>;
}
