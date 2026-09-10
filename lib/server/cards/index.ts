/* ============================================================
   DarkPrint backend — lib/server/cards public surface
   ============================================================ */

export type { CardRecord } from "./types";
export type { AddCardInput } from "./add-card";
export { addCard } from "./add-card";
export { getCard } from "./get-card";
export { getLatestCard } from "./get-latest-card";
export { listCardVersions } from "./list-card-versions";
export { resolveCardRef } from "./resolve-card-ref";
export { findCardsByDigest } from "./find-cards-by-digest";
export { CardStoreError } from "./errors";
/* Published for `lib/server/lineage`, which forks a card and therefore has to ask this
   module what one of its stored documents looks like with a new name on it. A pure function
   over a value this module already owns the meaning of; publishing it is what stops the fork
   growing a second opinion about a card document. */
export { cardIdInUse } from "./card-id-in-use";
export type { CardSourceStamp } from "./restamp-source";
export { restampCardSource } from "./restamp-source";
/* The public write path for one card on its own, behind `POST /api/cards`. Its refusals are
   values rather than a class, so the route maps a `kind` and the barrel publishes no new
   error type. */
export type {
  CardPublishRefusal,
  CardPublishRefusedKind,
  CardPublishResult,
  PublishCardInput,
} from "./publish-card";
export { publishCard } from "./publish-card";
