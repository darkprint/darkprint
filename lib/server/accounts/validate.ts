/* ============================================================
   DarkPrint backend — accounts: what the door accepts
   Every writable field on this task is a free-text or numeric
   scalar going into `account`, and this file is the only place
   that decides whether one may. Checked before a connection is
   opened, on every path, for the same reason `lib/server/naming`
   checks its grammar before the driver: what reaches Postgres
   should never be a value Postgres has to have an opinion about.

   THREE BOUNDS ARE THE CONTRACT'S (D-50-11): `avatarHue` is
   0-360, `displayName` is at most 80 characters and `bio` at most
   400. `email` has no predicate beyond non-empty (D-50-12) and is
   explicitly unverified — nothing sends a verification, so no
   validity claim is made here or tested anywhere.

   TWO ARE THIS MODULE'S, reported rather than assumed (see the
   task Log), because the contract published lengths and a range
   and left the door itself unstated:

   - **A NUL or an unpaired surrogate is refused, never repaired.**
     `display_name`, `bio` and `email` are the first free-text
     `text` columns any task in this run writes, and the grammar
     that made this unreachable for T070 does not exist here: a
     handle admits `[a-z0-9-]` only, a display name admits
     anything. `pg` sends `text` as UTF-8, an unpaired UTF-16
     surrogate has no UTF-8 encoding and is silently replaced with
     U+FFFD (D-12), and a NUL raises SQLSTATE 22021 from the
     driver. The first stores a different string from the one the
     caller typed; the second arrives as a `DrizzleQueryError`
     whose message opens with the statement and every bound
     parameter (D-13) — and on `setEmail` the bound parameter IS
     the email, which AC2 exists to keep off every surface. So this
     is AC2's guard as much as it is D-12's, and refusing at the
     door is what makes both structural.

   - **Length is counted in CODE POINTS, not UTF-16 units.**
     `[...value].length`, not `value.length`. T070 could count
     units honestly because its alphabet is single-byte ASCII, so a
     character count and a byte count were the same number. Here
     they are not: an emoji is one character to the reader typing
     it and two `.length` units, so a `.length` bound of 80 refuses
     a 41-character name. Neither column has a storage bound to
     satisfy (both are `text`), so nothing is traded away by
     counting what the reader counts. Flagged because a blind
     author has an equally defensible reading and the two disagree
     on exactly one class of input.
   ============================================================ */

/** The contract's three (D-50-11). Not exported: a bound is enforced here or nowhere. */
const MAX_DISPLAY_NAME = 80;
const MAX_BIO = 400;
const MIN_AVATAR_HUE = 0;
const MAX_AVATAR_HUE = 360;

/**
 * A NUL, CONSTRUCTED rather than written — not as a flourish, and the reason is this
 * task's own experience of T-01.
 *
 * T-01 has fired nine times across five authors, always because someone typed the raw
 * byte where the escape was meant. It fired twice more writing this very line, both
 * blocked by the tool layer rather than by any guard in the repository, which makes
 * them the second and third occurrences prevented rather than detected — and the
 * first two in **production code** rather than in a test fixture. The hazard's own
 * wording says "any author writing a fixture" and that population is too narrow.
 *
 * `tests/support/control-bytes.ts` was added so nobody has to type the byte. It is
 * under `tests/`, and `lib/**` cannot import from there, so the one remedy that
 * reaches the cause does not reach this file. `String.fromCharCode(0)` needs no byte
 * and no escape, so there is nothing here to get wrong: the failure mode is removed
 * rather than guarded. Reported in this task's Log.
 */
const NUL = String.fromCharCode(0);

/**
 * A lone surrogate: a UTF-16 unit in D800-DFFF that is not part of a well-formed
 * pair. `String.prototype.isWellFormed` is the language's own answer and needs no
 * hand-rolled scan, so no second definition of "well formed" can drift from it.
 */
function hasLoneSurrogate(value: string): boolean {
  return !value.isWellFormed();
}

/**
 * What every free-text field must clear before its own bound is applied. Separate
 * from the bounds so the two reasons stay distinguishable in a server log: a name
 * that is too long and a name carrying a NUL are refused by the same error form,
 * because AC2 forbids the rendering from saying which.
 */
function isStorableText(value: string): boolean {
  return !value.includes(NUL) && !hasLoneSurrogate(value);
}

/** Characters as a reader counts them — see the header on why this is not `.length`. */
function characterCount(value: string): number {
  return [...value].length;
}

/**
 * Every predicate here takes `unknown` and narrows, rather than taking the type the
 * published signature promises.
 *
 * The promise is a TypeScript one and the callers that matter are routes holding a
 * parsed JSON body, where every field is whatever was sent. A predicate typed to
 * `string | null` reads `value.includes(...)` on a number and raises a `TypeError`,
 * which is a **500 for a client error** — the caller sent a bad field and gets told
 * the server broke. Narrowing from `unknown` makes the wrong type the same refusal as
 * a wrong value, which is what it is, and keeps the one published rejection form
 * covering both.
 */
export function isValidDisplayName(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  return isStorableText(value) && characterCount(value) <= MAX_DISPLAY_NAME;
}

export function isValidBio(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  return isStorableText(value) && characterCount(value) <= MAX_BIO;
}

/**
 * An integer in 0-360 inclusive, or `null`.
 *
 * `Number.isInteger` rather than a range check alone, and that is the half a range
 * check misses: the column is `smallint`, so `12.5` is not a hue the store can hold
 * and the driver rather than this module would decide what happens to it. It also
 * settles `NaN` and both infinities, which a bounds pair alone does not — `NaN` fails
 * every comparison so it happens to be refused, but `-Infinity <= 360` is `true` and
 * an upper-bound-only check would admit it.
 */
export function isValidAvatarHue(value: unknown): value is number | null {
  if (value === null) return true;
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_AVATAR_HUE &&
    value <= MAX_AVATAR_HUE
  );
}

/**
 * `null` clears the address. A string must be storable and non-empty **after
 * trimming**: a value of three spaces is non-empty by length and empty in substance,
 * and storing it would put an address on the row nobody can be reached at while every
 * "has an email" check reads true.
 *
 * No further predicate, per D-50-12. The field is unverified — nothing sends a
 * verification — so a regex here would assert a validity nobody establishes, and the
 * addresses it would refuse are legal ones.
 */
export function isValidEmail(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  return isStorableText(value) && value.trim().length > 0;
}

/**
 * The stored form of an email. Trimmed, because the trimmed value is what the
 * predicate above accepted — validating one string and storing another is how a bound
 * stops meaning what it says.
 */
export function normalizeEmail(value: string | null): string | null {
  return value === null ? null : value.trim();
}

export function isValidVisibility(value: unknown): value is "public" | "private" {
  return value === "public" || value === "private";
}
