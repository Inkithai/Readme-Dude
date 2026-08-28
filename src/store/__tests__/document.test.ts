import { beforeEach, describe, expect, it } from "vitest";
import { type Block, createBlock } from "@/engine";
import { history, useDocument } from "../document";

const state = () => useDocument.getState();
/** One safe accessor for `(state().blocks[i]?.props as …).key` chains. */
const prop = (index: number, key: string): unknown =>
  (state().blocks[index]?.props as Record<string, unknown> | undefined)?.[key];

describe("document store", () => {
  beforeEach(() => {
    state().replaceBlocks([]);
    history.clear();
  });

  it("appends a block and selects it for editing", () => {
    const id = state().addBlock("hero");
    expect(state().blocks).toHaveLength(1);
    expect(state().selectedId).toBe(id);
    expect(state().expandedId).toBe(id);
  });

  it("inserts at an index", () => {
    state().addBlock("heading");
    state().addBlock("license");
    state().addBlock("code", 1);
    expect(state().blocks.map((b) => b.type)).toEqual(["heading", "code", "license"]);
  });

  it("clones a block with a fresh id right after the source", () => {
    const id = state().addBlock("features");
    const copyId = state().duplicateBlock(id);
    expect(copyId).toBeTruthy();
    expect(state().blocks.map((b) => b.id)).toEqual([id, copyId]);
    expect(state().blocks[1]?.props).toEqual(state().blocks[0]?.props);
    expect(state().blocks[1]?.props).not.toBe(state().blocks[0]?.props);
  });

  it("hides without deleting, and un-hiding restores position", () => {
    const id = state().addBlock("text");
    state().toggleHidden(id);
    expect(state().blocks).toHaveLength(1);
    expect(state().blocks[0]?.hidden).toBe(true);
    state().toggleHidden(id);
    expect(state().blocks[0]?.hidden).toBe(false);
  });

  it("patches props immutably at the top level", () => {
    const id = state().addBlock("heading");
    const before = state().blocks[0];
    state().patchProps(id, { text: "Renamed" });
    expect(state().blocks[0]?.props).not.toBe(before?.props);
    expect(prop(0, "text")).toBe("Renamed");
  });

  it("reorders by index and by drop target", () => {
    const ids = [state().addBlock("text"), state().addBlock("code"), state().addBlock("table")];
    state().moveByIndex(0, 2);
    expect(state().blocks.map((b) => b.id)).toEqual([ids[1], ids[2], ids[0]]);
    state().reorderById(ids[1] as string, ids[2] as string);
    expect(state().blocks.map((b) => b.id)).toEqual([ids[2], ids[1], ids[0]]);
  });

  it("ignores out-of-range moves", () => {
    const id = state().addBlock("text");
    state().moveByIndex(0, 9);
    expect(state().blocks.map((b) => b.id)).toEqual([id]);
  });

  it("palette drop onto a gap inserts at that gap index", () => {
    state().addBlock("heading");
    state().addBlock("license");
    state().handleDrop({ type: "code" }, "gap:1");
    expect(state().blocks.map((b) => b.type)).toEqual(["heading", "code", "license"]);
  });

  it("block drop onto a gap moves it, accounting for the removed slot", () => {
    const [a, b, c] = [state().addBlock("heading"), state().addBlock("code"), state().addBlock("table")];
    state().handleDrop(state().blocks[0] as Block, "gap:3");
    expect(state().blocks.map((x) => x.id)).toEqual([b, c, a]);
  });

  it("undo/redo covers document edits but not selection", () => {
    const id = state().addBlock("hero");
    state().patchProps(id, { title: "First" });
    state().select(null); // must not create an undo step
    history.undo();
    expect(prop(0, "title")).toBe("Project Name");
    history.redo();
    expect(prop(0, "title")).toBe("First");
  });

  it("undo restores structure (add/remove/hide)", () => {
    state().addBlock("text");
    const two = state().addBlock("code");
    state().removeBlock(two as string);
    expect(state().blocks).toHaveLength(1);
    history.undo();
    expect(state().blocks).toHaveLength(2);
    state().toggleHidden(two as string);
    expect(state().blocks[1]?.hidden).toBe(true);
    history.undo();
    expect(state().blocks[1]?.hidden).toBe(false);
  });

  it("drops blocks that fail validation on import and keeps the rest", () => {
    const result = state().importJson(
      JSON.stringify({ version: 1, name: "x", blocks: [createBlock("table"), { type: "bogus" }] }),
    );
    expect(result.ok).toBe(true);
    expect(result.dropped).toBe(1);
    expect(state().blocks).toHaveLength(1);
    expect(state().name).toBe("x");
  });

  it("reports failed imports instead of silently wiping the document", () => {
    const before = state().addBlock("hero");
    const result = state().importJson("{ broken json");
    expect(result.ok).toBe(false);
    expect(state().blocks.map((b) => b.id)).toEqual([before]);
  });
});
