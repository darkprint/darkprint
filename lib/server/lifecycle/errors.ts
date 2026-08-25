/* ============================================================
   DarkPrint backend — lifecycle: typed refusals and the sealed
   store fault
   D-13: no rejection may carry the failed statement or its bound
   parameters, and on this module that is not
   optional-by-construction. Every statement here binds a
   `bundle_id`, an `owner_id` or an `account_id`, and the deletion
   path binds them across six tables — so a `DrizzleQueryError`
   raised by any of them renders the acting account, the
   recipient's account id and the bundle's identity into its own
   message. `LifecycleStoreError` is what stands between those
   values and a caller.

   ── the store class is NOT in the Published signatures block,
      and that is reported rather than taken quietly ──
   T120's block lists four functions and two types. It publishes
   no store class, exactly as T050's, T100's and T180's blocks
   published none and all three shipped one, because a module that
   touches Postgres and does not seal its faults leaks a statement
   on its first outage. The noun follows D-WAVE-12's SINGULAR
   derivation from the module folder — `lifecycle` ->
   `` `<operation>: the lifecycle store failed.` ``.

   ── the two refusal classes ARE published, and D-120-03 ruled
      the five sentences the block was missing ──
   The block admits two forms; F-120-D charged five refusal paths
   reachable through the four published verbs with no sentence at
   all, and D-120-03 published them rather than leaving a blind
   author to bind a refusal to `undefined` — D-180-06's measured
   defect, where `rejects.toThrow(undefined)` passed on any throw.
   All seven live below and nowhere else.

   **`<operation>` is a parameter on every one of them, including
   the two the block writes as literals**, and that is a
   generalisation reported rather than taken quietly. D-120-03
   writes three of its five with `<operation>` and two with a
   verb's name baked in; but D-120-12's K rules that *both `plan*`
   verbs authorize as their verbs do*, so `planTransfer` and
   `planDeletion` reach the anonymous and the not-the-owner arms
   too and have no sentence of their own. Parameterising is what
   gives them one. **At the operation each literal was published
   under, the rendered string is byte-identical to the block's** —
   `transferBundle: a transfer needs an account.` and
   `deleteAccount: not this account's owner.` — so an exact-match
   pin on either published form is unaffected.

   **A transfer to a TOMBSTONED recipient answers `no account
   holds `<handle>`.`, and that is a reading rather than an eighth
   sentence.** D-120-01's B2 keeps `handle` on the tombstone and
   refuses transfers into it, detected by the `deleted:` prefix on
   `github_id`; it publishes no wording. A deleted account holds
   nothing, and answering it identically to a handle nobody ever
   had is B-03 one layer down — a distinct refusal would tell any
   caller which handles are graves.

   None of the constants below is exported. A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and goes on passing the day the
   wording starts interpolating something it should not.
   ============================================================ */

/**
 * A lifecycle read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the lifecycle store failed.` `` and nothing else. The
 * driver error travels on `cause`, which carries the statement, every bound id and the
 * SQLSTATE — all of it, and all of it non-enumerable.
 *
 * `cause` is required and passed through the ES2022 option, so the property is installed
 * non-enumerably by the language rather than by anyone remembering `Object.defineProperty`.
 * Passing `undefined` still installs it, which is what keeps the one- and two-argument
 * shapes rendering identically — `tests/error-hygiene.test.ts` constructs at both arities
 * for exactly that reason.
 */
export class LifecycleStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the lifecycle store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow
   (`tests/error-hygiene.test.ts`, D-13's hygiene clause). */
Object.defineProperty(LifecycleStoreError.prototype, "name", {
  value: "LifecycleStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * Which transfer refusal, so a caller can map five cases to four statuses without reading a
 * sentence. A closed union rather than a free string (D-14): a caller branches on it, and
 * D-120-03 sanctions the shape explicitly, after T110's `ForkRefusedKind`.
 *
 * `not-signed-in` is D-110-10's case arriving here unchanged: `can(anonymous, "read",
 * publicBundle)` is `true`, so an agreement-with-`can` reading predicts success — and success
 * means a `bundle` row owned by nobody, since `bundle.owner_id` is not nullable. The read
 * half and the ownership half of this operation answer differently. Unreachable through HTTP,
 * where `withSession` answers 401 first, so it is a module-boundary refusal only.
 *
 * `no-such-handle` covers a handle nobody ever held AND a handle now on a tombstone, for the
 * reason `no-such-bundle` covers absent and unreadable together: a distinct refusal would
 * publish which accounts are deleted.
 */
export type TransferRefusedKind =
  | "no-such-bundle"
  | "not-owner"
  | "no-such-handle"
  | "not-signed-in"
  | "slug-taken";

/** Which deletion refusal. Two, because an anonymous actor is simply not this account's owner. */
/* `no-such-bundle` and `bundle-published` joined at the owner's per-bundle delete
   (2026-08-25): the first is `transferBundle`'s own B-03 collapse applied to a delete, the
   second is D-120's published-stays sentence enforced at the single-bundle grain. */
export type DeletionRefusedKind =
  | "no-such-account"
  | "not-owner"
  | "no-such-bundle"
  | "bundle-published";

/**
 * `transferBundle` or `planTransfer` declined the move, and nothing moved.
 *
 * The message is supplied whole by the constructor functions below rather than assembled from
 * parts by a caller. A constructor that took a handle and a slug would be a constructor
 * somebody later interpolates an account id into; taking the finished sentence keeps every
 * admissible form in one file where they can be read together, and keeps this class unable to
 * render anything nobody wrote down. Same construction as `RunReportRefusedError` (T180).
 *
 * `kind` is installed non-enumerably and `declare`d, so it is readable and branchable while
 * `Object.keys(err)` stays `[]` — `ForkRefusedError`'s shape, written from its correction.
 */
export class TransferRefusedError extends Error {
  declare readonly kind: TransferRefusedKind;

  constructor(kind: TransferRefusedKind, message: string) {
    super(message);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow
   (`tests/error-hygiene.test.ts`, D-13's hygiene clause). */
Object.defineProperty(TransferRefusedError.prototype, "name", {
  value: "TransferRefusedError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * `deleteAccount` or `planDeletion` declined, and nothing was destroyed.
 *
 * This class exists for the reason D-140-02 gives about `void` returns: `deleteAccount`
 * answers `Promise<void>`, and `void` cannot express *denied*. A refusal that silently did
 * nothing would tell its caller the account was gone — on the one irreversible operation in
 * the registry, which is the worst place in the tree for a write to fail quietly.
 */
export class DeletionRefusedError extends Error {
  declare readonly kind: DeletionRefusedKind;

  constructor(kind: DeletionRefusedKind, message: string) {
    super(message);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

Object.defineProperty(DeletionRefusedError.prototype, "name", {
  value: "DeletionRefusedError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/* --------------------- the seven admissible renderings --------------------- */

/**
 * D-120-03, first form. **One sentence for absent AND for unreadable**, which is B-03: a
 * distinct refusal for *you may not read this* would confirm which bundle ids exist to
 * anybody who tried one.
 *
 * The id is the caller's own submission handed straight back — it tells a caller nothing it
 * did not type, and it names no owner, no slug and no handle.
 */
export function refusedNoSuchBundle(operation: string, bundleId: string): TransferRefusedError {
  return new TransferRefusedError("no-such-bundle", `${operation}: no bundle at \`${bundleId}\`.`);
}

/**
 * D-120-03, second form. Raised only AFTER the read grant, so a caller who may not read this
 * bundle never learns from the wording that it exists and belongs to somebody else — it gets
 * `no-such-bundle` first. Names nobody: not the real owner, not the caller.
 */
export function refusedNotBundleOwner(operation: string): TransferRefusedError {
  return new TransferRefusedError("not-owner", `${operation}: only the owner may transfer a bundle.`);
}

/**
 * D-120-03, third form, and it also carries D-120-01's B2 refusal of a transfer into a
 * tombstone.
 *
 * **Not an oracle, and the ruling says why**: `GET /api/names/slugs/[owner]/[slug]` is
 * unauthenticated, merged, and already publishes whether a handle resolves to an account. The
 * bit is public; this sentence adds none.
 */
export function refusedNoSuchHandle(operation: string, handle: string): TransferRefusedError {
  return new TransferRefusedError("no-such-handle", `${operation}: no account holds \`${handle}\`.`);
}

/**
 * D-120-03, fourth form, in D-180-03's construction: raised BEFORE any write, so no caller
 * ever sees a constraint violation for a state that is structurally unstorable —
 * `bundle.owner_id` is `NOT NULL` and an anonymous actor has no id to put in it.
 *
 * At `operation === "transferBundle"` this renders the block's literal byte for byte.
 */
export function refusedTransferNeedsAccount(operation: string): TransferRefusedError {
  return new TransferRefusedError("not-signed-in", `${operation}: a transfer needs an account.`);
}

/**
 * AC3, in the block's own published form.
 *
 * **Both interpolations are the caller's own submission.** `handle` is the `toHandle` it
 * passed and `slug` is its own bundle's, so the sentence tells a caller nothing it did not
 * already have in hand. The one bit it adds — that the recipient holds that slug — is already
 * answered to anybody at all by `GET /api/names/slugs/[owner]/[slug]`. D-140-06's rule (the
 * operation and the caller's own field name, never a caller's own value) is widened here by
 * the block itself, which writes both values out.
 *
 * The prefix is the literal `transferBundle`, not a parameter: `planTransfer` never raises
 * this one — it reports `collides` as a value, which is the whole reason the two `plan*`
 * verbs exist (AC3 needs a surface observable without performing the act).
 */
export function refusedForSlugCollision(handle: string, slug: string): TransferRefusedError {
  return new TransferRefusedError(
    "slug-taken",
    `transferBundle: \`${handle}\` already has a bundle at \`${slug}\`.`,
  );
}

/**
 * D-120-03, fifth form. Raised only after authorization has already granted, so it is
 * reachable by an owner asking about their own id and by an operator, never by a stranger
 * fishing — a stranger is refused by `refusedAsNotOwner` without a row ever being read.
 */
export function refusedNoSuchAccount(operation: string, accountId: string): DeletionRefusedError {
  return new DeletionRefusedError("no-such-account", `${operation}: no account at \`${accountId}\`.`);
}

/**
 * The block's deletion refusal.
 *
 * Names nobody and nothing: not the account id it was asked about, not the actor's own. An
 * ownership refusal that echoed an id would be an existence oracle over `account`, which is
 * the one table `can` guards as owner-only for every action (`policy/can.ts`'s
 * `canOnAccount`). At `operation === "deleteAccount"` this renders the block's literal byte
 * for byte.
 */
export function refusedAsNotOwner(operation: string): DeletionRefusedError {
  return new DeletionRefusedError("not-owner", `${operation}: not this account's owner.`);
}
