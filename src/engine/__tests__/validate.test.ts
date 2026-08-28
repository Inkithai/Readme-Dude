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

describe("silent data loss becomes a message", () => {
  const rulesFor = (type: BlockType, props: Record<string, unknown>): string[] => {
    const b = block(type, props);
    return validateDocument([b], compileDocument([b])).map((i) => i.rule);
  };

  it("flags table rows wider than the header", () => {
    // The compiler truncates to the header width to keep the table valid, which
    // is right for the output and silent for the author.
    const rules = rulesFor("table", { columns: ["A"], rows: [["keep"], ["keep", " and this"]] });
    expect(rules).toContain("table-cells-dropped");
    const truncated = compileDocument([block("table", { columns: ["A"], rows: [["keep"], ["keep", "x"]] })]);
    expect(truncated).toContain("| A |");
    expect(truncated).not.toContain("x"); // dropped from the output, but reported
  });

  it("does not flag a short row (an empty cell is normal)", () => {
    expect(rulesFor("table", { columns: ["A", "B", "C"], rows: [["only one"]] })).not.toContain(
      "table-cells-dropped",
    );
  });

  it("does not read a fenced code sample as document structure", () => {
    // The Phase 3 presets ship commented config snippets, and an old
    // whole-document regex treated every `#` line as a heading: two code blocks
    // with `# section` comments reported duplicate anchors and heading skips.
    const code = (body: string): Block => block("code", { language: "ini", body });
    const blocks = [code("# Section\nA=1"), code("# Section\nB=2"), block("heading", { text: "Real title" })];
    const found = validateDocument(blocks, compileDocument(blocks)).map((i) => i.rule);
    expect(found).not.toContain("duplicate-anchor");
    expect(found).not.toContain("heading-skip");
  });

  it("does not compare the width of two unrelated tables", () => {
    // A model card (2 columns) and a benchmark table (5 columns) in one README
    // is normal; only rows *inside one table* may disagree.
    const blocks = [
      block("table", { title: "Card", columns: ["Field", "Value"], rows: [["a", "b"]] }),
      block("table", {
        title: "Benchmarks",
        columns: ["Model", "F1", "Latency", "VRAM", "Notes"],
        rows: [["x", "1", "2", "3", "4"]],
      }),
    ];
    expect(rules(blocks)).not.toContain("table-column-mismatch");
  });

  it("still catches a real ragged table pasted into a Text block", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 | 3 |";
    expect(rules([block("text", { body: md })])).toContain("table-column-mismatch");
  });

  it("leaves a mailto: badge link alone — it is a link, not an image", () => {
    const b = block("badges", {
      items: [
        { alt: "email", imageUrl: "https://img.shields.io/badge/mail-me-888", linkUrl: "mailto:hi@x.dev" },
      ],
    });
    expect(rules([b])).toEqual([]);
  });

  it("flags a hero button with a label but no URL", () => {
    // The links/checklist panels had this rule; hero buttons are the same
    // shape and the mistake is just as invisible there.
    expect(rulesFor("hero", { buttons: [{ label: "Docs", url: "" }] })).toContain("link-without-url");
    expect(rulesFor("hero", { buttons: [{ label: "Docs", url: "https://a.dev" }] })).not.toContain(
      "link-without-url",
    );
  });
});

describe("kind-aware checks (Phase 3)", () => {
  const withKind = (blocks: Block[], kind: "project" | "profile"): string[] =>
    validateDocument(blocks, compileDocument(blocks), { kind }).map((i) => i.rule);

  it("tells a profile README that it carries project-only sections", () => {
    const blocks = [block("hero", { title: "Me" }), block("installation"), block("license")];
    expect(withKind(blocks, "profile")).toContain("profile-project-sections");
    expect(withKind(blocks, "project")).not.toContain("profile-project-sections");
  });

  it("asks a profile with no way to reach anybody to add one", () => {
    const lonely = [block("hero", { title: "Me" }), block("text", { body: "I like Go." })];
    expect(withKind(lonely, "profile")).toContain("profile-no-contact");
    const linked = [...lonely, block("links", { items: [{ label: "site", url: "https://me.dev" }] })];
    expect(withKind(linked, "profile")).not.toContain("profile-no-contact");
    // A badge that links out counts: that is how most profile READMEs do it.
    const badge = [
      block("hero", { title: "Me" }),
      block("badges", {
        items: [
          { alt: "gh", imageUrl: "https://img.shields.io/badge/a-b-888", linkUrl: "https://github.com/me" },
        ],
      }),
    ];
    expect(withKind(badge, "profile")).not.toContain("profile-no-contact");
  });

  it("only nags about missing code samples on project documents", () => {
    const prose = [block("hero", { title: "Me" }), block("text", { body: "hello" })];
    expect(withKind(prose, "project")).toContain("no-examples");
    expect(withKind(prose, "profile")).not.toContain("no-examples");
  });

  it("defaults to project when no kind is passed", () => {
    // Documents saved before Phase 3 have no `kind`, and must not change checks.
    const blocks = [block("hero", { title: "Me" }), block("installation")];
    expect(validateDocument(blocks, compileDocument(blocks)).map((i) => i.rule)).not.toContain(
      "profile-project-sections",
    );
  });

  it("is the only thing `kind` is allowed to change", () => {
    // Same blocks, different kind → the *report* differs and the output cannot.
    // If a future change makes `kind` reach the compiler, this is the test that
    // says so, and the answer should be "use a block field instead".
    const blocks = [block("hero", { title: "Me" }), block("installation"), block("license")];
    const markdown = compileDocument(blocks);
    expect(validateDocument(blocks, markdown, { kind: "profile" })).not.toEqual(
      validateDocument(blocks, markdown, { kind: "project" }),
    );
    expect(markdown).toBe(compileDocument(blocks));
  });
});
