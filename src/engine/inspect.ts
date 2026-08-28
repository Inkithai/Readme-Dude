import type { Block, BlockType } from "./schema";

/* ------------------------------------------------------------------ *
 * engine/inspect.ts — human-readable facts about a block, used by the
 * canvas (collapsed card labels) and the block-count badge.
 * ------------------------------------------------------------------ */

const asRecord = (block: Block): Record<string, unknown> => block.props as unknown as Record<string, unknown>;

const clip = (value: string, max = 68): string => {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
};

const count = (value: unknown): string => (Array.isArray(value) ? `${value.length}` : "0");

/** A single line that identifies the block's content at a glance. */
export function summarizeBlock(block: Block): string {
  const p = asRecord(block);
  switch (block.type) {
    case "hero":
      return clip(String(p.title ?? ""));
    case "heading": {
      const emoji = String(p.emoji ?? "");
      return clip(`${emoji ? `${emoji} ` : ""}${String(p.text ?? "")}`);
    }
    case "text":
      return clip(String(p.body ?? ""));
    case "features":
      return `${count(p.items)} items · ${String(p.layout ?? "")}`;
    case "image":
      return clip(String(p.alt ?? p.url ?? ""));
    case "code":
      return `${String(p.language ?? "text")} · ${String(p.body ?? "").split("\n").length} lines`;
    case "table":
      return `${(p.rows as unknown[])?.length ?? 0} rows × ${(p.columns as unknown[])?.length ?? 0} cols`;
    case "badges":
      return `${count(p.items)} badge${count(p.items) === "1" ? "" : "s"}`;
    case "techstack": {
      const groups = (p.groups as { items: unknown[] }[] | undefined) ?? [];
      const total = groups.reduce((n, g) => n + (g.items?.length ?? 0), 0);
      return `${total} technologies · ${groups.length} group${groups.length === 1 ? "" : "s"}`;
    }
    case "installation":
      return `${count(p.steps)} step${count(p.steps) === "1" ? "" : "s"}`;
    case "usage":
      return `${count(p.examples)} example${count(p.examples) === "1" ? "" : "s"}`;
    case "license":
      return clip(String(p.notice ?? "").replace(/```/g, ""));
    case "collapsible":
      return `${p.open ? "open" : "collapsed"} · ${clip(String(p.summary ?? ""), 40)}`;
    case "checklist": {
      const items = (p.items as { done?: boolean }[] | undefined) ?? [];
      const done = items.filter((i) => i.done).length;
      return `${done}/${items.length} checked · ${String(p.style ?? "")}`;
    }
    case "links":
      return `${count(p.items)} link${count(p.items) === "1" ? "" : "s"} · ${String(p.style ?? "")}`;
    default:
      return "";
  }
}

/** Used for the document stats row. */
export function documentStats(blocks: Block[]): {
  visible: number;
  hidden: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let hidden = 0;
  for (const b of blocks) {
    byType[b.type] = (byType[b.type] ?? 0) + 1;
    if (b.hidden) hidden++;
  }
  return { visible: blocks.length - hidden, hidden, byType };
}

export const TYPE_LABEL: Record<BlockType, string> = {
  hero: "Hero",
  heading: "Heading",
  text: "Text",
  features: "Features",
  image: "Screenshot",
  code: "Code",
  table: "Table",
  badges: "Badges",
  techstack: "Tech stack",
  installation: "Installation",
  usage: "Usage",
  license: "License",
  collapsible: "Collapsible",
  checklist: "Checklist",
  links: "Links",
};
