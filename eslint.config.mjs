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
    // The distributable T270 bundles with esbuild (`packages/cli/build.mjs`), gitignored by
    // `packages/mcp/.gitignore`. It is generated, minifiable, third-party code in part — it
    // carries a bundled `yaml` — and linting it reports 33 problems nobody here can act on.
    // Added when the build first produced output: before T270 nothing ever ran that build,
    // so the directory did not exist and the glob had nothing to match.
    "packages/*/dist/**",
    // `.claude/skills/**` was ignored here while two third-party skills were vendored in
    // it, on the grounds that somebody else's source ships its own lint config and running
    // ours over it reports warnings nobody here can act on. Both were deleted on
    // 2026-08-11 and the directory with them, so the glob had nothing left to match. If a
    // skill is ever vendored under `.claude/` again it wants this line back, and the
    // AGENTS.md note on `skills-lock.json` says what else has to come back with it.
    // The design hand-offs: a prototype HTML file each, plus the runtime they ship with.
    // Their own READMEs say they are design references "not production code to copy", and
    // they are vendored verbatim so the rendered result can be compared against what gets
    // built. Linting somebody else's bundled prototype reports React 17 idioms nobody here
    // is going to fix. Matched by prefix so the next hand-off needs no edit here.
    "design_handoff_*/**",
  ]),
]);

export default eslintConfig;
