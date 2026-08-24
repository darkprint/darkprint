/* ============================================================
   The one file `npx -y darkprint` runs.

   ── why a bundler, when T220 shipped with plain tsc ──
   T220 was a network client and imported nothing outside its own
   `src`. T270 SHIPS THE ENGINE (D-270-01 C7), and the engine
   imports itself through this repo's `@/` alias — `tsc` emits
   `require("@/lib/core")` verbatim into `dist/lib/server/engine/*.js`
   and Node throws MODULE_NOT_FOUND on it. Measured on the real
   tree, and the reason D-270-06's plain-tsc paragraph was struck
   (D-270-07(2)): the aliases are in modules T270 may not edit, so
   they have to be resolved at BUILD time by something that
   understands them.

   ── nothing is external ──
   `yaml` is bundled in with the rest, so the published artefact is
   one file with no dependencies to install — which is the property
   T220 had for free and this one has to buy. `packages/cli`
   declares `yaml` for local resolution and typechecking; the
   distributable carries no `dependencies` at all.
   ============================================================ */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

await build({
  entryPoints: [join(root, "packages/mcp/src/cli.ts")],
  outfile: join(root, "packages/mcp/dist/cli.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  /* The alias lives here, and `packages/cli/tsconfig.json` is where its `paths` are — the
     same mapping the root config uses, so a bundled build and a typecheck resolve `@/`
     identically rather than through two spellings that can drift apart. */
  tsconfig: join(root, "packages/cli/tsconfig.json"),
  /* NO `banner` shebang: `packages/mcp/src/cli.ts` already opens with one and esbuild keeps
     it, so adding another put `#!/usr/bin/env node` on line 2 as a syntax error. Found by
     running the emitted file rather than by reading it. */
  legalComments: "inline",
});
