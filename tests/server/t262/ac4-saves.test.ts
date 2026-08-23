/* ============================================================
   T262 AC4's card half, and D-262-14 G2's `/u/null`

   AC4 is "starring on a card page appears in the owner's Saved
   tab", which the section calls the disjointness the code
   apologises for three times. D-262-04 split it: THE CARD HALF IS
   BUILDABLE inside `Owns`, the blueprint half needs a `bundleId` on
   `BlueprintSummary` or a resolver route, both T080's, and is
   recorded as a gap. Only the card half is asserted here.

   ── why this file does not drive HTTP ──
   The saves routes are T140's and merged, so driving them would
   measure T140. What is T262's is the CLIENT: that the star stops
   writing to `localStorage` and starts reaching the saves API, and
   that what it sends is a bare id. D-262-04's chain is why the last
   part matters and why nothing catches it at run time —
   `SaveTarget.refId` is a bundle id and never `id@version`,
   `visible.ts:69-80` requires a well-formed uuid and SILENTLY DROPS
   one that is not, and the route has no 404 on a write by design.
   **So a slug posted as `refId` is accepted with a 200 and never
   appears in the Saved tab, with no error at any layer.** AC4 fails
   silently and looks like it passed, which is precisely the shape a
   green HTTP cell would report as working.

   ── the migration is the criterion, not the mechanism ──
   `FavoriteStar` moves from `localStorage` to the saves API via
   T140's `migrateLocalSaves`, whose idempotency AC5 there covers.
   What is pinned below is that the local store is gone and the API
   is reached, not how the fetch is written.
   ============================================================ */

import { execFileSync } from "node:child_process";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { importSpecifiers, sources, stripComments } from "./contract";
import { SETTINGS_ROUTE, resolved } from "./partition";

const FAVORITE_STAR = "components/ui/FavoriteStar.tsx";
const BASE_SHA = "3f7ea7b";

function read(path: string) {
  const [source] = sources([resolved(path)], 1);
  return source;
}

function baseCode(path: string): string {
  const raw = execFileSync("git", ["show", `${BASE_SHA}:${path}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return stripComments(raw, path);
}

describe("premise: the star is still a component, and it did use `localStorage`", () => {
  it("parses and imports", () => {
    const source = read(FAVORITE_STAR);
    expect(
      importSpecifiers(source).length,
      `${FAVORITE_STAR} yielded no imports, so the absences below are facts about the scanner.`,
    ).toBeGreaterThan(0);
  });

  it("`localStorage` was in it at the base, so its absence will mean something", () => {
    /*
     * Read from the base blob at a pinned sha, not the working tree: asking "is it there now"
     * is red after a correct cutover, which is the retirement succeeding. Six occurrences were
     * counted at `3f7ea7b`.
     */
    const occurrences = baseCode(FAVORITE_STAR).split("localStorage").length - 1;
    expect(
      occurrences,
      `\`localStorage\` does not appear in \`${FAVORITE_STAR}\` at \`${BASE_SHA}\`. The AC4 cell ` +
        `below would then be an absence assertion over something that was never there — green ` +
        `before the cutover, green after a correct one, and green after a wrong one.`,
    ).toBeGreaterThan(0);
  });
});

describe("AC4: the star no longer keeps saves in the browser", () => {
  it("`FavoriteStar.tsx` does not reference `localStorage`", () => {
    const source = read(FAVORITE_STAR);
    const lines = source.code
      .split("\n")
      .map((text, i) => ({ text, line: i + 1 }))
      .filter((l) => l.text.includes("localStorage"));
    expect(
      lines.map((l) => `line ${l.line}`),
      "`FavoriteStar` still reads or writes `localStorage`. AC4 moves it to the saves API with " +
        "a one-time migration (T140's `migrateLocalSaves`), and the disjointness AC4 closes is " +
        "exactly that a star kept in the browser cannot appear in an account's Saved tab. " +
        "Comments are stripped first, so a docblock recalling the old store does not red this.",
    ).toEqual([]);
  });

  it("and it reaches the saves route, which is the half an absence check cannot see", () => {
    /*
     * The positive that fails outside the negative. Deleting the star, or leaving it inert,
     * satisfies the `localStorage` absence above perfectly — and a component that saves nowhere
     * is not the cutover, it is the feature removed. T262 is among the first clients of the
     * backend in this repository: zero client-side fetches to `/api/**` exist anywhere in
     * `app/**` or `components/**` today, so this reds now and is expected to go green.
     */
    const source = read(FAVORITE_STAR);
    expect(
      source.code.includes("/api/account/saves"),
      "`FavoriteStar` does not reach `/api/account/saves` in code. Checked on comment-stripped " +
        "text on purpose: the route is named in a `TODO(SEAM-62)` comment today, and a scan " +
        "that read comments would call that wiring and pass against a component that saves " +
        "nowhere.",
    ).toBe(true);
  });
});

describe("D-262-14 G2: no `/u/` link can be built from an absent handle", () => {
  /*
   * `PublicAuthor` is nullable where `Author` is total, and the handle-less account is reachable
   * (T050 AC1, D-263-09's third session state). The defect the cutover creates is concrete:
   * `/settings`' rail footer interpolates `` `/u/${author.username}` ``, which becomes `/u/null`
   * — a link to a 404 rendered as "← Back to your profile". G2 rules the footer link omitted
   * when there is no handle.
   *
   * Measured at `3f7ea7b`, ALL FIVE `/u/${...}` interpolations across T262's surfaces are
   * unguarded: one here and four in `SiteHeader`'s `ACCOUNT_MENU`. The `SiteHeader` four are
   * D-262-06's subject and are pinned in `frozen.test.ts`; this cell is the settings footer.
   *
   * THE RESIDUAL, and it is a real one: the guard is recognised syntactically — a conditional,
   * `&&`, or `??` in the ancestor chain. An implementation that extracts the href into a helper
   * with an early return is correct and WOULD RED HERE. That is stated in the failure message so
   * the repair is to widen this cell rather than to change working code.
   */
  it(`${SETTINGS_ROUTE} guards every \`/u/\` interpolation`, () => {
    const source = read(SETTINGS_ROUTE);
    const sf = ts.createSourceFile(
      source.path,
      source.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const unguarded: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isTemplateExpression(node) && node.getText().includes("/u/")) {
        let parent: ts.Node | undefined = node.parent;
        let guarded = false;
        for (let depth = 0; parent !== undefined && depth < 8; depth++, parent = parent.parent) {
          if (ts.isConditionalExpression(parent)) {
            guarded = true;
            break;
          }
          if (
            ts.isBinaryExpression(parent) &&
            (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
              parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
          ) {
            guarded = true;
            break;
          }
        }
        if (!guarded) {
          unguarded.push(`line ${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      node.forEachChild(visit);
    };
    visit(sf);

    expect(
      unguarded,
      "a `/u/` link is built unconditionally. D-262-14 G2: `SessionPayload.handle` is " +
        "`string | null` and the handle-less account is reachable, so this renders `/u/null` — " +
        "a link to a 404 labelled as the reader's own profile.\n\n" +
        "IF YOU EXTRACTED THE HREF INTO A HELPER WITH AN EARLY RETURN, YOUR CODE IS RIGHT AND " +
        "THIS CELL IS TOO NARROW: it recognises a guard syntactically, as a conditional, `&&` " +
        "or `??` in the ancestor chain, and an early return is none of those. Widen the cell.",
    ).toEqual([]);
  });
});

describe("D-262-04: the blueprint half is a recorded gap, not a silent omission", () => {
  it("`SEAM-62`'s anchor survives in `FavoriteStar.tsx`", () => {
    /*
     * D-262-04 corrects the `TODO(SEAM-62)` rather than clearing it: it assigned T262 "a
     * translation with nowhere to put it", because `BlueprintSummary` carries no `id` and the
     * blueprint half needs T080's. Asserted on RAW text, since an anchor is a comment by nature.
     *
     * The reason this is a cell and not a note: D-263-01 refused to route the preview through
     * `openView` and recorded a gap instead, and the objection to deleting a surface was that it
     * "would retire a gap BY MAKING IT INVISIBLE". An anchor quietly dropped while the work is
     * still owed is the same move.
     */
    const source = read(FAVORITE_STAR);
    expect(
      source.raw.includes("SEAM-62"),
      "`SEAM-62`'s anchor is gone from `FavoriteStar.tsx` while the blueprint half of AC4 is " +
        "still owed: `BlueprintSummary` carries no `id` (`registry/types.ts:28-35`) and the " +
        "resolver is T080's, not T262's. Removing the anchor retires the gap by making it " +
        "invisible, which is the objection D-262-04 and D-263-01 both record.",
    ).toBe(true);
  });
});
