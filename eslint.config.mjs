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
    // Vendored third-party skills — `content-reorg` since `impeccable` was deleted on
    // 2026-08-11. Their source is not this project's and each ships its own lint config;
    // running ours over it reports warnings nobody here can act on. The glob stays as long
    // as anything is vendored under it, which `skills-lock.json` and the AGENTS.md note
    // above it both depend on.
    ".claude/skills/**",
    // The design hand-offs: a prototype HTML file each, plus the runtime they ship with.
    // Their own READMEs say they are design references "not production code to copy", and
    // they are vendored verbatim so the rendered result can be compared against what gets
    // built. Linting somebody else's bundled prototype reports React 17 idioms nobody here
    // is going to fix. Matched by prefix so the next hand-off needs no edit here.
    "design_handoff_*/**",
  ]),
]);

export default eslintConfig;
