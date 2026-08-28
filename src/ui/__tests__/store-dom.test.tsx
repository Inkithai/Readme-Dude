// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Block, createBlock } from "@/engine";
import { flushAutosave, history, useDocument, useHistoryDepth, useVisibleBlocks } from "@/store/document";

/* ------------------------------------------------------------------ *
 * Failure modes that only exist once React is in the picture, so they live on
 * the React side of the store rather than in the node-only suite.
 * ------------------------------------------------------------------ */

afterEach(() => history.clear());

describe("store selectors", () => {
  it("object-returning selectors do not send React into a render loop", () => {
    // zustand v5 hands the selector's result to useSyncExternalStore, which
    // compares snapshots with Object.is. A selector that builds a fresh array or
    // object on every call therefore never settles: React re-renders until it
    // throws "Maximum update depth exceeded". `useShallow` is the fix, and this
    // is the test that keeps it fixed.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const Probe = () => {
      const depth = useHistoryDepth();
      const visible = useVisibleBlocks();
      return (
        <p>
          {depth.past} · {visible.length}
        </p>
      );
    };

    act(() => useDocument.getState().replaceBlocks([createBlock("heading")] as Block[], "selector probe"));
    expect(() => render(<Probe />)).not.toThrow();
    expect(screen.getByText(/· 1$/).textContent).toContain("1");

    // ...and a value that still updates when the store changes, since
    // `useShallow` compares element-wise rather than by reference.
    const id = useDocument.getState().blocks[0]?.id ?? "";
    act(() => useDocument.getState().setHidden(id, true));
    expect(screen.getByText(/· 0$/).textContent).toContain("0");
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/getSnapshot|Maximum update depth/);
    errors.mockRestore();
  });
});

describe("autosave honesty", () => {
  it("does not claim the document was saved when the write threw", () => {
    // Quota exceeded and Safari private mode both throw out of setItem. The old
    // code swallowed that and still reported "saved", so the user closed a tab
    // that had nothing in it.
    const failing = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    act(() => {
      useDocument.getState().replaceBlocks([createBlock("heading")] as Block[], "quota probe");
      flushAutosave();
    });
    failing.mockRestore();
    expect(useDocument.getState().saveStatus).toBe("unavailable");
  });

  it("reports saved once the write succeeds, and never re-writes an unchanged document", () => {
    act(() => {
      useDocument.getState().patchProps(useDocument.getState().blocks[0]?.id ?? "", { text: "edited" });
      flushAutosave();
    });
    expect(useDocument.getState().saveStatus).toBe("saved");
    const written = vi.spyOn(Storage.prototype, "setItem");
    act(() => flushAutosave());
    expect(written).not.toHaveBeenCalled(); // lastWritten short-circuit
    written.mockRestore();
  });
});

describe("import safety", () => {
  it("refuses a JSON file that is not a document instead of wiping the canvas", () => {
    const before = useDocument.getState().blocks;
    const result = useDocument.getState().importJson(JSON.stringify({ name: "my-pkg", version: "2.0.0" }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/blocks/);
    // The actual bug: the document used to be replaced by an empty one, with a
    // success alert, because a missing `blocks` key parsed as "zero blocks".
    expect(useDocument.getState().blocks).toEqual(before);
  });

  it("refuses a file whose every block was rejected, and keeps the document", () => {
    const before = useDocument.getState().blocks;
    const result = useDocument
      .getState()
      .importJson(JSON.stringify({ version: 1, name: "from the future", blocks: [{ type: "hero-v3" }] }));
    expect(result.ok).toBe(false);
    expect(result.dropped).toBe(1);
    expect(useDocument.getState().blocks).toEqual(before);
  });

  it("still imports a real document, and a deliberately empty one", () => {
    const text = JSON.stringify({ version: 1, name: "from file", blocks: [createBlock("heading")] });
    expect(useDocument.getState().importJson(text)).toEqual({ ok: true, dropped: 0 });
    expect(useDocument.getState().name).toBe("from file");
    expect(
      useDocument.getState().importJson(JSON.stringify({ version: 1, name: "blank", blocks: [] })),
    ).toEqual({
      ok: true,
      dropped: 0,
    });
  });
});
