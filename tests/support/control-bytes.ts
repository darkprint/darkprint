/* ============================================================
   The control-character fixtures every task's suite needs, written
   once so that nobody has to type one.

   T-01 (backend.md) has now fired eight times across four authors,
   every occurrence on the same fixture: someone writing a
   deliberate control character for a SQLSTATE 22021 case types the
   raw byte instead of the escape. It has caught an implementer, a
   blind test author writing a Log entry, an adversary writing an
   attack list, and the orchestrator writing *this file* — that last
   one blocked by the tool layer rather than by any guard here,
   which is the only occurrence so far that was prevented rather
   than detected.

   So the population is wider than the hazard's own wording, which
   says "any author writing a fixture". It is anyone who types the
   byte, and the reason they type it is that there was nowhere to
   import it from.

   `tests/no-raw-control-bytes.test.ts` catches the byte once it is
   on disk, including in untracked files. This removes the need to
   type it at all, which is the only fix that reaches the cause.

   Import these. Do not retype them.
   ============================================================ */

/** A NUL. Postgres refuses it in a `text` parameter with SQLSTATE 22021 — the recurring case. */
export const NUL = "\u0000";

/** An unpaired high surrogate: well-formed UTF-16, no UTF-8 encoding, silently rewritten by `pg`. */
export const LONE_HIGH_SURROGATE = "\uD800";

/** An unpaired low surrogate — the other half of the same hazard (T010's D-12). */
export const LONE_LOW_SURROGATE = "\uDFFF";

/** A NUL in the middle of a label, which is where a trailing-byte check would miss it. */
export function nulInside(label: string): string {
  return `${label}${NUL}tail`;
}

/** An unpaired surrogate inside a label, for the refuse-rather-than-repair cases. */
export function surrogateInside(label: string): string {
  return `${label}${LONE_HIGH_SURROGATE}tail`;
}
