import { describe, expect, it } from "vitest";
import {
  BLOCK_ORDER,
  type Block,
  type BlockType,
  compileBlock,
  compileDocument,
  createBlock,
  escapeInlineMarkdown,
  isUnsafeUrl,
  sanitizeUrl,
  validateDocument,
} from "../index";

/* ------------------------------------------------------------------ *
 * Phase 2 — the Markdown engine: `<details>`, task lists, links, and
 * the escaping/URL rules that decide whether the export is correct.
 * ------------------------------------------------------------------ */

function block<T extends BlockType>(type: T, props: Record<string, unknown> = {}): Block {
  const created = createBlock(type);
  return { ...created, props: { ...(created.props as Record<string, unknown>), ...props } } as Block;
}

const compile = (type: BlockType, props: Record<string, unknown> = {}): string =>
  compileBlock(block(type, props));

describe("escapeInlineMarkdown (label fields are plain text)", () => {
  it("neutralises emphasis", () => {
    expect(escapeInlineMarkdown("a *b* c")).toBe("a \\*b\\* c");
    expect(escapeInlineMarkdown("**x**")).toBe("\\*\\*x\\*\\*");
  });

  it("leaves intra-word underscores alone, because GFM already does", () => {
    expect(escapeInlineMarkdown("my_project_name")).toBe("my_project_name");
  });

  it("escapes a tag-like < and backticks", () => {
    expect(escapeInlineMarkdown("<script>hi</script>")).toBe("\\<script>hi\\</script>");
    expect(escapeInlineMarkdown("use `npm i`")).toBe("use \\`npm i\\`");
  });

  it("keeps literal less-than that cannot open a tag", () => {
    expect(escapeInlineMarkdown("a < b and c <9")).toBe("a < b and c <9");
  });

  it("escapes strike runs and paired dollar signs only", () => {
    expect(escapeInlineMarkdown("~~gone~~")).toBe("\\~\\~gone\\~\\~");
    expect(escapeInlineMarkdown("still ~ ok")).toBe("still ~ ok");
    expect(escapeInlineMarkdown("$PATH and $HOME")).toBe("\\$PATH and \\$HOME");
    expect(escapeInlineMarkdown("costs $5 today")).toBe("costs $5 today");
  });

  it("is safe to feed text that already carries backslashes", () => {
    expect(escapeInlineMarkdown("C:\\Users\\me")).toBe("C:\\\\Users\\\\me");
  });

  it("escapes the heading and the section title, never a body", () => {
    expect(compile("heading", { level: 2, text: "Notes on *stars*", emoji: "" })).toBe(
      "## Notes on \\*stars\\*",
    );
    expect(compile("text", { variant: "paragraph", body: "*emphasis* works here" })).toBe(
      "*emphasis* works here",
    );
  });
});

describe("sanitizeUrl", () => {
  it("keeps the schemes a README can actually use", () => {
    expect(sanitizeUrl("https://x.dev/a")).toBe("https://x.dev/a");
    expect(sanitizeUrl("http://x.dev")).toBe("http://x.dev");
    expect(sanitizeUrl("mailto:hi@x.dev")).toBe("mailto:hi@x.dev");
    expect(sanitizeUrl("./docs/a.md")).toBe("./docs/a.md");
    expect(sanitizeUrl("#section")).toBe("#section");
  });

  it("drops executable and unreachable schemes", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBe("");
    expect(sanitizeUrl("vbscript:msgbox")).toBe("");
    expect(sanitizeUrl("file:///etc/passwd")).toBe("");
    expect(sanitizeUrl("data:image/png;base64,AAAA")).toBe("");
  });

  it("cannot be fooled by a control character inside the scheme", () => {
    expect(sanitizeUrl("java\u0000script:alert(1)")).toBe("");
    expect(sanitizeUrl("java\tscript:alert(1)")).toBe("");
  });

  it("encodes spaces and quotes instead of eating them", () => {
    expect(sanitizeUrl("https://x.dev/a b")).toBe("https://x.dev/a%20b");
    expect(sanitizeUrl('https://x.dev/a"b')).toBe("https://x.dev/a%22b");
  });

  it("reports drops so validation can explain them", () => {
    expect(isUnsafeUrl("javascript:x")).toBe(true);
    expect(isUnsafeUrl("https://ok.dev")).toBe(false);
    expect(isUnsafeUrl("")).toBe(false);
  });
});

describe("collapsible (<details>)", () => {
  it("wraps the body in blank lines so GitHub parses it", () => {
    expect(compile("collapsible", { summary: "Why", icon: "", body: "- one\n- two" })).toBe(
      "<details>\n<summary>Why</summary>\n\n- one\n- two\n\n</details>",
    );
  });

  it("omits the body entirely when there is none", () => {
    expect(compile("collapsible", { summary: "Why", icon: "", body: "" })).toBe(
      "<details>\n<summary>Why</summary>\n</details>",
    );
  });

  it("supports open, an icon prefix, and HTML-escapes the summary", () => {
    expect(compile("collapsible", { summary: "A & B", icon: "📦", open: true, body: "" })).toBe(
      "<details open>\n<summary>📦 A &amp; B</summary>\n</details>",
    );
  });
});

describe("checklist (task lists)", () => {
  it("emits GFM task markers", () => {
    expect(
      compile("checklist", {
        showTitle: false,
        style: "task",
        items: [
          { text: "Install", done: true, note: "" },
          { text: "Configure", done: false, note: "" },
        ],
      }),
    ).toBe("- [x] Install\n- [ ] Configure");
  });

  it("keeps Markdown inside items and appends the note inline", () => {
    expect(
      compile("checklist", {
        showTitle: false,
        items: [{ text: "Run `npm test`", done: false, note: "needs node 22" }],
      }),
    ).toBe("- [ ] Run `npm test` — needs node 22");
  });

  it("falls back to literal markers for other Markdown hosts", () => {
    const square = compile("checklist", {
      showTitle: false,
      style: "square",
      items: [{ text: "a", done: true }],
    });
    const circle = compile("checklist", {
      showTitle: false,
      style: "circle",
      items: [{ text: "a", done: true }],
    });
    expect(square).toBe("- [■] a");
    expect(circle).toBe("- (●) a");
    expect(square).not.toContain("[x]");
  });

  it("adds a progress line when asked", () => {
    expect(
      compile("checklist", {
        showTitle: false,
        showProgress: true,
        items: [
          { text: "a", done: true },
          { text: "b", done: false },
        ],
      }),
    ).toBe("- [x] a\n- [ ] b\n\n🕐 1 of 2 complete");
  });

  it("celebrates a finished list", () => {
    expect(
      compile("checklist", { showTitle: false, showProgress: true, items: [{ text: "a", done: true }] }),
    ).toBe("- [x] a\n\n✅ 1 of 1 complete");
  });

  it("renders nothing but the title when empty", () => {
    expect(compile("checklist", { title: "Todo", showTitle: true, items: [] })).toBe("## Todo");
  });
});

describe("links", () => {
  it("builds pills as single-text shields badges inside links", () => {
    const out = compile("links", {
      title: "",
      style: "pills",
      align: "left",
      items: [{ label: "Docs", url: "https://x.dev/docs" }],
    });
    expect(out).toBe(
      '<a href="https://x.dev/docs"><img src="https://img.shields.io/badge/Docs-555?style=flat" alt="Docs" /></a>',
    );
  });

  it("builds big buttons with the arrow message", () => {
    const out = compile("links", {
      title: "",
      style: "buttons",
      align: "center",
      color: "0a0a0a",
      items: [{ label: "Get started", url: "https://x.dev" }],
    });
    expect(out).toContain('<p align="center">');
    expect(out).toContain("badge/Get_started-%E2%86%92-0a0a0a?style=for-the-badge");
    expect(out).toContain('<a href="https://x.dev">');
  });

  it("writes plain Markdown for list and inline", () => {
    const list = compile("links", {
      title: "",
      style: "list",
      items: [
        { label: "Docs", url: "https://x.dev/docs", icon: "📖", description: "the manual" },
        { label: "Chat", url: "mailto:hi@x.dev", icon: "", description: "" },
      ],
    });
    expect(list).toBe("- 📖 [Docs](https://x.dev/docs) — the manual\n- [Chat](mailto:hi@x.dev)");
    expect(
      compile("links", { title: "", style: "inline", items: [{ label: "A", url: "https://a.dev" }] }),
    ).toBe("[A](https://a.dev)");
  });

  it("drops an item whose URL GitHub would reject", () => {
    const out = compile("links", {
      title: "",
      style: "list",
      items: [
        { label: "Bad", url: "javascript:alert(1)", icon: "", description: "" },
        { label: "Good", url: "https://x.dev", icon: "", description: "" },
      ],
    });
    expect(out).toBe("- [Good](https://x.dev)");
  });

  it("escapes emphasis in labels but not in bodies", () => {
    expect(
      compile("links", { title: "", style: "inline", items: [{ label: "a*b", url: "https://x.dev" }] }),
    ).toBe("[a\\*b](https://x.dev)");
  });
});

describe("validate: phase 2 rules", () => {
  const issuesFor = (type: BlockType, props: Record<string, unknown>) => {
    const b = block(type, props);
    return validateDocument(
      [b, block("heading", { text: "x" })],
      compileDocument([b, block("heading", { text: "x" })]),
    );
  };
  const rules = (type: BlockType, props: Record<string, unknown>) =>
    issuesFor(type, props).map((i) => i.rule);

  it("flags a URL that will be dropped", () => {
    expect(rules("image", { url: "javascript:alert(1)", alt: "x" })).toContain("url-dropped");
  });

  it("flags a link with no URL at all", () => {
    expect(rules("links", { title: "", style: "list", items: [{ label: "Docs", url: "" }] })).toContain(
      "link-without-url",
    );
  });

  it("flags an unknown alert type in pasted text", () => {
    expect(rules("text", { variant: "paragraph", body: "> [!HINT]\n> nope" })).toContain(
      "unknown-alert-type",
    );
    expect(rules("text", { variant: "paragraph", body: "> [!TIP]\n> fine" })).not.toContain(
      "unknown-alert-type",
    );
  });

  it("flags markdown pasted right after </summary>", () => {
    const bad = rules("text", {
      variant: "paragraph",
      body: "<details>\n<summary>S</summary>\n- one\n</details>",
    });
    expect(bad).toContain("details-swallow");
    const good = rules("collapsible", { summary: "S", body: "- one" });
    expect(good).not.toContain("details-swallow");
  });

  it("flags duplicate section titles that would collide as anchors", () => {
    const blocks = [
      block("heading", { text: "Install", level: 2 }),
      block("heading", { text: "Install", level: 2 }),
      block("heading", { text: "Usage", level: 2 }),
    ];
    const issues = validateDocument(blocks, compileDocument(blocks));
    expect(issues.map((i) => i.rule)).toContain("duplicate-anchor");
  });

  it("flags a heading that skips a level", () => {
    const blocks = [block("heading", { text: "A", level: 2 }), block("heading", { text: "B", level: 4 })];
    expect(validateDocument(blocks, compileDocument(blocks)).map((i) => i.rule)).toContain("heading-skip");
  });

  it("flags an empty link target in a body", () => {
    expect(rules("text", { variant: "paragraph", body: "see [the docs]()" })).toContain("empty-link-target");
  });

  it("flags unbalanced emphasis in a title field", () => {
    expect(rules("heading", { text: "a **b" })).toContain("unbalanced-strong");
    expect(rules("heading", { text: "a **b** c" })).not.toContain("unbalanced-strong");
  });

  it("does not complain about a well-formed document of new blocks", () => {
    const blocks = [
      block("heading", { text: "Guide", level: 2 }),
      block("collapsible", { summary: "Setup", body: "- one\n- two" }),
      block("checklist", { title: "", showTitle: false, items: [{ text: "Install", done: true }] }),
      block("links", { title: "", style: "list", items: [{ label: "Docs", url: "https://x.dev" }] }),
    ];
    const issues = validateDocument(blocks, compileDocument(blocks)).filter((i) => i.level === "error");
    expect(issues).toEqual([]);
  });
});

describe("engine coverage", () => {
  it("has a compiler for every registered block type", () => {
    for (const type of BLOCK_ORDER) {
      expect(compileBlock(createBlock(type)), `${type} compiled to nothing`).not.toBe("");
      expect(compileBlock(createBlock(type))).not.toContain("could not compile");
    }
  });
});
