import { Plus, Wand2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import brands from "@/data/tech-brands.json";
import type { Block } from "@/engine";
import { dedent, shieldsUrl } from "@/engine";
import { useDocument } from "@/store/document";
import {
  Btn,
  Checkbox,
  CodeArea,
  Field,
  Grid,
  ListEditor,
  NumberInput,
  Segmented,
  SelectInput,
  TextArea,
  TextInput,
} from "./Fields";

/* ------------------------------------------------------------------ *
 * ui/editor/blockEditors.tsx — one property panel per block type.
 *
 * Every control here maps to exactly one field in engine/schema.ts. That 1:1
 * mapping is the reason Phase 4 (hero/badge/card/screenshot designers) can add
 * variants without touching the compiler: the variant lives in the schema, and
 * this file just renders whatever the schema declares.
 * ------------------------------------------------------------------ */

type HeroBlock = Extract<Block, { type: "hero" }>;
type HeadingBlock = Extract<Block, { type: "heading" }>;
type TextBlock = Extract<Block, { type: "text" }>;
type FeaturesBlock = Extract<Block, { type: "features" }>;
type ImageBlock = Extract<Block, { type: "image" }>;
type CodeBlock = Extract<Block, { type: "code" }>;
type TableBlock = Extract<Block, { type: "table" }>;
type BadgesBlock = Extract<Block, { type: "badges" }>;
type TechStackBlock = Extract<Block, { type: "techstack" }>;
type InstallationBlock = Extract<Block, { type: "installation" }>;
type UsageBlock = Extract<Block, { type: "usage" }>;
type LicenseBlock = Extract<Block, { type: "license" }>;
type CollapsibleBlock = Extract<Block, { type: "collapsible" }>;
type ChecklistBlock = Extract<Block, { type: "checklist" }>;
type LinksBlock = Extract<Block, { type: "links" }>;

interface PanelProps<T extends Block> {
  block: T;
  set: (patch: Record<string, unknown>) => void;
}

const LANGUAGES = [
  "bash",
  "sh",
  "shell",
  "powershell",
  "zsh",
  "json",
  "yaml",
  "toml",
  "dockerfile",
  "env",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "swift",
  "sql",
  "html",
  "css",
  "scss",
  "markdown",
  "diff",
  "ini",
];

const COLOR_PRESETS = [
  { label: "blue", value: "007ec6" },
  { label: "green", value: "4c1" },
  { label: "orange", value: "fe7d37" },
  { label: "red", value: "e05d44" },
  { label: "yellow", value: "dfb317" },
  { label: "grey", value: "9f9f9f" },
];

/* ------------------------------ hero ------------------------------ */

function UrlThumb({ url, height = 44 }: { url: string; height?: number }) {
  const [failed, setFailed] = useState(false);
  if (!url.trim() || failed) return null;
  return (
    <div className="mt-1.5 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950" style={{ height }}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="mx-auto block h-full w-auto max-w-full object-contain"
      />
    </div>
  );
}

function HeroPanel({ block, set }: PanelProps<HeroBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Segmented
        label="Alignment"
        value={p.align}
        onChange={(align) => set({ align })}
        options={[
          { value: "center", label: "Centered", title: '<div align="center"> — the classic README hero' },
          { value: "left", label: "Left aligned" },
        ]}
      />
      <Field label="Title">
        <TextInput value={p.title} onChange={(title) => set({ title })} placeholder="Project Name" />
      </Field>
      <Field label="Tagline" hint="markdown **bold** / `code` / [links](…) survive">
        <TextArea
          rows={2}
          value={p.subtitle}
          onChange={(subtitle) => set({ subtitle })}
          placeholder="What it does, and why it exists."
        />
      </Field>
      <Grid cols={2}>
        <Field label="Logo URL" className="min-w-0">
          <TextInput
            value={p.logoUrl}
            onChange={(logoUrl) => set({ logoUrl })}
            placeholder="https://…"
            mono
          />
          <UrlThumb url={p.logoUrl} height={38} />
        </Field>
        <Field label="Logo width">
          <NumberInput
            value={p.logoWidth}
            onChange={(logoWidth) => set({ logoWidth })}
            min={24}
            max={400}
            step={4}
            suffix="px"
          />
        </Field>
      </Grid>
      <ListEditor
        items={p.buttons}
        onChange={(buttons) => set({ buttons })}
        create={() => ({ label: "Get Started", url: "https://example.com" })}
        singular="Button"
        titleOf={(b) => `${b.label} → ${b.url}`}
        render={(button, update) => (
          <Grid cols={2}>
            <Field label="Label">
              <TextInput value={button.label} onChange={(label) => update({ label })} />
            </Field>
            <Field label="Link">
              <TextInput
                value={button.url}
                onChange={(url) => update({ url })}
                mono
                placeholder="https://…"
              />
            </Field>
          </Grid>
        )}
      />
      <div className="flex flex-wrap gap-1">
        {[
          { label: "Live Demo", url: "https://example.com" },
          { label: "Docs", url: "https://example.com/docs" },
          { label: "Issues", url: "https://github.com/owner/repo/issues" },
        ].map((preset) => (
          <Btn
            key={preset.label}
            size="xs"
            variant="outline"
            onClick={() => set({ buttons: [...p.buttons, preset] })}
          >
            <Plus size={11} /> {preset.label}
          </Btn>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ heading / text ------------------------------ */

function HeadingPanel({ block, set }: PanelProps<HeadingBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Segmented
        label="Level"
        value={p.level}
        onChange={(level) => set({ level })}
        options={[
          { value: 1, label: "H1" },
          { value: 2, label: "H2" },
          { value: 3, label: "H3" },
        ]}
      />
      <Field label="Text">
        <TextInput value={p.text} onChange={(text) => set({ text })} placeholder="Section title" />
      </Field>
      <Field label="Emoji" hint="optional prefix">
        <TextInput value={p.emoji} onChange={(emoji) => set({ emoji })} placeholder="🚀" />
      </Field>
    </div>
  );
}

function TextPanel({ block, set }: PanelProps<TextBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Segmented
        label="Style"
        value={p.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: "paragraph", label: "Paragraph" },
          { value: "quote", label: "Quote" },
          { value: "alert", label: "GitHub alert" },
        ]}
      />
      {p.variant === "alert" ? (
        <Segmented
          label="Alert type"
          value={p.alertType}
          onChange={(alertType) => set({ alertType })}
          options={(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const).map((type) => ({
            value: type,
            label: type.charAt(0) + type.slice(1).toLowerCase(),
          }))}
        />
      ) : null}
      <Field label="Markdown" hint="passed through as authored">
        <TextArea
          rows={7}
          value={p.body}
          onChange={(body) => set({ body })}
          spellcheck
          placeholder={"Write **markdown** here.\n\n- GFM lists\n- `code`\n- | tables | work |"}
        />
      </Field>
    </div>
  );
}

/* ------------------------------ features ------------------------------ */

function FeaturesPanel({ block, set }: PanelProps<FeaturesBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <div className="flex items-end gap-2">
        <Field label="Section title" className="flex-1">
          <TextInput value={p.title} onChange={(title) => set({ title })} />
        </Field>
        <Checkbox checked={p.showTitle} onChange={(showTitle) => set({ showTitle })}>
          Show
        </Checkbox>
      </div>
      <Segmented
        label="Layout"
        value={p.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: "bullets", label: "Bullets", title: "- **Feature** — description" },
          { value: "numbered", label: "Numbered" },
          { value: "icon-text", label: "Icon + text" },
          {
            value: "cards-2",
            label: "2-col cards",
            title: "Rendered as an HTML table (GFM tables can't do cards)",
          },
          { value: "cards-3", label: "3-col cards" },
        ]}
      />
      <ListEditor
        items={p.items}
        onChange={(items) => set({ items })}
        create={() => ({ icon: "✨", title: "New feature", body: "" })}
        singular="Feature"
        titleOf={(item) => `${item.icon ? `${item.icon} ` : ""}${item.title}`}
        render={(item, update) => (
          <div className="space-y-2">
            <Grid cols={2}>
              <Field label="Icon / emoji">
                <TextInput
                  value={item.icon}
                  onChange={(icon) => update({ icon })}
                  placeholder="⚡ or :zap:"
                />
              </Field>
              <Field label="Title">
                <TextInput value={item.title} onChange={(title) => update({ title })} />
              </Field>
            </Grid>
            <Field label="Description">
              <TextArea rows={2} value={item.body} onChange={(body) => update({ body })} />
            </Field>
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------ image / code ------------------------------ */

function ImagePanel({ block, set }: PanelProps<ImageBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Field label="Image URL" hint="must be reachable by GitHub">
        <TextInput value={p.url} onChange={(url) => set({ url })} mono placeholder="https://…" />
        <UrlThumb url={p.url} height={96} />
      </Field>
      <Grid cols={2}>
        <Field label="Alt text">
          <TextInput value={p.alt} onChange={(alt) => set({ alt })} />
        </Field>
        <Field label="Width">
          <NumberInput
            value={p.width}
            onChange={(width) => set({ width })}
            min={120}
            max={2400}
            step={20}
            suffix="px"
          />
        </Field>
      </Grid>
      <Segmented
        label="Align"
        value={p.align}
        onChange={(align) => set({ align })}
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      <Field label="Caption" hint="italic line below">
        <TextInput value={p.caption} onChange={(caption) => set({ caption })} />
      </Field>
      <Field label="Wrapping link" hint="optional">
        <TextInput value={p.linkUrl} onChange={(linkUrl) => set({ linkUrl })} mono placeholder="https://…" />
      </Field>
    </div>
  );
}

function CodePanel({ block, set }: PanelProps<CodeBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Grid cols={2}>
        <Field label="Language">
          <TextInput value={p.language} onChange={(language) => set({ language })} mono placeholder="bash" />
          <datalist id="rs-languages">
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} />
            ))}
          </datalist>
        </Field>
        <Field label="Filename" hint="shown above the fence">
          <TextInput
            value={p.filename}
            onChange={(filename) => set({ filename })}
            mono
            placeholder="docker-compose.yml"
          />
        </Field>
      </Grid>
      <Field
        label="Code"
        hint={
          <button
            type="button"
            className="text-indigo-300 hover:underline"
            onClick={() => set({ body: dedent(p.body) })}
          >
            strip indentation
          </button>
        }
      >
        <CodeArea value={p.body} onChange={(body) => set({ body })} rows={12} placeholder="$ echo hi" />
      </Field>
      <p className="text-[11px] text-zinc-600">
        Fence length adapts automatically if your snippet contains <code className="text-zinc-400">```</code>.
      </p>
    </div>
  );
}

/* ------------------------------ table ------------------------------ */

function TablePanel({ block, set }: PanelProps<TableBlock>) {
  const p = block.props;
  const columns = p.columns;
  const rows = p.rows;
  const alignment = p.alignment;

  const updateColumns = (next: string[]) => set({ columns: next });
  const updateAlignment = (index: number, value: "left" | "center" | "right") => {
    const next = [...columns.map((_, i) => alignment[i] ?? "left")] as ("left" | "center" | "right")[];
    next[index] = value;
    set({ alignment: next });
  };
  const addColumn = () => {
    updateColumns([...columns, `Column ${columns.length + 1}`]);
    updateAlignment(columns.length, "left");
  };
  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    updateColumns(columns.filter((_, i) => i !== index));
    set({
      alignment: columns.map((_, i) => alignment[i] ?? "left").filter((_, i) => i !== index),
      rows: rows.map((row) => row.filter((_, i) => i !== index)),
    });
  };
  const setCell = (rowIndex: number, colIndex: number, value: string) => {
    const next = rows.map((row, i) => {
      if (i !== rowIndex) return [...row];
      const copy = Array.from({ length: columns.length }, (_, c) => row[c] ?? "");
      copy[colIndex] = value;
      return copy;
    });
    set({ rows: next });
  };

  return (
    <div className="space-y-2.5">
      <Field label="Caption" hint="rendered as H3, blank hides it">
        <TextInput value={p.title} onChange={(title) => set({ title })} />
      </Field>
      <div className="space-y-1">
        <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
          Columns <span className="text-zinc-700">· {columns.length}</span>
        </span>
        <div className="space-y-1">
          {columns.map((column, index) => (
            <div key={index} className="flex items-center gap-1">
              <input
                value={column}
                onChange={(event) =>
                  updateColumns(columns.map((c, i) => (i === index ? event.target.value : c)))
                }
                className={`${"w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[13px] text-zinc-200 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none"}`}
              />
              <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-950/60 p-0.5">
                {(["left", "center", "right"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    title={`${mode} aligned`}
                    onClick={() => updateAlignment(index, mode)}
                    className={`rounded px-1.5 py-1 text-[10px] ${
                      (alignment[index] ?? "left") === mode
                        ? "bg-indigo-500/20 text-indigo-200"
                        : "text-zinc-500 hover:bg-zinc-800"
                    }`}
                  >
                    {mode === "left" ? "←" : mode === "center" ? "↔" : "→"}
                  </button>
                ))}
              </div>
              <Btn size="xs" variant="danger" title="Remove column" onClick={() => removeColumn(index)}>
                ×
              </Btn>
            </div>
          ))}
        </div>
        <Btn size="xs" variant="outline" onClick={addColumn}>
          <Plus size={11} /> Column
        </Btn>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
            Rows <span className="text-zinc-700">· {rows.length}</span>
          </span>
          <Btn
            size="xs"
            variant="outline"
            onClick={() => set({ rows: [...rows, Array(columns.length).fill("")] })}
          >
            <Plus size={11} /> Row
          </Btn>
        </div>
        <div className="rs-scroll overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((_, colIndex) => (
                    <td key={colIndex} className="min-w-[8rem]">
                      <input
                        value={row[colIndex] ?? ""}
                        onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
                        className="w-full rounded-[4px] border border-zinc-800 bg-zinc-950/60 px-1.5 py-1 text-[12px] text-zinc-200 hover:border-zinc-700 focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                  ))}
                  <td>
                    <Btn
                      size="xs"
                      variant="danger"
                      title="Delete row"
                      onClick={() => set({ rows: rows.filter((_, i) => i !== rowIndex) })}
                    >
                      ×
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">
        Pipes in cells are escaped for you; newlines become <code className="text-zinc-400">&lt;br&gt;</code>.
      </p>
    </div>
  );
}

/* ------------------------------ badges ------------------------------ */

function BadgeBuilder({ onApply }: { onApply: (imageUrl: string, alt: string) => void }) {
  const [label, setLabel] = useState("license");
  const [message, setMessage] = useState("MIT");
  const [color, setColor] = useState("green");
  const [style, setStyle] = useState("flat-square");
  const preview = shieldsUrl({ label, message, color, style });
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
      <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
        shields.io generator
      </span>
      <Grid cols={3}>
        <Field label="Label">
          <TextInput value={label} onChange={setLabel} />
        </Field>
        <Field label="Message">
          <TextInput value={message} onChange={setMessage} />
        </Field>
        <Field label="Color">
          <TextInput value={color} onChange={setColor} mono placeholder="green / 4c1" />
        </Field>
      </Grid>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => setColor(preset.value)}
            title={`${preset.label} (${preset.value})`}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
              color === preset.value
                ? "border-indigo-500/70 text-zinc-100"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="size-2 rounded-full" style={{ background: `#${preset.value}` }} />
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={style}
          onChange={(event) => setStyle(event.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-300"
        >
          {["flat", "flat-square", "for-the-badge", "social", "plastic"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <img src={preview} alt="preview" className="h-[20px]" />
        <Btn size="xs" variant="solid" className="ml-auto" onClick={() => onApply(preview, label || message)}>
          <Wand2 size={11} /> Use
        </Btn>
      </div>
    </div>
  );
}

const BADGE_PRESETS: {
  label: string;
  build: (url: string, style: string) => { alt: string; imageUrl: string; linkUrl: string };
}[] = [
  {
    label: "license",
    build: (_, style) => ({
      alt: "license",
      imageUrl: shieldsUrl({ label: "license", message: "MIT", color: "green", style }),
      linkUrl: "",
    }),
  },
  {
    label: "stars",
    build: (url, style) => ({
      alt: "stars",
      imageUrl: `https://img.shields.io/github/stars/${url}?style=${style}`,
      linkUrl: "",
    }),
  },
  {
    label: "issues",
    build: (url, style) => ({
      alt: "issues",
      imageUrl: `https://img.shields.io/github/issues/${url}?style=${style}`,
      linkUrl: "",
    }),
  },
  {
    label: "last commit",
    build: (url, style) => ({
      alt: "last commit",
      imageUrl: `https://img.shields.io/github/last-commit/${url}?style=${style}`,
      linkUrl: "",
    }),
  },
];

function BadgesPanel({ block, set }: PanelProps<BadgesBlock>) {
  const p = block.props;
  const [repo, setRepo] = useState("owner/repo");
  return (
    <div className="space-y-2.5">
      <Grid cols={2}>
        <SelectInput
          label="Style"
          value={p.style}
          onChange={(style) => set({ style })}
          options={(["flat", "flat-square", "for-the-badge", "social", "plastic"] as const).map((s) => ({
            value: s,
            label: s,
          }))}
        />
        <Segmented
          label="Align"
          value={p.align}
          onChange={(align) => set({ align })}
          options={[
            { value: "center", label: "Center" },
            { value: "left", label: "Left" },
          ]}
        />
      </Grid>
      <Field label="Section title" hint="optional">
        <TextInput
          value={p.title}
          onChange={(title) => set({ title })}
          placeholder="leave blank to render bare"
        />
      </Field>
      <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
        <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.09em] text-zinc-500 uppercase">
          Add live badges
        </span>
        <div className="flex items-end gap-2">
          <Field label="GitHub repo" className="flex-1">
            <TextInput value={repo} onChange={setRepo} mono placeholder="owner/repo" />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {BADGE_PRESETS.map((preset) => (
            <Btn
              key={preset.label}
              size="xs"
              variant="outline"
              onClick={() => set({ items: [...p.items, preset.build(repo.trim() || "owner/repo", p.style)] })}
            >
              <Plus size={11} /> {preset.label}
            </Btn>
          ))}
        </div>
      </div>
      <ListEditor
        items={p.items}
        onChange={(items) => set({ items })}
        create={() => ({
          alt: "badge",
          imageUrl: shieldsUrl({ label: "label", message: "value", color: "blue", style: p.style }),
          linkUrl: "",
        })}
        singular="Badge"
        titleOf={(item) => item.alt}
        render={(item, update) => (
          <div className="space-y-2">
            <Grid cols={2}>
              <Field label="Alt">
                <TextInput value={item.alt} onChange={(alt) => update({ alt })} />
              </Field>
              <Field label="Link" hint="optional">
                <TextInput value={item.linkUrl} onChange={(linkUrl) => update({ linkUrl })} mono />
              </Field>
            </Grid>
            <Field label="Image URL">
              <TextInput value={item.imageUrl} onChange={(imageUrl) => update({ imageUrl })} mono />
              <UrlThumb url={item.imageUrl} height={24} />
            </Field>
            <BadgeBuilder
              onApply={(imageUrl, alt) => {
                update({ imageUrl });
                if (alt) update({ alt });
              }}
            />
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------ tech stack ------------------------------ */

interface Brand {
  name: string;
  slug: string;
  hex: string;
}
const BRAND_LIST = brands as Brand[];

function BrandPicker({ onPick }: { onPick: (brand: Brand) => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BRAND_LIST.slice(0, 8);
    return BRAND_LIST.filter((b) => b.name.toLowerCase().includes(q) || b.slug.includes(q)).slice(0, 8);
  }, [query]);
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-2">
      <Field label="Pick a brand" hint={`${BRAND_LIST.length} curated · shields.io logos`}>
        <TextInput value={query} onChange={setQuery} placeholder="react, postgres, vite…" />
      </Field>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {results.map((brand) => (
          <button
            key={brand.slug}
            type="button"
            onClick={() => {
              onPick(brand);
              setQuery("");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-indigo-500/60 hover:text-white"
          >
            <span className="size-2 rounded-full" style={{ background: `#${brand.hex}` }} />
            {brand.name}
          </button>
        ))}
        {results.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No match — fill the fields manually.</p>
        ) : null}
      </div>
    </div>
  );
}

function TechStackPanel({ block, set }: PanelProps<TechStackBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Field label="Section title">
        <TextInput value={p.title} onChange={(title) => set({ title })} />
      </Field>
      <Segmented
        label="Layout"
        value={p.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: "badges", label: "Badges", title: "one centred shields.io row" },
          { value: "list", label: "List" },
          { value: "table", label: "Table" },
          { value: "grouped", label: "Grouped" },
        ]}
      />
      <ListEditor
        items={p.groups}
        onChange={(groups) => set({ groups })}
        create={() => ({ category: "Tools", items: [] })}
        singular="Group"
        titleOf={(group) => `${group.category || "General"} · ${group.items.length}`}
        render={(group, update) => (
          <div className="space-y-2">
            <Field label="Category">
              <TextInput
                value={group.category}
                onChange={(category) => update({ category })}
                placeholder="Core"
              />
            </Field>
            <ListEditor
              items={group.items}
              onChange={(items) => update({ items })}
              create={() => ({ name: "New tech", slug: "", hex: "" })}
              singular="Tech"
              titleOf={(item) => item.name}
              render={(item, updateItem) => (
                <div className="space-y-2">
                  <Grid cols={2}>
                    <Field label="Name">
                      <TextInput value={item.name} onChange={(name) => updateItem({ name })} />
                    </Field>
                    <Field label="Color" hint="hex, no #">
                      <TextInput
                        value={item.hex}
                        onChange={(hex) => updateItem({ hex })}
                        mono
                        placeholder="61DAFB"
                      />
                    </Field>
                  </Grid>
                  <Field label="Logo slug" hint="simple-icons key">
                    <TextInput
                      value={item.slug}
                      onChange={(slug) => updateItem({ slug })}
                      mono
                      placeholder="react"
                    />
                  </Field>
                  <BrandPicker
                    onPick={(brand) => updateItem({ name: brand.name, slug: brand.slug, hex: brand.hex })}
                  />
                  {item.name ? (
                    <img
                      src={shieldsUrl({
                        label: "",
                        message: item.name,
                        color: item.hex || "0f172a",
                        style: p.style,
                        logo: item.slug || undefined,
                        logoColor: "white",
                      })}
                      alt="preview"
                      className="h-[20px]"
                    />
                  ) : null}
                </div>
              )}
            />
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------ steps (installation / usage) ------------------------------ */

interface StepLike {
  title: string;
  body: string;
  language: string;
  code: string;
}

function StepFields({ item, update }: { item: StepLike; update: (patch: Partial<StepLike>) => void }) {
  return (
    <div className="space-y-2">
      <Field label="Title">
        <TextInput value={item.title} onChange={(title) => update({ title })} />
      </Field>
      <Field label="Description" hint="markdown ok">
        <TextArea rows={2} value={item.body} onChange={(body) => update({ body })} />
      </Field>
      <Field label="Language">
        <TextInput value={item.language} onChange={(language) => update({ language })} mono />
      </Field>
      <Field label="Snippet">
        <CodeArea value={item.code} onChange={(code) => update({ code })} rows={6} />
      </Field>
    </div>
  );
}

function InstallationPanel({ block, set }: PanelProps<InstallationBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Field label="Section title">
        <TextInput value={p.title} onChange={(title) => set({ title })} />
      </Field>
      <Field label="Intro">
        <TextArea rows={2} value={p.intro} onChange={(intro) => set({ intro })} />
      </Field>
      <ListEditor
        items={p.steps}
        onChange={(steps) => set({ steps })}
        create={() => ({ title: "New step", body: "", language: "bash", code: "" })}
        singular="Step"
        titleOf={(step) => step.title}
        render={(step, update) => <StepFields item={step} update={update} />}
      />
    </div>
  );
}

function UsagePanel({ block, set }: PanelProps<UsageBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Field label="Section title">
        <TextInput value={p.title} onChange={(title) => set({ title })} />
      </Field>
      <Field label="Intro">
        <TextArea rows={2} value={p.intro} onChange={(intro) => set({ intro })} />
      </Field>
      <ListEditor
        items={p.examples}
        onChange={(examples) => set({ examples })}
        create={() => ({ title: "New example", body: "", language: "typescript", code: "" })}
        singular="Example"
        titleOf={(example) => example.title || "(untitled example)"}
        render={(example, update) => <StepFields item={example} update={update} />}
      />
    </div>
  );
}

/* ------------------------------ license ------------------------------ */

const LICENSE_PRESETS: { name: string; notice: string; url: string }[] = [
  {
    name: "MIT",
    notice:
      "Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.\n\nCopyright (c) ${year} ${author}",
    url: "https://opensource.org/licenses/MIT",
  },
  {
    name: "Apache-2.0",
    notice: "Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).",
    url: "https://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    name: "BSD-3",
    notice: "Distributed under the BSD 3-Clause License. See [LICENSE](./LICENSE).",
    url: "https://opensource.org/licenses/BSD-3-Clause",
  },
  {
    name: "GPL-3.0",
    notice: "Distributed under the GNU GPLv3 License. See [LICENSE](./LICENSE).",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
  },
  {
    name: "Unlicense",
    notice: "This project is released under the Unlicense — public domain, no restrictions.",
    url: "https://unlicense.org",
  },
];

function LicensePanel({ block, set }: PanelProps<LicenseBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Field label="Section title">
        <TextInput value={p.title} onChange={(title) => set({ title })} />
      </Field>
      <div className="flex flex-wrap gap-1">
        {LICENSE_PRESETS.map((preset) => (
          <Btn
            key={preset.name}
            size="xs"
            variant="outline"
            onClick={() => set({ notice: preset.notice, url: preset.url, title: "License" })}
          >
            {preset.name}
          </Btn>
        ))}
      </div>
      <Field label="Notice" hint="${year} and ${author} are substituted">
        <TextArea rows={4} value={p.notice} onChange={(notice) => set({ notice })} />
      </Field>
      <Grid cols={3}>
        <Field label="Year">
          <TextInput value={p.year} onChange={(year) => set({ year })} mono />
        </Field>
        <Field label="Author">
          <TextInput value={p.author} onChange={(author) => set({ author })} />
        </Field>
        <Field label="License URL">
          <TextInput value={p.url} onChange={(url) => set({ url })} mono />
        </Field>
      </Grid>
    </div>
  );
}

/* ------------------------- phase 2: engine blocks ------------------------- */

function CollapsiblePanel({ block, set }: PanelProps<CollapsibleBlock>) {
  const p = block.props;
  return (
    <div className="space-y-2.5">
      <Grid cols={2}>
        <Field label="Summary">
          <TextInput
            value={p.summary}
            onChange={(summary) => set({ summary })}
            placeholder="Click to expand"
          />
        </Field>
        <Field label="Icon" hint="optional prefix">
          <TextInput value={p.icon} onChange={(icon) => set({ icon })} placeholder="📦" />
        </Field>
      </Grid>
      <Field label="Body" hint="Markdown is parsed here">
        <TextArea
          value={p.body}
          onChange={(body) => set({ body })}
          rows={7}
          spellcheck
          placeholder={"Fenced code, tables and lists all work."}
        />
      </Field>
      <Checkbox checked={p.open} onChange={(open) => set({ open })}>
        Expanded by default
      </Checkbox>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Emits <code className="rounded bg-zinc-800 px-1 font-mono text-[10px]">&lt;details&gt;</code> with
        blank lines around the body — without them GitHub stops parsing Markdown inside the block.
      </p>
    </div>
  );
}

function ChecklistPanel({ block, set }: PanelProps<ChecklistBlock>) {
  const p = block.props;
  const done = p.items.filter((i) => i.done).length;
  return (
    <div className="space-y-2.5">
      <Segmented
        label="Marker"
        value={p.style}
        onChange={(style) => set({ style })}
        options={[
          { value: "task", label: "- [x]", title: "GFM task list — real checkboxes on GitHub" },
          { value: "square", label: "[■]", title: "Literal boxes — render on any Markdown host" },
          { value: "circle", label: "(●)", title: "Round markers" },
        ]}
      />
      <Grid cols={2}>
        <Field label="Section title">
          <TextInput value={p.title} onChange={(title) => set({ title })} />
        </Field>
        <div className="flex flex-col justify-end gap-1.5 pb-1">
          <Checkbox checked={p.showTitle} onChange={(showTitle) => set({ showTitle })}>
            Show title
          </Checkbox>
          <Checkbox checked={p.showProgress} onChange={(showProgress) => set({ showProgress })}>
            Show progress line
          </Checkbox>
        </div>
      </Grid>
      <p className="text-[11px] text-zinc-500">
        {done} of {p.items.length} checked
      </p>
      <ListEditor
        items={p.items}
        onChange={(items) => set({ items })}
        create={() => ({ text: "New task", done: false, note: "" })}
        singular="Task"
        titleOf={(item) => item.text}
        render={(item, update) => (
          <div className="space-y-2">
            <Field label="Task" hint="Markdown allowed">
              <TextInput value={item.text} onChange={(text) => update({ text })} />
            </Field>
            <Field label="Note" hint="shown after an em dash">
              <TextInput value={item.note} onChange={(note) => update({ note })} />
            </Field>
            <Checkbox checked={item.done} onChange={(checked) => update({ done: checked })}>
              Done
            </Checkbox>
          </div>
        )}
      />
    </div>
  );
}

function LinksPanel({ block, set }: PanelProps<LinksBlock>) {
  const p = block.props;
  const imageBased = p.style === "pills" || p.style === "buttons";
  return (
    <div className="space-y-2.5">
      <Segmented
        label="Style"
        value={p.style}
        onChange={(style) => set({ style })}
        options={[
          { value: "pills", label: "Pills", title: "shields.io images inside links" },
          { value: "buttons", label: "Big buttons", title: "for-the-badge, green, with an arrow" },
          { value: "list", label: "List", title: "- [label](url) — Markdown, selectable and copyable" },
          { value: "inline", label: "Inline", title: "[a](u) · [b](u) on one line" },
        ]}
      />
      <Grid cols={3}>
        <Segmented
          label="Align"
          value={p.align}
          onChange={(align) => set({ align })}
          options={[
            { value: "center", label: "Center" },
            { value: "left", label: "Left" },
          ]}
        />
        <Field label="Colour" hint={imageBased ? "hex or name" : "unused"}>
          <TextInput value={p.color} onChange={(color) => set({ color })} mono placeholder="555" />
        </Field>
        <Field label="Section title" hint="optional">
          <TextInput value={p.title} onChange={(title) => set({ title })} />
        </Field>
      </Grid>
      {imageBased ? (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          These are <span className="text-zinc-400">images</span>, so the text is not selectable or searchable
          and it needs the network to render. Pick List or Inline when that matters.
        </p>
      ) : null}
      <ListEditor
        items={p.items}
        onChange={(items) => set({ items })}
        create={() => ({ label: "Link", url: "https://", icon: "", description: "" })}
        singular="Link"
        titleOf={(item) => item.label}
        render={(item, update) => (
          <div className="space-y-2">
            <Grid cols={2}>
              <Field label="Label">
                <TextInput value={item.label} onChange={(label) => update({ label })} />
              </Field>
              <Field label="Icon" hint="list / inline only">
                <TextInput value={item.icon} onChange={(icon) => update({ icon })} placeholder="📖" />
              </Field>
            </Grid>
            <Field label="URL">
              <TextInput value={item.url} onChange={(url) => update({ url })} mono type="url" />
            </Field>
            <Field label="Description" hint="list / inline only">
              <TextInput value={item.description} onChange={(description) => update({ description })} />
            </Field>
            {imageBased ? (
              <UrlThumb
                url={shieldsUrl({
                  label: p.style === "buttons" ? item.label : "",
                  message: p.style === "buttons" ? "→" : "",
                  color: p.color || (p.style === "buttons" ? "2ea44f" : "555"),
                  style: p.style === "buttons" ? "for-the-badge" : "flat",
                })}
                height={20}
              />
            ) : null}
          </div>
        )}
      />
    </div>
  );
}

/* ------------------------------ dispatch ------------------------------ */

export function BlockEditor({ block }: { block: Block }) {
  const patchProps = useDocument((s) => s.patchProps);
  const set = useCallback(
    (patch: Record<string, unknown>) => patchProps(block.id, patch),
    [block.id, patchProps],
  );

  switch (block.type) {
    case "hero":
      return <HeroPanel block={block} set={set} />;
    case "heading":
      return <HeadingPanel block={block} set={set} />;
    case "text":
      return <TextPanel block={block} set={set} />;
    case "features":
      return <FeaturesPanel block={block} set={set} />;
    case "image":
      return <ImagePanel block={block} set={set} />;
    case "code":
      return <CodePanel block={block} set={set} />;
    case "table":
      return <TablePanel block={block} set={set} />;
    case "badges":
      return <BadgesPanel block={block} set={set} />;
    case "techstack":
      return <TechStackPanel block={block} set={set} />;
    case "installation":
      return <InstallationPanel block={block} set={set} />;
    case "usage":
      return <UsagePanel block={block} set={set} />;
    case "license":
      return <LicensePanel block={block} set={set} />;
    case "collapsible":
      return <CollapsiblePanel block={block} set={set} />;
    case "checklist":
      return <ChecklistPanel block={block} set={set} />;
    case "links":
      return <LinksPanel block={block} set={set} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return <p className="text-[12px] text-zinc-500">No editor for this block type.</p>;
    }
  }
}
