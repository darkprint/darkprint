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

   The lifecycle-scoring pass's own §4.2 appended a fifth,
   `SPEC_SCORING`, after the three layers rather than among them, and
   the IA pass of 2026-08-07 took it back out along with the overview
   itself. Every check below holds over whatever `SPEC_SEQUENCE`
   contains, so the count grew and shrank without most of this file's
   assertions moving — except the three places that had frozen a
   route or a length by name rather than by position, which is the
   shape this file exists to catch and which it kept committing in
   itself. Those three are rewritten against the list, not against
   the new numbers.

   Two things changed under the assertions and neither weakens them.
   Stop 00 is `/what-a-blueprint-is` now: `/spec` was deleted and its
   three children had to keep a parent, a crumb and a rail, so the
   page that already linked all three became the door. And the
   sequence has no fifth stop, because grading merged into
   `/reading-the-radar`, which is outside this sequence on purpose.

   So this file walks `app/spec` and holds the two directions
   against each other. The walk is what stops a child reappearing
   under `app/spec` without an entry in the list — which is exactly
   what `/spec/scoring` would have become if it had been kept. It
   also checks that each page renders the pager at all, because a
   page that renders one and a page that forgets it look identical
   from the route table.

   A source scan, and deliberately not a render. The pages are
   server components that read the archive, and the fact worth
   guarding is which files exist and what they import, which is
   reachable from the filesystem. No DOM: the suite is
   `environment: "node"` by design.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SPEC_LAYERS,
  LEARN_PRACTICE,
  RUNS,
  SANDBOX,
  SPEC_OVERVIEW,
  SPEC_SEQUENCE,
  runPosition,
  specNeighbours,
} from "./sequence";
import { SpecPager } from "./SpecPager";

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

  /**
   * The sequence is two named runs over one list, and this is the shape of both.
   *
   * It used to assert three practice stops numbered 04 to 06. Two of them left in the
   * accounts pass and neither is a deletion of a route: the sandbox moved into the
   * specification run as an unnumbered worked example under stop 03, and the essay left the
   * sequence altogether while its page stayed exactly where it was.
   */
  it("runs the specification, then the practice, over one list", () => {
    expect(
      SPEC_SEQUENCE.map(({ step, href, run }) => ({ step, href, run })),
    ).toEqual([
      { step: "00", href: "/what-a-blueprint-is", run: "specification" },
      { step: "01", href: "/spec/topology", run: "specification" },
      { step: "02", href: "/spec/card", run: "specification" },
      { step: "03", href: "/spec/ontology", run: "specification" },
      { step: "04", href: "/build", run: "practice" },
      { step: "05", href: "/reading-the-radar", run: "practice" },
      { step: "06", href: "/towards-a-dark-factory", run: "practice" },
    ]);
    expect(LEARN_PRACTICE.map((page) => page.href)).toEqual([
      "/build",
      "/reading-the-radar",
      "/towards-a-dark-factory",
    ]);
  });

  /**
   * The sandbox is a stop of its own, and it keeps the word that says what kind.
   *
   * It spent one pass unnumbered and indented under stop 03, on the argument that an
   * optional stop is not a stop; the author asked for it back as a row in its own right. So
   * it has a number and no indent, and `meta` survives the change — the tag is the part of
   * the old treatment worth keeping, because a number cannot say "worked example".
   *
   * It opens the practice run: the specification says what the three files are, and this is
   * the first stop that does something with them.
   */
  it("draws the sandbox as stop 04, opening the practice run", () => {
    expect(SANDBOX.step).toBe("04");
    expect(SANDBOX.indent).toBeUndefined();
    expect(SANDBOX.meta).toBe("worked example");
    expect(SANDBOX.run).toBe("practice");
    expect(SPEC_SEQUENCE[SPEC_SEQUENCE.indexOf(SANDBOX) - 1]).toBe(SPEC_LAYERS[2]);
    expect(runPosition(SANDBOX.href)).toEqual({ run: "practice", position: 1, total: 3 });
  });

  /**
   * The essay is the last stop of the practice run.
   *
   * It left the sequence for one pass, on the hand-off's decision 3, and the author asked
   * for it back: a reader who has been through the specification and the scorecard is
   * exactly the reader who then asks which work belongs to an agent at all. Both halves are
   * asserted, because the round trip broke each of them in turn — the page has to be in the
   * list AND to draw the pager the list gives it.
   */
  it("closes the practice run with the essay", () => {
    expect(SPEC_SEQUENCE.at(-1)?.href).toBe("/towards-a-dark-factory");
    expect(specNeighbours("/towards-a-dark-factory").next).toBeUndefined();
    expect(specNeighbours("/towards-a-dark-factory").previous?.href).toBe(
      "/reading-the-radar",
    );
    const essay = readFileSync(
      join(ROOT, "app/towards-a-dark-factory/page.tsx"),
      "utf8",
    );
    expect(essay).toMatch(/from "@\/components\/spec\/SpecPager"/);
    expect(essay).toContain("<SpecPager href={HERE} />");
  });

  /** The position a reader is shown is the position inside their own run. */
  it("counts a stop against its own run, not across both", () => {
    expect(runPosition("/spec/card")).toEqual({
      run: "specification",
      position: 3,
      total: 4,
    });
    expect(runPosition("/reading-the-radar")).toEqual({
      run: "practice",
      position: 2,
      total: 3,
    });
    expect(Object.keys(RUNS).sort()).toEqual(["practice", "specification"]);
  });

  /* `nav` and `title` deliberately DIFFER on this stop, where the case used to require them
     to match.

     They matched while "Ontology" was free. It stopped being free on 2026-08-12: the author
     asked the browser at `/ontology` to take the word across the whole site, and `nav` is
     what the header's Learn dropdown, the footer, the rail and the pager print — so the
     short form would have put two "Ontology" rows in one header pointing at two routes.
     `nav` took the word "file", which is enough to hold it apart; the format stays in
     `SiteFooter`'s `LEARN_LABELS` beside its two siblings, on the author's instruction that
     "(YAML)" come off the Learn dropdown and the Learn rail. `title` is the page's own
     heading, and the thing the page specifies is still the ontology.

     Both halves are still pinned, so the stop cannot drift to a third name in either slot,
     and `nav.test.ts` holds the chrome end of the same rename. */
  it("names stop 03 for the file in the chrome and the concept on the page", () => {
    expect(SPEC_LAYERS[2]).toMatchObject({
      step: "03",
      nav: "Ontology file",
      title: "Ontology",
    });
  });

  it("gives every page a distinct step, route and title", () => {
    // `step` included: exactly one stop may lack a number, so a second `undefined` in the
    // column collapses the set and fails here rather than drawing two `└` rows.
    for (const key of ["href", "step", "title", "nav"] as const) {
      const values = SPEC_SEQUENCE.map((page) => page[key]);
      expect(new Set(values).size, `two pages share a ${key}`).toBe(
        values.length,
      );
    }
  });
});

describe("next and previous", () => {
  it("links them into one chain, with no arrow off either end", () => {
    /* Both ends by position rather than by name. This block named `/spec` and
       `/spec/scoring` as the two ends, and both routes are gone — the second time in two
       passes that freezing a route here made the file need editing for a change it was
       supposed to be indifferent to. `SPEC_SEQUENCE[0]` and `.at(-1)` are the two ends
       whatever they are called, and the loop below still walks every neighbour pair. */
    const first = SPEC_SEQUENCE[0];
    const last = SPEC_SEQUENCE.at(-1);
    expect(first).toBe(SPEC_OVERVIEW);
    expect(last).toBeDefined();
    expect(specNeighbours(first.href).previous).toBeUndefined();
    expect(specNeighbours(last?.href ?? "").next).toBeUndefined();
    // And the chain is a chain rather than two ends with a hole: every stop but the last
    // hands on to the one after it.
    expect(specNeighbours(SPEC_LAYERS[0].href).previous).toBe(SPEC_OVERVIEW);

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
   * Spec §3 moved two components off the landing and on to the pages whose subject they
   * are, and named the property the move may not cost: the annotated card "reads the real
   * card through `cardSource` and that must survive the move". They are imported by path
   * rather than through the `components/home` barrel, so that taking them off the
   * landing's index cannot break a route here.
   *
   * Was two rows. `/spec/topology` no longer imports `SectionRoles`: the author asked the
   * roles band ("The shape of the work", DRW-003) off that page in the trim pass, and the
   * row came out with the mount in the same change rather than being loosened to keep
   * passing. `SectionRoles.tsx` itself stays, with both of its guards —
   * `components/home/roles-labels.test.ts` renders it directly and does not need a mount.
   */
  it.each([["/spec/card", "@/components/home/SectionNodeCard"]])(
    "%s imports %s by path",
    (href, module) => {
      expect(source(href)).toContain(`from "${module}"`);
    },
  );

  it("keeps the annotated card reading the archive rather than a transcription", () => {
    const section = readFileSync(
      join(ROOT, "components/home/SectionNodeCard.tsx"),
      "utf8",
    );
    expect(section).toContain("cardSource(");
    expect(section).toContain("code-builder@1.0.0");
  });

  /* The lattice case is gone with the drawing it guarded.
     ------------------------------------------------------
     It asserted that `/spec/ontology` mounted `<LatticeFigure` and laid it out from
     `view.ancestors(` / `view.children(` rather than from a transcribed list. The band
     was cut on the author's word (see that page's header docblock): the subsumption
     argument belongs to the isolation story, and the vocabulary page's subject is the
     size and governance of the set.

     The property the case existed to protect — a drawing laid out from the vocabulary
     rather than from a picture kept in step by hand — is not unguarded, because
     `LatticeFigure` itself is unchanged and `components/viz/scene-labels.test.ts` still
     renders it over `getOntologyView()` and measures every label in it. What has no
     guard now is the mount, and that is correct: there is no mount. This comment stays
     so the next reader finds the reason rather than an unexplained gap between the two
     figure cases above. */
});

/**
 * The three fragments the split turned into dead links.
 *
 * `/spec#card`, `/spec#topology` and `/spec#ontology` were in-page anchors while `/spec`
 * was one page. A fragment never reaches the server, so no redirect in `next.config.ts`
 * can carry one onto the child route it became, and an external link or a bookmark landed
 * silently at the top of `/spec`. Each layer's band on the overview carries its old id.
 *
 * They survived `/spec` being deleted outright, for the same reason. The 308 lands on
 * `/what-a-blueprint-is` with no fragment of its own, the browser re-applies the one it
 * started with, and the band is there to receive it.
 */
/**
 * The rail's `aria-label` used to spell the count out as a literal string ("in four
 * parts"), which this pass's own append of `SPEC_SCORING` left stale: reviewed and
 * reproduced against the built HTML of the fifth page, whose `<nav>` announced a
 * four-stop rail over the five `<li>`s directly under it. `SpecPager.tsx` now reads the count off
 * `SPEC_SEQUENCE.length`, so this renders the actual component rather than scanning its
 * source — a source scan for the digit would pass unchanged if the label were reverted to
 * a hardcoded string that happened to still be correct today.
 */
describe("the pager's aria-label names the true count", () => {
  it("agrees with SPEC_SEQUENCE.length, not a remembered number", () => {
    const html = renderToStaticMarkup(
      createElement(SpecPager, { href: SPEC_OVERVIEW.href }),
    );
    expect(html).toContain(
      `aria-label="Learn, in ${SPEC_SEQUENCE.length} parts"`,
    );
    // The failure mode this guards: a hardcoded count that was right when written and
    // silently wrong after the next append or removal. A spelled-out number is the only
    // way that string can be a literal, so no spelling of any count may appear — the
    // component writes a digit. This replaced `expect(SPEC_SEQUENCE.length).not.toBe(4)`,
    // which pinned the wrong-today number and duly went stale when the IA pass took the
    // sequence back down to four.
    for (const word of ["two", "three", "four", "five", "six"]) {
      expect(html, `the label spells a count out: "in ${word} parts"`).not.toContain(
        `in ${word} parts`,
      );
    }
    // And the rail draws one entry per stop, so the announced count is the count.
    expect([...html.matchAll(/<li /g)]).toHaveLength(SPEC_SEQUENCE.length);
  });

  it.each(SPEC_SEQUENCE.map((page) => [page.href, page.step, page.nav]))(
    "highlights %s as the current Learn stop",
    (href, step, nav) => {
      const html = renderToStaticMarkup(createElement(SpecPager, { href }));
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toContain(
        `aria-current="page" class="text-cyan">${step ?? "└"} ${nav}</span>`,
      );
    },
  );
});

describe("the anchors the split would otherwise have broken", () => {
  /* The overview's own file, by route rather than by path. It was `app/spec/page.tsx`
     and it is `app/what-a-blueprint-is/page.tsx`, and the three ids had to travel with
     the doors: a browser re-applies the fragment it started with to a `Location` that
     carries none, so `/spec#card` follows the 308 and then looks for `#card` here. */
  const OVERVIEW = readFileSync(pageFile(SPEC_OVERVIEW.href), "utf8");

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
