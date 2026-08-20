/* ============================================================
   DarkPrint backend — limits: the API key secret
   `issueKey` returns the secret exactly once and `ApiKeyRecord`
   has no field for it. The block says why that shape rather than
   a rule: *the record shape makes it structural rather than a
   rule someone remembers, in the same way `PublicAuthor` has no
   `email`.* Only `token_hash` is stored, so the secret is
   unrecoverable from the database by anyone, including this
   module.

   ── The shape is published so that a malformed secret can be
      refused WITHOUT hashing ──
   D-40-B's clause, met a second time on this task and in the
   worst possible place. `resolveKey(db, secret)` hashes caller
   input to look it up, and the secret is UNAUTHENTICATED input of
   unbounded length — so a 100 MB body would be read and hashed in
   full before anything discovered it is not a key. Work
   proportional to attacker input, performed to decide the input
   is worthless, on a path nobody has to authenticate to reach.

   This module MINTS the secret, so its length and alphabet are
   known by construction. `parseSecret` refuses anything that is
   not of the minted shape before `hashSecret` is ever called, and
   the refusal costs one length comparison and one regular
   expression over a bounded prefix.

   **And the refusal is `undefined`, not a throw, for a reason
   that is not tidiness.** A caller able to tell *malformed* from
   *no such key* learns whether a candidate secret exists. That is
   the same identity oracle D-13 charges, at the authentication
   surface, and it is why there is no `UnknownKeyError` in
   `errors.ts` and must not be one. The cheap check and the
   hygiene requirement want exactly the same thing here, which is
   luck rather than design and is worth saying so.

   ── Why a plain SHA-256 and not a slow KDF ──
   A password KDF exists to make guessing expensive when the
   secret has low entropy. This secret has 256 bits from
   `randomBytes` and is never chosen by a human, so there is
   nothing to guess and a work factor would buy no security. It
   would buy a cost: deliberate work per request on the
   authentication path, which is D-40-B's clause with the
   mitigation as the weapon. `node:crypto` rather than
   `lib/core/hash/sha256.ts` — the core one is pure JS so it can
   run in a browser, and nothing here does.
   ============================================================ */

import { createHash, randomBytes } from "node:crypto";

/**
 * The visible marker on every minted secret.
 *
 * Present so a leaked key is recognisable as one — in a log, a paste, a public
 * repository scan — rather than as an anonymous blob. It is not a security feature and it
 * is not a namespace; it exists so that somebody who finds one knows what they have found
 * and what to revoke.
 */
export const SECRET_PREFIX = "dp_";

/** 32 bytes, which is 43 characters of unpadded base64url. */
const SECRET_BYTES = 32;
const SECRET_BODY_CHARS = 43;

/** The exact length of every minted secret. A comparison against it is the first refusal. */
export const SECRET_LENGTH = SECRET_PREFIX.length + SECRET_BODY_CHARS;

/**
 * The minted shape, anchored at both ends.
 *
 * Anchored and length-bounded rather than open, so the expression cannot be handed an
 * unbounded string to scan: `parseSecret` compares the length first, so this only ever runs
 * over exactly `SECRET_LENGTH` characters.
 */
const SECRET_PATTERN = new RegExp(`^${SECRET_PREFIX}[A-Za-z0-9_-]{${SECRET_BODY_CHARS}}$`);

/** A fresh secret. Returned to the caller exactly once and never stored. */
export function mintSecret(): string {
  return SECRET_PREFIX + randomBytes(SECRET_BYTES).toString("base64url");
}

/**
 * The secret if it is of the minted shape, `undefined` otherwise.
 *
 * The length test comes first and it is the whole of the D-40-B fix: everything after it
 * runs over a bounded string. See this file's header for why the answer is `undefined`
 * rather than a rejection.
 */
export function parseSecret(candidate: string): string | undefined {
  if (candidate.length !== SECRET_LENGTH) return undefined;
  if (!SECRET_PATTERN.test(candidate)) return undefined;
  return candidate;
}

/**
 * What goes in `api_key.token_hash`, and the only trace of a secret anywhere.
 *
 * Hex rather than base64url because the column is compared for exact equality through a
 * unique index and hex has one spelling per value; base64 variants differ in padding and
 * alphabet, and two spellings of one hash is a lookup that silently misses.
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
