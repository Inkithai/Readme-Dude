import { describe, expect, it } from "vitest";
import { compileDocument, parseDocumentJson, serializeDocument } from "@/engine";
import { getTemplate, TEMPLATES, type Template } from "@/engine/templates";
import { storage } from "@/lib/storage";
import { AUTOSAVE_KEY, flushAutosave, history, useDocument } from "../document";

/* ------------------------------------------------------------------ *
 * store/__tests__/templates.test.ts — applying a preset.
 *
 * The interesting part of Phase 3 is not the twelve presets, it is what the
 * store does with one: name, kind and blocks change together, append must not
 * touch either document field, and all of it stays undoable because history
 * tracks the document. That is also where `kind` earns its keep — it is stored,
 * exported, undone and re-imported like any other document property.
 * ------------------------------------------------------------------ */

const state = () => useDocument.getState();
const preset = (id: string): Template => {
  const found = getTemplate(id);
  if (!found) throw new Error(`preset "${id}" is missing`);
  return found;
};

describe("applyTemplate", () => {
  it("replace mode loads the preset and adopts its name and kind", () => {
    state().replaceBlocks([]);
    state().setName("scratch");
    const template = preset("full-profile");
    state().applyTemplate(template, "replace");
    expect(state().blocks).toHaveLength(template.blocks().length);
    expect(state().name).toBe("full-profile");
    expect(state().kind).toBe("profile");
    expect(state().selectedId).toBeNull();
    expect(state().expandedId).toBe(state().blocks[0]?.id);
  });

  it("append mode adds sections without rewriting the document", () => {
    state().replaceBlocks([]);
    state().setName("my-thing");
    state().setKind("project");
    const before = state().addBlock("heading");
    state().applyTemplate(preset("minimal-profile"), "append");
    expect(state().blocks[0]?.id).toBe(before);
    expect(state().blocks).toHaveLength(1 + preset("minimal-profile").blocks().length);
    expect(state().name).toBe("my-thing");
    expect(state().kind).toBe("project");
  });

  it("produces exactly what the preset compiles to on its own", () => {
    state().replaceBlocks([]);
    for (const id of ["professional-project", "developer-profile", "http-api"]) {
      const template = preset(id);
      state().applyTemplate(template, "replace");
      expect(compileDocument(state().blocks), id).toBe(compileDocument(template.blocks()));
    }
  });

  it("is undoable, and the undo takes the kind back with it", () => {
    state().replaceBlocks([]);
    state().setKind("project");
    const heading = state().addBlock("heading");
    state().applyTemplate(preset("full-profile"), "replace");
    expect(state().kind).toBe("profile");
    expect(state().blocks.length).toBeGreaterThan(1);

    history.undo();
    expect(state().blocks.map((b) => b.id)).toEqual([heading]);
    expect(state().kind).toBe("project");

    history.redo();
    expect(state().kind).toBe("profile");
    expect(state().blocks.length).toBeGreaterThan(1);
  });

  it("never reuses a block id, even when a preset is applied twice", () => {
    state().replaceBlocks([]);
    const template = preset("cli-tool");
    state().applyTemplate(template, "replace");
    state().applyTemplate(template, "append");
    const ids = state().blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(template.blocks().length * 2);
  });

  it("survives autosave and a reload with its kind intact", () => {
    state().replaceBlocks([]);
    state().applyTemplate(preset("portfolio-profile"), "replace");
    flushAutosave();
    const raw = storage.get(AUTOSAVE_KEY);
    expect(raw).toBeTruthy();
    const parsed = parseDocumentJson(raw as string);
    expect(parsed.document.kind).toBe("profile");
    expect(parsed.document.name).toBe("portfolio-profile");
    expect(parsed.dropped).toBe(0);
    expect(parsed.document.blocks).toHaveLength(state().blocks.length);
  });

  it("round-trips every preset through export and import without a dropped block", () => {
    state().replaceBlocks([]);
    for (const template of TEMPLATES) {
      state().applyTemplate(template, "replace");
      const json = serializeDocument(state().name, state().blocks, state().kind);
      const result = state().importJson(json);
      expect(result.ok, template.id).toBe(true);
      expect(result.dropped, template.id).toBe(0);
      expect(state().kind, template.id).toBe(template.kind);
      expect(compileDocument(state().blocks), template.id).toBe(compileDocument(template.blocks()));
    }
  });

  it("treats a pasted template as an ordinary edit, not a mode switch", () => {
    // `rail` is UI state: switching it must not create an undo step, or
    // browsing presets would pollute the document's history.
    state().replaceBlocks([]);
    history.clear();
    state().setRail("templates");
    expect(state().rail).toBe("templates");
    expect(useDocument.temporal.getState().pastStates).toHaveLength(0);
    state().setRail("blocks");
    expect(useDocument.temporal.getState().pastStates).toHaveLength(0);
  });
});
