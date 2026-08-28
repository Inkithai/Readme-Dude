import { compileDocument } from "../compile";
import { TYPE_LABEL } from "../inspect";
import { reidentify } from "../io";
import type { Block, DocumentKind } from "../schema";
import { PROFILE_TEMPLATES } from "./profile";
import { PROJECT_TEMPLATES } from "./project";
import type { Template, TemplatePreview } from "./types";

/* ------------------------------------------------------------------ *
 * engine/templates/index.ts — the preset registry.
 *
 * Twelve hand-authored documents, exported as data. Nothing in this folder
 * knows about React, the DOM, or the gallery UI: the marketing site the
 * roadmap sketches (docs/TECH-STACK.md §3, "the SEO escape hatch") can import
 * this module and render every preset with the same two functions the editor
 * uses. That is the whole reason templates are engine-level files.
 *
 * Adding a preset = add an object to one array. The gallery, the counts, the
 * per-kind filtering and the test matrix all follow from it.
 * ------------------------------------------------------------------ */

/** Project presets first: they are what most visitors came for. */
export const TEMPLATES: Template[] = [...PROJECT_TEMPLATES, ...PROFILE_TEMPLATES];

export const TEMPLATES_BY_ID: Map<string, Template> = new Map(
  TEMPLATES.map((template) => [template.id, template]),
);

export const getTemplate = (id: string): Template | undefined => TEMPLATES_BY_ID.get(id);

export function templatesForKind(kind: DocumentKind): Template[] {
  return TEMPLATES.filter((template) => template.kind === kind);
}

export function countTemplates(kind?: DocumentKind): number {
  return kind ? templatesForKind(kind).length : TEMPLATES.length;
}

/** Fresh blocks with fresh ids — two applies of one preset never share a block. */
export function blocksFromTemplate(template: Template): Block[] {
  return reidentify(template.blocks());
}

/**
 * Everything the gallery shows when a card is opened, computed from the blocks
 * themselves so a preset can promise a section it forgot to include.
 */
export function previewTemplate(template: Template): TemplatePreview {
  const blocks = template.blocks();
  return {
    sections: blocks.map((block) => ({ type: block.type, label: TYPE_LABEL[block.type] ?? block.type })),
    markdown: compileDocument(blocks),
  };
}

/** The one-line summary the gallery lists under a card: "Hero · Badges · …". */
export function templateSectionLine(template: Template, max = 6): string {
  const { sections } = previewTemplate(template);
  const labels = sections.map((section) => section.label);
  if (labels.length <= max) return labels.join(" · ");
  return `${labels.slice(0, max).join(" · ")} +${labels.length - max} more`;
}

export * from "./build";
export type { Template, TemplatePreview } from "./types";
