import { describe as suite, expect, it } from "vitest";

import { REFERENCE_MIGRATIONS } from "./harness.ts";

/* ============================================================
   T005 — the guard on this suite's own escape hatch

   `T005_REFERENCE_MIGRATIONS` points `migrateUp` at a directory
   other than `lib/db/migrations`. It exists for one reason: a blind
   suite has to be shown capable of going red before its green means
   anything, and the only way to do that for a task that publishes no
   functions is to run it against a hand-written reference schema in
   a directory outside the repository.

   Left set, every criterion in this suite would report on that
   reference and the output would be indistinguishable from a real
   run. So this reds whenever it is set.

   It prevents nothing — the variable can still be exported, and the
   suite will still measure the reference. What it does is make a
   reference-mode run **unable to report as a clean one**: the count
   is one short and the red names the variable and the path. That is
   the narrower and honest target for a knob nothing in the tree
   encodes, and it is the difference between "this will not happen
   again" and "this will not be reported as a success".
   ============================================================ */

suite("T005 — this suite is measuring the implementation, not a reference", () => {
  it("T005_REFERENCE_MIGRATIONS is not set", () => {
    expect(
      REFERENCE_MIGRATIONS ?? null,
      `This run is in REFERENCE MODE: every T005 criterion was measured against the migration ` +
        `directory named below rather than against \`lib/db/migrations\`, so none of the greens ` +
        `in this suite is evidence about T005's implementation.\n` +
        `  If this is a deliberate validation run, exactly one test reds — this one — and the ` +
        `handback must say so and give the reference's path.\n` +
        `  If it is not, unset T005_REFERENCE_MIGRATIONS and run again; the result you are ` +
        `looking at is about a file this repository does not ship.`,
    ).toBeNull();
  });
});
