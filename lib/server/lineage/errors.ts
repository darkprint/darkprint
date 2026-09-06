/* ============================================================
   DarkPrint backend — lineage: the fork's typed refusals
   D-13: no rejection this module produces carries a statement, a
   bound parameter or anything the caller did not itself submit.
   Every message below interpolates only the caller's own words —
   the slug it asked for, the version it named, the card name it
   chose and its own handle — and never the upstream's owner, its
   other slugs or its release list.

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
 * Which refusal, so a caller can map ten cases to six statuses without reading a
 * sentence. A closed union rather than a free string (D-14): a caller branches on it.
 *
 * **Four for `forkBundle` and six for `forkCard`, in ONE union and ONE class.** The two verbs
 * fork two different things and refuse for different reasons, but they answer through the
 * same `withLineageErrors`, and a second refusal class beside this one would mean a second
 * status map — which is the defect this module's `http.ts` header was written to refuse. The
 * card kinds say `card` in their names so a reader of a `kind` never has to know which verb
 * raised it.
 *
 * Two of the first four were charged as gaps before this module was written and both were
 * ruled rather than guessed, which is why they are here at all.
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
export type ForkRefusedKind =
  | "no-such-bundle"
  | "no-such-release"
  | "slug-taken"
  | "not-signed-in"
  | "no-such-card"
  | "no-such-card-version"
  | "card-id-taken"
  | "card-id-invalid"
  | "no-handle"
  | "unreadable-card";

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

/**
 * A fork is written on somebody's account, and an anonymous caller has none to write it on.
 *
 * `operation` defaults to `forkBundle` so that verb's published sentence is byte-identical to
 * the one it shipped with; `forkCard` passes its own name rather than raising a refusal that
 * blames the wrong function for a caller who reads the message.
 */
export function notSignedIn(operation = "forkBundle"): ForkRefusedError {
  return new ForkRefusedError("not-signed-in", `${operation}: not signed in.`);
}

/* --------------------- forkCard's six --------------------- */

/**
 * `forkCard`'s version of `noSuchBundle`, and it holds the same line for the same reason
 * (B-03): a card nobody stored and a card private to somebody else answer with one sentence,
 * so a caller cannot learn which ids exist by trying them. `fork-card.db.scratch.test.ts`
 * asserts the two messages are equal rather than merely both being refusals — a sentence
 * that started naming the id would still be a refusal and would still leak.
 */
export function noSuchCard(): ForkRefusedError {
  return new ForkRefusedError("no-such-card", "forkCard: no such card.");
}

/**
 * D-110-11's rule, applied to a card: the id is there and readable, the version is not.
 *
 * Raised only AFTER the read grant, so the extra precision is given to somebody who already
 * knew the card exists. Folding it into `no-such-card` would put a plausible wrong cause on
 * the red, and defaulting to the latest version instead would write a fork of a release the
 * caller never asked for — a wrong provenance, which is invisible where a refusal is loud.
 */
export function noSuchCardVersion(): ForkRefusedError {
  return new ForkRefusedError("no-such-card-version", "forkCard: no such card version.");
}

/**
 * The forker's own namespace already holds this id.
 *
 * ONE sentence for "already yours" and "somebody else got there first", deliberately.
 * `forkCard` only ever writes `<your handle>/<name>`, so both cases are about a name inside
 * the caller's own namespace and the caller may see it; two wordings would still be a
 * distinction worth nothing here, and the day the target id becomes freely choosable the
 * single sentence is what stops it becoming a probe for private cards.
 */
export function cardIdTaken(cardId: string): ForkRefusedError {
  return new ForkRefusedError("card-id-taken", `forkCard: \`${cardId}\` is already taken.`);
}

/**
 * The id the fork would land on is not one a DOT node could pin.
 *
 * `detail` is `validateCardId`'s or `validateNamespace`'s own sentence, passed through
 * unaltered behind this module's operation prefix (D-50-08's rule): the grammar belongs to
 * `lib/server/naming`, which derives it from the engine's `CARD_ID`, and re-wording it here
 * would give one rule two authors that drift apart. It quotes only the caller's own name and
 * the caller's own handle.
 */
export function cardIdInvalid(detail: string): ForkRefusedError {
  return new ForkRefusedError("card-id-invalid", `forkCard: ${detail}`);
}

/**
 * The forker has no handle, so there is no namespace to fork into.
 *
 * A real state rather than a defensive branch: T050 AC1 rules a handle-less account legal
 * and `PublicAuthor.handle` is nullable for that reason. 403 rather than 401 (see `http.ts`):
 * the caller is signed in, and what is missing is something only they can supply.
 */
export function noHandle(): ForkRefusedError {
  return new ForkRefusedError("no-handle", "forkCard: this account has no handle yet.");
}

/**
 * The stored body does not satisfy today's `NodeCard`, so there is nothing to copy.
 *
 * The rows this describes are real and were counted: on 2026-08-31 all 58 stored bodies
 * carried `requiresHuman` and none carried `willNot` (`cards/stored-card.ts`). Forking one
 * would either store a body the schema forbids or paper the gap over with defaults, and a
 * `willNot: []` invented here would make the fork claim it undertakes nothing.
 *
 * `detail`, when given, is one of THIS module's own literals and never a value read off the
 * row: `storedCard` answers `undefined` rather than throwing precisely so a caller can say
 * something better than "not found", and the second sentence is that. The gap list
 * `storedCardGaps` would give is deliberately not carried here — `CardRecord` holds the READ
 * body and not the raw jsonb, so this layer has no object left to ask about, and inventing a
 * plausible list would be worse than the shorter true sentence.
 */
export function unreadableCard(detail?: string): ForkRefusedError {
  return new ForkRefusedError(
    "unreadable-card",
    `forkCard: the stored card cannot be read under the current schema.${detail === undefined ? "" : ` ${detail}`}`,
  );
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
