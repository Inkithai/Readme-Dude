import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOCK_ORDER,
  type Block,
  BlockSchema,
  type BlockType,
  compileDocument,
  createBlock,
  parseDocumentJson,
  serializeDocument,
  validateDocument,
} from "../index";
// Presets come from the subpath, exactly as the gallery imports them: the
// engine barrel does not re-export them (see engine/index.ts for why).
import {
  BRAND_NAMES,
  blocksFromTemplate,
  getTemplate,
  previewTemplate,
  TEMPLATES,
  templateSectionLine,
  templatesForKind,
} from "../templates";

/* ------------------------------------------------------------------ *
 * The Phase 3 test matrix.
 *
 * docs/TECH-STACK.md §7: "No Storybook. The templates *are* the visual test
 * matrix." That claim is only true if something checks it, so this file treats
 * every preset as both a product surface and a compiler fixture:
 *
 *   • a preset may not contain a block that compiles to nothing, or a prop key
 *     the compiler will never read (the classic way a hand-authored template
 *     rots: the field is renamed, the template keeps setting the old one, and
 *     nothing fails);
 *   • every preset is compiled and handed to `validateDocument` with *its own*
 *     `kind`, and must come back with no issues at all — which is what keeps
 *     the profile presets from shipping the nudges they exist to avoid;
 *   • together the twelve must touch every registered block type.
 *
 * Two of them are additionally pinned to committed golden files, so a compiler
 * change shows up as a reviewable diff instead of twelve silently-different
 * presets.
 * ------------------------------------------------------------------ */

const ALL = TEMPLATES.map((template) => ({ template, blocks: template.blocks() }));
const forKind = (kind: "project" | "profile") => ALL.filter((x) => x.template.kind === kind);

/** Every string that the compiler will treat as a URL, wherever it is nested. */
function urlsOf(block: Block): string[] {
  const found: string[] = [];
  const walk = (value: unknown, key = ""): void => {
    if (typeof value === "string") {
      if (/url|src|imageurl/i.test(key)) found.push(value);
      return;
    }
    if (Array.isArray(value)) for (const item of value) walk(item, key);
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
  };
  walk(block.props);
  return found;
}

/** The array a block type puts its content in — the one that must not be empty. */
const PRIMARY_LIST: Partial<Record<BlockType, string>> = {
  features: "items",
  badges: "items",
  links: "items",
  checklist: "items",
  installation: "steps",
  usage: "examples",
  techstack: "groups",
  table: "rows",
};

describe("preset registry", () => {
  it("ships exactly eight project and four profile presets (roadmap Phase 3)", () => {
    expect(forKind("project")).toHaveLength(8);
    expect(forKind("profile")).toHaveLength(4);
    expect(TEMPLATES).toHaveLength(12);
  });

  it("keeps ids unique, kebab-case and resolvable", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const id of ids) expect(getTemplate(id)?.id).toBe(id);
    expect(getTemplate("does-not-exist")).toBeUndefined();
  });

  it("names the document something a filename can carry", () => {
    for (const t of TEMPLATES) {
      // `docName` becomes the README file name (`README-<slug>.md`), so it has
      // to survive slugify() without collapsing to the empty string.
      expect(t.docName, t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("writes gallery copy that fits a rail card", () => {
    for (const t of TEMPLATES) {
      expect(t.label.length, t.id).toBeGreaterThan(0);
      expect(t.blurb.length, t.id).toBeGreaterThan(24);
      expect(t.blurb.length, t.id).toBeLessThanOrEqual(110);
      expect(t.notes.length, t.id).toBeGreaterThanOrEqual(3);
      for (const note of t.notes) expect(note.length, `${t.id} note`).toBeLessThanOrEqual(150);
    }
  });

  it("splits cleanly by kind, so the gallery filter cannot overlap", () => {
    const projects = templatesForKind("project");
    const profiles = templatesForKind("profile");
    expect(projects.every((t) => t.kind === "project")).toBe(true);
    expect(profiles.every((t) => t.kind === "profile")).toBe(true);
    expect(projects.length + profiles.length).toBe(TEMPLATES.length);
  });

  it("puts project presets first, because that is what most visitors came for", () => {
    expect(TEMPLATES.slice(0, 8).every((t) => t.kind === "project")).toBe(true);
  });
});

describe("preset block shapes", () => {
  it("builds only blocks the schema accepts", () => {
    const bad: string[] = [];
    for (const { template } of ALL) {
      template.blocks().forEach((block, i) => {
        const result = BlockSchema.safeParse(block);
        if (!result.success) bad.push(`${template.id} #${i} (${block.type}): ${result.error.message}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("sets no prop key the block type does not have", () => {
    // The silent failure mode of a template: `layoout` instead of `layout`
    // renders the default layout forever. A typo here is a bug in the preset,
    // and there is no UI that would ever reveal it.
    const offenders: string[] = [];
    for (const { template } of ALL) {
      for (const block of template.blocks()) {
        const known = Object.keys(createBlock(block.type).props as Record<string, unknown>);
        for (const key of Object.keys(block.props as Record<string, unknown>)) {
          if (!known.includes(key)) offenders.push(`${template.id}: ${block.type}.${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never ships an empty section", () => {
    const empty: string[] = [];
    for (const { template } of ALL) {
      for (const block of template.blocks()) {
        const key = PRIMARY_LIST[block.type];
        if (!key) continue;
        const list = (block.props as Record<string, unknown>)[key];
        const length = Array.isArray(list) ? list.length : 0;
        if (length === 0) empty.push(`${template.id}: ${block.type}.${key} is empty`);
        if (block.type === "techstack") {
          const groups = Array.isArray(list) ? (list as { items?: unknown[] }[]) : [];
          if (groups.some((g) => !Array.isArray(g.items) || g.items.length === 0))
            empty.push(`${template.id}: techstack group with no items`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it("together covers every registered block type", () => {
    const used = new Set<BlockType>();
    for (const { template } of ALL) for (const block of template.blocks()) used.add(block.type);
    expect([...BLOCK_ORDER].sort()).toEqual([...used].sort());
  });

  it("only names technologies the generated brand data knows", () => {
    // Slugs and hexes come from `npm run brands`. A preset that invents a name
    // would render a logo-less badge forever, and nobody would notice.
    const known = new Set(BRAND_NAMES.map((name) => name.toLowerCase()));
    const unknown: string[] = [];
    for (const { template } of ALL) {
      for (const block of template.blocks()) {
        if (block.type !== "techstack") continue;
        const groups =
          (block.props as { groups?: { items?: { name?: string; slug?: string }[] }[] }).groups ?? [];
        for (const group of groups)
          for (const item of group.items ?? []) {
            if (!item.name?.toLowerCase() || !known.has(item.name.toLowerCase()))
              unknown.push(`${template.id}: "${item.name}"`);
            if (!item.slug) unknown.push(`${template.id}: "${item.name}" has no icon slug`);
          }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("ships absolute URLs only — a relative path resolves against the user's repo", () => {
    const bad: string[] = [];
    for (const { template } of ALL) {
      for (const block of template.blocks()) {
        for (const url of urlsOf(block)) {
          if (!url) continue;
          if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) bad.push(`${template.id}: ${url}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("compiled preset output", () => {
  it("compiles every preset without a single degraded block", () => {
    const failures: string[] = [];
    for (const { template } of ALL) {
      const markdown = compileDocument(template.blocks());
      if (markdown.includes("could not compile")) failures.push(template.id);
    }
    expect(failures).toEqual([]);
  });

  it("leaks no undefined, NaN, [object Object] or unsubstituted template hole", () => {
    for (const { template } of ALL) {
      const markdown = compileDocument(template.blocks());
      expect(markdown, template.id).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
      expect(markdown, template.id).not.toMatch(/\$\{(?!year\}|author\})/);
    }
  });

  it("is well-formed Markdown on its own terms", () => {
    for (const { template } of ALL) {
      const markdown = compileDocument(template.blocks());
      const fences = markdown.split("\n").filter((line) => /^ {0,3}(```|~~~)/.test(line));
      expect(fences.length % 2, template.id).toBe(0);
      expect(markdown, template.id).not.toMatch(/\n{3,}/);
      expect(markdown, template.id).toMatch(/\n$/);
      expect(markdown, template.id).not.toMatch(/\]\(\s*\)/); // a link that goes nowhere
      expect(markdown, template.id).not.toMatch(/[ \t]+$/m);
    }
  });

  it("passes the Checks tab with its own kind — no errors, no warnings, no nudges", () => {
    for (const { template } of ALL) {
      const blocks = template.blocks();
      const issues = validateDocument(blocks, compileDocument(blocks), { kind: template.kind });
      expect(
        issues.map((i) => `${i.level}:${i.rule}`),
        template.id,
      ).toEqual([]);
    }
  });

  it("keeps the profile presets free of project-only sections", () => {
    for (const { template } of forKind("profile")) {
      const types = template.blocks().map((b) => b.type);
      expect(types, template.id).not.toContain("installation");
      expect(types, template.id).not.toContain("license");
    }
  });

  it("makes every profile preset a way to contact somebody", () => {
    for (const { template } of forKind("profile")) {
      const markdown = compileDocument(template.blocks());
      expect(markdown, template.id).toMatch(/https?:\/\/|mailto:/);
      expect(
        template.blocks().some((b) => b.type === "links" || b.type === "badges"),
        template.id,
      ).toBe(true);
    }
  });
});

describe("presets are factories", () => {
  it("hands back fresh ids every time", () => {
    for (const { template } of ALL) {
      const first = template.blocks().map((b) => b.id);
      const second = template.blocks().map((b) => b.id);
      expect(new Set([...first, ...second]).size).toBe(first.length + second.length);
    }
  });

  it("is deterministic in content: same preset, same Markdown", () => {
    for (const { template } of ALL) {
      expect(compileDocument(template.blocks())).toBe(compileDocument(template.blocks()));
    }
  });

  it("does not share mutable defaults with the block registry", () => {
    // `tpl()` merges over `createBlock()`, which must produce a new object each
    // time or editing one applied preset would edit every future one.
    for (const { template } of ALL) {
      const blocks = template.blocks();
      const first = blocks[0];
      if (!first) continue;
      const before = compileDocument(template.blocks());
      (first.props as Record<string, unknown>).title = "MUTATED";
      (first.props as Record<string, unknown>).items = [];
      expect(compileDocument(template.blocks())).toBe(before);
    }
  });

  it("reidentifies through the store's own entry point", () => {
    for (const { template } of forKind("project").slice(0, 3)) {
      const blocks = blocksFromTemplate(template);
      expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
      expect(blocks.length).toBe(template.blocks().length);
    }
  });
});

describe("gallery helpers", () => {
  it("derives the section list from the blocks, not from prose", () => {
    for (const { template } of ALL) {
      const preview = previewTemplate(template);
      expect(preview.sections.length, template.id).toBe(template.blocks().length);
      expect(preview.markdown, template.id).toBe(compileDocument(template.blocks()));
      for (const section of preview.sections) expect(section.label.length).toBeGreaterThan(1);
    }
  });

  it("clips the section line for a narrow card", () => {
    const flagship = getTemplate("professional-project");
    if (!flagship) throw new Error("flagship preset missing");
    const line = templateSectionLine(flagship, 2);
    expect(line.split(" · ")[0]).toBe("Hero");
    expect(line).toMatch(/\+\d+ more$/);
    const smallest = getTemplate("minimal-project");
    if (!smallest) throw new Error("minimal preset missing");
    expect(templateSectionLine(smallest, 99)).not.toContain("more");
  });

  it("keeps the preset size sane for a rail card and a browser bundle", () => {
    // The budget is real: presets are code-split-free data inside the main
    // bundle, and a 30-block "template" is a document, not a starting point.
    for (const { template } of ALL) {
      const count = template.blocks().length;
      expect(count, template.id).toBeGreaterThanOrEqual(4);
      expect(count, template.id).toBeLessThanOrEqual(14);
    }
  });
});

describe("the kind seam", () => {
  it("survives the .json round trip", () => {
    const full = getTemplate("full-profile");
    if (!full) throw new Error("full profile preset missing");
    const blocks = blocksFromTemplate(full);
    const parsed = parseDocumentJson(serializeDocument("full-profile", blocks, "profile"));
    expect(parsed.document.kind).toBe("profile");
    expect(parsed.dropped).toBe(0);
  });

  it("defaults to project for a document written before Phase 3", () => {
    const legacy = JSON.stringify({ version: 1, name: "old", blocks: [createBlock("hero")] });
    expect(parseDocumentJson(legacy).document.kind).toBe("project");
  });

  it("degrades an unknown kind instead of refusing the file", () => {
    // A document from a future version (say kind: "changelog") must open with
    // the project renderer, because *blocks* are the portable part.
    const future = JSON.stringify({
      version: 1,
      name: "from-tomorrow",
      kind: "changelog",
      blocks: [createBlock("hero")],
    });
    const parsed = parseDocumentJson(future);
    expect(parsed.document.kind).toBe("project");
    expect(parsed.document.blocks).toHaveLength(1);
    expect(parsed.errors).toEqual([]);
  });
});

/* ------------------------------- goldens ------------------------------- */

const GOLDEN: Record<string, string> = {
  "professional-project": "template-professional-project.readme.md",
  "developer-profile": "template-developer-profile.readme.md",
};

describe("preset goldens", () => {
  for (const [id, file] of Object.entries(GOLDEN)) {
    it(`keeps ${id} byte-for-byte stable`, () => {
      const template = getTemplate(id);
      if (!template) throw new Error(`unknown preset ${id}`);
      const fixture = path.join(import.meta.dirname, "__fixtures__", file);
      const markdown = compileDocument(template.blocks());
      if (process.env.UPDATE_GOLDEN || !existsSync(fixture)) {
        writeFileSync(fixture, markdown, "utf8");
        if (!process.env.UPDATE_GOLDEN) return;
      }
      expect(markdown).toBe(readFileSync(fixture, "utf8"));
    });
  }
});
