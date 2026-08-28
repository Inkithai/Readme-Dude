import { describe, expect, it } from "vitest";
import {
  dedent,
  escapeHtml,
  escapeInlineMarkdown,
  escapeTableCell,
  fenceFor,
  isProbablyImageUrl,
  longestRun,
  normalizeLines,
  prefixLines,
  sanitizeUrl,
  tidyDocument,
} from "../escape";

describe("fenceFor", () => {
  it("uses three backticks for ordinary code", () => {
    expect(fenceFor("const x = 1;")).toBe("```");
  });

  it("grows the fence when the content itself contains ```", () => {
    expect(fenceFor("```\ncode\n```")).toBe("````");
  });

  it("switches to tildes once a backtick fence would have to be huge", () => {
    // Any fence longer than the body's own runs is correct, so the shorter one
    // wins; 11 backticks in a README is just noise.
    expect(fenceFor("`````````` code")).toBe("~~~");
  });

  it("always outgrows the body for the marker it actually chose", () => {
    // The old implementation grew for backticks but emitted a fixed-width tilde
    // fence, so a body full of tildes closed its own fence and the rest of the
    // file turned into prose.
    const bodies = [
      "`````````` code",
      "~~~~~~\n````\n~~~~~~",
      `${"`".repeat(15)}x${"~".repeat(9)}`,
      "~~~ ``` ~~~ ``` ~~~",
      "",
    ];
    for (const body of bodies) {
      const fence = fenceFor(body);
      expect(fence.length).toBeGreaterThan(longestRun(body, fence[0] as "`" | "~"));
      expect(fence).toMatch(/^[`~]{3,}$/);
    }
  });
});

describe("escapeTableCell", () => {
  it("escapes pipes so the table cannot break", () => {
    expect(escapeTableCell("a | b")).toBe("a \\| b");
  });

  it("turns newlines into <br>", () => {
    expect(escapeTableCell("one\ntwo")).toBe("one<br>two");
  });

  it("escapes backslashes before pipes (order matters)", () => {
    expect(escapeTableCell("C:\\path|next")).toBe("C:\\\\path\\|next");
  });
});

describe("escapeHtml", () => {
  it("escapes attribute-breaking characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});

describe("sanitizeUrl", () => {
  it("rejects javascript: urls", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("rejects html data urls but keeps images", () => {
    expect(sanitizeUrl("data:text/html,<script>")).toBe("");
    expect(sanitizeUrl("  https://a.test/x.png ")).toBe("https://a.test/x.png");
  });

  it("percent-encodes spaces and quotes", () => {
    expect(sanitizeUrl('https://a.test/a b"c.png')).toBe("https://a.test/a%20b%22c.png");
  });
});

describe("dedent", () => {
  it("removes only the common indentation", () => {
    expect(dedent("    one\n      two\n    three")).toBe("one\n  two\nthree");
  });

  it("keeps relative indentation when the first line is flush", () => {
    expect(dedent("one\n    two")).toBe("one\n    two");
  });
});

describe("normalizeLines / prefixLines / tidyDocument", () => {
  it("converts CRLF and strips trailing spaces", () => {
    expect(normalizeLines("a  \r\nb\t\t")).toBe("a\nb");
  });

  it("prefixes blank lines with the marker too", () => {
    expect(prefixLines("one\n\ntwo", "> ")).toBe("> one\n>\n> two");
  });

  it("collapses blank runs and ends with exactly one newline", () => {
    expect(tidyDocument("\n\na\n\n\n\nb\n\n\n")).toBe("a\n\nb\n");
    expect(tidyDocument("   \n")).toBe("");
  });

  it("recognises absolute, protocol-relative and repo-relative images", () => {
    expect(isProbablyImageUrl("https://x.test/a.png")).toBe(true);
    expect(isProbablyImageUrl("//cdn.test/a.png")).toBe(true);
    expect(isProbablyImageUrl("./docs/a.png")).toBe(true);
    expect(isProbablyImageUrl("docs/a.png")).toBe(false);
    expect(isProbablyImageUrl("")).toBe(false);
  });
});

describe("table cells cannot contain newlines", () => {
  it("does not open a cell with a stray <br>", () => {
    // The old filter kept an empty line at index 0, so a pasted cell that
    // started with a newline rendered a break before the first word.
    expect(escapeTableCell("\nInstall")).toBe("Install");
    expect(escapeTableCell("a\n\n\nb")).toBe("a<br>b");
    expect(escapeTableCell("")).toBe("");
    expect(escapeTableCell(null as unknown as string)).toBe("");
  });
});

describe("dollar signs in labels", () => {
  it("escapes a pair so GitHub does not open a math span", () => {
    expect(escapeInlineMarkdown("$PATH and $HOME")).toBe("\\$PATH and \\$HOME");
  });

  it("does not escape the same dollar twice", () => {
    // The count and the replacement must agree about what "already escaped"
    // means: `\$(?<!\\)` looks behind at the dollar *itself*, which is never a
    // backslash, so every dollar counted and an escaped one came out doubled.
    const out = escapeInlineMarkdown("costs \\$5 and \\$6");
    // Backslashes are doubled (that is the contract); the dollars must not be
    // touched as well, or the pair of escapes collapses into a literal one.
    expect(out.match(/\\/g)?.length).toBe(4);
    expect(out.match(/\$/g)?.length).toBe(2);
  });

  it("leaves a single dollar alone", () => {
    expect(escapeInlineMarkdown("100% $5 off")).toBe("100% $5 off");
  });
});

describe("image reachability", () => {
  it("accepts a repo path that walks up a directory", () => {
    // GitHub resolves relative image paths against the README's own folder, so
    // `../docs/img/shot.png` is reachable. The old pattern only allowed `./`,
    // which made validate.ts raise a blocking "unresolvable image" error on a
    // README that rendered perfectly.
    expect(isProbablyImageUrl("../docs/img/shot.png")).toBe(true);
    expect(isProbablyImageUrl("./docs/img/shot.png")).toBe(true);
    expect(isProbablyImageUrl("/docs/img/shot.png")).toBe(true);
    expect(isProbablyImageUrl("docs/img/shot.png")).toBe(false);
    expect(isProbablyImageUrl(null as unknown as string)).toBe(false);
  });

  it("encodes the characters that could open markup inside an attribute", () => {
    // `"` alone was never enough: a raw `>` in a URL sits inside `href="…"` and
    // every tool downstream of us — including our own preview's raw-HTML parser
    // and any markdown linter — has to decide whether that is a tag. Encoding
    // is the only answer that is correct in all of them at once.
    expect(sanitizeUrl(`https://a.test/x"><script>alert(1)</script>`)).toBe(
      "https://a.test/x%22%3E%3Cscript%3Ealert(1)%3C/script%3E",
    );
    expect(sanitizeUrl("https://a.test/`tick`")).toBe("https://a.test/%60tick%60");
    // Parentheses stay: markdown-it balances them, and `…_(foo)` is a real URL.
    expect(sanitizeUrl("https://en.wikipedia.org/wiki/Foo_(bar)")).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
    expect(sanitizeUrl("./docs/a.png")).toBe("./docs/a.png");
  });
});
