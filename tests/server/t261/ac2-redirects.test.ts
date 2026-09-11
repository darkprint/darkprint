/* ============================================================
   T261 AC2 — every one of the sixteen existing redirects still
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
   file names every rule individually, so a dropped rule reds with
   the rule's own name in the message. It was the thirteen when it
   was written and it is the sixteen now; the three arrivals since are
   recorded below, each with what forced it.

   ── why BY NAME and never by count ──
   `expect(rules).toHaveLength(13)` is satisfied by deleting
   `/install` and adding anything at all, which is exactly what a
   URL migration does: it ADDS one. A count cannot tell "a new rule
   arrived" from "a new rule arrived and `/install` left with it".
   Every assertion below names a source.

   ── a real fourteenth arrived on 2026-09-04, and moved on 2026-09-06 ──
   The author asked `/reading-the-radar` off the site and chose a
   redirect over an unlisting, so the retired page keeps its URL.
   `/spec/scoring` had merged into that page and moved with it,
   REPOINTED rather than chained: a 308 onto a route that itself 308s
   costs every link written before the merge two hops, which is the
   cost already recorded here for `/how-to-build-a-dark-factory`.
   Both rows were added to the table below deliberately, which is what
   the previous count-arrival case asks of whoever adds one.

   Both landed on `/build` until the owner deleted that route
   ("it is not useful and make confusion", 2026-09-06). A 308 onto a
   deleted route is a 308 onto a 404, so the pair moved to
   `/what-a-blueprint-is` — the Learn sequence's entry point, and
   already the destination for `/spec` and `/concepts` two rows down.
   The no-chaining argument above is unchanged and is why they were
   repointed at the source rather than stacked behind the old target:
   `/what-a-blueprint-is` is a real page and 308s nowhere.

   ── and a fifteenth on 2026-09-06, which repointed two of the
      fourteen at the same time ──
   The owner folded the ontology browser into the spec page and
   deleted the index: "move the ontology page in the /spec/ontology
   substituing the "every term" box. Then, you can delete the
   /ontology page". So `/ontology` becomes a source for the second
   time in this repository's life — it was one until the accounts
   pass gave it a page — and `/ontologies` and `/ontologies/:slug`
   move with it.

   Those two are REPOINTED at `/spec/ontology` rather than left
   pointing at `/ontology`, which now 308s. That is the no-chaining
   rule three paragraphs up, applied for the third time, and it is
   the reason this arrives as one added row and two changed
   destinations rather than as one added row alone.

   `/ontology/<term>` is untouched and is NOT shadowed by the new
   rule. A `source` with no parameter compiles to an anchored exact
   pattern; `next.config.ts` records the check against the matcher
   Next 16.2.11 ships. The last cell of the first block is the one
   that would notice a page reappearing at `/ontology` and being
   silently shadowed by its own redirect, which is the failure mode
   that direction has.

   ── and a sixteenth, hours later, which repointed those three ──
   The owner accepted the finding that the vocabulary and the
   Attractor specification read as two rival standards because of the
   order a reader meets them in ("The motivations you provided are
   sound. Apply them"). Every ontology term exists to be a legal value
   of a card field, so each is printed beside the field that consumes
   it and `/spec/ontology` folds into `/spec/card`.

   That makes `/spec/ontology` a source, and it makes the three rows
   above it point at a redirect. All four land on `/spec/card` in one
   hop. Left alone, `/ontology` would have cost two and `/ontologies`
   three, having been repointed once already that morning; the
   no-chaining rule three paragraphs up is why this arrives as one
   added row AND three changed destinations, for the second time in
   one day.

   The chain this would have made is the one thing a per-rule table
   cannot see on its own, because every individual row would still
   resolve to a real page. The cell that catches it is the last in
   the second block: no rule's DESTINATION may be another rule's
   SOURCE. It is added with this row rather than left to the next
   reader, since the shape it forbids has now been reached for three
   times.

   ── B-09 is still NOT one of them, and that is D-261-02 ──
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
 * The sixteen, source -> destination, in `next.config.ts`'s own order.
 *
 * Written out rather than read off the config: a table derived from the subject agrees
 * with the subject by construction and could not fail. This is the independent statement
 * of what the redirect table is FOR, which is the only thing that can disagree with it.
 */
const SIXTEEN: readonly (readonly [source: string, destination: string])[] = [
  ["/gallery", "/blueprints"],
  ["/parts", "/nodes"],
  ["/parts/:slug", "/nodes"],
  ["/ontology", "/spec/card"],
  ["/ontologies", "/spec/card"],
  ["/ontologies/:slug", "/spec/card"],
  ["/spec/ontology", "/spec/card"],
  ["/how-to-build-a-dark-factory", "/towards-a-dark-factory"],
  ["/towards-a-dark-factory/the-climb", "/towards-a-dark-factory"],
  ["/which-tasks", "/towards-a-dark-factory"],
  ["/towards-a-dark-factory/which-tasks", "/towards-a-dark-factory"],
  ["/spec", "/what-a-blueprint-is"],
  ["/spec/scoring", "/what-a-blueprint-is"],
  ["/reading-the-radar", "/what-a-blueprint-is"],
  ["/concepts", "/what-a-blueprint-is"],
  ["/install", "/skill"],
];

/**
 * The ones nothing else in the repository checks. Named so the gap cannot silently reopen.
 *
 * It was five and is four. `/ontologies/:slug` left on 2026-09-06: it had nobody at all
 * until `components/ontology/canonical-route.test.ts` was rewritten by the ontology fold to
 * name all three ontology paths one by one, where it had named only `/ontologies` before.
 * `/ontology` never enters this set — `nav.test.ts`'s `RENAMED` carries it, asserting
 * everything this file asserts and adding that no chrome table names it. `/spec/ontology`,
 * the sixteenth rule, was added to that same table when it became a source, so it does not
 * enter here either.
 *
 * Read off that file rather than assumed: it is another lane's, it was mid-rewrite while
 * this table was being edited, and a coverage claim about a file somebody else is changing
 * is exactly the false claim this suite's own header was written about. If that rewrite is
 * reverted, `/ontologies/:slug` and `/ontologies` both come back here.
 */
const UNCOVERED_ELSEWHERE = new Set(["/gallery", "/parts", "/parts/:slug", "/install"]);

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

describe("AC2: the sixteen existing redirects still resolve", () => {
  /*
   * The premise. It fails outside every cell below, because all of them are lookups and a
   * lookup against an EMPTY table reports "no redirect for X" once per named rule — sixteen
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

  it.each(SIXTEEN)("%s -> %s, permanently, onto a page that exists", async (source, destination) => {
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
   * And no rule lands on another rule's source, which is the failure a per-rule table
   * cannot see: every row of a chain resolves to a real page on its own, and only the pair
   * is wrong. Three redirects have been repointed for exactly this reason since 2026-09-04
   * (`/spec/scoring`, `/reading-the-radar`, and the three ontology paths twice in one day),
   * every one of them by hand, with the argument written out again each time and nothing in
   * the suite that would have noticed if somebody had skipped it.
   *
   * Read off the config on both sides on purpose. This is the one claim in the file that is
   * ABOUT the table rather than about what the table should contain, so deriving it from
   * `SIXTEEN` would make it a statement about a transcription instead of about what ships.
   */
  it("lands no redirect on another redirect's source", async () => {
    const table = await rules();
    const sources = new Set(table.map((entry) => entry.source));
    const chained = table
      .filter((entry) => sources.has(entry.destination))
      .map((entry) => `${entry.source} -> ${entry.destination}, which itself redirects`);
    expect(
      chained,
      "a 308 onto a 308 costs every link written before the older move two hops. The repair " +
        "is to repoint the source at the final destination, which is what next.config.ts " +
        "records having done for /which-tasks, for /spec/scoring and for the ontology paths.",
    ).toEqual([]);
  });

  /*
   * And that none of the sixteen has quietly become unreachable from the other end.
   *
   * A source that ALSO has a `page.tsx` is shadowed: redirects run before the filesystem,
   * so the page would be silently unreachable rather than loudly wrong. nav.test.ts holds
   * this for its eight; the other seven had nobody.
   *
   * `/ontology` is the live case rather than the hypothetical one. It HAD a page until
   * 2026-09-06 and the redirect was added in the same wave the page was deleted in, so
   * until both halves land this cell reds saying the page is back — which is the true
   * statement, and the repair is the deletion the owner asked for and not an exemption
   * here.
   */
  it.each(SIXTEEN.map(([source]) => source))("%s has no page shadowing its redirect", (source) => {
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
  it("names every rule the config actually carries, so a seventeenth cannot arrive unnoticed", async () => {
    const table = await rules();
    const named = new Set(SIXTEEN.map(([source]) => source));
    const unnamed = table.map((entry) => entry.source).filter((source) => !named.has(source));

    expect(
      unnamed,
      `next.config.ts carries redirect rules this suite does not name.\n\n` +
        `If this is B-09's rule, it is in the WRONG PLACE: D-261-02 refused the config ` +
        `arm twice over — a static rule cannot name an owner that is not in the URL, and ` +
        `\`/blueprints/:slug\` would also match \`/blueprints/{owner}\` and shadow the ` +
        `filesystem. The redirect is a page-level redirector; see ac1-redirector.test.ts.\n\n` +
        `If it is a legitimate seventeenth from some other change, add it to SIXTEEN with its ` +
        `reason — the table is the independent statement, so it has to be updated deliberately.`,
    ).toEqual([]);
  });

  it("counts sixteen, as a floor under the named table rather than instead of it", () => {
    expect(SIXTEEN).toHaveLength(16);
    expect(new Set(SIXTEEN.map(([s]) => s)).size, "a duplicated source hides a dropped one").toBe(16);
  });
});
