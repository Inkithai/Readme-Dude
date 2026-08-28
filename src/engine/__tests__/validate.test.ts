import { describe, expect, it } from "vitest";
import { type Block, type BlockType, compileDocument, createBlock, validateDocument } from "../index";

const block = (type: BlockType, props: Record<string, unknown> = {}): Block => {
  const created = createBlock(type);
  return { ...created, props: { ...(created.props as Record<string, unknown>), ...props } } as Block;
};

/** Only blocking/suggestive issues — `info` nudges are advisory by design. */
const rules = (blocks: Block[]): string[] =>
  validateDocument(blocks, compileDocument(blocks))
    .filter((issue) => issue.level !== "info")
    .map((issue) => issue.rule);

describe("validateDocument", () => {
  it("flags an empty document as blocking", () => {
    const issues = validateDocument([], compileDocument([]));
    expect(issues[0]?.rule).toBe("empty-document");
    expect(issues[0]?.level).toBe("error");
  });

  it("accepts ordinary generated output", () => {
    expect(rules([block("hero"), block("features")])).toEqual([]);
  });

  it("catches an unbalanced fence smuggled through a Text block", () => {
    const out = rules([block("heading", { text: "T" }), block("text", { body: "```sh\nbroken" })]);
    expect(out).toContain("unbalanced-fence");
  });

  it("catches unbalanced inline backticks in prose", () => {
    expect(rules([block("text", { body: "use `code for this" })])).toContain("unbalanced-inline-code");
  });

  it("catches a stray closing details tag (GitHub drops it, users lose the block)", () => {
    expect(rules([block("text", { body: "</details>" })])).toContain("unbalanced-tag-details");
  });

  it("catches table rows with disagreeing column counts", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 |\n| 2 | 3 |";
    const issues = validateDocument([block("text", { body: md })], md);
    expect(issues.map((i) => i.rule)).toContain("table-column-mismatch");
  });

  it("flags relative image paths GitHub cannot resolve", () => {
    expect(rules([block("image", { url: "images/shot.png", align: "left" })])).toContain(
      "unresolvable-image",
    );
  });

  it("suggests a title when the document opens with prose", () => {
    const issues = validateDocument(
      [block("text", { body: "just words" })],
      compileDocument([block("text", { body: "just words" })]),
    );
    const nudge = issues.find((issue) => issue.rule === "no-title");
    expect(nudge?.level).toBe("info");
  });

  it("attaches the offending block id so the UI can jump to it", () => {
    const culprit = block("text", { body: "</details>" });
    const issues = validateDocument([culprit], compileDocument([culprit]));
    expect(issues.find((i) => i.rule === "unbalanced-tag-details")?.blockId).toBeUndefined();
    const imageCulprit = block("image", { url: "nope.png" });
    const found = validateDocument([imageCulprit], compileDocument([imageCulprit])).find(
      (i) => i.blockId === imageCulprit.id,
    );
    expect(found).toBeDefined();
  });
});
