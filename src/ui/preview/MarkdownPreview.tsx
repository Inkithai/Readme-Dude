import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import "github-markdown-css";
import "remark-github-blockquote-alert/alert.css";
import "./highlight-theme.css";

/* ------------------------------------------------------------------ *
 * ui/preview/MarkdownPreview.tsx — "make it look like github.com".
 *
 * Loaded lazily (see App.tsx): this module pulls in the whole unified/rehype
 * pipeline, and measurement in docs/TECH-STACK.md §6 put that pipeline at
 * ~155 kB gzip — too much to block the editor on. It is also *decoration*:
 * the exported README never depends on any of this.
 *
 * Plugin order matters — rehype-raw must run before rehype-sanitize, or
 * `<details>` is either stripped (broken feature) or unsanitized (XSS in
 * pasted markdown).
 * ------------------------------------------------------------------ */

const lowlight = createLowlight();
for (const [name, lang] of [
  ["bash", bash],
  ["sh", bash],
  ["shell", bash],
  ["zsh", bash],
  ["powershell", plaintext],
  ["typescript", typescript],
  ["javascript", javascript],
  ["tsx", typescript],
  ["jsx", javascript],
  ["json", json],
  ["jsonc", json],
  ["yaml", yaml],
  ["yml", yaml],
  ["toml", ini],
  ["ini", ini],
  ["env", ini],
  ["dockerfile", dockerfile],
  ["docker", dockerfile],
  ["python", python],
  ["go", go],
  ["rust", rust],
  ["java", java],
  ["sql", sql],
  ["xml", xml],
  ["html", xml],
  ["css", css],
  ["scss", scss],
  ["markdown", markdown],
  ["md", markdown],
  ["diff", diff],
  ["text", plaintext],
  ["plaintext", plaintext],
] as const) {
  lowlight.register(name, lang);
}

type AttrMap = Record<string, readonly string[]>;
const baseAttributes = (defaultSchema.attributes ?? {}) as AttrMap;
const merge = (key: string, extra: string[]): string[] => [
  ...((baseAttributes[key] as readonly string[] | undefined) ?? []),
  ...extra,
];

/**
 * GitHub-permissive sanitization: we allow the tags README authors actually
 * use (`<details>`, `<img align>`, `<p align>`, `<a name>`) while still
 * rejecting script-bearing markup from pasted content.
 */
const schema = {
  ...defaultSchema,
  tagNames: [
    ...((defaultSchema.tagNames as readonly string[] | undefined) ?? []),
    "details",
    "summary",
    "picture",
    "source",
    "figure",
    "figcaption",
    "kbd",
    "samp",
    "ins",
    "dl",
    "dt",
    "dd",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "div",
    "p",
    "br",
    "hr",
    "center",
  ],
  attributes: {
    ...baseAttributes,
    "*": merge("*", ["align", "dir", "title", "lang"]),
    img: merge("img", ["align", "width", "height", "loading", "srcset"]),
    source: merge("source", ["srcset", "media", "type"]),
    a: merge("a", ["name"]),
    p: merge("p", ["align"]),
    div: merge("div", ["align"]),
    td: merge("td", ["width", "align", "colspan", "rowspan"]),
    th: merge("th", ["width", "align", "colspan", "rowspan"]),
    details: merge("details", ["open"]),
    code: merge("code", ["className"]),
    pre: merge("pre", ["className"]),
    span: merge("span", ["className"]),
  },
  allowedProtocols: {
    img: ["https", "http"],
    a: ["https", "http", "mailto"],
    source: ["https", "http"],
  },
};

export interface MarkdownPreviewProps {
  markdown: string;
  colorMode: "light" | "dark";
}

export default function MarkdownPreview({ markdown, colorMode }: MarkdownPreviewProps) {
  return (
    <div
      className="rs-preview-frame h-full"
      data-color-mode={colorMode}
      data-light-theme="light"
      data-dark-theme="dark"
    >
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkAlert]}
          rehypePlugins={[
            [rehypeRaw],
            [rehypeSanitize, schema],
            [rehypeHighlight, { lowlight, ignoreMissing: true }],
            [rehypeSlug],
          ]}
        >
          {markdown}
        </ReactMarkdown>
        {markdown.trim().length === 0 ? (
          <p className="text-zinc-500 italic">Nothing to preview yet — add a block to the canvas.</p>
        ) : null}
      </div>
    </div>
  );
}
