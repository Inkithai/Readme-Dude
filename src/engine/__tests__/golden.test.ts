import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_ORDER, type Block, compileDocument, createBlock } from "../index";

/* ------------------------------------------------------------------ *
 * Golden-file test for the whole document (docs/TECH-STACK.md §2 "golden
 * files"). A 12-block README is compiled and compared against a committed
 * fixture. Change the compiler on purpose → re-run with UPDATE_GOLDEN=1 and
 * review the diff. Change it by accident → this test is your PR reviewer.
 * ------------------------------------------------------------------ */

function build(): Block[] {
  const hero = createBlock("hero");
  (hero.props as Record<string, unknown>).title = "Acme SDK";
  (hero.props as Record<string, unknown>).subtitle =
    "A **typed** client for `acme.dev`. [Docs](https://acme.dev/docs)";
  (hero.props as Record<string, unknown>).logoUrl = "https://placehold.co/96x96/png?text=A";
  (hero.props as Record<string, unknown>).buttons = [
    { label: "Get started", url: "https://acme.dev/docs" },
    { label: "Report a bug", url: "https://github.com/acme/sdk/issues/new" },
  ];

  const badges = createBlock("badges");
  (badges.props as Record<string, unknown>).items = [
    {
      alt: "npm",
      imageUrl: "https://img.shields.io/npm/v/@acme/sdk?style=flat-square",
      linkUrl: "https://www.npmjs.com/package/@acme/sdk",
    },
    {
      alt: "license",
      imageUrl: "https://img.shields.io/badge/license-MIT-green?style=flat-square",
      linkUrl: "",
    },
  ];

  const features = createBlock("features");
  (features.props as Record<string, unknown>).layout = "cards-2";
  (features.props as Record<string, unknown>).items = [
    { icon: "⚡", title: "Zero config", body: "Works with `node --experimental-strip-types`." },
    { icon: "🧯", title: "Retry & backoff", body: "Idempotent writes | safe to re-run." },
    { icon: "🔏", title: "Signed webhooks", body: "Constant-time comparison, no timing leaks." },
  ];

  const tech = createBlock("techstack");
  (tech.props as Record<string, unknown>).variant = "grouped";
  (tech.props as Record<string, unknown>).groups = [
    {
      category: "Runtime",
      items: [
        { name: "TypeScript", slug: "typescript", hex: "3178C6" },
        { name: "Bun", slug: "bun", hex: "000000" },
      ],
    },
    { category: "Infra", items: [{ name: "Cloudflare Workers", slug: "cloudflare", hex: "F48120" }] },
  ];

  const table = createBlock("table");
  (table.props as Record<string, unknown>).title = "Method reference";
  (table.props as Record<string, unknown>).columns = ["Method", "Idempotent", "Notes"];
  (table.props as Record<string, unknown>).rows = [
    ["client.put()", "yes", "Re-send after a 500 | no duplicates"],
    ["client.delete()", "yes", ""],
    ["client.stream()", "no", "Two lines\nin one cell"],
  ];
  (table.props as Record<string, unknown>).alignment = ["left", "center", "right"];

  const code = createBlock("code");
  (code.props as Record<string, unknown>).language = "markdown";
  (code.props as Record<string, unknown>).filename = "README.snippet.md";
  (code.props as Record<string, unknown>).body = "```ts\nconst x = 1;\n```\n    indented";

  const install = createBlock("installation");
  (install.props as Record<string, unknown>).steps = [
    { title: "Install the package", body: "", language: "bash", code: "npm i @acme/sdk" },
    {
      title: "Add your key",
      body: "Copy `.env.example` → `.env`.",
      language: "ini",
      code: "ACME_KEY=sk_live_...",
    },
  ];

  const usage = createBlock("usage");
  (usage.props as Record<string, unknown>).examples = [
    {
      title: "Fetch a record",
      body: "",
      language: "typescript",
      code: "const r = await client.get('id');\nconsole.log(r);",
    },
  ];

  const alert = createBlock("text");
  (alert.props as Record<string, unknown>).variant = "alert";
  (alert.props as Record<string, unknown>).alertType = "IMPORTANT";
  (alert.props as Record<string, unknown>).body = "Keys prefixed `sk_live_` hit production.";

  const details = createBlock("text");
  (details.props as Record<string, unknown>).body =
    "<details>\n  <summary>Architecture notes</summary>\n\n  - Edge-first\n  - No retries on 4xx\n</details>";

  const license = createBlock("license");
  (license.props as Record<string, unknown>).year = "2026";
  (license.props as Record<string, unknown>).author = "Acme, Inc.";

  const shot = createBlock("image");
  (shot.props as Record<string, unknown>).url = "https://placehold.co/800x300/png?text=dashboard";
  (shot.props as Record<string, unknown>).alt = "Dashboard";
  (shot.props as Record<string, unknown>).caption = "Figure *one* — the *builder* canvas";

  const tasks = createBlock("checklist");
  (tasks.props as Record<string, unknown>).title = "Release checklist";
  (tasks.props as Record<string, unknown>).showProgress = true;
  (tasks.props as Record<string, unknown>).items = [
    { text: "Run `npm test`", done: true, note: "" },
    { text: "Update the changelog", done: true, note: "keep-a-changelog format" },
    { text: "Tag v2.1.0", done: false, note: "after CI is green" },
  ];

  const collapse = createBlock("collapsible");
  (collapse.props as Record<string, unknown>).summary = "Why a <details> and not a heading?";
  (collapse.props as Record<string, unknown>).icon = "📦";
  (collapse.props as Record<string, unknown>).body =
    'Long setup notes stay out of the way.\n\n- Markdown is parsed here\n- so is this fence\n\n```toml\nkey = "value"\n```';

  const links = createBlock("links");
  (links.props as Record<string, unknown>).style = "list";
  (links.props as Record<string, unknown>).title = "Where to go next";
  (links.props as Record<string, unknown>).items = [
    { label: "Tutorial", url: "https://acme.dev/tutorial", icon: "", description: "20 minutes" },
    { label: "Support", url: "mailto:support@acme.dev", icon: "", description: "" },
  ];

  const hidden = createBlock("heading");
  (hidden.props as Record<string, unknown>).text = "Draft section (hidden)";
  hidden.hidden = true;

  return [
    hero,
    badges,
    features,
    tech,
    table,
    shot,
    code,
    install,
    usage,
    alert,
    details,
    collapse,
    tasks,
    links,
    hidden,
    license,
  ];
}

const FIXTURE = path.join(import.meta.dirname, "__fixtures__", "sample.readme.md");

describe("golden document", () => {
  it("matches the committed README.md fixture", () => {
    const markdown = compileDocument(build());
    if (process.env.UPDATE_GOLDEN || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, markdown, "utf8");
      if (!process.env.UPDATE_GOLDEN) return;
    }
    expect(markdown).toBe(readFileSync(FIXTURE, "utf8"));
  });

  it("never emits an empty document or stray blank-line runs", () => {
    const markdown = compileDocument(build());
    expect(markdown.length).toBeGreaterThan(500);
    expect(markdown).not.toMatch(/\n{3,}/);
    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown).not.toMatch(/[ \t]+$/m);
  });

  it("covers every registered block type, so no block ships uncompiled", () => {
    const inGolden = new Set(build().map((b) => b.type));
    expect([...BLOCK_ORDER].sort()).toEqual([...inGolden].sort());
  });

  it("keeps <details> bodies parseable: a blank line after the summary", () => {
    const markdown = compileDocument(build());
    for (const match of markdown.matchAll(/<summary>[^<]*<\/summary>([\s\S]{0,3})/g)) {
      expect(match[1] ?? "").toMatch(/^\n\n/);
    }
  });

  it("keeps label fields free of unescaped Markdown markers", () => {
    const markdown = compileDocument(build());
    // A heading/section title must not contain a live emphasis run.
    for (const line of markdown.split("\n")) {
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      if (!heading) continue;
      expect(heading[1] ?? "").not.toMatch(/(?<!\\)\*[^*]+\*/);
    }
  });

  it("keeps hidden blocks out of the export but in the model", () => {
    const blocks = build();
    expect(blocks.some((b) => b.hidden)).toBe(true);
    expect(compileDocument(blocks)).not.toContain("Draft section");
  });
});
