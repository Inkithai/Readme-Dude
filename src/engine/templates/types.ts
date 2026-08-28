import type { Block, BlockType, DocumentKind } from "../schema";

/* ------------------------------------------------------------------ *
 * engine/templates/types.ts — what a preset *is*.
 *
 * A preset is a document factory: it names the document, declares which kind
 * of README it is (the Phase 3 seam), and hands back fresh blocks. No ids, no
 * versioning, no Markdown strings — the block array is the whole product, so a
 * preset stays editable the moment it lands on the canvas.
 * ------------------------------------------------------------------ */

export interface Template {
  /** kebab-case and stable: this is what goes in the URL and in shared links. */
  id: string;
  label: string;
  /** The seam. It decides which gallery a preset belongs to — not which blocks exist. */
  kind: DocumentKind;
  /** One line on the gallery card. Say who it is for, not what it contains. */
  blurb: string;
  /** The document name the preset starts the editor with. */
  docName: string;
  /**
   * Things a preset deliberately leaves for the author, shown when the card is
   * expanded. Presets that pretend to be finished produce READMEs that
   * obviously came from a preset.
   */
  notes: string[];
  /** Fresh blocks with fresh ids — safe to call twice, safe to mutate. */
  blocks: () => Block[];
}

/** What the gallery can show about a preset without rendering the editor. */
export interface TemplatePreview {
  /** Section order, derived from the blocks themselves so it cannot drift. */
  sections: { type: BlockType; label: string }[];
  markdown: string;
}
