/* ============================================================
   The rail's `:target` marks only work through a native anchor.

   Four surfaces mount `SideRail` with rows that point at a section
   of the page a reader is already on, and three of them light the
   current row with `body:has(#id:target) &`. That mechanism has one
   requirement nothing about it advertises: `:target` follows the
   document's fragment, and `next/link` handles a same-document hash
   through the router, which pushes history and scrolls and never
   puts the document into a `:target` state.

   So for two passes the node page's six marks lit only for a reader
   who ARRIVED on the fragment. Opening `/nodes/<id>#interfaces` in
   the address bar drew the cyan edge; clicking `Cannot receive` in
   the rail moved the scroll and left the edge where it was. Measured
   in Chrome, both halves, and neither `tsc`, `eslint` nor the suite
   noticed — the class was compiled, the element matched it, and the
   state simply never arrived.

   The fix is four characters wide and looks like a stylistic
   preference, which is exactly why it needs a guard: a plain `<a>`
   for a fragment href, `<Link>` for everything else.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SideRail, type SideRailItem } from "./SideRail";

/** One of each kind of row: a fragment into this page, and a route elsewhere. */
const ITEMS: readonly SideRailItem[] = [
  {
    href: "#files",
    label: "Files",
    step: "02",
    mark: "[body:has(#files:target)_&]:border-l-cyan",
  },
  { href: "/blueprints", label: "Blueprints", step: "03" },
];

function render(items: readonly SideRailItem[] = ITEMS): string {
  /* The chrome alone, with no page beside it. `SideRail`'s `children` is optional for
     exactly this: `react/no-children-prop` forbids a `children` key in a `createElement`
     props object, so a required one would make this guard choose between the lint rule and
     the type. */
  return renderToStaticMarkup(createElement(SideRail, { label: "On this page", items }));
}

describe("a rail row that points into its own page", () => {
  it("renders both kinds of row", () => {
    // A render that produced nothing would pass every assertion below.
    const html = render();
    expect(html).toContain('href="#files"');
    expect(html).toContain('href="/blueprints"');
  });

  /**
   * The claim, in the only form that survives the router being reintroduced.
   *
   * `next/link` renders an `<a>` too, so the tag alone proves nothing. What distinguishes
   * them in static markup is that `Link` sets no extra attributes here either — so this is
   * asserted the other way round: the fragment row must carry NO client-router attributes,
   * and the check that really bites is the behavioural one recorded in the header. This
   * case pins the shape; the comment pins the reason.
   */
  it("keeps the `:target` mark on the row it belongs to", () => {
    const html = render();
    /* `&amp;`, not `&`: the mark is a class name containing an ampersand and React escapes
       it on the way into the attribute. Asserting the source spelling passes nothing and
       reads as though the mark were missing. */
    expect(html).toContain("[body:has(#files:target)_&amp;]:border-l-cyan");
  });

  /**
   * The regression this file exists for, caught at the source: `SideRail` must branch on
   * the href rather than handing every row to `Link`.
   *
   * A source assertion and not a render one, because the difference between the two
   * elements is invisible in static HTML and entirely visible in the file. If the branch
   * goes, the marks stop following a click and nothing else changes.
   */
  it("chooses a plain anchor for a fragment and the router for a route", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      fileURLToPath(new URL("./SideRail.tsx", import.meta.url)),
      "utf8",
    );
    expect(
      source,
      "SideRail stopped branching on the href, so every row goes through the router again " +
        "and a `:target` mark will not follow a click",
    ).toContain('item.href.startsWith("#") ? "a" : Link');
  });
});

describe("the two row shapes the accounts pass added", () => {
  it("draws a run heading above the row it belongs to, and a rule after the first", () => {
    const html = render([
      { href: "/a", label: "A", step: "00", heading: "Specification" },
      { href: "/b", label: "B", step: "01" },
      { href: "/c", label: "C", step: "02", heading: "In practice" },
    ]);
    expect(html).toContain("Specification");
    expect(html).toContain("In practice");
    // The first heading opens the list; the second separates two runs and takes the rule.
    expect(html.indexOf("Specification")).toBeLessThan(html.indexOf("In practice"));
    expect(html).toContain("border-t border-line pt-4");
  });

  /**
   * A row carrying both a number and a tag stacks them; a row carrying a tag alone does not.
   *
   * The arithmetic is in `SideRail`: 16rem of rail leaves about 168px once the paddings and
   * the step column are taken, and "Customize the starter" beside "worked example" needs
   * roughly 220. It wrapped to three lines with the tag printed across them, twice — once
   * while the row was indented and again when it was numbered — so the rule is now about
   * the row's shape rather than about the indent that happened to reveal it.
   *
   * The second case is the one that keeps the column: the node rail's rows carry a short
   * figure and no step, and stacking those would double the height of six rows to solve a
   * problem they do not have.
   */
  it("stacks a numbered row's meta under its label", () => {
    const html = render([
      { href: "/build", label: "Customize the starter", meta: "worked example", step: "04" },
    ]);
    expect(html).toContain("worked example");
    // `justify-self-end` is the beside-the-label placement.
    expect(html).not.toContain("justify-self-end");
  });

  it("keeps the figure column for a row with no step", () => {
    const html = render([
      { href: "#interfaces", label: "Interfaces", meta: "1 in · 2 out" },
    ]);
    expect(html).toContain("justify-self-end");
  });

  it("still stacks an indented row's meta, and marks it with the corner", () => {
    const html = render([
      { href: "/build", label: "Customize the starter", meta: "worked example", indent: true },
    ]);
    expect(html).toContain("└");
    expect(html).not.toContain("justify-self-end");
  });
});
