// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { compileDocument } from "@/engine";
import { history, useDocument } from "@/store/document";

/* ------------------------------------------------------------------ *
 * ui/__tests__/designers.test.tsx — Phase 4's designer surfaces.
 *
 * The engine tests prove the compiler emits the right HTML. These prove the
 * *controls* reach it: that choosing an arrangement patches the block, that
 * rearranging never throws away what you typed, that a control which would do
 * nothing for the current layout is not offered, and that an image block which
 * would export as nothing says so in Checks.
 *
 * The thumbnails in the LayoutPicker are drawn with divs, so there is nothing
 * here that needs a network or an image decoder — the assertions are on the
 * roles, the checked state and the compiled Markdown.
 * ------------------------------------------------------------------ */

const state = () => useDocument.getState();
const prop = (key: string): unknown =>
  (state().blocks[0]?.props as Record<string, unknown> | undefined)?.[key];
const md = () => compileDocument(state().blocks);

/** Add a block of a type and return the markdown it produces on its own. */
function add(type: "image" | "hero"): void {
  act(() => {
    state().replaceBlocks([]);
    state().addBlock(type);
  });
}

const layoutGroup = () => screen.getByRole("radiogroup", { name: "Layout" });

describe("screenshot designer", () => {
  beforeEach(() => {
    localStorage.clear();
    state().replaceBlocks([]);
    state().setName("untitled");
    state().setKind("project");
    history.clear();
  });
  afterEach(() => cleanup());

  it("offers the five arrangements and marks the one in use", () => {
    render(<App />);
    add("image");
    const options = within(layoutGroup()).getAllByRole("radio");
    expect(options.map((option) => option.textContent)).toEqual([
      "Single",
      "2 columns",
      "3 columns",
      "Gallery",
      "Image + text",
    ]);
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    expect(options.slice(1).every((option) => option.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("turning a single image into a row carries the image across", () => {
    render(<App />);
    add("image");
    const before = String(prop("url"));
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /3 columns/ }));
    expect(prop("layout")).toBe("columns");
    expect(prop("columns")).toBe(3);
    // The point of `promote()`: the layout changed, the content did not vanish.
    expect((prop("items") as Record<string, unknown>[]).map((item) => item.url)).toEqual([before]);
    expect(md()).toContain('<td width="33%" align="center">');
    expect(md()).toContain(before);
  });

  it("a row honours the pixel width and a gallery hands sizing to the column", () => {
    render(<App />);
    add("image");
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /^2 columns/ }));
    expect(
      within(layoutGroup())
        .getByRole("radio", { name: /2 columns/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
    // The label wraps both the number box and its slider, and `label.control`
    // is the first labelable descendant — the number input.
    fireEvent.change(screen.getByLabelText(/Width per image/), { target: { value: "480" } });
    expect(md()).toContain('width="480"');
    expect(md()).not.toContain('width="100%"');

    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /^Gallery/ }));
    expect(md()).toContain('width="100%"');
    // `columns` is a row control; a gallery picks its own density instead, and
    // the designer shows that switch rather than a width box that does nothing.
    expect(within(screen.getByRole("radiogroup", { name: "Per row" })).getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Per row" })).getByRole("radio", { name: /3 across/ }),
    );
    expect(md()).toContain('<td width="33%"');
  });

  it("image + text puts the prose in the second cell", () => {
    render(<App />);
    add("image");
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /Image \+ text/ }));
    fireEvent.change(screen.getByLabelText(/^Text/), {
      target: { value: "Three views, one **timeline**." },
    });
    expect(prop("layout")).toBe("split");
    expect(md()).toContain('<td width="45%" valign="top">');
    // markdown is not parsed inside HTML, so the compiler converted it.
    expect(md()).toContain("one <strong>timeline</strong>");
  });

  it("adds an image row and drops it again", () => {
    render(<App />);
    add("image");
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /^2 columns/ }));
    const count = () => (prop("items") as unknown[]).length;
    expect(count()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    expect(count()).toBe(2);
    expect(md().match(/<td /g)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0] as HTMLElement);
    expect(count()).toBe(1);
  });

  it("shows a live thumbnail for the URL you typed", () => {
    render(<App />);
    add("image");
    fireEvent.change(screen.getByLabelText(/Image URL/), { target: { value: "https://cdn.test/ship.png" } });
    const thumb = document.querySelector("figure img");
    expect(thumb?.getAttribute("src")).toBe("https://cdn.test/ship.png");
  });

  it("one ⌘Z undoes a layout change, content and all", () => {
    render(<App />);
    add("image");
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /Gallery/ }));
    expect(prop("layout")).toBe("gallery");
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(prop("layout")).toBe("single");
    expect(prop("items")).toEqual([]);
  });

  it("tells you in Checks when the block would export as nothing", async () => {
    render(<App />);
    add("image");
    fireEvent.click(within(layoutGroup()).getByRole("radio", { name: /^2 columns/ }));
    // A row whose only image URL was cleared: no error, but nothing renders.
    // Open the row ListEditor named after the promoted file, then blank its URL.
    fireEvent.click(screen.getByRole("button", { name: /Image 1 —/ }));
    fireEvent.change(screen.getByLabelText(/Image URL/), { target: { value: "  " } });
    expect(md()).toBe("");
    // A second block, so the *document* is not empty: `empty-document` is a
    // document-level error and it stops the per-block checks, deliberately.
    act(() => {
      state().addBlock("heading");
    });
    // The tab's name carries the badge count ("Checks1"), which is exactly the
    // point of the check, so match the prefix rather than an exact string.
    fireEvent.click(screen.getByRole("tab", { name: /^Checks/ }));
    const panel = await waitFor(() => screen.getByRole("tabpanel", { name: /^Checks/ }));
    expect(within(panel).getByText(/no usable image URL/i)).toBeTruthy();
    // …with the fix next to it, not a bare "something is wrong".
    expect(within(panel).getByText(/Add an https:\/\/ image URL/)).toBeTruthy();
  });
});

describe("hero designer", () => {
  beforeEach(() => {
    localStorage.clear();
    state().replaceBlocks([]);
    state().setName("untitled");
    state().setKind("project");
    history.clear();
  });
  afterEach(() => cleanup());

  it("adds the banner between tagline and buttons", () => {
    render(<App />);
    add("hero");
    fireEvent.change(screen.getByLabelText(/Image URL/), {
      target: { value: "https://cdn.test/hero.png", alt: "" },
    });
    expect(prop("imageUrl")).toBe("https://cdn.test/hero.png");
    const out = md();
    expect(out).toContain('<div align="center">');
    expect(out).toContain('<img src="https://cdn.test/hero.png" alt="Screenshot" width="720" />');
  });

  it("keeps the logo and the banner as two separate choices", () => {
    render(<App />);
    add("hero");
    fireEvent.change(screen.getByLabelText("Logo URL"), { target: { value: "https://cdn.test/mark.svg" } });
    fireEvent.change(screen.getByLabelText(/Image URL/), { target: { value: "https://cdn.test/hero.png" } });
    expect(prop("logoUrl")).toBe("https://cdn.test/mark.svg");
    const out = md();
    // Logo first (who), then title and tagline, then the screenshot (what).
    expect(out.indexOf("mark.svg")).toBeLessThan(out.indexOf("<h1>"));
    expect(out.indexOf("<h1>")).toBeLessThan(out.indexOf("hero.png"));
  });
});
