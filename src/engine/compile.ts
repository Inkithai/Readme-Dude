import {
  dedent,
  escapeHtml,
  escapeInlineMarkdown,
  escapeTableCell,
  fenceFor,
  normalizeLines,
  prefixLines,
  sanitizeUrl,
  tidyDocument,
} from "./escape";
import type { Block, BlockType, PropsOf } from "./schema";

/* ------------------------------------------------------------------ *
 * engine/compile.ts — Block → GitHub Flavored Markdown.
 *
 * This is deliberately *string building*, not an AST stringifier: GFM is
 * quirky (markdown is not parsed inside HTML blocks, table cells cannot
 * contain raw newlines, fences must outgrow their content) and each quirk
 * needs a local, testable workaround rather than a generic one.
 * ------------------------------------------------------------------ */

/* ------------------------------ helpers ------------------------------ */

/**
 * One shields.io URL path segment.
 *
 * shields.io splits `/badge/<content>` on `-`, and decodes `_` → space,
 * `__` → underscore, `--` → dash. So dashes must be doubled *before* spaces
 * are turned into single underscores, or a two-word label silently becomes
 * two segments (and the colour lands in the wrong place).
 */
export function shieldsSegment(input: string): string {
  const escaped = input.trim().replace(/_/g, "__").replace(/-/g, "--").replace(/\s+/g, "_");
  // Percent-encode the rest (# & / % + ?), leaving _ and - untouched.
  return encodeURIComponent(escaped).replace(/%5F/g, "_").replace(/%2D/g, "-");
}

export interface ShieldSpec {
  label?: string;
  message?: string;
  color?: string;
  style?: string;
  logo?: string;
  logoColor?: string;
  labelColor?: string;
}

/**
 * Static badge URL. Two shapes are valid, so build them explicitly:
 *   `label-message-color` (both texts) and `message-color` (single text).
 * The colour always goes in the path — `?color=` is only for the odd
 * `badge/x?color=` form shields itself emits and is redundant here.
 */
export function shieldsUrl(spec: ShieldSpec): string {
  const label = (spec.label ?? "").trim();
  const message = (spec.message ?? "").trim();
  const color = (spec.color ?? "555").trim().replace(/^#/, "");
  // shields parses from the right: the last segment is the colour, the one
  // before it the message, and everything left of that the label. So a
  // single text must NOT be emitted as `text--color` (that is an empty
  // message), it has to be `text-color`.
  const texts = [label, message].filter((value) => value.length > 0);
  const content =
    texts.length >= 2
      ? `${shieldsSegment(texts[0] as string)}-${shieldsSegment(texts[1] as string)}-${color}`
      : `${shieldsSegment(texts[0] ?? "badge")}-${color}`;
  const params = new URLSearchParams({ style: spec.style || "flat" });
  if (spec.logo) params.set("logo", spec.logo);
  if (spec.logo && spec.logoColor) params.set("logoColor", spec.logoColor.replace(/^#/, ""));
  if (spec.labelColor) params.set("labelColor", spec.labelColor.replace(/^#/, ""));
  return `https://img.shields.io/badge/${content}?${params.toString()}`;
}

/**
 * The inline markdown subset that GitHub will *not* parse inside an HTML
 * block — converted to HTML by us so styling survives. Supports `code`,
 * **bold**, *italic*, and [text](url).
 */
export function inlineMarkdownToHtml(input: string): string {
  let out = escapeHtml(input);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

const nl = (value: string | null | undefined): string => normalizeLines(value).trim();

/**
 * Optional string fields can be absent — a document hand-edited in JSON, or one
 * half-written by the future Markdown importer. The compiler must degrade to an
 * empty string rather than throw, because a thrown error replaces the whole
 * block with an HTML comment in the user's README.
 */
const str = (value: unknown): string => (typeof value === "string" ? value : "");
/** Same guard for the array fields a half-authored block may leave out entirely. */
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const safeUrl = (value: string | null | undefined): string => sanitizeUrl(value);

/**
 * Label fields (headings, section titles, list-item titles) are plain text, so
 * Markdown syntax in them is neutralised. Bodies are never passed here — they
 * are Markdown by contract. See escapeInlineMarkdown for what is left alone.
 */
const label = (value: string | null | undefined): string => escapeInlineMarkdown(nl(value));

/* ------------------------------- blocks ------------------------------- */

type AnyProps = Record<string, unknown>;

function withProps<T extends BlockType>(block: Block, _type: T): PropsOf<T> & AnyProps {
  const props = block.props;
  // Not every caller runs through zod: `patchProps`, `insertBlock` and
  // `replaceBlocks` write straight into the model, so a `null` or a stray
  // string can reach here from a UI bug or a hand-merged document. Reading a
  // property off `null` throws, and a throw replaces the user's section with an
  // HTML comment — which is a worse outcome than an empty one.
  if (typeof props !== "object" || props === null || Array.isArray(props)) {
    return {} as PropsOf<T> & AnyProps;
  }
  return props as unknown as PropsOf<T> & AnyProps;
}

function compileHero(block: Block): string {
  const p = withProps(block, "hero");
  const lines: string[] = [`<div align="${p.align === "left" ? "left" : "center"}">`];
  const logo = safeUrl(p.logoUrl as string);
  if (logo) {
    // `clampedWidth`, like the banner below: this field used to be emitted
    // verbatim, so a hand-edited 99999 or 0.5 became a README-wide layout
    // explosion (schema bounds are not a runtime guard — `patchProps` skips
    // zod, and JSON import is permissive by design).
    lines.push(`  <img src="${logo}" alt="Logo" width="${clampedWidth(p.logoWidth, 96, 1000)}" />`, "");
  }
  lines.push(`  <h1>${escapeHtml(nl(p.title as string))}</h1>`, "");
  const subtitle = nl(p.subtitle as string);
  if (subtitle) lines.push(`  <p>${inlineMarkdownToHtml(subtitle).replace(/\n/g, "<br />")}</p>`, "");
  // The hero's own screenshot: what the thing looks like, between the promise
  // and the buttons. Inside the <div align> wrapper, so it centres itself.
  const banner = safeUrl(p.imageUrl as string);
  if (banner) {
    const alt = escapeHtml(nl(p.imageAlt as string) || "Screenshot");
    lines.push(`  <img src="${banner}" alt="${alt}" width="${clampedWidth(p.imageWidth, 720)}" />`, "");
  }
  const buttons = list<{ label?: string; url?: string }>(p.buttons);
  const rendered = [];
  for (const b of buttons) {
    const href = safeUrl(str(b.url));
    if (!href) continue; // same rule as compileLinks: a dead button is worse than none
    const img = shieldsUrl({
      label: str(b.label),
      message: "→",
      color: "2ea44f",
      style: "for-the-badge",
    });
    rendered.push(`  <a href="${href}"><img src="${img}" alt="${escapeHtml(str(b.label))}" /></a>`);
  }
  if (rendered.length) {
    lines.push(...rendered, "");
  }
  lines.push("</div>");
  return lines.join("\n");
}

function compileHeading(block: Block): string {
  const p = withProps(block, "heading");
  const level = "#".repeat(Math.min(6, Math.max(1, Number(p.level) || 2)));
  const emoji = nl(p.emoji as string);
  return `${level} ${emoji ? `${emoji} ` : ""}${label(p.text as string)}`;
}

function compileText(block: Block): string {
  const p = withProps(block, "text");
  const body = normalizeLines(p.body as string).trim();
  if (!body) return "";
  if (p.variant === "quote") return prefixLines(body, "> ");
  if (p.variant === "alert") {
    // A half-filled block (JSON by hand, or a template that forgot the field)
    // must not print a literal `[!undefined]`, which GitHub renders as text.
    const kind = str(p.alertType).trim().toUpperCase() || "NOTE";
    return `> [!${kind}]\n${prefixLines(body, "> ")}`;
  }
  return body;
}

function compileFeatures(block: Block): string {
  const p = withProps(block, "features");
  const items = list<{ icon?: string; title?: string; body?: string }>(p.items);
  const out: string[] = [];
  const title = label(p.title as string);
  if (p.showTitle && title) out.push(`## ${title}`, "");
  if (items.length === 0) return out.join("\n");

  const layout = p.layout as string;
  if (layout === "bullets" || layout === "numbered" || layout === "icon-text") {
    const list = items.map((item, i) => {
      const icon = str(item.icon).trim();
      const head = icon.length > 0 ? `${icon} **${label(item.title)}**` : `**${label(item.title)}**`;
      const body = str(item.body).trim();
      const bullet = layout === "numbered" ? `${i + 1}.` : "-";
      if (layout === "icon-text" && body)
        return `${bullet} ${head}<br />${" ".repeat(bullet.length + 1)}${body}`;
      return `${bullet} ${body ? `${head} — ${body}` : head}`;
    });
    out.push(list.join("\n"));
    return out.join("\n");
  }

  // cards-2 / cards-3 → an HTML table, since GFM tables cannot span rows or
  // hold block-level content. Two/three columns, wrapped automatically.
  const perRow = layout === "cards-2" ? 2 : 3;
  const width = `${Math.floor(100 / perRow)}%`;

  const renderCard = (item: { icon?: string; title?: string; body?: string }): string => {
    const icon = str(item.icon).trim();
    const body = inlineMarkdownToHtml(str(item.body).trim()).replace(/\n/g, "<br />");
    return [
      `<td width="${width}" align="center">`,
      "  <p>",
      icon ? `  <span>${escapeHtml(icon)}</span>` : "",
      `  <strong>${escapeHtml(item.title)}</strong>`,
      body ? `  ${body}` : "",
      "  </p>",
      "</td>",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const table: string[] = ["<table>"];
  for (let i = 0; i < items.length; i += perRow) {
    const row = items.slice(i, i + perRow);
    const cells = Array.from({ length: perRow }, (_, col) => {
      const item = row[col];
      return item ? renderCard(item) : `<td width="${width}"></td>`;
    });
    table.push("<tr>", ...cells, "</tr>");
  }
  table.push("</table>");
  out.push(table.join("\n"));
  return out.join("\n");
}

/* ---------------------------- screenshots ---------------------------- */

/** One normalised image out of a Screenshot block. */
interface Shot {
  src: string;
  alt: string;
  caption: string;
  link: string;
}

/**
 * `items` is what rows and galleries walk; the block-level `url` is the
 * single-image form, and also what a row shows before you have added anything
 * to it — which is the state you land in when you switch layout mid-edit.
 */
function toShot(raw: { url?: unknown; alt?: unknown; caption?: unknown; link?: unknown }): Shot | null {
  const src = safeUrl(str(raw.url));
  if (!src) return null;
  return {
    src,
    alt: escapeHtml(nl(str(raw.alt)) || "Screenshot"),
    caption: nl(str(raw.caption)),
    link: safeUrl(str(raw.link)),
  };
}

function collectShots(p: AnyProps): Shot[] {
  const rawItems = list<Record<string, unknown>>(p.items);
  // A row you have *started* is a row you own: once the list exists, a blank
  // slot means "no image here", and quietly borrowing the block-level `url`
  // instead would put an image on the page that the panel does not show.
  if (rawItems.length > 0) {
    return rawItems.map((item) => toShot(item ?? {})).filter((value): value is Shot => value !== null);
  }
  const only = toShot({ url: p.url, alt: p.alt, caption: p.caption, link: p.linkUrl });
  return only ? [only] : [];
}

/** The block-level image, which is also what `single` shows first. */
function leadShot(p: AnyProps): Shot | undefined {
  return toShot({ url: p.url, alt: p.alt, caption: p.caption, link: p.linkUrl }) ?? collectShots(p)[0];
}

/** `width="…"` for an `<img>`; a missing or junk number renders no attribute. */
function pxWidth(value: unknown, fallback = 0): string {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return ` width="${Math.min(2400, n || fallback)}"`;
}
const clampedWidth = (value: unknown, fallback: number, max = 2400): number => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(max, n) : fallback;
};

const shotImg = (shot: Shot, width: string): string => {
  const img = `<img src="${shot.src}" alt="${shot.alt}"${width} />`;
  return shot.link ? `<a href="${shot.link}">${img}</a>` : img;
};

/** `single` — a bare `<img>`, or a centred one inside `<p>`, plus an italic caption. */
function renderShot(shot: Shot, width: string, align: string, caption: string): string {
  const body = shotImg(shot, width);
  const lines = align === "left" ? [body] : [`<p align="${align}">`, `  ${body}`, "</p>"];
  const text = caption || shot.caption;
  if (text) lines.push("", `*${inlineMarkdownToHtml(text)}*`);
  return lines.join("\n");
}

function compileImage(block: Block): string {
  const p = withProps(block, "image");
  const layout = str(p.layout) || "single";

  if (layout === "single") {
    // Prefer the block's own image, then the first item: flipping a filled row
    // back to Single must not blank the canvas.
    const shot = leadShot(p);
    if (!shot) return "";
    // Caption is body-Markdown, so it is not label()-escaped — but *emphasis*
    // wrapping it needs the caption itself to be non-empty.
    return renderShot(shot, pxWidth(p.width), str(p.align) || "center", nl(p.caption as string));
  }

  const shots = collectShots(p);
  const prose = normalizeLines(str(p.text)).trim();
  const perRow = Math.trunc(Number(p.columns)) === 3 ? 3 : 2;
  const cellWidth = `${Math.floor(100 / perRow)}%`;

  if (layout === "split") {
    const first = shots[0];
    // Either half can be empty without losing the other one.
    if (!first) return prose;
    if (!prose) return renderShot(first, pxWidth(p.width), str(p.align) || "center", "");
    const image = [`  ${shotImg(first, ' width="100%"')}`];
    if (first.caption) image.push(`  <p><em>${inlineMarkdownToHtml(first.caption)}</em></p>`);
    const body = inlineMarkdownToHtml(prose).replace(/\n/g, "<br />");
    return [
      "<table>",
      "<tr>",
      `<td width="55%">`,
      ...image,
      "</td>",
      `<td width="45%" valign="top">`,
      `  <p>${body}</p>`,
      "</td>",
      "</tr>",
      "</table>",
    ].join("\n");
  }

  if (shots.length === 0) return "";

  // `columns` and `gallery` are the same HTML table with a different sizing
  // model: rows keep the block's pixel width (side-by-side screenshots that
  // stay the size you chose), galleries fill the cell (a showcase grid). Both
  // wrap onto new rows every `columns` images, and pad the trailing row so the
  // last one cannot stretch to full width — GitHub sizes `<td>` by content.
  const gallery = layout === "gallery";
  const cell = (shot: Shot): string => {
    const img = shotImg(shot, gallery ? ' width="100%"' : pxWidth(p.width));
    const lines = [`<td width="${cellWidth}" align="center">`];
    if (gallery) {
      lines.push("  <p>", `  ${img}`);
      if (shot.caption) lines.push(`  <em>${inlineMarkdownToHtml(shot.caption)}</em>`);
      lines.push("  </p>");
    } else {
      lines.push(`  ${img}`);
      if (shot.caption) lines.push(`  <br /><em>${inlineMarkdownToHtml(shot.caption)}</em>`);
    }
    lines.push("</td>");
    return lines.join("\n");
  };

  // No `<p align>` wrapper here: a table is a block-level element GitHub
  // left-aligns, and `align` deliberately does nothing for these two layouts
  // (the editor stops offering it, rather than offering a dead control).
  const table: string[] = ["<table>"];
  for (let i = 0; i < shots.length; i += perRow) {
    const row = shots.slice(i, i + perRow);
    const cells = Array.from({ length: perRow }, (_, col) => {
      const shot = row[col];
      return shot ? cell(shot) : `<td width="${cellWidth}"></td>`;
    });
    table.push("<tr>", ...cells, "</tr>");
  }
  table.push("</table>");
  return table.join("\n");
}

function compileCode(block: Block): string {
  const p = withProps(block, "code");
  const body = dedent(normalizeLines((p.body as string) ?? ""));
  const fence = fenceFor(body);
  const lang = nl(p.language as string).replace(/[^\w+#.-]/g, "");
  // Backticks stripped: a filename is inline code by construction, so a stray
  // one in the field would split the span in two.
  const filename = nl(p.filename as string)
    .replace(/`/g, "")
    .trim();
  const head = filename ? `\`${filename}\`\n\n` : "";
  return `${head}${fence}${lang}\n${body}\n${fence}`;
}

function compileTable(block: Block): string {
  const p = withProps(block, "table");
  const columns = list<string>(p.columns);
  const rows = list<(string | null | undefined)[]>(p.rows);
  const align = list<"left" | "center" | "right">(p.alignment);
  if (columns.length === 0) return "";

  const title = label(p.title as string);
  const out: string[] = [];
  if (title) out.push(`### ${title}`, "");

  const cells = (values: (string | null | undefined)[]): string[] =>
    Array.from({ length: columns.length }, (_, i) => escapeTableCell(str(values[i])));

  out.push(`| ${cells(columns).join(" | ")} |`);
  out.push(
    `| ${Array.from({ length: columns.length }, (_, i) => {
      const a = align[i] ?? "left";
      return a === "center" ? ":---:" : a === "right" ? "---:" : "---";
    }).join(" | ")} |`,
  );
  for (const row of rows) {
    if (row.every((c) => str(c).trim() === "")) continue;
    out.push(`| ${cells(row).join(" | ")} |`);
  }
  return out.join("\n");
}

function compileBadges(block: Block): string {
  const p = withProps(block, "badges");
  const items = list<{ alt?: string; imageUrl?: string; linkUrl?: string }>(p.items);
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  if (items.length === 0) return out.join("\n");

  const rendered = items.map((item) => {
    const src = safeUrl(str(item.imageUrl));
    if (!src) return "";
    const img = `<img src="${src}" alt="${escapeHtml(str(item.alt) || "badge")}" />`;
    const link = safeUrl(str(item.linkUrl));
    return link ? `<a href="${link}">${img}</a>` : img;
  });
  const kept = rendered.filter(Boolean);
  if (kept.length === 0) return out.join("\n");

  if (p.align === "center") {
    out.push(['<p align="center">', ...kept.map((k) => `  ${k}`), "</p>"].join("\n"));
  } else {
    out.push(kept.join(" "));
  }
  return out.join("\n");
}

function techBadgeUrl(name: string, slug: string, hex: string, style: string): string {
  // `name` is the only one of these that can be empty (a template that lists a
  // technology by name only), and shields needs *something* to render.
  const text = name.trim() || "tech";
  // Single-text badge: `badge/<name>-<brandHex>` is shields' message+colour
  // form, i.e. the name on a brand-coloured background with a white logo.
  return shieldsUrl({
    message: text,
    color: hex.replace(/^#/, "") || "0f172a",
    style,
    logo: slug || undefined,
    logoColor: "white",
  });
}

function techHtmlRow(items: { name?: string; slug?: string; hex?: string }[], style: string): string {
  const imgs = items.map((item) => {
    const url = techBadgeUrl(str(item.name), str(item.slug), str(item.hex), style);
    return `  <img src="${url}" alt="${escapeHtml(str(item.name))}" />`;
  });
  return [`<p align="center">`, ...imgs, "</p>"].join("\n");
}

function compileTechStack(block: Block): string {
  const p = withProps(block, "techstack");
  const groups = list<{ category?: string; items?: { name?: string; slug?: string; hex?: string }[] }>(
    p.groups,
  ).map((g) => ({
    ...g,
    items: list<{ name?: string }>(g.items),
  }));
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  const nameOf = (value: unknown): string => str(value).trim() || "Untitled";
  if (nonEmpty.length === 0) return out.join("\n");

  const variant = p.variant as string;

  if (variant === "list") {
    out.push(
      nonEmpty
        .map(
          (g) => `- **${label(g.category) || "General"}:** ${g.items.map((i) => nameOf(i.name)).join(", ")}`,
        )
        .join("\n"),
    );
    return out.join("\n");
  }

  if (variant === "table") {
    out.push("| Category | Technologies |", "| --- | --- |");
    for (const g of nonEmpty) {
      out.push(
        `| ${escapeTableCell(str(g.category) || "General")} | ${escapeTableCell(g.items.map((i) => nameOf(i.name)).join(", "))} |`,
      );
    }
    return out.join("\n");
  }

  if (variant === "grouped") {
    const sections = nonEmpty.map((g) =>
      [`### ${label(g.category) || "General"}`, "", techHtmlRow(g.items, p.style as string)].join("\n"),
    );
    out.push(sections.join("\n\n"));
    return out.join("\n");
  }

  // variant === "badges": everything in one centred row, categories inlined as labels
  const all = nonEmpty.flatMap((g) => g.items);
  out.push(techHtmlRow(all, p.style as string));
  return out.join("\n");
}

function stepBlock(
  title: string,
  index: number | null,
  body: string,
  code: string,
  language: string,
): string {
  const parts: string[] = [];
  // label(): a `*` or `_`_ in a step title would otherwise flip the bold off
  // and leak the marker into the README.
  const heading = index === null ? `**${title}**` : `**${index}. ${title}**`;
  parts.push(heading);
  const text = normalizeLines(body).trim();
  if (text) parts.push("", text);
  const snippet = dedent(normalizeLines(code ?? "").trim());
  if (snippet) {
    const fence = fenceFor(snippet);
    const lang = normalizeLines(language)
      .trim()
      .replace(/[^\w+#.-]/g, "");
    parts.push("", `${fence}${lang}\n${snippet}\n${fence}`);
  }
  return parts.join("\n");
}

function compileInstallation(block: Block): string {
  const p = withProps(block, "installation");
  const steps = list<{ title?: string; body?: string; code?: string; language?: string }>(p.steps).map(
    (s) => ({ title: str(s.title), body: str(s.body), code: str(s.code), language: str(s.language) }),
  );
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const intro = normalizeLines((p.intro as string) ?? "").trim();
  if (intro) out.push(intro, "");
  // Numbered bold paragraphs rather than a markdown list: a fenced block
  // nested inside `1.` needs 4-space indentation to stay in the item, which
  // is exactly the kind of thing users (and copy-paste) break.
  const body = steps.map((s, i) =>
    stepBlock(label(s.title), steps.length > 1 ? i + 1 : null, s.body, s.code, s.language),
  );
  if (body.length) out.push(body.join("\n\n"));
  return out.join("\n");
}

function compileUsage(block: Block): string {
  const p = withProps(block, "usage");
  const examples = list<{ title?: string; body?: string; code?: string; language?: string }>(p.examples).map(
    (e) => ({ title: str(e.title), body: str(e.body), code: str(e.code), language: str(e.language) }),
  );
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const intro = normalizeLines((p.intro as string) ?? "").trim();
  if (intro) out.push(intro, "");
  const body = examples.map((e) => {
    const parts: string[] = [];
    const t = str(e.title).trim();
    // A heading the user typed themselves keeps its own markup; one we add the
    // `###` to is a label, so it gets the label treatment.
    if (t) parts.push(/^#{1,6}\s/.test(t) ? t : `### ${label(t)}`);
    const text = normalizeLines(e.body).trim();
    if (text) parts.push(text);
    const snippet = dedent(normalizeLines(e.code).trim());
    if (snippet) {
      const fence = fenceFor(snippet);
      const lang = normalizeLines(e.language)
        .trim()
        .replace(/[^\w+#.-]/g, "");
      parts.push(`${fence}${lang}\n${snippet}\n${fence}`);
    }
    return parts.join("\n\n");
  });
  if (body.length) out.push(body.join("\n\n"));
  return out.join("\n");
}

function compileLicense(block: Block): string {
  const p = withProps(block, "license");
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  let notice = normalizeLines(p.notice as string).trim();
  const canAppend = notice.length > 0;
  notice = notice
    .replace(/\$\{year\}/g, (p.year as string) || String(new Date().getFullYear()))
    .replace(/\$\{author\}/g, (p.author as string) || "the authors");
  const link = safeUrl(p.url as string);
  if (link && canAppend && !/\[[^\]]+\]\([^)]+\)/.test(notice)) {
    notice = `${notice.replace(/\.$/, "")} See [${title || "LICENSE"}](${link}) for more information.`;
  }
  if (notice) out.push(notice);
  return out.join("\n");
}

function compileCollapsible(block: Block): string {
  const p = withProps(block, "collapsible");
  const icon = nl(p.icon as string);
  const summary = escapeHtml(icon ? `${icon} ${nl(p.summary as string)}` : nl(p.summary as string));
  const body = normalizeLines((p.body as string) ?? "").trim();
  const out: string[] = [`<details${p.open ? " open" : ""}>`, `<summary>${summary}</summary>`];
  // The blank lines are load-bearing: an HTML block ends at a blank line, and
  // that is what lets GitHub parse the Markdown between them as Markdown.
  if (body) out.push("", body, "");
  out.push("</details>");
  return out.join("\n");
}

function compileChecklist(block: Block): string {
  const p = withProps(block, "checklist");
  const items = list<Partial<{ text: string; done: boolean; note: string }>>(p.items);
  const out: string[] = [];
  const title = label(str(p.title));
  if (p.showTitle && title) out.push(`## ${title}`, "");
  if (items.length === 0) return out.join("\n");

  const style = p.style as string;
  out.push(
    items
      .map((item) => {
        const text = normalizeLines(str(item.text)).trim();
        const note = normalizeLines(str(item.note)).trim();
        // Inline, not an indented continuation: a blank line would turn the
        // list loose and re-indent every other item.
        const body = note ? `${text} — ${note}` : text;
        if (style === "task") return `- [${item.done ? "x" : " "}] ${body}`;
        const mark = style === "square" ? (item.done ? "[■]" : "[□]") : item.done ? "(●)" : "( )";
        return `- ${mark} ${body}`;
      })
      .join("\n"),
  );

  if (p.showProgress) {
    const done = items.filter((i) => i.done).length;
    const all = done === items.length;
    out.push("", `${all ? "✅" : "🕐"} ${done} of ${items.length} complete`);
  }
  return out.join("\n");
}

function compileLinks(block: Block): string {
  const p = withProps(block, "links");
  const raw = list<Partial<{ label: string; url: string; icon: string; description: string }>>(p.items);
  const out: string[] = [];
  const title = label(p.title as string);
  if (title) out.push(`## ${title}`, "");
  // An unsafe URL is dropped, not emitted as href="" — a missing button beats
  // a clickable nothing, and validate.ts reports why.
  const items = raw.map((i) => ({ ...i, href: safeUrl(str(i.url)) })).filter((i) => i.href.length > 0);
  if (items.length === 0) return out.join("\n");

  const style = p.style as string;
  if (style === "list" || style === "inline") {
    // These stay pure Markdown on purpose: GFM cannot centre a Markdown line,
    // and wrapping it in <p align> would stop GitHub parsing the links inside.
    const text = (item: (typeof items)[number]): string => {
      const note = normalizeLines(str(item.description)).trim();
      return `[${label(str(item.label))}](${item.href})${note ? ` — ${note}` : ""}`;
    };
    out.push(
      style === "list"
        ? items
            .map((i) => {
              const icon = str(i.icon).trim();
              return `- ${icon ? `${icon} ` : ""}${text(i)}`;
            })
            .join("\n")
        : items.map(text).join(" · "),
    );
    return out.join("\n");
  }

  // pills / buttons → shields.io images inside <a>, which is the only way to
  // get a centred button row that survives GitHub's HTML sanitizer.
  const buttons = style === "buttons";
  const colorOf = str(p.color).trim() || (buttons ? "2ea44f" : "555");
  const rendered = items.map((item) => {
    // pills use shields' *single-text* form, which is `message-color`; using
    // `label-color` instead would render a badge reading "badge".
    const url = shieldsUrl(
      buttons
        ? { label: str(item.label), message: "→", color: colorOf, style: "for-the-badge" }
        : { message: str(item.label), color: colorOf, style: "flat" },
    );
    return `<a href="${item.href}"><img src="${url}" alt="${escapeHtml(str(item.label))}" /></a>`;
  });
  out.push(
    p.align === "center"
      ? [`<p align="center">`, ...rendered.map((r) => `  ${r}`), "</p>"].join("\n")
      : rendered.join(" "),
  );
  return out.join("\n");
}

/* ------------------------------ dispatch ------------------------------ */

const COMPILERS: Record<BlockType, (block: Block) => string> = {
  hero: compileHero,
  heading: compileHeading,
  text: compileText,
  features: compileFeatures,
  image: compileImage,
  code: compileCode,
  table: compileTable,
  badges: compileBadges,
  techstack: compileTechStack,
  installation: compileInstallation,
  usage: compileUsage,
  license: compileLicense,
  collapsible: compileCollapsible,
  checklist: compileChecklist,
  links: compileLinks,
};

/** One block → its Markdown. Used by the canvas "peek" and by tests. */
export function compileBlock(block: Block): string {
  if (block.hidden) return "";
  const compiler = COMPILERS[block.type];
  if (!compiler) return "";
  try {
    return normalizeLines(compiler(block)).trim();
  } catch (error) {
    // Never let one malformed block destroy the whole export.
    const reason = error instanceof Error ? error.message : String(error);
    return `<!-- readme-buddy: could not compile "${block.type}" block (${reason}) -->`;
  }
}

/** The visible blocks, in order → a complete README.md body. */
export function compileDocument(blocks: Block[]): string {
  return tidyDocument(
    blocks
      .filter((b) => !b.hidden)
      .map(compileBlock)
      .filter(Boolean)
      .join("\n\n"),
  );
}

/** All blocks, hidden ones annotated — used only by the per-block peek. */
export function compileBlockWithHidden(block: Block): string {
  if (!block.hidden) return compileBlock(block);
  const withoutHidden = { ...block, hidden: false };
  return `<!-- hidden: not included in README.md -->\n\n${compileBlock(withoutHidden)}`;
}
