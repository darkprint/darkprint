/* ============================================================
   T263 AC5 — "no copy anywhere on the route still says nothing is
   sent", plus D-263-01 and D-263-02, which decide WHICH copy.

   The section calls AC5 "greppable and the check that the cutover
   was complete". It is also the criterion most exposed to the
   launderer: an absence over source is satisfied by a file that is
   not there. So `premise()` runs first in every cell here and fails
   outside the negative — see `source.ts`.

   ── the three triples this criterion is asked about ──
   D-263-02 records that the section's sentence "those three
   disclosures come off together" conflates three DIFFERENT triples:
   the honesty ledger rows, the disabled reasons, and the
   core-versus-overlay disclosures. They are separated here, one
   describe block each, so a red names which triple moved.

   ── the one that does NOT come off ──
   D-263-01: the core-versus-overlay disclosures are REWRITTEN, not
   removed, because the premise for removing them is false — the
   client-side validation stays, so the wizard still resolves
   against the shipped core while `publish` opens the STORED
   ontology. There is therefore no cell here asserting those
   sentences are gone, and that absence is deliberate: a cell
   written from the Contract line as it stands would have reddened a
   correct implementation.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import UploadPage from "@/app/upload/page";
import { openText, plainText } from "@/components/ui/visible-text";
import { FLOW, REPO_ROOT, fileAt, occurrences, premise, routeFiles } from "./source";

const files = routeFiles();

/**
 * The claims AC5 retires, with where each is measured at `32274eb` so a later reader can
 * tell a claim that was deleted from one that was never matched.
 *
 * **Every pattern here was falsified before it was written.** A retired-copy pattern that
 * matches nothing is green on the shipped tree AND green after the cutover, which is a cell
 * no mutation can red — the defect this wave asked its blind authors to hunt in their own
 * suites. Each one below is non-zero on the comment-stripped partition at `32274eb`, so
 * each RED in the blind position, and each can only go green by the copy actually changing.
 */
/**
 * Sentences that MATCH a retired pattern and are nonetheless correct, each with the reason.
 *
 * An allow-list rather than a narrower regex, and the difference is auditable: a weakened
 * pattern hides what it stopped catching, where a line here has to be read and argued with.
 *
 * AC5 retires STANDING claims about the route — copy saying this route never sends anything.
 * A refusal message reporting what happened to ONE submission is a different act, and it is
 * true: on a 401 the publish did not run and nothing was stored. Retiring it would replace a
 * true sentence with silence at the one moment a reader needs to know their bundle is safe.
 */
const EXEMPT = [
  "Your session has expired. Sign in again and publish; nothing was stored.",
] as const;

const RETIRED = [
  { what: "the success screen's nothing-was-sent claim", pattern: /nothing (was|is) (sent|saved|stored|uploaded)/i, atHead: 5 },
  { what: "the page's no-backend claim", pattern: /there are no accounts and no backend/i, atHead: 1 },
  { what: "the page's stays-in-this-tab claim", pattern: /read in this tab/i, atHead: 3 },
  { what: "the `not wired up` disabled reason", pattern: /not wired up/i, atHead: 1 },
  { what: "the ledger's account-to-upload-into claim", pattern: /not built yet: an account to upload into/i, atHead: 1 },
] as const;

describe("AC5 — no copy on the route still says nothing is sent", () => {
  it("the partition is real and still carries what SURVIVES the cutover", () => {
    premise(files);
  });

  for (const r of RETIRED) {
    it(`retires ${r.what}`, () => {
      /* Premise first. An absence found in a file that is not there is not a finding. */
      premise(files);
      const hits = files
        .map((f) => ({
          path: f.path,
          n: occurrences(
            EXEMPT.reduce((code, sentence) => code.split(sentence).join(""), f.code),
            r.pattern,
          ),
        }))
        .filter((h) => h.n > 0);
      expect(
        hits,
        `AC5: ${r.what} is still on the route (${hits.map((h) => `${h.path}×${h.n}`).join(", ")}). ` +
          `It matched ${r.atHead} time(s) on the shipped tree, so this red means the copy has ` +
          "not changed yet, not that the pattern is wrong.",
      ).toEqual([]);
    });
  }
});

/* --------------------- the disabled reasons (the second triple) --------------------- */

describe("the three disabled reasons collapse to two", () => {
  it("`still being written` and `blocked` survive and `not wired up` goes", () => {
    premise(files);
    const flow = fileAt(files, FLOW);
    /* The two that survive are asserted PRESENT, and that is what makes the deletion of the
       third discriminating. An implementer who deleted all three would satisfy a bare
       "`not wired up` is absent" cell while removing two sentences the Contract keeps. */
    expect(
      occurrences(flow.code, /still being written/i),
      "T263 Contract: `still being written` survives the collapse and is missing",
    ).toBeGreaterThan(0);
    expect(
      occurrences(flow.code, /\bblocked\b/),
      "T263 Contract: the `blocked` reason survives the collapse and is missing",
    ).toBeGreaterThan(0);
    expect(
      occurrences(flow.code, /not wired up/i),
      "T263 Contract: `not wired up` is deleted rather than reworded, and is still present",
    ).toBe(0);
  });
});

/* --------------------- the ledger (the first triple), D-263-02 --------------------- */

/**
 * `components/site/honesty.test.ts` is the IMPLEMENTER's under D-263-04 — it has to change
 * in the same commit as the copy, and both halves of this task asked for it in the same
 * hour. That is exactly why these cells are here: a ledger the implementer may edit is not
 * an independent check on the implementer. This suite is the axis it cannot reach.
 */
describe("D-263-02 — the ledger moves in one direction", () => {
  const ledger = readFileSync(join(REPO_ROOT, "components/site/honesty.test.ts"), "utf8");

  it("still holds the row for the claim that is still true", () => {
    /* T270 is `todo`, so the skill cannot push. Removing this row would be a false claim,
       and it is the premise for reading the two removals below as deliberate. */
    expect(
      ledger,
      "D-263-02: the live-push row must STAY — T270 is `todo` and removing it is a false claim",
    ).toContain("live push from the editor the skill runs in");
  });

  it("has dropped the row for the account that now exists", () => {
    expect(ledger).toContain("live push from the editor the skill runs in");
    expect(
      ledger.includes(
        "not built yet: an account to upload into, with each blueprint public or private the way a repository is",
      ),
      "D-263-02: accounts are T050 and per-bundle visibility is merged, so this row comes off",
    ).toBe(false);
  });

  it("has dropped the row for the backend that now exists", () => {
    expect(ledger).toContain("live push from the editor the skill runs in");
    expect(
      ledger.includes(
        "there are no accounts and no backend: what you upload is read in this tab and stays in it",
      ),
      "D-263-02: this row is AC5's literal target and comes off with the copy",
    ).toBe(false);
  });
});

/* --------------------- what a reader actually meets --------------------- */

/**
 * The strongest cell in this suite, and the reason it is worth rendering at all when
 * D-263-03 ruled the OTHER criterion source-level.
 *
 * A source assertion says a string is not in a file. This says the sentence is not on the
 * page a reader opens. The difference is not academic here: the retired sentences are
 * rendered copy in a server component, `honesty.test.ts` proves they render today, and a
 * cutover that deleted the ledger row while leaving the paragraph would pass every grep in
 * this file and still show the reader a lie.
 *
 * `plainText` for the absences and `openText` for the survivor, which is the ledger's own
 * distinction: a sentence folded into a `<details>` is present but not open, and the
 * survivor qualifies a control printed in the open.
 */
describe("AC5 at the surface — the page a reader opens", () => {
  const html = renderToStaticMarkup(createElement(UploadPage as never));

  it("rendered something to assert over", () => {
    // honesty.test.ts:521-527's device: "A ledger held over an empty string passes every case."
    expect(html.length, "/upload rendered nothing — every assertion below would pass").toBeGreaterThan(2000);
  });

  /* Both sides lower-cased, which is `honesty.test.ts:570-572`'s own convention and not a
     convenience: the page renders these as sentences, so `openText` returns "Nor is there a
     live push…" with a capital. Compared case-sensitively the two negatives below would
     both have been VACUOUS — green on the shipped tree and green after, matching nothing
     either way. The premise above is what caught it. */
  const open = openText(html).toLowerCase();
  const plain = plainText(html).toLowerCase();

  it("still states the limit that is still true", () => {
    expect(
      open,
      "D-263-02: the live-push refusal must still be in the OPEN on /upload",
    ).toContain("live push from the editor the skill runs in");
  });

  it("no longer tells the reader the file stays in the tab", () => {
    expect(open).toContain("live push from the editor the skill runs in");
    expect(
      plain,
      "AC5: /upload still renders the no-backend sentence to the reader",
    ).not.toContain("there are no accounts and no backend");
  });

  it("no longer tells the reader there is no account to upload into", () => {
    expect(open).toContain("live push from the editor the skill runs in");
    expect(
      plain,
      "AC5/D-263-02: /upload still renders the no-account sentence to the reader",
    ).not.toContain("not built yet: an account to upload into");
  });
});
