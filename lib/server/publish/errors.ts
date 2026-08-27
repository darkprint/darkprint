/* ============================================================
   DarkPrint backend — publish: the one typed refusal
   backend.md T100. Five refusal shapes behind ONE class carrying a
   `kind`, because the UI writes three different sentences from them
   (`components/upload/UploadFlow.tsx:1176-1201`) and a generic
   refusal satisfies "is refused" while losing the sentence the page
   needs.

   The message forms are the contract's admissible list, transcribed
   rather than paraphrased. What may appear in one is closed: the
   operation, the `kind`, counts of the caller's OWN submission, and
   version strings the caller either sent or already owns. **No
   diagnostic text from the engine reaches a message** — diagnostics
   travel in the 200-with-diagnostics envelope (B-03), and a refusal
   that inlines them is a second rendering of the same content in a
   place the whitelist has to police separately.

   D-13's hygiene clause, and this class is written from
   `ArchiveConflictError`'s CORRECTION rather than from its original:
   that class shipped `kind` as a constructor assignment, which is
   always enumerable, and rendered as
   `{"name":"ArchiveConflictError","kind":"bundle-slug"}` while three
   sibling classes rendered as `{}` (`lib/server/archive/errors.ts:18-40`).
   `declare` plus `defineProperty` here, `name` on the prototype, so
   `Object.keys(err)` is `[]` and `JSON.stringify(err)` is exactly
   `"{}"`. `kind` stays readable and `instanceof` is untouched; only
   its appearance in a rendering changes, which is the whole clause.

   `tests/error-hygiene.test.ts` constructs every published class
   with `["probe detail"]` and with a second driver-shaped argument
   (its `SHAPES`, line 189), so the constructor has to tolerate both
   arities without throwing — an unconstructible class is one that
   guard reports as UNMEASURED rather than skipping.
   ============================================================ */

/**
 * Which refusal this is. A closed union rather than a free string, for the same reason
 * `ArchiveConflictKind` is one (D-14): a caller branches on it, and the three sentences the
 * upload page writes are selected by it, so the set has to be checkable rather than whatever
 * a call site happened to pass.
 *
 * `unfinished` and `in-error` are not two readings of one state. `unfinished` is a folder
 * still being written — the topology parsed and some node has no card yet — and `in-error`
 * is a contradiction between two things the author did write. That distinction is
 * `bundleProgress`'s and is consumed, never re-derived here: doc 2 §1.1 is about not making
 * somebody feel penalised for the state their graph is honestly in.
 */
export type PublishRefusedKind =
  | "unfinished"
  | "in-error"
  | "conflict"
  | "not-owner"
  | "version-not-higher";

export class PublishRefusedError extends Error {
  declare readonly kind: PublishRefusedKind;

  constructor(kind: PublishRefusedKind, detail: string) {
    super(detail);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

PublishRefusedError.prototype.name = "PublishRefusedError";

/**
 * AC1. The counts are `bundleProgress`'s `placed` and `total`, which are
 * `blueprint.nodes.length` and `blueprint.graph.ids.length` — what resolved against what the
 * DOT declared. An error COUNT is deliberately not offered here: an unfinished folder has
 * errors, they are all the shadow of a card nobody has written yet, and reporting them as a
 * fault is the reading `progress.ts` exists to prevent.
 */
export function unfinished(placed: number, total: number): PublishRefusedError {
  return new PublishRefusedError("unfinished", `publish: unfinished — ${placed} of ${total} nodes carded.`);
}

/**
 * AC2, and the obligation is this task's rather than the persistence layer's: T010 cannot
 * decide it, because deciding it needs full card bodies and an `OntologyView` from T020 and
 * T030, both Forbidden there. The gate lives here, where the bundle has already been resolved.
 *
 * The count only. The diagnostics themselves are the envelope's.
 */
export function inError(errorCount: number): PublishRefusedError {
  return new PublishRefusedError("in-error", `publish: in-error — ${errorCount} errors.`);
}

/**
 * AC6, and `version` is the version the EXISTING release holds, not the one the caller
 * declared. That is what makes the refusal actionable: the caller learns these bytes are
 * already published and under which version, which a refusal naming their own submission
 * would not tell them. It is a version this owner already owns, so the whitelist admits it.
 *
 * Detected by digest and never by version, which is why the digest is computed before the
 * write is attempted rather than being left to `addRelease`'s unique index.
 */
export function conflict(version: string): PublishRefusedError {
  return new PublishRefusedError("conflict", `publish: conflict — release \`${version}\` already holds these bytes.`);
}

/**
 * AC7. No identifier at all, and that is B-03's 404-over-403 rule one layer down: naming the
 * owner, the slug or the actor would confirm the bundle exists to somebody who may not
 * publish to it, which is the leak the status code closes.
 */
export function notOwner(): PublishRefusedError {
  return new PublishRefusedError("not-owner", "publish: not-owner — not this bundle's owner.");
}

/**
 * AC8. Both version strings are the caller's: `declared` is what this submission sent and
 * `previous` is what its own bundle already holds.
 *
 * "not higher" rather than "lower", and the wording is load-bearing: it admits EQUAL, so
 * re-declaring the version of an existing release is refused here with the version strings
 * in hand rather than reaching `addRelease` and coming back as an `ArchiveConflictError`
 * that names a constraint instead of the two versions.
 */
export function versionNotHigher(declared: string, previous: string): PublishRefusedError {
  return new PublishRefusedError(
    "version-not-higher",
    `publish: version-not-higher — \`${declared}\` is not higher than \`${previous}\`.`,
  );
}

/**
 * B2/D-100-01: a pinned card version the store already holds with DIFFERENT content.
 *
 * Folded into `conflict` rather than given a sixth kind, because the whitelist asserts five.
 * **It needs a second admissible message form under that kind** — the release form above says
 * "release `<version>` already holds these bytes", which is simply false about a card — and
 * the addition is reported rather than assumed.
 *
 * The failure it refuses is quiet and permanent: the release digest is computed over the
 * SUBMITTED card bytes while the export rebuilds the folder from `card_version.source`
 * (`lib/server/export/build.ts`), so letting the stored row win would ship a folder that does
 * not hash to the digest printed inside it, on a release that looks entirely healthy.
 *
 * `ref` is `id@version` and is the caller's own submission, so the whitelist admits it. No
 * digest appears: neither the stored one nor the submitted one is content the caller sent,
 * and naming the stored one would describe a row this caller may not be allowed to read.
 */
export function cardConflict(ref: string): PublishRefusedError {
  return new PublishRefusedError(
    "conflict",
    `publish: conflict — card \`${ref}\` is already published with different content.`,
  );
}
