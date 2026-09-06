/* ============================================================
   T120 — the instruments, checked before anything rests on them

   Not an acceptance criterion. Every cell in this suite is a
   statement about what a lifecycle operation did to state that
   the PRODUCT'S OWN WRITERS put there, and a fixture that
   silently writes nothing turns every one of those cells into a
   green about an empty database.

   `wave-blind.md`: "an all-green suite is a claim about an
   instrument too — show it still fires before you report it."
   This file is where that is shown, and it runs GREEN in the
   blind position because it never touches `@/lib/server/lifecycle`.
   A red here is a broken FIXTURE, and every cell says so in its
   own message rather than making a reader infer it.

   The census is checked the same way, and for a sharper reason:
   `accountCensus` derives its table list from the catalogue, and
   a derivation that finds nothing reports zero rows for every
   table — which reads exactly like a deletion that worked.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RecordedSetup } from "./contract";
import {
  accountCensus,
  accountRow,
  apiKey,
  ballot,
  bareCardIds,
  bundleRow,
  cardRows,
  note,
  publishBundle,
  releasesOf,
  report,
  reservationRow,
  save,
  scratchDatabase,
  seedAccount,
  seedHandlelessAccount,
  star,
  tablesReferencingAccount,
  wholeDatabaseCensus,
  type Account,
  type Published,
  type Scratch,
} from "./fixtures";

interface World {
  scratch: Scratch;
  owner: Account;
  stranger: Account;
  handleless: Account;
  publicBundle: Published;
  privateBundle: Published;
}

const world = new RecordedSetup<World>("the T120 instrument fixture");

beforeAll(async () => {
  await world.run(async () => {
    const scratch = await scratchDatabase("instruments");
    const owner = await seedAccount(scratch, "t120-inst-owner");
    const stranger = await seedAccount(scratch, "t120-inst-stranger");
    const handleless = await seedHandlelessAccount(scratch);
    const publicBundle = await publishBundle(scratch, owner, "inst-public", "public");
    const privateBundle = await publishBundle(scratch, owner, "inst-private", "private");
    return { scratch, owner, stranger, handleless, publicBundle, privateBundle };
  });
}, 120_000);

afterAll(async () => {
  await world.optional()?.scratch.drop();
});

/* ============================================================
   the premise under D-120-19's recorded latent hazard

   Handback B is RECORDED LATENT rather than charged: a ghost's
   note under a bundle that has gone private aborts the deletion
   with T170's class, because `deleteNote` resolves the note's
   parent and refuses one it cannot read. It is latent because
   NOTHING IN THE PRODUCT FLIPS `bundle.visibility` — a bundle is
   public or private from its first publish and stays there.

   That is a claim about the tree, and a claim about the tree
   goes stale silently. So it is driven rather than asserted:
   every `.ts`/`.tsx` under `lib/`, `app/` and `scripts/` is
   scanned for a drizzle update against the bundle table, and
   every such site must be one whose `set(...)` leaves
   `visibility` alone. The day a visibility verb ships, this cell
   reds and the latent hazard becomes live — which is exactly
   when somebody needs to be told.
   ============================================================ */

const SOURCE_ROOTS = ["lib", "app", "scripts"] as const;
const REPO = fileURLToPath(new URL("../../../", import.meta.url));

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
        continue;
      }
      /* Colocated tests are excluded: a fixture is entitled to write any column, and the
         claim is about what the PRODUCT does. `tests/**` is outside these roots already. */
      if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  for (const root of SOURCE_ROOTS) walk(join(REPO, root));
  return out;
}

describe("T120 premise — D-120-19's latent hazard stays latent", () => {
  it("no shipped writer sets `bundle.visibility`, which is why handback B is latent", () => {
    const offenders: string[] = [];
    let sites = 0;
    for (const file of sourceFiles()) {
      const text = readFileSync(file, "utf8");
      /* Each update against the bundle table, with the 400 characters that follow it — long
         enough to reach the `set({...})` that goes with it and short enough not to run into
         the next statement. */
      for (const match of text.matchAll(/\.update\(\s*schema\.bundle\s*\)/g)) {
        sites += 1;
        const window = text.slice(match.index ?? 0, (match.index ?? 0) + 400);
        if (/\bvisibility\s*:/.test(window)) {
          offenders.push(`${file.slice(REPO.length)} @ ${match.index}`);
        }
      }
    }

    /* Fail closed. A scan that finds no update site at all is a broken scan reporting the
       same all-clear as a clean tree — T120's own transfer holds two of them, so zero is
       impossible on a tree where this task is merged. */
    expect(
      sites,
      "the scan found no `update(schema.bundle)` site anywhere. T120's own `transferBundle` " +
        "holds two, so this is a broken instrument reporting an all-clear.",
    ).toBeGreaterThanOrEqual(2);

    expect(
      offenders,
      "a shipped writer now sets `bundle.visibility`. D-120-19 records handback B as LATENT " +
        "on exactly this premise: a ghost's note under a bundle that went private aborts the " +
        "deletion with T170's `NoteStoreError`, because `deleteNote` resolves the note's " +
        "parent and refuses one it cannot read. The hazard is live from this commit.",
    ).toEqual([]);
  });
});

describe("T120 instruments — the fixtures write what the cells will look for", () => {
  it("seedAccount leaves an account row AND an active reservation, which is what AC4 reads", async () => {
    const { scratch, owner } = world.require();

    const row = await accountRow(scratch, owner.accountId);
    expect(row, `seedAccount(${owner.handle}) left no account row`).toBeDefined();
    expect(row?.handle).toBe(owner.handle);

    const reservation = await reservationRow(scratch, owner.handle);
    expect(
      reservation,
      `seedAccount(${owner.handle}) left no handle_reservation row. AC4 is a statement about ` +
        `that row: \`releaseHandle\` updates \`where status = 'active'\` and does NOTHING when ` +
        `there is no row, so an account seeded without one makes AC4 pass against a module ` +
        `that never called anything.`,
    ).toBeDefined();
    expect(reservation?.status).toBe("active");
    expect(reservation?.account_id).toBe(owner.accountId);
    expect(reservation?.released_at).toBeNull();
  });

  it("seedAccount fills the profile fields D-120-01 B3 rules scrubbed", async () => {
    const { scratch, owner } = world.require();
    const row = await accountRow(scratch, owner.accountId);

    /* A tombstone cell asserting `email === null` after a deletion is VACUOUS if the fixture
       never wrote an email. Each of the five is asserted non-null here, so the scrub cell
       downstream measures a change rather than a default. */
    for (const column of ["email", "display_name", "bio", "avatar_hue"]) {
      expect(
        row?.[column],
        `account.${column} is unset on a freshly seeded account, so every D-120-01 B3 cell ` +
          `asserting it is scrubbed would pass against a module that scrubbed nothing.`,
      ).not.toBeNull();
    }
    /* `github_id` is what D-120-01 B1 scrubs to `deleted:<uuid>`; it must not already start
       that way, or the scrub cell is measuring the fixture. */
    expect(String(row?.github_id).startsWith("deleted:")).toBe(false);
  });

  it("seedHandlelessAccount reaches T050 AC1's state — a row, no handle, no reservation", async () => {
    const { scratch, handleless } = world.require();
    const row = await accountRow(scratch, handleless.accountId);
    expect(row, "seedHandlelessAccount left no account row").toBeDefined();
    expect(
      row?.handle,
      "D-120-08 is entirely about an account that holds no handle. A fixture whose `handle` " +
        "is non-null cannot reach the criterion.",
    ).toBeNull();

    const reservations = await scratch.pool.query(
      `select count(*)::text as n from "handle_reservation" where account_id = $1`,
      [handleless.accountId],
    );
    expect(reservations.rows[0]?.n).toBe("0");
  });

  it("publishBundle really publishes — a bundle row, a release, a digest, and stored cards", async () => {
    const { scratch, owner, publicBundle } = world.require();

    const row = await bundleRow(scratch, publicBundle.bundleId);
    expect(row, "publishBundle left no bundle row").toBeDefined();
    expect(row?.owner_id).toBe(owner.accountId);
    expect(row?.slug).toBe("inst-public");
    expect(row?.visibility).toBe("public");

    const releases = await releasesOf(scratch, publicBundle.bundleId);
    expect(releases.length).toBe(1);
    expect(releases[0].digest).toBe(publicBundle.digest);
    expect(
      publicBundle.digest,
      "AC1 compares this string before and after a transfer. An empty or absent digest makes " +
        "that comparison trivially true.",
    ).toMatch(/^sha256:[0-9a-f]{64}$/);

    const cards = await cardRows(scratch, bareCardIds(publicBundle.corpus));
    expect(
      cards.length,
      "the corpus pins cards and none of them reached `card_version`, so every AC5 and AC6 " +
        "cell would be quantifying over an empty set",
    ).toBeGreaterThan(0);
    for (const card of cards) expect(card.owner_id).toBe(owner.accountId);
  });

  it("a private publish stores PRIVATE cards, which is what AC6 and D-120-11 are about", async () => {
    const { scratch, privateBundle } = world.require();
    const row = await bundleRow(scratch, privateBundle.bundleId);
    expect(row?.visibility).toBe("private");

    /* `publish` sets each card's visibility to the BUNDLE's. Asserted rather than assumed:
       D-120-11 moves the destruction predicate off `visibility`, and a suite that never
       checked the fixture's visibility could not tell the two predicates apart at all. */
    const releases = await releasesOf(scratch, privateBundle.bundleId);
    expect(releases.length).toBe(1);
  });

  it("the five community writers each leave a row for the account that acted", async () => {
    const { scratch, stranger, publicBundle } = world.require();

    const before = await accountCensus(scratch, stranger.accountId);

    await star(scratch, stranger, { kind: "blueprint", refId: publicBundle.bundleId });
    await save(scratch, stranger, { kind: "blueprint", refId: publicBundle.bundleId });
    await note(scratch, stranger, { kind: "blueprint", refId: publicBundle.bundleId }, "a note");
    await ballot(scratch, stranger, publicBundle.bundleId);
    await report(scratch, stranger, publicBundle.digest);
    await apiKey(scratch, stranger);

    const after = await accountCensus(scratch, stranger.accountId);

    /* Each writer named with the table it must have touched. A single "the census grew"
       assertion would pass with five of the six silently doing nothing.

       `ballot` names the fixture rather than a module, and that is a real weakening of this
       row alone: Q14 deleted `castBallot`, so the row this cell checks for is one `fixtures.ts`
       inserts directly and not one the product can produce. The cell is kept because what it
       is a premise FOR is unchanged — D-120-13 rules the ballot row deleted with the account,
       and `cascade.test.ts` needs the row to be there before it can watch it go. */
    const owed: readonly [string, string][] = [
      ["target_actor.account_id", "toggleStar"],
      ["save.account_id", "saveTarget"],
      ["note.account_id", "postNote"],
      ["ballot.account_id", "fixtures.ballot (no published writer since Q14)"],
      ["run_report.account_id", "submitReport"],
      ["api_key.account_id", "issueKey"],
    ];
    for (const [key, writer] of owed) {
      expect(
        after[key] ?? -1,
        `${writer} left no row in ${key.split(".")[0]}. Every D-120-13 cell about that table ` +
          `would then be a green about a table the fixture never populated.`,
      ).toBeGreaterThan(before[key] ?? 0);
    }
  });

  it("the census derives its tables from the catalogue and finds every one that reaches account", async () => {
    const { scratch, stranger } = world.require();
    const refs = await tablesReferencingAccount(scratch);

    /* A derivation that finds nothing reports zero rows for every table, which reads exactly
       like a deletion that worked. Fail closed, the way `tests/support/db.ts` does. */
    expect(
      refs.length,
      "no foreign key into `account` was found. The census is derived from the catalogue, and " +
        "an empty derivation makes every 'the rows are gone' cell vacuously green.",
    ).toBeGreaterThan(0);

    const census = await accountCensus(scratch, stranger.accountId);
    expect(Object.keys(census).sort()).toEqual(refs.map((r) => `${r.table}.${r.column}`).sort());

    /* D-120-13 rules NINE tables plus `audit`; the structure is what forced the tombstone, so
       the delete rule is part of the premise rather than a detail. A table that arrives with
       `cascade` would change what deletion has to do, and this reds on the day it does. */
    const cascading = refs.filter((r) => r.deleteRule.toUpperCase() !== "NO ACTION");
    expect(
      cascading,
      "a foreign key into `account` no longer says NO ACTION. D-120-01 rules the tombstone " +
        "BECAUSE the structure refuses a row delete; a cascading key would change that premise " +
        "and this suite's whole reading of AC5 with it.",
    ).toEqual([]);
  });

  it("the whole-database census is non-empty and moves when a row is written", async () => {
    const { scratch, stranger, publicBundle } = world.require();

    /* AC3's "before anything moves" control is a diff of this census across a refusal. A
       census that cannot SEE a write reports "nothing moved" about a module that moved
       everything — the disagreeing control has to disagree at least once. */
    const before = await wholeDatabaseCensus(scratch);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    expect(before.account).toBeGreaterThan(0);

    await note(scratch, stranger, { kind: "blueprint", refId: publicBundle.bundleId }, "second");
    const after = await wholeDatabaseCensus(scratch);

    expect(
      after.note,
      "the whole-database census did not move across a write it should have seen, so it cannot " +
        "serve as AC3's nothing-moved control.",
    ).toBe(before.note + 1);
  });
});
