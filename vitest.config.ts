import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The core engine (`lib/core/`) is plain isomorphic TypeScript — no React, no
 * Next runtime — so the default node environment is all it needs.
 *
 * `components/**` is in the net for the same reason: what is tested is the
 * plain-TypeScript half that sits beside a component rather than inside it
 * (`components/panes/model.ts`, `components/build/path-state.ts`). Only `.test.ts` files
 * are collected, and a test that reaches into a `.tsx` module takes the data and the pure
 * functions it exports (`STEPS`, `classifyBundle`) without rendering anything, so the
 * suite still needs no DOM.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
