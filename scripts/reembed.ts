#!/usr/bin/env node
/* ============================================================
   DarkPrint — re-embed every release, from a terminal
   `npm run db:reembed [-- --dry-run] [-- --allow-absent]`

   `reembedRelease` runs at publish and nowhere else, so a change
   to either embedding document leaves every existing vector stale
   until something revisits it. This sweeps the whole archive
   through `reembedAll`, which writes only the rows whose stamp
   disagrees with today's document.

   `--dry-run` compares stamps and encodes nothing, so the count it
   prints is how many rows the real run would write.

   A machine with no encoder writes nothing, and that is an exit 1
   rather than a quiet zero: running this in production without the
   weights would report success over an archive it did not touch.
   `--allow-absent` is for a dry run on such a machine, where the
   stamp comparison is still meaningful.
   ============================================================ */

import "./module-hook.ts";

const { reembedAll } = await import("@/lib/server/search");
const { createDbClient } = await import("@/lib/db");

const dryRun = process.argv.includes("--dry-run");
const allowAbsent = process.argv.includes("--allow-absent");

const client = createDbClient();
try {
  const sweep = await reembedAll(client.db, { dryRun });
  const verb = dryRun ? "would write" : "wrote";
  console.log(`encoder: ${sweep.encoder}`);
  console.log(`releases: ${sweep.releases}`);
  console.log(`${verb}: ${sweep.written} vector rows; unchanged: ${sweep.unchanged}`);
  if (sweep.encoder === "absent" && !allowAbsent) {
    console.error(
      "No encoder in this process: `models/all-MiniLM-L6-v2` or `@huggingface/transformers` " +
        "is missing, so nothing was encoded. Pass --allow-absent to accept a dry count.",
    );
    process.exitCode = 1;
  }
} finally {
  await client.close();
}
