import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as engine from "../index";

/* ------------------------------------------------------------------ *
 * The architecture rule, made mechanical.
 *
 * README.md and docs/TECH-STACK.md §2 both promise it in prose — "nothing in
 * `src/engine/**` may import React" — and prose rules rot. Phase 3 is the proof
 * of the risk: presets are content, and content is exactly what tempts you to
 * `import { Sparkles } from "lucide-react"` for a gallery icon, or to reach for
 * `localStorage` "just this once" to remember the last used preset. Either one
 * would quietly cancel the roadmap's V6 escape route (the same engine driving a
 * CLI, a VS Code extension, or a prerendered template site).
 *
 * So: a whitelist of specifiers, no DOM globals, and no accidental weight on
 * the boot chunk. All four checks are pure text scans over the source files,
 * which keeps them fast and dependency-free.
 * ------------------------------------------------------------------ */

const ENGINE = path.join(import.meta.dirname, "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : sourceFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });

const FILES = sourceFiles(ENGINE);

/** `import x from "spec"` / `export * from "spec"`, with comments removed. */
function specifiers(code: string): string[] {
  const stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/^\s*import\s+["']([^"']+)["']/gm, 'import "$1"'); // side-effect imports
  const found: string[] = [];
  for (const match of stripped.matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?\bfrom\s+"([^"]+)"/g)) {
    if (match[1]) found.push(match[1]);
  }
  // A side-effect import (`import "./x.css"`) has no `from`; catch those too.
  for (const match of stripped.matchAll(/(?:^|\n)\s*import\s+"([^"]+)"/g)) if (match[1]) found.push(match[1]);
  return found;
}

describe("engine boundaries", () => {
  it("scans the real set of engine files", () => {
    // Guards the guard: if the walk ever stops finding files, the tests below
    // would pass against an empty list.
    expect(FILES.length).toBeGreaterThanOrEqual(10);
    expect(FILES.some((f) => f.endsWith(path.join("templates", "project.ts")))).toBe(true);
  });

  it("imports nothing but zod, its own files and generated data", () => {
    const allowed = /^(zod$|\.)/; // relative paths, plus zod
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const specifier of specifiers(readFileSync(file, "utf8"))) {
        if (!allowed.test(specifier)) offenders.push(`${path.relative(ENGINE, file)} → ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("touches no DOM and no storage global", () => {
    const globals = /\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame)\s*\./g;
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      for (const match of code.matchAll(globals))
        offenders.push(`${path.relative(ENGINE, file)} → ${match[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the preset registry out of the barrel, and out of the boot chunk", () => {
    // `engine/index.ts` is what the editor imports. If it re-exported
    // `./templates`, every surface that wants one block type would drag all
    // twelve presets and the brand table into the entry chunk, and no amount of
    // `React.lazy` in the UI could get it back out.
    expect("TEMPLATES" in engine).toBe(false);
    expect("blocksFromTemplate" in engine).toBe(false);
    expect(readFileSync(path.join(ENGINE, "index.ts"), "utf8")).not.toMatch(/export \* from "\.\/templates"/);
    // …while the parts the editor does need stay reachable through it.
    expect("compileDocument" in engine).toBe(true);
    expect("DocumentSchema" in engine).toBe(true);
  });

  it("keeps the preset modules importable from outside React", () => {
    const templates = path.join(ENGINE, "templates");
    const offenders: string[] = [];
    for (const file of sourceFiles(templates)) {
      const code = readFileSync(file, "utf8");
      if (/from "@\/(ui|store|lib)/.test(code)) offenders.push(`${path.basename(file)} imports app code`);
      // Importing a `.md` file would be the "templates are Markdown files"
      // shortcut this layout exists to prevent. (Bodies inside a block *are*
      // Markdown source — that part is by design; it never bypasses the
      // block's own escaping.)
      if (/\bfrom\s+"[^"]*\.md"/.test(code)) offenders.push(`${path.basename(file)} imports a .md file`);
    }
    expect(offenders).toEqual([]);
  });
});
