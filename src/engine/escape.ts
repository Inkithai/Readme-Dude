/* ------------------------------------------------------------------ *
 * engine/escape.ts — the small, boring functions that decide whether
 * the exported README renders correctly on GitHub. Every one of these
 * exists because of a specific failure mode, noted inline.
 * ------------------------------------------------------------------ */

/** Escape for text/attributes inside inline HTML (`<p align>`, `<img alt>`). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape the characters that would change how GFM interprets a *label*.
 *
 * The contract, applied consistently across the compiler: single-line fields
 * (headings, section titles, button labels) are **plain text**, so anything
 * Markdown would interpret is neutralised here. Multi-line `body` fields are
 * **Markdown**, and are passed through untouched — escaping there would break
 * the very syntax people are writing.
 *
 * Deliberate omissions, each because escaping costs more than it buys:
 *  - `_` — GFM already refuses to emphasise intra-word underscores, which is
 *    the case that shows up in titles (`snake_case`, `my_project`). A
 *    boundary pair (`_why_`) in a heading is more likely intentional.
 *  - `[text](url)` — links inside headings work on GitHub and are useful.
 *  - `*` inside a word is emphasised, so it *is* escaped.
 */
export function escapeInlineMarkdown(input: string): string {
  let out = input
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/<(?=[A-Za-z/!])/g, "\\<");
  out = out.replace(/~~(?=\S)[\s\S]*?~~/g, (m) => m.replace(/~/g, "\\~"));
  // Two `$` in one title opens a math span on GitHub, which renders as a
  // garbled formula instead of the literal text (`$PATH and $HOME`).
  if ((out.match(/\$(?<!\\)/g)?.length ?? 0) >= 2) out = out.replace(/\$/g, "\\$");
  return out;
}

/**
 * A URL is only emitted if it is absolute, repo-relative, or a same-page
 * anchor. Anything executable is dropped rather than escaped: an empty `href`
 * is a broken button, but a `javascript:` one is a vulnerability, and the
 * README outlives this app.
 */
export function sanitizeUrl(input: string): string {
  // A control character inside the scheme is how these bypass a naive prefix
  // test (`java\nscript:`). \p{Cc} is C0+C1 controls only: spaces must survive,
  // because they are turned into %20 below, not deleted.
  const value = input.trim().replace(/\p{Cc}/gu, "");
  if (!value) return "";
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (scheme) {
    const name = (scheme[1] ?? "").toLowerCase();
    const allowed = new Set(["http", "https", "mailto", "tel"]);
    // data: URIs are dropped wholesale, images included: GitHub's camo proxy
    // refuses them, so an export that kept them would look fine here and break
    // in the repo. validate.ts reports it so the user learns why.
    if (name === "data") return "";
    if (!allowed.has(name)) return "";
  }
  return value.replace(/"/g, "%22").replace(/\s+/g, "%20");
}

/** True when a URL was dropped by `sanitizeUrl` even though it was not empty. */
export function isUnsafeUrl(input: string): boolean {
  const raw = input.trim();
  return raw.length > 0 && sanitizeUrl(raw) === "";
}

/**
 * GFM table cells: `|` must be escaped and newlines must become <br>, or the
 * table silently collapses into one row.
 */
export function escapeTableCell(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i) => line.length > 0 || i === 0)
    .map((line) => line.replace(/\\/g, "\\\\").replace(/\|/g, "\\|"))
    .join("<br>");
}

/** Longest run of backticks in a string (used to pick a safe fence length). */
export function longestBacktickRun(input: string): number {
  let max = 0;
  const re = /`+/g;
  let m = re.exec(input);
  while (m) {
    max = Math.max(max, m[0].length);
    m = re.exec(input);
  }
  return max;
}

/**
 * Pick a code fence that cannot be closed by the content itself.
 * A body containing ``` breaks a 3-backtick fence; we grow it. (GFM only
 * allows ```` and up, so fall back to tildes past 4.)
 */
export function fenceFor(body: string): string {
  const run = longestBacktickRun(body);
  if (run >= 4) return "~".repeat(Math.min(Math.max(run + 1, 3), 15));
  return "`".repeat(Math.max(3, run + 1));
}

/** Normalize CRLF/CR → LF and drop trailing spaces that would create <br>s. */
export function normalizeLines(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
}

/** Strip the common leading indentation of pasted code (keeps relative indent). */
export function dedent(input: string): string {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const indented = lines.filter((l) => l.trim().length > 0);
  if (indented.length === 0) return input.trim();
  const min = Math.min(...indented.map((l) => /^[\t ]*/.exec(l)?.[0].length ?? 0));
  if (!Number.isFinite(min) || min === 0) return lines.join("\n").trim();
  return lines
    .map((l) => (l.trim().length === 0 ? "" : l.slice(min)))
    .join("\n")
    .trim();
}

/** Prefix every line (used for blockquotes / alerts). Blank lines still need the marker. */
export function prefixLines(input: string, prefix: string): string {
  return input
    .split("\n")
    .map((line) => (line.length ? prefix + line : prefix.trimEnd()))
    .join("\n");
}

/** Collapse blank-line runs to at most one and ensure a single trailing newline. */
export function tidyDocument(input: string): string {
  const collapsed = input
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
  return collapsed.length ? `${collapsed}\n` : "";
}

/** Guard: does this look like a GitHub-reachable image URL (needed by README images)? */
export function isProbablyImageUrl(input: string): boolean {
  const v = input.trim();
  if (!v) return false;
  return /^(https?:)?\/\//i.test(v) || /^\/[\w./-]+$/.test(v) || /^\.?\/[\w./-]+$/.test(v);
}
