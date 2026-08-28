import { badge, brandGroup, socialBadge, tpl } from "./build";
import type { Template } from "./types";

/* ------------------------------------------------------------------ *
 * engine/templates/project.ts — the eight project presets.
 *
 * Ordered from least to most scaffolding, so the gallery's first cards are
 * the ones most people actually want. Each preset is written the way a good
 * README is read: what it is → why you should care → how to start → how to
 * help.
 *
 * The copy is intentionally specific. "Lorem ipsum" and "Description here" is
 * how template galleries advertise themselves as filler; a preset that reads
 * like a real project is the thing that makes someone keep it. Placeholder
 * domains are `your-org/your-repo` and `*.acme.dev` so a wrong URL is always
 * obviously the author's job, never the preset's.
 * ------------------------------------------------------------------ */

const REPO = "https://github.com/your-org/your-repo";

export const PROJECT_TEMPLATES: Template[] = [
  {
    id: "minimal-project",
    label: "Minimal project",
    kind: "project",
    docName: "minimal-project",
    blurb: "Five sections. Enough for a weekend tool nobody has to evaluate.",
    notes: [
      "Replace the description with the problem you removed, not the stack you used.",
      "The code block is the whole contract: make the command copy-pasteable as it is.",
      "Add a screenshot the moment one exists — it does more than any paragraph here.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "",
        title: "your-repo",
        subtitle:
          "Turn `npx create-thing` into one command: no config file, no boilerplate folder, no opinionated linter.",
        buttons: [],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "**Why this exists** — I kept writing the same 40 lines of setup in every new repo, so I deleted them. " +
          "This does one job: scaffold the minimum a project needs to run, then get out of the way.\n\n" +
          "It is deliberately small. If you need plugins, this is the wrong tool — " +
          "[here is the one I recommend instead](https://example.com/alternative).",
      }),
      tpl("code", {
        language: "bash",
        filename: "",
        body: "npx your-repo my-app\ncd my-app\nnpm run dev",
      }),
      tpl("text", {
        variant: "alert",
        alertType: "NOTE",
        body:
          "Everything is one file on purpose. Read it before you file a feature request: " +
          `[src/index.ts](${REPO}/blob/main/src/index.ts).`,
      }),
      tpl("license", {
        notice: "Free to use, copy and fork. See `LICENSE` for the boring part.",
        url: `${REPO}/blob/main/LICENSE`,
        author: "your-name",
      }),
    ],
  },

  {
    id: "professional-project",
    label: "Professional project",
    kind: "project",
    docName: "acme-platform",
    blurb: "The full shape: pitch, proof, install, API, roadmap, license.",
    notes: [
      "Swap the placeholder logo and screenshot for real ones — those two images are the first thing read.",
      "Keep the badge row honest: every badge here needs a repository it can actually read.",
      "The architecture collapsible is the section a serious reviewer opens; write it in prose, not bullets.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/96x96/png?text=Logo",
        title: "Acme Platform",
        subtitle:
          "Typed, observable job processing for TypeScript teams. **One worker binary**, Postgres as the only " +
          "dependency, and a dashboard you can self-host in five minutes.",
        buttons: [
          { label: "Get started", url: "https://acme.dev/docs" },
          { label: "Live demo", url: "https://demo.acme.dev" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge(
            "npm",
            { label: "npm", message: "v2.4.1", color: "CB3837", style: "flat-square" },
            "https://www.npmjs.com/package/@acme/platform",
          ),
          badge(
            "build",
            { label: "build", message: "passing", color: "4c1", style: "flat-square" },
            `${REPO}/actions`,
          ),
          badge("coverage", { label: "coverage", message: "96%", color: "blue", style: "flat-square" }),
          badge(
            "license",
            { label: "license", message: "MIT", color: "green", style: "flat-square" },
            `${REPO}/blob/main/LICENSE`,
          ),
        ],
      }),
      tpl("image", {
        url: "https://placehold.co/960x540/png?text=Dashboard",
        alt: "Acme Platform dashboard showing a drained queue",
        width: 960,
        caption:
          "Every run has a trace, a retry button and an audit line. Nothing is hidden behind a paid tier.",
        linkUrl: "https://demo.acme.dev",
      }),
      tpl("features", {
        title: "What you get",
        layout: "cards-3",
        items: [
          {
            icon: "🧵",
            title: "Durable jobs",
            body: "Retries with jittered backoff, idempotency keys, and a dead-letter queue you can drain from the CLI.",
          },
          {
            icon: "📦",
            title: "One binary",
            body: "`acme-worker` runs the queue, the scheduler and the dashboard. No Redis, no sidecar, no Helm chart.",
          },
          {
            icon: "🔍",
            title: "Read-only by default",
            body: "The dashboard shows spans and payloads; writing needs a scope you have to ask for.",
          },
          {
            icon: "🧯",
            title: "Backpressure",
            body: "Per-queue concurrency, rate limits, and a stall detector that pages before a queue is an hour deep.",
          },
          {
            icon: "🔌",
            title: "Typed handlers",
            body: "Payload types inferred from one Zod schema, so the compiler catches producer/consumer drift.",
          },
          {
            icon: "🪪",
            title: "Boring auth",
            body: "Session cookies, scoped API tokens, OIDC if you already have an IdP.",
          },
        ],
      }),
      tpl("techstack", {
        title: "Tech stack",
        variant: "grouped",
        style: "flat",
        groups: [
          brandGroup("Runtime", ["TypeScript", "Node.js", "Bun", "PostgreSQL"]),
          brandGroup("Build & QA", ["Vite", "Vitest", "Playwright", "Docker"]),
          brandGroup("Deploy", ["Fly.io", "Terraform", "GitHub Actions"]),
        ],
      }),
      tpl("installation", {
        title: "Installation",
        intro: "You need Node 20+ and a Postgres 15+ database. The CLI runs the migrations for you.",
        steps: [
          {
            title: "Install the package",
            body: "",
            language: "bash",
            code: "npm i @acme/platform\nnpm i -D @acme/cli",
          },
          {
            title: "Point it at your database",
            body: "`DATABASE_URL` comes from the environment — there is no config file to keep in sync.",
            language: "bash",
            code: "cp node_modules/@acme/platform/.env.example .env",
          },
          {
            title: "Start the worker and the dashboard",
            body: "",
            language: "bash",
            code: "npx acme migrate && npx acme dev --dashboard",
          },
        ],
      }),
      tpl("usage", {
        title: "Usage",
        intro:
          "One schema, two sides: the producer and the consumer share types, so a rename cannot ship half-done.",
        examples: [
          {
            title: "Define a queue and a handler",
            body: "`emails.ts` declares the contract; `worker.ts` is the only place that implements it.",
            language: "typescript",
            code:
              'import { defineQueue, z } from "@acme/platform";\n\n' +
              "export const welcome = defineQueue({\n" +
              '  name: "welcome",\n' +
              "  payload: z.object({ userId: z.string(), locale: z.string() }),\n" +
              "  attempts: 5,\n" +
              "});\n\n" +
              "welcome.handle(async ({ payload }, ctx) => {\n" +
              "  await mailer.send(payload, { signal: ctx.signal });\n" +
              "});",
          },
          {
            title: "Enqueue it from your app",
            body: "",
            language: "typescript",
            code: "await welcome.enqueue({ userId: user.id, locale: user.locale }, { dedupe: user.id });",
          },
        ],
      }),
      tpl("heading", {
        level: 3,
        emoji: "🧾",
        text: "Environment variables",
      }),
      tpl("code", {
        language: "ini",
        filename: ".env.example",
        body:
          "# Everything here also has a sane default; nothing is required except the URL.\n" +
          "DATABASE_URL=postgres://localhost:5432/acme\n" +
          "ACME_NAMESPACE=default\n" +
          "ACME_MAX_CONCURRENCY=16        # per queue\n" +
          "ACME_STALL_AFTER=5m           # page when a queue makes no progress\n" +
          "ACME_DASHBOARD_READONLY=true  # the safe setting for a shared deploy",
      }),
      tpl("table", {
        title: "Roadmap",
        columns: ["Shipped", "Next", "Not planned"],
        rows: [
          ["Durable retries + DLQ", "Priority queues", "A hosted control plane"],
          ["Trace view for runs", "Terraform module", "Multi-tenant auth"],
          ["Scoped API tokens", "Metrics exporter (OTLP)", "A React client library"],
        ],
        alignment: ["left", "left", "left"],
      }),
      tpl("collapsible", {
        icon: "🧠",
        summary: "Architecture notes — why Postgres and not Redis",
        body:
          "A job queue needs exactly three things from storage: atomic claims, a `SKIP LOCKED` read, and " +
          "durability you back up with the rest of your data. Postgres gives you all three and your team " +
          "already runs it.\n\n" +
          "Redis is faster per claim and slower per operation that matters here (a 10k fan-out, a replay). At " +
          "the throughput we measured — 12k jobs/s on a 4 vCPU box — the second-order wins were not worth a " +
          "second system to back up, secure and page about.\n\n" +
          "| Workload | p50 claim | 4 vCPU ceiling |\n| --- | --- | --- |\n| single queue | 0.4 ms | 12k/s |\n| 64 queues | 0.7 ms | 8k/s |",
      }),
      tpl("checklist", {
        title: "Contributing",
        style: "task",
        items: [
          { text: "`npm run lint && npm test` are green", done: false, note: "" },
          { text: "Anything touching the public API ships a changeset", done: false, note: "" },
          { text: "Docs in `docs/` updated in the same PR", done: false, note: "" },
          {
            text: "Squashed to one commit with a conventional title",
            done: false,
            note: "the changelog is generated from it",
          },
        ],
      }),
      tpl("links", {
        title: "Where to go next",
        style: "list",
        align: "left",
        items: [
          {
            label: "Tutorial: a 20-minute background job",
            url: "https://acme.dev/docs/tutorial",
            icon: "🎯",
            description: "the fastest way to judge this",
          },
          {
            label: "Self-hosting guide",
            url: "https://acme.dev/docs/self-host",
            icon: "🏠",
            description: "Docker Compose and Fly templates",
          },
          { label: "Report a bug", url: `${REPO}/issues/new`, icon: "🐞", description: "" },
          {
            label: "Discussions",
            url: `${REPO}/discussions`,
            icon: "💬",
            description: "questions go here, not in issues",
          },
        ],
      }),
      tpl("license", {
        notice: "Released under the MIT License, `${year}` `${author}`.",
        url: `${REPO}/blob/main/LICENSE`,
        author: "Acme, Inc.",
      }),
    ],
  },

  {
    id: "open-source-project",
    label: "Open source project",
    kind: "project",
    docName: "oss-toolkit",
    blurb: "Written to recruit contributors: status, first issues, PR rules, governance.",
    notes: [
      "These badges read your repository — replace `your-org/your-repo` and they go live.",
      "The 'good first issue' note is the highest-yield line in an OSS README; keep it, and keep the label real.",
      "A PR checklist is community management in disguise. Write it like a person, not like a policy.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        title: "oss-toolkit",
        subtitle: "Small, composable helpers for GitHub Actions maintainers. **MIT, no telemetry, no CLA.**",
        buttons: [
          {
            label: "Good first issues",
            url: `${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`,
          },
          { label: "Discussions", url: `${REPO}/discussions` },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge(
            "release",
            { label: "release", message: "v1.8.0", color: "2ea44f", style: "flat-square" },
            `${REPO}/releases`,
          ),
          badge(
            "license",
            { label: "license", message: "MIT", color: "blue", style: "flat-square" },
            `${REPO}/blob/main/LICENSE`,
          ),
          badge(
            "build",
            { message: "build passing", color: "4c1", style: "flat-square" },
            `${REPO}/actions/workflows/ci.yml`,
          ),
          badge("PRs", { message: "PRs welcome", color: "yellowgreen", style: "flat-square" }),
          socialBadge("github", "star", REPO),
        ],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "**The problem.** Every Actions repo grows the same 300 lines of YAML duct tape: matrix guards, " +
          "artifact paths, permission blocks. We extracted ours.\n\n" +
          "**The deal.** This repo stays small and boring on purpose: twelve helpers, no plugin system, no " +
          "release train you have to follow. Breaking changes get one minor version of deprecation, announced " +
          `in the [release notes](${REPO}/releases).`,
      }),
      tpl("features", {
        title: "Why maintainers switch",
        layout: "numbered",
        items: [
          {
            icon: "",
            title: "Drop-in composites",
            body: `\`uses: your-org/your-repo/.github/actions/setup@v1\` — no rewrite of the rest of your workflow.`,
          },
          {
            icon: "",
            title: "Least-privilege defaults",
            body: "Every helper declares `permissions:`, so Dependabot cannot quietly widen them.",
          },
          {
            icon: "",
            title: "Pinned by SHA, tagged for humans",
            body: "The docs show the tag; the action metadata pins the commit.",
          },
          {
            icon: "",
            title: "Tested on a real runner",
            body: "The suite runs the actions inside a `node:22` container — not against a mocked `GITHUB_ENV`.",
          },
        ],
      }),
      tpl("techstack", {
        title: "Built with",
        variant: "badges",
        style: "flat-square",
        groups: [brandGroup("Toolchain", ["TypeScript", "Bun", "Vitest", "GitHub Actions", "Docker"])],
      }),
      tpl("installation", {
        title: "Get started",
        intro: "Two files. Nothing else in your repository has to change.",
        steps: [
          {
            title: "Call the reusable workflow",
            body: "`ci.yml` delegates to ours and inherits your matrix.",
            language: "yaml",
            code: "on: [push]\njobs:\n  ci:\n    uses: your-org/your-repo/.github/workflows/ci.yml@v1",
          },
          {
            title: "Install the lint preset (optional)",
            body: "",
            language: "bash",
            code: "bun add -d oss-toolkit",
          },
          {
            title: "Open a pull request",
            body: "The bot comments with exactly what the CI run changed for you.",
            language: "bash",
            code: "gh pr create --fill",
          },
        ],
      }),
      tpl("usage", {
        title: "Usage",
        examples: [
          {
            title: "Guard a release tag",
            body: "Fails when a tag exists but `CHANGELOG.md` was not touched.",
            language: "yaml",
            code:
              "- uses: your-org/your-repo/.github/actions/release-guard@v1\n" +
              "  with:\n" +
              "    changelog: CHANGELOG.md\n" +
              "    require: true",
          },
          {
            title: "Collect matrix results",
            body: "One artifact per job, one summary comment — no `upload-artifact@v3` archaeology.",
            language: "yaml",
            code: "- uses: your-org/your-repo/.github/actions/matrix-report@v1\n  if: always()",
          },
        ],
      }),
      tpl("checklist", {
        title: "Before you open a pull request",
        style: "task",
        items: [
          { text: "`bun run ci` is green locally — it runs the same jobs as Actions", done: false, note: "" },
          { text: "New helpers ship with a fixture test that runs on a real runner", done: false, note: "" },
          {
            text: "No new runtime dependencies; dev-only is fine",
            done: false,
            note: "the one rule we will not bend",
          },
          { text: "Changeset added for anything under `src/`", done: false, note: "" },
        ],
      }),
      tpl("text", {
        variant: "alert",
        alertType: "TIP",
        body:
          "Want in? Say so on [Discussions #14](" +
          `${REPO}/discussions/14` +
          "). We review in order of smallest diff, and `good first issue` is not a polite fiction — those are " +
          "the ones nobody else picks up, which is why they are labelled.",
      }),
      tpl("collapsible", {
        icon: "🗂️",
        summary: "Governance, funding and what we owe each other",
        body:
          "- **Decisions** are made in public on Discussions, then written down as an ADR.\n" +
          "- **Ownership** is open to any contributor with three merged PRs. Ask; do not wait to be invited.\n" +
          "- **Funding** goes to the person who did the work, in proportion to merged diff, via Open Collective.\n" +
          "- **No CLA.** The `Signed-off-by:` line in your commit is the whole legal part.",
      }),
      tpl("license", {
        notice:
          "MIT — do what you like, attribution is appreciated, no warranty. Contributions are licensed under " +
          "the same terms (DCO).",
        url: `${REPO}/blob/main/LICENSE`,
      }),
    ],
  },

  {
    id: "saas-product",
    label: "SaaS",
    kind: "project",
    docName: "saas-product",
    blurb: "A README that also sells: demo, plans, self-hosting, support, security.",
    notes: [
      "A hosted product still needs the 'what am I looking at' image before anything else.",
      "Keep pricing in one table next to the changelog, or the README will quietly be wrong.",
      "Self-hosting lives in a collapsible: most readers never need it, the ones who need it need all of it.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/120x120/png?text=Logo",
        logoWidth: 120,
        title: "Meterloop",
        subtitle:
          "Usage-based billing that reconciles to the cent. Meter events, define a plan in code, hand your " +
          "customer an invoice your accountant will not send back.",
        buttons: [
          { label: "Start free", url: "https://meterloop.dev/signup" },
          { label: "Read the docs", url: "https://meterloop.dev/docs" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge(
            "uptime",
            { label: "uptime", message: "99.99%", color: "4c1", style: "flat-square" },
            "https://status.meterloop.dev",
          ),
          badge(
            "sdk",
            { label: "sdk", message: "ts · py · go", color: "3b82f6", style: "flat-square" },
            "https://meterloop.dev/docs/sdks",
          ),
          badge(
            "SOC 2",
            { label: "SOC 2", message: "Type II", color: "0f172a", style: "flat-square" },
            "https://meterloop.dev/security",
          ),
        ],
      }),
      tpl("image", {
        url: "https://placehold.co/1100x620/png?text=Invoice+preview",
        alt: "Meterloop invoice preview with the meter breakdown underneath",
        width: 1100,
        caption: "The bill is the product. Everything else here is plumbing to make that page correct.",
        linkUrl: "https://meterloop.dev/demo",
      }),
      tpl("features", {
        title: "How it works",
        layout: "numbered",
        items: [
          {
            icon: "📈",
            title: "Meter",
            body: "`track('api_requests', { customer, qty })` — idempotent, replayable, kept for 13 months.",
          },
          {
            icon: "🧾",
            title: "Price",
            body: "Plans are code: tiered, per-seat, committed spend, free allowance. Diff them in review.",
          },
          {
            icon: "🏦",
            title: "Invoice",
            body: "Draft → approve → send. Stripe, Chargebee or your own ledger; we never touch a card.",
          },
          {
            icon: "🔎",
            title: "Reconcile",
            body: "Every line on every invoice links back to the events that produced it. That is the whole pitch.",
          },
        ],
      }),
      tpl("installation", {
        title: "Try it in five minutes",
        intro: "No card, no sales call. Sandbox accounts come pre-seeded with 30 days of events.",
        steps: [
          {
            title: "Install the SDK and set your key",
            body: "",
            language: "bash",
            code: "npm i @meterloop/sdk\nexport METERLOOP_KEY='sk_sandbox_…'",
          },
          {
            title: "Send your first meter event",
            body: "",
            language: "typescript",
            code:
              'import { meter } from "@meterloop/sdk";\n\n' +
              "await meter.track({\n" +
              "  event: 'api_requests',\n" +
              "  customer: 'org_123',\n" +
              "  qty: 4200,\n" +
              "  idempotencyKey: req.id,\n" +
              "});",
          },
          {
            title: "Open the invoice preview",
            body: "The sandbox plan bills monthly with a 10k free allowance.",
            language: "bash",
            code: "open https://sandbox.meterloop.dev/preview/org_123",
          },
        ],
      }),
      tpl("table", {
        title: "Plans",
        columns: ["Plan", "Price", "Events", "Best for"],
        rows: [
          ["Hobby", "$0", "1M / mo", "solo builders, one product"],
          ["Startup", "$149 / mo", "50M / mo", "first paying customers; invoicing included"],
          ["Scale", "from $750 / mo", "unmetered", "multi-currency, committed spend, net-60"],
          [
            "Self-host",
            "$0 + support",
            "what your Postgres can take",
            "data residency, air-gapped, regulated",
          ],
        ],
        alignment: ["left", "right", "left", "left"],
      }),
      tpl("text", {
        variant: "alert",
        alertType: "IMPORTANT",
        body:
          "Sandbox keys (`sk_sandbox_*`) never produce an invoice. Anything starting `sk_live_` charges a real " +
          "customer — including the one you made for the demo.",
      }),
      tpl("collapsible", {
        icon: "🏗️",
        summary: "Self-hosting: what it actually takes",
        body:
          "One container, one Postgres, one S3-compatible bucket. No queue, no Redis, no worker pool — the " +
          "aggregation pass runs inside the database on a schedule.\n\n" +
          "```bash\ndocker compose -f deploy/self-host.yml up -d meterloop\n```\n\n" +
          "| Variable | Required | Notes |\n| --- | --- | --- |\n" +
          "| `DATABASE_URL` | yes | Postgres 15+; ~2 GB RAM per 10M events/day |\n" +
          "| `S3_BUCKET` | yes | raw events, retained 13 months |\n" +
          "| `SMTP_URL` | no | invoice email; API-only if unset |\n| `TZ` | no | billing timezone (UTC) |",
      }),
      tpl("links", {
        title: "Support and status",
        style: "list",
        align: "left",
        items: [
          {
            label: "Status page",
            url: "https://status.meterloop.dev",
            icon: "🟢",
            description: "incident history and maintenance windows",
          },
          { label: "API reference", url: "https://meterloop.dev/docs/api", icon: "📚", description: "" },
          {
            label: "Security & DPA",
            url: "https://meterloop.dev/security",
            icon: "🔐",
            description: "SOC 2 report on request",
          },
          {
            label: "Talk to a human",
            url: "mailto:support@meterloop.dev",
            icon: "✉️",
            description: "one business day",
          },
        ],
      }),
    ],
  },

  {
    id: "cli-tool",
    label: "CLI tool",
    kind: "project",
    docName: "my-cli",
    blurb: "Install, run, flags, config — the four things a CLI reader came for.",
    notes: [
      "Everything in a CLI README gets copy-pasted, so show real output under every command.",
      "Document exit codes if your tool runs in CI — that is the section people screenshot.",
      "The config block is where `--help` stops being enough; keep it identical to the parsed schema.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        title: "drift",
        subtitle:
          "One static binary that checks your `.env.example` against what the code actually reads. " +
          "`drift check` in CI, `drift fix` on your laptop.",
        buttons: [{ label: "Install", url: `${REPO}#install` }],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge(
            "version",
            { label: "version", message: "0.9.2", color: "0f172a", style: "flat-square" },
            `${REPO}/releases`,
          ),
          badge("platforms", { message: "linux · macos · windows", color: "blue", style: "flat-square" }),
          badge("license", { label: "license", message: "MIT", color: "green", style: "flat-square" }),
        ],
      }),
      tpl("features", {
        title: "Why another env checker",
        layout: "bullets",
        items: [
          {
            icon: "🪶",
            title: "No runtime",
            body: "A 4 MB static binary — `curl | sh`, Homebrew, or the GitHub Action; the same build.",
          },
          {
            icon: "🧭",
            title: "Reads the code, not just the file",
            body: "Parses `process.env` / `os.Getenv` / `os.environ` call sites, so an unused key is a hint, not an error.",
          },
          {
            icon: "🤖",
            title: "CI-shaped output",
            body: "GitHub annotations by default, exit 1 on drift, `--quiet` for pre-commit.",
          },
          {
            icon: "🔧",
            title: "Fixes only what is safe",
            body: "`drift fix` appends missing keys with a `# TODO` marker. It never reorders, rewrites or deletes.",
          },
        ],
      }),
      tpl("installation", {
        title: "Install",
        intro: "Pick one. The Homebrew build and the release tarball are byte-identical.",
        steps: [
          { title: "Homebrew", body: "", language: "bash", code: "brew install your-org/tap/drift" },
          { title: "npm (wraps the binary)", body: "", language: "bash", code: "npm i -g drift-cli" },
          {
            title: "Download a release",
            body: "Checksums sit next to every asset.",
            language: "bash",
            code: "curl -fsSL https://get.drift.tools | sh -s -- --version 0.9.2",
          },
        ],
      }),
      tpl("usage", {
        title: "Usage",
        examples: [
          {
            title: "`drift check` — what CI runs",
            body: "Exits non-zero when a variable is read by the code and missing from the example file.",
            language: "bash",
            code:
              "$ drift check\n" +
              "✗ STRIPE_WEBHOOK_SECRET  read in src/hooks/stripe.ts:22  missing in .env.example\n" +
              "✓ DATABASE_URL\n" +
              "! REDIS_URL                read in src/cache.ts:4  absent from both (hint)\n" +
              "\n1 drift, 1 hint, 12 checked",
          },
          {
            title: "`drift fix` — the safe subset",
            body: "",
            language: "bash",
            code:
              "$ drift fix\n" +
              '+ STRIPE_WEBHOOK_SECRET=""  # TODO: needed by src/hooks/stripe.ts:22\n' +
              "→ .env.example updated (1 line added, 0 changed)",
          },
        ],
      }),
      tpl("table", {
        title: "Commands and flags",
        columns: ["Command", "Flag", "Default", "Notes"],
        rows: [
          [
            "`check`",
            "`--format github|plain|json`",
            "plain",
            "`github` writes inline annotations on the PR",
          ],
          ["`check`", "`--strict`", "off", "treats hints as errors; exit code 2"],
          ["`fix`", "`--dry-run`", "off", "prints the patch, never writes"],
          ["`init`", "`--from docker-compose`", "—", "reads `environment:` blocks instead of code"],
          ["all", "`--env-file <path>`", ".env.example", "repeatable; the last one wins"],
        ],
        alignment: ["left", "left", "left", "left"],
      }),
      tpl("code", {
        language: "toml",
        filename: "drift.toml (optional)",
        body:
          "# Everything on the command line can live here, so CI and laptops agree.\n" +
          'paths = ["src", "worker"]\n' +
          'ignore = ["NODE_ENV", "PATH"]\n' +
          'example = ".env.example"\n\n' +
          '[report]\nformat = "github"\nhints = false',
      }),
      tpl("text", {
        variant: "alert",
        alertType: "TIP",
        body: "Run it on save: `drift check --quiet --format plain || exit 1` in a pre-commit hook costs about 12 ms.",
      }),
      tpl("license", {
        notice: "MIT. `drift` never phones home — the update check is opt-in and reads one static JSON file.",
        url: `${REPO}/blob/main/LICENSE`,
      }),
    ],
  },

  {
    id: "library-package",
    label: "Library",
    kind: "project",
    docName: "my-library",
    blurb: "For a published package: install per manager, API table, size and ESM notes.",
    notes: [
      "The badge row is a dependency's trust section: version, downloads, types, bundle size.",
      "Keep the API table in sync with the source — a stale signature is worse than none.",
      "Say the ESM/CJS and side-effects story out loud; that is what the reader is actually deciding.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/88x88/png?text=Logo",
        title: "@acme/temporal",
        subtitle:
          "Relative dates, durations and calendar arithmetic for JavaScript. 3.1 kB gzip, zero dependencies, " +
          "`Intl` underneath — the date library that fits in a tooltip.",
        buttons: [
          { label: "API docs", url: "https://temporal.acme.dev/docs" },
          { label: "Playground", url: "https://temporal.acme.dev/play" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge(
            "npm",
            { label: "npm", message: "v4.2.0", color: "CB3837", style: "flat-square" },
            "https://www.npmjs.com/package/@acme/temporal",
          ),
          badge("downloads", {
            label: "downloads",
            message: "1.2M / mo",
            color: "blue",
            style: "flat-square",
          }),
          badge("types", { label: "types", message: "included", color: "3178C6", style: "flat-square" }),
          badge(
            "size",
            { label: "size", message: "3.1 kB", color: "green", style: "flat-square" },
            "https://bundlephobia.com/package/@acme/temporal",
          ),
        ],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "`Date` is an epoch with a timezone it stole from the runtime. `temporal` gives you an instant, a " +
          "local date, and a duration that knows a month is not 30 days — without shipping a 70 kB calendar.\n\n" +
          "Judged against the big libraries: we implement the ~20% of the surface most code uses and throw on " +
          "the rest. That is the whole trade, stated up front.",
      }),
      tpl("features", {
        title: "Features",
        layout: "icon-text",
        items: [
          {
            icon: "🧮",
            title: "Correct month arithmetic",
            body: "`add({ months: 1 })` on Jan 31 lands on Feb 28 — and tells you it clamped.",
          },
          {
            icon: "🌍",
            title: "`Intl` formatting, no data files",
            body: "Locales come from the runtime: nothing to load, nothing to go stale.",
          },
          {
            icon: "🧊",
            title: "Immutable and serialisable",
            body: "`toJSON()` emits ISO 8601, `fromJSON()` reads it back. Safe in a store or a URL.",
          },
          {
            icon: "🌳",
            title: "Tree-shakeable",
            body: "Named exports only, and the package declares `sideEffects: false`.",
          },
        ],
      }),
      tpl("installation", {
        title: "Install",
        intro: "ESM and CJS from one source, types next to the code, no `@types` package to lose.",
        steps: [
          { title: "npm", body: "", language: "bash", code: "npm i @acme/temporal" },
          { title: "pnpm", body: "", language: "bash", code: "pnpm add @acme/temporal" },
          {
            title: "Deno / Bun",
            body: "No install step — it works from an `npm:` specifier.",
            language: "typescript",
            code: 'import { instant } from "npm:@acme/temporal@4";',
          },
        ],
      }),
      tpl("usage", {
        title: "Usage",
        examples: [
          {
            title: "Humanise an instant",
            body: "",
            language: "typescript",
            code:
              'import { instant, fromNow } from "@acme/temporal";\n\n' +
              'const t = instant("2026-08-28T09:12:00Z");\n' +
              'fromNow(t, { locale: "en", style: "narrow" }); // "2 h ago"',
          },
          {
            title: "Calendar maths without surprises",
            body: "`clamped` is how you learn a month ran out of days, instead of finding out in March.",
            language: "typescript",
            code:
              'import { localDate } from "@acme/temporal";\n\n' +
              'const d = localDate("2026-01-31").add({ months: 1 });\n' +
              'd.toString();  // "2026-02-28"\n' +
              "d.clamped;     // { field: 'day', from: 31, to: 28 }",
          },
        ],
      }),
      tpl("table", {
        title: "API",
        columns: ["Export", "Signature", "Throws"],
        rows: [
          ["`instant`", "`(iso: string | Date) → Instant`", "on an unparseable string"],
          ["`localDate`", "`(iso: string, tz?: string) → LocalDate`", "on a date that does not exist"],
          ["`.add` / `.subtract`", "`(d: Duration) → Self`", "never — clamping is reported, not thrown"],
          ["`fromNow`", "`(t: Instant, o?: { locale, style }) → string`", "on an unsupported `style`"],
          ["`interval`", "`(a: Instant, b: Instant) → Duration`", "never"],
        ],
        alignment: ["left", "left", "left"],
      }),
      tpl("text", {
        variant: "alert",
        alertType: "NOTE",
        body:
          "Named imports only. `import * as temporal` pulls the whole package in, and the point of four " +
          "separate exports was to let your bundler drop three of them.",
      }),
      tpl("links", {
        title: "Read next",
        style: "list",
        align: "left",
        items: [
          {
            label: "Changelog",
            url: "https://github.com/your-org/temporal/blob/main/CHANGELOG.md",
            icon: "📝",
            description: "one entry per release, no marketing",
          },
          {
            label: "Examples",
            url: "https://github.com/your-org/temporal/tree/main/examples",
            icon: "🧪",
            description: "timezone migration, a React hook, a CLI",
          },
          {
            label: "Report a bug",
            url: "https://github.com/your-org/temporal/issues/new?template=wrong-answer.md",
            icon: "🐞",
            description: "the template asks for the exact inputs",
          },
        ],
      }),
      tpl("license", {
        notice: "MIT. No CLA, and no telemetry of any kind — there is nowhere for it to go.",
        url: "https://github.com/your-org/temporal/blob/main/LICENSE",
        author: "Acme, Inc.",
      }),
    ],
  },

  {
    id: "http-api",
    label: "HTTP API",
    kind: "project",
    docName: "http-api",
    blurb: "An endpoint reference a caller can trust: auth, idempotency, errors, limits.",
    notes: [
      "Put a working sandbox key in the README. A reader who hits one endpoint in 20 seconds is a reader who integrates.",
      "Errors live in a collapsible: the integrator needs all of them, the evaluator must not wade through them.",
      "Never elide the host or the auth header in an example — a half-pasted curl becomes a support ticket.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "left",
        title: "Ledger API",
        subtitle:
          "A small, boring money-movement API: idempotent writes, cursor pagination, no surprise fields. The " +
          "sandbox is free and rate-limited exactly like production.",
        buttons: [
          { label: "Reference", url: "https://api.acme.dev/docs" },
          { label: "Get a sandbox key", url: "https://dashboard.acme.dev/keys" },
        ],
      }),
      tpl("badges", {
        align: "left",
        style: "flat-square",
        items: [
          badge("version", {
            label: "api",
            message: "v2 (2026-04-01)",
            color: "0f172a",
            style: "flat-square",
          }),
          badge(
            "uptime",
            { label: "uptime", message: "99.99%", color: "4c1", style: "flat-square" },
            "https://status.acme.dev",
          ),
          badge(
            "openapi",
            { label: "openapi", message: "3.1 spec", color: "6b7280", style: "flat-square" },
            "https://api.acme.dev/openapi.json",
          ),
        ],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "**Base URL** — `https://api.acme.dev/v2` in production, `https://sandbox.api.acme.dev/v2` in the sandbox.\n\n" +
          "**Auth** — one header: `Authorization: Bearer sk_live_…`. Keys are per-project, and every denied " +
          "response names the scope it wanted, so a permission bug is a one-line fix instead of a support ticket.",
      }),
      tpl("code", {
        language: "bash",
        filename: "first call",
        body:
          "curl https://sandbox.api.acme.dev/v2/accounts \\\n" +
          '  -H "Authorization: Bearer sk_sandbox_demo" \\\n' +
          '  -H "Idempotency-Key: 9d1f0c2a"\n\n' +
          '# → 200 {"data":[{"id":"acc_1","currency":"USD","balance_minor":12050}],"next_cursor":null}',
      }),
      tpl("usage", {
        title: "SDK quickstart",
        intro: "Official clients are generated from the OpenAPI spec, then hand-patched for ergonomics.",
        examples: [
          {
            title: "TypeScript",
            body: "",
            language: "typescript",
            code:
              'import { Acme } from "@acme/api";\n\n' +
              "const acme = new Acme({ key: process.env.ACME_KEY!, sandbox: true });\n" +
              "const transfer = await acme.transfers.create({\n" +
              '  amount: { minor: 1200, currency: "USD" },\n' +
              '  to: "acc_1",\n' +
              "  // the SDK derives an Idempotency-Key from these fields\n" +
              "});",
          },
          {
            title: "Python",
            body: "",
            language: "python",
            code:
              "from acme import Acme\n\n" +
              'acme = Acme(key=os.environ["ACME_KEY"], sandbox=True)\n' +
              'transfer = acme.transfers.create(amount=(1200, "USD"), to="acc_1")',
          },
        ],
      }),
      tpl("table", {
        title: "Endpoints",
        columns: ["Method", "Path", "Idempotent", "Notes"],
        rows: [
          ["`GET`", "`/accounts`", "—", "cursor pagination, `limit` ≤ 100"],
          ["`POST`", "`/transfers`", "required", "409 when a key is reused with a different body"],
          ["`GET`", "`/transfers/{id}`", "—", ""],
          ["`POST`", "`/transfers/{id}/reverse`", "required", "only within 24 h of settlement"],
          ["`DELETE`", "`/webhooks/{id}`", "—", "stops new deliveries; in-flight ones drain"],
        ],
        alignment: ["left", "left", "center", "left"],
      }),
      tpl("collapsible", {
        icon: "⚠️",
        summary: "Error codes and rate limits",
        body:
          "Errors are `application/problem+json` with a stable `code`. Retry only the rows marked *yes*.\n\n" +
          "| status | code | Retry | Meaning |\n| --- | --- | --- | --- |\n" +
          "| 400 | `invalid_amount` | no | minor units must be > 0 |\n" +
          "| 401 | `key_revoked` | no | rotate it in the dashboard |\n" +
          "| 409 | `idempotency_conflict` | no | same key, different body |\n" +
          "| 422 | `insufficient_funds` | no | balance checked at write time |\n" +
          "| 429 | `rate_limited` | yes | honour `Retry-After`; 60 req/s per key |\n" +
          "| 500 | `internal` | yes | safe to re-send with the same key |\n\n" +
          "Limits are token buckets per key with a burst of 120. Webhook deliveries back off from 1 s to 5 min " +
          "over 12 attempts, then land in the dead-letter view.",
      }),
      tpl("checklist", {
        title: "Going live",
        style: "task",
        items: [
          { text: "Swap `sk_sandbox_` for a live key, per environment", done: false, note: "" },
          {
            text: "Handle `409 idempotency_conflict` explicitly",
            done: false,
            note: "blindly retrying here double-charges someone",
          },
          { text: "Verify webhook signatures (`acme-signature`, HMAC-SHA256)", done: false, note: "" },
          { text: "Point a monitor at `GET /v2/ping`", done: false, note: "" },
          {
            text: "Read the [data residency note](https://api.acme.dev/docs/residency)",
            done: false,
            note: "",
          },
        ],
      }),
      tpl("links", {
        title: "Tools",
        style: "pills",
        align: "left",
        items: [
          { label: "OpenAPI spec", url: "https://api.acme.dev/openapi.json", icon: "", description: "" },
          {
            label: "Postman collection",
            url: "https://www.postman.com/acme/workspace/ledger",
            icon: "",
            description: "",
          },
          { label: "Status", url: "https://status.acme.dev", icon: "", description: "" },
          { label: "API support", url: "mailto:api-support@acme.dev", icon: "", description: "" },
        ],
      }),
    ],
  },

  {
    id: "ai-ml-model",
    label: "AI / ML project",
    kind: "project",
    docName: "ai-model-card",
    blurb: "A model card, benchmarks with their eval config, and the limits stated plainly.",
    notes: [
      "The model-card table is the part other researchers read — fill it in even if the prose stays placeholder.",
      "Say what the model must not be used for. A README without a limitations section reads as an unexamined one.",
      "Benchmarks without their eval config are marketing numbers; keep both in the same section.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        title: "quill-7b-instruct",
        subtitle:
          "A 7B instruction model tuned for **structured extraction** from documents: JSON out, citations in, " +
          "one 24 GB card.",
        buttons: [
          { label: "Demo", url: "https://huggingface.co/spaces/your-org/quill" },
          { label: "Weights", url: "https://huggingface.co/your-org/quill-7b-instruct" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "flat-square",
        items: [
          badge("python", { label: "python", message: "3.11+", color: "3776AB", style: "flat-square" }),
          badge("license", {
            label: "license",
            message: "CC BY-NC 4.0",
            color: "orange",
            style: "flat-square",
          }),
          badge("downloads", {
            label: "downloads",
            message: "18k / mo",
            color: "FFD21E",
            style: "flat-square",
          }),
          badge("serving", {
            label: "serves via",
            message: "llama.cpp · vLLM",
            color: "6b7280",
            style: "flat-square",
          }),
        ],
      }),
      tpl("table", {
        title: "Model card",
        columns: ["Field", "Value"],
        rows: [
          ["Task", "Document → JSON extraction, with span citations"],
          [
            "Base model",
            "Qwen2.5-7B + 40B tokens of continued pre-training on synthetic receipts, invoices, contracts",
          ],
          ["Context", "32 768 (YaRN); 24 576 with no measurable loss on our eval"],
          ["Precision", "bf16 training · GGUF Q4_K_M and AWQ 4-bit for inference"],
          ["Parameters", "7.6 B"],
          ["Training data", "public-domain plus licensed corpora; no scraped personal data"],
          ["Evals", "DocJSON-bench, CiteBench; HumanEval only as a regression guard"],
        ],
        alignment: ["left", "left"],
      }),
      tpl("image", {
        url: "https://placehold.co/1000x420/png?text=Qualitative+example",
        alt: "A scanned invoice on the left, the extracted JSON on the right",
        width: 1000,
        caption:
          "Input on the left, output on the right. Field-level confidence is returned, never guessed at.",
      }),
      tpl("installation", {
        title: "Run it locally",
        intro: "About 5.5 GB of VRAM at Q4_K_M, or any Mac with 16 GB of unified memory.",
        steps: [
          {
            title: "Install",
            body: "",
            language: "bash",
            code: 'pip install "quill-llm[serve]>=0.6"   # or: brew install your-org/tap/quill',
          },
          {
            title: "Fetch the quant",
            body: "",
            language: "bash",
            code: "huggingface-cli download your-org/quill-7b-instruct-gguf quill-q4_k_m.gguf --local-dir ./models",
          },
          {
            title: "Serve an OpenAI-compatible endpoint",
            body: "",
            language: "bash",
            code: "quill serve ./models/quill-q4_k_m.gguf --ctx 16384 --port 8123",
          },
        ],
      }),
      tpl("usage", {
        title: "Usage",
        examples: [
          {
            title: "Extract with citations",
            body: "Anything the model cannot ground comes back `null` — it is not allowed to invent a span.",
            language: "python",
            code:
              "from quill import extract\n\n" +
              "out = extract(\n" +
              "    open('invoice.pdf', 'rb'),\n" +
              "    schema={'total': 'money', 'due_date': 'date', 'vendor': 'text'},\n" +
              "    citations=True,\n" +
              ")\n" +
              "print(out.total)        # Money(amount=Decimal('1240.00'), currency='USD')\n" +
              "print(out.total.span)   # (page=1, x0=312, y0=640, x1=402, y1=658)",
          },
          {
            title: "Or through any OpenAI client",
            body: "",
            language: "python",
            code:
              "client = OpenAI(base_url='http://localhost:8123/v1', api_key='quill')\n" +
              "r = client.chat.completions.create(model='quill', messages=[{'role': 'user', 'content': text}])",
          },
        ],
      }),
      tpl("table", {
        title: "Benchmarks",
        columns: ["Model", "DocJSON F1", "CiteBench", "Tokens/s", "VRAM"],
        rows: [
          ["quill-7b-instruct (Q4_K_M)", "0.912", "0.87", "78", "5.5 GB"],
          ["quill-7b-instruct (bf16)", "0.918", "0.88", "34", "16 GB"],
          ["baseline: Qwen2.5-7B", "0.741", "0.31", "80", "5.6 GB"],
          ["reference: frontier API", "0.934", "0.90", "n/a", "n/a"],
        ],
        alignment: ["left", "right", "right", "right", "right"],
      }),
      tpl("text", {
        variant: "alert",
        alertType: "CAUTION",
        body:
          "**Do not use** for medical, legal, benefits-eligibility or identity decisions, and do not paste " +
          "personal data into the demo Space — it is public and logged. This is a document extractor that " +
          "happens to sound confident; a confident tone is not accuracy. Full limitations and the eval " +
          "harness: [`docs/limitations.md`](" +
          `${REPO}/blob/main/docs/limitations.md` +
          ").",
      }),
      tpl("techstack", {
        title: "How it was built",
        variant: "grouped",
        style: "flat",
        groups: [
          brandGroup("Training", ["PyTorch", "Hugging Face", "JAX", "scikit-learn"]),
          brandGroup("Data", ["DuckDB", "pandas", "NumPy"]),
          brandGroup("Serving", ["Ollama", "FastAPI", "Docker"]),
        ],
      }),
      tpl("links", {
        title: "Everything else",
        style: "list",
        align: "left",
        items: [
          {
            label: "Tech report",
            url: "https://arxiv.org/abs/0000.00000",
            icon: "📄",
            description: "training recipe and eval config",
          },
          {
            label: "Eval dataset",
            url: "https://huggingface.co/datasets/your-org/docjson-bench",
            icon: "🗃️",
            description: "CC BY 4.0",
          },
          {
            label: "Fine-tuning script",
            url: `${REPO}/tree/main/train`,
            icon: "🔁",
            description: "reproduces the checkpoint on 8×A100",
          },
          {
            label: "Space",
            url: "https://huggingface.co/spaces/your-org/quill",
            icon: "🤖",
            description: "",
          },
        ],
      }),
      tpl("license", {
        title: "License & use terms",
        notice:
          "Weights: **CC BY-NC 4.0** (commercial licences are one email, not a negotiation). Code: **MIT**. " +
          "Training data provenance: `DATA_CARDS.md`.",
        url: `${REPO}/blob/main/LICENSE`,
      }),
    ],
  },
];
