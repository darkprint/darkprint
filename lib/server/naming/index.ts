/* ============================================================
   DarkPrint backend — lib/server/naming public surface
   `lib/db/index.ts`'s rule: deep paths are internal and may be
   rearranged, so nothing outside this folder should reach for one.
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   The error classes are exported although T070's Published
   signatures block lists only the seven functions and one type:
   `allocateHandle` rejects with `HandleTakenError` and a caller
   that cannot name the class cannot branch on it, which would put
   AC4 and AC5 out of reach of any test written against this
   barrel.

   `MAX_NAME_LENGTH` is exported because D-70-17 published it in
   that block, whose header names this barrel — a constant
   published as prose is one a suite has to retype. The block's own
   warning travels with it and is not this module's to enforce: a
   boundary test that *imports* the bound moves with it and asserts
   nothing, so the number belongs in such a test as a literal.
   ============================================================ */

export type { Availability } from "./types";
export { checkHandle, allocateHandle, releaseHandle } from "./handles";
export { checkSlug } from "./slugs";
export { isReservedSlug } from "./reserved";
export { MAX_NAME_LENGTH, validateCardId, validateNamespace } from "./grammar";
export { HandleTakenError, InvalidNameError, NamingStoreError } from "./errors";
