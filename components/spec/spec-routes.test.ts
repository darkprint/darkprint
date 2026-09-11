/* ============================================================
   The spec pages, held against the list they are a sequence in.

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
   `/reading-the-radar`, which was outside this sequence on purpose.

   That page is gone too, on the author's 2026-09-04 instruction, and
   its stop went with it: the practice run is the worked example and
   the essay, and the essay is renumbered 05 rather than left at 06
   over a hole. The three cases below that name a route by hand were
   edited with the removal instead of being loosened, which is the
   same discipline the paragraph above describes.

   The insertion of 2026-09-05 is the first move in the other
   direction since the split, and it is the case this file was
   written for: `/spec/attractor` is a fourth child under `app/spec`,
   so the walk below would have failed on it as an orphan until
   `SPEC_CROSSWALK` was added to the list. It went in at 04, between
   the last layer and the sandbox, and the two numbered practice
   stops moved down a rung with it — which is why three cases here
   name a number, and why they were edited rather than loosened.

   The 2026-09-06 fold is the first move that does BOTH at once. The
   owner accepted the finding that Attractor and the ontology read as
   rival standards because of the order they are met in ("The
   motivations you provided are sound. Apply them"), so
   `/spec/attractor` moved from 04 to 01 and every stop below it
   renumbered, and `/spec/ontology` folded into `/spec/card` and left
   the tree. An insertion at the FRONT is the case the neighbour
   block below was written for and had never had: reordering leaves
   both arrays consistent and the reading order wrong, and neither
   `position` nor the pair loop can see it, because both walk
   whatever order the list is in. So the two stops on either side of
   the move are named by hand there, from both directions.

   So this file walks `app/spec` and holds the two directions
   against each other. The walk is what stops a child reappearing
   under `app/spec` without an entry in the list — which is exactly
   what `/spec/scoring` would have become if it had been kept. It
   also checks that each page renders the pager at all, because a
   page that renders one and a page that forgets it look identical
   from the route table.

   The walk is a source scan. The pages are server components that
   read the archive, and the fact worth guarding is which files exist
   and what they import, which is reachable from the filesystem. The
   one render here is the rail-order cell at the foot, which draws
   `/spec/card` through `renderToStaticMarkup` because one of its
   rail ids is declared in a component the page imports rather than
   in the page file. No DOM either way: the suite is
   `environment: "node"` by design.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SpecCardPage from "@/app/spec/card/page";
import {
  SPEC_LAYERS,
  LEARN_PRACTICE,
  RUNS,
  SPEC_CROSSWALK,
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

  /* Two layer pages, and the crosswalk between them and the door.
     ------------------------------------------------------------
     `SPEC_LAYERS` was three until the vocabulary's page folded into `/spec/card` on
     2026-09-06. It is named here by its whole contents rather than by a length, so the fold
     is one edited line and a page reappearing at `/spec/ontology` without an entry is still
     caught by the orphan walk above. The crosswalk is asserted to stand between the door and
     the first layer, which is the half of the reordering the `run` table below cannot see:
     that table would pass on any list whose steps happen to ascend. */
  it("opens at the overview, then the crosswalk, then the layers in resolution order", () => {
    expect(SPEC_SEQUENCE[0]).toBe(SPEC_OVERVIEW);
    expect(SPEC_SEQUENCE[1]).toBe(SPEC_CROSSWALK);
    expect(SPEC_LAYERS.map((layer) => layer.href)).toEqual([
      "/spec/topology",
      "/spec/card",
    ]);
  });

  /**
   * The sequence is two named runs over one list, and this is the shape of both.
   *
   * Written out stop by stop rather than derived, which is what makes it a statement about
   * the numbering rather than a restatement of the list: a table that read the steps off
   * `SPEC_SEQUENCE` would agree with any renumbering at all. The practice run closes the
   * digits up when a stop leaves it, so the two remaining stops read 04 and 05 with no hole
   * where the essay's number was, and this is where that is written down.
   */
  it("runs the specification, then the practice, over one list", () => {
    expect(
      SPEC_SEQUENCE.map(({ step, href, run }) => ({ step, href, run })),
    ).toEqual([
      { step: "00", href: "/what-a-blueprint-is", run: "specification" },
      { step: "01", href: "/spec/attractor", run: "specification" },
      { step: "02", href: "/spec/topology", run: "specification" },
      { step: "03", href: "/spec/card", run: "specification" },
      { step: "04", href: "/capabilities", run: "practice" },
      { step: "05", href: "/tutorial", run: "practice" },
    ]);
    expect(LEARN_PRACTICE.map((page) => page.href)).toEqual([
      "/capabilities",
      "/tutorial",
    ]);
  });

  /**
   * The sandbox is gone, and nothing in Learn points at it.
   *
   * `SANDBOX` at `/build` was stop 05 and opened the practice run, exported by name so the
   * header's Learn menu and the footer's Learn column printed one label for it. The owner
   * deleted the route and its component tree on 2026-09-06 ("it is not useful and make
   * confusion"), so the export, the stop and both nav rows went in the same change.
   *
   * Asserted from three directions rather than by the sequence table above alone, because
   * that table would still pass if the route came back somewhere the sequence does not
   * reach: no stop points at it, and neither chrome writes a row for it. A Learn menu row
   * to a deleted route is a 404 the sequence cannot see.
   */
  it("carries no stop at the deleted sandbox, and neither chrome links it", () => {
    expect(SPEC_SEQUENCE.map((page) => page.href)).not.toContain("/build");
    expect(() => specNeighbours("/build")).toThrow();
    for (const path of ["components/site/SiteHeader.tsx", "components/site/SiteFooter.tsx"]) {
      expect(readFileSync(join(ROOT, path), "utf8"), path).not.toContain("SANDBOX");
    }
  });

  /**
   * Where the practice run starts and where it ends, named by hand from both directions.
   *
   * The run has opened on three different pages as stops were added and deleted around it,
   * and each move left both arrays consistent and the reading order somewhere new. So the
   * seam is asserted rather than derived: the first practice stop hands back to the last
   * layer page, and the last stop hands on to nothing.
   *
   * Both halves for each page, because a page can be in the list and forget to draw the
   * pager the list gives it, and the two failures look identical from the route table.
   */
  it("opens the practice run at what you can do and closes it with the tutorial", () => {
    expect(specNeighbours("/capabilities").previous?.href).toBe("/spec/card");
    expect(SPEC_SEQUENCE.at(-1)?.href).toBe("/tutorial");
    expect(specNeighbours("/tutorial").next).toBeUndefined();
    expect(specNeighbours("/tutorial").previous?.href).toBe("/capabilities");
    for (const page of ["app/capabilities/page.tsx", "app/tutorial/page.tsx"]) {
      const text = readFileSync(join(ROOT, page), "utf8");
      expect(text, page).toMatch(/from "@\/components\/spec\/SpecPager"/);
      expect(text, page).toContain("<SpecPager href={HERE} />");
    }
  });

  /** The position a reader is shown is the position inside their own run. */
  it("counts a stop against its own run, not across both", () => {
    expect(runPosition("/spec/card")).toEqual({
      run: "specification",
      position: 4,
      total: 4,
    });
    expect(runPosition("/capabilities")).toEqual({
      run: "practice",
      position: 1,
      total: 2,
    });
    expect(Object.keys(RUNS).sort()).toEqual(["practice", "specification"]);
  });

  /* This case had a different subject and the subject was deleted.

     It pinned stop 03's `nav` ("Ontology file") against its `title` ("Ontology"), because
     the two deliberately differed: `/ontology` had taken the bare word across the chrome on
     the author's instruction, and `nav` is what the Learn dropdown, the footer, the rail and
     the pager print. Both of those routes are gone now, so there is no pair of names left to
     hold apart and nothing for the case to be about.

     What replaces it is the claim the fold actually makes. `/spec/card` documents two of a
     blueprint's three files since 2026-09-06, and the two fields that carry that to a reader
     are the eyebrow above its `h1` and the file line under its door on
     `/what-a-blueprint-is`. The second is also where the deleted entry's `file` was rehomed:
     `tests/server/t260/frozen-tests.test.ts` records that string as the last statement on the
     site that the local overlay exists at all, so it is pinned here rather than left to be
     tidied back to one path by somebody who reads the line as a duplicate. */
  it("says on the card stop that it carries the vocabulary as well", () => {
    expect(SPEC_LAYERS[1]).toMatchObject({
      href: "/spec/card",
      step: "03",
      eyebrow: "Layers 02 and 03 of 03",
    });
    expect(SPEC_LAYERS[1].file).toContain("cards/id@version.yaml");
    expect(SPEC_LAYERS[1].file).toContain("ontology/extensions.yaml");
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
    expect(specNeighbours(SPEC_LAYERS[0].href).previous).toBe(SPEC_CROSSWALK);
    /* Both sides of the crosswalk, which is where it MOVED TO rather than where it was
       inserted. Reordering a list is the one edit that leaves the arrays consistent and the
       reading order wrong, and neither `position` nor the neighbour loop below would notice:
       they walk whatever order the list is in. The pair was `SPEC_LAYERS[2]` and
       `LEARN_PRACTICE[0]` while this page closed the specification run; it opens that run
       now, so the door is behind it and the first layer is in front. */
    expect(specNeighbours(SPEC_CROSSWALK.href).previous).toBe(SPEC_OVERVIEW);
    expect(specNeighbours(SPEC_CROSSWALK.href).next).toBe(SPEC_LAYERS[0]);
    // And the practice run still opens where the specification run ends.
    expect(specNeighbours(LEARN_PRACTICE[0].href).previous).toBe(SPEC_LAYERS[1]);

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

describe("the rail lists a page's sections in the order the page renders them", () => {
  /**
   * `sequence.ts` documents `sections` as "in the order they appear on it", and the rail
   * draws whatever order the list is in. Nothing compared the two: a band moved on the page
   * leaves the list consistent and the rail's rows out of order, which `anchors.test.ts`
   * cannot see because every id still resolves. Rendered rather than scanned, because one
   * of the card page's ids is declared in a component the page imports rather than in the
   * page file. The registry band renders as its `Suspense` fallback here, which is fine:
   * its heading, the id the rail points at, stands above the boundary.
   */
  it("/spec/card declares its rail ids in the rail's order", () => {
    const html = renderToStaticMarkup(createElement(SpecCardPage as never));
    const page = SPEC_SEQUENCE.find((stop) => stop.href === "/spec/card");
    const sections = page?.sections ?? [];
    // The premise: an empty list is trivially ordered.
    expect(sections.length).toBeGreaterThan(1);

    const positions = sections.map((section) => ({
      id: section.id,
      at: html.indexOf(`id="${section.id}"`),
    }));
    for (const { id, at } of positions) {
      expect(at, `nothing on the rendered page declares id="${id}"`).toBeGreaterThan(-1);
    }
    for (let i = 1; i < positions.length; i += 1) {
      const before = positions[i - 1];
      const here = positions[i];
      expect(
        here.at,
        `the rail lists #${before.id} before #${here.id}, and the page renders them the ` +
          `other way round`,
      ).toBeGreaterThan(before.at);
    }
  });
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

  /* Two of the three, and the third is a recorded loss rather than a relaxed assertion.

     `#ontology` was the band on `/what-a-blueprint-is` that a bookmark on the pre-split
     `/spec#ontology` landed on. Its entry left `SPEC_LAYERS` when the vocabulary's page
     folded into `/spec/card` on 2026-09-06, and `anchor` cannot be rehomed onto the card
     entry: the case below holds every anchor to its own route's last segment, one entry at
     a time, so a second id would have to be a second entry and a second entry at
     `/spec/card` is two doors to one page. What that costs is one fragment landing at the
     top of the door page instead of at a band, and it is `app/what-a-blueprint-is` that can
     pay it back by declaring the id on the band that survived. */
  it("keeps the surviving old in-page ids on the sequence", () => {
    expect(SPEC_LAYERS.map((layer) => layer.anchor).sort()).toEqual([
      "card",
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
