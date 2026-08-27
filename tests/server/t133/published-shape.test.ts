/* ============================================================
   T133 — the published shape, pinned at the type level and at the
   barrel, and the comment that directed the guess

   ── what an `Exact<>` pin does and does not establish here ──
   Stated plainly because a previous round paid for leaving it
   implicit. While `StoredVocabulary` is absent from
   `@/lib/server/archive`, `tsc` cannot resolve the import: it errors
   at this line and the namespace becomes `any`, and `Exact<any, T>`
   is `true`. **So these pins are VACUOUS from this tree and cannot
   be falsified from it at all.** They are written anyway because
   they are the only place the published interface is stated as a
   type rather than as prose, and because they become load-bearing
   the moment the module lands.

   **The falsification is owed to whoever holds the tree after the
   merge**, in both directions: making `terms` required, or widening
   `text` to `unknown`, must each produce a TS2322 at the declaration
   below, and restoring it must take the tree back to zero.

   ── why the barrel and not a deep path ──
   D-133-02 F3 granted `archive/index.ts` into Owns on the
   implementer's own argument, which is the decisive one: *a class no
   barrel exports is a class the blind author cannot bind.* T130's
   cells reach `MalformedStoredVocabularyError` through
   `profiles/index.ts`, and without the barrel the equivalent cells
   here could only reach it by a deep path, which is what D-01 exists
   to stop. F4 grants `export/index.ts` a type re-export for the same
   reason in one sentence: *a published shape nobody can import is
   not published.*
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ReleaseRecord, StoredVocabulary } from "@/lib/server/archive";
import type { StoredVocabulary as ReExportedStoredVocabulary } from "@/lib/server/export";

import { loadArchive, malformedVocabularyError, PUBLISHED, required } from "./contract";

/** Mutual assignability. `Exact<any, T>` is `true`, which is this file's stated blind spot. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** True for `unknown` and for `any`, which are the two ways F5's defect can survive. */
type IsUnknown<T> = [unknown] extends [T] ? ([T] extends [unknown] ? true : false) : false;

type NotUnknown<T> = IsUnknown<T> extends true
  ? "`ReleaseRecord.vocabulary` is still `unknown`, so every reader takes `unknown` off the barrel and AC2's `rather than each re-deriving it` is half true (D-133-02 F5)."
  : true;

/**
 * D-133-01's interface, restated here as the pin. The literal on the right is the contract
 * text and is the half a reviewer diffs against `backend.md`.
 */
const storedVocabularyIsExact: Exact<
  StoredVocabulary,
  { text: string; terms?: readonly unknown[] | null }
> = true;

/** F4: the re-export is the same type and not a second declaration of a similar one. */
const exportReExportsTheSameShape: Exact<ReExportedStoredVocabulary, StoredVocabulary> = true;

/** F5: `ReleaseRecord.vocabulary?: unknown` is the exact line the section quotes as the defect. */
const releaseRecordCarriesTheShape: NotUnknown<ReleaseRecord["vocabulary"]> = true;

describe("the published shape is a type, and it is reachable from both sides", () => {
  it("pins `StoredVocabulary` and `ReleaseRecord.vocabulary` at the type level", () => {
    /* The three constants above are the assertion; `tsc` is what evaluates it, and
       `npm run typecheck` is where it reds. This cell exists so the file contributes a
       runtime observation rather than a silent compile, and so the caveat in the header
       travels with the pin instead of living only in a handback. */
    expect([
      storedVocabularyIsExact,
      exportReExportsTheSameShape,
      releaseRecordCarriesTheShape,
    ]).toEqual([true, true, true]);
  });

  it("exports `MalformedVocabularyError` from the barrel, as an `Error` subclass", async () => {
    const Malformed = await malformedVocabularyError();
    expect(
      Object.create(Malformed.prototype) instanceof Error,
      `\`MalformedVocabularyError\` does not extend \`Error\`, so a route boundary that ` +
        `branches on \`instanceof Error\` will not see it.\n  ${PUBLISHED.malformedVocabularyError}`,
    ).toBe(true);
  });

  it("still exports `addRelease` from the same barrel", async () => {
    /* The control for the two cells above: a barrel that failed to load, or one this suite
       is pointed at by mistake, would red them for a reason that has nothing to do with
       T133. T010's name is the one that was already there. */
    const mod = await loadArchive();
    expect(typeof required(mod, "addRelease", PUBLISHED.addRelease)).toBe("function");
  });
});

describe("`lib/db/schema.ts`'s comment no longer documents the refused shape", () => {
  /*
   * D-133-02 F1 reclassifies the incident that created this task, against the orchestrator's
   * own record: `schema.ts:183` documents `local_vocabulary` as a bare `OntologyTerm[]` --
   * the shape both merged readers refuse -- so T130's blind author did not guess from
   * nothing. It read the only documentation there was and was directed by it.
   * *An unwritten interpretation invites a guess; a wrongly-written one directs it.*
   *
   * `lib/db/schema.ts` (comment only) is the first entry in this task's Owns and this is
   * the only cell that can observe it.
   *
   * The assertion EXCLUDES the bad output rather than admitting a good one: it requires the
   * array spelling to be gone, and does not require any particular replacement wording,
   * because the replacement is not published and pinning a sentence nobody wrote would be
   * this suite guessing in the one place the task is about not guessing.
   */
  const SCHEMA = fileURLToPath(new URL("../../../lib/db/schema.ts", import.meta.url));

  function localVocabularyDoc(): string {
    const source = readFileSync(SCHEMA, "utf8");
    const at = source.indexOf('localVocabulary: jsonb("local_vocabulary")');
    if (at < 0) {
      throw new Error(
        "`lib/db/schema.ts` no longer declares `localVocabulary: jsonb(\"local_vocabulary\")`, " +
          "so this cell cannot find the comment it is about. T133 owns this file for its " +
          "COMMENT only; a moved column is a different change.",
      );
    }
    /* The docblock immediately above the column, which is the one F1 quotes. */
    const before = source.slice(0, at);
    const start = before.lastIndexOf("/**");
    return start < 0 ? "" : before.slice(start);
  }

  it("does not describe the column as an array of terms", () => {
    const doc = localVocabularyDoc();
    expect(
      /OntologyTerm\s*\[\s*\]/.test(doc),
      "`lib/db/schema.ts`'s comment on `local_vocabulary` still says the column holds an " +
        "`OntologyTerm[]`. That is the shape both merged readers refuse, and D-133-02 F1 " +
        "records it as the line that directed T130's blind author to store a bare array. " +
        "Leaving it is leaving the task's own cause in place.\n" +
        `  comment: ${doc.trim()}`,
    ).toBe(false);
  });

  it("does not still say the overlay is what `ontology/extensions.yaml` is generated from", () => {
    /*
     * F1's second staleness, at `schema.ts:121-125`: under D-90-03 the export serves the
     * stored `text` verbatim and generates nothing, so a comment describing generation
     * describes a step that no longer exists. Scoped to the word `generated` beside the
     * file's name so it cannot match unrelated prose.
     */
    const source = readFileSync(SCHEMA, "utf8");
    const claims = source
      .split("\n")
      .map((line, i) => ({ line, at: i + 1 }))
      .filter(({ line }) => /generated from/.test(line) && /extensions\.yaml|overlay/.test(line));
    expect(
      claims,
      "`lib/db/schema.ts` still says `ontology/extensions.yaml` is GENERATED from the stored " +
        "overlay. D-90-03 made the export serve the stored `text` byte for byte precisely so " +
        "nothing is re-emitted, and D-133-02 F1 records this as the second way that file is " +
        "stale about this column.",
    ).toEqual([]);
  });
});
