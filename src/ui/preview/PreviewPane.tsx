import {
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  FileCode2,
  Info,
  Monitor,
  Moon,
  Smartphone,
  Sun,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { type Issue, summarizeIssues, validateDocument } from "@/engine";
import { copyToClipboard, formatBytes, utf8Bytes } from "@/lib/export";
import { storage } from "@/lib/storage";
import { useBlocks, useDocument } from "@/store/document";
import { Btn } from "@/ui/editor/Fields";

/* ------------------------------------------------------------------ *
 * ui/preview/PreviewPane.tsx — the right-hand pane: GitHub preview,
 * raw Markdown, and the correctness report.
 *
 * The Raw tab is not a convenience, it is the roadmap's Pillar 3 safety
 * valve: the preview is an approximation of GitHub, the Markdown is the
 * thing users actually ship. Keeping both one click apart means a rendering
 * difference is always one click from being *seen* rather than discovered in
 * the repo.
 * ------------------------------------------------------------------ */

const MarkdownPreview = lazy(() => import("./MarkdownPreview"));

type Tab = "preview" | "markdown" | "issues";

const TAB_KEY = "readme-buddy:tab";
type Width = "fill" | "desktop" | "mobile";

function usePersistedTab(): [Tab, (tab: Tab) => void] {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = storage.get(TAB_KEY) ?? storage.get("readme-studio:tab");
    return saved === "markdown" || saved === "issues" || saved === "preview" ? saved : "preview";
  });
  return [
    tab,
    (next) => {
      setTab(next);
      storage.set(TAB_KEY, next);
    },
  ];
}

function IssueRow({ issue, index }: { issue: Issue; index: number }) {
  const toggleExpand = useDocument((s) => s.toggleExpand);
  const Icon = issue.level === "error" ? CircleAlert : issue.level === "warning" ? Info : CircleCheck;
  const tone =
    issue.level === "error"
      ? "text-rose-300"
      : issue.level === "warning"
        ? "text-amber-300"
        : "text-zinc-400";
  return (
    <li className="rounded-md border border-zinc-800/80 bg-zinc-900/40 p-2">
      <div className="flex items-start gap-2">
        <Icon size={13} className={`mt-0.5 shrink-0 ${tone}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] leading-snug ${tone}`}>{issue.message}</p>
          {issue.fix ? <p className="mt-0.5 text-[11px] text-zinc-500">{issue.fix}</p> : null}
          <p className="mt-1 font-mono text-[10px] text-zinc-600">
            #{index + 1} {issue.rule}
            {issue.blockId ? " · block" : ""}
          </p>
        </div>
        {issue.blockId ? (
          <Btn size="xs" variant="outline" onClick={() => toggleExpand(issue.blockId as string)}>
            Open block
          </Btn>
        ) : null}
      </div>
    </li>
  );
}

export function PreviewPane({ markdown }: { markdown: string }) {
  const blocks = useBlocks();
  const kind = useDocument((s) => s.kind);
  const [tab, setTab] = usePersistedTab();
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState<Width>("fill");
  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);

  const issues = useMemo(() => validateDocument(blocks, markdown, { kind }), [blocks, markdown, kind]);
  const counts = useMemo(() => summarizeIssues(issues), [issues]);
  const bytes = useMemo(() => utf8Bytes(markdown), [markdown]);

  const maxWidth = width === "desktop" ? "1012px" : width === "mobile" ? "420px" : "none";

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-zinc-800/80 bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 px-2 py-1.5">
        <div
          role="tablist"
          aria-label="Preview mode"
          className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5"
        >
          {(
            [
              { id: "preview", label: "Preview", icon: Eye },
              { id: "markdown", label: "Markdown", icon: FileCode2 },
              { id: "issues", label: "Checks", icon: CircleAlert },
            ] as const
          ).map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`rs-tab-${entry.id}`}
                aria-selected={active}
                aria-controls="rs-preview-panel"
                onClick={() => setTab(entry.id)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  active ? "bg-indigo-500/20 text-indigo-200" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <entry.icon size={12} />
                {entry.label}
                {entry.id === "issues" && counts.errors + counts.warnings > 0 ? (
                  <span className="rounded bg-rose-500/20 px-1 text-[9.5px] font-semibold text-rose-300">
                    {counts.errors + counts.warnings}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5">
          {tab === "preview" ? (
            <>
              <Btn
                size="xs"
                title="Fill width"
                onClick={() => setWidth("fill")}
                className={width === "fill" ? "text-indigo-300" : ""}
              >
                <Monitor size={13} />
              </Btn>
              <Btn
                size="xs"
                title="Desktop width (1012px)"
                onClick={() => setWidth("desktop")}
                className={width === "desktop" ? "text-indigo-300" : ""}
              >
                <Monitor size={13} className="scale-x-75" />
              </Btn>
              <Btn
                size="xs"
                title="Mobile width (420px)"
                onClick={() => setWidth("mobile")}
                className={width === "mobile" ? "text-indigo-300" : ""}
              >
                <Smartphone size={13} />
              </Btn>
              <span className="mx-1 h-3.5 w-px bg-zinc-800" />
              <Btn
                size="xs"
                title={colorMode === "light" ? "Switch to GitHub dark" : "Switch to GitHub light"}
                onClick={() => setColorMode(colorMode === "light" ? "dark" : "light")}
              >
                {colorMode === "light" ? <Moon size={13} /> : <Sun size={13} />}
              </Btn>
            </>
          ) : null}
          {tab === "markdown" ? (
            <Btn
              size="xs"
              variant="outline"
              onClick={async () => {
                const ok = await copyToClipboard(markdown);
                setCopied(ok);
                setCopyBlocked(!ok);
                setTimeout(() => {
                  setCopied(false);
                  setCopyBlocked(false);
                }, 1600);
              }}
            >
              <Copy size={12} /> {copied ? "Copied" : copyBlocked ? "Copy blocked" : "Copy"}
            </Btn>
          ) : null}
        </div>
      </header>

      <div
        id="rs-preview-panel"
        role="tabpanel"
        aria-labelledby={`rs-tab-${tab}`}
        className="rs-scroll min-h-0 flex-1 overflow-auto"
      >
        {tab === "preview" ? (
          <div className="min-h-full p-3" style={{ maxWidth, marginInline: "auto" }}>
            <Suspense
              fallback={
                <div className="grid h-40 place-items-center rounded-lg border border-zinc-800/70 text-[12px] text-zinc-600">
                  Loading GitHub renderer…
                </div>
              }
            >
              <MarkdownPreview markdown={markdown} colorMode={colorMode} />
            </Suspense>
          </div>
        ) : null}

        {tab === "markdown" ? (
          // Never show placeholder text *as* the document: this pane is the one
          // place users check what they are about to ship, and a fake `# empty
          // README` line would be copied, selected and pasted like a real one.
          markdown ? (
            <pre className="min-h-full p-3 font-mono text-[11.5px] leading-[1.65] whitespace-pre text-zinc-300">
              {markdown}
            </pre>
          ) : (
            <p className="p-6 text-center text-[12px] text-zinc-600">
              This document has no Markdown yet — add a block, or un-hide hidden ones.
            </p>
          )
        ) : null}

        {tab === "issues" ? (
          <div className="p-3">
            <div className="mb-2.5 flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2">
              <span className="text-[11px] text-zinc-400">
                {counts.errors === 0 && counts.warnings === 0
                  ? "Looks GitHub-safe."
                  : `${counts.errors} blocking · ${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}`}
              </span>
              <span className="ml-auto font-mono text-[10px] text-zinc-600">
                {markdown.split("\n").length} lines · {formatBytes(bytes)}
              </span>
            </div>
            {issues.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-8 text-center text-[12px] text-zinc-600">
                Nothing to fix. Import/paste paths are checked in Phase 5; this validates what the compiler
                emits.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {issues.map((issue, index) => (
                  <IssueRow key={`${issue.rule}-${index}`} issue={issue} index={index} />
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
