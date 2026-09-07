/* ============================================================
   DarkPrint backend — the profile record
   D-130-06, the owner's scope cut of 2026-08-20. The record this
   task ships is the COUNTABLE half of what
   `lib/data/profiles.ts:33-60` fixtures.

   `watchers`, `support` and `pinned` were removed because no
   column holds them — measured over all 125 columns across all 16
   tables, with `target_kind` (`blueprint|card|term`) and
   `target_actor_kind` (`star|note_vote`) unable to name an account
   as a target or a follow as an act. `validated` was removed
   because D-130-01 makes it a COUNT, which depends on T180's run
   reports. `counts.cards` was removed by D-130-04, because
   `CardSummary` carries no owner and re-implementing T080's
   visibility filter against `card_version` is the one thing this
   task's inherited-read-semantics paragraph exists to prevent.

   The follow-up task inherits all four and owes the tables before
   it owes the behaviour. Nothing here is a placeholder for them:
   an absent field is why a caller cannot read a fabricated one.

   **`counts.cards` IS BACK, and the block above is why it took an
   amendment to a merged task rather than a line here (T132).**
   D-130-04 was never a rule against the figure; it was a rule
   against WHERE the figure could come from. D-132-02 ruled the
   reading — cards this handle OWNS and the actor may see, not
   cards the index carries for it, because the two differ by a row
   no release pins and a count that drops one is quietly short — and
   T080 published `cardsOwnedBy` to serve it. So the visibility
   decision still has exactly one author, one module over, and this
   file consumes it the same way it consumes `blueprints()`.
   **AND NOW THEY ARE IN, which is T131 and the tables it owed
   first.** The block above is kept rather than rewritten: it is
   the record of WHY four fields were absent for two tasks, and
   every one of its reasons was a missing column rather than a
   missing opinion. `follow`, `profile_pin` and `account_support`
   exist as of `0004_social`, so the four come back on the same
   terms `counts` already holds — derived at read time, never
   stored as a counter (D-131-04, D-131-08).
   ============================================================ */

/* D-131-01, and this is the first `lib/server` -> `lib/data` import in the repository,
   sanctioned in the block for exactly this union and nothing else. TYPE-ONLY: it erases at
   build, so no fixture byte reaches a server bundle. The point is that both halves of this
   task bind the SAME union by import rather than restating it — a restatement drifts
   silently, because AC3 makes an unresolvable pin absent and a wrong spelling therefore
   yields `pinned: []` and goes green rather than red. Imported, a drift is a compile error. */
import type { PinnedRef } from "@/lib/data/profiles";
import type { PublicAuthor } from "@/lib/server/accounts";

/**
 * One handle's public profile, as of this request and this actor.
 *
 * **`counts` is computed at read time and is not a column (AC1).** The contract's own
 * sentence — *anything countable is counted, never stored as a counter* — is the reason
 * rather than a preference: a stored count satisfies every criterion in this task and
 * drifts silently the first time a bundle is deleted, transferred (T120) or made private,
 * and nothing reds when it does.
 *
 * **The record is a function of the ACTOR as well as the handle (AC2)**, because an owner
 * sees their own private bundles and a visitor does not. That is why no value here may be
 * memoised on `handle` alone: a process-level cache keyed that way serves the owner's
 * counts to a visitor, which is the private-row leak B-13 exists to prevent, arriving
 * through a cache rather than through a query.
 */
export interface ProfileRecord {
  author: PublicAuthor;
  joinedAt: Date;
  /** Accounts currently following this handle. `count(*)` over `follow`, never a column (AC1, AC4). */
  watchers: number;
  /** Accounts currently endorsing this handle. `count(*)` over `account_support` (D-131-05). */
  support: number;
  /**
   * Distinct PUBLIC blueprints owned by SOMEBODY ELSE that this handle has submitted a run
   * report against (D-131-06). Actor-independent, unlike everything else here: the subject
   * bundles are third parties', so no owner widening applies, and a figure that moved with a
   * private bundle's existence would be an existence oracle arriving through a number (B-13).
   */
  validated: number;
  /**
   * At most two, in the order the account chose, **filtered to the pins this ACTOR can
   * resolve** — refs, never resolved items (the frontend's `PinnedItem[]` is a view shape
   * and is superseded here, as its `ProfileView` was).
   *
   * A pin whose target no longer resolves is ABSENT rather than null (AC3,
   * `components/profile/load.ts:182-190`), and so is one at a target this actor may not see
   * (D-132-04's C-D, extended to `pinned` at D-131-04). **Both are the same mechanism**: the
   * readers this resolves through are already actor-filtered, so the owner of a private
   * blueprint sees their own pin and a visitor sees a shorter array.
   */
  pinned: readonly PinnedRef[];
  counts: { blueprints: number; cards: number; terms: number };
}
