// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { compileDocument } from "@/engine";
import { AUTOSAVE_KEY, flushAutosave, history, useDocument } from "@/store/document";

/* ------------------------------------------------------------------ *
 * Integration smoke test for the Phase 1 shell: palette → store → canvas →
 * Markdown → preview, plus the keyboard layer. Typechecking cannot catch a
 * broken middleware order or a bad dnd wiring; this can.
 * ------------------------------------------------------------------ */

const state = () => useDocument.getState();
/** One safe accessor for `(state().blocks[i]?.props as …).key` chains. */
const prop = (index: number, key: string): unknown =>
  (state().blocks[index]?.props as Record<string, unknown> | undefined)?.[key];

describe("ReadMe Buddy shell", () => {
  beforeEach(() => {
    localStorage.clear();
    state().replaceBlocks([]);
    history.clear();
  });
  afterEach(() => cleanup());

  it("boots to the empty-canvas prompt", () => {
    render(<App />);
    expect(screen.getByText("Your README is empty")).toBeTruthy();
  });

  it("appends a block from the palette and renders its card", () => {
    render(<App />);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Block palette" })).getByRole("button", {
        name: /^Features/,
      }),
    );
    expect(state().blocks).toHaveLength(1);
    expect(state().blocks[0]?.type).toBe("features");
    // The card header carries the summary line the engine computes.
    expect(
      within(screen.getByRole("list", { name: "Document blocks" })).getByText("3 items · bullets"),
    ).toBeTruthy();
  });

  it("quick-start buttons work when the document is empty", () => {
    render(<App />);
    const quickStart = screen.getByRole("group", { name: "Quick start" });
    fireEvent.click(within(quickStart).getByRole("button", { name: /Hero/ }));
    expect(state().blocks.map((b) => b.type)).toEqual(["hero"]);
  });

  it("edits a field and the compiled markdown follows", () => {
    render(<App />);
    // addBlock() expands the new card, so the editor is already in the DOM —
    // but a mutation outside a React event needs act() to flush.
    let id = "";
    act(() => {
      id = state().addBlock("heading");
    });
    const field = screen.getByDisplayValue("Section");
    fireEvent.change(field, { target: { value: "Install & setup" } });
    expect(prop(0, "text")).toBe("Install & setup");
    expect(id).toBe(state().blocks[0]?.id);
    expect(compileDocument(state().blocks)).toContain("## Install & setup");
  });

  it("hides a block from the keyboard and drops it from the output", () => {
    render(<App />);
    const id = state().addBlock("text");
    state().select(id);
    fireEvent.keyDown(window, { key: "h" });
    expect(state().blocks[0]?.hidden).toBe(true);
    expect(compileDocument(state().blocks)).toBe("");
  });

  it("⌘Z reverts the last document change", () => {
    render(<App />);
    const id = state().addBlock("code");
    state().patchProps(id, { body: "changed" });
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(prop(0, "body")).not.toBe("changed");
  });

  it("duplicate selects the copy; delete removes the selection", () => {
    render(<App />);
    let a = "";
    let copyId = "";
    act(() => {
      a = state().addBlock("badges");
      copyId = state().duplicateBlock(a) as string;
    });
    expect(state().blocks).toHaveLength(2);
    // Insertion and duplication both move the selection, which is what makes
    // ⌫/⌘D act on "the block you are working on". Typing is unaffected
    // because the shortcut handler ignores events from form controls.
    expect(state().selectedId).toBe(copyId);

    // Deleting hands the selection to the neighbour that took the slot, so a
    // second ⌫ deletes the next block rather than doing nothing.
    fireEvent.keyDown(window, { key: "Delete" });
    expect(state().blocks.map((b) => b.id)).toEqual([a]);
    expect(state().selectedId).toBe(a);

    fireEvent.keyDown(window, { key: "Delete" });
    expect(state().blocks).toHaveLength(0);
    expect(state().selectedId).toBeNull();

    act(() => {
      state().addBlock("badges");
      state().addBlock("license");
      state().moveByIndex(1, 0);
    });
    expect(state().blocks.map((b) => b.type)).toEqual(["license", "badges"]);
  });

  it("typing in a field never triggers the delete shortcut", () => {
    render(<App />);
    let id = "";
    act(() => {
      id = state().addBlock("heading");
    });
    const field = screen.getByDisplayValue("Section");
    field.focus();
    fireEvent.keyDown(field, { key: "Delete" });
    expect(state().blocks.map((b) => b.id)).toEqual([id]);
  });

  it("switches to the Markdown tab and shows the exported source", async () => {
    render(<App />);
    state().addBlock("heading");
    fireEvent.click(screen.getByRole("tab", { name: /Markdown/ }));
    await waitFor(() => expect(screen.getByText(/## Section/)).toBeTruthy());
  });

  it("the preview tab mounts the lazy GitHub renderer", async () => {
    render(<App />);
    state().addBlock("hero");
    fireEvent.click(screen.getByRole("tab", { name: /^Preview$/ }));
    await waitFor(() => expect(document.querySelector(".markdown-body")).toBeTruthy(), { timeout: 4000 });
    expect(document.querySelector(".markdown-body")?.textContent).toContain("Project Name");
  });

  it("checks tab reports validation state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: /Checks/ }));
    expect(screen.getByText(/Looks GitHub-safe|blocking/)).toBeTruthy();
  });

  it("autosaves to localStorage and rehydrates", () => {
    render(<App />);
    state().addBlock("table");
    flushAutosave();
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved as string).blocks).toHaveLength(1);
  });

  it("forwards aria-label through Btn to the DOM (props are not spread)", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Toggle preview pane" })).toBeTruthy();
  });

  it("wires the phase-2 blocks from the palette through to the preview", async () => {
    render(<App />);
    const palette = screen.getByRole("navigation", { name: "Block palette" });
    for (const label of [/^Collapsible/, /^Checklist/, /^Links/]) {
      fireEvent.click(within(palette).getByRole("button", { name: label }));
    }

    const canvas = screen.getByRole("list", { name: "Document blocks" });
    expect(within(canvas).getByText(/collapsed · Click to expand/)).toBeTruthy();
    expect(within(canvas).getByText(/1\/3 checked · task/)).toBeTruthy();
    expect(within(canvas).getByText(/3 links · pills/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Markdown/ }));
    // Scoped: the palette's Collapsible hint says "<details>" too, so an
    // unscoped text query is ambiguous here on purpose of the copy, not by accident.
    const source = await waitFor(() => {
      const el = within(screen.getByRole("tabpanel")).getByText(/<details>/);
      expect(el.textContent).toContain("- [x] Install the package");
      expect(el.textContent).toContain("img.shields.io/badge/");
      return el;
    });
    expect(source.textContent).toContain("<summary>Click to expand</summary>");

    // The preview must show a real <details> and real checkboxes, not the syntax.
    fireEvent.click(screen.getByRole("tab", { name: /^Preview$/ }));
    await waitFor(() => expect(document.querySelectorAll("details summary").length).toBe(1), {
      timeout: 4000,
    });
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(3);
  });

  it("keeps the three panes present on wide viewports", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Block palette" })).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Preview mode" })).toBeTruthy();
  });
});
