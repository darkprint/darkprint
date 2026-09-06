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
   The vocabulary has ONE route, and it is `/spec/ontology`.

   This file has now asserted three different things, and the two
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

   ── third position, and it is the one asserted below ──
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

   Every claim here is asserted in both directions, so a fourth pass
   restoring the index cannot do it without this file saying which
   one won.

   ── a second ruling the same day, about the page and not the route ──
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
   * The merged route, the surviving detail route, the deleted index, and the redirects.
   *
   * THE POSITIVES COME FIRST AND THEY ARE THE PREMISE FOR THE ABSENCE.
   * `app/ontology/page.tsx` is gone, and a cell that only asserts that passes identically
   * whether the merge deleted one file or whether somebody deleted `app/`. So the parent
   * directory and the detail route are asserted present before the index is asserted
   * absent: with those two standing, a missing `page.tsx` can only be the deletion the
   * owner asked for. `tests/server/t262/per-request.test.ts` raises the same kind of premise
   * as a `PartitionError` rather than folding it into the assertion it protects.
   */
  it("puts the vocabulary on the spec route and keeps the term detail pages", async () => {
    const specPage = statSync(`${ROOT}/app/spec/ontology/page.tsx`, { throwIfNoEntry: false });
    expect(specPage, "the route the vocabulary was moved ONTO is missing").toBeDefined();

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

    // Only now is the absence a statement about this ruling rather than about the tree.
    expect(
      statSync(`${ROOT}/app/ontology/page.tsx`, { throwIfNoEntry: false }),
      "the index page is back. It was deleted on the owner's instruction of 2026-09-06 and " +
        "`/ontology` is a redirect source now, so a `page.tsx` here is shadowed and " +
        "unreachable rather than loudly wrong.",
    ).toBeUndefined();

    const redirects = (await nextConfig.redirects?.()) ?? [];
    // The index's own path, and the two gallery paths that used to land on it.
    expect(redirects).toContainEqual({
      source: "/ontology",
      destination: "/spec/ontology",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/ontologies",
      destination: "/spec/ontology",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/ontologies/:slug",
      destination: "/spec/ontology",
      permanent: true,
    });

    // Nothing chains. A 308 onto a route that itself 308s costs every old link two hops,
    // which is the cost `next.config.ts` already records for `/how-to-build-a-dark-factory`.
    expect(
      redirects.filter((rule) => rule.source === "/spec/ontology"),
      "`/spec/ontology` is itself a redirect source, so the two gallery paths and " +
        "`/ontology` all chain through it and the merged page is shadowed entirely.",
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
   * One enumeration of the vocabulary, and it is on the spec page now.
   *
   * The rule has survived all three positions and only its address has changed: this site
   * carries ONE exhaustive term listing. The first position put it on the spec page because
   * the index was redirected away, the second moved it to the index because the index came
   * back, and this one moves it to the spec page again because the index is gone.
   *
   * `VocabularyBrowser` is the filtered list, on the bar the other two registry browsers
   * use, over `OntologyCatalog` as its unfiltered view. The catalog travels WITH the
   * browser rather than being deleted by it: it is the only drawing of the vocabulary that
   * groups by kind and hangs the subtypes off their parents, and the browser mounts it as
   * children. Both are named, because "the listing is on the spec page" is only half the
   * rule and the other half went missing once already.
   *
   * The reverse is the whole-tree walk. Asserting the spec page has the browser does not
   * stop a future pass mounting a second copy on a restored index, and that is precisely
   * the shape this file has been flipped over twice: `app/**` may hold exactly one page
   * that mounts it.
   */
  it("mounts the one enumeration on the spec page and nowhere else", () => {
    const spec = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");

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

       The floor is 10 against 27 pages today, and it is deliberately nowhere near the real
       number. This is a premise about the INSTRUMENT and not a census: two routes were
       deleted in the week this was written, so a floor set close to the count would one day
       red a correct tree with a message saying the walk is broken, which is a red reporting
       a plausible wrong cause. A walk that has actually stopped working returns 0. */
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
        "exhaustive term listing on one page is the rule that outlived all three rulings " +
        "about WHICH page.",
    ).toEqual(["app/spec/ontology/page.tsx"]);
  });

  /**
   * The route box came off, and the page it pointed at is the page it now sits on.
   *
   * The owner named the box: the vocabulary goes in "substituing the "every term" box". A
   * merge that mounted the browser and left the box standing would leave the page linking
   * to a route that 308s back onto itself, one screen above the listing that link promised.
   *
   * ASSERTED ON THE JSX SHAPE AND NOT ON THE BARE HREF, deliberately. This cell greps the
   * page's SOURCE, comments included, and that page's comments quote route paths in
   * backticks while recording why each one moved. A bare href match would charge the page
   * for its own history and go red against a correct merge, which is the hazard the page
   * warns about at the box's old position for this very file.
   */
  it("took the route box out of the slot the browser now fills", () => {
    const spec = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");
    expect(
      /<RouteBoxLink[^>]*href="\/ontology"/.test(spec),
      "the `Every term` route box is still on the page, pointing at a path that now 308s " +
        "back to this page. The owner asked for the browser to replace it.",
    ).toBe(false);
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
   * removal it is checking for. It is not hypothetical today: the page names
   * `components/spec/CheckTable.tsx` in a comment about which component the vocabulary table
   * should have reused, so a bare `toContain("CheckTable")` reds against the removed band.
   * No count is given here on purpose, because a census of somebody else's comments is a
   * sentence that goes stale on their next pass.
   *
   * THE POSITIVES ARE THE PREMISE. A page truncated to a stub, or deleted outright,
   * satisfies every absence below. `tests/server/t262/per-request.test.ts` raises that class
   * of premise on its own rather than folding it into the assertion it protects, and the
   * first cell in this file does the same for the deleted index. So the band that STAYED is
   * asserted present first: a removal of two sections may not quietly take the rest of the
   * page with it.
   */
  it("took the overlay and the checks bands off and left the rest of the page standing", () => {
    const page = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");

    // The premise: this is still the specification page, with the vocabulary band on it.
    expect(
      /<h2[^>]*id="vocabulary-heading"/.test(page),
      "the core vocabulary band is gone too. The owner named two sections, and a page that " +
        "has lost this one as well is not the removal that was ruled.",
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

    /* What the two bands rendered, matched where they were rendered rather than by name.
       `OVERLAY_RULES` was declared in this file and mapped in the band; `CheckTable` was
       imported and mounted. Either one back is the band back in some form, whatever the
       heading above it reads. */
    expect(
      /(const OVERLAY_RULES|OVERLAY_RULES\.map\()/.test(page),
      "the overlay rules list is back, so the band it filled is back with it.",
    ).toBe(false);
    expect(
      /<CheckTable\b/.test(page),
      "the checks table is mounted again.",
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
   * so the surviving statement of it on `/spec/ontology` was pinned here in the same pass.
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
   * `#governance` stays asserted absent. A link to a fragment nothing declares scrolls
   * nowhere, and `components/site/anchors.test.ts` reads the pair from the source.
   */
  it("dropped the governance band and every band that restated it", () => {
    const catalog = readFileSync(`${ROOT}/components/ontology/OntologyCatalog.tsx`, "utf8");
    const spec = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");

    /* The premise. Every absence below is green against an emptied file, and two files have
       lost a section apiece today, which is exactly the pass in which one gets emptied by
       accident. */
    expect(
      catalog,
      "the catalog no longer draws the kinds, so the absences below are facts about a file " +
        "that lost its content rather than about the governance band.",
    ).toContain("The five kinds of term");
    expect(
      /<h2[^>]*id="vocabulary-heading"/.test(spec),
      "the specification page has lost its vocabulary band too, so the `#governance` " +
        "absence below says nothing about the rail row it was written for.",
    ).toBe(true);

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
