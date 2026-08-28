// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { getTemplate, TEMPLATES } from "@/engine/templates";
import { history, useDocument } from "@/store/document";

/* ------------------------------------------------------------------ *
 * ui/__tests__/templates.test.tsx — the preset gallery as a user touches it.
 *
 * The engine proves a preset compiles; only the DOM proves the gestures: that
 * the rail can be switched from the canvas, that applying on an empty document
 * is one click and on a written one is two (with the warning in between), and
 * that the document's kind visibly follows the family you applied.
 * ------------------------------------------------------------------ */

const state = () => useDocument.getState();
const railTab = (name: "Blocks" | "Templates") => screen.getByRole("tab", { name });
/** The gallery is a lazy chunk, so opening it is an await, not a click. */
const openGallery = async () => {
  fireEvent.click(railTab("Templates"));
  await screen.findByRole("list", { name: "README presets" });
};
const presets = () => within(screen.getByRole("list", { name: "README presets" }));
const openCard = (label: RegExp) => {
  fireEvent.click(presets().getByRole("button", { name: label }));
};

describe("template gallery", () => {
  beforeEach(() => {
    localStorage.clear();
    state().replaceBlocks([]);
    state().setName("untitled");
    state().setKind("project");
    state().setRail("blocks");
    history.clear();
  });
  afterEach(() => cleanup());

  it("opens from the canvas's empty state", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /start from a preset/i }));
    await screen.findByRole("list", { name: "README presets" });
    expect(railTab("Templates").getAttribute("aria-selected")).toBe("true");
    expect(presets().getAllByRole("listitem")).toHaveLength(8);
  });

  it("opens from the toolbar, and still lists presets after work exists", async () => {
    render(<App />);
    act(() => state().addBlock("hero"));
    fireEvent.click(screen.getByRole("button", { name: "Open templates" }));
    await screen.findByRole("list", { name: "README presets" });
    expect(presets().getAllByRole("listitem")).toHaveLength(8);
    expect(screen.queryByText(/Your README is empty/)).toBeNull();
  });

  it("switches to the profile family and shows its four presets", async () => {
    render(<App />);
    await openGallery();
    fireEvent.click(screen.getByRole("radio", { name: "Profile README" }));
    expect(presets().getAllByRole("listitem")).toHaveLength(4);
    expect(presets().getByText(/Full profile/)).toBeTruthy();
  });

  it("applies a preset on an empty document in one click, and it lands on the canvas", async () => {
    render(<App />);
    await openGallery();
    openCard(/Minimal project/);
    fireEvent.click(presets().getByRole("button", { name: /Use this/ }));

    const template = getTemplate("minimal-project");
    if (!template) throw new Error("preset missing");
    expect(state().blocks).toHaveLength(template.blocks().length);
    expect(state().name).toBe("minimal-project");
    expect(screen.getByRole("list", { name: "Document blocks" })).toBeTruthy();
    // The rail is still on Templates, so applying must not feel like a page change.
    expect(railTab("Templates").getAttribute("aria-selected")).toBe("true");
  });

  it("adopts the document kind from the preset family that was applied", async () => {
    render(<App />);
    await openGallery();
    fireEvent.click(screen.getByRole("radio", { name: "Profile README" }));
    openCard(/Developer profile/);
    fireEvent.click(presets().getByRole("button", { name: /Use this/ }));
    expect(state().kind).toBe("profile");
    expect(screen.getByRole("radio", { name: "profile" }).getAttribute("aria-checked")).toBe("true");
  });

  it("asks before replacing a document that already has content", async () => {
    render(<App />);
    act(() => {
      state().addBlock("hero");
      state().addBlock("hero");
    });
    await openGallery();
    openCard(/CLI tool/);
    fireEvent.click(presets().getByRole("button", { name: /Use instead/ }));
    // The warning is the click's only effect…
    expect(screen.getByText(/Replace your 2 blocks/)).toBeTruthy();
    expect(state().blocks).toHaveLength(2);
    // …and backing out keeps everything.
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(state().blocks.map((b) => b.type)).toEqual(["hero", "hero"]);
    expect(state().name).toBe("untitled");

    fireEvent.click(presets().getByRole("button", { name: /Use instead/ }));
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(state().blocks[0]?.type).toBe("hero");
    expect(state().name).toBe("my-cli");
  });

  it("can append a preset's sections instead of replacing the document", async () => {
    render(<App />);
    act(() => state().addBlock("heading"));
    await openGallery();
    openCard(/HTTP API/);
    const before = state().blocks.length;
    fireEvent.click(presets().getByRole("button", { name: /Append/ }));
    expect(state().blocks).toHaveLength(before + (getTemplate("http-api")?.blocks().length ?? 0));
    expect(state().blocks[0]?.type).toBe("heading");
    expect(state().name).toBe("untitled");
    expect(state().kind).toBe("project");
  });

  it("shows the exact Markdown a preset produces", async () => {
    render(<App />);
    await openGallery();
    openCard(/Professional project/);
    const preview = presets().getByText(/img\.shields\.io\/badge\//);
    expect(preview.textContent).toContain("<h1>Acme Platform</h1>");
  });

  it("undoes an applied preset back to the empty document, kind included", async () => {
    render(<App />);
    await openGallery();
    fireEvent.click(screen.getByRole("radio", { name: "Profile README" }));
    openCard(/Minimal profile/);
    fireEvent.click(presets().getByRole("button", { name: /Use this/ }));
    expect(state().blocks.length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(state().blocks).toHaveLength(0);
    expect(state().kind).toBe("project");
  });

  it("lists every preset in the registry exactly once across the two families", async () => {
    render(<App />);
    await openGallery();
    const seen = presets()
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((text) => TEMPLATES.some((t) => text.startsWith(t.label)));
    expect(new Set(seen).size).toBe(8);
    fireEvent.click(screen.getByRole("radio", { name: "Profile README" }));
    const profileSeen = presets()
      .getAllByRole("button")
      .map((button) => button.textContent ?? "")
      .filter((text) => TEMPLATES.some((t) => text.startsWith(t.label)));
    expect(new Set(profileSeen).size).toBe(4);
  });
});
