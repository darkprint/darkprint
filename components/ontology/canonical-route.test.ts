import { readdirSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import type { OntologyTerm } from "@/lib/core";
import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import { BUNDLE_VOCABULARY, bundleFilePaths } from "@/lib/content/bundle-export";
import { ONTOLOGY_EXTENSIONS_FILE, parseOntologyTerms } from "@/lib/content/ontology-file";

import nextConfig from "../../next.config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The one term the archive's own overlay declares, and the code that refuses an unrooted one.
 *
 * Named here rather than inline because the last cell reads the term four ways and the
 * diagnostic twice, and a literal repeated six times is six places for a rename to land
 * half-done. Both are read off the product: the id is `content/ontology/extensions.yaml`'s
 * own, and the code is raised by `lib/core/ontology/resolve.ts`.
 */
const OVERLAY_TERM = "lupo/pii-handling";
const UNROOTED = "ontology/local-term-unrooted";

/* ============================================================
   The vocabulary has ONE route, and it is `/spec/card`.

   This file has now asserted four different things, and the three
   it no longer asserts are kept below because each was right when
   it was written. A guard that flips and throws its argument away
   teaches the next reader nothing except that it flipped.

   ── first position: no index, catalog on the spec page ──
   `/ontology` had no page and 308'd onto `/spec/ontology`. That was
   right while the vocabulary had nowhere of its own: the §1 rename
   left one core ontology and its catalog was a band on the spec
   page, so an index route would have been a second door onto one
   room.

   ── second position: two routes, split by question ──
   The accounts pass changed the premise rather than the rule. The
   registry held three things and the chrome named all three, so
   Vocabulary needed somewhere to point, and pointing it at
   `/spec/ontology` would have put two names on one route on one
   screen, which is the defect `nav.test.ts` exists for. So the index
   became a page again and the two routes split by question:
   `/ontology` was the terms, on the shared `RegistryFilterBar` with
   search, a kind filter, a core-or-local filter and a usage count
   per term; `/spec/ontology` was the format. This file was written
   to hold that split so neither route could quietly absorb the other
   again.

   ── third position: one page, both questions ──
   The owner ruled on 2026-09-06, in their own words: "move the
   ontology page in the /spec/ontology substituing the "every term"
   box. Then, you can delete the /ontology page". So the browser
   moves onto the spec page in the slot the `Every term` route box
   occupied, and the index is deleted.

   THAT ABOLISHES THE SPLIT THIS FILE WAS WRITTEN TO DEFEND, BY
   RULING RATHER THAN BY REFUTATION. The argument for the split is
   not wrong on its own terms and it is not being corrected here: the
   owner has decided that one page carrying both the format and the
   words beats two pages a reader has to choose between, and that is
   a call about the site rather than about the code. What the second
   position bought — a browse target the chrome could name without
   landing a reader on a document — is paid for instead by the chrome
   pointing its one Ontology row straight at `/spec/ontology`.

   ── fourth position, and it is the one asserted below ──
   The owner asked a larger question than the address: whether the
   ontology should exist at all, or whether everything should unify
   under the Attractor specification, because two spec documents
   read as two rival standards. The investigation answered keep the
   vocabulary and fix the framing, and the owner accepted it in
   their own words: "The motivations you provided are sound. Apply
   them."

   THE EVIDENCE IS RECORDED HERE SO NO LATER PASS RE-DERIVES IT.
   13 of the 54 core terms overlap Attractor at all, and those 13
   REFINE it: `agent`, `tool` and `validation` are three DarkPrint
   node-types Attractor collapses into one `shape=box`. The other
   41 have no Attractor equivalent — 15 data-types against an
   Attractor edge that carries only `label, condition, weight,
   fidelity, thread_id, loop_restart`, 9 risk-markers, 12 tools, 5
   phases. Attractor specifies EXECUTION and the ontology specifies
   DESCRIPTION, which is the layer Attractor leaves open and the
   thing that makes a registry searchable. So the vocabulary is not
   a rival standard and it is not being folded into one.

   What IS being folded is the route. Every ontology term exists to
   be a legal value of a CARD FIELD: `type`, `phases`,
   `riskMarkers`, `tools`, and a port's `type`. The DOT never
   references a term, it references a card, and the card references
   terms. So `/spec/ontology` folds into `/spec/card` and each term
   sits beside the field that consumes it, which is a reader
   walking one document instead of choosing between two.

   THAT VOIDS THE THIRD POSITION'S COMPENSATION, and the void is
   the reason this paragraph exists rather than a rewrite of the
   one above. What the second position bought was a browse target
   the chrome could name, and the third position paid for it by
   pointing the chrome's one Ontology row at `/spec/ontology`. That
   row's destination is gone. The chrome is another lane's file and
   `components/site/nav.test.ts` is what holds it; this file asserts
   only that the route it pointed at is now a redirect source and
   that nothing chains behind it.

   ── what did NOT move, and why it is asserted here ──
   `app/ontology/[...term]/page.tsx`. Term detail keeps its URLs:
   card chips, `termHref` and search all point there, and a redirect
   `source` without a path parameter is a literal path (Next 16,
   `node_modules/next/dist/docs/01-app/03-api-reference/05-config/
   01-next-config-js/redirects.md`, "Path Matching"), so the 308 on
   `/ontology` cannot shadow `/ontology/<term>`. A merge that took
   the detail pages along with the index would be a real regression
   wearing this ruling as cover, so it is asserted below in its own
   right.

   Every claim here is asserted in both directions, so a fifth pass
   restoring the index cannot do it without this file saying which
   one won.

   ── a second ruling on 2026-09-06, about the page and not the route ──
   The owner then removed two of the merged page's bands: "remove
   "The overlay / Anyone can add a term, in a namespace of their own"
   section ... and also the "The checks / What the engine holds the
   vocabulary to" section". That is a different question from the one
   above and it is asserted in its own cells rather than folded into
   the route argument. It has one consequence worth meeting here,
   because it outlives every position this file has held: the overlay
   MECHANISM is still in the product and the site has stopped
   documenting it. The last two cells hold the two halves of that,
   and neither is a comment.
   ============================================================ */
describe("the canonical ontology route", () => {
  /**
   * The merged route, the surviving detail route, the two deleted pages, and the redirects.
   *
   * THE POSITIVES COME FIRST AND THEY ARE THE PREMISE FOR THE ABSENCES.
   * Two files are gone now rather than one, and a cell that only asserts that passes
   * identically whether the fold deleted two pages or whether somebody deleted `app/`. So
   * the route the vocabulary landed on, the parent directory and the detail route are
   * asserted present first: with those three standing, a missing `page.tsx` under either
   * path can only be the deletion that was ruled. `tests/server/t262/per-request.test.ts`
   * raises the same kind of premise as a `PartitionError` rather than folding it into the
   * assertion it protects.
   *
   * THE REDIRECT SET GREW BY ONE AND THE CHAIN CHECK INVERTED. `/spec/ontology` was the
   * destination in the third position and it is a SOURCE in the fourth, so the predicate
   * that used to assert it was not a source now asserts that it is, and `/spec/card` takes
   * the place it vacated. Both directions are kept: a fold that redirected the old spec
   * route and left `/ontology` pointing at it would cost every old link two hops, which is
   * the cost `next.config.ts` already records for `/how-to-build-a-dark-factory`.
   */
  it("puts the vocabulary on the card route and keeps the term detail pages", async () => {
    const cardPage = statSync(`${ROOT}/app/spec/card/page.tsx`, { throwIfNoEntry: false });
    expect(cardPage, "the route the vocabulary was folded INTO is missing").toBeDefined();

    const detailDir = statSync(`${ROOT}/app/ontology`, { throwIfNoEntry: false });
    expect(
      detailDir,
      "`app/ontology/` is gone entirely, which takes the term detail routes with it. The " +
        "owner asked for the index page to be deleted, not the directory.",
    ).toBeDefined();
    expect(
      statSync(`${ROOT}/app/ontology/[...term]/page.tsx`, { throwIfNoEntry: false }),
      "the term detail route is gone. Card chips, `termHref` and search all point at " +
        "`/ontology/<term>`; moving those URLs is a far larger change than was ruled.",
    ).toBeDefined();

    // Only now are the absences statements about these rulings rather than about the tree.
    expect(
      statSync(`${ROOT}/app/ontology/page.tsx`, { throwIfNoEntry: false }),
      "the index page is back. It was deleted on the owner's instruction of 2026-09-06 and " +
        "`/ontology` is a redirect source now, so a `page.tsx` here is shadowed and " +
        "unreachable rather than loudly wrong.",
    ).toBeUndefined();
    expect(
      statSync(`${ROOT}/app/spec/ontology/page.tsx`, { throwIfNoEntry: false }),
      "the separate ontology specification page is back. The fourth ruling folds it into " +
        "`/spec/card` so each term sits beside the card field that consumes it, and a page " +
        "here is the second document the fold exists to remove.",
    ).toBeUndefined();

    const redirects = (await nextConfig.redirects?.()) ?? [];
    // The two deleted pages' own paths, and the two gallery paths that used to land on them.
    for (const source of ["/ontology", "/ontologies", "/ontologies/:slug", "/spec/ontology"]) {
      expect(
        redirects,
        `nothing 308s \`${source}\` onto \`/spec/card\`, so a link that used to reach the ` +
          `vocabulary now 404s`,
      ).toContainEqual({ source, destination: "/spec/card", permanent: true });
    }

    // Nothing chains, and the route that used to be the destination is now a source.
    expect(
      redirects.filter((rule) => rule.source === "/spec/card"),
      "`/spec/card` is itself a redirect source, so all four paths above chain through it " +
        "and the folded page is shadowed entirely.",
    ).toEqual([]);

    // And nothing shadows term detail. A `source` with no path parameter matches literally,
    // so `/ontology` alone is safe; a `/ontology/:term` or `/ontology/:path*` would not be.
    expect(
      redirects.filter((rule) => rule.source.startsWith("/ontology/")),
      "a redirect matches under `/ontology/`, and redirects are checked before the " +
        "filesystem, so it shadows the term detail pages that deliberately did not move.",
    ).toEqual([]);
  });

  /**
   * One enumeration of the vocabulary, and it is on the card page now.
   *
   * The rule has survived all four positions and only its address has changed: this site
   * carries ONE exhaustive term listing. The first position put it on the spec page because
   * the index was redirected away, the second moved it to the index because the index came
   * back, the third moved it to the spec page again because the index was deleted, and this
   * one moves it to the card page because the spec page is.
   *
   * `VocabularyBrowser` is the filtered list, on the bar the other two registry browsers
   * use, over `OntologyCatalog` as its unfiltered view. The catalog travels WITH the browser
   * rather than being deleted by it: it is the only drawing of the vocabulary that groups by
   * kind and hangs the subtypes off their parents, and the browser mounts it as children.
   * Both are named, because "the listing is on the card page" is only half the rule and the
   * other half went missing once already.
   *
   * BOTH NAMES SURVIVED THE FOURTH RULING AND THAT WAS NOT A FOREGONE CONCLUSION. The
   * instruction is that each term sits beside the CARD FIELD that consumes it, which is a
   * layout a by-kind grouping could reasonably have been dropped for. The fold kept the
   * grouping and mounted it exactly as before, so the pair is asserted exactly as before
   * rather than narrowed to the half nobody could have removed.
   *
   * The reverse is the whole-tree walk. Asserting the card page has the browser does not
   * stop a future pass mounting a second copy on a restored index or a restored spec page,
   * and that is precisely the shape this file has been flipped over three times: `app/**`
   * may hold exactly one page that mounts it.
   */
  it("mounts the one enumeration on the card page and nowhere else", () => {
    const spec = readFileSync(`${ROOT}/app/spec/card/page.tsx`, "utf8");

    expect(spec).toContain("VocabularyBrowser");
    expect(spec).toContain("<OntologyCatalog");

    const pages: string[] = [];
    /* The repo-relative path is built as the walk descends rather than sliced off an
       absolute one afterwards: `ROOT` already carries a trailing slash, so `${ROOT}/app`
       doubles the separator and every sliced path comes back with a leading `/` that the
       expectation below would never match. It would fail in the right direction, which is
       the worst kind of wrong: a guard nobody can satisfy reads as a guard nobody can
       break. */
    const walk = (rel: string) => {
      for (const entry of readdirSync(`${ROOT}${rel}`, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${rel}/${entry.name}`);
        else if (entry.name === "page.tsx") pages.push(`${rel}/${entry.name}`);
      }
    };
    walk("app");

    /* The premise: the walk found the site. An empty list would satisfy "exactly one" as
       readily as a correct tree if the count were the only thing checked.

       The floor is 10 against a couple of dozen pages, and it is deliberately nowhere near
       the real number. This is a premise about the INSTRUMENT and not a census: three routes
       were deleted in the fortnight around this being written, this fold takes a fourth, so
       a floor set close to the count would one day red a correct tree with a message saying
       the walk is broken, which is a red reporting a plausible wrong cause. A walk that has
       actually stopped working returns 0. */
    expect(
      pages.length,
      `the walk over \`app/\` found ${pages.length} pages, so it has stopped seeing the ` +
        `site and the count below is measured over nothing`,
    ).toBeGreaterThan(10);

    const mounts = pages.filter((path) =>
      readFileSync(`${ROOT}${path}`, "utf8").includes("<VocabularyBrowser"),
    );
    expect(
      mounts,
      "the vocabulary browser is mounted on more than one route, or on the wrong one. One " +
        "exhaustive term listing on one page is the rule that outlived all four rulings " +
        "about WHICH page.",
    ).toEqual(["app/spec/card/page.tsx"]);
  });

  /**
   * No route box on the card page points at a path that now 308s back to it.
   *
   * The third ruling named a box: the vocabulary went in "substituing the "every term"
   * box", and a merge that mounted the browser and left the box standing would leave the
   * page linking to a route that redirects onto itself, one screen above the listing that
   * link promised. The fourth ruling inherits the same hazard at a second address, because
   * `/spec/ontology` is a redirect source now as well. Both are asserted, so a fold that
   * carried a `Learn the format` box across from the deleted page reds here.
   *
   * ASSERTED ON THE JSX SHAPE AND NOT ON THE BARE HREF, deliberately. This cell greps the
   * page's SOURCE, comments included, and that page's comments quote route paths in
   * backticks while recording why each one moved. A bare href match would charge the page
   * for its own history and go red against a correct merge, which is the hazard the page
   * warns about at the box's old position for this very file.
   */
  it("carries no route box pointing at a path that redirects back to it", () => {
    const spec = readFileSync(`${ROOT}/app/spec/card/page.tsx`, "utf8");
    for (const path of ["/ontology", "/spec/ontology"]) {
      expect(
        new RegExp(`<RouteBoxLink[^>]*href="${path}"`).test(spec),
        `a route box on the card page points at \`${path}\`, which 308s straight back to ` +
          `this page. The listing that link promises is on the page the reader is already ` +
          `looking at.`,
      ).toBe(false);
    }
  });

  /**
   * The two specification bands the owner took off, and the page they came off.
   *
   * THIS CELL ASSERTED THE OPPOSITE UNTIL 2026-09-06. The reversal is the owner's, in their
   * own words: "remove "The overlay / Anyone can add a term, in a namespace of their own"
   * section as it become false as we remove the versioning od the onotology and also the
   * "The checks / What the engine holds the vocabulary to" section". Quoted as given,
   * because the STATED REASON is part of what the next reader has to weigh and it does not
   * survive checking. Ontology VERSIONING went on 2026-09-05; the overlay is a different
   * mechanism and it did not go with it, and "The checks" never had a connection to
   * versioning at all. The instruction stands on the owner's authority over the site rather
   * than on that reason, which is why the reason is recorded here rather than repeated as
   * fact. What the mechanism still does is asserted below, in its own cell, as the thing
   * this page stopped saying.
   *
   * ASSERTED ON THE JSX SHAPE AND NOT ON THE BARE STRING, for the reason the route-box cell
   * two above gives, which bites harder here. That page records why each band it has lost
   * went, in prose, naming the components and the copy in backticks as it goes, so a
   * substring match would charge the page for its own history and go red against exactly the
   * removal it is checking for. No count is given here on purpose, because a census of
   * somebody else's comments is a sentence that goes stale on their next pass.
   *
   * AND THE CHECKS HALF IS NOT MATCHED ON `CheckTable` AT ALL SINCE THE FOURTH RULING, which
   * is the correction the fold forced. On the deleted page a mounted `CheckTable` could only
   * be the vocabulary's checks band coming back. On `/spec/card` it is the page's own
   * subject: `CARD_ROWS` through `CheckTable` is the card validation band, pre-existing,
   * ruled, and nothing to do with the vocabulary. A component name carried across would
   * therefore have red against a correct fold on the page's oldest band. What identifies the
   * removed band instead is its rows: `ONTOLOGY_ROWS` was deleted from
   * `components/spec/rows.ts` in the same instruction, and only a restored band would need
   * it back. That is one name for one band rather than a shape shared with another.
   *
   * THE POSITIVES ARE THE PREMISE. A page truncated to a stub, or deleted outright,
   * satisfies every absence below. `tests/server/t262/per-request.test.ts` raises that class
   * of premise on its own rather than folding it into the assertion it protects, and the
   * first cell in this file does the same for the deleted pages. So the card page's own
   * field band and the browser it now carries are asserted present first: a fold may not
   * quietly satisfy two absences by losing the page they are about.
   *
   * READ OFF `/spec/card` SINCE THE FOURTH RULING. The page these two bands were removed
   * from no longer exists, and an absence measured against a deleted file is the vacuous
   * pass this whole wave was warned about: it holds whether the fold left the bands behind
   * or whether somebody restored them at the new address. `/spec/card` is where the
   * vocabulary lives now, so it is where a returning overlay or checks band would land.
   */
  it("took the overlay and the checks bands off and left the rest of the page standing", () => {
    const page = readFileSync(`${ROOT}/app/spec/card/page.tsx`, "utf8");

    // The premise: this is still the card specification, with the vocabulary folded onto it.
    expect(
      /<h2[^>]*id="fields-heading"/.test(page),
      "the field reference band is gone. Every ontology term is a legal value of a card " +
        "field, so a card page without that band is not the fold that was ruled, and the " +
        "absences below would be facts about a truncated page.",
    ).toBe(true);
    expect(page).toContain("<VocabularyBrowser");
    expect(page).toContain("<OntologyCatalog");

    // Only now is an absence a statement about this ruling rather than about the file.
    const bands = [
      {
        id: "overlay-heading",
        band: "The overlay / Anyone can add a term, in a namespace of their own",
      },
      {
        id: "ontology-checks-heading",
        band: "The checks / What the engine holds the vocabulary to",
      },
    ] as const;
    for (const { id, band } of bands) {
      expect(
        new RegExp(`aria-labelledby="${id}"`).test(page),
        `the \`${band}\` band is back on the page. The owner removed it on 2026-09-06.`,
      ).toBe(false);
      expect(
        new RegExp(`<h2[^>]*id="${id}"`).test(page),
        `the \`${band}\` heading is back, which also re-declares a fragment the Learn rail ` +
          `links from \`components/spec/sequence.ts\`.`,
      ).toBe(false);
    }

    /* What the two bands rendered, matched by the data each one needed rather than by the
       component that drew it. `OVERLAY_RULES` was declared on the removed page and mapped in
       its band; `ONTOLOGY_ROWS` was the vocabulary's check rows and was deleted from
       `components/spec/rows.ts` on the same instruction. Either one back is the band back in
       some form, whatever the heading above it reads, and neither collides with a band this
       page already had. */
    expect(
      /(const OVERLAY_RULES|OVERLAY_RULES\.map\()/.test(page),
      "the overlay rules list is back, so the band it filled is back with it.",
    ).toBe(false);
    expect(
      /\bONTOLOGY_ROWS\b/.test(page),
      "the vocabulary's check rows are on the card page, so the checks band is back under " +
        "some heading. `CARD_ROWS` is this page's own band and is not what this reads.",
    ).toBe(false);
  });

  /**
   * The catalog is the browser's unfiltered view, and it still says what it always said.
   *
   * It stood unmounted for one pass, kept as "the shape a future browse-by-kind view starts
   * from". That view is this one. Deleting it at any point would have thrown away the only
   * drawing of the vocabulary that groups by kind, hangs the subtypes off their parents and
   * puts the paragraph about how to read a kind under the terms of that kind, none of which
   * a flat list can carry, and the author asked for exactly that reading back.
   *
   * Two claims: the sections are intact, and the component supplies no page container of
   * its own. It used to, because it mounted as a full-bleed band; it is nested inside the
   * route's container now, and a second `container-page` inside the first pads the whole
   * catalog twice and narrows it against the heading above it. That was true when the
   * browser was on `/ontology` and it is true a route later.
   */
  it("keeps the catalog intact and lets its route own the page container", () => {
    const catalog = readFileSync(`${ROOT}/components/ontology/OntologyCatalog.tsx`, "utf8");
    expect(catalog).toContain("The five kinds of term");
    expect(catalog).toContain("How to read this set");
    expect(catalog).not.toContain('className="container-page');
  });

  /**
   * The governance band came off, and so did the two bands that restated what it described.
   *
   * The owner removed "One curated core, room for local terms" earlier on 2026-09-06: it
   * drew three layers, the third of which was promotion into the core, and promotion only
   * meant something while the vocabulary carried versions to promote a term between. The
   * versioning went on 2026-09-05.
   *
   * THIS CELL USED TO ASSERT THAT THE EXTENSION MODEL SURVIVED THAT CUT, and that half is
   * what D-144 leaned on: deleting the band could take the MECHANISM with it by accident,
   * so the surviving statement of it on the specification page was pinned here in the same
   * pass.
   * Later the same day the owner removed that statement too. D-144's justification is
   * therefore void as written, and the pair it named is gone: no band on this site now says
   * that anyone may add a term in a namespace of their own, and there is no weaker surviving
   * sentence to fall back on. The nearest thing left is `components/spec/sequence.ts`'s
   * `file: "ontology/extensions.yaml"` on the Learn rail, which names the file and says
   * nothing about who may write one.
   *
   * The claim is not being deleted from this file. It is being MOVED onto what is still
   * true, in the cell below, and asserted against the product rather than against the page,
   * because the product is where it still holds. Reading the two together is the finding:
   * the engine enforces an overlay the site no longer documents.
   *
   * `#governance` stays asserted absent, at the address the vocabulary now has. A link to a
   * fragment nothing declares scrolls nowhere, and `components/site/anchors.test.ts` reads
   * the pair from the source.
   */
  it("dropped the governance band and every band that restated it", () => {
    const catalog = readFileSync(`${ROOT}/components/ontology/OntologyCatalog.tsx`, "utf8");
    const spec = readFileSync(`${ROOT}/app/spec/card/page.tsx`, "utf8");

    /* The premise. Every absence below is green against an emptied file, and two files have
       lost a section apiece today, which is exactly the pass in which one gets emptied by
       accident. */
    expect(
      catalog,
      "the catalog no longer draws the kinds, so the absences below are facts about a file " +
        "that lost its content rather than about the governance band.",
    ).toContain("The five kinds of term");
    expect(
      spec,
      "the card page does not mount the vocabulary, so the `#governance` absence below is a " +
        "fact about a page the terms never reached rather than about the removed band.",
    ).toContain("<VocabularyBrowser");

    // The heading and the promotion layer's own copy, neither of which may come back.
    expect(catalog).not.toContain("One curated core, room for local terms");
    expect(catalog).not.toContain("No term has ever been promoted");
    expect(spec).not.toContain("#governance");
  });

  /**
   * The overlay is still in the product, and the site has stopped saying so.
   *
   * This is the half of the 2026-09-06 removal nobody asked for and everybody inherits.
   * Three mechanisms are live today and not one of them moved on 2026-09-05 or on
   * 2026-09-06: `content/ontology/extensions.yaml` is checked in and ships inside a bundle
   * whose cards name a local term, `ontologyView` merges it over `CORE_ONTOLOGY`, and
   * `validate()` refuses a local term no core term subsumes. A reader who wants to add one
   * has nowhere on the site to learn how. That is a documentation gap and not a product
   * change, and the difference is the whole reason this cell exists.
   *
   * WRITTEN AS A POSITIVE, against the code rather than against the page. An assertion that
   * the site does not document the overlay would go red the day somebody documents it
   * again, which is the repair this gap is waiting for, and a guard that reds on its own fix
   * is a guard that gets deleted. The site half is held by the bands-are-off cell above.
   * What the two cells say TOGETHER is the gap, and each half is checked rather than
   * narrated.
   *
   * BOTH DIRECTIONS on the enforcement, because a `validate()` that returned `[]` for
   * everything would satisfy the first half on its own. The shipped overlay goes in once as
   * it stands and once with its `broader` dropped, and only the second may raise
   * `ontology/local-term-unrooted`.
   *
   * The core is asserted NOT to define the term, as a control on the merge. Without it,
   * "the view resolves `lupo/pii-handling`" is satisfied by a curated core that happens to
   * carry it and says nothing at all about an overlay.
   */
  it("still ships, merges and enforces the overlay the page stopped documenting", () => {
    const text = readFileSync(`${ROOT}/content/ontology/extensions.yaml`, "utf8");
    const terms = parseOntologyTerms(parseYaml(text), ONTOLOGY_EXTENSIONS_FILE);

    // It ships: the file is checked in, it parses, and it declares a namespaced term.
    expect(
      terms.length,
      "`content/ontology/extensions.yaml` declares no terms, so every claim below is being " +
        "measured over an empty overlay",
    ).toBeGreaterThan(0);
    const overlaid = terms.find((term) => term.id === OVERLAY_TERM);
    expect(overlaid, `the overlay no longer declares \`${OVERLAY_TERM}\``).toBeDefined();
    expect(overlaid?.broader, "the shipped overlay term names no core parent").toBeDefined();

    /* It travels, asked of the exporter rather than of its source text. A grep for the
       constant's NAME passes against a renamed identifier, because `toContain` is a
       substring and `ONTOLOGY_EXTENSIONS_FILE_RENAMED` contains it; that probe scored zero
       and the assertion was rewritten as a call. `bundleFilePaths` is the listing
       `exportBundle` writes under, and both directions are asked because a function that
       returned the path unconditionally would satisfy the first on its own. */
    const bundled = (vocabulary: boolean): readonly string[] =>
      bundleFilePaths({ cardRefs: [], vocabulary });
    expect(
      bundled(true),
      "a bundle whose cards name a local term no longer carries the vocabulary file, so " +
        "those terms resolve nowhere once the folder leaves this site.",
    ).toContain(BUNDLE_VOCABULARY);
    expect(
      bundled(false),
      `every bundle carries \`${BUNDLE_VOCABULARY}\`, so the listing above is not evidence ` +
        `that the overlay is what put it there`,
    ).not.toContain(BUNDLE_VOCABULARY);
    expect(
      BUNDLE_VOCABULARY,
      "the exporter's name for the vocabulary file and the parser's have drifted apart, so " +
        "a bundle ships a document `/upload` does not read back as the overlay.",
    ).toBe(ONTOLOGY_EXTENSIONS_FILE);

    // It merges: the core does not carry the term, and the merged view does.
    expect(
      CORE_ONTOLOGY.terms.some((term) => term.id === OVERLAY_TERM),
      `\`${OVERLAY_TERM}\` is in the curated core, so the resolution below is not evidence ` +
        `that anything was overlaid`,
    ).toBe(false);
    expect(
      ontologyView(CORE_ONTOLOGY, terms).get(OVERLAY_TERM),
      "the resolver no longer merges the overlay over the core",
    ).toBeDefined();

    // It is enforced, in both directions.
    const codes = (extensions: readonly OntologyTerm[]): string[] =>
      ontologyView(CORE_ONTOLOGY, extensions)
        .validate()
        .map((diagnostic) => diagnostic.code);
    expect(
      codes(terms),
      "the shipped overlay does not satisfy the rule the engine holds it to",
    ).not.toContain(UNROOTED);
    expect(
      codes(terms.map((term) => (term.id === OVERLAY_TERM ? { ...term, broader: undefined } : term))),
      "a local term no core term subsumes is accepted. Doc 3 §7's rule is what makes an " +
        "overlay safe to merge at all, and it is one of the four rules the removed band " +
        "stated that a reader can no longer read anywhere on this site.",
    ).toContain(UNROOTED);
  });
});
