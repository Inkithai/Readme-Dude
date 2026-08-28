import { describe, expect, it } from "vitest";
import {
  dedent,
  escapeHtml,
  escapeTableCell,
  fenceFor,
  isProbablyImageUrl,
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

  it("switches to tildes once backticks cannot win", () => {
    expect(fenceFor("`````````` code")).toBe("~".repeat(11));
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
