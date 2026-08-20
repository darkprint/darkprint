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
 * The published subject. Every field is what the route already resolved, never a header.
 *
 * `keyId` is non-null only for a key `resolveKey` answered for, which is a key that exists
 * and is not revoked — so AC4's *a revoked key is refused immediately* reaches `tierOf` as
 * an absent `keyId` rather than as a flag anybody checks twice.
 */
export interface LimitSubject {
  accountId: string | null;
  keyId: string | null;
  ip: string;
}

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
