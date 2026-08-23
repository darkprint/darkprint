/* ============================================================
   DarkPrint backend — lineage: the fork's typed refusals
   D-13: no rejection this module produces carries a statement, a
   bound parameter or anything the caller did not itself submit.
   Every message below interpolates only the caller's own words —
   the slug it asked for and the version it named — and never the
   upstream's owner, its other slugs or its release list.

   `declare` plus `defineProperty`, and `name` on the prototype
   rather than in the constructor, both so the enumerable surface
   stays empty: the hygiene clause is that `Object.keys(err)` is
   `[]` and `JSON.stringify(err)` is exactly `"{}"`, and a
   constructor assignment makes its property enumerable.
   `ArchiveConflictError` shipped that bug once and records the
   reasoning; this class is written from its correction rather
   than from its original.
   ============================================================ */

/**
 * Which refusal, so a caller can map four cases to three statuses without reading a
 * sentence. A closed union rather than a free string (D-14): a caller branches on it.
 *
 * Two of the four were charged as gaps before this module was written and both were ruled
 * rather than guessed, which is why they are here at all.
 *
 * **`no-such-release` is D-110-11.** The block admits two message forms and `from` carries a
 * required `version`, so a version the upstream never released had no published answer.
 * Folding it into `no-such-bundle` would put a plausible wrong cause on a red — the bundle is
 * there and the caller may read it. Leaving it silent is worse: a fallback to the latest
 * release satisfies AC1 by writing a true statement about the WRONG release, and a wrong
 * provenance is invisible where a refusal is loud.
 *
 * **`not-signed-in` is D-110-10, and it is where `can` and the operation disagree.**
 * `can(anonymous, "read", publicBundle)` is `true`, so an agreement-with-`can` reading
 * predicts success — and success means a `bundle` row owned by nobody, since a fork is an
 * ownership change and `bundle.owner_id` is not nullable. The read half and the ownership
 * half of this operation answer differently. Refused. Unreachable through HTTP, where
 * `withSession` answers 401 first, so it is a module-boundary refusal only.
 */
export type ForkRefusedKind = "no-such-bundle" | "no-such-release" | "slug-taken" | "not-signed-in";

export class ForkRefusedError extends Error {
  declare readonly kind: ForkRefusedKind;

  constructor(kind: ForkRefusedKind, message: string) {
    super(message);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

ForkRefusedError.prototype.name = "ForkRefusedError";

/**
 * AC6, and it is a 404 rather than a 403 on purpose (B-03): a bundle the caller may not
 * read and a bundle that is not there answer identically, because a distinct refusal for
 * "you may not" would confirm which handles and slugs exist to anybody who asks.
 *
 * It names nothing the caller submitted either. The block's form is the bare sentence, and
 * quoting `<handle>/<slug>` back would be harmless in itself but would make the two cases
 * distinguishable by anyone who tried a handle that does not exist against one that does.
 */
export function noSuchBundle(): ForkRefusedError {
  return new ForkRefusedError("no-such-bundle", "forkBundle: no such bundle.");
}

/**
 * D-110-11's ratified form, and it is a bare sentence rather than the interpolated one this
 * module shipped first.
 *
 * `"forkBundle: no such bundle."` would be FALSE here — the bundle exists and the caller may
 * read it — so the two refusals are separate. Why it cannot be silent instead: a fallback to
 * the upstream's latest release **satisfies AC1 by writing a true statement about the wrong
 * release**, since lineage would name a release the caller never asked for. A wrong
 * provenance is invisible where a refusal is loud.
 */
export function noSuchRelease(): ForkRefusedError {
  return new ForkRefusedError("no-such-release", "forkBundle: no such release.");
}

/** The block's second form. The caller's own slug, in the caller's own namespace, which is theirs to see. */
export function slugTaken(slug: string): ForkRefusedError {
  return new ForkRefusedError("slug-taken", `forkBundle: \`${slug}\` is already yours.`);
}

/** A fork is written on somebody's account, and an anonymous caller has none to write it on. */
export function notSignedIn(): ForkRefusedError {
  return new ForkRefusedError("not-signed-in", "forkBundle: not signed in.");
}

/* --------------------- the fault path --------------------- */

/**
 * A read this module issues against Postgres failed.
 *
 * **Scoped to `store.ts`'s two queries and to nothing else, and the narrowness is the
 * point.** Every other database call this module makes goes through `@/lib/server/archive`,
 * `@/lib/server/accounts` or `@/lib/server/cards`, each of which already sanitizes its own
 * faults and authors its own decisions. A wrapper drawn around a whole verb would convert
 * those decisions too — `createBundle`'s D-12 refusal of a slug carrying an unpaired
 * surrogate is a plain `Error` and a fact about the caller's submission, and dressing it as
 * a store fault would answer 500 for a 400. So the boundary sits at the only place this
 * module talks to the driver directly, which is the only D-13 hole it actually opens.
 *
 * `message` is `` `${operation}: the lineage store failed.` `` and nothing else — the
 * convention `archive/errors.ts` and `registry/errors.ts` already ship (D-81-01). `operation`
 * is always a literal this module supplies, never a value a caller sent, so the message is
 * safe by construction rather than by a scan. The driver error travels on `cause`, installed
 * non-enumerably by the ES2022 option rather than by anyone remembering `defineProperty`.
 */
export class LineageStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the lineage store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(LineageStoreError.prototype, "name", {
  value: "LineageStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
