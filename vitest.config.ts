import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The core engine (`lib/core/`) is plain isomorphic TypeScript — no React, no
 * Next runtime — so the default node environment is all it needs.
 *
 * `components/**` is in the net for the same reason: what is tested is the
 * plain-TypeScript half that sits beside a component rather than inside it
 * (`components/panes/model.ts`, `components/profile/tabs.ts`), or a render through
 * `renderToStaticMarkup`, which needs no DOM either. The second example read
 * `components/build/path-state.ts` until the owner deleted `/build` and its component tree
 * on 2026-09-06; an example a reader cannot open teaches nothing, so it was replaced with
 * another file of the same shape rather than left as a name.
 *
 * ── `{ts,tsx}`, and why the glob had to widen ──
 * It collected `*.test.ts` only. Three files in this tree are `.test.tsx` —
 * `EvidenceLayers`, `CreateEntry` and `McpJourney` — and the runner had never seen any of
 * them: they typechecked, they linted, they sat beside the components they name, and the
 * suite reported a file count three short of what is on disk. One of the three had drifted
 * far enough to assert on markup its component cannot produce in a static render, which is
 * the failure mode a guard that never runs always ends in.
 *
 * Extension is not a proxy for whether a test needs a DOM. It is a proxy for whether the
 * file contains JSX, and none of these do enough of it to need one.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: [
      /* packages/** carries T220's distributable stdio server (D-220-08). Without this glob a
         test colocated there is silently uncollected — the failure this file's own header records
         against app/**, arriving at a new root. */
      "packages/**/*.test.{ts,tsx}",
      "lib/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
      /* `app/**` was absent until T090 reported it, and its absence is this file's own recorded
         failure mode: an uncollected suite runs zero tests and reads as green. Four tasks own route
         files under `app/` and any colocated test beside one was never going to be collected.
         Added before a task relies on it rather than after. */
      "app/**/*.test.{ts,tsx}",
      /* The backend's test tree, and the one glob that is not beside the code it tests.
         `docs/ORCHESTRATION.md` has the tests for a backend task written blind, in a
         separate worktree branched before the implementation exists, so they cannot sit
         next to a file that is not there yet. `tests/server/**` belongs to the test branch
         alone, which is also what keeps the two branches conflict-free at merge time.
         Collected here rather than in either branch's own config: a worktree that cannot
         run its own suite reports zero tests and calls it green. */
      "tests/**/*.test.ts",
    ],
    environment: "node",
    /* The default 5s is a liveness guard, and under this repository's own parallel
       agent runs it started firing as a correctness failure instead. `stage-labels`
       is 64 real graph-layout assertions taking ~10s together on an idle machine;
       with nine worktree sessions competing for ten cores, one of them crossed 5s and
       reported a timeout for a test that was never wrong. 20s keeps the guard — a
       genuine hang still fails — while leaving four times the headroom that contention
       actually needs. Raised here rather than per-file so no task inherits a red gate
       it did not cause. */
    testTimeout: 20000,
    /* Raised with `testTimeout` and for the same reason, which the original raise missed: a
       `beforeAll` that creates a scratch database can cross the 10s default under load, and a
       hook failure runs no test — so vitest prints `Tests 75 passed (75)` alongside two failed
       files and exit 1. A run read off the test total then looks green while the gate is red.
       Found by T090's blind author. */
    hookTimeout: 30000,
    /* The two raises above bought headroom against contention and did not buy enough,
       because the contention is not for the CPU. Vitest's default worker count is
       `max(availableParallelism - 1, 1)`, nine on this ten-core machine, and every one of
       those workers points a DB-backed suite at the same Postgres container
       `compose.yaml` brings up: `tests/support/db.ts` issues a `CREATE DATABASE` plus a
       full `migrateUp` for each scratch database it hands out.

       Measured 2026-08-31 on this tree. At the default worker count the full run produced
       12 to 30 timeouts with zero assertion failures, and every file that timed out passed
       when run on its own, which is what says the timeouts were contention and not a
       defect. They also compound: a file killed by `testTimeout` never reaches its
       `afterAll`, so its scratch database survives, and the next run competes with the
       leftovers of the last one. At `--maxWorkers=3` the same tree passed 519 files / 9452
       tests with 0 timeouts.

       A fixed count rather than a percentage of cores, because what saturates is the one
       Postgres. A percentage would restore the failure on any machine with more cores
       pointed at the same database. `--maxWorkers` on the command line still overrides
       this, so a session that has the database to itself can raise it. */
    maxWorkers: 3,
  },
});
