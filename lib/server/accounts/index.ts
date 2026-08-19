/* ============================================================
   DarkPrint backend — lib/server/accounts public surface
   `lib/db/index.ts`'s rule: deep paths are internal and may be
   rearranged, so nothing outside this folder should reach for one.
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   The four error classes are exported although T050's Published
   signatures block lists only the seven functions and two types: a
   caller that cannot name a class cannot branch on it, and the
   routes have to map three of them to three different statuses.

   **`HandleTakenError` and `InvalidNameError` are deliberately NOT
   re-exported here.** Both come from `@/lib/server/naming`, both
   reach a caller of `changeHandle`, and D-50-08 requires their
   messages to pass through unaltered so that each keeps one
   author. Re-exporting them would publish another module's
   rejection under this module's name and invite exactly the
   re-rendering that ruling forbids; the routes import them from
   the barrel that owns them.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts`, so these classes are
   measured against D-13's hygiene clause from the day this file
   exists, and a barrel that will not import is an error there
   rather than a module it quietly stopped covering.
   ============================================================ */

export type { AccountRecord, PublicAuthor } from "./types";

export {
  AccountStoreError,
  HandleRequiredError,
  InvalidProfileError,
  NotAccountOwnerError,
} from "./errors";

export { upsertFromGitHub } from "./github";
export { getAccount, getPublicAuthor } from "./read";
export { changeHandle } from "./handle";
export { setDefaultVisibility, setEmail, updateProfile } from "./write";

/* The transport boundary. Here rather than beside the routes because this task's
   `Owns` enumerates five exact route FILES rather than `app/api/account/**`, so a
   shared sixth file under that tree would sit outside it. T080 puts `actorFrom` in
   its own module for the same reason. */
export { actorFrom, readJsonObject, withAccountErrors } from "./http";
