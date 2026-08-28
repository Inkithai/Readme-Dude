import { describe, expect, it } from "vitest";
import { shieldsSegment, shieldsUrl } from "../compile";

/* shields.io splits the static-badge path on `-`, so every escaping mistake
   here silently corrupts the badge text or colour rather than erroring. */

describe("shieldsSegment", () => {
  it("uses underscores for spaces, never dashes", () => {
    expect(shieldsSegment("Get started")).toBe("Get_started");
  });

  it("doubles literal dashes", () => {
    expect(shieldsSegment("v1-rc1")).toBe("v1--rc1");
  });

  it("doubles underscores before dashes are escaped", () => {
    expect(shieldsSegment("a_b")).toBe("a__b");
  });

  it("percent-encodes URL-hostile characters but not _ and -", () => {
    expect(shieldsSegment("100% & more")).toBe("100%25_%26_more");
    expect(shieldsSegment("c#")).toBe("c%23");
  });

  it("collapses runs of whitespace", () => {
    expect(shieldsSegment("a  b\tc")).toBe("a_b_c");
  });
});

describe("shieldsUrl", () => {
  it("builds the three-segment label-message-colour form", () => {
    expect(shieldsUrl({ label: "license", message: "MIT", color: "green", style: "flat-square" })).toBe(
      "https://img.shields.io/badge/license-MIT-green?style=flat-square",
    );
  });

  it("builds the two-segment message-colour form when there is no label", () => {
    expect(
      shieldsUrl({ message: "React", color: "#61DAFB", style: "flat", logo: "react", logoColor: "white" }),
    ).toBe("https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=white");
  });

  it("never emits a redundant ?color= alongside a path colour", () => {
    expect(shieldsUrl({ label: "a", message: "b", color: "blue" })).not.toContain("color=blue");
  });

  it("keeps multi-word labels from stealing the colour segment", () => {
    const url = shieldsUrl({ label: "Cloudflare Workers", color: "F48120", logo: "cloudflare" });
    const content = url.split("/badge/")[1]?.split("?")[0] ?? "";
    // A stray single dash would make shields read "Workers" as the message
    // and F48120 as the message colour — so the path must contain one `-`.
    expect(content).toBe("Cloudflare_Workers-F48120");
    expect(content.split("-")).toHaveLength(2);
  });

  it("defaults a missing colour so the URL is never malformed", () => {
    expect(shieldsUrl({ message: "x" })).toBe("https://img.shields.io/badge/x-555?style=flat");
  });
});
