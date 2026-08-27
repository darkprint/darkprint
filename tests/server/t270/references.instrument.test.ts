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

     the BUMP pairs are two snapshots of a real archive blueprint
     differing in one pinned ref, moved between two versions the
     archive actually publishes — so the change being priced is one
     the registry could really contain.

     They were CARD pairs until D-270-05 (1) named the subject as
     the BUNDLE. `inferBump` over cards and `inferBlueprintBump`
     over snapshots are different functions over different inputs
     producing different reasons, so those cells were comparing the
     CLI against the wrong oracle — green, and wrong. The section
     named no subject at all when they were written. The old
     reference is deleted rather than repointed: left in place it
     would still resolve and still pass its own cells.

   And each is shown to DISCRIMINATE, not merely to resolve: a
   reference that answers the same thing for a good input and a bad
   one is a reference that will agree with any CLI at all.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { hasErrors } from "@/lib/core";

import { ARCHIVE, OVERLAY_SLUG } from "./fixtures";
import {
  computedExport,
  generatedExport,
  serverBumpDiagnostics,
  SNAPSHOT_PAIRS,
  SNAPSHOT_PAIRS_ERROR,
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
    /* The captured module-scope premise. `SNAPSHOT_PAIRS` answers `[]` rather than throwing,
       because a throw at module scope reports `(0 test)` and deletes every cell in the file —
       the export cells included. But `[]` makes every `it.each` below expand to NOTHING and
       report a clean run over cells that never existed, so this is the only thing standing
       between that and a false green. */
    expect(SNAPSHOT_PAIRS_ERROR, "snapshot pairs failed to build").toBeUndefined();
    expect(SNAPSHOT_PAIRS.length).toBeGreaterThan(0);
  });

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — the engine prices the moved ref, so a smaller declaration is refusable",
    (_slug, pair) => {
      /* The premise every AC2 cell rests on and the one that would silently delete them all.
         `inferBlueprintBump` answering `none` means the two snapshots are indistinguishable to
         the engine — and then NO declaration is "below the inferred one", so an AC2 cell built
         on that pair passes against a CLI that refuses nothing. */
      expect(pair.inferred.level, `moving \`${pair.movedId}\` priced nothing`).not.toBe("none");
      expect(pair.inferred.reasons.length).toBeGreaterThan(0);
    },
  );

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — the reasons live in `hint`, and `message` alone is the sentence AC2 forbids",
    (_slug, pair) => {
      /* D-270-04 (2), which this suite measured and the section now states.

           message: "Version `1.0.0` is unchanged from `1.0.0`, but the changes require a
                     major bump."
           hint:    "Publish `2.0.0` or higher. <the engine's reasons>"

         `message` IS the reasons-free "too small" sentence AC2 says "satisfies the verb and
         fails the user". So a CLI rendering `diagnostic.message` and dropping `hint` fails AC2
         while looking entirely correct, and `.message` is the obvious field.

         Asserted in BOTH directions, because only the pair of them locates the content: a
         single positive assertion over the concatenation would pass against a module that
         moved the reasons into `message`, and the pin would stop describing where they are. */
      const [diagnostic] = serverBumpDiagnostics(pair, pair.previousVersion);

      for (const reason of pair.inferred.reasons) {
        expect(diagnostic.message, "reasons must not be in `message`").not.toContain(reason);
        expect(diagnostic.hint ?? "", "reasons must be in `hint`").toContain(reason);
      }
    },
  );

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — refuses a declaration that is not higher",
    (_slug, pair) => {
      const diagnostics = serverBumpDiagnostics(pair, pair.previousVersion);
      expect(hasErrors(diagnostics)).toBe(true);

      const rendered = diagnostics
        .map((diagnostic) => `${diagnostic.message} ${diagnostic.hint ?? ""}`)
        .join("\n");
      for (const reason of pair.inferred.reasons) expect(rendered).toContain(reason);
    },
  );

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — accepts a declaration at or above the inferred level",
    (_slug, pair) => {
      /* THE NEAR MISS. One argument different from the cell above and the answer must flip.
         Without it, a `checkDeclaredBump` that refused EVERYTHING would pass every refusal
         cell here and AC2 would be green against a CLI that rejects valid bumps.

         The satisfying version is computed from the inferred level rather than typed, so this
         stays correct for a pair the engine prices `minor` and one it prices `major`. */
      const satisfying = { major: "2.0.0", minor: "1.1.0", patch: "1.0.1", none: "1.0.1" }[
        pair.inferred.level
      ];
      expect(serverBumpDiagnostics(pair, satisfying)).toEqual([]);
    },
  );
});
