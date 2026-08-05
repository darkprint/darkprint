import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored by `npx impeccable install`. It is a third-party skill's own source,
    // not this project's, and it ships its own lint config; running ours over it
    // reports warnings nobody here can act on.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;
