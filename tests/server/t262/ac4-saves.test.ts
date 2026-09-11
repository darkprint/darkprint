/* ============================================================
   T262 AC4's card half, and the `/u/null` link

   AC4 is "starring on a card page appears in the owner's Saved
   tab". Only the card half is asserted here: the blueprint half
   needs a `bundleId` on `BlueprintSummary` or a resolver route.

   The saves routes are measured by their own suites, so this file
   does not drive HTTP. What it pins is the CLIENT: the star reaches
   the saves API for a signed-in reader, reaches the migration route
   that turns signed-out bookmarks into account saves, and keeps the
   two stores on separate branches. `SaveTarget.refId` is a bundle
   id, `visible.ts` silently drops a malformed one and the route has
   no 404 on a write, so a wrongly wired star is accepted with a 200
   and never appears in the Saved tab; a green HTTP cell would call
   that working.
   ============================================================ */

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { importSpecifiers, sources } from "./contract";
import { SETTINGS_ROUTE, resolved } from "./partition";

const FAVORITE_STAR = "components/ui/FavoriteStar.tsx";

function read(path: string) {
  const [source] = sources([resolved(path)], 1);
  return source;
}

describe("premise: the star is still a component", () => {
  it("parses and imports", () => {
    const source = read(FAVORITE_STAR);
    expect(
      importSpecifiers(source).length,
      `${FAVORITE_STAR} yielded no imports, so the absences below are facts about the scanner.`,
    ).toBeGreaterThan(0);
  });
});

describe("AC4: a signed-in reader's card star lands on the ACCOUNT", () => {
  /* `localStorage` legitimately survives in the component: signed-out readers and the
     blueprint half still use it, and the migration reads it on sign-in. The criterion is
     WHERE a signed-in reader's card star lands, so the branch is pinned and never the token. */
  it("the component reaches the saves route", () => {
    /* TERMINATED, not a substring: `"/api/account/saves/migrate"` contains
       `"/api/account/saves"`, so a plain `includes` was satisfied by the migration constant
       alone, and a component that only migrated and never saved passed both cells. */
    const source = read(FAVORITE_STAR);
    expect(
      /["'`]\/api\/account\/saves["'`]/.test(source.code),
      "`FavoriteStar` does not reach `/api/account/saves` in code. Checked on comment-stripped " +
        "text on purpose: the route is named in a comment as well, and a scan that read " +
        "comments would call that wiring and pass against a component that saves nowhere.",
    ).toBe(true);
  });

  it("and reaches the MIGRATION route, which is what closes the disjointness", () => {
    /* The half that makes AC4 true rather than merely wired. A star kept in the browser before
       sign-in has to become an account save afterwards, or the Saved tab still disagrees with
       the card page for every reader who starred anything while signed out. */
    const source = read(FAVORITE_STAR);
    expect(
      source.code.includes("/api/account/saves/migrate"),
      "`FavoriteStar` never calls the migration route. `migrateLocalSaves` is what turns a " +
        "signed-out reader's local bookmarks into account saves on sign-in; without it AC4 " +
        "holds only for stars made after signing in.",
    ).toBe(true);
  });

  it("the account path and the local path are SEPARATE branches, not one store", () => {
    /* Both routes could be reached by a component that also wrote every save to the browser,
       and the two cells above would pass. What AC4 forbids is a signed-in card star landing in
       `localStorage`, so what is asserted is that the account write is guarded by a signed-in
       test at all: the branch, not its spelling. */
    const source = read(FAVORITE_STAR);
    expect(
      /signedIn\s*===\s*true/.test(source.code),
      "no `signedIn === true` guard reaches the account write. Without a branch on session " +
        "state there is one store for both populations, and whichever it is, one of them is wrong.",
    ).toBe(true);
  });
});

describe("no `/u/` link can be built from an absent handle", () => {
  /*
   * `PublicAuthor` is nullable where `Author` is total, and the handle-less account is
   * reachable. `/settings`' rail footer interpolates `` `/u/${author.username}` ``, which
   * becomes `/u/null`, a link to a 404 rendered as "← Back to your profile", unless the
   * footer link is omitted when there is no handle.
   *
   * THE RESIDUAL: the guard is recognised syntactically, as a conditional, `&&` or `??` in
   * the ancestor chain. An implementation that extracts the href into a helper with an early
   * return is correct and WOULD RED HERE, which the failure message says so the repair is to
   * widen this cell rather than to change working code.
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
      "a `/u/` link is built unconditionally. `SessionPayload.handle` is `string | null` and " +
        "the handle-less account is reachable, so this renders `/u/null`, a link to a 404 " +
        "labelled as the reader's own profile.\n\n" +
        "IF YOU EXTRACTED THE HREF INTO A HELPER WITH AN EARLY RETURN, YOUR CODE IS RIGHT AND " +
        "THIS CELL IS TOO NARROW: it recognises a guard syntactically, as a conditional, `&&` " +
        "or `??` in the ancestor chain, and an early return is none of those. Widen the cell.",
    ).toEqual([]);
  });
});
