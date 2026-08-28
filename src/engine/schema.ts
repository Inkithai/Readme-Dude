import { z } from "zod";

/* ------------------------------------------------------------------ *
 * engine/schema.ts — the document model (roadmap Phase 0 + Phase 1)
 *
 * Rule enforced by this project: nothing in `src/engine/**` may import
 * React or touch the DOM. The engine is pure data → Markdown, which is
 * what makes the compiler testable and the whole product portable.
 * ------------------------------------------------------------------ */

/** Stable, sortable, serializable block identifiers. */
export function newBlockId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `blk_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/* ---------------------------- shared bits ---------------------------- */

const url = z.string().trim();
const text = z.string();

/** A call-to-action / link rendered as a shields.io-style button. */
export const ButtonSchema = z.object({
  label: text.min(1, "Label is required"),
  url: url.min(1, "URL is required"),
});
export type Button = z.infer<typeof ButtonSchema>;

export const FeatureItemSchema = z.object({
  /** Emoji or GitHub emoji shortcode (":sparkles:") shown before the title. */
  icon: text.default(""),
  title: text.min(1, "Feature title is required"),
  body: text.default(""),
});
export type FeatureItem = z.infer<typeof FeatureItemSchema>;

export const BadgeItemSchema = z.object({
  /** alt text, and the visible label when built from shields.io */
  alt: text.min(1, "Badge alt text is required"),
  /** Full image URL (shields.io, img.shields.io endpoint, or any CDN). */
  imageUrl: url.min(1, "Badge image URL is required"),
  /** Optional wrapping link — GitHub renders the <img> inside an <a>. */
  linkUrl: url.default(""),
});
export type BadgeItem = z.infer<typeof BadgeItemSchema>;

export const TechItemSchema = z.object({
  name: text.min(1, "Name is required"),
  /** simple-icons slug, used for shields.io `logo=` (empty → no logo). */
  slug: text.default(""),
  /** Brand hex colour, no leading `#`. */
  hex: text.default(""),
});
export type TechItem = z.infer<typeof TechItemSchema>;

export const StepSchema = z.object({
  title: text.min(1, "Step title is required"),
  body: text.default(""),
  language: text.default("bash"),
  code: text.default(""),
});
export type Step = z.infer<typeof StepSchema>;

export const ExampleSchema = z.object({
  title: text.default(""),
  body: text.default(""),
  language: text.default("typescript"),
  code: text.default(""),
});
export type Example = z.infer<typeof ExampleSchema>;

export const TableBlockSchema = z.object({
  title: text.default("Table"),
  columns: z.array(text).min(1),
  rows: z.array(z.array(text)),
  /** Per-column alignment; missing entries default to "left". */
  alignment: z.array(z.enum(["left", "center", "right"])).default([]),
});

/* ------------------------------ blocks ------------------------------ */

export const HeroBlock = z.object({
  id: z.string(),
  type: z.literal("hero"),
  hidden: z.boolean().default(false),
  props: z.object({
    align: z.enum(["center", "left"]).default("center"),
    logoUrl: url.default(""),
    logoWidth: z.number().int().positive().max(1000).default(96),
    title: text.min(1, "Hero title is required"),
    subtitle: text.default(""),
    buttons: z.array(ButtonSchema).default([]),
  }),
});

export const HeadingBlock = z.object({
  id: z.string(),
  type: z.literal("heading"),
  hidden: z.boolean().default(false),
  props: z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    text: text.min(1, "Heading text is required"),
    emoji: text.default(""),
  }),
});

export const TextBlock = z.object({
  id: z.string(),
  type: z.literal("text"),
  hidden: z.boolean().default(false),
  props: z.object({
    variant: z.enum(["paragraph", "quote", "alert"]).default("paragraph"),
    alertType: z.enum(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]).default("NOTE"),
    /** Markdown/GFM allowed — this block is a passthrough by design. */
    body: text.default(""),
  }),
});

export const FeaturesBlock = z.object({
  id: z.string(),
  type: z.literal("features"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default("Key Features"),
    showTitle: z.boolean().default(true),
    layout: z.enum(["bullets", "numbered", "icon-text", "cards-2", "cards-3"]).default("bullets"),
    items: z.array(FeatureItemSchema).default([]),
  }),
});

export const ImageBlock = z.object({
  id: z.string(),
  type: z.literal("image"),
  hidden: z.boolean().default(false),
  props: z.object({
    url: url.min(1, "Image URL is required"),
    alt: text.default("Screenshot"),
    width: z.number().int().positive().max(2400).default(800),
    align: z.enum(["left", "center", "right"]).default("center"),
    caption: text.default(""),
    linkUrl: url.default(""),
  }),
});

export const CodeBlock = z.object({
  id: z.string(),
  type: z.literal("code"),
  hidden: z.boolean().default(false),
  props: z.object({
    language: text.default("typescript"),
    filename: text.default(""),
    body: text.default(""),
  }),
});

export const TableBlock = z.object({
  id: z.string(),
  type: z.literal("table"),
  hidden: z.boolean().default(false),
  props: TableBlockSchema,
});

export const BadgesBlock = z.object({
  id: z.string(),
  type: z.literal("badges"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default(""),
    align: z.enum(["center", "left"]).default("center"),
    /** shields.io style, applied to badges built with the generator. */
    style: z.enum(["flat", "flat-square", "for-the-badge", "social", "plastic"]).default("flat-square"),
    items: z.array(BadgeItemSchema).default([]),
  }),
});

export const TechStackBlock = z.object({
  id: z.string(),
  type: z.literal("techstack"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default("Tech Stack"),
    variant: z.enum(["badges", "list", "table", "grouped"]).default("badges"),
    style: z.enum(["flat", "flat-square", "for-the-badge", "social", "plastic"]).default("flat"),
    groups: z
      .array(z.object({ category: text.default("General"), items: z.array(TechItemSchema).default([]) }))
      .default([]),
  }),
});

export const InstallationBlock = z.object({
  id: z.string(),
  type: z.literal("installation"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default("Installation"),
    intro: text.default(""),
    steps: z.array(StepSchema).default([]),
  }),
});

export const UsageBlock = z.object({
  id: z.string(),
  type: z.literal("usage"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default("Usage"),
    intro: text.default(""),
    examples: z.array(ExampleSchema).default([]),
  }),
});

export const LicenseBlock = z.object({
  id: z.string(),
  type: z.literal("license"),
  hidden: z.boolean().default(false),
  props: z.object({
    title: text.default("License"),
    /** Markdown body; `${year}` and `${author}` are substituted. */
    notice: text.default("Distributed under the MIT License. See `LICENSE` for more information."),
    url: url.default(""),
    year: z.string().default(() => String(new Date().getFullYear())),
    author: text.default(""),
  }),
});

/* --------------------------- the union --------------------------- */

export const BlockSchema = z.discriminatedUnion("type", [
  HeroBlock,
  HeadingBlock,
  TextBlock,
  FeaturesBlock,
  ImageBlock,
  CodeBlock,
  TableBlock,
  BadgesBlock,
  TechStackBlock,
  InstallationBlock,
  UsageBlock,
  LicenseBlock,
]);
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;
export type PropsOf<T extends BlockType> = BlockOf<T>["props"];

/** The document envelope — versioned so localStorage/format never traps us. */
export const DocumentSchema = z.object({
  version: z.literal(1),
  name: z.string().default("untitled"),
  blocks: z.array(BlockSchema),
});
export type ReadmeDocument = z.infer<typeof DocumentSchema>;

export type BlockCategory = "structure" | "content" | "media" | "project";

export interface BlockDefinition {
  type: BlockType;
  label: string;
  category: BlockCategory;
  /** One-line description shown in the palette. */
  hint: string;
  create: () => Block;
}

const make = <T extends BlockType>(type: T, props: unknown): Block => {
  const parsed = BlockSchema.parse({ id: newBlockId(), type, hidden: false, props });
  return parsed;
};

/**
 * Registry: the single source of truth for which blocks exist, what they're
 * called, and what a fresh instance contains. Phase 3 templates are just
 * curated arrays of these objects.
 */
export const BLOCKS: Record<BlockType, BlockDefinition> = {
  hero: {
    type: "hero",
    label: "Hero",
    category: "structure",
    hint: "Logo, title, tagline and CTA buttons",
    create: () =>
      make("hero", {
        align: "center",
        logoUrl: "",
        logoWidth: 96,
        title: "Project Name",
        subtitle: "One sentence that explains what this project does and why it exists.",
        buttons: [],
      }),
  },
  heading: {
    type: "heading",
    label: "Heading",
    category: "structure",
    hint: "Section title (H1–H3)",
    create: () => make("heading", { level: 2, text: "Section", emoji: "" }),
  },
  text: {
    type: "text",
    label: "Text",
    category: "content",
    hint: "Paragraph, quote or GitHub alert",
    create: () =>
      make("text", {
        variant: "paragraph",
        alertType: "NOTE",
        body: "Write markdown here. **Bold**, `code` and [links](https://example.com) all work.",
      }),
  },
  features: {
    type: "features",
    label: "Features",
    category: "content",
    hint: "Feature list or card grid",
    create: () =>
      make("features", {
        title: "Key Features",
        showTitle: true,
        layout: "bullets",
        items: [
          { icon: "⚡", title: "Fast", body: "Why it matters." },
          { icon: "🔒", title: "Secure", body: "Why it matters." },
          { icon: "🧩", title: "Extensible", body: "Why it matters." },
        ],
      }),
  },
  image: {
    type: "image",
    label: "Screenshot",
    category: "media",
    hint: "Single image with caption",
    create: () =>
      make("image", {
        url: "https://placehold.co/900x480/png?text=Screenshot",
        alt: "Screenshot",
        width: 900,
        align: "center",
        caption: "",
        linkUrl: "",
      }),
  },
  code: {
    type: "code",
    label: "Code",
    category: "content",
    hint: "Fenced code block",
    create: () =>
      make("code", {
        language: "bash",
        filename: "",
        body: "npm install",
      }),
  },
  table: {
    type: "table",
    label: "Table",
    category: "content",
    hint: "GFM pipe table",
    create: () =>
      make("table", {
        title: "Comparison",
        columns: ["Feature", "This project", "The alternative"],
        rows: [
          ["Visual builder", "yes", "no"],
          ["Offline", "yes", "no"],
        ],
        alignment: ["left", "center", "center"],
      }),
  },
  badges: {
    type: "badges",
    label: "Badges",
    category: "media",
    hint: "shields.io status badges",
    create: () =>
      make("badges", {
        title: "",
        align: "center",
        style: "flat-square",
        items: [
          {
            alt: "license",
            imageUrl: "https://img.shields.io/badge/license-MIT-green?style=flat-square",
            linkUrl: "",
          },
        ],
      }),
  },
  techstack: {
    type: "techstack",
    label: "Tech stack",
    category: "project",
    hint: "Languages, frameworks, tools",
    create: () =>
      make("techstack", {
        title: "Tech Stack",
        variant: "badges",
        style: "flat",
        groups: [
          {
            category: "Core",
            items: [
              { name: "TypeScript", slug: "typescript", hex: "3178C6" },
              { name: "React", slug: "react", hex: "61DAFB" },
            ],
          },
        ],
      }),
  },
  installation: {
    type: "installation",
    label: "Installation",
    category: "project",
    hint: "Numbered setup steps with commands",
    create: () =>
      make("installation", {
        title: "Installation",
        intro: "",
        steps: [
          {
            title: "Clone the repository",
            body: "",
            language: "bash",
            code: "git clone https://github.com/you/repo.git",
          },
          { title: "Install dependencies", body: "", language: "bash", code: "npm install" },
        ],
      }),
  },
  usage: {
    type: "usage",
    label: "Usage",
    category: "project",
    hint: "Examples with code",
    create: () =>
      make("usage", {
        title: "Usage",
        intro: "",
        examples: [
          {
            title: "Basic usage",
            body: "",
            language: "typescript",
            code: "import { x } from 'your-lib';\n\nx();",
          },
        ],
      }),
  },
  license: {
    type: "license",
    label: "License",
    category: "project",
    hint: "License notice and link",
    create: () => make("license", {}),
  },
};

export const BLOCK_ORDER: BlockType[] = Object.keys(BLOCKS) as BlockType[];

export const CATEGORY_LABEL: Record<BlockCategory, string> = {
  structure: "Structure",
  content: "Content",
  media: "Media",
  project: "Project",
};

/** Create a fresh block of a given type (used by the palette). */
export function createBlock(type: BlockType): Block {
  return BLOCKS[type].create();
}

/** Deep-copy a block with a new id (used by "duplicate"). */
export function cloneBlock(block: Block): Block {
  const copy = structuredClone(block);
  return { ...copy, id: newBlockId() };
}
