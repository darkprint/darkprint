/* ============================================================
   T261 AC2 — every one of the thirteen existing redirects still
   resolves, held element-wise BY NAME.

   ── why this file exists at all ──
   The section says the thirteen are "checked by `nav.test.ts`".
   Measured on this branch, that is a FALSE COVERAGE CLAIM and
   D-261-05 records it as one:

     next.config.ts:67-125                      13 rules
     components/site/nav.test.ts:601-616        RENAMED has 7
     components/ontology/canonical-route.test.ts:43  adds /ontologies

   So EIGHT of thirteen are covered and five are covered by nothing:
   `/gallery`, `/parts`, `/parts/:slug`, `/ontologies/:slug`,
   `/install`. A parenthetical naming an instrument that does not
   cover what it claims is worse than no instrument, because it
   stops the next person looking — D-263-06's own argument. This
   file is the thirteen, named individually, so a dropped rule reds
   with the rule's own name in the message.

   ── why BY NAME and never by count ──
   `expect(rules).toHaveLength(13)` is satisfied by deleting
   `/install` and adding anything at all, which is exactly what a
   URL migration does: it ADDS the fourteenth. A count cannot tell
   "the fourteenth arrived" from "the fourteenth arrived and
   `/install` left with it". Every assertion below names a source.

   ── the fourteenth is NOT here, and that is D-261-02 ──
   B-09's `/blueprints/{slug}` migration does NOT add a config
   rule. D-261-02 refused the config arm twice over — a static rule
   cannot name an owner that is not in the URL, and
   `/blueprints/:slug` would also match `/blueprints/{owner}` and
   shadow the filesystem. The redirect is a PAGE-LEVEL redirector
   and its cells are `ac1-redirector.test.ts`'s. The last case here
   is the negative that keeps the two arms from being confused: a
   config rule for it must NOT appear.
   ============================================================ */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

/**
 * The thirteen, source -> destination, in `next.config.ts`'s own order.
 *
 * Written out rather than read off the config: a table derived from the subject agrees
 * with the subject by construction and could not fail. This is the independent statement
 * of what the redirect table is FOR, which is the only thing that can disagree with it.
 */
const THIRTEEN: readonly (readonly [source: string, destination: string])[] = [
  ["/gallery", "/blueprints"],
  ["/parts", "/nodes"],
  ["/parts/:slug", "/nodes"],
  ["/ontologies", "/ontology"],
  ["/ontologies/:slug", "/ontology"],
  ["/how-to-build-a-dark-factory", "/towards-a-dark-factory"],
  ["/towards-a-dark-factory/the-climb", "/towards-a-dark-factory"],
  ["/which-tasks", "/towards-a-dark-factory"],
  ["/towards-a-dark-factory/which-tasks", "/towards-a-dark-factory"],
  ["/spec", "/what-a-blueprint-is"],
  ["/spec/scoring", "/reading-the-radar"],
  ["/concepts", "/what-a-blueprint-is"],
  ["/install", "/skill"],
];

/** The five nothing else in the repository checks. Named so the gap cannot silently reopen. */
const UNCOVERED_ELSEWHERE = new Set([
  "/gallery",
  "/parts",
  "/parts/:slug",
  "/ontologies/:slug",
  "/install",
]);

async function rules() {
  return (await nextConfig.redirects?.()) ?? [];
}

/**
 * Whether `app/<route>/page.tsx` exists. `/` is `app/page.tsx`.
 *
 * `nav.test.ts:97-100`'s own function, restated rather than imported: importing it would
 * bind this suite to a file the cutover is allowed to touch, and a destination check that
 * moves when the checked file moves is not a check.
 */
function routeExists(path: string): boolean {
  const dir = path === "/" ? "app" : join("app", path.slice(1));
  return existsSync(join(process.cwd(), dir, "page.tsx"));
}

describe("AC2: the thirteen existing redirects still resolve", () => {
  /*
   * The premise. It fails outside every cell below, because all of them are lookups and a
   * lookup against an EMPTY table reports "no redirect for X" thirteen times — thirteen
   * reds that all say the wrong thing. If `redirects()` is gone or answers nothing, that
   * is one fact and it gets one message.
   */
  it("the config still exports a redirect table", async () => {
    expect(
      typeof nextConfig.redirects,
      "`next.config.ts` no longer exports `redirects()`; every case below would red saying " +
        "a rule is missing, which would be true and would not be the reason",
    ).toBe("function");
    expect((await rules()).length, "the redirect table is empty").toBeGreaterThan(0);
  });

  it.each(THIRTEEN)("%s -> %s, permanently, onto a page that exists", async (source, destination) => {
    const table = await rules();
    const rule = table.find((entry) => entry.source === source);

    expect(
      rule,
      `no redirect for ${source}.\n\n` +
        (UNCOVERED_ELSEWHERE.has(source)
          ? `This rule is covered by NOTHING ELSE in the repository — not nav.test.ts's ` +
            `RENAMED, not canonical-route.test.ts. If this cell goes, the rule is unguarded.\n\n`
          : ``) +
        `next.config.ts:63-65 records why these are permanent and why a directory ` +
        `reappearing at an old path would be shadowed rather than loudly wrong.`,
    ).toBeDefined();

    expect(rule?.destination, `${source} now lands somewhere else`).toBe(destination);

    // 308 rather than 307. The rename is a decision and not an experiment.
    expect(rule?.permanent, `${source} is no longer a permanent redirect`).toBe(true);

    expect(
      routeExists(destination),
      `${source} redirects onto ${destination}, which has no page.tsx — a 404 with an extra hop`,
    ).toBe(true);
  });

  /*
   * And that none of the thirteen has quietly become unreachable from the other end.
   *
   * A source that ALSO has a `page.tsx` is shadowed: redirects run before the filesystem,
   * so the page would be silently unreachable rather than loudly wrong. nav.test.ts holds
   * this for its seven; the other six had nobody.
   */
  it.each(THIRTEEN.map(([source]) => source))("%s has no page shadowing its redirect", (source) => {
    // `:slug` is a pattern rather than a path and cannot have a page of its own.
    if (source.includes(":")) return;
    expect(routeExists(source), `${source} has a page.tsx again, so its redirect is dead`).toBe(false);
  });
});

describe("AC2's own instrument", () => {
  /*
   * The table above is only a check if it can disagree with the config. Two ways it could
   * silently stop being one: a source spelled so it matches nothing (then every lookup
   * reds, which is loud and fine), or the config growing rules this table never mentions
   * (which is SILENT — and is exactly what a URL migration does).
   */
  it("names every rule the config actually carries, so a fourteenth cannot arrive unnoticed", async () => {
    const table = await rules();
    const named = new Set(THIRTEEN.map(([source]) => source));
    const unnamed = table.map((entry) => entry.source).filter((source) => !named.has(source));

    expect(
      unnamed,
      `next.config.ts carries redirect rules this suite does not name.\n\n` +
        `If this is B-09's fourteenth, it is in the WRONG PLACE: D-261-02 refused the config ` +
        `arm twice over — a static rule cannot name an owner that is not in the URL, and ` +
        `\`/blueprints/:slug\` would also match \`/blueprints/{owner}\` and shadow the ` +
        `filesystem. The redirect is a page-level redirector; see ac1-redirector.test.ts.\n\n` +
        `If it is a legitimate fourteenth from some other change, add it to THIRTEEN with its ` +
        `reason — the table is the independent statement, so it has to be updated deliberately.`,
    ).toEqual([]);
  });

  it("counts thirteen, as a floor under the named table rather than instead of it", () => {
    expect(THIRTEEN).toHaveLength(13);
    expect(new Set(THIRTEEN.map(([s]) => s)).size, "a duplicated source hides a dropped one").toBe(13);
  });
});
