import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The core engine (`lib/core/`) is plain isomorphic TypeScript — no React, no
 * Next runtime — so the default node environment is all it needs.
 *
 * `components/**` is in the net for the same reason: what is tested is the
 * plain-TypeScript half that sits beside a component rather than inside it
 * (`components/panes/model.ts`, `components/build/path-state.ts`), or a render through
 * `renderToStaticMarkup`, which needs no DOM either.
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
      "lib/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
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
  },
});
