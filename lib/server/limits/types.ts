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
