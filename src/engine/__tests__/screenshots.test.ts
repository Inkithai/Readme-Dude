import { describe, expect, it } from "vitest";
import {
  type Block,
  type BlockType,
  compileBlock,
  createBlock,
  parseDocumentJson,
  serializeDocument,
  validateDocument,
} from "../index";

/* ------------------------------------------------------------------ *
 * Phase 4 — the Screenshot and Hero designers, from the compiler's side.
 *
 * One block, four arrangements. What matters here is not that a table can be
 * emitted (any string builder can do that) but that every arrangement is
 * *GitHub-safe*: balanced tags, no markdown expected inside HTML, a padded
 * trailing row, and a half-filled block that degrades to what the user did
 * type instead of vanishing.
 * ------------------------------------------------------------------ */

function block<T extends BlockType>(type: T, props: Record<string, unknown> = {}): Block {
  const created = createBlock(type);
  return { ...created, props: { ...(created.props as Record<string, unknown>), ...props } } as Block;
}

const compile = (type: BlockType, props: Record<string, unknown> = {}): string =>
  compileBlock(block(type, props));

const three = [
  { url: "https://cdn.test/a.png", alt: "Dashboard", caption: "The board", link: "https://acme.dev/board" },
  { url: "https://cdn.test/b.png", alt: "Editor", caption: "", link: "" },
  { url: "https://cdn.test/c.png", alt: "", caption: "Reports", link: "" },
];

describe("screenshot layouts", () => {
  it("keeps `single` exactly as Phase 2 left it", () => {
    expect(
      compile("image", {
        layout: "single",
        url: "https://cdn.test/a.png",
        alt: "Shot",
        width: 640,
        align: "center",
        caption: "Look at it",
      }),
    ).toBe(
      [
        '<p align="center">',
        '  <img src="https://cdn.test/a.png" alt="Shot" width="640" />',
        "</p>",
        "",
        "*Look at it*",
      ].join("\n"),
    );
  });

  it("lays a row out as one <td> per image, at the block's pixel width", () => {
    const out = compile("image", { layout: "columns", columns: 2, width: 480, items: three });
    expect(out.split("\n")[0]).toBe("<table>");
    expect(out).toContain('<td width="50%" align="center">');
    expect(out).toContain('width="480"');
    // Odd count: the last row is padded, or GitHub stretches the lone image.
    expect(out).toContain('<td width="50%"></td>');
    expect(out.match(/<tr>/g)).toHaveLength(2);
  });

  it("gives a three-across row a third of the table", () => {
    const out = compile("image", { layout: "columns", columns: 3, width: 480, items: three });
    expect(out.match(/<td width="33%" align="center">/g)).toHaveLength(3);
    // Exactly three: no padding cell, and no empty `<td>` to stretch.
    expect(out).not.toContain('<td width="33%"></td>');
  });

  it("lets a gallery fill its column instead of honouring the pixel width", () => {
    const out = compile("image", { layout: "gallery", columns: 2, width: 480, items: three });
    expect(out).toContain('width="100%"');
    expect(out).not.toContain('width="480"');
    // Each card is a <p> so the caption sits under the image, not beside it.
    expect(out).toContain('  <p>\n  <img src="https://cdn.test/b.png"');
    expect(out).toContain("  <em>Reports</em>");
  });

  it("wraps only the images that asked for a link", () => {
    const out = compile("image", { layout: "columns", columns: 2, items: three });
    expect(out).toContain('<a href="https://acme.dev/board"><img src="https://cdn.test/a.png"');
    expect(out).not.toContain('acme.dev/board"></a>');
  });

  it("puts prose beside the image in `split`, converting the inline markdown itself", () => {
    const out = compile("image", {
      layout: "split",
      url: "https://cdn.test/a.png",
      alt: "Shot",
      caption: "**bold** cap",
      text: "Line one\n\nLine **two** with `code`",
    });
    expect(out).toContain('<td width="55%">');
    expect(out).toContain('<td width="45%" valign="top">');
    expect(out).toContain("<p><em><strong>bold</strong> cap</em></p>");
    // markdown is not parsed inside HTML, so the compiler inlines it.
    expect(out).toContain("<p>Line one<br /><br />Line <strong>two</strong> with <code>code</code></p>");
  });

  it("keeps whichever half of a split exists when the other one is empty", () => {
    expect(compile("image", { layout: "split", url: "", text: "Just prose" })).toBe("Just prose");
    const onlyImage = compile("image", {
      layout: "split",
      url: "https://cdn.test/a.png",
      alt: "Shot",
      text: "",
    });
    expect(onlyImage).toContain('<img src="https://cdn.test/a.png"');
    expect(onlyImage).not.toContain("<table>");
  });

  it("shows the block-level image in a row you have not started yet", () => {
    // Switching Single → 2 columns seeds nothing in the compiler; the panel
    // carries the image across. Until it does, the row must not be blank.
    const out = compile("image", { layout: "columns", url: "https://cdn.test/a.png", items: [] });
    expect(out).toContain('src="https://cdn.test/a.png"');
    // Once the list exists it is authoritative — a row is not allowed to render
    // an image the panel does not show.
    expect(
      compile("image", { layout: "columns", url: "https://cdn.test/a.png", items: [{ url: "" }] }),
    ).not.toContain("cdn.test");
    const single = compile("image", {
      layout: "single",
      url: "",
      items: [three[0] as Record<string, unknown>],
    });
    expect(single).toContain('src="https://cdn.test/a.png"');
    expect(single).toContain("*The board*");
  });

  it("escapes alt text and drops unsafe URLs instead of escaping them", () => {
    const out = compile("image", {
      layout: "columns",
      columns: 2,
      items: [
        {
          url: 'https://cdn.test/a.png", onerror="alert(1)',
          alt: `"><script>alert(1)</script>`,
          caption: "",
          link: "",
        },
        { url: "javascript:alert(1)", alt: "nope", caption: "", link: "javascript:alert(1)" },
      ],
    });
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("survives junk-shaped props", () => {
    for (const props of [
      { layout: "gallery", columns: "3", items: [{ url: "javascript:alert(1)" }, null, { url: "" }] },
      { layout: "columns", columns: 0, items: "not-an-array" },
      { layout: "columns", items: [{}] },
      { layout: "split", text: 42, items: [{ url: 3 }] },
      { layout: undefined, url: undefined },
    ]) {
      const out = compile("image", props as Record<string, unknown>);
      expect(out).not.toContain("undefined");
      expect(out).not.toContain("[object");
      expect(out).not.toContain("NaN");
      if (out) expect(out).toMatch(/^<table>[\s\S]*<\/table>$|^.*png[\s\S]*|^[\s\S]+$/);
    }
  });

  it("emits balanced HTML for every layout, so the validator stays quiet", () => {
    // Structured rules only: a lone image is not a whole README, so the
    // document-shape infos (no title, no examples) are noise here.
    for (const props of [
      { layout: "single" },
      { layout: "columns", columns: 2, items: three },
      { layout: "columns", columns: 3, items: three },
      { layout: "gallery", columns: 3, items: three },
      { layout: "gallery", columns: 2, items: three, caption: "x" },
      { layout: "split", text: "Prose **here**", caption: "c" },
    ]) {
      const blocks = [block("image", props as Record<string, unknown>)];
      const issues = validateDocument(blocks, compileBlock(blocks[0] as Block)).filter(
        (issue) => issue.level !== "info",
      );
      expect(issues).toEqual([]);
    }
  });
});

describe("screenshot blocks in the document format", () => {
  it("round-trips items through .json", () => {
    const blocks = [block("image", { layout: "gallery", columns: 3, items: three })];
    const parsed = parseDocumentJson(serializeDocument("shots", blocks));
    expect(parsed.dropped).toBe(0);
    expect(parsed.document.blocks[0]?.props).toEqual(blocks[0]?.props);
  });

  it("accepts an item whose URL is still empty", () => {
    // An in-progress row must not invalidate the block: a rejected block would
    // silently delete the user's other work the next time the file is opened.
    const parsed = parseDocumentJson(
      serializeDocument("wip", [block("image", { layout: "columns", items: [{ url: "", alt: "soon" }] })]),
    );
    expect(parsed.dropped).toBe(0);
    expect(parsed.errors).toEqual([]);
  });

  it("reads a pre-Phase-4 image block without complaint", () => {
    // Documents written in Phase 1–2 have no layout, no columns, no items.
    // They are still exactly a centred single image, not a migration problem.
    const legacy = {
      id: "b1",
      type: "image",
      hidden: false,
      props: {
        url: "https://cdn.test/old.png",
        alt: "Old shot",
        width: 600,
        align: "center",
        caption: "as shipped",
        linkUrl: "",
      },
    };
    const parsed = parseDocumentJson(serializeDocument("legacy", [legacy as unknown as Block]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.document.blocks[0]?.props).toMatchObject({ layout: "single", columns: 2, items: [] });
    expect(compileBlock(parsed.document.blocks[0] as Block)).toContain('<p align="center">');
  });

  it("warns when the block would render nothing at all", () => {
    // A sibling block keeps the document non-empty: `empty-document` is a
    // document-level error that stops the rest of the checks, on purpose.
    const empty = block("image", { layout: "columns", url: "", items: [{ url: "   " }] });
    const head = block("heading", { text: "Screenshots" });
    const issues = validateDocument([head, empty], [compileBlock(head), compileBlock(empty)].join("\n\n"));
    expect(issues.map((i) => `${i.level}:${i.rule}`)).toContain("warning:image-no-source");

    const proseOnly = block("image", { layout: "split", url: "", items: [], text: "Still says something" });
    const out = compileBlock(proseOnly);
    expect(out).toBe("Still says something");
    expect(validateDocument([proseOnly], out).filter((i) => i.level !== "info")).toEqual([]);
  });
});

describe("hero image", () => {
  it("sits between the tagline and the buttons, inside the centring wrapper", () => {
    const out = compile("hero", {
      align: "center",
      title: "Meterloop",
      subtitle: "Latency, measured.",
      imageUrl: "https://cdn.test/shot.png",
      imageWidth: 800,
      imageAlt: "Dashboard",
      buttons: [],
    });
    expect(out).toBe(
      [
        '<div align="center">',
        "  <h1>Meterloop</h1>",
        "",
        "  <p>Latency, measured.</p>",
        "",
        '  <img src="https://cdn.test/shot.png" alt="Dashboard" width="800" />',
        "",
        "</div>",
      ].join("\n"),
    );
  });

  it("clamps a wild width and quotes-escapes the alt text", () => {
    const out = compile("hero", { imageUrl: "https://cdn.test/a.png", imageWidth: 99999, imageAlt: `a"b` });
    expect(out).toContain('alt="a&quot;b" width="2400"');
  });

  it("omits the image entirely when the URL is unusable", () => {
    expect(compile("hero", { imageUrl: "javascript:alert(1)" })).not.toContain("<img");
    expect(compile("hero", { imageUrl: "  " })).not.toContain("<img");
  });

  it("still counts as an image source for the checks", () => {
    const hero = block("hero", { imageUrl: "docs/shot.png" });
    const issues = validateDocument([hero], compileBlock(hero));
    expect(issues.map((i) => i.rule)).toContain("unresolvable-image");
  });
});
