import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * The core engine (`lib/core/`) is plain isomorphic TypeScript — no React, no
 * Next runtime — so the default node environment is all it needs.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
