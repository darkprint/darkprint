/* ============================================================
   The three pages of §4.2, and the one way their pager breaks
   without saying so.

   `neighbours` used to return `{}` for a path the route does not
   carry, and `RoutePager` then ran its own `findIndex` and got -1
   back, so a mistyped or newly added page shipped a footer reading
   "Towards a Dark Factory · 0 of 3" with both arrows missing.
   Nothing failed, nothing logged, and the page looked finished.

   `components/spec/sequence.ts` had already settled the same
   question in the other direction, and its docstring says why: a
   pager is rendered by a page that knows its own path, so an
   argument the list does not carry is a typo in a route, "and a
   build that stops is how that gets noticed".
   ============================================================ */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CLIMB_ROUTE, neighbours } from "./route";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Block comments out. Prose about a rule is not a breach of it. */
function withoutBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
}

describe("the route and the filesystem agree", () => {
  it.each(CLIMB_ROUTE.map((stop) => stop.href))("%s is a page on disk", (href) => {
    const page = join(ROOT, "app", href.slice(1), "page.tsx");
    expect(statSync(page, { throwIfNoEntry: false }), `${href} has no page.tsx`).toBeDefined();
  });

  it.each(CLIMB_ROUTE.map((stop) => stop.href))("%s renders the pager", (href) => {
    const page = readFileSync(join(ROOT, "app", href.slice(1), "page.tsx"), "utf8");
    expect(page).toContain("RoutePager");
  });
});

describe("neighbours", () => {
  it("walks the route from either end", () => {
    const first = neighbours(CLIMB_ROUTE[0].href);
    expect(first.position).toBe(1);
    expect(first.total).toBe(CLIMB_ROUTE.length);
    expect(first.previous).toBeUndefined();
    expect(first.next).toBe(CLIMB_ROUTE[1]);

    const last = neighbours(CLIMB_ROUTE[CLIMB_ROUTE.length - 1].href);
    expect(last.position).toBe(CLIMB_ROUTE.length);
    expect(last.next).toBeUndefined();
    expect(last.previous).toBe(CLIMB_ROUTE[CLIMB_ROUTE.length - 2]);
  });

  it("throws on a path the route does not carry", () => {
    // The whole point. Returning `{}` here is what shipped "· 0 of 3" with no arrows.
    expect(() => neighbours("/towards-a-dark-factory/the-climbb")).toThrow(
      /is not part of the Towards a Dark Factory route/,
    );
  });

  it("is the only place the pager counts from", () => {
    // A second `findIndex` in the component would reintroduce the silent -1 beside a
    // lookup that now throws, which is the arrangement the defect was made of.
    const pager = withoutBlockComments(
      readFileSync(join(ROOT, "components/howto/RoutePager.tsx"), "utf8"),
    );
    expect(pager).not.toContain("findIndex");
  });
});
