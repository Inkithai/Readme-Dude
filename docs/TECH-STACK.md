# Tech Stack Decision Record

Status: **adopted — Phase 1 built** · Date: 2026-08-28 · Scope: Phases 0–6 of the roadmap (frontend-only)

This document picks the stack for ReadMe Buddy (filed under its earlier name, *ReadMe Studio*) and, more importantly, records *why* — so a
future-you doesn't re-litigate it or silently drift into a worse choice.

All version numbers below were checked against the npm registry on **2026-08-28**, and the core
combination was **installed and built in a scratch project** (React 19 + Vite 8 + Tailwind 4 +
dnd-kit + the full remark/rehype preview pipeline + zustand/zundo + Dexie) — it builds green.
Bundle numbers in [§6](#6-measured-dependency-costs-not-guesses) are real measurements, not folklore.

---

## 0. Status: what Phase 1 actually ships

Phase 1 (the roadmap's “Core README builder”) is implemented, with 107 tests
covering the engine, the store and the mounted shell.

| Roadmap Phase 1 item | Where it lives |
| --- | --- |
| application shell | `src/App.tsx` — three panes on wide viewports, Build/Preview switch below `xl` |
| block sidebar | `src/ui/palette/BlockPalette.tsx` — 12 blocks in 4 groups, click to append or drag to place |
| canvas | `src/ui/canvas/Canvas.tsx` + `BlockCard.tsx` |
| block insertion | `store/document.ts` → `addBlock` / `insertBlock` / `handleDrop` (gap droppables give the index) |
| block deletion | `removeBlock` — selection falls to the neighbouring block |
| block editing | `src/ui/editor/blockEditors.tsx` — one property panel per block |
| block reordering | dnd-kit sortable + `Alt+↑/↓` + per-card buttons (drag is never the only path) |
| duplicate block | `duplicateBlock` (fresh id) + `⌘D` |
| hide/show block | `toggleHidden` (model data, not UI state) + `H` |
| basic undo/redo | zundo `temporal` + `equality`, so selection changes never eat an undo step |
| live preview | `src/ui/preview/MarkdownPreview.tsx` — lazy `react-markdown` + `github-markdown-css` + GFM + alerts + sanitizer |
| 12 initial blocks | `src/engine/schema.ts` — Hero, Heading, Text, Features, Image, Code, Table, Badges, Tech stack, Installation, Usage, License |
| Copy Markdown / Download README.md | `src/ui/shell/Toolbar.tsx` + `src/lib/export.ts` (also `⌘S` = download) |

Built beyond the letter of Phase 1 because the architecture asked for it:

- **Block schema + runtime validation** (`zod`), so autosave/JSON imports can never
  hand the compiler a malformed block — one bad block is dropped and *reported*, not fatal.
- **`Checks` tab** (`engine/validate.ts`): unbalanced fences, stray `</details>`,
  unescaped pipes, unresolvable image paths — the roadmap's Pillar 3, surfaced in-app.
- **Per-block "Markdown" peek**: shows exactly what one block contributes to the export.
- **Golden-file test** (`engine/__tests__/__fixtures__/sample.readme.md`) — the
  regression net for every future compiler change.
- **`.json` export/import** so a document is a file you can commit.

Deliberate deviations from §2, all of them "later, not never":

| Deviation | Why |
| --- | --- |
| `CodeArea` instead of CodeMirror 6 | Phase 1 needs "paste code → correct fence", which `fenceFor()` + `dedent()` already guarantee. CodeMirror is a Phase 2 ergonomics win. |
| own 7-control form kit instead of shadcn/ui + Radix | The Phase 1 surface is small and bespoke; `Segmented` *is* the variant picker. Revisit with dialogs/command palette. |
| CSS grid instead of `react-resizable-panels` | Drag-resizable panes are polish, not capability. |
| `localStorage` autosave, not Dexie | One debounced write-behind key is enough until Phase 6 introduces *projects*; `storage.ts` keeps the swap to IndexedDB to one file. |

Measured result: boot chunk **127.7 kB gzip**, lazy preview engine **180.5 kB gzip** —
the §6 budget (≤ 200 kB on boot) held.

---

## 1. The requirements that actually decide this

Reading the roadmap, six constraints do all the work. Everything else is taste.

| # | Constraint from the roadmap | What it forces |
|---|--- | ---|
| C1 | "A usable **frontend-only** product" (Phase 1), "Still no backend" (Phase 6), "extremely cheap to host" (Phase 10) | Static bundle. No server runtime, no SSR requirement, no API layer. Hosting must be a CDN. |
| C2 | "**Do not start with 30 React components and hard-code everything.**" Build Document Model → Block Schema → Compiler → Renderer first (Phase 0) | The engine must be a **pure, framework-free, testable package** — not logic living inside components. Schema must be validated at runtime (user JSON, imported Markdown, localStorage restore, templates). |
| C3 | "The generated Markdown must remain **valid**" for GFM (Pillar 3) | The compiler must be **string-building you own** (not a generic AST stringifier), and it needs golden-file tests against real GitHub rendering. |
| C4 | "Live **GitHub-style** preview" + "Raw Markdown view" (both 🔴 MVP) | You need a Markdown→DOM renderer with **GitHub's own stylesheet** and GFM/alerts/HTML extensions. Rendering ≠ generating; keep them separate. |
| C5 | Drag & drop, duplicate, hide/show, **undo/redo** (all 🔴 MVP) | Undo/redo is a state-management problem, not a UI problem. Pick state tech that has it *built in*. |
| C6 | Design control: hero variants, feature-card layouts, badge designer, image layouts (Phase 4) | Layout variants are **props on blocks**, so the block props need a *variant* dimension from day one — this is a data-modeling decision, not a library one. |
| C7 | IndexedDB for larger projects, autosave, version history (Phase 6) | A promise-based IndexedDB wrapper, not `localStorage` strings. |

The single most consequential inference from C2: **this is a property-panel application, not a
WYSIWYG document editor.** Users edit *forms* (title, columns, alignment, image URL) and watch a
preview. There is no contenteditable document canvas. That one realization deletes an entire
category of heavyweight dependencies (§4).

---

## 2. Recommended stack

### Core

| Layer | Choice | Version | Why this, briefly |
| --- | --- | --- | --- |
| Language | **TypeScript** (strict) | 5.9.x* | C2 requires a real discriminated union for `Block`. A README's whole product surface is typed data. *7.x exists on npm; pin 5.9 until tooling (Vite plugin, editors) is verified against the native port. |
| UI framework | **React 19** | 19.2.8 | The Markdown-preview ecosystem, the drag-and-drop ecosystem, and shadcn/ui are all deepest in React. Also the ecosystem you're competing with (readme.so) is React, so parity is cheap. |
| Build tool | **Vite 8** (Rolldown) | 8.2.2 | Zero-server output is the whole point (C1). Vite 8 builds to static assets, sub-50 ms HMR, needs Node 20.19+/22.12+. No meta-framework tax. |
| Routing | **none until Phase 6**, then `react-router` 8.3 or TanStack Router 1.170 | — | The MVP is effectively one screen. Use a `?project=` query param and add a router only when the Projects list exists. Avoids 40 lines of config for 2 routes. |
| State | **Zustand** + **zundo** (`temporal`) + **immer** middleware | 5.0.15 / 2.3.0 / 11.1.18 | C5. Undo/redo becomes `useTemporalStore().undo()` instead of a hand-rolled command stack. No boilerplate, no provider tree. |
| Validation / schemas | **Zod** | 4.4.3 | C2 + C3. One schema per block type = runtime validation *and* the type source *and* template/`.json` import safety *and* auto-generated editor fields (§5). |
| Styling | **Tailwind CSS 4** + `@tailwindcss/vite` | 4.3.3 | Utility CSS is the right fit for ~50 small, bespoke layout widgets. v4 needs no PostCSS config. |
| Component primitives | *deferred to Phase 2:* `shadcn/ui` on Radix (4.19 CLI) — Phase 1 ships its own 7-control form kit instead | — | Honest deviation: the Phase 1 surface is ~7 bespoke controls (`Field`, `Segmented`, `ListEditor`, `CodeArea`…), and hand-rolling them was less code than installing + theming Radix. `Segmented` *is* the "layout variant" picker the roadmap needs. Revisit when dialogs/menus/command palette arrive (Phase 10). |
| Drag & drop | **@dnd-kit** (core 6.3.1 / sortable 10.0.0) | see §4 | Reorder canvas + drag-from-palette + keyboard accessibility. |
| Markdown preview | **react-markdown** 10 + **remark-gfm** 4 + **rehype-raw** 7 + **rehype-sanitize** 6 + **rehype-slug** 6 | — | C4. The only well-maintained React pipeline that covers GFM *and* allows `<details>`/HTML safely. |
| GitHub look | **github-markdown-css** 5.9 + **remark-github-blockquote-alert** 2.1 | — | C4. Do not hand-write GitHub's stylesheet; you'd chase them forever and get it subtly wrong. |
| Code highlighting | **rehype-highlight** with a *curated* language subset (§6) | 7.0.2 | Preview-only decoration. Never affects exported Markdown, so ship the smallest credible subset. |
| Markdown parsing (import) | **unified** 11 + **remark-parse** 11 → mdast | — | Phase 5's `Markdown → Block detection` reads the AST, not regexes. |
| Storage | **Dexie** 4.4 (+ `dexie-react-hooks`) | 4.4.5 | C7. IndexedDB with a sane query API, live queries for the Projects list, versioned schema for the version-history feature. |
| Icons | **lucide-react** for UI glyphs; **simple-icons as a *devDependency*** for brand data | 1.35.0 / 16.28 | Revised while building Phase 1: v16 ships `icons/*` as raw `.svg` files (no per-icon JS module) and its barrel exposes 3,453 exports, so consuming it at runtime buys you brand *metadata* you could precompute. `scripts/gen-tech-brands.mjs` extracts `{name, slug, hex}` for ~150 curated techs into `src/data/tech-brands.json` (~12 kB, tree-shaken out of the runtime). Icons *inside the generated README* come from `https://cdn.simpleicons.org/<slug>/<hex>` / shields.io `logo=<slug>` — so the bundle never carries SVG path data at all. |
| Code editor (in blocks) | *deferred to Phase 2:* `CodeMirror 6` via `@uiw/react-codemirror` (4.25.11) — Phase 1 uses a `CodeArea` (mono textarea + Tab-to-indent + dedent) | 4.25.11 | Honest deviation: Phase 1 needs "paste code, get a correct fence", which `CodeArea` + `fenceFor()`/`dedent()` already guarantees. CodeMirror buys line numbers and lint gutters — Phase 2 (engine) territory. Still *not* Monaco (§4). |
| Split panes | *deferred to Phase 2:* `react-resizable-panels` 4.12 — Phase 1 uses a CSS grid shell + a Preview/Build toggle on narrow screens | — | Honest deviation: drag-resizable panes are ergonomics, not capability, and the three-pane grid with a mobile toggle already meets Phase 1's goal. Add it when the editor/preview width ratio actually matters. |
| Micro-animation | **@formkit/auto-animate** 0.10 | — | ~1 kB for insert/remove/reorder feedback in the block list. Cheaper than wiring Motion in. |
| Server state (later) | **@tanstack/react-query** 5.102 | — | Phase 7 only. GitHub API responses are cacheable, refetch-on-revisit data — exactly what Query is for. Not needed for MVP. |
| PWA | **vite-plugin-pwa** (Workbox) | 1.3.0 | Phase 10. |
| Tests | **Vitest** 4.1 + @testing-library/react 16.3 + jsdom 30, **Playwright** 1.62 | — | Vitest for golden-file compiler tests (the highest-value tests in the repo); Playwright for drag-and-drop flows, which jsdom cannot do. |
| Lint/format | **Biome 2.5** *(or* ESLint 10 flat + typescript-eslint 8.68 + Prettier*)* | 2.5.11 | For a solo leisure project Biome is one tool, one config, ~50× faster format+lint. Choose ESLint if/when you need plugin depth (e.g. a11y rules, tailwind class rules). |
| Hosting | **GitHub Pages** or **Cloudflare Pages** / Netlify | — | C1. Static assets, free tier, and GitHub Pages is on-brand. See the `base` caveat in §7. |

### Architecture shape (this matters more than the libraries)

```
src/
  engine/                  ← ZERO React, ZERO DOM. Pure + portable.
    blocks/
      hero.ts              zod schema + defaults + variant enum
      features.ts
      techstack.ts
      ...
      index.ts             Block = discriminated union of the above
    compile/
      to-markdown.ts       block → string, one file per block type
      escape.ts            pipes, backslashes, HTML entities, CRLF, tabs
      validate.ts          lint the output (unclosed fences, orphan <details>, ...)
    parse/                 Phase 5
      from-markdown.ts     mdast → Block[]
    templates/             .ts files that emit Block[], never .md files
  ui/
    editor/                property panels (forms), one per block type
    canvas/                sortable block list, hide/dup/delete controls
    preview/               the react-markdown pipeline, lazy-loaded
    shell/                 three-pane layout, toolbar, command palette (Phase 10)
  store/
    document.ts            zustand + immer + zundo
    projects.ts            Dexie persistence + debounced autosave
```

The rule to enforce with a lint boundary: **nothing in `engine/` may import React.** If you keep
that rule, the Phase 0 note ("build the engine before the UI") is actually true, and you retain the
roadmap's V6 escape route — the same engine can later drive a CLI, a VS Code extension, or a
`README → CHANGELOG/API-docs` document type without touching a component.

---

## 3. Alternatives considered, and why they lost

### Framework

| Option | Verdict |
| --- | --- |
| **React 19** | ✅ Winner. Deepest ecosystem for the two hard parts (Markdown rendering, DnD) plus shadcn/ui. Most AI-assistable and most contributable. |
| **Svelte 5 / SvelteKit** | Runner-up, and honestly better on bundle size and on-boarding-for-a-leisure-project ergonomics. Loses because `react-markdown`/rehype must be hand-bridged, DnD and block-editor options are thin, and you'd write more glue than app. |
| **Vue 3 + Nuxt** | Viable, big Chinese/international ecosystem, but same story: the unified-React renderers are all React-first and you'd use `marked`+`v-html` (sanitization becomes your problem). |
| **SolidJS** | Best perf/size profile of all of them; ecosystem risk for a 12-month solo project is not worth it here. |
| **Vanilla TS + Lit** | Tempting for "frontend only, tiny" purity. Rejected: C5 (undo/redo), C2 (schema-driven forms) and the pane/canvas UI are precisely where a framework saves you weeks. You'd rebuild React badly. |

### Meta-framework / build tool

| Option | Verdict |
| --- | --- |
| **Vite 8 + React (no router at MVP)** | ✅ Winner. The product is a tool; there is nothing to SSR. |
| **Next.js 16** | ✗ for MVP: static export (`output: 'export'`) forbids the App-Router features that justify Next, so you pay the RSC mental model and get a bundler. |
| **Next.js later, for marketing only** | 🟡 Keep as the *documented* answer for the roadmap's "SEO landing pages" (Phase 10) — see the escape hatch below. |
| **Astro (islands)** | 🟡 Actually the best fit *if* you ever split marketing from app: Astro for SEO landing pages + the Vite-built React app embedded as an island. Deferred, not rejected. |
| **Vite + `vite-plugin-prerender`** | ✗ Adds fragility for modest gain; only consider if you refuse a second repo. |

**SEO escape hatch (decision, not a TODO):** keep `docs/` + template gallery + landing pages as
**plain prerendered HTML generated from the same templates** if SEO ever matters. A README
*builder* doesn't need SEO; the *template gallery* does (that's the organic-traffic surface). When
that becomes real work, spin up Astro in `site/` and let it import `src/engine/templates`. Because
templates are engine-level `.ts` files, the marketing site can render real previews with zero
duplicate logic. This is the reason to invest in §2's architecture rule.

### Block editor — the biggest trap in this project

| Option | Verdict |
| --- | --- |
| **No editor library: schema-driven forms + CodeMirror for code blocks** | ✅ Winner. Per C1–C6, users are choosing layouts and filling fields, not writing prose in a canvas. This is also the only way to get "6 hero variants" and "3-col feature cards" as *first-class* controls. |
| **BlockNote (0.54, active, MPL-2.0)** | ✗ Superb Notion-style block editor, but it owns a ProseMirror document schema. Your differentiator is *your* block schema and *your* GFM compiler; adopting theirs means fighting an editor's schema to express `columns: 3` and `alignment: center`, then re-deriving what you already had. It would make you readme.so with extra steps. |
| **TipTap 3 / Lexical / Plate / Slate** | ✗ Same category error, more manually. Revisit *only* if you later want inline editing of README text on the canvas (a genuinely nice V2 feature — then add TipTap for the Text block alone, keeping the engine as source of truth). |
| **Monaco for code blocks** | ✗ Multi-MB and worker-based. CodeMirror 6 is modular and covers line numbers/wrap/lint. |
| **Milkdown / uiw react-markdown-editor-lite (dual-pane MD editor)** | ✗ This is readme.so's model (edit Markdown text beside a preview). Deliberately not the product you're building — you'd be re-implementing the competitor you told yourself not to clone. |

### Drag & drop

| Option | Verdict |
| --- | --- |
| **@dnd-kit** 6.3.1 / sortable 10.0.0 | ✅ Chosen **pragmatically**. Handles both required interactions (reorder in canvas, drag from sidebar palette), has keyboard + screen-reader support out of the box, and there's infinite documentation/AI-familiarity. **Known risk: `core` 6.3.1 was published 2024-12-05 and nothing since**; the React-19 rewrite has been sitting on `-next` tags. It works today and its peer range is `react >=16.8.0`, so it is not *blocked* — it is *stale*. Accepted because it's a leaf dependency behind a 100-line wrapper. |
| **@atlaskit/pragmatic-drag-and-drop** 3.0 | 🟡 The sanctioned successor, actively maintained by Atlassian, and the designated **migration target** if dnd-kit ever breaks on your React minor. Uses native HTML5 DnD → weaker touch support (matters for the roadmap's "responsive UI"). |
| **@hello-pangea/dnd** 18.0 | 🟡 Maintained react-beautiful-dnd fork, React 19-ready, dead simple for a vertical list — if your DnD need never exceeds "reorder blocks in one list," this is the lowest-risk pick. No cross-container/palette support without effort. |
| **Native HTML5 DnD, hand-rolled** | ✗ You'd spend a week on drag-image ghosting and auto-scroll, then discover touch doesn't work. |
| **SortableJS / Muuri** | ✗ DOM-owns-state fights React's rendering; sorting animations that you can't interrupt cleanly. |

### State management

| Option | Verdict |
| --- | --- |
| **Zustand + zundo + immer** | ✅ C5 solved in ~6 lines. History, selective subscriptions, no providers, and the store can be serialized to Dexie as-is. |
| **Redux Toolkit** | ✗ Would work, and its undo examples are fine, but you're a solo author on a leisure project — the ceremony is a tax on your motivation. |
| **Jotai / signals** | 🟡 Good fit for per-field re-render performance. But undo/redo over *document structure* wants one coherent state tree, not an atom graph. |
| **Context + useReducer** | ✗ Undo/redo becomes a data-structure project you'll resent at 23:00. |

### Persistence

| Option | Verdict |
| --- | --- |
| **Dexie (IndexedDB)** | ✅ C7. ~3.2 MB dev artifact, small in prod, versioned schema → "version history" and "autosave" are one table apart. |
| **idb-keyval** | 🟡 Fine if you only ever store one blob per project and skip querying. Cheaper, but the Projects list then needs in-memory filtering. |
| **localStorage** | ✗ 5 MB, synchronous, string-only, and it blocks the main thread on every autosave. The roadmap already says "preferably IndexedDB." It's right. |

### Preview rendering

| Option | Verdict |
| --- | --- |
| **react-markdown + remark/rehype** | ✅ C3/C4. Component-level control (you can override `table`, `img`, `a`, `blockquote` to *measure* GitHub fidelity), and the same `remark-parse` serves Phase 5 import — one AST, two features. |
| **marked / markdown-it + `dangerouslySetInnerHTML`** | 🟡 ~half the bundle, and fine for the "Raw Markdown" view. But you lose per-node React overrides, and you own sanitization (`DOMPurify`) — an avoidable XSS surface for user-pasted Markdown. |
| **MDX (mdx-js)** | ✗ Compiling *user* Markdown into *executable* JS is a footgun you never want to hold. |
| **Shiki 4 for highlighting** | 🟡 Nicer themes, zero runtime cost per render, but async + heavy grammars in-browser. If used: lazy-load, and only for the preview. |
| **highlight.js via rehype-highlight** | ✅ with a **subset** (§6) — synchronous, simple, good enough for decoration. |

---

## 4. Known risks, honestly stated

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **dnd-kit staleness** (no `core` release since Dec 2024) | Broken DnD on a future React minor; it's a MVP-critical feature | Isolate behind `ui/canvas/SortableBlock.tsx`; keep the block-order logic in the store (`moveBlock(from,to)`) so a swap to pragmatic-dnd is a UI-only change. Pin exact versions. |
| **zundo staleness** (last publish Nov 2024) | Undo/redo library rot | It's ~small logic over zustand. Fallback: implement history as `past: Doc[] / future: Doc[]` in your own store — ~40 lines with immer. |
| **`simple-icons` barrel + dynamic `import()` is a trap** | Measured: **dynamic `import("simple-icons")` produced +5.0 MB raw / +2.1 MB gzip** (defeats tree-shaking, pulls all ~3,000 icons) | Never import the barrel at runtime: extract what you need at build time (`scripts/gen-tech-brands.mjs`). Also note v16 has *dropped* several trademarked brands (Java, C#, Azure, S3, Playwright, OpenAI…) — a volatile set to depend on, so keep a small fallback table; shields.io ignores an unknown `logo=` and still renders the badge. |
| **highlight.js full language set** | Measured: **+167 kB raw / +52 kB gzip** for the full set | Register ~12 languages (js, ts, jsx, tsx, json, bash, sh, yml, py, sql, dockerfile, md) via `createLowlight`; lazy-load the rest on demand. |
| **Preview fidelity ≠ export fidelity** | The #1 credibility risk: preview looks right, README looks wrong on GitHub | Treat GitHub as ground truth: (1) a "Raw Markdown" tab always visible, (2) golden-file tests rendered by GitHub's *own* pipeline expectations, (3) an in-app "open a preview gist" escape valve in a later phase. Never let the preview become the spec. |
| **`rehype-raw` + `rehype-sanitize` ordering** | Wrong order = either stripped `<details>` (broken feature) or unsanitized HTML (XSS) | `rehypePlugins={[rehypeRaw, rehypeSanitize, ...]}` — sanitize *after* raw. Extend the default schema with `details/summary/img[align]/a[name]` rather than disabling sanitization. |
| **Rate limits on unauthenticated GitHub API** (Phase 7) | 60 req/h per IP → users hit HTTP 403 fast | Cache aggressively in Dexie by `ETag`; batch via GraphQL when authenticated; degrade to "paste your package.json" fallback. |
| **Tailwind + `github-markdown-css` collision** | Markdown preview styles leak into your toolbar, or Tailwind preflight flattens GitHub's look | Scope `github-markdown-css` to the preview root, and render the preview in an isolated subtree (no Tailwind classes inside `.markdown-body`); or `@layer` it. |
| **GitHub Pages path prefix** | Blank white screen (absolute `/assets` URLs) | `base: process.env.GH_PAGES ? '/<repo>/' : '/'` + `vite-plugin-pwa`'s manifest scope. Use Cloudflare/Netlify if you'd rather not think about it. |

---

## 5. The load-bearing code (what the choices buy you)

One schema per block, then the editor, validation, undo, and persistence mostly fall out.

```ts
// engine/blocks/features.ts
import { z } from "zod";

export const FeaturesLayout = z.enum(["bullets", "cards-2", "cards-3", "icon-text", "numbered"]);
export type FeaturesLayout = z.infer<typeof FeaturesLayout>;   // ← Phase 4 "design control" is just this enum

export const FeaturesBlock = z.object({
  id: z.string(),
  type: z.literal("features"),
  hidden: z.boolean().default(false),                           // ← hide/show is model data, not UI state
  props: z.object({
    title: z.string().min(1),
    layout: FeaturesLayout.default("cards-3"),
    items: z.array(z.object({
      icon: z.string().optional(),                              // lucide name or si-* key
      title: z.string(),
      body: z.string(),
    })).min(1),
  }),
});

// The compiler is a pure function — this is what makes GFM correctness testable.
export function compileFeatures(b: z.infer<typeof FeaturesBlock>): string {
  const { title, layout, items } = b.props;
  if (layout === "bullets") return `## ${title}\n\n${items.map(i => `- **${i.title}** — ${i.body}`).join("\n")}\n`;
  if (layout === "numbered") return `## ${title}\n\n${items.map((i, n) => `${n + 1}. **${i.title}** — ${i.body}`).join("\n")}\n`;
  const perRow = layout === "cards-2" ? 2 : 3;
  // ...GitHub only has tables, so "cards" compile to a padded HTML table or an image row.
  //     escapeCells() in compile/escape.ts keeps `|` and newlines from destroying the table.
}
```

```ts
// store/document.ts — C5 (undo/redo) in a handful of lines
import { create } from "zustand";
import { temporal } from "zundo";
import { immer } from "zustand/middleware/immer";
import { arrayMove } from "@dnd-kit/sortable";
import type { Block } from "../engine/blocks";

type DocState = { blocks: Block[]; selectedId: string | null };
export const useDocument = create<DocState>()(temporal(immer((set) => ({
  blocks: [],
  selectedId: null,
  insert: (block, at) => set(s => { s.blocks.splice(at, 0, block); }),
  move:   (from, to)  => set(s => { s.blocks = arrayMove(s.blocks, from, to); }),
  patch:  (id, props) => set(s => { Object.assign(s.blocks.find(b => b.id === id)!.props, props); }),
  toggleHidden: (id)  => set(s => { const b = s.blocks.find(b => b.id === id); if (b) b.hidden = !b.hidden; }),
}))));
// zundo's `temporal` mutator attaches useDocument.temporal, so the toolbar is just:
//   <button onClick={() => useDocument.temporal.getState().undo()}>↶</button>
//   useDocument.temporal.getState().pastStates.length  → disabled state (v2 calls them
//   pastStates/futureStates, NOT past/future — and it needs `useStore(store.temporal, sel)`
//   to subscribe from a component, because `.temporal` is a StoreApi, not a hook.
//   Also pass `equality` (see below) or every selection change becomes an empty undo step.
// Autosave: subscribe → debounce → write. `pastStates.length` is also your trigger for
// snapshotting "on save" (the roadmap's version-history feature).
```

```tsx
// ui/preview/MarkdownPreview.tsx — C4, and split so the preview never blocks boot
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { createLowlight } from "lowlight";
import js from "highlight.js/lib/languages/javascript";        // curated subset — see §6
import bash from "highlight.js/lib/languages/bash";
const lowlight = createLowlight(); lowlight.registerLanguage("js", js); /* ... */

const schema = {                       // GitHub-allow what matters, sanitize the rest
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames!, "details", "summary", "picture", "source"],
  attributes: { ...defaultSchema.attributes, img: [...(defaultSchema.attributes!.img ?? []), "align", "width"] },
};

export default function MarkdownPreview({ md }: { md: string }) {
  return <div className="markdown-body p-6">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAlert]}
      rehypePlugins={[[rehypeRaw], [rehypeSanitize, schema], [rehypeHighlight, { lowlight }], rehypeSlug]}
      components={{ table: Table, a: Link }}       {/* overrides to fix layout parity with GitHub */}
    >{md}</ReactMarkdown>
  </div>;
}
```

**Verified, and this is the load-bearing fact for Phases 5/7/8:** `api.github.com` sends
`access-control-allow-origin: *`, so importing a public repo's README needs **no backend and no
proxy** — and you get raw Markdown in one request:

```ts
const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
  headers: { Accept: "application/vnd.github.raw" },
});
```

(Sent `HTTP/2 200` + `access-control-allow-origin: *` + `content-type: application/vnd.github.raw`
when tested on 2026-08-28. Prefer this over `raw.githubusercontent.com` for the browser path, and
keep `ETag`/`If-None-Match` for the rate-limit mitigation in §4.)

---

## 6. Measured dependency costs (not guesses)

Production builds of a scratch Vite 8 + React 19 app, per incremental contribution:

| Bundle | raw | gzip |
| --- | --- | --- |
| React 19 + ReactDOM (floor) | 190 kB | 59 kB |
| + `react-markdown` (bare) | 307 kB | 94 kB |
| + `remark-gfm` | 345 kB | 104 kB |
| + `rehype-highlight` (full) | 513 kB | 157 kB |
| + `rehype-raw`, `rehype-sanitize`, `rehype-slug`, alerts, dnd-kit, zustand+zundo+immer, zod, Dexie, simple-icons, lucide, CodeMirror, Tailwind → **everything, one chunk** | **918 kB** | **288 kB** |

Read as: the *framework* is 59 kB gzip, the *preview engine* costs ~155 kB gzip, and the whole
MVP feature set fits in ~288 kB gzip in a single chunk. That's acceptable for a desktop-first tool
and fine for a PWA once cached — but you should not pay it on first paint. Required from day one:

```ts
// 1. The preview is decoration until the user has typed; don't block the editor on it.
const MarkdownPreview = lazy(() => import("./preview/MarkdownPreview"));
// 2. CodeMirror is needed by ~3 block types, not all 14.
const CodeEditor = lazy(() => import("./editor/CodeEditor"));
// 3. Vite 8 = Rolldown, so split explicitly instead of hand-naming vendor chunks:
//    build.rolldownOptions.output.codeSplitting = "advanced" (advancedGroups per package)
// 4. highlight.js: a curated language set beats "all"; re-measure with
//    npx vite-bundle-visualizer after adding anything ≥50 kB.
```

Budget to hold: **≤ 200 kB gzip on the boot chunk**, ≤ 2 s interactive on cold 4G. If a library
pushes you past that, lazy-load it or lose it.

---

## 7. What deliberately does **not** get a dependency

Aligned with roadmap §9 ("What I would NOT build initially"):

- **No auth library** (Clerk/Auth.js/Firebase) — Phase 8 uses GitHub OAuth with a token in
  `sessionStorage` + a device-flow-ish user-supplied PAT. Still no backend, but move to a tiny
  proxy *only* if/when you must hide a client secret. Do not pre-build for it.
- **No i18n** until there's a second language with real users.
- **No form library** (TanStack Form / react-hook-form). Zustand + Zod is already the form engine;
  blocks are small enough that per-field `patch()` beats a form-state abstraction.
- **No Storybook.** The templates *are* the visual test matrix; keep a `/?debug=all-blocks` page.
- **No CSS-in-JS** alongside Tailwind (pick one; Tailwind).
- **No chart/diagram library** (Mermaid is user-supplied code fences, not your dependency).
- **No analytics SDK** at MVP — one `navigator.sendBeacon` shim later, respecting the "no backend"
  spirit and DNT.

---

## 8. Scaffold (what the repo actually has)

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 107 tests: engine, golden fixture, store, mounted-shell integration
npm run typecheck  # tsc -b
npm run lint       # biome check src
npm run build      # → dist/, preview with `npm run preview`
UPDATE_GOLDEN=1 npx vitest run src/engine/__tests__/golden.test.ts   # after an intentional compiler change
node scripts/gen-tech-brands.mjs      # regenerate src/data/tech-brands.json from simple-icons
```

`simple-icons` is a **devDependency** by that last command's design: brand metadata is
extracted at build time, and the README output points at `cdn.simpleicons.org` /
shields.io instead of shipping ~3,000 SVG paths.

## 9. One-line summary

> **React 19 + TypeScript + Vite 8 + Tailwind 4/shadcn, a Zod-schema block engine compiled to
> Markdown by pure functions you own, Zustand+zundo for undo/redo, dnd-kit for reordering,
> react-markdown + github-markdown-css for a faithful preview, Dexie for storage — deployed as a
> static bundle. No backend, no editor library, no meta-framework.**
