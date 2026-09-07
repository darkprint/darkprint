#!/usr/bin/env node
/* ============================================================
   DarkPrint — the seed import, run from a terminal
   Plans the import off `content/`, prints the plan, then writes it
   through the stores under the registry handle.

   ── Running TypeScript ──
   Node strips the types, and `scripts/module-hook.ts` resolves the
   `@/…` alias and the extensionless relative imports the engine
   uses. It is imported first and every `lib/…` import below is
   dynamic, because a static import is evaluated before any
   statement runs and the hook has to be in place before that.

   ── What it does not do ──
   It reads no argument that changes the import. There is no
   `--root`: `lib/content/read.ts` is fixed to `process.cwd()/content`
   and memoizes, so a second root would return the first root's
   answer. `--plan` stops before the write, so the plan can be read
   without a database.
   ============================================================ */

import "./module-hook.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";

/* --------------------- the import, once the hook is in place --------------------- */

const { planImport, runImport } = await import("@/lib/server/seed");
const { createDbClient } = await import("@/lib/db");

const planOnly = process.argv.includes("--plan");

/* `readContent` reads `process.cwd()/content`, so running this from anywhere but the repo
   root reads an archive that is not there and throws from the loader. Said here, once,
   because the loader's message is about a missing directory rather than about a cwd. */
if (!existsSync(join(process.cwd(), "content"))) {
  throw new Error(
    `No \`content/\` directory under ${process.cwd()}. Run this from the repository root: the archive reader resolves \`content/\` against the working directory.`,
  );
}

const plan = await planImport();

console.log(`plan: ${plan.bundles.length} bundles, ${plan.cards.length} cards`);
console.log(`      owner @${plan.registryHandle}`);
for (const bundle of plan.bundles) {
  console.log(`      ${bundle.slug.padEnd(28)} ${bundle.digest}  ${bundle.releases} release`);
}

if (planOnly) {
  console.log("--plan: nothing written.");
} else {
  const client = createDbClient();
  try {
    const result = await runImport(client.db, plan);
    console.log(`imported: created ${result.created}, skipped ${result.skipped}`);
  } finally {
    await client.close();
  }
}
