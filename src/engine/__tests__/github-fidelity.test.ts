import { describe, expect, test } from "vitest";
import { compiled, FIDELITY_CASES, normalize } from "./fidelity-rules";

/* ------------------------------------------------------------------ *
 * The oracle: GitHub's own Markdown renderer.
 *
 * Everything else in this suite proves that *we* agree with *ourselves*.
 * `POST /api.github.com/markdown` (mode: gfm) is the renderer github.com uses
 * for a README body, so a rule that passes here is a rule about GitHub.
 *
 * Opt-in, because CI must not depend on the network and the unauthenticated
 * rate limit is per IP:
 *
 *   GFM_FIDELITY=1 npx vitest run src/engine/__tests__/github-fidelity.test.ts
 *
 * Behind a TLS-terminating proxy, Node needs the CA or every request dies with
 * "unable to verify the first certificate":
 *
 *   NODE_EXTRA_CA_CERTS=/path/to/proxy-ca.crt GFM_FIDELITY=1 npx vitest run …
 *
 * A request that cannot be made skips rather than fails: a red network test in
 * a locked-down sandbox is noise that trains everyone to ignore the suite.
 * ------------------------------------------------------------------ */

const enabled = process.env.GFM_FIDELITY === "1";

async function renderOnGithub(markdown: string): Promise<string> {
  const response = await fetch("https://api.github.com/markdown", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ text: markdown, mode: "gfm" }),
  });
  if (!response.ok) {
    throw new Error(`github responded ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
  return await response.text();
}

describe.skipIf(!enabled)("GitHub's own renderer (oracle)", () => {
  for (const testCase of FIDELITY_CASES) {
    test(testCase.name, async (context) => {
      const markdown = compiled(testCase.type, testCase.props);
      let raw: string;
      try {
        raw = await renderOnGithub(markdown);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/fetch failed|certificate|ECONN|ETIMEDOUT|network|socket/i.test(message)) return context.skip();
        throw error;
      }
      const html = normalize(raw);
      expect(html, `rendered HTML for “${testCase.name}”`).not.toBe("");
      testCase.assert(html);
    }, 25_000);
  }
});
