import {
  dedent,
  escapeHtml,
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

const nl = (value: string): string => normalizeLines(value).trim();
const safeUrl = (value: string): string => sanitizeUrl(value);

/* ------------------------------- blocks ------------------------------- */

type AnyProps = Record<string, unknown>;

function withProps<T extends BlockType>(block: Block, _type: T): PropsOf<T> & AnyProps {
  return block.props as unknown as PropsOf<T> & AnyProps;
}

function compileHero(block: Block): string {
  const p = withProps(block, "hero");
  const lines: string[] = [`<div align="${p.align === "left" ? "left" : "center"}">`];
  const logo = safeUrl(p.logoUrl as string);
  if (logo) {
    lines.push(`  <img src="${logo}" alt="Logo" width="${Number(p.logoWidth) || 96}" />`, "");
  }
  lines.push(`  <h1>${escapeHtml(nl(p.title as string))}</h1>`, "");
  const subtitle = nl(p.subtitle as string);
  if (subtitle) lines.push(`  <p>${inlineMarkdownToHtml(subtitle).replace(/\n/g, "<br />")}</p>`, "");
  const buttons = (p.buttons ?? []) as { label: string; url: string }[];
  if (buttons.length) {
    for (const b of buttons) {
      const href = safeUrl(b.url);
      const img = shieldsUrl({
        label: b.label,
        message: "→",
        color: "2ea44f",
        style: "for-the-badge",
      });
      lines.push(`  <a href="${href}"><img src="${img}" alt="${escapeHtml(b.label)}" /></a>`);
    }
    lines.push("");
  }
  lines.push("</div>");
  return lines.join("\n");
}

function compileHeading(block: Block): string {
  const p = withProps(block, "heading");
  const level = "#".repeat(Math.min(6, Math.max(1, Number(p.level) || 2)));
  const emoji = nl(p.emoji as string);
  const text = nl(p.text as string);
  return `${level} ${emoji ? `${emoji} ` : ""}${text}`;
}

function compileText(block: Block): string {
  const p = withProps(block, "text");
  const body = normalizeLines(p.body as string).trim();
  if (!body) return "";
  if (p.variant === "quote") return prefixLines(body, "> ");
  if (p.variant === "alert") return `> [!${p.alertType}]\n${prefixLines(body, "> ")}`;
  return body;
}

function compileFeatures(block: Block): string {
  const p = withProps(block, "features");
  const items = (p.items ?? []) as { icon: string; title: string; body: string }[];
  const out: string[] = [];
  const title = nl(p.title as string);
  if (p.showTitle && title) out.push(`## ${title}`, "");
  if (items.length === 0) return out.join("\n");

  const layout = p.layout as string;
  if (layout === "bullets" || layout === "numbered" || layout === "icon-text") {
    const list = items.map((item, i) => {
      const icon = item.icon.trim();
      const head = icon.length > 0 ? `${icon} **${item.title}**` : `**${item.title}**`;
      const body = item.body.trim();
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

  const renderCard = (item: { icon: string; title: string; body: string }): string => {
    const icon = item.icon.trim();
    const body = inlineMarkdownToHtml(item.body.trim()).replace(/\n/g, "<br />");
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

function compileImage(block: Block): string {
  const p = withProps(block, "image");
  const src = safeUrl(p.url as string);
  if (!src) return "";
  const alt = escapeHtml(nl(p.alt as string) || "Image");
  const width = Number(p.width) > 0 ? ` width="${Math.min(2400, Number(p.width))}"` : "";
  const img = `<img src="${src}" alt="${alt}"${width} />`;
  const link = safeUrl(p.linkUrl as string);
  const body = link ? `<a href="${link}">${img}</a>` : img;
  const lines = p.align === "left" ? [body] : [`<p align="${p.align}">`, `  ${body}`, "</p>"];
  const caption = nl(p.caption as string);
  if (caption) lines.push("", `*${inlineMarkdownToHtml(caption)}*`);
  return lines.join("\n");
}

function compileCode(block: Block): string {
  const p = withProps(block, "code");
  const body = dedent(normalizeLines((p.body as string) ?? ""));
  const fence = fenceFor(body);
  const lang = nl(p.language as string).replace(/[^\w+#.-]/g, "");
  const filename = nl(p.filename as string);
  const head = filename ? `\`${filename}\`\n\n` : "";
  return `${head}${fence}${lang}\n${body}\n${fence}`;
}

function compileTable(block: Block): string {
  const p = withProps(block, "table");
  const columns = (p.columns ?? []) as string[];
  const rows = (p.rows ?? []) as string[][];
  const align = (p.alignment ?? []) as ("left" | "center" | "right")[];
  if (columns.length === 0) return "";

  const title = nl(p.title as string);
  const out: string[] = [];
  if (title) out.push(`### ${title}`, "");

  const cells = (values: string[]): string[] =>
    Array.from({ length: columns.length }, (_, i) => escapeTableCell(values[i] ?? ""));

  out.push(`| ${cells(columns).join(" | ")} |`);
  out.push(
    `| ${Array.from({ length: columns.length }, (_, i) => {
      const a = align[i] ?? "left";
      return a === "center" ? ":---:" : a === "right" ? "---:" : "---";
    }).join(" | ")} |`,
  );
  for (const row of rows) {
    if (row.every((c) => c.trim() === "")) continue;
    out.push(`| ${cells(row).join(" | ")} |`);
  }
  return out.join("\n");
}

function compileBadges(block: Block): string {
  const p = withProps(block, "badges");
  const items = (p.items ?? []) as { alt: string; imageUrl: string; linkUrl: string }[];
  const out: string[] = [];
  const title = nl(p.title as string);
  if (title) out.push(`## ${title}`, "");
  if (items.length === 0) return out.join("\n");

  const rendered = items.map((item) => {
    const src = safeUrl(item.imageUrl);
    if (!src) return "";
    const img = `<img src="${src}" alt="${escapeHtml(item.alt || "badge")}" />`;
    const link = safeUrl(item.linkUrl);
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
  // Single-text badge: `badge/<name>-<brandHex>` is shields' message+colour
  // form, i.e. the name on a brand-coloured background with a white logo.
  return shieldsUrl({
    message: name,
    color: hex.replace(/^#/, "") || "0f172a",
    style,
    logo: slug || undefined,
    logoColor: "white",
  });
}

function techHtmlRow(items: { name: string; slug: string; hex: string }[], style: string): string {
  const imgs = items.map((item) => {
    const url = techBadgeUrl(item.name, item.slug, item.hex, style);
    return `  <img src="${url}" alt="${escapeHtml(item.name)}" />`;
  });
  return [`<p align="center">`, ...imgs, "</p>"].join("\n");
}

function compileTechStack(block: Block): string {
  const p = withProps(block, "techstack");
  const groups = (p.groups ?? []) as {
    category: string;
    items: { name: string; slug: string; hex: string }[];
  }[];
  const out: string[] = [];
  const title = nl(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  if (nonEmpty.length === 0) return out.join("\n");

  const variant = p.variant as string;

  if (variant === "list") {
    out.push(
      nonEmpty
        .map((g) => `- **${g.category.trim() || "General"}:** ${g.items.map((i) => i.name).join(", ")}`)
        .join("\n"),
    );
    return out.join("\n");
  }

  if (variant === "table") {
    out.push("| Category | Technologies |", "| --- | --- |");
    for (const g of nonEmpty) {
      out.push(
        `| ${escapeTableCell(g.category || "General")} | ${escapeTableCell(g.items.map((i) => i.name).join(", "))} |`,
      );
    }
    return out.join("\n");
  }

  if (variant === "grouped") {
    const sections = nonEmpty.map((g) =>
      [`### ${g.category.trim() || "General"}`, "", techHtmlRow(g.items, p.style as string)].join("\n"),
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
  const steps = (p.steps ?? []) as { title: string; body: string; code: string; language: string }[];
  const out: string[] = [];
  const title = nl(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const intro = normalizeLines((p.intro as string) ?? "").trim();
  if (intro) out.push(intro, "");
  // Numbered bold paragraphs rather than a markdown list: a fenced block
  // nested inside `1.` needs 4-space indentation to stay in the item, which
  // is exactly the kind of thing users (and copy-paste) break.
  const body = steps.map((s, i) =>
    stepBlock(s.title, steps.length > 1 ? i + 1 : null, s.body, s.code, s.language),
  );
  if (body.length) out.push(body.join("\n\n"));
  return out.join("\n");
}

function compileUsage(block: Block): string {
  const p = withProps(block, "usage");
  const examples = (p.examples ?? []) as { title: string; body: string; code: string; language: string }[];
  const out: string[] = [];
  const title = nl(p.title as string);
  if (title) out.push(`## ${title}`, "");
  const intro = normalizeLines((p.intro as string) ?? "").trim();
  if (intro) out.push(intro, "");
  const body = examples.map((e) => {
    const parts: string[] = [];
    const t = e.title.trim();
    if (t) parts.push(/^#{1,6}\s/.test(t) ? t : `### ${t}`);
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
  const title = nl(p.title as string);
  if (title) out.push(`## ${title}`, "");
  let notice = normalizeLines(p.notice as string).trim();
  notice = notice
    .replace(/\$\{year\}/g, (p.year as string) || String(new Date().getFullYear()))
    .replace(/\$\{author\}/g, (p.author as string) || "the authors");
  const link = safeUrl(p.url as string);
  if (link && !/\[[^\]]+\]\([^)]+\)/.test(notice)) {
    notice = `${notice.replace(/\.$/, "")} See [${title || "LICENSE"}](${link}) for more information.`;
  }
  if (notice) out.push(notice);
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
