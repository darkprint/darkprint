/* ============================================================
   DarkPrint backend — lib/server/notes public surface
   `lib/db/index.ts`'s rule, extended to every owned barrel: deep
   paths are internal and may be rearranged, so nothing outside
   this folder should reach for one (T000 contract, D-01).
   Re-exports are written out by name rather than `export *` so
   this file doubles as the inventory of what the module promises.

   ── What is published beyond the block, and why ──
   T170's block publishes five functions, `NoteRecord` and
   `NotePage`. Three more names ship here, each on the accounts and
   saves barrels' precedent of publishing what a caller cannot
   branch on — or cannot ASSERT — without:

   * **`NoteTarget`** — the shape three of the five take. The block
     writes it inline at each of them, so without a name every
     consumer retypes the union, and a third spelling of one shape
     is what D-140-04 charged `seams.md` for.
   * **`NoteTargetKind`** — the union itself, for a caller
     narrowing a string before it builds a target.
   * **`MAX_NOTE_BODY`** — AC5 requires the refusal STATE the
     limit, and a criterion quantified over a number nobody can
     import is a criterion asserted against a literal. With this
     published, the cell is `message.includes(String(MAX_NOTE_BODY))`
     and keeps saying something the day the number changes; without
     it, the cell pins the value and reds on the correction. The
     number is PENDING-OWNER-REVIEW, which is precisely why nothing
     should be pinning it.

   None widens the surface: the first two are the block's own
   literals given a name, and `NoteRecord`'s key set is unchanged.

   ── What is NOT published here ──
   **`NOTE_PAGE_SIZE` is not exported.** It is a transcription of
   `components/blueprint/Comments.tsx`'s private `VISIBLE_NOTES`
   and not a fact this module owns; publishing a copy would make
   this barrel a second source for the page size, and a caller
   importing it would be depending on this task's reading of
   another file. AC2 binds *at most 10*, which a caller counts.

   **`NotAccountOwnerError` is not re-exported**, although AC3 and
   AC7 both raise it. It is `@/lib/server/accounts`', sealed and
   published, and D-WAVE-04 rules it consumed rather than mirrored.
   The accounts barrel states the rule in its own header for the
   two classes it declines to re-export: publishing another
   module's rejection under this module's name invites the
   re-rendering D-50-08 forbids, and a caller branching on the
   denial imports it from the barrel that owns it — getting the
   same class this module throws, which is the whole point of
   consuming it. It also keeps `tests/error-hygiene.test.ts`
   honest: that walk counts every class exported from every barrel,
   so a re-export would be counted twice and the equality would
   move by two for one new class.

   **No message literal is exported.** A test importing its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.

   ── What is NOT here at all: the routes ──
   **D-WAVE-02 drops `app/api/**` from this task.** No path, method,
   request body or status code is published for any of the four
   wave-4 tasks, and `docs/architecture/seams.md` predicts
   addresses that contradict the `Owns` lines three ways — SEAM-81
   publishes a `{ direction: 1 | -1 }` body for a `voteNote` that
   takes no direction. A blind author cannot assert a shape nobody
   published, so the transport boundary is published afterwards, as
   T140's and T110's were.
   ============================================================ */

export type { NotePage, NoteRecord, NoteTarget, NoteTargetKind } from "./types";

/* D-13's boundary. THREE classes: the store fault, AC5's refused body, and D-WAVE-13's
   refused cursor. The fourth decision this module makes — the denial — was another module's
   all along. The reasoning is in `errors.ts` and `guards.ts`. */
export { InvalidCursorError, NoteBodyError, NoteStoreError } from "./errors";

/* AC5's number, published so the criterion can be quantified over it rather than pinned. */
export { MAX_NOTE_BODY } from "./body";

export { listNotes } from "./read";
export { deleteNote, editNote, postNote, voteNote } from "./write";
