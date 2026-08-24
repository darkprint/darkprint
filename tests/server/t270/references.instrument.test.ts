/* ============================================================
   T270 — falsifying the references, before any criterion uses them

   `references.ts` supplies the "server" half of AC1, AC2 and AC4.
   If a reference is wrong, every criterion built on it is
   confidently wrong in the same direction and the CLI half cannot
   see it — a reference and the cells consuming it agree by
   construction.

   So each one is driven here against something that did not come
   from it:

     the EXPORT is computed two ways — `exportBundle` over an input
     this suite assembles, and the bytes `scripts/generate-bundles.ts`
     already wrote to `public/bundles/<slug>/`. The generator's
     input assembly was written by somebody else, so a wrong
     assembly here reds rather than producing a plausible folder
     nothing serves.

     the BUMP pairs are real published card versions, whose right
     answer `lib/content/read.test.ts` is already asserting, rather
     than a card mutated here — a card I mutated would make the
     expected level my own opinion.

   And each is shown to DISCRIMINATE, not merely to resolve: a
   reference that answers the same thing for a good input and a bad
   one is a reference that will agree with any CLI at all.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { hasErrors } from "@/lib/core";

import { ARCHIVE, OVERLAY_SLUG } from "./fixtures";
import {
  CARD_PAIRS,
  CARD_PAIRS_ERROR,
  computedExport,
  generatedExport,
  serverBumpDiagnostics,
} from "./references";

describe("AC4's export reference agrees with what the site actually publishes", () => {
  it.each(ARCHIVE.map((bundle) => bundle.slug))(
    "%s — computed export is byte-identical to public/bundles/",
    (slug) => {
      /* The comparison that licenses using either as AC4's reference. Not `toEqual` on the
         paths alone: AC4 is about BYTES, and a folder with the right names and a stale
         `README.md` would pass a name check while failing the criterion it exists to serve. */
      expect(computedExport(slug)).toEqual(generatedExport(slug));
    },
  );

  it("carries the overlay file for the one bundle that has one, and for no other", () => {
    /* Excludes the bad output rather than admitting the good one. `exportBundle` writes
       `ontology/extensions.yaml` only when the bundle USES a local term, so a reference that
       passed the vocabulary unconditionally would put the file in all nine — and every AC4
       cell would then demand a file the server never serves. */
    const withOverlay = ARCHIVE.map((bundle) => bundle.slug).filter((slug) =>
      computedExport(slug).some((file) => file.path === "ontology/extensions.yaml"),
    );

    expect(withOverlay).toEqual([OVERLAY_SLUG]);
  });

  it("is not trivially empty for any bundle", () => {
    /* A floor. `generatedExport` walks a directory, and a walk of a directory that does not
       exist would throw — but a walk of an EMPTY one answers `[]`, and `[] toEqual []` is the
       shape in which two broken halves agree perfectly. */
    for (const bundle of ARCHIVE) {
      expect(computedExport(bundle.slug).length, bundle.slug).toBeGreaterThan(4);
    }
  });
});

describe("AC2's bump reference discriminates", () => {
  it("built its pairs at all", () => {
    /* The captured module-scope premise. `CARD_PAIRS` answers `[]` rather than throwing when
       construction fails, because a throw at module scope reported `(0 test)` and deleted the
       export cells in this file along with the bump ones. `[]` would instead make every
       `it.each` below expand to NOTHING and report a clean run over four cells that never
       existed — so this cell is the only thing standing between that and a false green. */
    expect(CARD_PAIRS_ERROR, "card pairs failed to build").toBeUndefined();
    expect(CARD_PAIRS.length).toBeGreaterThan(0);
  });

  it("found real published pairs to drive", () => {
    /* Named rather than counted, so a card leaving the archive says which one. */
    expect(CARD_PAIRS.map((pair) => pair.id)).toEqual([
      "acceptance-verifier",
      "bounded-retry",
      "intent-router",
      "schema-gate",
    ]);
  });

  it.each(CARD_PAIRS.map((pair) => [pair.id, pair] as const))(
    "%s — the engine infers a real bump level, so a smaller declaration is refusable",
    (_id, pair) => {
      /* The premise every AC2 cell rests on and the one that would silently delete them all.
         `inferBump` answering `none` means the two versions are indistinguishable to the
         engine — and then NO declaration is "below the inferred one", so an AC2 cell built on
         that pair passes against a CLI that refuses nothing. */
      expect(pair.inferred.level).not.toBe("none");
      expect(pair.inferred.reasons.length).toBeGreaterThan(0);
    },
  );

  it.each(CARD_PAIRS.map((pair) => [pair.id, pair] as const))(
    "%s — the reasons live in `hint`, and `message` alone is the sentence AC2 forbids",
    (_id, pair) => {
      /* THE FINDING, and it was found by this cell redding rather than by reading the module.
         `checkDeclaredBump` puts the verdict in `message` and the engine's reasons in `hint`:

           message: "Version `1.0.0` is unchanged from `1.0.0`, but the changes require a
                     minor bump."
           hint:    "Publish `1.1.0` or higher. optional input `assertions` was added."

         AC2's block says printing "too small" WITHOUT the engine's reasons "satisfies the
         verb and fails the user". `message` IS that sentence. So a CLI rendering
         `diagnostic.message` and dropping `hint` — the obvious implementation, since
         `message` is the obvious field — fails AC2 while looking entirely correct.

         Asserted in BOTH directions, because only the pair of them locates the content:
         `message` must NOT carry the reasons and `hint` MUST. A single positive assertion
         over the concatenation would pass against a module that moved them into `message`,
         and then this pin would stop describing where they are. */
      const [diagnostic] = serverBumpDiagnostics(pair, pair.previousVersion);

      for (const reason of pair.inferred.reasons) {
        expect(diagnostic.message, "reasons must not be in `message`").not.toContain(reason);
        expect(diagnostic.hint ?? "", "reasons must be in `hint`").toContain(reason);
      }
    },
  );

  it.each(CARD_PAIRS.map((pair) => [pair.id, pair] as const))(
    "%s — refuses a declaration below the inferred level",
    (_id, pair) => {
      /* Re-declaring the previous version is unambiguously "not higher", which is the one
         reading of "below the inferred one" nothing disputes. */
      const diagnostics = serverBumpDiagnostics(pair, pair.previousVersion);

      expect(hasErrors(diagnostics)).toBe(true);
      /* The whole rendered diagnostic — what a CLI carrying both fields would show. This is
         the shape AC2's own cell will compare the CLI against once the barrel is published. */
      const rendered = diagnostics
        .map((diagnostic) => `${diagnostic.message} ${diagnostic.hint ?? ""}`)
        .join("\n");
      for (const reason of pair.inferred.reasons) expect(rendered).toContain(reason);
    },
  );

  it.each(CARD_PAIRS.map((pair) => [pair.id, pair] as const))(
    "%s — accepts the version the archive actually published",
    (_id, pair) => {
      /* THE NEAR MISS, and the cell that separates a reference that works from one that
         merely refuses. It differs from the cell above by one argument, and the answer must
         flip. Without it, a `checkDeclaredBump` that refused EVERYTHING would pass every
         refusal cell here and AC2 would be green against a CLI that rejects valid bumps. */
      expect(serverBumpDiagnostics(pair, pair.nextVersion)).toEqual([]);
    },
  );
});
