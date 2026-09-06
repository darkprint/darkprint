/* ============================================================
   T260 AC1 and AC5 — the shelves come off the build

   THESE CELLS RED UNTIL THE CUTOVER LANDS. That is the blind
   position for this file and not a defect: they describe the
   deliverable, and the deliverable does not exist yet.

   ── AC1, under D-260-05 ──
   AC1's own gloss is "publish, then fetch, with no build step
   between", which needs a running server and a build this author is
   barred from. D-260-05 settled what is checkable instead, and it
   settled it by DELETING a mechanism rather than by choosing one:
   tag-based revalidation does not exist in this tree — zero
   `revalidateTag`, `cacheTag` or `unstable_cache`, `cacheComponents`
   unset — and the invalidation call would belong in two Forbidden
   trees. So B-15's caching is deferred and the three routes render
   PER REQUEST.

   That collapses three mutually-redding readings into one, which is
   the only reason a cell here can exist at all: asserting
   `revalidate = N` would have reddened a correct dynamic route and
   vice versa.

   AC1 is therefore three separate properties, because they fail
   separately and have different repairs:

     1. the route no longer reads the build-time archive
     2. it reads through a published server surface instead
     3. it renders per request

   A route that did 1 and 2 and stayed static would serve a snapshot
   frozen at deploy, which is AC1's exact negative. A route that did
   3 alone would render per request from `content/`, which is AC1's
   negative wearing the right clothes.

   ── AC5 ──
   "Render without JavaScript for their first paint" is a
   server-component constraint, and the mechanism it rules out is
   the obvious cutover: move the read into the browser. So the route
   must not become a client component, the shelf must arrive as
   PROPS, and the client component must not fetch its own rows — a
   browser that fetches paints an empty shelf first, whatever the
   route does.

   None of the six files below has been read by this author. All six
   are parsed.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import {
  BROWSERS,
  KEYS,
  ROUTES,
  SHELVES,
  calledNames,
  callArguments,
  importedFrom,
  importsOf,
  isClientComponent,
  jsxElementNames,
  jsxPropsOf,
  parse,
  propertyValues,
  stringArrays,
  stringLiterals,
  type Shelf,
} from "./partition";

/** The build-time archive. `lib/content/read.ts:213` is the only filesystem touch in the repo. */
const ARCHIVE = "@/lib/content";

/** The two published surfaces the section names as the cutover's destination. */
const PUBLISHED = ["@/lib/server/registry", "@/lib/server/search"] as const;

function route(shelf: Shelf) {
  const [source] = sources([ROUTES[shelf]], 1);
  return { source, sf: parse(source.path, source.raw) };
}

function browser(shelf: Shelf) {
  const [source] = sources([BROWSERS[shelf]], 1);
  return { source, sf: parse(source.path, source.raw) };
}

/* ============================================================
   AC1
   ============================================================ */

describe("AC1 / D-260-05: the shelf is not frozen at the last deploy", () => {
  it.each(SHELVES)("%s reads no build-time archive", (shelf) => {
    const { sf } = route(shelf);
    const specifiers = importsOf(sf);

    /* The premise. A route file that imports NOTHING satisfies "does not import the
       archive" perfectly, and so does one truncated to a stub — both of which are ways for
       this cell to pass while the page it names has stopped existing. */
    expect(
      specifiers.length,
      `${ROUTES[shelf]} imports nothing at all. A file with no imports passes every ` +
        `absence assertion in this suite at once, so the emptiness is reported here rather ` +
        `than read as a clean cutover.`,
    ).toBeGreaterThan(0);

    const archive = specifiers.filter(
      (specifier) => specifier === ARCHIVE || specifier.startsWith(`${ARCHIVE}/`),
    );

    /* ONE EXEMPTION, and it is narrower than the rule rather than a hole in it.
       ------------------------------------------------------------
       The ontology shelf has been repointed twice on 2026-09-06 (`partition.ts` carries both
       instructions) and it now lives on `app/spec/card/page.tsx`, which is two documents:
       it LISTS the vocabulary off the registry, and it SPECIFIES the card format. The
       specification half reads one checked-in node card through `getNodeCard("code-builder")`
       and draws the reach panel from it, beside the same card `SectionNodeCard` annotates
       byte for byte.

       AC1's reason does not reach that read. The rule exists because `lib/content/read.ts`
       walks `content/` at build time and memoizes, so a REGISTRY figure served through it is
       frozen at the deploy and a blueprint published afterwards never appears. A file that
       is checked into the tree and ships inside the same build has nothing to go stale
       against; a build serving a stale copy of a file that was in that build is not a state
       that exists.

       THE EXEMPTION WAS REWRITTEN RATHER THAN CARRIED ACROSS, which is the whole point of
       pinning it to a binding. It read `bundleVocabulary` for the previous address, where the
       page quoted `content/ontology/extensions.yaml` under the overlay rules. That evidence
       panel went with the overlay band earlier the same day, so by the time of this repoint
       the old exemption named a binding no route imported and the branch had stopped firing
       entirely. The new name was not assumed: this cell RED against `[ 'getNodeCard' ]` and
       said so, which is the exemption reporting a changed read rather than absorbing one.

       So it stays pinned to the one binding rather than to the module: any other name
       imported from the archive on this route still reds, and the other two shelves are
       untouched. Deleting the panel to satisfy a module-level string check would take the
       page's only piece of evidence with it, which is a worse page and not a cleaner one. */
    const EXEMPT: Partial<Record<Shelf, readonly string[]>> = { ontology: ["getNodeCard"] };
    const allowed = EXEMPT[shelf];
    if (allowed !== undefined && archive.length > 0) {
      expect(
        [...importedFrom(sf, ARCHIVE)].sort(),
        `${ROUTES[shelf]} is the one route allowed to touch ${ARCHIVE}, and only for the ` +
          `checked-in file it quotes as evidence. It imports something else from it now, ` +
          `which is outside the exemption and inside AC1's actual hazard.`,
      ).toEqual([...allowed].sort());
      return;
    }

    expect(
      archive,
      `${ROUTES[shelf]} still imports ${archive.join(", ")}.\n\n` +
        `\`lib/content/read.ts\` walks \`content/\` at BUILD TIME and memoizes at module ` +
        `scope (SEAM-107), so a route reading it serves whatever was on disk when the ` +
        `deploy was cut. AC1 is the negative about exactly that: a blueprint published ` +
        `after the last deploy appears on this shelf WITHOUT a rebuild.`,
    ).toEqual([]);
  });

  it.each(SHELVES)("%s reads through a published server surface", (shelf) => {
    const { sf } = route(shelf);
    const specifiers = importsOf(sf);

    const published = specifiers.filter((specifier) =>
      PUBLISHED.some((surface) => specifier === surface || specifier.startsWith(`${surface}/`)),
    );
    expect(
      published.length,
      `${ROUTES[shelf]} imports neither ${PUBLISHED.join(" nor ")}.\n\n` +
        `Removing the archive read is half of AC1 and it is the half that can be done by ` +
        `deleting things: a route that reads nothing renders nothing and passes the cell ` +
        `above. This is the other half. The section's own Published-signatures block names ` +
        `these two as the destination (D-260-13 confirmed the module reading over the HTTP ` +
        `one), and a deep path into either is a T000/D-01 violation rather than a pass.`,
    ).toBeGreaterThan(0);

    const deep = published.filter(
      (specifier) => !PUBLISHED.includes(specifier as (typeof PUBLISHED)[number]),
    );
    expect(
      deep,
      `${ROUTES[shelf]} deep-imports ${deep.join(", ")}. Deep paths are internal and may be ` +
        `rearranged; nothing outside the module should reach for one (T000 contract, D-01, ` +
        `restated at the top of both barrels).`,
    ).toEqual([]);
  });

  /*
   * THREE SPELLINGS ARE ACCEPTED, and that is deliberate rather than lax.
   *
   * Next 16.2 has no route-segment-config reference page left in
   * `node_modules/next/dist/docs/01-app/03-api-reference/05-config/`; `dynamic =
   * 'force-dynamic'` survives in `02-guides/caching-without-cache-components.md:82-104`,
   * which is the guide that applies to this repo because `cacheComponents` is unset in
   * `next.config.ts`. `connection()` is the documented way for a route with no request-time
   * API to opt out of prerendering
   * (`03-api-reference/04-functions/connection.md`), and these three shelves have no
   * cookie, header or session read to make them dynamic implicitly.
   *
   * Pinning ONE of them would red a correct implementation that chose another, which is the
   * failure this suite has already been ruled against once: three readings of AC1's
   * mechanism that redden each other is what D-260-05 was asked to collapse.
   */
  it.each(SHELVES)("%s renders per request", (shelf) => {
    const { source, sf } = route(shelf);
    const literals = stringLiterals(sf);
    const called = calledNames(sf);

    const spellings = [
      literals.includes("force-dynamic") && /\bdynamic\b/.test(source.raw)
        ? 'export const dynamic = "force-dynamic"'
        : undefined,
      /export\s+const\s+revalidate\s*=\s*0\b/.test(source.raw)
        ? "export const revalidate = 0"
        : undefined,
      called.includes("connection") ? "await connection()" : undefined,
    ].filter((spelling) => spelling !== undefined);

    expect(
      spellings,
      `${ROUTES[shelf]} declares no per-request rendering.\n\n` +
        `D-260-05 ruled these three shelves render PER REQUEST and deferred B-15's caching, ` +
        `because tag-based revalidation does not exist in this tree and the invalidation ` +
        `call belongs in two Forbidden trees. Any ONE of these satisfies the criterion:\n` +
        `  export const dynamic = "force-dynamic"   (guides/caching-without-cache-components.md:82)\n` +
        `  export const revalidate = 0\n` +
        `  await connection()                       (api-reference/functions/connection.md)\n\n` +
        `Without one of them the route prerenders at build time, so it reads the registry ` +
        `ONCE, at deploy, and AC1 fails while both cells above pass.`,
    ).not.toEqual([]);
  });
});

/* ============================================================
   AC5
   ============================================================ */

describe("AC5: the shelf is in the first paint, without JavaScript", () => {
  it.each(SHELVES)("%s stays a server component", (shelf) => {
    const { sf } = route(shelf);
    expect(
      isClientComponent(sf),
      `${ROUTES[shelf]} opens with "use client". The whole route then renders in the ` +
        `browser and its first paint carries no shelf — which is also why B-15 chose ` +
        `revalidation over client fetching in the first place (the section says so). ` +
        `\`components/ui/useQueryState.ts\` exists precisely so the filters can be client ` +
        `state without the page becoming a client component.`,
    ).toBe(false);
  });

  it.each(SHELVES)("%s hands its rows to the browser as props", (shelf) => {
    const { sf } = route(shelf);
    const component = BROWSERS[shelf].split("/").pop()!.replace(/\.tsx$/, "");

    const mounted = jsxElementNames(sf);
    expect(
      mounted,
      `${ROUTES[shelf]} no longer mounts <${component}>. It mounts: ${mounted.join(", ") || "(nothing)"}.\n\n` +
        `If the component was renamed, note that D-260-02 makes ` +
        `\`components/gallery/GalleryBrowser.tsx\`'s path load-bearing: ` +
        `\`components/ui/autonomy-surfaces.test.ts:259\` finds it by EXACT PATH with ` +
        `\`expect(gallery).toBeDefined()\`, so a rename reds a named must-pass-unchanged test.`,
    ).toContain(component);

    const props = jsxPropsOf(sf, component);
    expect(
      props,
      `<${component}> is mounted with no props at all in ${ROUTES[shelf]}.\n\n` +
        `A shelf that arrives as props is server-rendered into the HTML; a shelf the ` +
        `component fetches for itself is not, and AC5 is the difference. This cell is the ` +
        `positive that the two negatives above cannot supply: deleting the read satisfies ` +
        `"no archive import" and renders nothing.`,
    ).not.toEqual([]);
  });

  /*
   * Asserted on the BROWSER and not on the route, because this is the one place the two
   * come apart: a route can do everything right and still paint an empty shelf if the
   * client component throws away its props and fetches on mount. That is the obvious way to
   * cut over — it is how a client-rendered app would do it — so it is the one worth a cell.
   */
  it.each(SHELVES)("the %s browser does not fetch its own rows", (shelf) => {
    const { sf } = browser(shelf);
    const called = calledNames(sf);

    /* Premise: the browser must be a client component. If it stopped being one this cell
       is asserting the absence of `fetch` in a file that could never have had it, and the
       filters have quietly stopped working — a different defect with a different repair. */
    expect(
      isClientComponent(sf),
      `${BROWSERS[shelf]} is no longer a client component, so the filters it owns cannot ` +
        `run in the browser. \`useQueryState\` is a client hook.`,
    ).toBe(true);

    const fetches = called.filter((name) => name === "fetch");
    expect(
      fetches,
      `${BROWSERS[shelf]} calls fetch(). Its rows then arrive after hydration and the ` +
        `first paint is an empty shelf, which AC5 forbids in as many words. The rows are ` +
        `already in the RSC payload as props; fetching them again is both slower and less ` +
        `honest about what a reader without JavaScript sees.`,
    ).toEqual([]);
  });
});

/* ============================================================
   D-260-03 / D-260-06 — ONE DEFAULT FOR ONE SHELF
   ============================================================ */

describe("D-260-06: `/blueprints` declines a fork default rather than acquiring one", () => {
  /*
   * The ruling, in the implementer's own wording which the orchestrator adopted: the page
   * calls with `forks: "all"`, and `GalleryBrowser` keeps `params.get("forks") ?? "rolled"`.
   * *That is not the page acquiring a default, it is the page declining to apply one.*
   *
   * The reason it must send `all` rather than nothing is not style. The API's default is
   * `rolled` (D-200-37), so a call with no `forks` drops every fork SERVER-SIDE and the
   * rows are then not in the payload — after which `?forks=all` on a shared link can never
   * be honoured, and AC2 fails for exactly the key D-260-03 exists to protect.
   */
  it("asks the API for the whole shelf", () => {
    const { sf } = route("blueprints");
    const values = [...propertyValues(sf, "forks"), ...callArguments(sf, "forks")];

    expect(
      values,
      `${ROUTES.blueprints} does not send \`forks\`.\n\n` +
        `The API resolves absent, empty and unrecognised all to \`rolled\` (D-200-37), so ` +
        `a call without it comes back with every published fork ALREADY REMOVED. The ` +
        `client-side stance then has nothing to widen: \`?forks=all\` on a shared link ` +
        `renders the rolled shelf, silently, and only for readers who had bookmarked one.`,
    ).toContain("all");
  });

  it("holds no fork default of its own", () => {
    const { sf } = route("blueprints");
    const literals = stringLiterals(sf);

    /* The assertion EXCLUDES the bad output rather than admitting the good one. `"rolled"`
       in the route file is the second default D-260-03 forbids: two defaults for one shelf
       is how they come to disagree, and the disagreement is invisible until a fork is
       published. Comments are not string literals, so a route that DISCUSSES `rolled` in
       prose — which it should, citing the ruling — does not red here. */
    expect(
      literals.filter((literal) => literal === "rolled"),
      `${ROUTES.blueprints} carries the literal "rolled". D-260-03: the shelf's default ` +
        `lives in ONE place. It is the API's (D-200-37) for the fetch and ` +
        `\`GalleryBrowser\`'s \`params.get("forks") ?? "rolled"\` for the stance; a third ` +
        `copy on the route is the one that goes stale. Prose about the ruling is fine — ` +
        `this reads string literals, not comments.`,
    ).toEqual([]);
  });

  it("leaves the stance where it already lives", () => {
    const { source } = browser("blueprints");
    /*
     * The other half, and without it the cell above is satisfiable by deleting the stance
     * entirely — which would make `/blueprints` show forks by default, the shelf change
     * D-200-37 was ruled to prevent. One cell asserting the route has no default and
     * another asserting the browser still has one is the pair; either alone is passable by
     * the defect the other names.
     */
    expect(
      source.raw.includes("rolled"),
      `${BROWSERS.blueprints} no longer mentions \`rolled\`. The shelf's fork stance has to ` +
        `live somewhere, and D-260-06 puts it here: the page declines to apply a default so ` +
        `that this component can. If it is gone from both, \`/blueprints\` now shows every ` +
        `fork by default — the silent shelf change D-200-37 named T260 by name to prevent.`,
    ).toBe(true);
  });
});

/* ============================================================
   AC2 — THE KEYS AND THE CLEAR CONTROL
   ============================================================ */

describe("AC2: the query keys and the `Clear filters` sets are unchanged", () => {
  /*
   * B-12 and the Contract: unchanged, so existing shared links keep working. The three
   * cleared sets were taken from `seams.md` and then checked against the three
   * declarations by the orchestrator, element-wise (D-260-12) — see `partition.ts`. The
   * check was not ceremony: `seams.md` is stale on the same rows about `sort`.
   *
   * Matched as a SET against every string array in the file rather than by the identifier
   * the component gives it. The criterion is that the set is unchanged; pinning the name
   * would red a correct cutover over a rename, which is how T263's blind author lost 29 of
   * 31 cells.
   */
  it.each(SHELVES)("the %s browser clears exactly its own keys", (shelf) => {
    const { sf } = browser(shelf);
    const { cleared, kept } = KEYS[shelf];
    const arrays = stringArrays(sf);

    const match = arrays.find(
      (array) =>
        array.length === cleared.length && cleared.every((key, index) => array[index] === key),
    );

    expect(
      match,
      `${BROWSERS[shelf]} no longer declares the cleared set [${cleared.join(", ")}].\n\n` +
        `Arrays of strings found in the file: ${
          arrays.map((array) => `[${array.join(",")}]`).join(" ") || "(none)"
        }\n\n` +
        `\`Clear filters\` clearing a different set is a shared link that stops round-tripping ` +
        `(B-12). ${
          kept.length > 0
            ? `Note that [${kept.join(", ")}] are deliberately NOT cleared: they are stances, ` +
              `not filters — the shelf is always in one, so clearing would MOVE the shelf ` +
              `rather than empty a control.`
            : `Every key on this shelf is a filter, so the cleared set is the whole set.`
        }`,
    ).toBeDefined();
  });
});
