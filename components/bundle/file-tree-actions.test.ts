/* ============================================================
   The slot the folder's controls go in, and the six props it may not disturb.

   `FileTree` gained one optional prop so the blueprint page can put its "Code" control on
   the file list's own header row, GitHub's shape, on the owner's instruction. Every other
   caller passes what it passed before, and the risk of a slot added to a header row is not
   that the slot fails to render: it is that the row it was added to comes out different
   for everybody who never uses it.

   So the cell that matters is a DIFFERENCE cell. Two renders of the same fixture, one with
   the slot and one without, and the second must be the first with exactly the slot's own
   wrapper removed and nothing else. A pair of "contains" assertions could not see a header
   that reflowed, a class that changed, or a column that moved.

   Rendered through `renderToStaticMarkup`, the way `tests/server/t261` already renders
   this component: what a reader with no JavaScript gets.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BundleFile } from "@/lib/data/bundles";
import type { Author } from "@/lib/types";

import { FileTree } from "./FileTree";

const author: Author = {
  username: "lupo",
  displayName: "Lupo",
  avatarHue: 210,
  validator: false,
};

/** `BUNDLE_README`, `TOPOLOGY_DOT` and the cards directory, in the listing's own order. */
const FILES: readonly BundleFile[] = [
  {
    path: "topology.dot",
    kind: "dot",
    change: "the graph as the author wrote it",
    state: "source",
    at: "2026-08-19",
  },
  {
    path: "README.md",
    kind: "doc",
    change: "written by the exporter",
    state: "generated",
    at: "2026-08-19",
  },
  {
    path: "cards/",
    kind: "dir",
    change: "one document per node, pinned by version",
    state: "pinned",
    at: "2026-08-19",
  },
];

const BASE = {
  files: FILES,
  lastChange: {
    message: "repin spec-planner",
    digest: "sha256:1f4a",
    at: "2026-08-19",
  },
  author,
  hrefFor: (file: BundleFile) => (file.kind === "dir" ? undefined : `/f/${file.path}`),
  readmeHref: "/f/README.md",
  footnote: "3 entries, 4 cards",
} as const;

/** Distinctive enough that no class name or copy in the component can collide with it. */
const SLOT = createElement("b", null, "CODE-MENU-SLOT");

const WITHOUT = renderToStaticMarkup(createElement(FileTree, BASE));
const WITH = renderToStaticMarkup(createElement(FileTree, { ...BASE, actions: SLOT }));

/** The wrapper the prop is allowed to add, and the whole of what it is allowed to add. */
const WRAPPER = '<span class="ml-auto shrink-0"><b>CODE-MENU-SLOT</b></span>';

describe("the actions slot", () => {
  it("rendered something both ways", () => {
    // Two empty strings are identical, and every difference cell below would pass.
    expect(WITHOUT.length).toBeGreaterThan(900);
    expect(WITH.length).toBeGreaterThan(900);
  });

  it("renders what it is handed, in the header row", () => {
    expect(WITH).toContain(WRAPPER);
    // In the strip above the listing, not in the footer beside `Open README`: the header
    // row ends at the `</div>` that opens the `<ul>`, so the slot has to land before it.
    expect(WITH.indexOf(WRAPPER)).toBeLessThan(WITH.indexOf("<ul>"));
  });

  it("is absent from the markup when the prop is not passed", () => {
    expect(WITHOUT).not.toContain("CODE-MENU-SLOT");
    // The wrapper too, not only its content. An empty `<span class="ml-auto shrink-0">`
    // would still be a column in a flex row.
    expect(WITHOUT).not.toContain('class="ml-auto shrink-0"');
  });

  it("changes nothing else about the panel", () => {
    // The difference cell. Anything the slot disturbed — a reflowed header, a moved
    // column, a class that changed with it — survives this subtraction and fails here.
    expect(WITH.replace(WRAPPER, "")).toBe(WITHOUT);
  });
});

describe("the six props the page already passes", () => {
  /**
   * Each is read out of the render without the slot, so a listing that only works once
   * somebody passes `actions` fails here. They are the props
   * `app/blueprints/[owner]/[slug]/page.tsx` hands over today.
   */
  it("still draws the author, the last change and the footnote", () => {
    expect(WITHOUT).toContain(author.username);
    expect(WITHOUT).toContain(BASE.lastChange.message);
    expect(WITHOUT).toContain(BASE.lastChange.digest);
    expect(WITHOUT).toContain(BASE.footnote);
  });

  it("still links a file `hrefFor` answers for, and leaves the rest as text", () => {
    expect(WITHOUT).toContain('href="/f/topology.dot"');
    expect(WITHOUT).toContain('href="/f/README.md"');
    // `cards/` is a directory row: `hrefFor` returns undefined and the name is a span.
    expect(WITHOUT).not.toContain('href="/f/cards/"');
    for (const file of FILES) expect(WITHOUT).toContain(file.path);
  });
});

describe("the box a dropdown has to be able to leave", () => {
  /**
   * `overflow-hidden` was on the section, and a `<details>` panel in the header row is
   * positioned outside the header's box: for a folder of five files the panel is taller
   * than the listing under it and the bottom of it was cut off at the section's edge.
   *
   * The clip moved onto the one child that needs it — the strip is the only element in
   * here that paints a ground over the border's radius. Both halves are asserted, because
   * removing the clip without replacing it is a square corner sticking out of a rounded
   * box, which is a regression this file would otherwise not see.
   */
  it("clips the header strip rather than the whole panel", () => {
    // The section's own opening tag, not the whole document: `Avatar` or `ButtonLink`
    // clipping something of their own is none of this cell's business.
    const open = WITHOUT.slice(0, WITHOUT.indexOf(">") + 1);
    expect(open).toContain("<section");
    expect(open).not.toContain("overflow-hidden");
    expect(WITHOUT).toContain("rounded-t-[11px]");
  });
});
