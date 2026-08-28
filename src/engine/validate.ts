import { isProbablyImageUrl } from "./escape";
import type { Block } from "./schema";

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

export function validateDocument(blocks: Block[], markdown: string): Issue[] {
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
  const imageish = blocks.filter((b) => b.type === "image" || b.type === "hero" || b.type === "badges");
  for (const block of imageish) {
    for (const u of collectUrls(block)) {
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
  for (const tag of ["details", "summary", "table", "p", "div", "a", "img"]) {
    const open = countMatches(markdown, new RegExp(`<${tag}(\\s|>)`, "g"));
    const close = countMatches(markdown, new RegExp(`</${tag}>`, "g"));
    if (tag === "img") {
      const selfClosed = countMatches(markdown, /<img\b[^>]*\/>/g);
      const bare = countMatches(markdown, /<img\b(?![^>]*\/>)[^>]*>/g);
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
  const tableLines = markdown
    .split("\n")
    .map((line, i) => ({ line, i }))
    .filter((x) => x.line.trim().startsWith("|"));
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
  for (const { line } of tableLines) {
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split(/(?<!\\)\|/).length;
    run.push(cells);
  }
  flush();

  // 6. Helpful nudges, not errors.
  if (!blocks.some((b) => !b.hidden && (b.type === "hero" || b.type === "heading"))) {
    push({
      level: "info",
      rule: "no-title",
      message: "No Hero or Heading block — the README opens with body text.",
      fix: "Start most READMEs with a title block.",
    });
  }
  if (!/```/.test(markdown) && !blocks.some((b) => b.type === "installation" || b.type === "usage")) {
    push({ level: "info", rule: "no-examples", message: "No code samples or Usage/Installation blocks." });
  }

  return issues;
}

function countMatches(input: string, re: RegExp): number {
  return (input.match(re) ?? []).length;
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

function collectUrls(block: Block): string[] {
  const found: string[] = [];
  const walk = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      if (/url|src|image/i.test(key)) found.push(value);
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
