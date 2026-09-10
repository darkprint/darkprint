#!/usr/bin/env node
/* ============================================================
   DarkPrint — rename an account, from a terminal
   `npm run account:rename -- --from <handle> --to <handle> --yes`

   Calls `changeHandle` as the account itself. Nothing is written
   without `--yes`.

   ── why this exists beside `account:retire` ──
   Moving the archive to a new registry handle is a rename, not a
   replacement: `changeHandle` allocates the new name, moves
   `account.handle` and releases the old one in one transaction, so
   every bundle, release, star, fork and note the account holds
   stays where it is and keeps resolving. Retiring the old account
   and importing again destroys all of that, and refuses outright
   when another account's public fork pins a card version the
   archive also ships.

   ── what a rename does change, and it is public ──
   Every URL that carries the handle moves with it, so
   `/blueprints/<old>/<slug>` and `/u/<old>` stop resolving and the
   `<new>` forms start. The old handle goes back to the reservation
   table as `released`, which `checkHandle` reports as reserved and
   refuses forever, so nobody claims it afterwards and the rename
   cannot be undone by renaming back.
   Stored bytes are untouched: a release published before the rename
   keeps the `author:` line it was published with, so an archive
   whose manifests name the new handle needs a fresh release to say
   so.

   ── Running TypeScript ──
   Node strips the types, and `scripts/module-hook.ts` resolves the
   `@/…` alias. It is imported first and every `lib/…` import below
   is dynamic, because a static import is evaluated before any
   statement runs and the hook has to be in place before that.
   ============================================================ */

import "./module-hook.ts";

const { createDbClient, schema } = await import("@/lib/db");
const { eq } = await import("drizzle-orm");
const { resolveOwner, changeHandle } = await import("@/lib/server/accounts");

const args = process.argv.slice(2);

function valueOf(flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

const from = valueOf("--from");
const to = valueOf("--to");
const yes = args.includes("--yes");

if (from === undefined || to === undefined) {
  console.error("usage: npm run account:rename -- --from <handle> --to <handle> --yes");
  process.exit(2);
}

const client = createDbClient();
try {
  const db = client.db;
  const account = await resolveOwner(db, from);
  if (account === undefined) throw new Error(`No account holds the handle \`${from}\`.`);

  /* Named before the confirmation, because the rename is what moves their public URLs. */
  const bundles = await db
    .select({ slug: schema.bundle.slug, visibility: schema.bundle.visibility })
    .from(schema.bundle)
    .where(eq(schema.bundle.ownerId, account.accountId));

  const taken = await resolveOwner(db, to);
  if (taken !== undefined && taken.accountId !== account.accountId) {
    throw new Error(`The handle \`${to}\` is already held by another account.`);
  }

  console.log(`rename @${from} -> @${to}`);
  console.log(`  account            ${account.accountId}`);
  console.log(`  bundles that move  ${bundles.length}`);
  for (const bundle of bundles) {
    console.log(`    ${bundle.visibility.padEnd(8)} /blueprints/${from}/${bundle.slug}  ->  /blueprints/${to}/${bundle.slug}`);
  }
  console.log(`  the handle \`${from}\` is released, which reserves it permanently: no account can claim it again, this one included.`);

  if (!yes) {
    console.log("--yes not given: nothing written.");
  } else {
    const actor = { kind: "account", accountId: account.accountId, handle: from } as const;
    const renamed = await changeHandle(db, actor, account.accountId, to);
    console.log(`renamed: account ${renamed.accountId} now holds @${renamed.author.handle}`);
  }
} finally {
  await client.close();
}
