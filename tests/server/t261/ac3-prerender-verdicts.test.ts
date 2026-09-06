/* ============================================================
   T261 AC3 / D-261-03 — the build's own verdict on every route,
   with IN-TABLE controls.

   D-260-09's idiom: the claim "these routes went per-request" is
   only worth making against the build's own route table, and a
   table reading is only worth believing if the SAME table carries
   rows whose verdicts must NOT move. Otherwise a parse that
   stopped matching reads exactly like a cutover that completed.

   ── read off Next's manifest, not off build stdout ──
   `.next/prerender-manifest.json` is the machine-readable form of
   the `○ ● ƒ` table. `dynamicRoutes` holds the ● rows (dynamic
   segments prerendered through `generateStaticParams`); `routes`
   holds the concrete prerendered pages, ○ and the ● instances
   both. A route in NEITHER is ƒ — server-rendered on demand,
   which is what D-261-03 requires of the four.

   Parsing stdout would bind this to a log format and to a string
   nobody promised; the manifest is what the server itself reads.

   ── the baseline this was written against ──
   Built in the granted window at `dcdadc2`, BEFORE the cutover is
   in this tree. Measured:

     dynamicRoutes = ["/blueprints/[slug]", "/nodes/[...id]",
                      "/ontology/[...term]", "/u/[username]/[slug]"]

   Exactly the four routes T261 moves, all four still ●. The four
   cells below therefore RED against this tree, deliberately: they
   are the criterion, and the criterion has not been met yet.

   ── why a build is required rather than skipped ──
   A suite that quietly passes when `.next` is missing is green in
   two worlds and tells you which one it was in neither. So the
   manifest's presence is its own unskippable cell, and it FAILS
   rather than skips — a build-window criterion asserted without a
   build is not a criterion.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MANIFEST = ".next/prerender-manifest.json";

interface Prerender {
  routes: Record<string, unknown>;
  dynamicRoutes: Record<string, unknown>;
}

function manifest(): Prerender {
  const raw = JSON.parse(readFileSync(MANIFEST, "utf8")) as Partial<Prerender>;
  return { routes: raw.routes ?? {}, dynamicRoutes: raw.dynamicRoutes ?? {} };
}

/** The four this task moves. Named: a route path is a URL. */
const MUST_GO_DYNAMIC = [
  "/blueprints/[slug]",
  "/nodes/[...id]",
  "/ontology/[...term]",
  "/u/[username]/[slug]",
] as const;

/** The canonical route the migration creates. It must never be prerendered either. */
const CANONICAL = "/blueprints/[owner]/[slug]";

/**
 * In-table controls, both directions, read from the SAME manifest.
 *
 * STATIC: pages with no data source that must stay prerendered. If these stopped being
 * prerendered, the manifest is being read wrong (or the whole app went dynamic), and the
 * four cells below would pass for a reason that has nothing to do with this cutover.
 *
 * DYNAMIC: routes T260 and T262 already cut over. They are the proof that "absent from
 * both maps" really is how a per-request route appears here — measured on routes whose
 * cutover is merged, rather than assumed from documentation.
 */
/* `/upload` moved lists at T280 (owner-instructed, 2026-08-25): it gained a data source —
   the page resolves `?owner=&slug=` against the session and `draftBundle` per request so a
   release can land in a pre-created draft — which is exactly the condition D-261-03 keys
   on. The control's JOB is unchanged: a route with no data source going per-request is
   still the drift this table reds on. */
const STAY_STATIC = ["/", "/mcp", "/skill", "/what-a-blueprint-is"] as const;
/* `/ontology` was here until 2026-09-06. The owner folded the vocabulary browser into
   `/spec/ontology` and deleted the index, and a DELETED route is absent from both maps —
   which is exactly how this cell reads "per-request", so the row would have gone on passing
   while measuring nothing. `/spec/ontology` is the row that carries the claim now: it took
   the browser, it reads the registry, and it declares `force-dynamic` for that reason. The
   shelf did not stop being per-request; its address changed. */
const STAY_DYNAMIC = [
  "/blueprints",
  "/nodes",
  "/spec/ontology",
  "/settings",
  "/u/[username]",
  "/upload",
] as const;

describe("the build's route table", () => {
  /*
   * Unskippable, and it fails rather than skips.
   *
   * A criterion about the build asserted without a build is not a criterion, and a suite
   * that goes quietly green when `.next` is absent is green in both worlds while telling
   * you which one it ran in neither.
   */
  it("exists, because these criteria are about a build", () => {
    expect(
      existsSync(MANIFEST),
      `${MANIFEST} is missing. Every verdict below is about the build's own table, so run ` +
        `\`npm run build\` in a granted window first. This cell fails rather than skipping: a ` +
        `prerender criterion that passes without a build is green in two worlds and reports ` +
        `neither.`,
    ).toBe(true);
  });

  it("carries rows in both maps, so neither absence nor presence is vacuous", () => {
    const { routes, dynamicRoutes } = manifest();
    expect(
      Object.keys(routes).length,
      "the manifest prerendered nothing at all. Every `must go dynamic` cell below would " +
        "pass, and would be measuring an empty file.",
    ).toBeGreaterThan(0);
    // Not a floor on `dynamicRoutes`: after a complete cutover it may legitimately be empty.
    expect(dynamicRoutes).toBeTypeOf("object");
  });
});

describe("in-table controls", () => {
  it.each(STAY_STATIC)("%s is still prerendered", (route) => {
    expect(
      Object.keys(manifest().routes),
      `${route} is no longer prerendered. It has no data source and D-261-03 does not reach ` +
        `it, so either the manifest is being read wrong or something turned the whole app ` +
        `per-request — and the verdicts below would then pass for a reason unrelated to this ` +
        `cutover.`,
    ).toContain(route);
  });

  it.each(STAY_DYNAMIC)("%s is still per-request", (route) => {
    const { routes, dynamicRoutes } = manifest();
    expect(
      [...Object.keys(routes), ...Object.keys(dynamicRoutes)],
      `${route} is prerendered again. T260 and T262 cut it over already, so this is a ` +
        `regression in a merged task — and it also means "absent from both maps" has stopped ` +
        `being how a per-request route appears here, which is the reading every cell below ` +
        `depends on.`,
    ).not.toContain(route);
  });
});

describe("AC3 / D-261-03: the four detail routes render per request", () => {
  it.each(MUST_GO_DYNAMIC)("%s is not prerendered", (route) => {
    const { routes, dynamicRoutes } = manifest();

    expect(
      Object.keys(dynamicRoutes),
      `${route} is still ● — prerendered through \`generateStaticParams\`.\n\n` +
        `AC3 is a negative about the build: a blueprint published after the last deploy must ` +
        `be reachable at its URL, and a build-time parameter list cannot serve a registry ` +
        `that grows between deploys. D-261-03 rules the replacement is ` +
        `\`export const dynamic = "force-dynamic"\`, verdict ƒ.\n\n` +
        `Baseline at \`dcdadc2\`, before the cutover: all four of ${MUST_GO_DYNAMIC.join(", ")} ` +
        `were here. This cell is the criterion, so it reds until the cutover lands.`,
    ).not.toContain(route);

    expect(
      Object.keys(routes),
      `${route} has concrete prerendered instances in the manifest. Even without ` +
        `\`generateStaticParams\` in the source, HTML was frozen at build time for specific ` +
        `parameters — which is the same defect wearing different clothes.`,
    ).not.toContain(route);
  });

  it("emits no frozen HTML for any single-segment blueprint URL", () => {
    /* The instance-level check the route-level one cannot make.
       Measured at the baseline: the build froze `/blueprints/adversarial-consensus-line`,
       `/blueprints/checkpoint-resume-runner` and seven more — nine concrete pages for the
       archive's nine bundles. After the cutover `/blueprints/{slug}` is a REDIRECTOR
       (D-261-02) and a redirector has nothing to freeze; a frozen 308 for exactly the nine
       slugs that existed at deploy is how AC1 would pass for the archive and 404 for
       everything published since. */
    const frozen = Object.keys(manifest().routes).filter(
      (route) => /^\/blueprints\/[^/]+$/.test(route),
    );
    expect(
      frozen,
      `the build froze ${frozen.length} single-segment blueprint pages: ${frozen.slice(0, 3).join(", ")}` +
        `${frozen.length > 3 ? ", …" : ""}.\n\n` +
        `Under D-261-02 that path is a redirector resolving a slug against the registry. ` +
        `Freezing it pins the answer to the set of slugs that existed at deploy time.`,
    ).toEqual([]);
  });

  it("and the canonical route is not prerendered either", () => {
    const { routes, dynamicRoutes } = manifest();
    const all = [...Object.keys(routes), ...Object.keys(dynamicRoutes)];
    expect(
      all,
      `${CANONICAL} is prerendered. The migration moved the URL and brought the build-time ` +
        `parameter list with it, which is AC3 failing at the new address instead of the old.`,
    ).not.toContain(CANONICAL);
  });
});
