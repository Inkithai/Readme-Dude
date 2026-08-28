// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { compiled, FIDELITY_CASES, normalize } from "@/engine/__tests__/fidelity-rules";
import MarkdownPreview from "@/ui/preview/MarkdownPreview";

/* ------------------------------------------------------------------ *
 * Preview fidelity: every rule in engine/__tests__/fidelity-rules.ts is
 * asserted against the HTML our preview produces.
 *
 * This is the test that catches a preview that flatters the export — a block
 * that looks right here and wrong on github.com is the failure mode the whole
 * product exists to avoid, and neither the unit tests (string level) nor the
 * golden file (also string level) can see it.
 * ------------------------------------------------------------------ */

function previewHtml(markdown: string): string {
  const { container } = render(<MarkdownPreview markdown={markdown} colorMode="light" />);
  return normalize(container.innerHTML);
}

describe("preview matches the fidelity rules", () => {
  for (const testCase of FIDELITY_CASES) {
    it(testCase.name, () => {
      const html = previewHtml(compiled(testCase.type, testCase.props));
      expect(html).not.toBe("");
      testCase.assert(html);
    });
  }

  it("renders no stray HTML-escaping artefacts", () => {
    const html = previewHtml(
      [
        compiled("heading", { text: "C# & F# notes", level: 2 }),
        compiled("code", { language: "bash", body: "echo '<tag>' && cat a.md" }),
      ].join("\n\n"),
    );
    // normalize() decodes entities on purpose: innerHTML and GitHub's HTML
    // differ in whether they escape `&`, which is not a fidelity question.
    expect(html).toContain("C# & F# notes");
    expect(html).toContain("&lt;tag&gt;");
    expect(html).not.toContain("&amp;lt;");
  });
});
