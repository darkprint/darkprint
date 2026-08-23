/* ============================================================
   T262 AC3 — D-262-19's pairings, and D-262-07/09/15's directions

   AC3 is "the honesty strip is gone exactly where persistence now
   works", a biconditional whose right-hand side both halves are
   forbidden to read. D-262-19 published the pairing per section so
   it is not invented here, and D-262-05 ruled the criterion
   source-level: `honesty.test.ts` imports no `/settings` page and no
   profile component, so the honesty claims on T262's surfaces live
   only in page source, guarded by nothing until this file.

   ── every pin below was verified PRESENT before it was written ──
   An absence assertion for a string that was never in the file is
   green today, green after a correct cutover, and green after a
   wrong one. It measures nothing, and it looks exactly like
   coverage. So each retired claim below carries the count it had on
   `backend` at `24a22c4`, and each is > 0.

   TWO PUBLISHED QUOTATIONS ARE PARAPHRASES AND ARE NOT PINNED:
   D-262-19 renders the page-level strip as naming *"appearance,
   which stays in this browser"* — `stays in this browser` occurs
   ZERO times in the file. D-262-09 renders `FavoriteStar.tsx:6-11`
   as *"never sent anywhere"* — also ZERO. Both are faithful
   summaries of the claim and neither is source text, so pinning
   either would have produced a permanently vacuous cell. `appearance`
   itself occurs exactly once and IS pinned, because that single
   occurrence is the false reference D-262-09 identified.

   ── the survivors are pinned as CLAIMS, not as wordings ──
   `anyOf` substrings, so a rewrite that still makes the claim
   passes. T263's blind author lost 29 of 31 first-contact cells to a
   survivor pin that kept a conjunction only parsing while the
   retired sentences stood in front of it.
   ============================================================ */

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { type Claim, claimHolds, findInCode, sources, whyClaimFailed } from "./contract";
import { SETTINGS_ROUTE, resolved } from "./partition";

const FAVORITE_STAR = "components/ui/FavoriteStar.tsx";

function read(path: string) {
  const [source] = sources([resolved(path)], 1);
  return source;
}

/* Retired by ruling. `seen` is the count on `backend` at `24a22c4`, and it is asserted as the
   premise of each cell: a pin whose subject was already absent is not a criterion. */
const RETIRED: readonly { file: string; text: string; seen: number; ruling: string }[] = [
  {
    file: SETTINGS_ROUTE,
    text: "There is no account",
    seen: 1,
    ruling:
      "D-262-09 and D-262-12. The claim the Contract itself cites as the assumption T262 breaks: " +
      "after the cutover there IS an account, so the sentence is a true statement that has " +
      "become a lie about the product.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "no account to delete",
    seen: 1,
    ruling:
      "D-262-15, and it is REWRITTEN rather than deleted: there is an account, what is missing " +
      "is the route. D-78 asks whether the CLAIM is still true, not whether the control works.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "no ownership to move",
    seen: 1,
    ruling: "D-262-15, the second `DangerRow` reason, same direction as the first.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "appearance",
    seen: 1,
    ruling:
      "D-262-09. The page-level strip names a section that is NOT ON THE PAGE — §06 Appearance " +
      "was deleted, with the note recording its removal and six entries in `SETTINGS_SECTIONS`. " +
      "Already false independently of the cutover.",
  },
];

/* Survivors, by claim. Each `anyOf` member is a substring, so a rewrite that still makes the
   claim passes and only the claim's disappearance reds. */
const SURVIVORS: readonly { file: string; claim: Claim; ruling: string }[] = [
  {
    file: SETTINGS_ROUTE,
    claim: {
      claim: "§05 still says validator voting is not built",
      anyOf: ["Validator voting is not built", "validator voting is not built"],
    },
    ruling:
      "D-262-19 and D-262-15. §05's BADGE comes off because `validatorSince` and " +
      "`validatorWeight` are real reads, while this paragraph STAYS because T160 is `todo`. " +
      "Same section, opposite directions.",
  },
  {
    file: SETTINGS_ROUTE,
    claim: {
      claim: "§03 still says nothing sends",
      anyOf: ["nothing sends", "nothing is sent"],
    },
    ruling:
      "D-262-19. The email field gains a route; the three notification switches have no column " +
      "and no owner (D-262-14 G1), so the section-level marker stays true of the switches even " +
      "as the field beside them goes live. One section, two directions.",
  },
  {
    file: FAVORITE_STAR,
    claim: { claim: "the seeded star count keeps its marker", anyOf: ["◐"] },
    ruling:
      "D-262-07. `app/api/signals/**` does not exist — D-WAVE-02 dropped `app/api/**` from " +
      "T150's wave, and a client component cannot import `@/lib/server/counters`. The figure " +
      "has not become real, so removing the marker is the false-claim direction.",
  },
];

describe("premise: every retired claim is in the file TODAY", () => {
  /*
   * Without this, each cell below is an absence assertion over a string that may never have been
   * there — permanently green, and indistinguishable from coverage. This is the cell that makes
   * the four retirements measurements rather than decorations.
   */
  it.each(RETIRED)("$text occurs $seen time(s) in $file", ({ file, text, seen }) => {
    const source = read(file);
    const count = source.raw.split(text).length - 1;
    expect(
      count,
      `\`${text}\` was counted ${seen} time(s) on \`backend\` at \`24a22c4\` and is now ` +
        `${count}. If it is 0 because the cutover retired it, this premise has done its job and ` +
        `moves to the pinned count; if it was never there, the retirement cell below was ` +
        `vacuous and must be rewritten against text that exists.`,
    ).toBeGreaterThan(0);
  });
});

describe("AC3: the claims that became false are retired", () => {
  it.each(RETIRED)("$file no longer says `$text`", ({ file, text, ruling }) => {
    const source = read(file);
    /*
     * Decided on comment-stripped code. A docblock explaining the retirement is the false-red
     * direction of the 2x2 and would charge a correct implementer with the work they did.
     */
    const found = findInCode(source, text);
    expect(
      found === undefined ? [] : [`line ${found.line}`],
      `${file} still says \`${text}\` in text that reaches the reader. ${ruling}`,
    ).toEqual([]);
  });
});

describe("AC3: the claims that are still true survive, and survive ON SCREEN", () => {
  it.each(SURVIVORS)("$file still makes: $claim.claim", ({ file, claim, ruling }) => {
    const source = read(file);
    const held = claimHolds(source, claim);
    expect(
      held !== undefined,
      `${whyClaimFailed(source, claim)}\n\n${ruling}`,
    ).toBe(true);
  });
});

describe("D-262-19: the badge comes off two sections and stays on one", () => {
  /*
   * Counted as JSX ELEMENTS via the parser, not as occurrences of the identifier: the import and
   * the component's own definition are two more matches a text count cannot tell from a usage,
   * and a cutover that removed a usage while leaving the import would read as unchanged.
   *
   * Three usages today at the page-level strip, §05 and the danger section. D-262-19 takes the
   * first two off and keeps the third, so the expected end state is exactly ONE.
   */
  const usages = (): number => {
    const source = read(SETTINGS_ROUTE);
    const sf = ts.createSourceFile(
      source.path,
      source.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let n = 0;
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        if (node.tagName.getText() === "ComingSoonBadge") n++;
      }
      node.forEachChild(visit);
    };
    visit(sf);
    return n;
  };

  it("exactly one `<ComingSoonBadge />` remains, the danger section's", () => {
    expect(
      usages(),
      "D-262-19: the page-level strip's badge comes off (handle, email and default visibility " +
        "have merged routes) and §05's comes off (`validatorSince`/`validatorWeight` are real " +
        "reads), while the danger section's STAYS because what is missing there is the route. " +
        "Three usages were counted on `backend` at `24a22c4`. Zero would mean the danger badge " +
        "came off too, which is the false-claim direction D-78 forbids.",
    ).toBe(1);
  });
});
