/* ============================================================
   DarkPrint backend — lib/server/notifications public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside this
   folder should reach for one. Re-exports are written out by name
   rather than `export *` so this file doubles as the inventory of
   what the module promises.

   ── the two error classes, and the one that is deliberately absent ──
   `tests/error-hygiene.test.ts` builds its domain by CONSTRUCTION
   over every `lib/server/<module>/index.ts`, so both classes below
   are measured against D-13's hygiene clause from the day this file
   exists. Its published-class count is an EQUALITY and counts only
   barrels on `backend`, so this module does not move it in this
   worktree at all — the derivation is 50 -> 52 at the merge
   (D-190-05), and it is DERIVED by the walk against its own domain
   sha rather than carried from here.

   **`NotAccountOwnerError` is NOT re-exported, and its absence is
   load-bearing.** This module raises it (D-190-05, on T140's
   D-140-02 precedent) but it is T050's class and is already counted
   against T050's barrel. That walk pushes one entry per
   `(barrel, export)` pair, so re-exporting it here would move the
   equality by one with no new class anywhere in the tree — a red at
   the merge that nobody could explain from the diff. A caller
   needing to name it imports it from `@/lib/server/accounts`, which
   is where it is authored.

   The message-form FACTORIES are not exported either. A test that
   imports its expected message from the module under test asserts
   that the module agrees with itself, and passes unchanged the day
   the wording starts interpolating something it should not.

   ── what has no caller in this tree, and why that is recorded ──
   `enqueueRepinEvents` is published with no production caller: its
   wiring to the publish path is the orchestrator's single visit at
   merge (D-190-04, the F4.2 pattern), so the file two tasks would
   otherwise both edit is visited once. `deliverPending` likewise has
   no scheduled caller — no job scheduler is in scope (D-190-04) —
   and `enqueue`'s `digest` kind has no producer for the same reason.
   Stated here so nobody reads the absence of callers as the absence
   of a rule, which is D-110-12's argument for `lineage/http.ts`.
   ============================================================ */

export type { EventKind, NotificationDelivery, NotificationEvent, Preferences } from "./types";

export { DEFAULT_PREFERENCES } from "./defaults";

/* The fault path, published because a route has to answer it a 500 inside B-03's envelope
   rather than letting Next render its own generic one outside it (D-50-18), and a route that
   cannot name the class cannot recognise it. AC6's refusal is published for the same reason:
   the unsubscribe route maps it to 404. */
export { NotificationStoreError, UnsubscribeInvalidError } from "./errors";

export { getPreferences, setPreferences } from "./preferences";
export { enqueue, enqueueRepinEvents } from "./enqueue";
export { DELIVERY_LOCK_KEY, deliverPending } from "./deliver";
export { unsubscribe } from "./unsubscribe";

/* The transport boundary. Here rather than beside the routes because `app/api/**` holds route
   handlers and nothing else (D-01); T050, T080 and T140 put theirs in the same place. */
export type { PreferencesView, UnsubscribedView } from "./http";
export { patchFrom, preferencesView, tokenFrom, withNotificationErrors } from "./http";
