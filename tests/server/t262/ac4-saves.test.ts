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

describe("AC4: a signed-in reader's card star lands on the ACCOUNT", () => {
  /* ============================================================
     R2, corrected at the join. THE FIRST VERSION OF THIS CELL WOULD
     HAVE FORCED A REGRESSION TO PASS.

     It asserted `localStorage` appears nowhere in `FavoriteStar`.
     Measured against the implementation: two real references survive
     (`readLocal`, `writeLocal`) and the branch at `:246` is
     `signedIn === true && target !== undefined` -> `POST`/`DELETE
     /api/account/saves`, ELSE -> `writeLocal`. `targetFor` returns a
     target only for `node:` ids. So the browser store now holds
     exactly two populations: SIGNED-OUT readers, and the BLUEPRINT
     half D-262-04 put out of scope.

     Deleting it would have deleted the signed-out bookmark and the
     input `migrateLocalSaves` reads at `:163` — the very thing that
     closes AC4's disjointness on sign-in.

     AC4's criterion is WHERE a signed-in reader's card star lands,
     not whether a token appears. Pinning the token was pinning an
     incidental form, which is what cost T263's author 29 of 31 cells.
     ============================================================ */
  it("the component reaches the saves route", () => {
    const source = read(FAVORITE_STAR);
    expect(
      source.code.includes("/api/account/saves"),
      "`FavoriteStar` does not reach `/api/account/saves` in code. Checked on comment-stripped " +
        "text on purpose: the route is named in a comment as well, and a scan that read " +
        "comments would call that wiring and pass against a component that saves nowhere.",
    ).toBe(true);
  });

  it("and reaches the MIGRATION route, which is what closes the disjointness", () => {
    /*
     * The half that makes AC4 true rather than merely wired. A star kept in the browser before
     * sign-in has to become an account save afterwards, or the Saved tab still disagrees with
     * the card page for every reader who starred anything while signed out — which is the
     * disjointness the code apologised for three times.
     */
    const source = read(FAVORITE_STAR);
    expect(
      source.code.includes("/api/account/saves/migrate"),
      "`FavoriteStar` never calls the migration route. T140's `migrateLocalSaves` is what turns " +
        "a signed-out reader's local bookmarks into account saves on sign-in; without it AC4 " +
        "holds only for stars made after signing in.",
    ).toBe(true);
  });

  it("the account path and the local path are SEPARATE branches, not one store", () => {
    /*
     * The discrimination. Both routes could be reached by a component that also wrote every
     * save to the browser, and the two cells above would pass. What AC4 forbids is a signed-in
     * card star landing in `localStorage`, so what is asserted is that the account write is
     * guarded by a signed-in test at all — the branch, not its spelling.
     */
    const source = read(FAVORITE_STAR);
    expect(
      /signedIn\s*===\s*true/.test(source.code),
      "no `signedIn === true` guard reaches the account write. Without a branch on session " +
        "state there is one store for both populations, and whichever it is, one of them is wrong.",
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
