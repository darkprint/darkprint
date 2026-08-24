/* ============================================================
   T260 AC4 and D-260-08 — the marker over a figure that became real

   AC4 HAS NO INSTRUMENT IN THE NAMED SET, AND THE REASON IS
   MEASURED RATHER THAN ARGUED.

   `components/site/honesty.test.ts` pins seventeen surfaces and not
   one of them is a T260 route: they are `/blueprints/<slug>`,
   `/nodes/<id>` (T261), `/spec/card`, `/reading-the-radar`,
   `/what-a-blueprint-is`, `/skill`, `/mcp` and `/upload` (T263). It
   renders none of the three browse pages. So AC3's "passes
   unchanged" is satisfiable by a T260 that deletes every disclosure
   from all three shelves.

   `components/ui/autonomy-surfaces.test.ts` does not cover them
   either, and the reason is NOT the one this author first reported.
   Its seeded clause is gated on `SEEDED_READS` — `.votes`,
   `.downloads`, `compact(votes)`, `compact(downloads)` — and the
   measurement is that NONE OF T260's SIX FILES CONTAINS ONE, at
   `3daa325`, before any cutover:

       for f in <the six>; do grep -c '\.votes\|\.downloads' $f; done   ->  0 0 0 0 0 0

   The six files that ARE in that guard's domain are
   `app/blueprints/[slug]/page.tsx`, `app/nodes/[...id]/page.tsx`,
   `components/blueprint/Comments.tsx`, `components/profile/{Pinned,
   ProfileHeader,ProfileShell}.tsx` — every one of them T261's or
   T262's. The clause is inert for T260's files ALREADY. It does not
   self-disarm at the cutover, as this author told the orchestrator;
   it was never armed here. The conclusion stands and the mechanism
   was wrong, which is the more dangerous half to get wrong, so it
   is corrected here as well as reported.

   ── what AC4 actually bites on, and it is exactly one sentence ──
   Parsing the RENDERED text of all six files — JSX text and string
   literals, never comments — for any provenance claim finds one
   hit in total:

       app/ontology/page.tsx:138-143
         <span …>✓ counted</span>
         <span …>read off content/ at build time, usage included</span>

   That is the D-78 shape exactly: a status glyph plus the sentence
   that qualifies it. `✓ counted` stays true after the cutover and
   becomes more so. **The qualifier becomes FALSE** — the terms and
   the usage index come from the registry per request — and D-260-08
   rules that a marker over a figure that has become real comes off
   in the same change that makes it real. Left behind it is the
   section's own phrase: a true statement that has become a lie
   about the product.

   Everything else AC4 could reach is vacuous on this partition, and
   that is written down rather than covered with cells that cannot
   fail. Three of the six files carry the word "seeded" and all
   three occurrences are in COMMENTS, which is why every cell below
   reads the tree and not the file.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import { BROWSERS, ROUTES, SHELVES, jsxPropsOf, parse, renderedText } from "./partition";

/**
 * The claim the cutover falsifies, matched as a CLAIM and not as a sentence.
 *
 * Both halves are required together. "build time" alone would red a page that says the
 * ontology VERSION was fixed at build time, which stays true; `content/` alone would red a
 * page explaining where an author puts a bundle. What becomes false is the conjunction:
 * this data, from that directory, at that moment.
 */
function claimsBuildTimeArchive(rendered: readonly string[]): string[] {
  return rendered.filter(
    (text) => /content\//.test(text) && /build[\s-]?time|at build\b/i.test(text),
  );
}

/** Below this the page has stopped rendering and every absence assertion over it is free. */
const RENDERED_FLOOR = 8;

describe("AC4 / D-260-08: a provenance marker moves with the figure it qualifies", () => {
  /*
   * ONE CELL, TWO WAYS TO FAIL, WHICH IS THE POINT.
   *
   * AC4 is a negative — "no seeded marker remains" — and every negative on this task is
   * satisfied by a page that renders nothing. So the premise and the assertion sit in the
   * same cell deliberately: deleting the disclosure block passes the assertion and fails
   * the premise, and there is no repair that satisfies one by sacrificing the other.
   */
  it("`/ontology` stops claiming its terms are read off `content/` at build time", () => {
    const [source] = sources([ROUTES.ontology], 1);
    const sf = parse(source.path, source.raw);
    const rendered = renderedText(sf);

    /* Premise 1: the page still renders. */
    expect(
      rendered.length,
      `${ROUTES.ontology} renders ${rendered.length} strings, below the floor of ` +
        `${RENDERED_FLOOR}. A page that renders nothing satisfies every honesty criterion ` +
        `on this task at once, so it fails here instead of passing quietly.`,
    ).toBeGreaterThanOrEqual(RENDERED_FLOOR);

    /* Premise 2: the shelf itself is still mounted with its data. */
    expect(
      jsxPropsOf(sf, "VocabularyBrowser"),
      `${ROUTES.ontology} no longer mounts <VocabularyBrowser> with props. The disclosure ` +
        `below is about a shelf; with no shelf there is nothing for it to be about.`,
    ).not.toEqual([]);

    /* The assertion. */
    const stale = claimsBuildTimeArchive(rendered);
    expect(
      stale,
      `${ROUTES.ontology} still renders: ${stale.map((s) => JSON.stringify(s)).join(", ")}\n\n` +
        `At \`3daa325\` this is \`:141-143\`, the qualifier under the \`✓ counted\` badge:\n` +
        `    "read off content/ at build time, usage included"\n\n` +
        `After the cutover the terms and the usage index come from the registry PER REQUEST ` +
        `(D-260-05), so the sentence is false. D-260-08: a marker over a figure that has ` +
        `become real comes off IN THE SAME CHANGE that makes it real — neither ahead nor ` +
        `behind. Removed early is a false claim; left late is a true statement that has ` +
        `become a lie about the product.\n\n` +
        `The repair is to restate the provenance, not to delete the disclosure: \`✓ counted\` ` +
        `is still true and the cell below requires it to survive.`,
    ).toEqual([]);
  });

  /*
   * The disagreeing control for the cell above, and it is a separate cell because it has a
   * separate repair.
   *
   * The cheapest way to pass "stops claiming X" is to delete the block that claims it —
   * which also deletes `✓ counted`, an honest disclosure about a figure that is about to
   * become MORE honest. D-260-08's second half rules that case: if the surrounding sentence
   * is still true of something else, the sentence stays and only the marker goes.
   */
  it("`/ontology` keeps saying that its usage figure is counted", () => {
    const [source] = sources([ROUTES.ontology], 1);
    const rendered = renderedText(parse(source.path, source.raw));

    const counted = rendered.filter((text) => /\bcounted\b/i.test(text));
    expect(
      counted,
      `${ROUTES.ontology} no longer renders a "counted" disclosure. At \`3daa325\` it is ` +
        `\`:139\`, the \`✓ counted\` badge over the usage figure.\n\n` +
        `D-260-08: the marker comes off, the sentence stays when it is still true — and this ` +
        `one becomes MORE true after the cutover, not less. Deleting the whole block is the ` +
        `easy way to satisfy the cell above and it is the wrong repair: a page that stops ` +
        `saying where its numbers come from has not become more honest by saying less.`,
    ).not.toEqual([]);
  });

  /*
   * The other two shelves have no provenance claim today — measured, not assumed — so this
   * is a REGRESSION cell rather than a restatement of the first. It can fail: a cutover that
   * adds "read off content/ at build time" to `/blueprints` while leaving the read in place
   * would be a page describing itself accurately and failing AC1, and this is where that
   * shows up as an honesty defect rather than only as a missing import.
   */
  it.each(SHELVES.filter((shelf) => shelf !== "ontology"))(
    "`/%s` acquires no build-time provenance claim",
    (shelf) => {
      const [route] = sources([ROUTES[shelf]], 1);
      const [browser] = sources([BROWSERS[shelf]], 1);

      for (const source of [route, browser]) {
        const rendered = renderedText(parse(source.path, source.raw));
        expect(
          rendered.length,
          `${source.path} renders nothing, so the absence below is free`,
        ).toBeGreaterThan(0);

        const stale = claimsBuildTimeArchive(rendered);
        expect(
          stale,
          `${source.path} renders a build-time provenance claim: ` +
            `${stale.map((text) => JSON.stringify(text)).join(", ")}. It had none at ` +
            `\`3daa325\`, and after D-260-05 these shelves render per request, so the ` +
            `sentence would be false the moment it was written.`,
        ).toEqual([]);
      }
    },
  );
});
