import { isProbablyImageUrl, isUnsafeUrl } from "./escape";
import type { Block, DocumentKind } from "./schema";

/* ------------------------------------------------------------------ *
 * engine/validate.ts — "GitHub correctness" as a feature.
 *
 * The compiler never produces broken Markdown from our own blocks, but the
 * two passthrough surfaces (Text bodies and user-pasted code/HTML) and the
 * image URLs *can* produce a README that renders wrong on GitHub. Rather
 * than promise perfect output, we detect the common breakages and tell the
 * user before they paste it into their repo.
 * ------------------------------------------------------------------ */

export type IssueLevel = "error" | "warning" | "info";

export interface Issue {
  level: IssueLevel;
  rule: string;
  message: string;
  blockId?: string;
  /** What to do about it — surfaced in the UI next to the message. */
  fix?: string;
}

function countFenceLines(md: string): { backtick: number; tilde: number } {
  let backtick = 0;
  let tilde = 0;
  for (const line of md.split("\n")) {
    if (/^ {0,3}`{3,}/.test(line)) backtick++;
    else if (/^ {0,3}~{3,}/.test(line)) tilde++;
  }
  return { backtick, tilde };
}

export interface ValidateOptions {
  /**
   * The document's `kind` (Phase 3). It only ever *adds* nudges — a profile
   * README and a project README compile identically, because they use the same
   * blocks, so the checks that differ are advice about the audience rather
   * than rules about the syntax.
   */
  kind?: DocumentKind;
}

export function validateDocument(blocks: Block[], markdown: string, options: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const push = (issue: Issue) => issues.push(issue);

  if (!markdown.trim()) {
    push({
      level: "error",
      rule: "empty-document",
      message: "The README is empty — nothing will be exported.",
      fix: "Add a block from the left panel, or un-hide hidden blocks.",
    });
    return issues;
  }

  // 1. Fences must balance or everything after the first block renders as code.
  const fences = countFenceLines(markdown);
  if (fences.backtick % 2 !== 0) {
    const culprit = blocks.find((b) => countOddFence(b));
    push({
      level: "error",
      rule: "unbalanced-fence",
      message: "Unbalanced ``` code fence — the rest of the README would render as code.",
      blockId: culprit?.id,
      fix: "Give the Code block a matching fence, or use more backticks than the content contains.",
    });
  }
  if (fences.tilde % 2 !== 0) {
    push({
      level: "warning",
      rule: "unbalanced-tilde-fence",
      message: "Unbalanced ~~~ code fence detected.",
    });
  }

  // 2. Inline backticks in passthrough text.
  for (const block of blocks) {
    if (block.type === "text" || block.type === "installation" || block.type === "usage") {
      const body = readBody(block);
      if (body && (body.match(/(?<!`)`(?!`)/g)?.length ?? 0) % 2 !== 0) {
        push({
          level: "warning",
          rule: "unbalanced-inline-code",
          message: `A Text/prose field has an odd number of single backticks.`,
          blockId: block.id,
          fix: "Close every `inline code` span.",
        });
      }
    }
  }

  // 3. Images must be publicly reachable relative to github.com.
  // Only the *image* keys are checked: a badge's `linkUrl` is a link, and
  // `mailto:` is a perfectly good one (a profile preset that linked its email
  // badge was being reported as an unresolvable image).
  const imageish = blocks.filter((b) => b.type === "image" || b.type === "hero" || b.type === "badges");
  for (const block of imageish) {
    for (const u of collectUrls(block, /^(url|imageurl|logourl|src)$/i)) {
      if (/^(mailto|tel):/i.test(u)) continue;
      if (!u) continue;
      if (!isProbablyImageUrl(u)) {
        push({
          level: "error",
          rule: "unresolvable-image",
          message: `Image URL "${u}" cannot be resolved by GitHub from the README's location.`,
          blockId: block.id,
          fix: "Use an absolute https:// URL (or a repo path starting with ./).",
        });
      }
    }
  }

  // 4. Raw HTML tags users paste must balance.
  const prose = proseLines(markdown).join("\n");
  for (const tag of ["details", "summary", "table", "p", "div", "a", "img"]) {
    const open = countMatches(prose, new RegExp(`<${tag}(\\s|>)`, "g"));
    const close = countMatches(prose, new RegExp(`</${tag}>`, "g"));
    if (tag === "img") {
      const selfClosed = countMatches(prose, /<img\b[^>]*\/>/g);
      const bare = countMatches(prose, /<img\b(?![^>]*\/>)[^>]*>/g);
      if (bare > selfClosed) {
        push({
          level: "info",
          rule: "img-not-self-closed",
          message: `${bare - selfClosed} <img> tag(s) are not self-closed.`,
          fix: "GitHub tolerates it, but `/>` keeps the HTML valid.",
        });
      }
      continue;
    }
    if (open !== close) {
      push({
        level: "error",
        rule: `unbalanced-tag-${tag}`,
        message: `<${tag}> × ${open} does not match </${tag}> × ${close}.`,
        fix: "Balance the tags (GitHub sanitizes stray closing tags, not stray opening ones).",
      });
    }
  }

  // 5. GFM tables need every row to have the same cell count.
  // Rows are grouped into *contiguous* runs, because a document can hold two
  // unrelated tables (a model card and a benchmark table, say): comparing one
  // table's width against the next table's width is not a finding, it is a bug.
  // Fenced lines are skipped for the same reason — a README that *documents*
  // pipe tables inside ``` fences is not a broken README.
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1 && new Set(run).size > 1) {
      push({
        level: "error",
        rule: "table-column-mismatch",
        message: `A table's rows disagree on column count (${run.join(" vs ")}).`,
        fix: "The Table block pads rows for you; a pasted table needs manual padding.",
      });
    }
    run = [];
  };
  for (const line of proseLines(markdown)) {
    if (!line.trim().startsWith("|")) {
      flush();
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/).length;
    run.push(cells);
  }
  flush();

  /* ---- Phase 2: the syntax the engine emits, checked where users paste it. ---- */

  // 6. A label or title with emphasis markers that never close.
  // An explicit key list, not an anchored pattern over a padded key: ` /x$/.test(` ${key} `)`
  // can never match (the trailing space defeats `$`), and a rule that silently
  // never fires is worse than no rule, because it reads like coverage.
  const LABEL_KEYS = new Set(["title", "text", "summary", "label", "alt"]);
  for (const block of blocks) {
    for (const [key, value] of Object.entries(block.props as Record<string, unknown>)) {
      if (typeof value !== "string" || !LABEL_KEYS.has(key)) continue;
      if ((value.match(/(?<!\\)\*\*/g)?.length ?? 0) % 2 !== 0) {
        push({
          level: "warning",
          rule: "unbalanced-strong",
          message: `“${key}” has an odd number of ** markers.`,
          blockId: block.id,
          fix: "Close it, or leave the asterisks out — titles are plain text.",
        });
      }
    }
  }

  // 7. sanitizeUrl drops unsafe URLs, which would silently remove a button.
  for (const block of blocks) {
    for (const url of collectUrls(block)) {
      if (!isUnsafeUrl(url)) continue;
      push({
        level: "error",
        rule: "url-dropped",
        message: `“${url.slice(0, 40)}” is not a URL GitHub can render — the link will be dropped.`,
        blockId: block.id,
        fix: "Use an https:// URL, a repo-relative path, or a mailto: address.",
      });
    }
    // An empty `url` on an item that also has a label means the row vanishes.
    // Hero buttons are the same shape and the same mistake, so they are checked
    // here too — the compiler drops them rather than emitting `href=""` (an
    // empty anchor *is* clickable on GitHub: verified, and it is a dead button).
    const linky = block.props as {
      items?: { url?: string; label?: string }[];
      buttons?: { url?: string; label?: string }[];
    };
    const items = [...(linky.items ?? []), ...(linky.buttons ?? [])];
    for (const item of items) {
      if (item.label && !(item.url ?? "").trim()) {
        push({
          level: "error",
          rule: "link-without-url",
          message: `“${item.label}” has no URL, so it is not exported at all.`,
          blockId: block.id,
          fix: "Give it a target, or remove it.",
        });
      }
    }
  }

  // 8. Alerts: GitHub only styles the five known types, anything else renders as
  // literal text inside a blockquote — loudly wrong and easy to typo.
  const ALERTS = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];
  for (const match of prose.matchAll(/^>\s*\[!([A-Za-z]+)\]/gm)) {
    const type = (match[1] ?? "").toUpperCase();
    if (!ALERTS.includes(type)) {
      push({
        level: "error",
        rule: "unknown-alert-type",
        message: `> [!${match[1]}] is not a GitHub alert type, so it renders as plain text.`,
        fix: `Use one of: ${ALERTS.join(", ")}.`,
      });
    }
  }

  // 9. Markdown pasted inside <details> needs a blank line or GitHub shows the
  // raw syntax. (Our Collapsible block inserts it; a hand-written Text body may not.)
  const pasted = blocks.filter((b) => b.type === "text");
  for (const block of pasted) {
    const body = String((block.props as Record<string, unknown>).body ?? "");
    if (/<\/summary>\s*\n(?!\s*\n)\s*[^<\s]/.test(body)) {
      push({
        level: "warning",
        rule: "details-swallow",
        message: "Markdown directly after </summary> will not be parsed by GitHub.",
        blockId: block.id,
        fix: "Add a blank line after </summary> — or use the Collapsible block, which does it for you.",
      });
    }
  }

  // 10. Heading anchors: GitHub dedupes by appending -1, so a duplicate is a
  // broken cross-reference, and a skipped level is a broken outline.
  const headings = proseLines(markdown)
    .map((line) => /^(#{1,6})\s+(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ level: (m[1] ?? "").length, text: (m[2] ?? "").trim() }));
  const anchors = new Map<string, number>();
  for (const h of headings) {
    const anchor = h.text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    anchors.set(anchor, (anchors.get(anchor) ?? 0) + 1);
  }
  const dupes = [...anchors.entries()].filter(([, n]) => n > 1).map(([a]) => a);
  if (dupes.length) {
    push({
      level: "warning",
      rule: "duplicate-anchor",
      message: `Duplicate section title${dupes.length > 1 ? "s" : ""}: ${dupes.slice(0, 3).join(", ")} — links to #${dupes[0]} land on the first one.`,
      fix: "GitHub appends -1 to the second anchor; rename one heading.",
    });
  }
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const now = headings[i];
    if (prev && now && now.level > prev.level + 1) {
      push({
        level: "info",
        rule: "heading-skip",
        message: `“${now.text.slice(0, 40)}” jumps from H${prev.level} to H${now.level}.`,
        fix: "GitHub's outline tolerates it, but screen readers announce the gap.",
      });
      break;
    }
  }

  // 11. Links whose target is empty break silently.
  for (const match of prose.matchAll(/\[([^\]]*)\]\(\s*\)/g)) {
    push({
      level: "error",
      rule: "empty-link-target",
      message: `“[${match[1] ?? ""}]()” points nowhere.`,
      fix: "Add a URL, or drop the brackets.",
    });
  }

  // 11. A row wider than the header cannot be rendered: GFM shows the first
  // `columns.length` cells and throws the rest away. The compiler truncates so
  // the table stays valid — correct for the output, silent data loss for the
  // author, which is exactly what this list is for.
  for (const block of blocks) {
    if (block.type !== "table") continue;
    const p = block.props as { columns?: unknown[]; rows?: unknown[][] };
    const width = Array.isArray(p.columns) ? p.columns.length : 0;
    if (width === 0) continue;
    const rows = Array.isArray(p.rows) ? p.rows : [];
    const overflow = rows.filter(
      (row) => Array.isArray(row) && row.slice(width).some((cell) => String(cell ?? "").trim() !== ""),
    );
    if (overflow.length) {
      push({
        level: "error",
        rule: "table-cells-dropped",
        message: `${overflow.length} row(s) have more cells than the ${width} column(s); the extra text would be lost.`,
        blockId: block.id,
        fix: "Add a column for them, or clear the extra cells.",
      });
    }
  }

  const kind = options.kind ?? "project";

  // 12. Helpful nudges, not errors.
  if (!blocks.some((b) => !b.hidden && (b.type === "hero" || b.type === "heading"))) {
    push({
      level: "info",
      rule: "no-title",
      message: "No Hero or Heading block — the README opens with body text.",
      fix: "Start most READMEs with a title block.",
    });
  }
  // The "no code samples" nudge is advice for a *project* README. A profile
  // page has nothing to install, and telling it so on every apply made the
  // preset gallery's four profile cards arrive pre-flagged.
  if (
    kind === "project" &&
    !/```/.test(markdown) &&
    !blocks.some((b) => b.type === "installation" || b.type === "usage")
  ) {
    push({ level: "info", rule: "no-examples", message: "No code samples or Usage/Installation blocks." });
  }

  /* ---- Phase 3: the document's `kind` changes the advice, never the output. ---- */

  const shown = blocks.filter((b) => !b.hidden);
  if (kind === "profile") {
    // A profile README is read by a person deciding whether to follow or hire;
    // "how to install this" means a project section was pasted in by mistake.
    const strays = shown.filter((b) => b.type === "installation" || b.type === "license");
    if (strays.length > 0) {
      push({
        level: "info",
        rule: "profile-project-sections",
        message: `${strays.length} section(s) — ${strays.map((b) => b.type).join(", ")} — read like a project README, not a profile.`,
        blockId: strays[0]?.id,
        fix: "Profile READMEs are about you: keep them if you mean it, delete them otherwise.",
      });
    }
    // The one thing a profile page must do is let someone reach you.
    const reaches = shown.some((b) => {
      const p = b.props as {
        items?: { linkUrl?: string; url?: string }[];
        buttons?: { url?: string; linkUrl?: string }[];
      };
      return [...(p.items ?? []), ...(p.buttons ?? [])].some(
        (i) => (i.url ?? "").trim() || (i.linkUrl ?? "").trim(),
      );
    });
    if (!reaches) {
      push({
        level: "info",
        rule: "profile-no-contact",
        message: "Nothing in this profile links out — no socials, no email, no site.",
        fix: "Add a Links block, or a Badges block with a link on each badge.",
      });
    }
  }

  return issues;
}

function countMatches(input: string, re: RegExp): number {
  return (input.match(re) ?? []).length;
}

/**
 * The Markdown with fenced code blocks removed — i.e. the lines GitHub actually
 * *parses*. Whole-document regexes over the raw text count a `# comment` inside
 * an ini sample as a heading and a `<details>` inside an HTML example as an
 * unbalanced tag; the Phase 3 presets, which ship commented config snippets,
 * tripped both. Every structural rule below runs on this.
 */
function proseLines(markdown: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opener) {
      const marker = (opener[1] ?? "")[0] ?? "";
      if (fence === null) fence = marker;
      else if (marker === fence) fence = null;
      continue;
    }
    if (fence === null) out.push(line);
  }
  return out;
}

function readBody(block: Block): string {
  const props = block.props as unknown as Record<string, unknown>;
  if (block.type === "text") return String(props.body ?? "");
  if (block.type === "installation") {
    return ((props.steps as { body: string }[]) ?? []).map((s) => s?.body ?? "").join("\n");
  }
  if (block.type === "usage") {
    return ((props.examples as { body: string }[]) ?? []).map((s) => s?.body ?? "").join("\n");
  }
  return "";
}

function collectUrls(block: Block, only?: RegExp): string[] {
  const found: string[] = [];
  const walk = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      if (only ? only.test(key) : /url|src|image/i.test(key)) found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, key);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(block.props);
  return found;
}

function countOddFence(block: Block): boolean {
  if (block.type !== "code") return false;
  const props = block.props as unknown as Record<string, unknown>;
  return /^ {0,3}`{3,}/m.test(String(props.body ?? ""));
}

export function summarizeIssues(issues: Issue[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length,
    infos: issues.filter((i) => i.level === "info").length,
  };
}
