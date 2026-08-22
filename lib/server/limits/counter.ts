/* ============================================================
   DarkPrint backend — limits: the counter, and the bound on the
   counter itself
   D-40-B's clause has been charged five times in this run: *the
   limit performs the resource exhaustion the limit exists to
   prevent*. This file is a limit, so the clause is asked of it
   first and the obvious design fails.

   ── Why not a Map keyed by subject ──
   `Map<subject, {count, windowStart}>` allocates one entry per
   distinct subject. For an anonymous caller the subject is the
   IP, and an attacker holding a /64 has 2^64 of them. **Every one
   of those requests is UNDER the ceiling**, so the limit never
   fires, so nothing evicts, and memory grows without bound — on
   precisely the path AC5 forbids delaying or challenging. The
   limiter dies while every individual caller is behaving.

   TTL eviction does not fix it. With window `W` and attacker rate
   `R` the live set is `R·W`, which is bounded by the attacker's
   rate — not a quantity this process controls. That is a bound in
   name.

   An LRU or an evict-when-full map is worse: it fails OPEN.
   An attacker evicts their OWN entry and the limit stops
   existing, silently, which is D-05-09's direction exactly — a
   bound that quietly stops bounding rather than refusing.

   ── What this is instead ──
   A FIXED array of slots. `slot = hash(bucket, tier, subject) &
   mask`. Memory is `slots × BYTES_PER_SLOT` **by construction**,
   allocated once, independent of how many distinct subjects exist
   or how fast they arrive. There is no allocation on the request
   path at all, so an anonymous flood cannot even cause GC
   pressure — which is the strongest form of AC5's *never
   delayed*.

   **A collision makes two subjects share one budget, which is
   STRICTER and never looser, so it fails CLOSED.** That is the
   whole reason the slot stores no identity: the moment a slot
   remembers whose it is, a mismatch has to be resolved, and every
   resolution that is not "share" resets the count for an attacker
   who alternates subjects.

   ── The cost, stated rather than absorbed ──
   Two subjects sharing a slot share a ceiling, so a colliding
   attacker can push an innocent caller toward a limit it never
   approached. The effective ceiling degrades as the number of
   concurrent distinct subjects approaches `slots`; at a load
   factor near 1 most subjects share with somebody. That is real
   and it is not rare at scale.

   Two things bound the damage and only one of them is design.
   The hash is SEEDED per process, so an attacker cannot compute
   which subject collides with a chosen victim (see `createSlotCounter`).
   And B-17 already commits the product to generous ceilings for
   the MCP audience, so there is headroom to share — **that second
   one is luck rather than design**: the two pressures happen to
   point the same way and nothing makes them.

   ── What this stores, and what it therefore cannot leak ──
   A slot holds a window start and a count. **No identity, no IP,
   no key id, nothing derived from a subject except the index it
   hashed to** — a hash the process reseeds on every start. So
   there is nothing in this structure to leak and a dump of it
   names nobody. That is a consequence of the fail-closed design
   rather than a second decision.

   ── The window is FIXED, and the boundary burst is real ──
   A caller may send `limit` at the end of one window and `limit`
   at the start of the next, so the worst case over a `windowMs`
   interval is `2 × limit`. That is a property of every fixed
   window and it is stated rather than hidden. A sliding-window
   counter would halve it, at two slots per subject and at the
   cost of `resetAt`'s meaning: the published `LimitVerdict`
   carries `resetAt: Date` and the admissible refusal says *resets
   at <ISO instant>*, which is an instant a fixed window has and a
   sliding one only approximates. Changing it is a contract
   question, not an implementation one.
   ============================================================ */

import { randomBytes } from "node:crypto";

/**
 * Eight bytes for the window start (a millisecond instant, which does not fit an `Int32`)
 * and four for the count. Written out because the memory bound below is arithmetic over it
 * rather than a sentence beside it — a ratio stated in prose goes stale silently when
 * either operand moves, and this one is asserted in `counter.test.ts`.
 */
export const BYTES_PER_SLOT = 12;

/**
 * The slot count, and it is a MEMORY bound rather than a product one.
 *
 * D-70-17's shape: `MAX_NAME_LENGTH` is published at 255 as a storage bound with the
 * reasoning beside it, and the test is what makes the number safe rather than the number
 * being right. This is the same kind of number and deliberately NOT the same kind as a
 * ceiling — the ceilings are the owner's and stay `TBD:` in `config.ts`. Nothing here
 * decides how many requests anybody may make.
 *
 * 2^16 slots × 12 bytes = 786 432 bytes, fixed, allocated once at construction. A power of
 * two so the index is a mask rather than a division, which also removes the modulo bias a
 * non-power-of-two would put on the low slots.
 *
 * Raising it costs `(slots − 65536) × 12` bytes and buys a lower load factor. Lowering it
 * makes collisions commoner, which is safe in the refusal direction and worse for innocent
 * callers. `counter.test.ts` reds if the product exceeds `MAX_COUNTER_BYTES`.
 */
export const DEFAULT_SLOTS = 1 << 16;

/**
 * The most memory this structure may hold, so a raise is a decision somebody sees.
 *
 * One megabyte. The assertion that enforces it is `slots × BYTES_PER_SLOT <=
 * MAX_COUNTER_BYTES`, computed rather than compared against a remembered figure, so
 * changing `BYTES_PER_SLOT` moves it too.
 */
export const MAX_COUNTER_BYTES = 1024 * 1024;

/**
 * The most of a subject key that reaches the hash.
 *
 * A UUID is 36 characters and the longest IPv6 text form with an embedded IPv4 suffix is
 * 45, so every legitimate identifier is far under this. `subject.ip` arrives from the edge
 * and can be a forged header of any length, and hashing an unbounded string is work
 * proportional to attacker input performed before any decision — D-40-B's clause one call
 * over from where `resolveKey` meets it.
 *
 * **This is a truncation and it is NOT D-05-09's hazard, which is worth being explicit
 * about because it looks like it.** D-05-09 charges a bound that turns a rejectable input
 * into a wrong NUMBER that lands in an aggregate — silent and unrecoverable. Reading a
 * prefix here can only make two distinct subjects share a slot, which is stricter and
 * never looser. It moves the answer in the refusing direction, and a forged 10 MB header
 * collapses toward fewer slots rather than costing 10 MB of hashing.
 */
export const MAX_SUBJECT_CHARS = 64;

/** A monotonic-enough millisecond clock. Injected so a window can be crossed without sleeping. */
export type Clock = () => number;

export interface SlotCounterOptions {
  /** Must be a power of two. Defaults to `DEFAULT_SLOTS`. */
  readonly slots?: number;
  /** Defaults to a fresh 32-bit value from `randomBytes`. See `createSlotCounter`. */
  readonly seed?: number;
  /** Defaults to `Date.now`. */
  readonly now?: Clock;
}

export interface SlotCounter {
  /**
   * Record one request against a slot and answer the count INCLUDING it, plus the instant
   * the slot's window ends.
   *
   * One call does both because two would be two reads of a mutable slot with a window roll
   * possible between them, and the second read would answer about a different window than
   * the first.
   */
  hit(bucket: string, tier: string, subject: string, windowMs: number): { count: number; resetAt: number };
  /**
   * Bytes held, computed from the allocation rather than declared beside it.
   *
   * **Stated limit, because this is the number the D-40-B claim rests on and a caveat left
   * vague is a claim the next reader has to re-derive.** It reads `byteLength` off the two
   * typed arrays, so it cannot misreport THEM — but it would not see a second structure
   * added beside them. An implementation that kept the slot arrays and also grew a
   * `Map<subject, …>` would report an unchanged figure while growing without bound, which is
   * exactly the design this file exists to refuse.
   *
   * So `counter.test.ts`'s "memory does not grow" cell measures the arrays and not the
   * process, and the property it actually establishes is *these two allocations are fixed*.
   * The stronger claim — *nothing here grows with the subject count* — is held by the code
   * having nowhere else to put anything, which is a reading rather than a measurement.
   */
  bytes(): number;
}

/**
 * FNV-1a over the seed and then the three key parts, 32-bit.
 *
 * Non-cryptographic on purpose: a collision here is safe by design, so this is a
 * distribution problem and not a security boundary. The parts are separated by a character
 * that cannot occur in any of them, so `("ab", "c")` and `("a", "bc")` do not collide by
 * concatenation — the token-boundary defect this run charges elsewhere, avoided at a hash
 * key rather than at a matcher.
 *
 * `subject` is read to at most `MAX_SUBJECT_CHARS`; see that constant for why truncating
 * here is the safe direction.
 */
function hashSlot(seed: number, bucket: string, tier: string, subject: string): number {
  let h = seed >>> 0;
  const mix = (s: string, limit: number): void => {
    const end = Math.min(s.length, limit);
    for (let i = 0; i < end; i += 1) {
      h ^= s.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      h ^= s.charCodeAt(i) >>> 8;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    /* The separator, mixed unconditionally so a truncated part still ends somewhere. */
    h ^= 0x1f;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  mix(bucket, MAX_SUBJECT_CHARS);
  mix(tier, MAX_SUBJECT_CHARS);
  mix(subject, MAX_SUBJECT_CHARS);
  return h >>> 0;
}

/**
 * A fixed-size counter.
 *
 * **The seed is per process and random, and that is the one piece of hardening here.**
 * Without it the mapping from subject to slot is a published function, so an attacker who
 * can choose its own subject key — and it can, `X-Forwarded-For` is caller-supplied unless
 * an edge overwrites it — can craft a subject that lands in a chosen victim's slot and
 * spend the victim's budget. With it, the mapping is unknown outside this process and
 * changes on every restart. It costs one `randomBytes(4)` at construction and nothing on
 * the request path.
 *
 * The seed is an option so a test can make the mapping reproducible; nothing in production
 * passes one.
 */
export function createSlotCounter(options: SlotCounterOptions = {}): SlotCounter {
  const slots = options.slots ?? DEFAULT_SLOTS;
  if (!Number.isInteger(slots) || slots <= 0 || (slots & (slots - 1)) !== 0) {
    /* Not a typed refusal: this is a programming error at construction, not a caller's
       input, and it can only be reached by this module's own code or a test. A published
       class for it would be a class no route can produce, which is the shape that gets
       charged as unfirable. */
    throw new RangeError("slots must be a positive power of two");
  }
  const mask = slots - 1;
  const seed = options.seed ?? randomBytes(4).readUInt32BE(0);
  const now = options.now ?? Date.now;

  /* Allocated once, here. Nothing on the request path allocates, which is what makes an
     anonymous flood free of GC pressure as well as of memory growth. */
  const windowStart = new Float64Array(slots);
  const count = new Int32Array(slots);

  return {
    hit(bucket, tier, subject, windowMs) {
      const i = hashSlot(seed, bucket, tier, subject) & mask;
      const t = now();
      /* `count[i] === 0` is the never-used test, NOT `windowStart[i] === 0`. A count is at
         least 1 after any hit and is only ever left at 0 on the line below, so the two are
         equivalent for a real clock — and they differ for a test clock that starts at 0,
         where a genuine window beginning at instant 0 would read as a fresh slot forever.
         A sentinel that collides with a legitimate value is a sentinel that is wrong
         exactly where somebody is trying to measure the thing it guards. */
      /* `>=` rather than `>`: a request landing exactly `windowMs` after the start belongs
         to the next window. The boundary has to fall on one side, and this is the side that
         does not extend a window by a millisecond every time it is hit. */
      if (count[i] === 0 || t - windowStart[i] >= windowMs) {
        windowStart[i] = t;
        count[i] = 0;
      }
      /* Saturating rather than wrapping, and the comparison is against the CEILING rather
         than against zero. `count[i] + 1` is a plain JS number, so it does not
         wrap at the addition — it wraps when it is STORED, and `2147483648` lands as
         `-2147483648`. A `next < 0` test therefore never fires and the counter silently
         resets to far below every ceiling: a counter that stops counting, which is this
         file's own failure mode arriving inside the line written to prevent it. A slot
         pinned at the maximum stays refused until its window rolls, which is closed. */
      const next = count[i] + 1;
      count[i] = next >= 0x7fffffff ? 0x7fffffff : next;
      return { count: count[i], resetAt: windowStart[i] + windowMs };
    },
    bytes() {
      return windowStart.byteLength + count.byteLength;
    },
  };
}
