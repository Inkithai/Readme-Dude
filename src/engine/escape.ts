/* ------------------------------------------------------------------ *
 * engine/escape.ts — the small, boring functions that decide whether
 * the exported README renders correctly on GitHub. Every one of these
 * exists because of a specific failure mode, noted inline.
 *
 * TOTALITY, applied to every function here: a missing field must come out as
 * an empty string, never as a TypeError. Props reach the compiler through
 * paths that do not re-validate them (`patchProps` is deliberately raw so
 * typing is never gated on the schema; `insertBlock`/`replaceBlocks` accept
 * objects from templates and, later, from the Markdown importer), and a throw
 * inside a compiler replaces that whole block with an HTML comment in the
 * user's README. So each helper takes the value, coerces it, and moves on.
 * The guard test for this is __tests__/robustness.test.ts.
 * ------------------------------------------------------------------ */

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/** Escape for text/attributes inside inline HTML (`<p align>`, `<img alt>`). */
export function escapeHtml(input: string | null | undefined): string {
  return asText(input)
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
export function escapeInlineMarkdown(input: string | null | undefined): string {
  let out = asText(input)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/<(?=[A-Za-z/!])/g, "\\<");
  out = out.replace(/~~(?=\S)[\s\S]*?~~/g, (m) => m.replace(/~/g, "\\~"));
  // Two `$` in one title opens a math span on GitHub, which renders as a
  // garbled formula instead of the literal text (`$PATH and $HOME`). Only
  // dollars that are not already escaped count *and* get escaped: `\$` in the
  // source must not be doubled into a literal backslash followed by a dollar.
  if ((out.match(/(?<!\\)\$/g)?.length ?? 0) >= 2) out = out.replace(/(?<!\\)\$/g, "\\$");
  return out;
}

/**
 * A URL is only emitted if it is absolute, repo-relative, or a same-page
 * anchor. Anything executable is dropped rather than escaped: an empty `href`
 * is a broken button, but a `javascript:` one is a vulnerability, and the
 * README outlives this app.
 */
export function sanitizeUrl(input: string | null | undefined): string {
  // A control character inside the scheme is how these bypass a naive prefix
  // test (`java\nscript:`). \p{Cc} is C0+C1 controls only: spaces must survive,
  // because they are turned into %20 below, not deleted.
  const value = asText(input)
    .trim()
    .replace(/\p{Cc}/gu, "");
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
export function isUnsafeUrl(input: string | null | undefined): boolean {
  const raw = asText(input).trim();
  return raw.length > 0 && sanitizeUrl(raw) === "";
}

/**
 * GFM table cells: `|` must be escaped and newlines must become <br>, or the
 * table silently collapses into one row. Empty lines are dropped rather than
 * kept at index 0 — a cell whose text starts with a newline must not render a
 * stray <br> before the first word.
 */
export function escapeTableCell(input: string | null | undefined): string {
  return asText(input)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/\\/g, "\\\\").replace(/\|/g, "\\|"))
    .join("<br>");
}

/** Longest run of `marker` in a string. */
export function longestRun(input: string | null | undefined, marker: "`" | "~"): number {
  let max = 0;
  const re = new RegExp(`\\${marker}+`, "g");
  let m = re.exec(asText(input));
  while (m) {
    max = Math.max(max, m[0].length);
    m = re.exec(asText(input));
  }
  return max;
}

/** Longest run of backticks in a string (kept for its name; `longestRun` is the general form). */
export function longestBacktickRun(input: string | null | undefined): number {
  return longestRun(input, "`");
}

/**
 * Pick a fence that cannot be closed by the content itself.
 *
 * A closing fence must be at least as long as the opening one, so the real rule
 * is "strictly longer than the longest run of *that* marker in the body" — and
 * only the marker actually used matters, because a run of tildes cannot close a
 * backtick fence. The old version grew for backticks but switched to a fixed
 * `~~~~~` for the body's tildes too, so a code sample containing five tildes
 * closed its own fence and the rest of the file turned into prose.
 *
 * Backticks are the default even where tildes would do, because that is what
 * people expect to read in a README; they are only traded away once the fence
 * has to be longer than four. (Both markers honour long fences on GitHub;
 * verified against POST /api.github.com/markdown.)
 */
export function fenceFor(body: string | null | undefined): string {
  const text = asText(body);
  const backtick = Math.min(15, Math.max(3, longestRun(text, "`") + 1));
  if (backtick <= 4) return "`".repeat(backtick); // the ordinary case
  const tilde = Math.max(3, longestRun(text, "~") + 1);
  return tilde < backtick ? "~".repeat(tilde) : "`".repeat(backtick);
}

/** Normalize CRLF/CR → LF and drop trailing spaces that would create <br>s. */
export function normalizeLines(input: string | null | undefined): string {
  return asText(input)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "");
}

/** Strip the common leading indentation of pasted code (keeps relative indent). */
export function dedent(input: string | null | undefined): string {
  const lines = asText(input).replace(/\r\n?/g, "\n").split("\n");
  const indented = lines.filter((l) => l.trim().length > 0);
  if (indented.length === 0) return asText(input).trim();
  const min = Math.min(...indented.map((l) => /^[\t ]*/.exec(l)?.[0].length ?? 0));
  if (!Number.isFinite(min) || min === 0) return lines.join("\n").trim();
  return lines
    .map((l) => (l.trim().length === 0 ? "" : l.slice(min)))
    .join("\n")
    .trim();
}

/** Prefix every line (used for blockquotes / alerts). Blank lines still need the marker. */
export function prefixLines(input: string, prefix: string): string {
  return asText(input)
    .split("\n")
    .map((line) => (line.length ? prefix + line : prefix.trimEnd()))
    .join("\n");
}

/** Collapse blank-line runs to at most one and ensure a single trailing newline. */
export function tidyDocument(input: string | null | undefined): string {
  const collapsed = asText(input)
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
  return collapsed.length ? `${collapsed}\n` : "";
}

/** Guard: does this look like a GitHub-reachable image URL (needed by README images)? */
export function isProbablyImageUrl(input: string | null | undefined): boolean {
  const v = asText(input).trim();
  if (!v) return false;
  return /^(https?:)?\/\//i.test(v) || /^\/[\w./-]+$/.test(v) || /^\.\.?\/[\w./-]+$/.test(v);
}
