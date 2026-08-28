import { describe, expect, it } from "vitest";
import { createBlock, parseDocument, parseDocumentJson, reidentify, serializeDocument } from "../index";

describe("document (de)serialization", () => {
  it("round-trips a document through JSON", () => {
    const blocks = [createBlock("hero"), createBlock("license")];
    const parsed = parseDocumentJson(serializeDocument("my project", blocks));
    expect(parsed.document.name).toBe("my project");
    expect(parsed.document.blocks).toHaveLength(2);
    expect(parsed.dropped).toBe(0);
    expect(parsed.document.blocks[0]?.props).toEqual(blocks[0]?.props);
  });

  it("drops unknown or malformed blocks instead of failing the whole load", () => {
    const raw = {
      version: 1,
      name: "mixed",
      blocks: [
        createBlock("heading"),
        { id: "x", type: "widget", props: {} },
        { type: "hero" },
        "not a block",
      ],
    };
    const parsed = parseDocument(raw);
    expect(parsed.document.blocks).toHaveLength(1);
    expect(parsed.dropped).toBe(3);
    expect(parsed.errors).toHaveLength(3);
  });

  it("applies schema defaults to partial blocks from an older file", () => {
    const parsed = parseDocument({ version: 1, blocks: [{ id: "a", type: "code", props: { body: "x" } }] });
    expect(parsed.document.blocks[0]?.hidden).toBe(false);
    const props = parsed.document.blocks[0]?.props as Record<string, unknown>;
    expect(props.language).toBe("typescript");
  });

  it("survives invalid JSON", () => {
    const parsed = parseDocumentJson("{nope");
    expect(parsed.document.blocks).toEqual([]);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });

  it("re-ids duplicates so React keys and dnd never collide", () => {
    const original = createBlock("text");
    const deduped = reidentify([original, structuredClone(original), { ...original, id: "fresh" }]);
    const ids = deduped.map((b) => b.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBe(original.id); // the first occurrence keeps its id
    expect(ids[1]).not.toBe(original.id); // a collision gets a new one
  });
});
