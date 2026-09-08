#!/usr/bin/env node
/* ============================================================
   DarkPrint — retire an account, from a terminal
   `npm run account:retire -- --handle <handle> [--take-private] --yes`

   Prints `planDeletion` for the account, then calls `deleteAccount`
   as that account. Nothing is written without `--yes`.

   ── what `deleteAccount` destroys and what it keeps ──
   Its private bundles go, with their releases and the ballots cast
   on them, and so do its private card versions that no surviving
   public release pins. Its saves, note votes and ballots go. The
   notes it wrote are tombstoned. Its API keys are revoked and its
   handle reservation released. The account row stays as a tombstone
   with its handle, so the author line inside every card it published
   still names something. Everything PUBLIC stays: published bundles,
   their releases, public card versions, the stars other people put
   on them, and any fork, whose lineage line keeps naming the handle.

   ── `--take-private`, and the one write no module publishes a verb for ──
   Retiring a registry account whose holdings are all public would
   therefore tombstone the row and leave every bundle and card in
   place, still listed under the handle. `--take-private` sets each of
   the account's bundles private through `setBundleVisibility`, as
   the owner, and then sets its card versions private with a direct
   update of `card_version.visibility`, because the cards barrel
   publishes no visibility verb. `deleteAccount` then destroys them
   as private holdings. A card version another account's public
   release pins survives regardless, and it is listed first, because
   a later archive import conflicts on exactly those rows.

   Once the account is retired the stars, forks and notes on the old
   rows go with the rows: a star on a destroyed bundle counts on no
   page, a fork's lineage line resolves to nothing, and a note on a
   destroyed bundle has no page left to appear on. The rows behind
   the stars and the notes stay in their tables, keyed by an id
   nothing resolves any more.

   ── Running TypeScript ──
   Node strips the types, and `scripts/module-hook.ts` resolves the
   `@/…` alias. It is imported first and every `lib/…` import below
   is dynamic, because a static import is evaluated before any
   statement runs and the hook has to be in place before that.
   ============================================================ */

import "./module-hook.ts";

const { createDbClient, schema } = await import("@/lib/db");
const { and, eq, sql } = await import("drizzle-orm");
const { resolveOwner } = await import("@/lib/server/accounts");
const { setBundleVisibility } = await import("@/lib/server/archive");
const { deleteAccount, planDeletion, DeletionRefusedError } = await import("@/lib/server/lifecycle");

const args = process.argv.slice(2);

function valueOf(flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

const handle = valueOf("--handle");
const yes = args.includes("--yes");
const takePrivate = args.includes("--take-private");

if (handle === undefined) {
  console.error("usage: npm run account:retire -- --handle <handle> [--take-private] --yes");
  process.exit(2);
}

const client = createDbClient();
try {
  const db = client.db;
  const account = await resolveOwner(db, handle);
  if (account === undefined) throw new Error(`No account holds the handle \`${handle}\`.`);
  const actor = { kind: "account", accountId: account.accountId, handle } as const;

  const printPlan = async (label: string): Promise<void> => {
    const plan = await planDeletion(db, actor, account.accountId);
    console.log(`${label}`);
    console.log(`  account            ${plan.accountId}  (@${plan.handle ?? "no handle"})`);
    console.log(`  private bundles    ${plan.privateBundles}   destroyed`);
    console.log(`  private cards      ${plan.privateCards}   destroyed`);
    console.log(`  published bundles  ${plan.publishedBundles}   kept`);
    console.log(`  published cards    ${plan.publishedCards}   kept`);
  };

  const bundles = await db
    .select({ id: schema.bundle.id, slug: schema.bundle.slug, visibility: schema.bundle.visibility })
    .from(schema.bundle)
    .where(eq(schema.bundle.ownerId, account.accountId));

  /* A card version some OTHER account's public release pins survives `deleteAccount`
     whatever its visibility, and a later `seed:import` refuses on it when the archive's
     bytes differ. Named up front so the operator sees the collision before confirming. */
  const pinnedElsewhere = await db
    .select({ cardId: schema.cardVersion.cardId, version: schema.cardVersion.version })
    .from(schema.cardVersion)
    .where(
      and(
        eq(schema.cardVersion.ownerId, account.accountId),
        sql`exists (
          select 1 from ${schema.release} r
          join ${schema.bundle} b on b.id = r.bundle_id
          where b.visibility = 'public'
            and b.owner_id <> ${account.accountId}::uuid
            and (${schema.cardVersion.cardId} || '@' || ${schema.cardVersion.version}) = any(r.card_refs)
        )`,
      ),
    );

  await printPlan(`plan for @${handle}`);
  console.log(`  bundles owned      ${bundles.length}`);
  for (const bundle of bundles) console.log(`    ${bundle.visibility.padEnd(8)} ${bundle.slug}`);
  if (pinnedElsewhere.length > 0) {
    console.log(`  card versions another account's public release pins, which survive: ${pinnedElsewhere.length}`);
    for (const card of pinnedElsewhere) console.log(`    ${card.cardId}@${card.version}`);
  }

  const publicBundles = bundles.filter((bundle) => bundle.visibility === "public");
  if (publicBundles.length > 0 && !takePrivate) {
    console.log(
      "deleteAccount keeps everything published, so with the figures above it tombstones the " +
        "account and leaves the published rows listed under its handle. Pass --take-private to " +
        "set its bundles and card versions private first and destroy them in the same run.",
    );
  }

  if (!yes) {
    console.log("--yes not given: nothing written.");
  } else {
    if (takePrivate) {
      for (const bundle of publicBundles) {
        const flipped = await setBundleVisibility(db, actor, bundle.id, "private");
        if (flipped === undefined) throw new Error(`setBundleVisibility answered undefined for ${bundle.slug}.`);
      }
      const cards = await db
        .update(schema.cardVersion)
        .set({ visibility: "private" })
        .where(and(eq(schema.cardVersion.ownerId, account.accountId), eq(schema.cardVersion.visibility, "public")))
        .returning({ id: schema.cardVersion.id });
      console.log(`set private: ${publicBundles.length} bundles, ${cards.length} card versions`);
      await printPlan("plan after --take-private");
    }
    await deleteAccount(db, actor, account.accountId);
    const remaining = await db
      .select({ id: schema.cardVersion.id })
      .from(schema.cardVersion)
      .where(eq(schema.cardVersion.ownerId, account.accountId));
    console.log(`retired @${handle}; card versions still owned by the tombstone: ${remaining.length}`);
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
