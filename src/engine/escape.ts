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

/** A URL is only allowed to be emitted if it is absolute or a repo-relative path. */
export function sanitizeUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^javascript:/i.test(value) || /^data:text\/html/i.test(value)) return "";
  return value.replace(/"/g, "%22").replace(/\s+/g, "%20");
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
