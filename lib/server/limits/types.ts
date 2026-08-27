/* ============================================================
   DarkPrint backend — limits: the two published shapes
   Here rather than beside the function that produces them, and
   the reason is a cycle rather than taste.

   `errors.ts` needs `LimitVerdict`, because `rateLimitedError`
   takes the whole verdict (D-230-10) rather than four numbers a
   caller could assemble inconsistently. `check.ts` needs
   `errors.ts`, because `enforceLimit` throws. With the interface
   living in `check.ts` those two import each other — erased at
   runtime today, since one direction is `import type`, and
   one value import away from being a real cycle that nothing in
   the type system would have warned about.

   A file with no imports of its own cannot participate in one.
   ============================================================ */

/**
 * The published verdict. `remaining` is what is left AFTER the request being judged.
 *
 * **`windowMs` is D-230-10 and it is CARRIED rather than fetched.** The admissible form
 * renders `<window>`, and the alternative was a fourth parameter on `rateLimited` with a
 * published `windowFor(subject, bucket, config)` to supply it. Both spellings refuse to
 * compile when the window is absent, so compile-time safety is not what separates them.
 *
 * What separates them is that **a caller able to fetch the window separately can pass one
 * that disagrees with the verdict it is rendering** — and the form is EXACT-MATCHED, so the
 * result would be exactly and confidently wrong, with nothing comparing the two operands.
 * One object, one source, and the disagreement has nowhere to live.
 *
 * It is the CONFIGURED length, never the time left in the window. `resetAt − now` is the
 * remainder, so a caller refused thirty seconds into a sixty-second ceiling would read
 * "limit of 60 per 30 seconds" — an adjacent quantity inside an exact-matched sentence.
 */
export interface LimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  windowMs: number;
}

/**
 * The phantom member that makes `ResolvedKey` unforgeable, and it is `declare` so it never
 * exists.
 *
 * A `unique symbol` that nothing exports is a member no other file can name, so no other
 * file can write an object literal that satisfies `ResolvedKey`. Ambient, so it is erased
 * before any output: there is no property to enumerate, nothing for a leak scan to trip
 * over, and no cost at a call.
 */
declare const RESOLVED_KEY: unique symbol;

/**
 * An `ApiKeyRecord` that `resolveKey` answered with, and a type only `resolveKey` produces.
 *
 * **The brand proves PROVENANCE and it does not prove non-revocation** (D-231-01, amended).
 * `resolveKey`'s `WHERE` carries `isNull(revokedAt)` and that clause is the whole of why a
 * value of this type names a live key — so the type says *this came out of that query*, and
 * says nothing the type system could not check.
 *
 * The narrowed spelling, `revokedAt: null` on the interface, was published and then
 * withdrawn: TypeScript cannot verify non-revocation, so that member could only ever be
 * produced by a cast — a claim nothing checks, sitting where every later reader would read
 * it as a guarantee the type provides. It would also have made the one mutation that has
 * ever measured `isNull(revokedAt)` inert, trading the instrument for the guard.
 *
 * What it does buy is the thing caller discipline was holding. `listKeys` returns
 * `ApiKeyRecord[]` **including revoked rows**, deliberately, because `revokedAt` moving from
 * `null` to an instant is AC4's only HTTP-observable form. Those records are structurally
 * identical to `resolveKey`'s, so before this brand a caller could hand one straight to
 * `checkLimit` and buy the key tier's ceiling with a key that had been revoked. Now that is
 * a compile error, as is a bare `keyId` string that no `resolveKey` ever answered.
 */
export type ResolvedKey = ApiKeyRecord & { readonly [RESOLVED_KEY]: true };

/**
 * The published subject: one of three shapes, never a record with nullable holes.
 *
 * **A union rather than `{ accountId, keyId, ip }`, and the tier is carried rather than
 * derived.** The old record let a caller fill any combination of two nullable fields and had
 * `tierOf` decide what that meant, which is how a `keyId` no `resolveKey` ever produced
 * bought the key tier's ceiling. Here the identifier that decides the tier is the only one
 * the shape admits, so the tier and the identifier cannot disagree.
 *
 * **A keyed subject carries `accountId` exactly once**, inside its `ResolvedKey`. The
 * declined alternative kept `accountId` beside the key as well, which is two sources for one
 * quantity — the shape D-230-10 forecloses one file over at `windowMs`, for the same reason:
 * nothing would compare the two, so a disagreement would be exactly and confidently wrong.
 *
 * D-230-08's attribution survives intact and is now sourced rather than asserted: a keyed
 * subject's `key.keyId` and `key.accountId` are the row's own, and whoever writes the audit
 * row reads them off a record that came out of the database rather than off two strings a
 * caller assembled.
 */
export type LimitSubject =
  | { readonly tier: "anonymous"; readonly ip: string }
  | { readonly tier: "account"; readonly accountId: string; readonly ip: string }
  | { readonly tier: "key"; readonly key: ResolvedKey; readonly ip: string };

/**
 * What `GET` and `DELETE` on `app/api/account/keys` answer (D-230-11).
 *
 * `ApiKeyRecord` carries `revokedAt` and has no field a secret could occupy, **so listing is
 * safe by construction rather than by a filter somebody must remember not to drop.** That is
 * the same argument the record's own shape makes: a rule nobody can forget beats a rule
 * everybody is told.
 *
 * Revoked keys are INCLUDED rather than filtered. AC4 is *a revoked key is refused
 * immediately*, and with a 204 `DELETE` and no reader that criterion had **no
 * HTTP-observable form at all** — nothing a caller could look at said the key had stopped
 * working. `revokedAt` moving from `null` to an instant is that observation, and hiding the
 * row would take it away again.
 */
export interface KeyList {
  keys: readonly ApiKeyRecord[];
}

/**
 * What `POST` answers, exactly once (D-230-11).
 *
 * The only response in this module that ever carries a secret. `record` and `secret` are
 * separate members rather than one merged object **because `ApiKeyRecord` must stay free of
 * a secret-bearing field** — merging them would put the secret inside the very shape whose
 * contract is that it cannot hold one.
 */
export interface IssuedKey {
  record: ApiKeyRecord;
  secret: string;
}

/**
 * The published record. No `tokenHash`, no `secret`, and no field that could hold one.
 *
 * Here rather than in `keys.ts` since D-230-11 published two shapes built out of it: a type
 * that three other types name is a shape, not an implementation detail of the file that
 * happens to construct it.
 */
export interface ApiKeyRecord {
  keyId: string;
  accountId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
}
