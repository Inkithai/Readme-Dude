import techBrands from "../../data/tech-brands.json";
import { shieldsUrl } from "../compile";
import { type BadgeItem, type Block, type BlockType, createBlock, type TechItem } from "../schema";

/* ------------------------------------------------------------------ *
 * engine/templates/build.ts — the vocabulary presets are written in.
 *
 * Templates are authored as data, never as Markdown text (docs/TECH-STACK.md
 * §2: "templates/ — .ts files that emit Block[], never .md files"). Two
 * reasons, both load-bearing:
 *
 *  1. A preset made of blocks is *editable* — the user can delete a section,
 *     switch the feature layout, keep the badges. A preset made of Markdown
 *     can only be pasted, which is what every generator on the market does.
 *  2. A preset made of Markdown is untestable against the compiler: it would
 *     encode today's output format and rot the first time `compile.ts` changes.
 *     These presets go *through* the compiler, so `npm test` proves all twelve
 *     still render.
 *
 * Like the rest of the engine this file imports no React and touches no DOM.
 * ------------------------------------------------------------------ */

/**
 * A preset block: the registry's defaults for its type, with only the fields
 * the preset actually cares about written out. Merging over `createBlock()` is
 * what keeps twelve presets short — and it is why adding a required prop to a
 * block schema cannot break a template: the default is always there underneath.
 */
export function tpl<T extends BlockType>(type: T, props: Record<string, unknown> = {}): Block {
  const base = createBlock(type);
  return { ...base, props: { ...(base.props as Record<string, unknown>), ...props } } as Block;
}

/* ------------------------------ tech brands ------------------------------ */

type BrandRow = { name: string; slug: string; hex: string };

/**
 * Generated from `simple-icons` by `npm run brands` (scripts/gen-tech-brands.mjs).
 * Presets name technologies the way a human writes them and the slug/hex come
 * from here, so a preset can never ship a wrong brand colour or a typo'd
 * shields.io logo — and `templates.test.ts` asserts every name resolves.
 */
const BRANDS: readonly BrandRow[] = techBrands as BrandRow[];
const BY_NAME = new Map<string, BrandRow>(BRANDS.map((row) => [row.name.toLowerCase(), row]));

export const BRAND_NAMES: string[] = BRANDS.map((row) => row.name);

/** Unknown names degrade to a name-only badge (no logo, neutral colour). */
export function brand(name: string): TechItem {
  const hit = BY_NAME.get(name.toLowerCase());
  return { name: hit?.name ?? name, slug: hit?.slug ?? "", hex: hit?.hex ?? "" };
}

export function brandGroup(category: string, names: string[]): { category: string; items: TechItem[] } {
  return { category, items: names.map(brand) };
}

/* -------------------------------- badges -------------------------------- */

/** A ready-made shields.io badge as a `badges` block item. */
export function badge(
  alt: string,
  spec: {
    label?: string;
    message?: string;
    color?: string;
    style?: string;
    logo?: string;
    logoColor?: string;
    labelColor?: string;
  },
  linkUrl = "",
): BadgeItem {
  return { alt, imageUrl: shieldsUrl(spec), linkUrl };
}

/**
 * Per-network colour + logo, for the "find me here" rows profile READMEs are
 * built from. Unknown keys fall back to a plain indigo pill rather than
 * dropping the link: a badge without a logo is a cosmetic miss, a missing
 * contact link is a real one. (An unrecognised `logo=` is ignored by
 * shields.io, so these degrade the same way on their own.)
 */
export const NETWORKS: Record<string, { label: string; color: string; logo: string }> = {
  github: { label: "GitHub", color: "181717", logo: "github" },
  x: { label: "X", color: "000000", logo: "x" },
  linkedin: { label: "LinkedIn", color: "0A66C2", logo: "linkedin" },
  youtube: { label: "YouTube", color: "FF0000", logo: "youtube" },
  instagram: { label: "Instagram", color: "E4405F", logo: "instagram" },
  mastodon: { label: "Mastodon", color: "6364FF", logo: "mastodon" },
  devto: { label: "Dev.to", color: "0A0A0A", logo: "devdotto" },
  medium: { label: "Medium", color: "000000", logo: "medium" },
  twitch: { label: "Twitch", color: "9146FF", logo: "twitch" },
  telegram: { label: "Telegram", color: "26A5E4", logo: "telegram" },
  stackoverflow: { label: "Stack Overflow", color: "F48024", logo: "stackoverflow" },
  dribbble: { label: "Dribbble", color: "EA4C89", logo: "dribbble" },
  behance: { label: "Behance", color: "1769FF", logo: "behance" },
  website: { label: "Website", color: "0891B2", logo: "googlechrome" },
  email: { label: "Email", color: "EA4335", logo: "gmail" },
};

export function socialBadge(network: string, text: string, url: string): BadgeItem {
  const known = NETWORKS[network];
  return badge(
    `${known?.label ?? network} — ${text}`,
    {
      label: known?.label ?? network,
      message: text,
      color: known?.color ?? "4F46E5",
      style: "for-the-badge",
      logo: known?.logo,
      logoColor: "white",
    },
    url,
  );
}

/* ---------------------------- third-party cards ---------------------------- */

/**
 * The image services profile READMEs are known for. These are *user-visible*
 * URLs baked into a README that outlives this app, so they are chosen for how
 * stable the project is, and each one is a plain image URL — nothing is
 * fetched here, and the preset still works if the service is down (GitHub just
 * shows the alt text).
 *
 * One honest caveat every profile preset repeats in its notes: a README image
 * is one static file, so GitHub cannot swap it between light and dark mode.
 * These cards are styled for the dark canvas, which reads fine on light too.
 */
const statsBase = (user: string): string =>
  `bg_color=0d1117&border_color=30363d&show_icons=true&icon_color=639bff&title_color=f0f6fc&text_color=94a3b8&hide_border=true&count_private=true&include_all_commits=true&cache_seconds=86400&username=${encodeURIComponent(user)}`;

export const STATS_URLS = {
  stats: (user: string): string => `https://github-readme-stats.vercel.app/api?${statsBase(user)}`,
  langs: (user: string): string =>
    `https://github-readme-stats.vercel.app/api/top-langs/?layout=compact&hide=CSS,HTML&${statsBase(user)}`,
  streak: (user: string): string =>
    `https://streak-stats.demolab.com/?${statsBase(user).replace("&count_private=true", "").replace("&include_all_commits=true", "")}`,
  trophies: (user: string): string =>
    `https://github-profile-trophy.vercel.app/?username=${encodeURIComponent(user)}&theme=algolia&no-frame=true&no-bg=true&column=7&row=1`,
  graph: (user: string): string =>
    `https://github-readme-activity-graph.vercel.app/graph?username=${encodeURIComponent(user)}&bg_color=0d1117&color=94a3b8&line=639bff&point=f0f6fc&area=true&hide_border=true&custom_title=Contribution%20graph%20(last%2031%20days)`,
  /** Page-view counter; the only one of these that needs no configuration. */
  views: (user: string): string =>
    `https://komarev.com/ghpvc/?username=${encodeURIComponent(user)}&style=for-the-badge&color=1f6feb&label=profile+views`,
};

/**
 * A centred row of image cards, as raw HTML. Why a `text` block instead of N
 * `image` blocks: the Image block centres one image per block, and profile
 * READMEs want two cards *side by side*, which is only expressible as HTML.
 * Self-closed `<img />` keeps `validate.ts`'s img-not-self-closed info quiet.
 */
export function cardRow(cards: { src: string; alt: string; height?: number }[]): string {
  const imgs = cards
    .map((card) => {
      const height = card.height ? ` height="${card.height}"` : "";
      return `  <img src="${card.src}" alt="${card.alt.replace(/"/g, "&quot;")}"${height} />`;
    })
    .join("\n");
  return [`<p align="center">`, imgs, `</p>`].join("\n");
}

/** The same row, as a Text block — the shape presets actually store. */
export function cardRowBlock(cards: { src: string; alt: string; height?: number }[]): Block {
  return tpl("text", { variant: "paragraph", body: cardRow(cards) });
}
