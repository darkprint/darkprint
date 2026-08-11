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
    ],
    environment: "node",
  },
});
