import { type Block, BlockSchema, DocumentSchema, newBlockId, type StudioDocument } from "./schema";

/* ------------------------------------------------------------------ *
 * engine/io.ts — the .json project format (save / restore / import).
 *
 * Loading is *permissive by block*: one stale or hand-edited block must not
 * throw away the whole document. Dropped blocks are reported so the UI can
 * say so instead of silently forgetting the user's work.
 * ------------------------------------------------------------------ */

export interface ParseResult {
  document: StudioDocument;
  dropped: number;
  errors: string[];
}

export function serializeDocument(name: string, blocks: Block[]): string {
  return JSON.stringify({ version: 1, name, blocks } satisfies StudioDocument, null, 2);
}

export function parseDocument(raw: unknown): ParseResult {
  const errors: string[] = [];
  const fallback = { version: 1 as const, name: "untitled", blocks: [] as Block[] };
  if (!raw || typeof raw !== "object") {
    return { document: fallback, dropped: 0, errors: ["not a document object"] };
  }
  const source = raw as Record<string, unknown>;
  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : [];
  const blocks: Block[] = [];
  let dropped = 0;
  rawBlocks.forEach((candidate, i) => {
    const result = BlockSchema.safeParse(candidate);
    if (result.success) blocks.push(result.data);
    else {
      dropped++;
      const type =
        typeof candidate === "object" && candidate
          ? String((candidate as Record<string, unknown>).type)
          : "?";
      errors.push(`block #${i} ("${type}") did not match the schema`);
    }
  });
  const nameResult = DocumentSchema.safeParse({ version: 1, name: source.name ?? "untitled", blocks });
  if (!nameResult.success) {
    return { document: { ...fallback, blocks }, dropped, errors: [...errors, "document name coerced"] };
  }
  return { document: nameResult.data, dropped, errors };
}

export function parseDocumentJson(text: string): ParseResult {
  try {
    return parseDocument(JSON.parse(text));
  } catch (error) {
    return {
      document: { version: 1, name: "untitled", blocks: [] },
      dropped: 0,
      errors: [error instanceof Error ? error.message : "invalid JSON"],
    };
  }
}

/** Ensure every block has a unique id (matters after paste/merge/JSON import). */
export function reidentify(blocks: Block[]): Block[] {
  const seen = new Set<string>();
  return blocks.map((block) => {
    if (!seen.has(block.id)) {
      seen.add(block.id);
      return block;
    }
    const fresh = { ...block, id: newBlockId() };
    seen.add(fresh.id);
    return fresh;
  });
}
