/* ============================================================
   T040 AC6 — a term the supplied vocabulary lacks

   "a card naming a term the supplied vocabulary lacks returns
   `card/unknown-term`, never silence"

   ── why this is not the same test as the one in archive.test.ts ──
   That one drops `extensions` entirely. This one SUPPLIES a
   vocabulary that simply does not define the term the card names,
   which is the case the criterion actually describes and a
   different code path: a module that only checked "were any
   extensions passed" answers correctly for the first and silently
   for the second.

   ── "never silence" is the load-bearing word ──
   Doc 3 §7 on a term nothing subsumes: "l'analisi statica … la
   ignora silenziosamente, che è il peggior esito possibile" — every
   card using it validates and every score is quietly wrong. So the
   assertions here are about the diagnostic being PRESENT for every
   card that names the term, not about one turning up somewhere.

   ── collapse and saturation ──
   A ruling that splits a domain is only held by a suite that reds
   when the split is erased either way, so every case below is a
   pair: the term unknown and reported, and the same card against a
   vocabulary that defines it, reported about by nothing.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { asLoadBundleResult, bind, codesOf, returning } from "./contract";
import {
  LOCAL_TERM,
  UNROOTED_TERMS,
  VOCABULARY_BUNDLE,
  caseFor,
  withoutVocabulary,
} from "./fixtures";

/** The two cards in `frontline-triage` whose `risk_markers` name the local term. Measured. */
const CARDS_NAMING_THE_TERM = [
  "cards/reply-dispatch@1.0.0.yaml",
  "cards/reply-qa-check@1.0.0.yaml",
];

describe("AC6: a card naming a term the supplied vocabulary lacks", () => {
  it("reports card/unknown-term for every card that names it, not for the first one", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    /* A vocabulary that IS supplied and simply does not define `lupo/pii-handling`. The terms
       are a well-formed local set of their own, so nothing about this submission is malformed —
       the only thing wrong with it is the one thing AC6 is about. */
    const result = asLoadBundleResult(
      returning(
        () => validateBundle({ ...withoutVocabulary(input), extensions: UNROOTED_TERMS }),
        "validateBundle(vocabulary lacking the term)",
      ),
      "validateBundle(vocabulary lacking the term)",
    );

    const unknown = result.diagnostics.filter((d) => d.code === "card/unknown-term");
    const files = unknown.map((d) => d.location?.file).sort();

    expect(
      files,
      "never silence: every card naming the term is told, and a module reporting the first " +
        "leaves the rest scoring against a term nobody defined",
    ).toEqual([...CARDS_NAMING_THE_TERM].sort());

    for (const d of unknown) {
      expect(d.severity).toBe("error");
      expect(d.message, "the diagnostic names the term it could not find").toContain(LOCAL_TERM);
      /* The position inside the document, not just the document. A card can name several terms
         and an author fixing one needs to know which field. Measured against base. */
      expect(d.location?.path, "AC6's diagnostic points at the field").toBe("risk_markers[0]");
    }
  });

  /* Saturation. The same two cards against the vocabulary that defines the term must produce
     nothing — otherwise "reports `card/unknown-term`" is held by a module that reports it
     always, which loses the distinction just as completely as reporting it never. */
  it("says nothing about the same cards when the vocabulary defines the term", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const result = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(vocabulary defining the term)"),
      "validateBundle(vocabulary defining the term)",
    );

    expect(codesOf(result.diagnostics)).not.toContain("card/unknown-term");
  });

  /* A term the vocabulary lacks is not the same input as no vocabulary at all, and both have to
     be answered. The pair is here rather than split across files because the failure mode is a
     module that handles one and not the other, and that is invisible unless the two sit
     together. */
  it("answers the same way whether the vocabulary is absent or merely lacks the term", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const absent = asLoadBundleResult(
      returning(() => validateBundle(withoutVocabulary(input)), "validateBundle(absent)"),
      "validateBundle(absent)",
    );
    const lacking = asLoadBundleResult(
      returning(
        () => validateBundle({ ...withoutVocabulary(input), extensions: UNROOTED_TERMS }),
        "validateBundle(lacking)",
      ),
      "validateBundle(lacking)",
    );

    const filesFor = (r: typeof absent) =>
      r.diagnostics
        .filter((d) => d.code === "card/unknown-term")
        .map((d) => d.location?.file)
        .sort();

    expect(filesFor(lacking)).toEqual(filesFor(absent));
    expect(filesFor(absent).length).toBeGreaterThan(0);
  });

  /* The consequence, and the reason AC6 is worth a criterion of its own: a card carrying an
     unknown term is REJECTED with it, so the node it instantiates drops out of the analysis and
     both readings move. Silence here would leave a score that looks computed and was computed
     against a term that resolved to nothing. */
  it("costs the bundle the cards that name the unknown term", async () => {
    const validateBundle = await bind("validateBundle");
    const { input } = caseFor(VOCABULARY_BUNDLE);

    const known = asLoadBundleResult(
      returning(() => validateBundle(input), "validateBundle(known)"),
      "validateBundle(known)",
    );
    const unknown = asLoadBundleResult(
      returning(
        () => validateBundle({ ...withoutVocabulary(input), extensions: UNROOTED_TERMS }),
        "validateBundle(unknown)",
      ),
      "validateBundle(unknown)",
    );

    expect(known.blueprint?.nodes.length).toBe(7);
    expect(unknown.blueprint?.nodes.length).toBe(5);
    expect(unknown.analysis?.security.level).not.toBe(known.analysis?.security.level);
  });
});
