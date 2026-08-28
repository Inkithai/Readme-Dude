import { describe, expect, it } from "vitest";
import { BLOCKS, type Block, type BlockType, compileBlock, compileDocument, createBlock } from "../index";

/* ------------------------------------------------------------------ *
 * These are the tests that make the "GitHub correctness" pillar real.
 * Each `it` names the GitHub rendering rule it protects.
 * ------------------------------------------------------------------ */

function block<T extends BlockType>(type: T, props: Record<string, unknown> = {}): Block {
  const created = createBlock(type);
  return { ...created, props: { ...(created.props as Record<string, unknown>), ...props } } as Block;
}

const compile = (type: BlockType, props: Record<string, unknown> = {}): string =>
  compileBlock(block(type, props));

describe("heading + text", () => {
  it("emits the requested ATX level", () => {
    expect(compile("heading", { level: 1, text: "Title" })).toBe("# Title");
    expect(compile("heading", { level: 3, text: "Sub", emoji: "🚀" })).toBe("### 🚀 Sub");
  });

  it("passes paragraph markdown through untouched", () => {
    expect(compile("text", { variant: "paragraph", body: "a\n\n- one\n- two" })).toBe("a\n\n- one\n- two");
  });

  it("quotes every line, including blanks", () => {
    expect(compile("text", { variant: "quote", body: "one\n\ntwo" })).toBe("> one\n>\n> two");
  });

  it("uses GitHub alert syntax", () => {
    expect(compile("text", { variant: "alert", alertType: "WARNING", body: "Careful" })).toBe(
      "> [!WARNING]\n> Careful",
    );
  });

  it("contributes nothing when empty", () => {
    expect(compile("text", { body: "   " })).toBe("");
  });
});

describe("features", () => {
  const items = [
    { icon: "⚡", title: "Fast", body: "Zero config" },
    { icon: "", title: "Small", body: "" },
  ];

  it("renders dash bullets with an em dash separator", () => {
    expect(compile("features", { layout: "bullets", items })).toBe(
      "## Key Features\n\n- ⚡ **Fast** — Zero config\n- **Small**",
    );
  });

  it("numbers items when the layout is numbered", () => {
    const out = compile("features", { layout: "numbered", items, showTitle: false });
    expect(out).toBe("1. ⚡ **Fast** — Zero config\n2. **Small**");
  });

  it("wraps cards into rows of the requested column count", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ icon: "", title: `F${i}`, body: "" }));
    const out = compile("features", { layout: "cards-2", items: many, showTitle: false });
    expect(out.match(/<tr>/g)).toHaveLength(3); // 5 items, 2 per row → last row padded
    expect(out.match(/<td/g)).toHaveLength(6);
    expect(out).toContain("<table>");
    expect(out).toContain("</table>");
  });

  it("escapes HTML-significant characters inside card content", () => {
    const out = compile("features", {
      layout: "cards-3",
      showTitle: false,
      items: [{ icon: "", title: "a < b", body: "x & y" }],
    });
    expect(out).toContain("<strong>a &lt; b</strong>");
    expect(out).toContain("x &amp; y");
  });
});

describe("table (GFM)", () => {
  it("builds a header row, an alignment row and body rows", () => {
    const out = compile("table", {
      title: "",
      columns: ["A", "B"],
      rows: [["1", "2"]],
      alignment: ["left", "center"],
    });
    expect(out).toBe("| A | B |\n| --- | :---: |\n| 1 | 2 |");
  });

  it("pads short rows and drops surplus cells so every row matches", () => {
    const out = compile("table", {
      title: "",
      columns: ["A", "B", "C"],
      rows: [["1"], ["1", "2", "3", "4"]],
      alignment: [],
    });
    const lines = out.split("\n");
    expect(lines[2]).toBe("| 1 |  |  |");
    expect(lines[3]).toBe("| 1 | 2 | 3 |");
  });

  it("skips completely empty rows", () => {
    const out = compile("table", { title: "", columns: ["A"], rows: [[""], ["x"]], alignment: [] });
    expect(out.split("\n")).toHaveLength(3);
  });

  it("escapes pipes inside cells instead of corrupting the grid", () => {
    expect(compile("table", { title: "", columns: ["A"], rows: [["x|y"]], alignment: [] })).toContain(
      "| x\\|y |",
    );
  });
});

describe("code fences", () => {
  it("annotates the fence with the language", () => {
    expect(compile("code", { language: "bash", body: "ls -la" })).toBe("```bash\nls -la\n```");
  });

  it("grows the fence when the body contains ``` (markdown-in-markdown)", () => {
    const body = "```js\nconst a = 1;\n```";
    const out = compile("code", { language: "markdown", body });
    expect(out.startsWith("````markdown\n")).toBe(true);
    expect(out.endsWith("\n````")).toBe(true);
  });

  it("dedents pasted code and strips the filename-free whitespace", () => {
    expect(compile("code", { language: "js", body: "    a\n      b\n    c" })).toBe("```js\na\n  b\nc\n```");
  });

  it("sanitizes the language token", () => {
    expect(compile("code", { language: 'js" onload="evil()', body: "x" })).toContain("```jsonloadevil");
  });
});

describe("hero", () => {
  it("centers via an HTML wrapper and escapes the title", () => {
    const out = compile("hero", { title: "My <project> & co", subtitle: "", logoUrl: "", buttons: [] });
    expect(out).toContain('<div align="center">');
    expect(out).toContain("<h1>My &lt;project&gt; &amp; co</h1>");
    expect(out.trim().endsWith("</div>")).toBe(true);
  });

  it("renders logo, width and CTA buttons as badge links", () => {
    const out = compile("hero", {
      title: "T",
      subtitle: "S",
      logoUrl: "https://x.test/l.png",
      logoWidth: 120,
      buttons: [{ label: "Docs", url: "https://x.test/docs" }],
    });
    expect(out).toContain('<img src="https://x.test/l.png" alt="Logo" width="120" />');
    expect(out).toContain('<a href="https://x.test/docs"><img src="https://img.shields.io/badge/');
    expect(out).toContain("<p>S</p>");
  });

  it("converts the markdown subset inside the tagline", () => {
    const out = compile("hero", { title: "T", subtitle: "built with **React** and `vite`" });
    expect(out).toContain("<strong>React</strong>");
    expect(out).toContain("<code>vite</code>");
  });
});

describe("image + badges", () => {
  it("wraps a centred image and adds an italic caption", () => {
    const out = compile("image", {
      url: "https://x.test/a.png",
      alt: "Shot",
      width: 640,
      align: "center",
      caption: "Fig 1",
    });
    expect(out).toBe(
      '<p align="center">\n  <img src="https://x.test/a.png" alt="Shot" width="640" />\n</p>\n\n*Fig 1*',
    );
  });

  it("leaves a left-aligned image unwrapped so markdown stays intact", () => {
    expect(compile("image", { url: "https://x.test/a.png", align: "left", caption: "" })).toBe(
      '<img src="https://x.test/a.png" alt="Screenshot" width="900" />',
    );
  });

  it("drops an image with no URL rather than emitting a broken tag", () => {
    expect(compile("image", { url: "   " })).toBe("");
  });

  it("renders one badge row and wraps linked badges", () => {
    const out = compile("badges", {
      align: "center",
      items: [
        {
          alt: "ci",
          imageUrl: "https://img.shields.io/badge/ci-passing-green",
          linkUrl: "https://x.test/ci",
        },
        { alt: "lic", imageUrl: "https://img.shields.io/badge/lic-MIT-green", linkUrl: "" },
      ],
    });
    expect(out).toContain('<p align="center">');
    expect(out).toContain(
      '<a href="https://x.test/ci"><img src="https://img.shields.io/badge/ci-passing-green" alt="ci" /></a>',
    );
    expect(out).toContain('<img src="https://img.shields.io/badge/lic-MIT-green" alt="lic" />');
  });
});

describe("tech stack", () => {
  const groups = [{ category: "Core", items: [{ name: "React", slug: "react", hex: "61DAFB" }] }];

  it("emits shields.io logo badges in a centred row", () => {
    const out = compile("techstack", { variant: "badges", style: "flat", groups });
    expect(out).toContain("logo=react");
    expect(out).toContain("61DAFB");
    expect(out).toContain('<p align="center">');
  });

  it("emits a definition list for the list layout", () => {
    expect(compile("techstack", { variant: "list", groups })).toBe("## Tech Stack\n\n- **Core:** React");
  });

  it("emits a GFM table for the table layout", () => {
    const out = compile("techstack", { variant: "table", groups });
    expect(out).toContain("| Category | Technologies |");
    expect(out).toContain("| Core | React |");
  });

  it("adds subheadings for the grouped layout", () => {
    expect(compile("techstack", { variant: "grouped", groups })).toContain("### Core");
  });
});

describe("installation / usage / license", () => {
  it("numbers steps as bold paragraphs so nested fences stay valid", () => {
    const out = compile("installation", {
      title: "Installation",
      intro: "Get going.",
      steps: [
        { title: "Clone", body: "", language: "bash", code: "git clone x" },
        { title: "Install", body: "", language: "bash", code: "npm i" },
      ],
    });
    expect(out).toContain("## Installation\n\nGet going.");
    expect(out).toContain("**1. Clone**\n\n```bash\ngit clone x\n```");
    expect(out).toContain("**2. Install**");
  });

  it("omits numbering for a single step", () => {
    const out = compile("installation", {
      steps: [{ title: "Run", body: "", language: "bash", code: "make" }],
    });
    expect(out).toContain("**Run**");
    expect(out).not.toContain("**1. Run**");
  });

  it("titles usage examples as h3", () => {
    const out = compile("usage", {
      examples: [{ title: "Basic", body: "text", language: "ts", code: "x()" }],
    });
    expect(out).toBe("## Usage\n\n### Basic\n\ntext\n\n```ts\nx()\n```");
  });

  it("substitutes year and author in the license notice", () => {
    const out = compile("license", {
      notice: "Copyright (c) ${year} ${author}",
      year: "2026",
      author: "Ada",
      url: "",
      title: "License",
    });
    expect(out).toBe("## License\n\nCopyright (c) 2026 Ada");
  });

  it("does not double-append a link when the notice already has one", () => {
    const out = compile("license", {
      notice: "See [LICENSE](./LICENSE) for details.",
      url: "https://opensource.org/licenses/MIT",
      title: "License",
    });
    expect(out.match(/https:\/\/opensource\.org/g)).toBeNull();
  });
});

describe("document assembly", () => {
  it("skips hidden blocks and separates visible ones with a blank line", () => {
    const a = block("heading", { level: 2, text: "One", emoji: "" });
    const hidden = { ...block("heading", { level: 2, text: "Gone", emoji: "" }), hidden: true };
    const c = block("heading", { level: 2, text: "Two", emoji: "" });
    expect(compileDocument([a, hidden, c])).toBe("## One\n\n## Two\n");
  });

  it("ends with exactly one trailing newline", () => {
    const out = compileDocument([block("text", { body: "hi" })]);
    expect(out.endsWith("hi\n")).toBe(true);
  });

  it("compiles an empty document to an empty string", () => {
    expect(compileDocument([])).toBe("");
  });

  it("every registered block compiles without throwing", () => {
    for (const type of Object.keys(BLOCKS) as BlockType[]) {
      expect(() => compileBlock(createBlock(type))).not.toThrow();
      expect(compileBlock(createBlock(type)).length).toBeGreaterThan(0);
    }
  });
});
