/* ============================================================
   DarkPrint backend — lib/server/publish public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one. Re-exports are written out by
   name rather than `export *` so this file doubles as the
   inventory of what the module promises.

   `PublishRefusedError` is exported although T100's Published
   signatures block lists only the verb and its two types: the
   route has to map five `kind`s to three different statuses, and
   a caller that cannot name the class cannot branch on it.
   `PublishRefusedKind` travels with it for the same reason — a
   caller switching on `kind` needs the union to be exhaustive.

   **The five constructors are NOT exported, and neither are the
   message literals.** A test that imports its expected message
   from the module under test asserts that the module agrees with
   itself, and passes unchanged the day the wording starts
   interpolating something it should not.

   `tests/error-hygiene.test.ts` builds its domain by construction
   over every `lib/server/<module>/index.ts`, so this class is
   measured against D-13's hygiene clause from the day this file
   exists. Its published-class count is an EQUALITY and counts only
   barrels on `backend`, so this module does not move it here; the
   merge commit is where it goes from 29 to 30.
   ============================================================ */

export type { PublishInput, PublishResult } from "./publish";
export { publish } from "./publish";

export type { PublishRefusedKind } from "./errors";
export { PublishRefusedError } from "./errors";

/* The freeze, and the codec that reads it back.

   `persistArtefacts` is T100's published write verb. `encodeArtefacts`, `decodeArtefacts`
   and `selectArtefact` are published WITH it because `readPersisted` is T090's and is not
   built: `ObjectStorage` addresses one object per digest, so a folder is stored as a single
   object, and a container format invented here and left unstated is one its reader cannot
   guess. A frozen artefact nobody can decode is worth less than none, since the fallback at
   least produces bytes. Published so `readPersisted` consumes this reading rather than
   deriving a second one — T133's rule, one column one shape, applied to a bucket. */
export { decodeArtefacts, encodeArtefacts, persistArtefacts, selectArtefact } from "./artefacts";
