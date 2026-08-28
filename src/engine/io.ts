import { type Block, BlockSchema, DocumentSchema, newBlockId, type ReadmeDocument } from "./schema";

/* ------------------------------------------------------------------ *
 * engine/io.ts — the .json project format (save / restore / import).
 *
 * Loading is *permissive by block*: one stale or hand-edited block must not
 * throw away the whole document. Dropped blocks are reported so the UI can
 * say so instead of silently forgetting the user's work.
 * ------------------------------------------------------------------ */

export interface ParseResult {
  document: ReadmeDocument;
  dropped: number;
  errors: string[];
}

export function serializeDocument(name: string, blocks: Block[]): string {
  return JSON.stringify({ version: 1, name, blocks } satisfies ReadmeDocument, null, 2);
}

export function parseDocument(raw: unknown): ParseResult {
  const errors: string[] = [];
  const fallback = { version: 1 as const, name: "untitled", blocks: [] as Block[] };
  if (!raw || typeof raw !== "object") {
    return { document: fallback, dropped: 0, errors: ["not a document object"] };
  }
  const source = raw as Record<string, unknown>;
  const rawBlocks = Array.isArray(source.blocks) ? source.blocks : null;
  if (rawBlocks === null) {
    // Distinct from "a document whose blocks array is empty": that is a real
    // (if empty) export and imports fine. An object with no `blocks` key at all
    // is some other file — package.json, a tsconfig, a pasted array of blocks —
    // and accepting it meant reporting success while replacing the user's
    // document with nothing.
    return {
      document: fallback,
      dropped: 0,
      errors: ['no "blocks" array — this JSON is not a ReadMe Buddy document'],
    };
  }
  const blocksIn = rawBlocks;
  const blocks: Block[] = [];
  let dropped = 0;
  blocksIn.forEach((candidate, i) => {
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
  if (blocks.length === 0 && blocksIn.length > 0) {
    errors.push(
      `${blocksIn.length} block(s) were rejected by the current schema — the file may come from a newer version`,
    );
  }
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
