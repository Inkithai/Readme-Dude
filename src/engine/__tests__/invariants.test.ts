import { describe, expect, it } from "vitest";
import {
  BLOCK_ORDER,
  type Block,
  type BlockType,
  compileBlock,
  createBlock,
  validateDocument,
} from "../index";

/* ------------------------------------------------------------------ *
 * engine/__tests__/invariants.test.ts — properties the compiler must
 * hold for *every* block, not just for the cases someone remembered.
 *
 * A per-block test suite proves each layout works. It cannot prove the two
 * things that actually break users: that junk-shaped input never leaks into
 * the exported file, and that the compiler never emits a document its own
 * validator would flag. Both are cheap to state globally, so they are asserted
 * over the cartesian product of {every block type} × {every junk mutation of
 * every field}, by walking the defaults rather than hand-listing props.
 *
 * This is the audit's guard rail: Phase 3's presets and Phase 5's Markdown
 * importer are both going to hand the compiler shapes nobody eyeballed.
 * ------------------------------------------------------------------ */

const EVIL = `"><img src=x onerror=alert(1)><script>alert(2)</script>`;
const NUMBERS = [-5, 0, 0.5, 999999, Number.NaN, "12"];

/** Deep-copy defaults, replacing every string/number with junk in turn. */
function mutations(value: unknown, depth = 0): unknown[] {
  if (depth > 3) return [value];
  if (typeof value === "string")
    return [value, "", "   ", EVIL, "**unclosed", "`tick", "a|b\\c", "# H", "x".repeat(400)];
  if (typeof value === "number") return NUMBERS;
  if (typeof value === "boolean") return [true, false];
  if (Array.isArray(value)) {
    const inner = value.map((item) => mutations(item, depth + 1));
    const variants: unknown[] = [[], null, "not-an-array", {}];
    // Replace one element at a time with each of its mutations.
    value.forEach((_, index) => {
      inner.forEach((candidate) => {
        variants.push(value.map((item, i) => (i === index ? candidate : item)));
      });
    });
    return variants;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const variants: unknown[] = [null, [], "junk", 42];
    entries.forEach(([key]) => {
      mutations(value[key as keyof typeof value], depth + 1).forEach((candidate) => {
        variants.push({ ...(value as Record<string, unknown>), [key]: candidate });
      });
      variants.push({ ...(value as Record<string, unknown>), [key]: undefined });
      variants.push({ ...(value as Record<string, unknown>), [key]: null });
    });
    return variants;
  }
  return [value];
}

function withProps(block: Block, props: unknown): Block {
  // Cast the whole block, not just `props`: `Block["props"]` is a union of
  // fifteen shapes, and junk is deliberately none of them.
  return { ...block, props } as Block;
}

/** `{ block, output }` for every mutation of every block type. */
function everyMutatedBlock(type: BlockType): { block: Block; out: string }[] {
  const base = createBlock(type);
  const cases: { block: Block; out: string }[] = [];
  for (const variant of mutations(base.props)) {
    const block = withProps(base, variant);
    cases.push({ block, out: compileBlock(block) });
  }
  // Plus a fully empty props object, which is what a truncated JSON import is.
  const empty = withProps(base, {});
  cases.push({ block: empty, out: compileBlock(empty) });
  return cases;
}

const ALL = BLOCK_ORDER.map((type) => ({ type, cases: everyMutatedBlock(type) }));

describe("compiler invariants over every block", () => {
  it("walks a meaningful number of mutations", () => {
    const total = ALL.reduce((sum, entry) => sum + entry.cases.length, 0);
    expect(total).toBeGreaterThan(500);
  });

  it("never throws, and never leaks a compiler note into the README", () => {
    for (const { type, cases } of ALL) {
      for (const { out } of cases) {
        // `compileBlock` catches and comments — the point of the invariant is
        // that after Phase 2's totality work there is nothing left to catch.
        expect(out, `${type} → could-not-compile`).not.toContain("could not compile");
        expect(out, `${type} → error comment`).not.toContain("<!--");
      }
    }
  });

  it("never prints undefined, NaN, [object or a literal null", () => {
    for (const { type, cases } of ALL) {
      for (const { out } of cases) {
        for (const needle of ["undefined", "NaN", "[object", "null"]) {
          expect(out, `${type} → ${needle}`).not.toContain(needle);
        }
      }
    }
  });

  it("never emits an attribute value that breaks out of its quotes", () => {
    // Anything that lands inside `attr="…"` must have had its quotes escaped,
    // because a live `">` in an attribute is how an `<img onerror>` is born.
    for (const { type, cases } of ALL) {
      for (const { out } of cases) {
        // The breakout condition, stated exactly: a field may not put a quote
        // or an angle bracket inside an attribute value. Percent-encoded text
        // that merely *spells* "onerror" inside a URL is inert and allowed —
        // banning the substring would be theatre, not a safety property.
        for (const attr of out.matchAll(/\s[\w-]+="([^"]*)"/g)) {
          const value = (attr[1] ?? "") as string;
          expect(value, `${type} → quote in attribute`).not.toContain(`"`);
          expect(value, `${type} → bracket in attribute`).not.toMatch(/[<>]/);
        }
      }
    }
  });

  it("keeps every numeric attribute inside the range GitHub will honour", () => {
    // A `<img width="999999">` from a hand-edited JSON is a broken README that
    // no error message explains, and `width="-5"` is invalid HTML outright.
    const bad: string[] = [];
    for (const { type, cases } of ALL) {
      for (const { out } of cases) {
        for (const match of out.matchAll(/\bwidth="([^"]*)"/g)) {
          const raw = match[1] as string;
          if (raw === "100%" || raw === "55%" || raw === "45%" || raw.endsWith("%")) continue;
          const value = Number(raw);
          if (!Number.isInteger(value) || value < 1 || value > 2400) {
            bad.push(`${type}: width="${raw}"`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("never produces structure its own validator rejects", () => {
    // Only the rules that can *only* be the compiler's fault. Junk mutations
    // paste HTML and half-written Markdown into body fields on purpose, and the
    // Checks tab is right to report that (`table-cells-dropped`,
    // `img-not-self-closed`, `unbalanced-strong`) — those are user-content
    // rules. What must never happen is our own output being unparseable:
    // unbalanced tags, a fence left open, a `<details>` swallowing the document.
    const structural =
      /^(unbalanced-tag-|unbalanced-(tilde-)?fence|details-swallow|unknown-alert-type|empty-document)$/;
    const offenders: string[] = [];
    for (const { type, cases } of ALL) {
      for (const { block, out } of cases) {
        if (!out.trim()) continue; // an empty block legitimately exports nothing
        const issues = validateDocument([block], out).filter(
          (issue) => issue.level !== "info" && structural.test(issue.rule),
        );
        if (issues.length > 0) {
          offenders.push(`${type}: ${issues.map((i) => `${i.level}:${i.rule}`).join(", ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
