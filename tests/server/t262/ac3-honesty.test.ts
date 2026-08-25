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

import { execFileSync } from "node:child_process";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  type Claim,
  claimHolds,
  findInCode,
  sources,
  contains,
  countIn,
  stripComments,
  whyClaimFailed,
} from "./contract";
import { SETTINGS_ROUTE, resolved } from "./partition";

const PROFILE_LOAD = "components/profile/load.ts";

const FAVORITE_STAR = "components/ui/FavoriteStar.tsx";

function read(path: string) {
  const [source] = sources([resolved(path)], 1);
  return source;
}

/* ============================================================
   THE PREMISE READS THE BASE BLOB, NOT THE TREE UNDER TEST

   The first version asked "is this string in the file now?", which
   is the wrong question twice over. It is green before the cutover
   for the right reason and RED AFTER A CORRECT ONE — the retirement
   succeeding is exactly what empties it — so the suite could never
   go green, and the cell would have been read as a defect in the
   implementation rather than in itself.

   The question the premise actually needs to ask is *was this pin
   valid in the tree this suite was written against*. That subject is
   immutable, so it is read from git at a pinned SHA. A pinned sha
   rather than a ref: `tests/error-hygiene.test.ts:113` dereferences
   `backend` at run time, and a mutable global can move what a guard
   compares against between two runs. `3f7ea7b` cannot.

   What this catches is the thing worth catching: a pin written
   against text that was never there. Two of the quotations published
   in the rulings ARE paraphrases — `stays in this browser` and
   `never sent anywhere` both occur zero times — and a retirement
   cell built on either would be green forever and look like coverage.
   ============================================================ */
const BASE_SHA = "3f7ea7b";

function baseText(path: string): string {
  return execFileSync("git", ["show", `${BASE_SHA}:${path}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/* ============================================================
   `where` EXISTS BECAUSE THE PREMISE AND THE ASSERTION MUST READ
   THE SAME TEXT, AND IN THE FIRST VERSION OF THIS FILE THEY DID NOT

   The premise counted occurrences in `raw`; the retirement asserted
   absence in `code`. A claim living only in a docblock therefore
   satisfied BOTH — present in raw forever, absent from code forever —
   so the cell was permanently green and looked exactly like coverage.
   It was caught because `There is no account` failed to red against a
   tree that still says it.

   Measured, and it is not an edge case: **both sentences D-262-12
   published as the survivor text are COMMENT-ONLY.** `There is no
   account` (`app/settings/page.tsx`) and `There is no session`
   (`components/profile/load.ts`) are docblocks, which is what
   D-262-09 means by "four false claims NO RENDERED GREP CAN REACH".
   D-262-09 corrects them rather than deleting them, so their
   retirement is a comment edit and must be asserted on raw text.

   So `where` picks the text, and it picks it for the premise and the
   assertion together. There is no path through this file where the
   two disagree.
   ============================================================ */
type Where = "rendered" | "comment";

const RETIRED: readonly {
  file: string;
  text: string;
  where: Where;
  seen: number;
  ruling: string;
}[] = [
  {
    file: SETTINGS_ROUTE,
    text: "There is no account",
    where: "comment",
    seen: 1,
    ruling:
      "D-262-09 and D-262-12. The claim the Contract itself cites as the assumption T262 breaks: " +
      "after the cutover there IS an account, so the sentence is a true statement that has " +
      "become a lie about the product.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "no account to delete",
    where: "rendered",
    seen: 1,
    ruling:
      "D-262-15, and it is REWRITTEN rather than deleted: there is an account, what is missing " +
      "is the route. D-78 asks whether the CLAIM is still true, not whether the control works.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "no ownership to move",
    where: "rendered",
    seen: 1,
    ruling: "D-262-15, the second `DangerRow` reason, same direction as the first.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "appearance",
    where: "rendered",
    seen: 1,
    ruling:
      "D-262-09. The page-level strip names a section that is NOT ON THE PAGE — §06 Appearance " +
      "was deleted, with the note recording its removal and six entries in `SETTINGS_SECTIONS`. " +
      "Already false independently of the cutover.",
  },
  {
    file: SETTINGS_ROUTE,
    text: "stays in this browser",
    where: "rendered",
    seen: 1,
    ruling:
      "D-262-19, the page-level `◐ seeded` strip, which comes off for handle, email and default " +
      "visibility. RECOVERED BY THE THREE-PASS MATCHER: it occurs ZERO times literally because " +
      "it wraps with a `</span>` inside it, and this suite first mis-read that as the ruling " +
      "quoting a paraphrase. It is a faithful quotation of a sentence a reader sees.",
  },
  {
    file: PROFILE_LOAD,
    text: "There is no session",
    where: "comment",
    seen: 1,
    ruling:
      "D-262-09 and D-262-12. The Contract cites this docblock as the assumption T262 breaks — " +
      "the owner view is a *page*, not a state, and both variants ship in the build. After the " +
      "cutover there IS a session, and D-262-09 corrects the comment rather than deleting it.",
  },
];

/* Survivors, by claim. Each `anyOf` member is a substring, so a rewrite that still makes the
   claim passes and only the claim's disappearance reds. */
const SURVIVORS: readonly { file: string; claim: Claim; ruling: string }[] = [
  {
    file: SETTINGS_ROUTE,
    claim: {
      claim: "§05 states where a ballot is actually cast",
      /* AMENDED at T280 (owner-instructed, 2026-08-25). This cell pinned "validator voting
         is not built" while T160 was `todo`; T160 merged and T280 published its route
         (POST /api/blueprints/{owner}/{slug}/votes), so the pinned sentence became the
         false claim D-78 forbids in the OTHER direction. The survivor is now the section's
         true statement: casting happens on a blueprint's own page, not on /settings. */
      anyOf: ["asting a ballot happens on a blueprint"],
    },
    ruling:
      "D-262-19 and D-262-15, amended at T280. §05's badge came off when the reads went " +
      "real; the paragraph moved when the WRITE went real too. The section still refuses " +
      "to be a voting surface, which is the claim that survives.",
  },
  {
    file: SETTINGS_ROUTE,
    claim: {
      claim: "§03 still says the notification switches are backed by nothing",
      /* R8. The first list was `["nothing sends", "nothing is sent"]` and the page says
         "notifications, which nothing stores and which send no mail", with each switch carrying
         `reason="Nothing sends yet: no column stores this and no mail goes out."` — the claim
         intact and stated better than the sentence pinned. Widened to the CLAIM's forms, which
         is what D-263-13 cost its author 29 of 31 cells for. */
      anyOf: [
        "nothing sends",
        "Nothing sends",
        "nothing is sent",
        "send no mail",
        "no mail goes out",
        "nothing stores",
      ],
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
  it.each(RETIRED)("$text occurred $seen time(s) in $file at the base ($where)", ({ file, text, where, seen }) => {
    const raw = baseText(file);
    /* The SAME text the assertion will read. A rendered claim is counted on comment-stripped
       code, a comment claim on raw — otherwise a docblock satisfies a premise and an absence at
       the same time, which is the defect the `where` field exists to close. */
    const subject = where === "rendered" ? stripComments(raw, file) : raw;
    /* Counted under whichever pass finds the most. A pinned sentence that wraps across a line
       break, or around a `</span>`, occurs ZERO times literally and once to a reader — and
       counting literally here called two faithful quotations paraphrases, which is the diagnosis
       this suite got wrong once and the reason `countIn` takes a maximum. */
    const count = countIn(subject, text);
    expect(
      count,
      `\`${text}\` was pinned at ${seen} occurrence(s) in \`${file}\` as ${where} text, and ` +
        `at \`${BASE_SHA}\` it occurs ${count} times. A retirement cell whose subject was never ` +
        `there is green today, green after a correct cutover and green after a wrong one — it ` +
        `measures nothing and looks exactly like coverage. Two quotations in the rulings are ` +
        `paraphrases rather than source text for this reason, and are deliberately not pinned.`,
    ).toBe(seen);
  });
});

describe("AC3: the claims that became false are retired", () => {
  it.each(RETIRED)("$file no longer says `$text` ($where)", ({ file, text, where, ruling }) => {
    const source = read(file);
    if (where === "rendered") {
      /* Comment-stripped, so a docblock explaining the retirement is not charged as the claim —
         the false-red direction, which would bill a correct implementer for the work they did. */
      const found = findInCode(source, text);
      expect(
        found === undefined ? [] : [`line ${found.line}`],
        `${file} still says \`${text}\` in text that reaches the reader. ${ruling}`,
      ).toEqual([]);
      return;
    }
    /* A comment claim is asserted on RAW. D-262-09 corrects these rather than deleting them, so
       what must go is the false sentence; whatever replaces it is not pinned here, because
       pinning a replacement wording is how a correct rewrite gets redded. */
    expect(
      contains(source.raw, text),
      `${file} still carries the docblock claim \`${text}\`. ${ruling}`,
    ).toBe(false);
  });
});

describe("R7: a claim D-262-09 CORRECTS cannot be tested by its absence", () => {
  /* ============================================================
     `never sent anywhere` was pinned here as a retirement and redded
     at the join against a correct file. The docblock now reads:

       "This WAS a browser-local bookmark: a key in `localStorage`,
        one entry per browser, never sent anywhere. A card save now
        reaches the account through POST/DELETE /api/account/saves..."

     Past tense, quoting the retired claim while naming what replaced
     it — which is what D-262-09 asks for. **A correction that does
     not name what changed is a worse comment**, so absence is the
     wrong test for this class of claim, and I was warned of exactly
     this shape and built the pin anyway.

     Note the split: the other two D-262-09 comment claims,
     `There is no account` and `There is no session`, were rewritten
     WITHOUT quoting and their absence pins pass. So this is a
     per-claim property, not a blanket flaw — which is why the
     replacement below is a positive about THIS file rather than a
     weakening of the absence test everywhere.

     What is asserted instead is the thing that makes the correction
     true and is not a wording: the docblock names the route the save
     now takes. A comment still claiming the bookmark goes nowhere
     cannot also name the endpoint it goes to.
     ============================================================ */
  it("`FavoriteStar`'s docblock names what the save now does", () => {
    const source = read(FAVORITE_STAR);
    const docblocks = source.raw.slice(0, source.raw.indexOf("import "));
    expect(
      contains(docblocks, "/api/account/saves"),
      "`FavoriteStar`'s header does not name the route a card save now takes. D-262-09 corrects " +
        "these claims rather than deleting them, so the test is that the correction names what " +
        "changed — not that the retired sentence is absent, which a correction quoting it in " +
        "the past tense can never satisfy.",
    ).toBe(true);
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

  it("no `<ComingSoonBadge />` remains on the page", () => {
    expect(
      usages(),
      "D-262-19, amended at T280 (owner-instructed, 2026-08-25): the danger section's badge " +
        "was the last one and its reason was 'what is missing there is the route' — T120's " +
        "routes merged and T280 wired the page to them, so the badge's claim became the " +
        "false one. Zero is now the honest count; a badge REAPPEARING here is the signal " +
        "this cell watches for, because it would mean a settings control went dark again " +
        "without its route going away.",
    ).toBe(0);
  });
});
