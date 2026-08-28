import { describe, expect, it } from "vitest";
import {
  BLOCK_ORDER,
  BLOCKS,
  type Block,
  type BlockType,
  compileBlock,
  createBlock,
  longestRun,
  validateDocument,
} from "@/engine";

/* ------------------------------------------------------------------ *
 * The compiler's degradation contract.
 *
 * `createBlock` and JSON import both run through Zod, so every field is
 * present in an app-authored document. The paths that do *not* re-validate are
 * `patchProps` (raw on purpose: typing must not be gated on the schema),
 * `insertBlock`/`replaceBlocks` (templates, and the Phase 5 Markdown importer,
 * both of which assemble props field by field) and a hand-edited .json where a
 * key was deleted. A throw there is not a caught exception — it becomes an
 * HTML comment in place of the user's section, which is the worst possible
 * failure for a compiler whose whole job is the output.
 *
 * So: every block type is compiled with empty props and with junk-shaped items,
 * and must produce plausible Markdown instead of the guard comment.
 * ------------------------------------------------------------------ */

const compile = (type: BlockType, props: Record<string, unknown>): string => {
  const block = { ...createBlock(type), props } as unknown as Block;
  return compileBlock(block);
};

const CANNOT_COMPILE = "could not compile";

/** Shapes that are half a block each: arrays present but empty of fields. */
const JUNK_SHAPES: Partial<Record<BlockType, Record<string, unknown>>> = {
  features: { items: [{}, { title: null }, { icon: 3, body: {} }] },
  badges: { items: [{}, { alt: 1 }, { imageUrl: "javascript:alert(1)" }] },
  techstack: { groups: [{}, { items: [{}] }, { items: [{ name: null }] }] },
  table: { columns: ["a", "b"], rows: [[{}], ["x"], [], ["long", "er", "still", "more"]] },
  installation: { steps: [{}, {}] },
  usage: { examples: [{}, { title: {} }] },
  hero: { buttons: [{}], logoUrl: 5 },
  links: { items: [{}, { url: 5 }, { label: "Docs" }] },
  checklist: { items: [{}], showProgress: true },
  code: { language: {}, filename: {}, body: {} },
  collapsible: { body: {}, summary: 5 },
  text: { body: {}, alertType: undefined, variant: "alert" },
  image: { url: 5, alt: {}, caption: {} },
  heading: { text: undefined, level: "x", emoji: null },
  license: { notice: {}, url: 7 },
};

describe("compiler totality", () => {
  it("compiles every block type with an empty props object", () => {
    const broken = BLOCK_ORDER.filter((type) => compile(type, {}).includes(CANNOT_COMPILE));
    expect(broken).toEqual([]);
  });

  it("compiles every block type with junk-shaped items", () => {
    const broken = BLOCK_ORDER.filter((type) =>
      compile(type, JUNK_SHAPES[type] ?? {}).includes(CANNOT_COMPILE),
    );
    expect(broken).toEqual([]);
  });

  it("never leaks undefined, NaN or [object Object] into a README", () => {
    const leaks: string[] = [];
    for (const type of BLOCK_ORDER) {
      for (const props of [{}, JUNK_SHAPES[type] ?? {}]) {
        const out = compile(type, props);
        if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(out)) leaks.push(`${type}: ${out}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps a default for every block type it claims to support", () => {
    // BLOCK_ORDER and BLOCKS must agree, or a type is silently unaddable.
    expect([...BLOCK_ORDER].sort()).toEqual(Object.keys(BLOCKS).sort());
  });

  it("falls back to NOTE for an alert with no type instead of printing [!undefined]", () => {
    expect(compile("text", { variant: "alert", body: "Ship it" })).toBe("> [!NOTE]\n> Ship it");
  });

  it("drops a hero button whose URL was refused rather than emitting an empty link", () => {
    // Verified against GitHub: `<a href=""><img …></a>` renders a clickable
    // nothing around the badge. Not linking it is the honest fallback, and
    // validate.ts's url-dropped / link-without-url rules say why it moved.
    const out = compile("hero", { title: "T", buttons: [{ label: "Docs", url: "javascript:alert(1)" }] });
    expect(out).not.toContain('href=""');
    expect(out).not.toContain("Docs");
  });

  it("survives props that are not an object at all", () => {
    // `{ …, props: null }` is what a half-written merge or a `{}` slot in a
    // pasted array produces. Reading a key off `null` used to throw for every
    // one of the fifteen blocks — and because the Checks tab reads the same
    // props on every render, one such block took the whole preview pane down,
    // not just its own section.
    for (const type of BLOCK_ORDER) {
      for (const props of [null, undefined, 42, "text", [], true]) {
        const block = { id: "b", type, hidden: false, props } as unknown as Block;
        expect(compileBlock(block), `${type} with props=${JSON.stringify(props)}`).not.toContain(
          CANNOT_COMPILE,
        );
        expect(() => validateDocument([block], "## anything")).not.toThrow();
        expect(BLOCKS[type]).toBeTruthy();
      }
    }
  });

  it("picks a fence the body cannot close, whichever marker it chooses", () => {
    const bodies = [
      "````\n~~~\n````", // both markers, backticks win the tie
      "~~~~~~\n````\n~~~~~~", // more tildes than backticks -> tildes are cheaper
      `${"~".repeat(12)}${"`".repeat(12)}`,
      "no markers at all",
    ];
    for (const body of bodies) {
      const out = compile("code", { language: "markdown", body });
      const fence = /^([`~]+)/.exec(out)?.[1] ?? "";
      expect(fence.length, body).toBeGreaterThan(longestRun(body, fence[0] as "`" | "~"));
      expect(out.endsWith(`\n${fence}`), body).toBe(true);
    }
  });
});
