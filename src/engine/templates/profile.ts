import { brandGroup, cardRowBlock, STATS_URLS, socialBadge, tpl } from "./build";
import type { Template } from "./types";

/* ------------------------------------------------------------------ *
 * engine/templates/profile.ts — the four profile presets.
 *
 * This is the file that proves the Phase 3 seam: a profile README uses *no*
 * new block type. The avatar is the hero's `logoUrl`, the "find me on X" row
 * is the Badges block, the stat cards are images, and the two-column card row
 * everyone hand-writes as HTML is one Text block (its body is passthrough
 * Markdown, so raw HTML is legal there). Profiles were a content problem all
 * along — which is exactly what `Document.kind` was added to make explicit.
 *
 * Everything is keyed on the placeholder `your-username`, so the third-party
 * cards render their own "user not found" card until it is replaced. That is
 * deliberate: a preset that showed somebody else's stats would be read as real.
 * ------------------------------------------------------------------ */

const USER = "your-username";

/** The row of "here is where I live" badges every profile README opens with. */
const socialRow = () =>
  tpl("badges", {
    align: "center",
    style: "for-the-badge",
    items: [
      socialBadge("github", `@${USER}`, `https://github.com/${USER}`),
      socialBadge("x", "@handle", "https://x.com/handle"),
      socialBadge("linkedin", "in/your-name", "https://www.linkedin.com/in/your-name"),
      socialBadge("website", "yourname.dev", "https://yourname.dev"),
      socialBadge("email", "hi@yourname.dev", "mailto:hi@yourname.dev"),
    ],
  });

const statsRow = (user: string) =>
  cardRowBlock([
    { src: STATS_URLS.stats(user), alt: "GitHub stats", height: 168 },
    { src: STATS_URLS.langs(user), alt: "Most-used languages", height: 168 },
  ]);

export const PROFILE_TEMPLATES: Template[] = [
  {
    id: "minimal-profile",
    label: "Minimal profile",
    kind: "profile",
    docName: "minimal-profile",
    blurb: "Four blocks: who you are, what you use, where to find you.",
    notes: [
      "A profile README is read for 20 seconds. Three sentences and a contact line beat a life story.",
      "The `list` variant of Tech stack stays copy-pasteable, which suits a minimal page.",
      "Replace `your-username` even here: this preset has nothing dynamic, but the links still need your handle.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "left",
        logoUrl: "",
        title: "Your Name",
        subtitle: "Backend engineer in Lisbon. Postgres, Go, and things that stay up.",
        buttons: [],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "I work on storage and billing systems — currently making invoicing at " +
          "[Acme](https://acme.dev) boring and correct. Before that: eight years of agency work, which is " +
          "why I care about migrations that can be rolled back.\n\n" +
          "Outside work I restore old keyboards, run slowly, and answer Go questions on " +
          "[the forum](https://forum.golangbridge.org).",
      }),
      tpl("techstack", {
        title: "What I use",
        variant: "list",
        groups: [
          brandGroup("Daily", ["Go", "PostgreSQL", "TypeScript", "Docker"]),
          brandGroup("Recently", ["Zig", "SQLite", "Terraform"]),
        ],
      }),
      tpl("links", {
        title: "Elsewhere",
        style: "inline",
        align: "left",
        items: [
          { label: `github.com/${USER}`, url: `https://github.com/${USER}`, icon: "", description: "" },
          { label: "yourname.dev", url: "https://yourname.dev", icon: "", description: "" },
          { label: "hi@yourname.dev", url: "mailto:hi@yourname.dev", icon: "", description: "" },
        ],
      }),
    ],
  },

  {
    id: "developer-profile",
    label: "Developer profile",
    kind: "profile",
    docName: "developer-profile",
    blurb: "The familiar one: avatar, socials, stack, live GitHub stat cards.",
    notes: [
      "Replace `your-username` in the two stat-card URLs — until you do they render a 'user not found' card.",
      "The stat cards are one static image, so they cannot follow GitHub's light/dark mode; they are styled for dark.",
      "The socials row is `badges` with `linkUrl` set — delete any network you are not actually answering on.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/140x140/png?text=@you",
        logoWidth: 140,
        title: "Your Name",
        subtitle:
          "I write **TypeScript and Go** for [Acme](https://acme.dev), and **Zig** on weekends. " +
          "Currently: making our billing engine restartable.",
        buttons: [],
      }),
      socialRow(),
      tpl("text", {
        variant: "paragraph",
        body:
          "I do backend and infrastructure — the parts with a receipt: migrations, idempotency, on-call " +
          "notes, and the retry that is actually safe to repeat. Twelve years of it, mostly on money movement " +
          "at [Acme](https://acme.dev).\n\n" +
          "Happy to review open-source PRs that teach me something, and to pair on a gnarly Postgres query. " +
          "Best way to reach me is email: a reproducer gets an answer the same day more often than a " +
          "description does.",
      }),
      tpl("features", {
        title: "Currently",
        layout: "icon-text",
        items: [
          {
            icon: "🛠️",
            title: "Building",
            body: "A 200-line Postgres-backed job queue I keep shipping to production.",
          },
          {
            icon: "📚",
            title: "Learning",
            body: "Zig comptime, and how to stop writing `unwrap` in Rust by reflex.",
          },
          {
            icon: "✍️",
            title: "Writing",
            body: "One long post a month about money-movement bugs — [the newsletter](https://yourname.dev/notes).",
          },
          { icon: "🎧", title: "Listening", body: "Anything with a Rhodes in it." },
        ],
      }),
      tpl("techstack", {
        title: "Stack",
        variant: "badges",
        style: "flat-square",
        groups: [
          brandGroup("Languages", ["TypeScript", "Go", "Rust", "Python"]),
          brandGroup("Data", ["PostgreSQL", "Redis", "ClickHouse", "DuckDB"]),
          brandGroup("Platform", ["Docker", "Kubernetes", "Terraform", "GitHub Actions"]),
        ],
      }),
      statsRow(USER),
      tpl("links", {
        title: "Find me elsewhere",
        style: "list",
        align: "left",
        items: [
          {
            label: "Blog / notes",
            url: "https://yourname.dev/notes",
            icon: "✍️",
            description: "long-form, monthly-ish",
          },
          {
            label: "Speaking & slides",
            url: "https://github.com/your-username/talks",
            icon: "🎤",
            description: "",
          },
          {
            label: "Open-source list",
            url: `https://github.com/${USER}?tab=repositories`,
            icon: "📦",
            description: "what I maintain, not what I fork",
          },
          { label: "Email", url: "mailto:hi@yourname.dev", icon: "📮", description: "" },
        ],
      }),
      tpl("collapsible", {
        icon: "🧰",
        summary: "Tools I reach for, and why",
        body:
          "| Job | Tool | Why this one |\n| --- | --- | --- |\n" +
          "| Editor | Neovim + LazyVim | I stopped configuring it in 2024 and my speed went up |\n" +
          "| Terminal | tmux + zellij | zellij when I need layouts, tmux when I need muscle memory |\n" +
          "| Notes | Obsidian (plain Markdown) | the vault is a git repo, so it outlives the app |\n" +
          "| SQL | `psql` + DuckDB | DuckDB for the CSV archaeology, `psql` for anything that ships |\n\n" +
          "The full, boring list lives in [dotfiles](https://github.com/your-username/dotfiles) — it is the " +
          "repo I am most willing to have people copy.",
      }),
      tpl("text", {
        variant: "quote",
        body: "“Talk is cheap. Show me the code” — quoted at every job I have ever wanted.",
      }),
    ],
  },

  {
    id: "full-profile",
    label: "Full profile",
    kind: "profile",
    docName: "full-profile",
    blurb: "Everything at once: cards, trophies, projects, handles, goals.",
    notes: [
      "This is the max-config preset — the fastest way to use it is to delete half of it.",
      "Trophies, streak and the activity graph are third-party renderers: keep one or two, not five, or the page becomes a billboard.",
      "WakaTime (in the last collapsible) needs a public dashboard before the URL shows anything.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/160x160/png?text=@you",
        logoWidth: 160,
        title: "Your Name",
        subtitle:
          "Staff engineer · payments and data infrastructure · Lisbon (CET) · " +
          "**available** for advisory work from November",
        buttons: [
          { label: "Résumé", url: "https://yourname.dev/cv.pdf" },
          { label: "Book 20 minutes", url: "https://cal.com/yourname/intro" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "for-the-badge",
        items: [
          socialBadge("github", `@${USER}`, `https://github.com/${USER}`),
          socialBadge("linkedin", "in/your-name", "https://www.linkedin.com/in/your-name"),
          socialBadge("x", "@handle", "https://x.com/handle"),
          socialBadge("mastodon", "@you@hachyderm.io", "https://hachyderm.io/@you"),
          socialBadge("devto", "@yourname", "https://dev.to/yourname"),
          {
            alt: "profile views",
            imageUrl: STATS_URLS.views(USER),
            linkUrl: "",
          },
        ],
      }),
      tpl("text", {
        variant: "paragraph",
        body:
          "Twelve years of shipping, most of them near money: ledgers, webhooks, reconciliation, the invoice " +
          "that has to match at 3am. I like the unglamorous half of engineering — the migration plan, the " +
          "runbook, the retry that is actually idempotent.\n\n" +
          "I mentor (three formal mentees a year, always time for one more), speak at meetings about " +
          "Postgres, and maintain a few small libraries people apparently use in production, which is either " +
          "flattering or terrifying.",
      }),
      cardRowBlock([
        { src: STATS_URLS.stats(USER), alt: "GitHub stats", height: 170 },
        { src: STATS_URLS.langs(USER), alt: "Top languages", height: 170 },
        { src: STATS_URLS.streak(USER), alt: "Current contribution streak", height: 170 },
      ]),
      cardRowBlock([{ src: STATS_URLS.trophies(USER), alt: "GitHub trophies", height: 140 }]),
      tpl("features", {
        title: "Things I have shipped that are public",
        layout: "cards-2",
        items: [
          {
            icon: "🧾",
            title: "ledger-kit",
            body: "Double-entry bookkeeping in Postgres for app developers. 4.1k stars; used by three invoice products.\n\n[repo](https://github.com/your-username/ledger-kit)",
          },
          {
            icon: "🔁",
            title: "webhook-harness",
            body: "Replay, sign and diff production webhooks against a local server. The tool I wanted in 2019.\n\n[repo](https://github.com/your-username/webhook-harness)",
          },
          {
            icon: "🐘",
            title: "pg-drift",
            body: "`pg-drift diff` — schema drift between staging and prod in one command, with a migration suggestion.\n\n[repo](https://github.com/your-username/pg-drift)",
          },
          {
            icon: "📖",
            title: "Money bugs",
            body: "A written post-mortem series on rounding, timezones and off-by-one cent errors. 40k reads a month.\n\n[the series](https://yourname.dev/notes/money-bugs)",
          },
        ],
      }),
      tpl("techstack", {
        title: "Stack I would choose again",
        variant: "grouped",
        style: "flat",
        groups: [
          brandGroup("Languages", ["TypeScript", "Go", "Rust", "Python"]),
          brandGroup("Data", ["PostgreSQL", "ClickHouse", "Redis", "DuckDB", "Kafka"]),
          brandGroup("Infra", ["Terraform", "Kubernetes", "GitHub Actions", "NGINX"]),
          brandGroup("Edge", ["Cloudflare", "Fastify", "Deno"]),
        ],
      }),
      tpl("table", {
        title: "Handles, in case you want the real one",
        columns: ["Platform", "Handle", "Notes"],
        rows: [
          ["GitHub", `@${USER}`, "best signal; issues welcome"],
          ["LinkedIn", "in/your-name", "only for recruiting, I do not read DMs"],
          ["X", "@handle", "hot takes about money movement"],
          ["Mastodon", "@you@hachyderm.io", "the same takes, calmer"],
          ["Dev.to", "@yourname", "cross-posts the long ones"],
          ["Email", "hi@yourname.dev", "the one I actually answer"],
        ],
        alignment: ["left", "left", "left"],
      }),
      tpl("checklist", {
        title: "2026, out loud so I do it",
        style: "task",
        showProgress: true,
        items: [
          { text: "Ship `ledger-kit` v1 and write the migration guide", done: true, note: "March" },
          { text: "Give the Postgres isolation talk at PgConf", done: true, note: "slides published" },
          { text: "Rewrite the money-bugs series as one long essay", done: false, note: "half written" },
          { text: "Mentor three people properly, not opportunistically", done: false, note: "" },
          { text: "Stop adding tools to the dotfiles repo", done: false, note: "losing" },
        ],
      }),
      tpl("collapsible", {
        icon: "⌚",
        summary: "Coding hours, and what I am reading",
        body:
          "The [WakaTime card](https://wakatime.com/@yourname) below only renders if your dashboard is public " +
          "— `Settings → Account → API access → Public`.\n\n" +
          '<p align="center"><img src="https://github-readme-stats.vercel.app/api/wakatime?username=yourname' +
          '&hide_border=true&layout=compact&bg_color=0d1117&color=94a3b8&title_color=f0f6fc" ' +
          'alt="Coding activity" width="560" /></p>\n\n' +
          "**On the desk:** *Designing Data-Intensive Applications* (fourth pass), *The Timeless Way of " +
          "Building*, and the Postgres 18 release notes, slowly.",
      }),
      tpl("text", {
        variant: "alert",
        alertType: "NOTE",
        body:
          "I answer email and GitHub issues, in that order. If something is urgent and broken, open an issue " +
          "with the failing input — a reproducer gets an answer the same day more often than a description does.",
      }),
    ],
  },

  {
    id: "portfolio-profile",
    label: "Portfolio profile",
    kind: "profile",
    docName: "portfolio-profile",
    blurb: "For freelancers and designers: case studies, services, rates, proof.",
    notes: [
      "Case-study cards need a number in the body — 'cut load from 1.4 s to 90 ms' is what gets you the call.",
      "Put the price or the engagement model in the table. Hiding it filters out nobody but you.",
      "Swap every `placehold.co` URL for real shots; a portfolio with stock placeholders reads as no portfolio.",
    ],
    blocks: () => [
      tpl("hero", {
        align: "center",
        logoUrl: "https://placehold.co/150x150/png?text=Work",
        logoWidth: 150,
        title: "Your Name",
        subtitle:
          "Product engineer for developer tools. I design the interface *and* ship the API, so the handoff is " +
          "a commit instead of a meeting.",
        buttons: [
          { label: "Full portfolio", url: "https://yourname.dev/work" },
          { label: "Check availability", url: "https://cal.com/yourname/intro" },
        ],
      }),
      tpl("badges", {
        align: "center",
        style: "for-the-badge",
        items: [
          socialBadge("dribbble", "shots", "https://dribbble.com/yourname"),
          socialBadge("github", `@${USER}`, `https://github.com/${USER}`),
          socialBadge("website", "yourname.dev", "https://yourname.dev"),
          socialBadge("email", "book a call", "mailto:hi@yourname.dev"),
        ],
      }),
      tpl("image", {
        url: "https://placehold.co/1200x700/png?text=Case+study+hero",
        alt: "A dark dashboard for queue observability, the main screen of the shipped product",
        width: 1200,
        caption:
          "Most recent: a queue dashboard for [Acme](https://acme.dev) — 6 weeks, one engineer, " +
          "and support tickets about 'stuck jobs' down 70%.",
        linkUrl: "https://yourname.dev/work/acme",
      }),
      tpl("features", {
        title: "Selected work",
        layout: "cards-2",
        items: [
          {
            icon: "🚦",
            title: "Acme — queue dashboard",
            body: "From a spreadsheet of complaints to a shipped product in six weeks. p95 load 1.4 s → 90 ms.\n\n[case study](https://yourname.dev/work/acme)",
          },
          {
            icon: "🧾",
            title: "Meterloop — billing screens",
            body: "Redesigned invoice review around the one question customers ask: *which events made this line?*\n\n[case study](https://yourname.dev/work/meterloop)",
          },
          {
            icon: "📦",
            title: "ledger-kit — docs + site",
            body: "Open-source docs that converted 4.1k readers into 380 users in a quarter. Written, not generated.\n\n[case study](https://yourname.dev/work/ledger-kit)",
          },
          {
            icon: "🎨",
            title: "Northwind — design system",
            body: "34 components, tokens in Figma and code from one source, and a migration that did not freeze the team.\n\n[case study](https://yourname.dev/work/northwind)",
          },
        ],
      }),
      tpl("table", {
        title: "How people engage me",
        columns: ["Engagement", "What you get", "From", "Good fit for"],
        rows: [
          [
            "Sprint (2 weeks)",
            "One flow, designed and shipped behind a flag",
            "€6.5k",
            "a blocked feature that needs both halves",
          ],
          [
            "Month",
            "Design system work, pair reviews, on-call for the UI",
            "€12k",
            "a team that has engineers but no design partner",
          ],
          [
            "Audit (1 week)",
            "A written teardown: 15–25 findings, ranked, with fixes",
            "€3.5k",
            "knowing what you are in for before you commit",
          ],
          [
            "Advisory",
            "Two calls a month, async in Slack, no slides",
            "€1.2k / mo",
            "early products with a working v1",
          ],
        ],
        alignment: ["left", "left", "right", "left"],
      }),
      tpl("techstack", {
        title: "What I work in",
        variant: "badges",
        style: "flat",
        groups: [
          brandGroup("Design", ["Figma", "Tailwind CSS", "Radix UI", "shadcn/ui"]),
          brandGroup("Frontend", ["React", "TypeScript", "Next.js", "Vite"]),
          brandGroup("Backend", ["Node.js", "PostgreSQL", "Prisma", "GraphQL"]),
        ],
      }),
      tpl("checklist", {
        title: "How I work",
        style: "square",
        showTitle: true,
        items: [
          { text: "You get a branch, not a deck — everything lands in your repo", done: false, note: "" },
          { text: "One written update per week, in your tracker, not in email", done: false, note: "" },
          { text: "Design and code from the same tokens, checked in CI", done: false, note: "" },
          {
            text: "Handover doc and a 2-hour walkthrough at the end, always",
            done: false,
            note: "included in every engagement",
          },
          { text: "No retainer lock-in; cancel with two weeks' notice", done: false, note: "" },
        ],
      }),
      tpl("collapsible", {
        icon: "💬",
        summary: "What clients said afterwards",
        body:
          "> “We had argued about the queue UI for four months. It shipped in two weeks and the argument " +
          "stopped.” — Head of Eng, Acme\n\n" +
          "> “The audit paid for itself before the sprint did. We cancelled two features off the roadmap.” " +
          "— Founder, Meterloop\n\n" +
          "> “First time a contractor's handover doc was still accurate a year later.” — Staff engineer, Northwind",
      }),
      tpl("links", {
        title: "Start here",
        style: "buttons",
        align: "center",
        items: [
          { label: "Full case studies", url: "https://yourname.dev/work", icon: "", description: "" },
          { label: "Availability & rates", url: "https://yourname.dev/booking", icon: "", description: "" },
          { label: "Write to me", url: "mailto:hi@yourname.dev", icon: "", description: "" },
        ],
      }),
      tpl("text", {
        variant: "alert",
        alertType: "TIP",
        body:
          "**Booking from October 2026.** Two client slots open per quarter so the work gets the hours it " +
          "needs; if you need someone next week, I will happily recommend two people who can.",
      }),
    ],
  },
];
