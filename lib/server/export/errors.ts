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

/**
 * A read against Postgres failed for a reason that is not "no such row".
 *
 * **A sibling of `ExportError`, deliberately not a subclass** (D-90-A). The two are
 * different kinds of fact and the route reads the difference: `ExportError` is a fact
 * about the *release* — absent, invisible, refused — and maps to 404; this is a fact
 * about the *infrastructure* and must reach the caller as a 500. Sharing the type made
 * a Postgres outage answer 404 under a comment saying it must not, and made the same
 * outage answer 404 or 500 depending on which statement failed first, since a driver
 * error raised inside `resolveCardRef` or `openView` was never wrapped at all. (`openView`
 * issues no statement now and cannot be the site of an outage; `resolveCardRef` still can.)
 *
 * The three harms were not cosmetic: alerting on 5xx reads an outage as traffic to
 * missing files; B-03 reserves 404 for absent-or-invisible so existence does not leak,
 * and a 404 for "the database is down" widens it with no way for a caller to tell; and
 * **a client holding a pinned digest concludes the release was withdrawn and stops
 * retrying**, where a 500 tells it to retry. The one reference AC6 promises never moves
 * is the one an outage made look deleted.
 *
 * Extending `Error` rather than `ExportError` is what makes the route's `instanceof`
 * correct **by construction** instead of by anyone remembering to check a second class.
 */
export class ExportReadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
  }
}

Object.defineProperty(ExportReadError.prototype, "name", {
  value: "ExportReadError",
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

/* There is no `unpublishedOntologyVersion`. It rendered "exportRelease: the ontology version
   this release names is not published." for the case where a release's manifest named a
   version nobody had published (B-08's stamp dangling). A manifest names no version, and
   `openView` merges over `CORE_ONTOLOGY` without reaching a store, so the condition it
   reported cannot arise and a form for it would be a sentence no caller can ever be handed.
   Deleted rather than left unreachable: `build.ts` is the only site that raised it and its
   own comment records what the two removed arms were for. */

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
 * The eighth message form, and the one a caller never sees.
 *
 * Named for the **module** rather than for a verb, which is the correction that came with
 * D-90-A: `bundleById`, `bundleByHandle` and `resolveRelease` are reached from
 * `exportRelease` *and* from `serveFile`, so `"exportRelease: …"` was simply false on the
 * serving path — a literal whose truth depended on which entry point happened to call.
 * Threading an operation string would make the pin depend on that too.
 *
 * It is invisible to the published-message surface by construction, not by wording: this
 * is an `ExportReadError`, the route rethrows it, and the caller gets a generic 500 with
 * no body from here. The message goes to logs, for an operator. The driver error opens
 * with the whole statement and every bound parameter; it travels on `cause`, never in the
 * message, and `cause` is non-enumerable.
 */
export function readFailed(cause?: unknown): ExportReadError {
  return new ExportReadError("export: reading this release failed.", cause);
}
