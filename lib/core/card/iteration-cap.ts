/* ============================================================
   DarkPrint core — the iteration cap a card declares
   Doc 3 §4.1 ("nessun nodo del ciclo dichiara un tetto di
   iterazioni") and the Fase 0 spec PART 0 mapping row
   `params.max_iterations → node max_retries`.

   Two modules ask the same question about the same three keys and
   have to give the same answer:

     - `analysis/security.ts` charges `unbounded-loop` when no node
       of a cycle declares a cap;
     - `attractor/emit.ts` writes the cap into the runnable DOT as
       `max_retries`.

   They used to answer it separately, and disagreed on two inputs:
   a numeric string (`max_iterations: "10"`, an ordinary YAML
   quoting slip) and `0`. One card therefore produced a DOT that
   capped the loop and a security score that charged the same loop
   for being uncapped — a contradiction between two statements
   about one card, which is exactly the kind of thing doc 1 §8.3's
   "an evaluation nobody can audit" warns about. So there is one
   reader, here, and both call it.

   ── The two judgement calls, settled once ──
   **A numeric string counts.** `"10"` is what a YAML author writes
   by accident, and the intent is not in doubt; refusing it would
   charge 1.5 points for a quote character.
   **Zero counts.** `max_iterations: 0` and `max_retries: 0` are
   bounds — the tightest available — and Attractor's own default for
   `max_retries` is 0, meaning "run once, no retry". A run bounded
   at zero extra passes cannot circle indefinitely, which is the
   only thing doc 3 §4.1's marker is about.

   What does *not* count: a negative number, a fraction, `NaN`,
   `Infinity`, and any non-numeric value. Those are not caps a run
   can rely on, and guessing what `-1` or `2.5` was supposed to mean
   would put a number nobody wrote into a runnable artefact.
   ============================================================ */

import type { JsonValue } from "./schema";

/**
 * Where an iteration cap may be written on a card, in the order they are read.
 *
 * The Fase 0 mapping table names `params.max_iterations`; the other two are the
 * spellings doc 3 §4.1's inferred marker also accepts, and an author who wrote one of
 * them meant the same thing. Exactly these three — a fourth spelling invented here would
 * silently disarm loop detection for graphs written against the spec, so a new spelling
 * belongs in the spec first.
 *
 * Top-level keys of `params` only: a cap buried in a nested object is configuration for
 * whatever reads that object, not for the runner.
 */
export const ITERATION_CAP_KEYS: readonly string[] = Object.freeze([
  "max_iterations",
  "maxIterations",
  "max_retries",
]);

/**
 * The iteration cap a card's `params` declare, or `undefined` when they declare none.
 *
 * A non-negative integer, or a string that trims to one. Pure, total and never throws:
 * malformed input is absence, not an error (the card validator owns reporting it).
 *
 * The first key that carries a usable value wins, in `ITERATION_CAP_KEYS` order — a card
 * that spells two of them has declared one cap twice, and picking the first is stable.
 * A key present with an unusable value does not stop the search: `{ max_iterations: -1,
 * max_retries: 5 }` is a card with a cap of 5 and one stray key, not an uncapped card.
 */
export function readIterationCap(params: Readonly<Record<string, JsonValue>>): number | undefined {
  for (const key of ITERATION_CAP_KEYS) {
    // `hasOwnProperty`, not `params[key] !== undefined`: an inherited `toString` would
    // otherwise be read as a value on a plain object literal from a parsed document.
    if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
    const cap = toCap(params[key]);
    if (cap !== undefined) return cap;
  }
  return undefined;
}

/** True when the card declares a cap doc 3 §4.1 can read as "questo ciclo ha un tetto". */
export function declaresIterationCap(params: Readonly<Record<string, JsonValue>>): boolean {
  return readIterationCap(params) !== undefined;
}

/** One value, admitted or not. `Number.isInteger` already rejects `NaN` and `Infinity`. */
function toCap(value: JsonValue): number | undefined {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  // `Number("")` is 0, which would turn an empty string into a declared cap of zero.
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
