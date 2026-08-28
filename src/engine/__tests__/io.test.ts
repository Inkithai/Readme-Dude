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

describe("what counts as a document", () => {
  it("rejects JSON that is merely an object", () => {
    // package.json, tsconfig.json, a stray API response: all objects, none of
    // them documents. Accepting them meant importJson() reported success after
    // replacing the user's work with an empty document.
    const result = parseDocument({ name: "my-pkg", version: "2.0.0", dependencies: { react: "*" } });
    expect(result.document.blocks).toEqual([]);
    expect(result.errors.join(" ")).toMatch(/no "blocks" array/);
  });

  it("accepts a real but empty document", () => {
    const result = parseDocument({ version: 1, name: "blank", blocks: [] });
    expect(result.errors).toEqual([]);
    expect(result.dropped).toBe(0);
  });

  it("counts every rejected block when nothing survived", () => {
    const result = parseDocument({ version: 1, name: "future", blocks: [{ type: "hero-v3" }, { type: 42 }] });
    expect(result.dropped).toBe(2);
    expect(result.errors.join(" ")).toMatch(/did not match the schema/);
    expect(result.errors.join(" ")).toMatch(/rejected by the current schema/);
  });

  it("does not lose the blocks that did parse", () => {
    const good = JSON.parse(serializeDocument("keep", [createBlock("heading")]));
    const result = parseDocument({ version: 1, name: "mixed", blocks: [...good.blocks, { type: "nope" }] });
    expect(result.document.blocks).toHaveLength(1);
    expect(result.dropped).toBe(1);
  });
});
