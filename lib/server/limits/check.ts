/* ============================================================
   DarkPrint backend — limits: the verdict, and the two shapes
   that read it
   AC5: *an anonymous read below the ceiling is never delayed or
   challenged* — and the block says how it is to be asserted:
   **by measuring that `checkLimit` on an under-ceiling read
   performs no write**, not by observing that a response came
   back. A counter that writes on every read passes a latency-free
   test on an idle machine and falls over under load.

   ── `db` is accepted and never touched, and that is the point ──
   AC5 and a durable counter are incompatible BY DEFINITION: a
   durable counter is a write per request, which is what the words
   mean. The absent counter table is not what makes them so, and a
   table would not have helped.

   So the counter is in process (`counter.ts`) and this function
   touches `db` on NO path — not on the anonymous one AC5 names,
   and not on the keyed one either. A keyed subject arrives here
   already carrying its `keyId`, because the route resolved it,
   and the tier is derivable from the subject's shape alone.

   That makes AC5's instrument total rather than conditional: a
   `Proxy`-backed `Db` recording any property access asserts
   `touched() === false` for EVERY tier, which is a proof the
   resource was never reached rather than a claim about latency.
   T050 reached the same instrument from the other side — five
   guards that its own sanitized error surface could not separate.

   **The parameter is therefore unused, and it is kept rather than
   removed.** It is the published signature and not this module's
   to change; a durable counter would use it; and its presence is
   what makes the `touched() === false` assertion meaningful, since
   an assertion that the module never touched a thing it was never
   given is vacuous. Reported to the orchestrator rather than
   worked around.

   ── Where the IP bound actually is, and what it does NOT
      cover ──
   `subject.ip` is caller-influenced — `X-Forwarded-For` is a
   header unless an edge overwrites it — so hashing it unbounded
   would be work proportional to attacker input. `hashSlot` reads
   at most `MAX_SUBJECT_CHARS` of it, so nothing in THIS module
   scans the whole string.

   **That is a narrower claim than "the IP is bounded" and the
   difference is not pedantry.** By the time this function has a
   `LimitSubject`, the header has already been read into a JS
   string by whatever built it, and that allocation is upstream of
   every assertion this module can make about itself — *a limit
   bounds only the work that happens after it runs, and work done
   to construct its own input is unbounded by construction.* The
   corollary is about placement: **the bound belongs where the
   bytes are, not where the type is.** A route holds bytes; this
   module holds a string. So the header-length bound is owed by
   whichever task first turns a request into a `LimitSubject`, and
   it is not owed here and cannot be paid here.

   ── What this costs, stated in the module as ruled ──
   **An in-process counter bounds per INSTANCE, not globally.**
   With N warm instances the effective ceiling is N times the
   configured one. That weakens AC2 — *limits are enforced
   server-side regardless of any client cap* — which stays true
   (this is server-side) while stopping being ONE number. A reader
   must not infer that the figure in `config.ts` is what a caller
   can actually spend across the fleet. Making it one number needs
   shared storage, which needs a table `lib/db/schema.ts` does not
   have and which is Forbidden here.
   ============================================================ */

import type { Db } from "@/lib/db";
import { DEFAULT_LIMITS, limitFor, tierOf, type LimitConfig } from "./config";
import { createSlotCounter, type SlotCounter } from "./counter";
import type { LimitSubject, LimitVerdict } from "./types";
import { rateLimitedError } from "./errors";

export interface CheckLimitOptions {
  readonly config?: LimitConfig;
  readonly counter?: SlotCounter;
}

/**
 * The process-wide counter.
 *
 * Module state, because the published signature carries no counter and a per-call counter
 * would count nothing. One per process, which is exactly the per-instance bound this
 * file's header states — the singleton is where that limitation physically lives, so it is
 * named here rather than left as a remark in a comment three files away.
 */
const processCounter: SlotCounter = createSlotCounter();

/**
 * Judge one request against its bucket's ceiling.
 *
 * Never throws for an over-limit request: the refusal is a VALUE (`allowed: false`) and
 * `enforceLimit` below is what turns it into a rejection. Both exist because they answer
 * different questions — a caller that wants to report remaining quota needs the verdict,
 * and a route that must not serve needs the throw.
 *
 * An unconfigured bucket REFUSES. `limitFor` answers `undefined` and this reads it as a
 * refusal rather than as "no limit", because a config lookup returning `undefined` read as
 * unlimited is a criterion satisfiable by never limiting anything — D-70-18's shape at a
 * `Record` index, and the one place AC2 could be false with nothing to show it. The verdict
 * for that case carries `limit: 0` and `remaining: 0`, which is the honest rendering of "no
 * ceiling has been set for this bucket" and is not a ceiling anybody chose.
 */
export async function checkLimit(
  db: Db,
  subject: LimitSubject,
  bucket: string,
  options: CheckLimitOptions = {},
): Promise<LimitVerdict> {
  /* The `void` is the repository's own idiom for a deliberately unused binding
     (`lib/server/policy/can.ts`'s `assertNever`). It is here so the unused parameter is a
     stated decision in the code rather than a lint exemption somebody reads as an
     oversight. See this file's header for why the parameter is kept at all. */
  void db;

  const config = options.config ?? DEFAULT_LIMITS;
  const counter = options.counter ?? processCounter;
  const tier = tierOf(subject);
  const configured = limitFor(config, bucket, tier);

  if (configured === undefined) {
    /* No window to roll and nothing to count, so the counter is not touched: an
       unconfigured bucket must not be able to consume slots. */
    return { allowed: false, limit: 0, remaining: 0, resetAt: new Date(0), windowMs: 0 };
  }

  /* The subject key is the identifier that DECIDED the tier, so the three cases cannot
     disagree with `tierOf`. Reading `ip` for a keyed subject would let one caller's
     requests count against two slots depending on which field a route happened to fill. */
  const key = tier === "key" ? subject.keyId : tier === "account" ? subject.accountId : subject.ip;
  const { count, resetAt } = counter.hit(bucket, tier, key ?? "", configured.windowMs);

  return {
    allowed: count <= configured.limit,
    limit: configured.limit,
    remaining: Math.max(0, configured.limit - count),
    resetAt: new Date(resetAt),
    windowMs: configured.windowMs,
  };
}

/**
 * `checkLimit`, refusing rather than reporting.
 *
 * T000 published `withSession` as a WRAPPER rather than a function returning
 * `payload | Response`, and gave the reason: a guard that returns a union depends on every
 * caller checking the union, and a caller who forgets runs the handler anyway. A
 * `checkLimit` whose refusal is a boolean field has exactly that shape, and AC2 —
 * *enforced server-side regardless of any client cap* — is the criterion a forgotten check
 * makes false. So the enforcing form throws, and `withLimitsErrors` turns it into AC1's
 * 429. The verdict form stays published and stays useful; it is just not the one a route
 * that must not serve should be reaching for.
 */
export async function enforceLimit(
  db: Db,
  subject: LimitSubject,
  bucket: string,
  options: CheckLimitOptions = {},
): Promise<LimitVerdict> {
  const verdict = await checkLimit(db, subject, bucket, options);
  if (verdict.allowed) return verdict;
  /* Every part comes off the ONE verdict, including the window (D-230-10). Re-deriving any
     of them here from the config would reintroduce exactly the disagreement the carried
     field exists to foreclose: two reads of the same table, and nothing asserting they
     agree. */
  throw rateLimitedError(bucket, verdict);
}

/*
 * `windowFor(subject, bucket, config)` was published here and is WITHDRAWN, struck rather
 * than deleted because it read as the settled answer to "where does a renderer get the
 * window".
 *
 * It existed to feed a fourth parameter on `rateLimited`. D-230-10 carries `windowMs` on the
 * verdict instead, and the deciding argument is about this function rather than about the
 * parameter: **a caller that can fetch the window separately can fetch one that disagrees
 * with the verdict it is rendering.** Publishing the getter is what makes that reachable, so
 * removing it is the fix and keeping it beside the carried field would be the hazard with a
 * second spelling.
 */

