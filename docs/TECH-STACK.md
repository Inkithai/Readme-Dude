# Tech Stack Decision Record

Status: **adopted — Phases 1–3 built, Phase 4 in progress** · Date: 2026-08-28 · Scope: Phases 0–6 of the roadmap (frontend-only)

This document picks the stack for ReadMe Buddy (filed under its earlier name, *ReadMe Studio*) and, more importantly, records *why* — so a
future-you doesn't re-litigate it or silently drift into a worse choice.

All version numbers below were checked against the npm registry on **2026-08-28**, and the core
combination was **installed and built in a scratch project** (React 19 + Vite 8 + Tailwind 4 +
dnd-kit + the full remark/rehype preview pipeline + zustand/zundo + Dexie) — it builds green.
Bundle numbers in [§6](#6-measured-dependency-costs-not-guesses) are real measurements, not folklore.

---

## 0. Status: what Phases 1–4 actually ship

Phase 1 (the roadmap's “Core README builder”) and Phase 2 (the “GitHub Markdown
engine”) are implemented, and Phase 3 (templates) is implemented as block compositions
rather than Markdown files. 258 tests cover the engine, the presets, the golden
fixtures, the store, preview fidelity and the mounted shell — plus 17 more that run
against GitHub's own renderer when `GFM_FIDELITY=1` is set. Phase 3 added 62 of them,
Phase 4's two designers 29 more, and Phase 4's fuzz-driven audit 14 more (301 in total).

| Roadmap Phase 1 item | Where it lives |
| --- | --- |
| application shell | `src/App.tsx` — three panes on wide viewports, Build/Preview switch below `xl` |
| block sidebar | `src/ui/palette/BlockPalette.tsx` — 15 blocks in 4 groups, click to append or drag to place |
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

Measured result: boot chunk **135.6 kB gzip** (127.7 after Phase 1, 131.8 after
Phase 2, 133.4 after Phase 3, +2.2 for the Phase 4 designers — they live in the
property panel, which is first-paint), lazy preview engine **180.5 kB gzip**, lazy
template gallery **22.4 kB gzip** — the §6 budget (≤ 200 kB on boot) still held,
because twelve presets were deliberately pushed out of the boot chunk (finding 2
under Phase 3).

### Phase 2 — the GitHub Markdown engine

The roadmap's list (tables, alerts, fences, links, images, `<details>`, task lists,
badges, HTML blocks, escaping, validation) was mostly *present* after Phase 1 and is
now *specified*, which is a different job:

| Item | What landed |
| --- | --- |
| `<details>` | `collapsible` block. The compiler puts a blank line after `</summary>` — without it GitHub shows raw Markdown instead of parsing it. Verified against GitHub's renderer, including a fenced block inside `<details>`. |
| task lists | `checklist` block, three marker styles (`- [ ]`, `[■]`, `(●)`) and an optional progress line. Notes ride inline so the list stays tight. |
| links / buttons | `links` block: pills and big buttons as shields.io images inside `<a>`, or pure-Markdown list/inline. Centring needs HTML, so `list`/`inline` are left-aligned on purpose — that tradeoff is a comment in `compileLinks`, not a bug. |
| escaping | `escapeInlineMarkdown()` + the label-vs-body contract (§0 above). `_` and `[…]()` are deliberately not escaped; the reasoning is in the function's comment. |
| URLs | `sanitizeUrl` now strips control characters before the scheme test (`java\0script:` no longer slips past), allow-lists `http/https/mailto/tel`, and drops `data:` because GitHub's camo proxy refuses it. |
| validation | ten rules added across Phase 2 and the audit: `url-dropped`, `link-without-url` (links *and* hero buttons), `unknown-alert-type`, `details-swallow`, `duplicate-anchor`, `heading-skip`, `empty-link-target`, `unbalanced-strong`, `table-cells-dropped`, plus the “not a document” rejection in `engine/io.ts`. |
| fidelity | `fidelity-rules.ts` — one set of assertions, run against **our preview** and against **GitHub's renderer** (`/api.github.com/markdown`). |

Two findings worth keeping, because both are the kind that hides:

1. **The preview was lying about alerts.** `hast-util-sanitize`'s default schema allows
   `className` on `code` only, so `<div class="markdown-alert markdown-alert-warning">`
   lost its class and the octicon `<svg>` was dropped entirely: alerts rendered as a bare
   blockquote in the pane that exists to show “this is what GitHub will look like”.
   Fixed in `MarkdownPreview.tsx` (allow `className` on `div`/`blockquote`, allow
   `svg`/`path`). No compiler test could have caught this — only a test that renders.
2. **Rules must match the tag, not the spelling.** GitHub emits
   `<pre class="notranslate">` inside `<div class="highlight highlight-source-shell">`
   and `<code class="notranslate">`, where react-markdown emits `<pre>` and
   `style="text-align: center"` instead of `align="center"`. Asserting one renderer's
   attribute shape makes the other one fail for no reason, so the shared rules use
   `hasTag` / `textIn` helpers.

The oracle is opt-in rather than always-on: CI should not need the network, GitHub's
unauthenticated limit is per IP, and behind a TLS-terminating proxy Node needs
`NODE_EXTRA_CA_CERTS`. A request that cannot be made **skips**; it does not fail red,
because a red network test in a locked-down sandbox trains everyone to ignore the suite.

### Audit — what a bug hunt found after Phase 2


Nine real bugs, each with a test that used to pass. Ordered by how badly they failed:

| bug | why it hid | the test |
| --- | --- | --- |
| **Importing `package.json` erased the document.** `parseDocument` treated “no `blocks` key” as “zero blocks”, and `importJson` only refused when an *error* had been recorded — so a valid object with no blocks was a success that replaced the user's work with nothing. | the permissive-by-block loader was designed to never reject a file; it needed to reject *non-documents* | `store-dom` → “refuses a JSON file that is not a document” |
| **Autosave reported “saved” after the write threw.** `storage.set` swallowed quota/private-mode errors and returned nothing, so the status pill turned green on an empty localStorage. | the swallow was correct for the app and wrong for the caller: the boolean had to come back up | `store-dom` → “does not claim the document was saved” |
| **`useVisibleBlocks` / `useHistoryDepth` were render-loop landmines.** A selector that returns a fresh array/object makes `useSyncExternalStore` compare unequal snapshots forever → “Maximum update depth exceeded”. Both were unused, so nothing had tripped them yet. | only visible once React is in the room; the store suite runs in node | `store-dom` → “do not send React into a render loop” |
| **13 of 15 block types threw** on a missing prop, turning the user's section into `<!-- could not compile -->`. Now the escape helpers are total (see `engine/escape.ts` header) and the item loops guard too — which is what Phase 3's hand-authored templates and the Markdown importer need. | `createBlock` and JSON import both run through Zod, so app-authored documents never have holes; `patchProps`, `insertBlock` and `replaceBlocks` do not re-validate | `engine/__tests__/robustness.test.ts` |
| **A code fence could be closed by its own content.** `fenceFor` grew for backticks but emitted a fixed `~~~~~`, so a body with ≥5 tildes broke out and the rest of the README turned into prose. | only reachable with both markers in one sample | “always outgrows the body for the marker it actually chose” |
| **Hero buttons with a rejected URL rendered `<a href="">`.** Verified on GitHub: a clickable nothing wrapped around the badge. `links` already dropped them; hero did not. | the two blocks had drifted apart | “drops a hero button whose URL was refused” |
| **`⌘⌫` / `⌥⌫` deleted the selected block, `⌘H` hid it.** macOS uses those for delete-to-line-start and delete-word. | no test ever pressed a modified key | “ignores destructive shortcuts that carry a modifier” |
| **Copy failure was silent.** `copyToClipboard` returns a boolean and both call sites ignored the false, so a blocked clipboard looked like a successful copy. | the fallback path (`execCommand`) doesn't exist in jsdom, so nothing exercised it | “says so when the clipboard refuses the copy” |
| **The Markdown tab rendered `# empty README` as the document.** A select-all there shipped a fake line; and an `escapeTableCell` newline rule put a stray `<br>` at the head of a cell. | the tab's job is to show the *bytes* — a placeholder belongs outside the `<pre>` | “shows an honest empty state” |

Two near-misses worth recording, because the fix looked obvious and was wrong:
`sanitizeUrl` does **not** need to encode `(` `)` (markdown-it balances parens — `[x](https://en.wikipedia.org/wiki/Foo_(bar))` resolves correctly on GitHub), and
relative image paths that walk up a directory (`../docs/img.png`) **are** reachable, so
`isProbablyImageUrl` was widened instead of the new error being kept. Both were settled by
asking GitHub's renderer rather than reasoning about it.

### Phase 3 — presets, as block compositions

The roadmap's one hard requirement here is the shape, not the count:
`Template → Block configuration → Builder`, “not just Markdown files”. So
`src/engine/templates/` emits `Block[]`, there is no `.md` file in the directory, and a
preset enters the app through the same door a hand-built block does.

| Item | What landed |
| --- | --- |
| 12 presets | 8 project — Minimal, Professional, Open Source, SaaS, CLI, Library, HTTP API, AI/ML — and 4 profile: Developer, Full, Minimal, Portfolio. `templates/project.ts`, `templates/profile.ts`. |
| authoring kit | `templates/build.ts`: `tpl()` merges props onto `createBlock` defaults, and `badge()` / `socialBadge()` / `cardRow()` / `brand()` / `brandGroup()` build the repetitive nested props. Twelve presets written as raw object literals would have been a typo factory; the helpers are what make the content reviewable. |
| registry | `templates/index.ts`: `TEMPLATES`, `TEMPLATES_BY_ID`, `getTemplate`, `templatesForKind`, `blocksFromTemplate` (re-`identify`s, so applying a preset twice never collides on ids), `previewTemplate`. Pure data + functions — the gallery and the roadmap's prerendered marketing site read the same module. |
| document kind | `DocumentSchema.kind: "project" \| "profile"`, default `project`, version still **1**. A profile README is a different *document*, not a template family: it is what lets `no-examples` stay a project rule instead of being loosened for everyone, and it gives the profile presets their own two info-level checks. Legacy `.json` without `kind` still loads. |
| applying | `store/document.ts` → `applyTemplate(template, "replace" \| "append")`: blocks, document name and kind change in one transition, so a single ⌘Z undoes the whole thing; `replaceBlocks` grew a third argument rather than growing a second action. |
| gallery | `src/ui/palette/TemplateGallery.tsx`, behind a Blocks/Templates rail tab: family filter, section chips, “what you get”, and a `<details>` peek at the Markdown — produced by the real `compileDocument`, not a screenshot of it, so it cannot drift. |
| tests | `engine/__tests__/templates.test.ts` (budgets, every preset parses through `BlockSchema`, every prop key exists on its block, every brand resolves in `tech-brands.json`, every preset compiles to **zero** validation issues, factory purity, 2 goldens), `store/__tests__/templates.test.ts`, `ui/__tests__/templates.test.tsx`, `engine/__tests__/boundary.test.ts`. |

Four findings worth keeping:

1. **The validator was reading fenced code as document structure.** `professional-project`
   put a `# comment` line inside an `ini` block (`.env.example`) and got a
   `heading-skip` error; the same class of bug produced a `duplicate-anchor` from a heading
   written inside an HTML comment and a `table-column-mismatch` from two tables bucketed
   together across everything between them. `validate.ts` now routes every whole-document
   rule through `proseLines()`, which drops fenced regions once, up front; the rules that
   *want* raw text (`unbalanced-fence`, `no-examples`) read it on purpose. This is the
   Phase 4 importer's bug too, fixed before it arrives.
2. **Presets are content, and content belongs in a lazy chunk.** Re-exporting `./templates`
   from `engine/index.ts` cost **+22.6 kB gzip on the boot chunk** (131.8 → 154.4): the
   barrel is imported by everything, and a module-scope `Map` in the registry made the
   presets unshakable, so `React.lazy` in the UI alone recovered nothing. Not re-exporting
   them (import `engine/templates` directly), lazily mounting the gallery, and letting the
   store hold only the `Template` *type* brings boot back to 133.4 kB with the presets in a
   22.4 kB chunk fetched on click. `boundary.test.ts` pins all three decisions, because the
   regression is invisible in the app and visible only in a build log.
3. **Preset identity is placeholders, on purpose.** Every profile stat, streak, trophy and
   graph URL points at `your-username`, and projects at `your-org/your-repo` /
   `*.acme.dev`. A preset that shipped someone else's real star count would read as the
   user's own the moment it was applied; a fake number in a template is a defect, not polish.
4. **A brand name that is not in `src/data/tech-brands.json` silently loses its icon.**
   `brand()` degrades to a plain shields.io badge by design, so `Prometheus`, `Grafana` and
   `SQL` — all tempting for these presets, none of them in the generated table — would have
   shipped as unexplained ugliness. `templates.test.ts` now asserts every tech-stack and
   logo name resolves, which turns “check 151 names by eye” into a one-line expectation.

### Phase 4 (started) — the designers, beginning with layout

Two of the five designers, chosen because they are where `src/engine/` had to change
rather than only the panel JSX. The point of the phase is the promise in §2: a block
carries its *presentation* in its props, so a designer is a control surface, not a
second rendering path.

| Item | What landed |
| --- | --- |
| `image` block | Now a layout block: `layout: single \| columns \| gallery \| split` × `columns: 2 \| 3`, `items: { url, alt, caption, link }[]`, and `text` for the side-by-side form. Rows emit `<table>` cells at your pixel width, galleries at `width="100%"`, `split` a 55/45 table with `valign="top"`. Reuses the exact HTML pattern `features` cards already established, so the sanitizer allow-list and the fidelity rules did not have to grow. |
| `hero` block | `imageUrl` / `imageWidth` / `imageAlt` — a banner between tagline and buttons, inside the `<div align>` wrapper so it centres itself. |
| Layout pickers | `src/ui/designer/kit.tsx`. Thumbnails drawn with divs, not images or icon fonts: a picture of a layout goes stale the moment the compiler changes, and the div version renders offline, in jsdom and in a prerendered marketing page. `ImageThumb` moved here from `blockEditors` and is now shared by hero, screenshot and links. |
| Degrade rules | A half-filled block never loses the half that is filled: `split` with no image renders the prose, `split` with no prose renders the image, `single` with an empty `url` falls back to the first item. Once `items` exists it is *authoritative* — a row may not show an image the panel does not list. |
| Checks | New `image-no-source` warning for a Screenshot block that compiles to nothing, using the same precedence as the compiler, so the two can never disagree about whether anything was drawn. |
| Legacy data | No migration: `layout`/`columns`/`items` all default, so a Phase 1–2 `.json` still opens as a centred single image. `url` stopped being `.min(1)` (also for item URLs) — an in-progress image must not invalidate the block, or the document refuses to reload with one empty slot in it. |
| a11y | `Segmented`'s `aria-labelledby` pointed at an id that was never rendered on the label `<span>`: every segmented group in the app was an *unnamed* radiogroup. Fixed in `Fields.tsx`; `LayoutPicker` got the same association from the start. |

Test note worth repeating: `validateDocument` short-circuits with `empty-document` when
the Markdown is empty, so a test for "this block renders nothing" must put the block
beside another one — otherwise it asserts the document-level error and learns nothing.


### Audit — what a fuzz pass found after Phase 4

The Phase 2 audit was hand-written: nine bugs, each with a test. This one started from the
same list of suspects and then stopped trusting it — `engine/__tests__/invariants.test.ts`
walks **every field of every block** and replaces it with junk (`null`, `"junk"`, `{}`,
`[]`, `999999`, `NaN`, an `<img onerror>` payload, a 400-char string, an odd number of
backticks), ~700 blocks in total, asserting five properties. Half the findings below were
not on the suspect list; they are the ones the fuzz turned up on the first run.

| bug | why it hid | the test |
| --- | --- | --- |
| **One malformed block took the whole preview pane down.** `validate.ts` read `block.props.items`, `.steps`, `.columns` directly; a `props: null` or `items: {}` threw out of `validateDocument`, which runs on every render. | the validator was only ever fed zod-clean blocks, and the per-block *compiler* hardening from the last audit never covered the checker that reports on it | `invariants` + `robustness` → "survives props that are not an object at all" |
| **The compiler's totality contract had a hole exactly one level up.** `withProps` cast `block.props` and used it, so all fifteen blocks threw on a non-object `props` — the guard comment back in place of the user's section. | the last audit hardened *missing keys* (`p.foo` undefined), not a missing *object* | same |
| **`patchProps` stranded a broken block.** `Object.assign(block.props, patch)` threw when `props` was not an object, so the one action that could repair a malformed block was the one that failed. | an onClick that throws looks like a dead button, not a data bug | `store` → "recovers a block whose props are not an object when it is edited" |
| **`sanitizeUrl` encoded `"` but not `<`, `>` or a backtick**, so junk reached the exported README as `href="%22><img…>"` — inert under HTML5, and a problem for every tool after us, including our own `rehype-raw` pass. | the scheme test was the interesting part, so the encoding tail was never revisited | `escape` → "encodes the characters that could open markup inside an attribute" |
| **The preview lied about the split layout**: `valign` was not in the sanitizer's allow-list for `td`, so text sat mid-cell in the pane whose job is to show what github.com will do. | the same failure mode as the alert bug two audits ago, and no compiler test could see it | `designers` → "image + text puts the prose in the second cell"; `FIDELITY_CASES` now pins all three screenshot layouts against **both** renderers |
| **`hero.logoWidth` was emitted raw**: `width="${Number(p.logoWidth) \|\| 96}"`, so the slider's max and the schema's `max(1000)` were suggestions — a hand-edited `99999` shipped a README with a 99999-pixel logo. | every *other* width in the engine was clamped, which is how the invariant caught this one by contrast | `screenshots` → "clamps a logo width the way it clamps every other number" |
| **Deleting the last image in a row silently resurrected the block-level one.** The compiler falls back to `url` while `items` is empty (that is what makes switching layout mid-edit safe), but the panel had no field for it: an empty list above a picture you could neither see nor remove. | a degrade path that is correct in the engine and misleading in the UI | `designers` → "keeps the block image reachable while a row has no items" |

Two things about the method, because they are why it found anything:

1. **Assert the breakout condition, not the scary substring.** The first draft banned
   `onerror` from any output and failed on a percent-encoded URL that merely *spells* it —
   theatre, not a safety property. What matters is "a field may not put a quote or an angle
   bracket inside an attribute value", and that holds for every block.
2. **Only the rules that can only be our fault.** Junk mutations paste half-written Markdown
   into body fields on purpose, so `table-cells-dropped` and `img-not-self-closed` fire
   correctly on *user* content. The invariant asserts the structural set — unbalanced tags,
   fences, `<details>` swallowing the document — where a failure is always the compiler's.

The oracle ran here, once: `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
GFM_FIDELITY=1 npx vitest run src/engine/__tests__/github-fidelity.test.ts` → 17 rules green
against GitHub's renderer. Node's own TLS store rejects the sandbox's intercepting
certificate while `curl` accepts it, which is how the missing `valign` was *confirmed*
instead of argued about.

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
| C6 | Design control: hero variants, feature-card layouts, badge designer, image layouts (Phase 4) | Layout variants are **props on blocks**, so the block props need a *variant* dimension from day one — this is a data-modeling decision, not a library one. Held up in Phase 4: adding four screenshot arrangements and a hero banner was `schema` + `compile` + a panel, and the compiler's per-block `try/catch` contract meant nothing else had to know. |
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
    templates/             ✅ built in Phase 3: .ts files that emit Block[], never .md
                           (types/build/project/profile/index — imported as engine/templates,
                            NOT re-exported from engine/index.ts; see Phase 3 finding 2)
  ui/
    editor/                property panels (forms), one per block type
    canvas/                sortable block list, hide/dup/delete controls
    designer/              Phase 4: the layout pickers and live thumbs shared by every
                           property panel (CSS-drawn thumbnails, no image requests)
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

And the boot chunk's actual history, measured with `npm run build` per phase (the phase's own
number vs. a worktree of the commit before it, so the delta is honest):

| After | boot chunk, gzip | what moved it |
| --- | --- | --- |
| Phase 1 | 127.7 kB | shell, palette, editor, store, compiler |
| Phase 2 | 131.8 kB | sanitizer allow-lists, alert + table rules, the validator |
| Phase 3 | **133.4 kB** | `kind`, the rail tab — and *nothing else*, on purpose. Twelve presets plus the brand table are **22.4 kB gzip** that live in a lazy `TemplateGallery` chunk; importing them through `engine/index.ts` put the boot chunk at 154.4 kB and no amount of `React.lazy` downstream got it back (Phase 3, finding 2). |

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
  Phase 3 shipped that matrix: twelve presets × fifteen block types, each compiled and run through
  `validateDocument` in `engine/__tests__/templates.test.ts`, and the gallery is its human-facing
  half. A preset that renders badly is a failing test, not a design review.
- **No CSS-in-JS** alongside Tailwind (pick one; Tailwind).
- **No chart/diagram library** (Mermaid is user-supplied code fences, not your dependency).
- **No analytics SDK** at MVP — one `navigator.sendBeacon` shim later, respecting the "no backend"
  spirit and DNT.

---

## 8. Scaffold (what the repo actually has)

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 196 tests: engine, golden fixture, store, preview fidelity, shell
GFM_FIDELITY=1 npx vitest run src/engine/__tests__/github-fidelity.test.ts
                   # +14 tests against GitHub's own renderer (needs network; behind a TLS
                   #   proxy add NODE_EXTRA_CA_CERTS=/path/to/proxy-ca.crt)
UPDATE_GOLDEN=1 npx vitest run src/engine/__tests__/golden.test.ts
                   # re-baseline the compiled README after an intentional compiler change
npm run typecheck  # tsc -b
npm run lint       # biome check src scripts
npm run build      # → dist/, preview with `npm run preview`
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
