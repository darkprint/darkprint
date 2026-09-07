/* ============================================================
   DarkPrint backend: lib/server/tutorial public surface
   Deep paths are internal and may be rearranged, so nothing
   outside `lib/server/tutorial` should reach for one. Re-exports
   are written out by name so this file doubles as the inventory
   of what the module promises.

   Three verbs over one table, no actor: the token is the whole
   authority. The shapes they answer (`LiveOpened`, `LiveRecord`,
   `LiveDraft`) are the shared contract in `lib/core/tutorial/live`
   and are not re-exported from here.
   ============================================================ */

export type { LiveWritten, OpenLiveOptions } from "./live";
export { LIVE_TTL_MS, getLive, openLive, putLive } from "./live";

/* A fact about the store (500). Unknown and expired tokens are values, never rejections. */
export { TutorialStoreError } from "./errors";
export { withTutorialStore } from "./store";

/* The transport boundary, published because the routes under `app/api/tutorial/**` cannot
   use a wrapper they cannot name. */
export { spendLiveRead, spendLiveWrite, withTutorialErrors } from "./http";
