/* ============================================================
   T260 / D-260-11 — the shelf keeps the order it has today

   THE RISK THIS CELL GUARDS IS A FALSE SENTENCE IN A MERGED
   MODULE, WHICH IS WHY IT IS WORTH A CELL AT ALL.

   `lib/server/search/blueprints.ts:44-51` says `/blueprints`'s
   shipped order is `updatedAt || createdAt` descending then title,
   "which `BlueprintSummary` cannot reproduce because it carries no
   timestamp", and publishes `sort=slug` as the only ordering. The
   orchestrator published the same claim in D-200-10.

   It is false. `BlueprintSummary` carries `manifest: BundleManifest`
   (`lib/server/registry/types.ts:31`) and `BundleManifest` declares
   `createdAt?` and `updatedAt?` (`lib/core/bundle/types.ts:28-30`)
   — which is exactly where `lib/content/view.ts:103` reads them
   from today. The timestamps survive the cutover.

   D-260-11 ruled the order preserved, held CLIENT-SIDE. So the
   danger is a cutover that reads the merged comment, believes the
   shelf cannot be ordered any more, and delegates to the API —
   after which `/blueprints` silently reorders from recency to slug.
   Nothing else in the repository would notice: it is not a filter,
   so AC2 does not reach it, and every existing test passes.

   Measured at `3daa325`: the ordering is already in
   `GalleryBrowser.tsx`, which reads `updatedAt`, `createdAt` and
   `title` and calls `.sort` and `.localeCompare`;
   `app/blueprints/page.tsx` reads none of them. So these cells pass
   today and their job is to keep passing — the whole criterion is
   that a rewrite does not take the ordering away.

   ── A GAP THIS SUITE DECLARES RATHER THAN COVERS ──
   D-260-11's second half — dateless bundles sort LAST, then by
   title — is NOT held here. It is a property of a comparator that
   `GalleryBrowser` does not export, over a component this author
   may not read, and no rendered surface exposes it. A source cell
   asserting it would be asserting that some tokens appear near each
   other, which is not the criterion. It needs either an exported
   comparator or a render cell against a fixture carrying a bundle
   with no `createdAt`, and both are decisions for the orchestrator.
   Reported rather than faked: a cell that cannot fail is worse than
   an absent one, because it reads as coverage.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import { BROWSERS, ROUTES, assignedKeys, calledNames, parse, propertyNames } from "./partition";

describe("D-260-11: `/blueprints` keeps its recency order, client-side", () => {
  it("still orders by `updatedAt` falling back to `createdAt`", () => {
    const [source] = sources([BROWSERS.blueprints], 1);
    const sf = parse(source.path, source.raw);
    const names = propertyNames(sf);

    /* Both, and separately. The FALLBACK is the behaviour: `updatedAt ?? createdAt` is what
       `lib/content/view.ts:103` computes and what the shelf has always ordered on, so a
       rewrite that keeps only `updatedAt` silently sends every bundle that was published
       and never edited to the bottom of the shelf. Asserted as two expectations rather than
       one `every`, so a red says WHICH half went. */
    expect(
      names.has("updatedAt"),
      `${BROWSERS.blueprints} no longer reads \`updatedAt\` in code.\n\n` +
        `\`BlueprintSummary.manifest\` is a \`BundleManifest\` and carries it ` +
        `(\`lib/core/bundle/types.ts:28-30\`). If this was removed because ` +
        `\`lib/server/search/blueprints.ts:44-51\` says the summary "carries no timestamp", ` +
        `that sentence is false and D-260-11 corrected it: the order is preserved, held here.`,
    ).toBe(true);
    expect(
      names.has("createdAt"),
      `${BROWSERS.blueprints} no longer reads \`createdAt\` in code. It is the fallback half ` +
        `of \`updatedAt ?? createdAt\`; without it every never-edited bundle sinks.`,
    ).toBe(true);

    /* Read off the TREE and not the text. These files carry more prose than code and both
       words appear in comments in the repository; a raw-text match would pass a file that
       had deleted the ordering and kept the paragraph explaining it. */
    expect(
      source.raw.includes("updatedAt"),
      "premise: the raw text and the tree must agree that the token is present at all",
    ).toBe(true);
  });

  it("still sorts, and still tie-breaks by title", () => {
    const [source] = sources([BROWSERS.blueprints], 1);
    const sf = parse(source.path, source.raw);
    const called = calledNames(sf);
    const names = propertyNames(sf);

    expect(
      called,
      `${BROWSERS.blueprints} calls no \`sort\`. The shelf's order is this component's ` +
        `responsibility under D-260-11 — the API publishes only \`sort=slug\` and its ` +
        `default is the same slug order, so an unordered client renders the registry's ` +
        `storage order and calls it recency.`,
    ).toContain("sort");

    expect(
      names.has("title"),
      `${BROWSERS.blueprints} no longer reads \`title\`. It is the tie-break under the ` +
        `timestamp, and without it two bundles sharing a date order arbitrarily — which is ` +
        `a shelf that reorders between two renders of the same data.`,
    ).toBe(true);
  });

  /*
   * The negative that the two positives above cannot supply.
   *
   * They are satisfied by a component that sorts a list it was handed already sorted by the
   * API. This says the route did not ask the API to order it — D-260-06's rule for this
   * cutover in general: it consumes the API's DATA, not its FILTERING, and ordering is the
   * same kind of thing.
   */
  it("the route does not delegate the ordering to the API", () => {
    const [source] = sources([ROUTES.blueprints], 1);
    const sf = parse(source.path, source.raw);

    /*
     * THIS CELL WAS WRONG AND IT REDDENED A CORRECT CUTOVER. Corrected at the adversary
     * round, 2026-08-24, against `feat/t260-browse` at `9b4ebf5`.
     *
     * It asserted that the route names NEITHER `updatedAt` NOR `createdAt` — reasoning that
     * a route touching the timestamps must be ordering with them. That conflates reading a
     * field with ordering by it, and the conflation makes the criterion unsatisfiable: the
     * order is held CLIENT-SIDE (D-260-11), the comparator lives in `GalleryBrowser`, and a
     * route cannot hand a client comparator two fields without naming them.
     *
     * The implementation names them at `app/blueprints/page.tsx:294-295` to project them
     * into the view model with the shipped `?? ""` coalescing, and its comment records the
     * measurement this suite declared it could not make: `"2026-07-01".localeCompare("")` is
     * `1`, so a bundle carrying neither date sorts LAST and then by title — D-260-11's
     * second half, the gap I declared under D-260-18 and was ruled not to build. It was
     * built and measured against the shipped comparator rather than reasoned about.
     *
     * What the criterion actually forbids is an ORDERING on the route, so that is what is
     * asserted: no comparator, no sort, on the server. Reading the tree and not the text,
     * because the correct implementation DISCUSSES `localeCompare` in a comment three lines
     * above the projection — a raw-text matcher reds on the explanation of why the route
     * does not sort.
     */
    const called = calledNames(sf);
    const ordering = called.filter((name) =>
      ["sort", "toSorted", "localeCompare"].includes(name),
    );

    expect(
      ordering,
      `${ROUTES.blueprints} orders the shelf itself: ${ordering.join(", ")}.\n\n` +
        `D-260-11 holds the order CLIENT-SIDE, in ${BROWSERS.blueprints}, because that is ` +
        `where it is today and because the shelf has to re-order after every filter change ` +
        `without a round trip. A server-side sort is not wrong on the first paint and is ` +
        `wrong on every one after it.\n\n` +
        `Projecting \`createdAt\`/\`updatedAt\` into the props is NOT ordering and does not ` +
        `red here — the client comparator needs both fields, so the route has to pass them.`,
    ).toEqual([]);

    /*
     * The premise, and it fails outside the negative: if the route stopped projecting the
     * timestamps, this cell would pass while the client comparator lost its input and the
     * shelf silently reordered.
     *
     * `assignedKeys` and NOT `propertyNames`. The first version of this premise used the
     * latter and DID NOT FIRE when the projection was deleted — `manifest.createdAt` still
     * appears one line below, inside the `updatedAt` fallback, so the token was present
     * while the prop was gone. Found by falsifying the repair rather than by re-reading it:
     * a corrected cell that has not been mutated is a cell whose correction is unmeasured.
     */
    const produced = assignedKeys(sf);
    expect(
      produced.has("updatedAt") && produced.has("createdAt"),
      `${ROUTES.blueprints} no longer projects both timestamps into the shelf's props. ` +
        `\`GalleryBrowser\` orders on \`updatedAt ?? createdAt\`, so dropping either leaves ` +
        `the comparator reading \`undefined\` — and \`undefined.localeCompare\` throws, which ` +
        `is why the shipped coalescing is \`?? ""\` (\`lib/content/view.ts:104-105\`).`,
    ).toBe(true);
  });
});
