#!/usr/bin/env node
/* ============================================================
   DarkPrint — delete one bundle, from a terminal
   `npm run bundle:delete -- --owner <handle> --slug <slug> [--take-private] --yes`

   Resolves the bundle by owner handle and slug, prints what the
   deletion would destroy, and deletes it through `deleteBundle`
   acting as the owner. Nothing is written without `--yes`.

   ── what `deleteBundle` refuses ──
   A public bundle carrying a release is refused as published: its
   bytes were the world's to read. The door reads the bundle's
   current visibility, and `setBundleVisibility` lets an owner take
   a released bundle private, so `--take-private` performs that step
   first, as the owner and through the same barrel the site uses,
   and then deletes in the same run. Without the flag a released
   public bundle is reported and left alone.

   ── what goes with the bundle ──
   Its releases, the notes and note votes on it, the saves that
   bookmark it, the ballots cast on it and its star and download
   counters. A fork keeps its own bytes and its lineage line stops
   resolving. Card versions are not touched: they belong to the
   account, and another release may pin them.

   ── Running TypeScript ──
   Node strips the types, and `scripts/module-hook.ts` resolves the
   `@/…` alias. It is imported first and every `lib/…` import below
   is dynamic, because a static import is evaluated before any
   statement runs and the hook has to be in place before that.
   ============================================================ */

import "./module-hook.ts";

const { createDbClient, schema } = await import("@/lib/db");
const { and, eq } = await import("drizzle-orm");
const { resolveOwner } = await import("@/lib/server/accounts");
const { getBundle, listReleases, setBundleVisibility } = await import("@/lib/server/archive");
const { deleteBundle, DeletionRefusedError } = await import("@/lib/server/lifecycle");

const args = process.argv.slice(2);

function valueOf(flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

const owner = valueOf("--owner");
const slug = valueOf("--slug");
const yes = args.includes("--yes");
const takePrivate = args.includes("--take-private");

if (owner === undefined || slug === undefined) {
  console.error("usage: npm run bundle:delete -- --owner <handle> --slug <slug> [--take-private] --yes");
  process.exit(2);
}

const client = createDbClient();
try {
  const db = client.db;
  const account = await resolveOwner(db, owner);
  if (account === undefined) throw new Error(`No account holds the handle \`${owner}\`.`);
  const bundle = await getBundle(db, account.accountId, slug);
  if (bundle === undefined) throw new Error(`\`${owner}\` owns no bundle with the slug \`${slug}\`.`);

  const releases = await listReleases(db, bundle.id);
  const notes = await db
    .select({ id: schema.note.id })
    .from(schema.note)
    .where(and(eq(schema.note.targetKind, "blueprint"), eq(schema.note.targetId, bundle.id)));
  const saves = await db
    .select({ id: schema.save.id })
    .from(schema.save)
    .where(and(eq(schema.save.targetKind, "blueprint"), eq(schema.save.targetId, bundle.id)));
  const ballots = await db
    .select({ id: schema.ballot.id })
    .from(schema.ballot)
    .where(eq(schema.ballot.bundleId, bundle.id));

  console.log(`bundle    ${owner}/${slug}  (${bundle.id})`);
  console.log(`visible   ${bundle.visibility}`);
  console.log(`releases  ${releases.length}`);
  for (const release of releases) console.log(`          ${release.version.padEnd(10)} ${release.digest}`);
  console.log(`notes     ${notes.length}`);
  console.log(`saves     ${saves.length}`);
  console.log(`ballots   ${ballots.length}`);

  const published = bundle.visibility === "public" && releases.length > 0;
  if (published && !takePrivate) {
    console.error(
      "deleteBundle refuses a public bundle with a release: everything published stays. " +
        "Pass --take-private to set it private first, as the owner, and delete it in the same run.",
    );
    process.exitCode = 1;
  } else if (!yes) {
    console.log(
      published
        ? "--yes not given: nothing written. With --yes the bundle is taken private and then deleted."
        : "--yes not given: nothing written. With --yes the bundle and the rows above are deleted.",
    );
  } else {
    const actor = { kind: "account", accountId: account.accountId, handle: owner } as const;
    if (published) {
      const flipped = await setBundleVisibility(db, actor, bundle.id, "private");
      if (flipped === undefined) throw new Error("setBundleVisibility answered undefined for the owner's own bundle.");
      console.log("visibility set to private");
    }
    await deleteBundle(db, actor, bundle.id);
    console.log(`deleted ${owner}/${slug}`);
  }
} catch (err) {
  if (err instanceof DeletionRefusedError) {
    console.error(`${err.kind}: ${err.message}`);
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  await client.close();
}
