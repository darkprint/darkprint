/* ============================================================
   DarkPrint backend — lib/server/export typed refusals
   The error-hygiene clause (backend.md, "How this run is
   governed" -> the `Object.keys`/whitelist amendment), applied
   the way `lib/server/cards/errors.ts` applies it: `Object.keys
   (err)` empty and `JSON.stringify(err)` exactly `"{}"`; `cause`
   present but non-enumerable (the ES2022 Error-cause option makes
   it so by spec); `stack` retained. Whitelist, not blacklist —
   every rendering may carry only a fixed message naming the
   operation. Nothing read off a driver error, off a diagnostic,
   or off the caller's own path reaches an enumerable output;
   `cause` carries all of it and is exactly what non-enumerable
   hides.

   ── Why every message below is a bare literal ──
   The block's `serveFile` form permits echoing the path the
   caller asked for. Permitted is not required, and interpolating
   it would make the message stop equalling the published string —
   which is the one pin a blind author can write by exact match,
   and the enforcement clause says an exact-match pin is the whole
   point. So the two published forms are reproduced character for
   character and the five unpublished ones are literals too, so
   they can be pinned the same way the day they are published.

   ── Why these constants are not re-exported from the barrel ──
   A test that imports the expected message from the module under
   test asserts that the module agrees with itself, and passes
   unchanged if the template starts interpolating something it
   should not. Keeping them here means a suite has to hardcode.
   ============================================================ */

export class ExportError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

// On the prototype, not as an instance field: a `readonly name = "..."` class field
// would itself be an own instance property, which the `Object.keys`/`JSON.stringify`
// invariants above do not allow.
Object.defineProperty(ExportError.prototype, "name", {
  value: "ExportError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/* --------------------- the two published forms --------------------- */

/**
 * Every way `exportRelease` can fail to find a release answers with this one sentence:
 * an unparseable bundle id, a bundle that does not exist, a bundle the actor may not
 * see, and a digest naming no release of it. B-03 requires 404 over 403 so existence
 * does not leak, and a distinct message for "it exists but is not yours" reinstates
 * exactly the leak the status code closed.
 */
export function noSuchRelease(cause?: unknown): ExportError {
  return new ExportError("exportRelease: no such release.", cause);
}

/**
 * AC7's refusal. Reached only after the release resolved and the actor was allowed to
 * read it, so it tells the caller nothing they were not already granted — and it names
 * no file the release *does* contain, since that is a listing they have not been given.
 */
export function noSuchFile(): ExportError {
  return new ExportError("serveFile: no such file in this release.");
}

/* --------------------- five forms this task needs and the block does not publish --------------------- */
/* Reported to the orchestrator as D-90-02 before a line of this module was written,
   under this file's own rule that a message form written after the implementation is
   the contract following the code. Wording is mine and is meant to be overruled. */

/** `loadBundle` returned no blueprint, or returned one with error-severity diagnostics. */
export function releaseDoesNotResolve(cause?: unknown): ExportError {
  return new ExportError("exportRelease: this release does not resolve.", cause);
}

/**
 * AC4. Checked here rather than at publish, because a release stored before a lint rule
 * changed would otherwise be served unchecked forever. The diagnostics are not in the
 * message: they quote node ids and source spans, and this refusal is the one path where
 * the caller is being told the artefact is broken rather than being handed it.
 */
export function factoryDotRejected(): ExportError {
  return new ExportError("exportRelease: the emitted factory.dot is not valid Attractor input.", undefined);
}

/**
 * A card the release pins is not readable by this actor (B-07 allows a private card,
 * and a public bundle may pin one). Refused rather than served with a hole: `exportBundle`
 * throws on a pinned card its input does not carry, and a folder short a card resolves
 * to neither of the two scores its own README quotes.
 *
 * The ref is deliberately absent from the message. Which cards a release pins is a
 * listing, the folder that would have carried it is exactly what is being withheld, and
 * a private card's id is the one identifier here the caller did not supply.
 */
export function pinnedCardUnavailable(): ExportError {
  return new ExportError("exportRelease: a card this release pins is unavailable.", undefined);
}

/** The ontology version the release's manifest names is not published (B-08's stamp is dangling). */
export function unpublishedOntologyVersion(cause?: unknown): ExportError {
  return new ExportError("exportRelease: the ontology version this release names is not published.", cause);
}

/**
 * `release.local_vocabulary` held something that is not `{ text, terms }`.
 *
 * The column is `jsonb` and the shape is T100's to write (D-90-03), so a release stored
 * before that amendment carries bare terms and no bytes. Refused rather than re-emitted:
 * a folder whose `ontology/extensions.yaml` was reconstructed from parsed terms is not
 * the document the site scored, and the Contract's word for that file is *verbatim*.
 */
export function malformedStoredVocabulary(cause?: unknown): ExportError {
  return new ExportError("exportRelease: this release's stored vocabulary is not a term list.", cause);
}

/* --------------------- and one this task deliberately does not have --------------------- */
/* There is no failure form for B-14's download event. Ruled at `a037587`: a counter
   write that fails must not deny a legitimate download. The serve succeeds, the count
   is lost, and the failure is audited through T240 — which is unmerged, so it is
   logged here and nothing more. See `downloads.ts`. */

/**
 * A read this module made against Postgres failed for a reason that is not "no such row".
 *
 * The driver error opens with the whole statement and every bound parameter; it travels
 * on `cause` and never in the message.
 */
export function readFailed(cause?: unknown): ExportError {
  return new ExportError("exportRelease: reading this release failed.", cause);
}
