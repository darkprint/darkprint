/* ============================================================
   The four spec pages, held against the list they are a sequence
   in.

   Redesign spec §4.1 split one long page into four and asked that
   they "carry next / previous links so the four read as a
   sequence". A sequence is a claim about files that live in
   different directories, and there is exactly one way for it to
   break silently: `sequence.ts` names a route nobody wrote, or
   somebody writes a route and leaves it out of the list. Either
   one ships a pager with an arrow pointing at a 404, and neither
   is visible in a build that passes.

   So this file walks `app/spec` and holds the two directions
   against each other. It also checks that each page renders the
   pager at all, because a page that renders one and a page that
   forgets it look identical from the route table.

   A source scan, and deliberately not a render. The pages are
   server components that read the archive, and the fact worth
   guarding is which files exist and what they import, which is
   reachable from the filesystem. No DOM: the suite is
   `environment: "node"` by design.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  SPEC_LAYERS,
  SPEC_OVERVIEW,
  SPEC_SEQUENCE,
  specNeighbours,
} from "./sequence";

/** Repo root: this file is `<root>/components/spec/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** The page file a route in the sequence is rendered by. */
function pageFile(href: string): string {
  return join(ROOT, "app", href.slice(1), "page.tsx");
}

function source(href: string): string {
  return readFileSync(pageFile(href), "utf8");
}

/** Every child route under `app/spec` that has a page of its own. */
const CHILD_ROUTES = readdirSync(join(ROOT, "app/spec"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `/spec/${entry.name}`)
  .filter(
    (href) => statSync(pageFile(href), { throwIfNoEntry: false }) !== undefined,
  );

describe("the sequence and the filesystem agree", () => {
  it("has a page for every route in the list", () => {
    const missing = SPEC_SEQUENCE.filter(
      (page) =>
        statSync(pageFile(page.href), { throwIfNoEntry: false }) === undefined,
    ).map((page) => page.href);
    expect(missing).toEqual([]);
  });

  it("lists every page under app/spec", () => {
    // The other direction, and the one a split produces: a fifth layer page written
    // and never added to the list renders with no crumb, no pager and no way back.
    const known = new Set(SPEC_SEQUENCE.map((page) => page.href));
    const orphans = CHILD_ROUTES.filter((href) => !known.has(href));
    expect(orphans).toEqual([]);
  });

  it("opens at the overview and holds the three layers in resolution order", () => {
    expect(SPEC_SEQUENCE[0]).toBe(SPEC_OVERVIEW);
    expect(SPEC_LAYERS.map((layer) => layer.href)).toEqual([
      "/spec/topology",
      "/spec/card",
      "/spec/ontology",
    ]);
  });

  it("gives every page a distinct step, route and title", () => {
    for (const key of ["href", "step", "title", "nav"] as const) {
      const values = SPEC_SEQUENCE.map((page) => page[key]);
      expect(new Set(values).size, `two pages share a ${key}`).toBe(
        values.length,
      );
    }
  });
});

describe("next and previous", () => {
  it("links the four into one chain, with no arrow off either end", () => {
    expect(specNeighbours("/spec").previous).toBeUndefined();
    expect(specNeighbours("/spec/ontology").next).toBeUndefined();

    for (const [i, page] of SPEC_SEQUENCE.entries()) {
      const { position, total, previous, next } = specNeighbours(page.href);
      expect(position).toBe(i + 1);
      expect(total).toBe(SPEC_SEQUENCE.length);
      expect(previous?.href).toBe(SPEC_SEQUENCE[i - 1]?.href);
      expect(next?.href).toBe(SPEC_SEQUENCE[i + 1]?.href);
    }
  });

  /**
   * The throw is the feature. A pager is rendered by a page that knows its own path, so
   * an argument the list does not carry is a typo in a route, and a footer with both
   * arrows missing is how that would otherwise ship.
   */
  it("refuses a route it does not carry", () => {
    expect(() => specNeighbours("/spec/topolgy")).toThrow();
  });
});

describe("every page renders the sequence", () => {
  it.each(SPEC_SEQUENCE.map((page) => page.href))(
    "%s renders the pager against its own route",
    (href) => {
      const text = source(href);
      expect(text).toContain("SpecPager");
      // The pager takes the page's own path. A page passing a neighbour's would render
      // somebody else's arrows, which is the one failure the list cannot catch.
      expect(text).toMatch(new RegExp(`HERE = "${href}"|SPEC_OVERVIEW.href`));
    },
  );

  it.each(SPEC_LAYERS.map((layer) => layer.href))(
    "%s carries the crumb back to the overview",
    (href) => {
      expect(source(href)).toContain("SpecCrumb");
    },
  );

  it("gives every page its own metadata", () => {
    for (const page of SPEC_SEQUENCE) {
      const text = source(page.href);
      expect(text, `${page.href} exports no metadata`).toContain(
        "export const metadata",
      );
      expect(text, `${page.href} declares no description`).toContain(
        "description:",
      );
    }
  });
});

describe("the figures each layer page opens with", () => {
  /**
   * Spec §3 moves two components off the landing and on to the pages whose subject they
   * are, and names the property the move may not cost: the annotated card "reads the real
   * card through `cardSource` and that must survive the move". Both are imported by path
   * rather than through the `components/home` barrel, so that taking them off the
   * landing's index cannot break a route here.
   */
  it.each([
    ["/spec/topology", "@/components/home/SectionRoles"],
    ["/spec/card", "@/components/home/SectionNodeCard"],
  ])("%s imports %s by path", (href, module) => {
    expect(source(href)).toContain(`from "${module}"`);
  });

  it("keeps the annotated card reading the archive rather than a transcription", () => {
    const section = readFileSync(
      join(ROOT, "components/home/SectionNodeCard.tsx"),
      "utf8",
    );
    expect(section).toContain("cardSource(");
    expect(section).toContain("code-builder@1.0.0");
  });

  it("draws the lattice from the vocabulary rather than from a list", () => {
    const text = source("/spec/ontology");
    expect(text).toContain("view.ancestors(");
    expect(text).toContain("view.children(");
    expect(text).toContain("<LatticeFigure");
  });
});

/**
 * The three fragments the split turned into dead links.
 *
 * `/spec#card`, `/spec#topology` and `/spec#ontology` were in-page anchors while `/spec`
 * was one page. A fragment never reaches the server, so no redirect in `next.config.ts`
 * can carry one onto the child route it became, and an external link or a bookmark landed
 * silently at the top of `/spec`. Each layer's door carries its old id.
 */
describe("the anchors the split would otherwise have broken", () => {
  const OVERVIEW = readFileSync(join(ROOT, "app/spec/page.tsx"), "utf8");

  it("keeps the three old in-page ids on the sequence", () => {
    expect(SPEC_LAYERS.map((layer) => layer.anchor).sort()).toEqual([
      "card",
      "ontology",
      "topology",
    ]);
  });

  it("names each layer's anchor after the route it became", () => {
    // `/spec#card` has to land on the door to `/spec/card` and not on some other one.
    for (const layer of SPEC_LAYERS) {
      expect(layer.href).toBe(`/spec/${layer.anchor}`);
    }
  });

  it("renders the anchor as the door's id", () => {
    expect(OVERVIEW).toContain("id={layer.anchor}");
    // Off the sticky header, or the fragment lands with the door under the nav.
    expect(OVERVIEW).toContain("scroll-mt-24");
  });
});
