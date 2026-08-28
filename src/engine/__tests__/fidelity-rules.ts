import { expect } from "vitest";
import { type BlockType, compileBlock, createBlock } from "../index";

/* ------------------------------------------------------------------ *
 * Fidelity rules — the single definition of "GitHub-accurate".
 *
 * Two suites consume this file:
 *   src/ui/__tests__/preview-fidelity.test.tsx   our own preview, in jsdom
 *   src/engine/__tests__/github-fidelity.test.ts GitHub's renderer, via POST
 *                                                /api.github.com/markdown
 *                                                  (opt-in: GFM_FIDELITY=1)
 * Asserting the *same* rules against both is what turns "the preview looks
 * like GitHub" from a vibe into a test. It is written against HTML strings,
 * not DOM nodes, precisely so the second suite needs no browser.
 * ------------------------------------------------------------------ */

/** A block, compiled the way the app would export it. */
export function compiled(type: BlockType, props: Record<string, unknown> = {}): string {
  const created = createBlock(type);
  const block = { ...created, props: { ...(created.props as object), ...props } } as typeof created;
  const markdown = compileBlock(block);
  expect(markdown, `${type} compiled to nothing`).not.toBe("");
  return markdown;
}

/**
 * Neutralise the differences that are GitHub's presentation, not our Markdown:
 * heading anchor links, `id`s, and camo-proxied image URLs.
 */
export function normalize(html: string): string {
  return html
    .replace(/<a[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/\s*(?:href|src)="https:\/\/camo\.githubusercontent\.com\/[^"]*"/g, ' src="camo"')
    .replace(/\sid="[^"]*"/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const count = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

/**
 * GitHub decorates the elements it renders — `<pre class="notranslate">` inside
 * `<div class="highlight highlight-source-shell">`, `<code class="notranslate">`,
 * `<th align>` versus remark's `style="text-align"`. Those are its stylesheet's
 * business, not a Markdown question, so rules match the tag *name* with a word
 * boundary and tolerate attributes. Asserting the literal spelling of one
 * renderer would make this suite lie about the other.
 */
const hasTag = (html: string, name: string): boolean => new RegExp(`<${name}[\\s>]`).test(html);
const countTag = (html: string, name: string): number => count(html, new RegExp(`<${name}[\\s>]`, "g"));
const textIn = (html: string, tag: string, text: string): boolean =>
  new RegExp(`<${tag}[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</${tag}>`).test(html);

/** Every rule must hold for our preview *and* for GitHub's output. */
export interface FidelityCase {
  name: string;
  type: BlockType;
  props: Record<string, unknown>;
  assert: (html: string) => void;
}

export const FIDELITY_CASES: FidelityCase[] = [
  {
    name: "task list renders real checkboxes",
    type: "checklist",
    props: {
      showTitle: false,
      style: "task",
      items: [
        { text: "Install", done: true, note: "" },
        { text: "Configure", done: false, note: "needs `ANTHROPIC_API_KEY`" },
      ],
    },
    assert: (html) => {
      expect(count(html, /<input[^>]*type="checkbox"/g)).toBe(2);
      expect(hasTag(html, "ul") || hasTag(html, "ol")).toBe(true);
      expect(count(html, /checked/g)).toBe(1);
      expect(html).toContain("contains-task-list");
      expect(html).not.toContain("[x]");
      expect(textIn(html, "code", "ANTHROPIC_API_KEY")).toBe(true);
    },
  },
  {
    name: "literal markers when task lists are not wanted",
    type: "checklist",
    props: {
      showTitle: false,
      style: "square",
      showProgress: false,
      items: [{ text: "Ship", done: true, note: "" }],
    },
    assert: (html) => {
      expect(html).not.toContain("<input");
      expect(html).toContain("[■] Ship");
    },
  },
  {
    name: "markdown inside <details> is parsed, not shown raw",
    type: "collapsible",
    props: {
      summary: "Setup notes",
      icon: "📦",
      open: false,
      body: "Two things:\n\n- **bold** works\n- so does `code`\n\n```bash\nnpm i\n```",
    },
    assert: (html) => {
      expect(html).toContain("<details>");
      expect(html).toContain("<summary>");
      // The whole point of the blank lines: a <p>/<ul>/<pre> inside details.
      // The whole point of the blank lines: block-level Markdown inside the
      // summary becomes <strong>, <li> and a highlighted <pre>, not text.
      expect(html).toMatch(/<details>[\s\S]*<strong>bold<\/strong>/);
      expect(html).toMatch(/<details>[\s\S]*<li>/);
      expect(html).toMatch(/<details>[\s\S]*<pre[\s>]/);
      expect(html).not.toContain("**bold**");
    },
  },
  {
    name: "GFM table keeps its cells, escapes pipes, honours alignment",
    type: "table",
    props: {
      title: "",
      columns: ["Method", "Idempotent", "Notes"],
      rows: [
        ["put()", "yes", "a | b"],
        ["get()", "no", ""],
      ],
      alignment: ["left", "center", "right"],
    },
    assert: (html) => {
      expect(countTag(html, "th")).toBe(3); // <th…>, not <thead>
      expect(countTag(html, "tr")).toBe(3);
      expect(countTag(html, "td")).toBe(6);
      // Attribute or inline style: GitHub emits align="center", remark-gfm emits
      // style="text-align: center". Both are the same rendering, so the rule
      // tests the alignment, not the spelling of one renderer.
      expect(html).toMatch(/align="center"|text-align:\s*center/);
      expect(html).toMatch(/align="right"|text-align:\s*right/);
      expect(html).toContain("a | b");
    },
  },
  {
    name: "alerts render as alerts, not blockquotes",
    type: "text",
    props: { variant: "alert", alertType: "WARNING", body: "Keys prefixed `sk_live_` hit production." },
    assert: (html) => {
      expect(html).toContain("markdown-alert");
      expect(html).toContain("markdown-alert-warning");
      expect(hasTag(html, "svg")).toBe(true); // the octicon
      expect(html).not.toContain("[!WARNING]");
    },
  },
  {
    name: "a fence longer than its content survives round-tripping",
    type: "code",
    props: { language: "ts", filename: "", body: "```\nconst nested = 1;\n```" },
    assert: (html) => {
      expect(hasTag(html, "pre")).toBe(true);
      expect(html).toContain("const nested = 1;");
      expect(html).not.toContain("```");
    },
  },
  {
    name: "badge images land inside their links",
    type: "links",
    props: {
      title: "",
      style: "pills",
      align: "center",
      items: [{ label: "Docs", url: "https://example.com/docs", icon: "", description: "" }],
    },
    assert: (html) => {
      expect(html).toMatch(/<a href="https:\/\/example\.com\/docs"[^>]*>\s*<img/);
      expect(html).toContain('alt="Docs"');
    },
  },
  {
    name: "markdown links stay links in the list style",
    type: "links",
    props: {
      title: "",
      style: "list",
      items: [
        { label: "Docs", url: "https://example.com/docs", icon: "📖", description: "the manual" },
        { label: "Chat", url: "mailto:hi@example.com", icon: "", description: "" },
      ],
    },
    assert: (html) => {
      expect(count(html, /<a href=/g)).toBe(2);
      expect(html).toContain('href="mailto:hi@example.com"');
      expect(html).toContain("the manual");
    },
  },
  {
    name: "emphasis markers in a title are literal, not markup",
    type: "heading",
    props: { level: 2, text: "Notes on *stars* and my_project", emoji: "" },
    assert: (html) => {
      expect(html).toContain("<h2");
      expect(html).not.toContain("<em>stars</em>");
      expect(html).toContain("*stars*");
      expect(html).toContain("my_project");
    },
  },
  {
    name: "images keep alt text and explicit width",
    type: "image",
    props: {
      url: "https://placehold.co/600x200/png?text=ui",
      alt: "Dashboard",
      width: 600,
      align: "center",
      caption: "Figure *one*",
      linkUrl: "",
    },
    assert: (html) => {
      expect(html).toContain('alt="Dashboard"');
      expect(html).toContain('width="600"');
      expect(html).toContain("<em>one</em>");
    },
  },
  {
    name: "the hero's HTML block does not leak raw Markdown",
    type: "hero",
    props: {
      align: "center",
      title: "Acme SDK",
      subtitle: "A **typed** client for `acme.dev`",
      logoUrl: "",
      buttons: [{ label: "Get started", url: "https://acme.dev/docs" }],
    },
    assert: (html) => {
      expect(html).toContain("<h1>Acme SDK</h1>");
      expect(html).toContain("<strong>typed</strong>");
      expect(textIn(html, "code", "acme.dev")).toBe(true);
      expect(html).not.toContain("**typed**");
      // GitHub decorates outbound links (rel="nofollow") and proxies images
      // through camo, so match the href and allow attributes.
      expect(html).toMatch(/<a href="https:\/\/acme\.dev\/docs"[^>]*>/);
    },
  },
  {
    name: "features as cards survive the sanitizer as a real table",
    type: "features",
    props: {
      showTitle: false,
      layout: "cards-2",
      items: [
        { icon: "⚡", title: "Zero config", body: "Works with `node --experimental-strip-types`." },
        { icon: "🧯", title: "Retry", body: "Safe to re-run." },
      ],
    },
    assert: (html) => {
      expect(countTag(html, "td")).toBe(2);
      expect(html).toContain("<strong>Zero config</strong>");
      expect(textIn(html, "code", "node --experimental-strip-types")).toBe(true);
    },
  },
  {
    name: "installation steps keep their numbered shape",
    type: "installation",
    props: {
      title: "",
      intro: "",
      steps: [
        { title: "Install", body: "then", language: "bash", code: "npm i x" },
        { title: "Configure", body: "", language: "bash", code: "cp .env.example .env" },
      ],
    },
    assert: (html) => {
      expect(html).toContain("1. Install");
      expect(html).toContain("2. Configure");
      expect(countTag(html, "pre")).toBe(2);
    },
  },
  {
    name: "license tokens are substituted before export",
    type: "license",
    props: { title: "", notice: "Copyright ${year} ${author}.", url: "", year: "2026", author: "Acme" },
    assert: (html) => {
      expect(html).toContain("Copyright 2026 Acme");
      expect(html).not.toContain("${");
    },
  },
  {
    name: "a row of screenshots is a real table, not a markdown table",
    type: "image",
    props: {
      layout: "columns",
      columns: 2,
      width: 480,
      align: "center",
      url: "",
      text: "",
      items: [
        { url: "https://placehold.co/480x240.png", alt: "One", caption: "", link: "" },
        { url: "https://placehold.co/481x240.png", alt: "Two", caption: "", link: "" },
      ],
    },
    assert: (html) => {
      expect(countTag(html, "table")).toBe(1);
      expect(countTag(html, "td")).toBe(2);
      expect(countTag(html, "img")).toBe(2);
      expect(html).toContain('alt="One"');
      // GFM pipe tables cannot span rows or hold block content, which is why
      // the compiler reaches for HTML here; the assertion is that both renderers
      // agree that HTML is a table.
      expect(html).not.toContain("| One");
    },
  },
  {
    name: "an odd gallery row is padded so nothing stretches",
    type: "image",
    props: {
      layout: "gallery",
      columns: 2,
      align: "center",
      url: "",
      text: "",
      items: [
        { url: "https://placehold.co/600x300.png", alt: "A", caption: "first", link: "" },
        { url: "https://placehold.co/601x300.png", alt: "B", caption: "", link: "" },
        { url: "https://placehold.co/602x300.png", alt: "C", caption: "third", link: "" },
      ],
    },
    assert: (html) => {
      expect(countTag(html, "tr")).toBe(2);
      // 3 images + 1 empty cell: the padding is what stops the last card from
      // becoming a banner across the page.
      expect(countTag(html, "td")).toBe(4);
      expect(html).toContain("<em>third</em>");
    },
  },
  {
    name: "split keeps image and prose in separate cells, top-aligned",
    type: "image",
    props: {
      layout: "split",
      columns: 2,
      align: "center",
      url: "https://placehold.co/640x360.png",
      alt: "Shot",
      caption: "",
      linkUrl: "",
      items: [],
      text: "Three views, one **timeline**.",
    },
    assert: (html) => {
      expect(countTag(html, "td")).toBe(2);
      expect(html).toContain('valign="top"');
      expect(html).toContain("<strong>timeline</strong>");
      expect(html).toContain("<img");
    },
  },
];
