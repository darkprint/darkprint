/* ============================================================
   T190 — `enqueueRepinEvents`, the repin source

   D-190-04 publishes it and rules the derivation:

     "Repin: `enqueueRepinEvents(db, cardId, version)` is published
      and the module derives the recipients — owners of bundles any
      of whose releases pin any version of that card, consuming
      `release.card_refs` + `@/lib/core`'s ref helpers, private
      bundles included (the recipient is the pinner; AC1's
      invisibility rule is not in play). Its production wiring is
      DEFERRED to the orchestrator's publish-path visit at merge,
      the F4.2 pattern, and recorded as a gap until then."

   So this file drives the verb directly, which is the whole surface
   there is: nothing calls it yet, by ruling, and a cell reaching for
   a production call site would be asserting against a gap the
   orchestrator has already recorded.

   ── the card is DISCOVERED, never chosen ──
   Every `cardId` and `version` below is read out of the
   `release.card_refs` the published release actually carries, and
   parsed with `@/lib/core`'s own `parseCardRef`. A ref this file
   invented would exercise "an unknown card notifies nobody" while
   claiming to exercise the derivation.

   ── the subject, reported as unpublished and then RULED ──
   This file was written asserting nothing about the subject's keys,
   because D-190-04 ruled the recipients and the verb and said
   nothing about the shape. That gap was charged rather than
   guessed at, and D-190-07(1) closed it:

     "the repin SUBJECT is `{ cardId: string, version: string }`,
      exactly those two keys — it is the one subject the MODULE
      derives rather than a caller supplying, so its shape is
      contract; the digest over it gives one row per recipient per
      new version, which is the idempotency the kind needs, and two
      versions of one card are two rows by construction. The mock's
      `{cardId, from, to}` was an ingress payload for a route
      D-190-05 struck and is not this."

   So the subject IS asserted now, and it is asserted as an
   EQUALITY over the key set rather than as a containment: `from`
   and `to` are exactly the extra keys the mock's shape would have brought,
   and a subject carrying them digests differently for one repin
   depending on where the reader's copy happened to sit — which is
   the per-recipient duplication the two-key shape exists to
   prevent.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { parseCardRef } from "@/lib/core";
import { publishBundle, resolvingCorpus, seedAccount, type Account } from "../t110/fixtures";
import {
  type Scratch,
  bind,
  deferred,
  dropScratchDatabases,
  mark,
  queueRows,
  scratchDatabase,
  setPreferencesColumn,
} from "./contract";

interface RepinWorld {
  scratch: Scratch;
  /** Publishes a PUBLIC bundle pinning `card`. */
  pinner: Account;
  /** Publishes a PRIVATE bundle pinning the same card — D-190-04 includes them. */
  privatePinner: Account;
  /** Publishes nothing at all. */
  bystander: Account;
  card: { id: string; version: string };
}

const setup = deferred<RepinWorld>(async () => {
  const scratch = await scratchDatabase("repin");
  const corpus = resolvingCorpus();

  const pinner = await seedAccount(scratch, mark("rp").toLowerCase());
  const privatePinner = await seedAccount(scratch, mark("rq").toLowerCase());
  const bystander = await seedAccount(scratch, mark("rb").toLowerCase());

  const published = await publishBundle(scratch, pinner, corpus, "t190-pins", "1.0.0", "public");
  await publishBundle(scratch, privatePinner, corpus, "t190-pins-priv", "1.0.0", "private");

  /* The card is read off the release the publish actually wrote, never chosen here. */
  const [row] = await scratch.query("select card_refs from release where id = $1", [
    published.releaseId,
  ]);
  const refs = (row?.card_refs ?? []) as string[];
  const card = refs.map((ref) => parseCardRef(ref)).find((parsed) => parsed !== undefined);
  if (card === undefined) {
    throw new Error(
      `The published release carries no parseable card ref (card_refs: ${JSON.stringify(refs)}), ` +
        `so there is no card to repin and every cell below would be about an unknown one.`,
    );
  }

  for (const account of [pinner, privatePinner, bystander]) {
    await setPreferencesColumn(scratch, account.accountId, { repin: true });
  }
  return { scratch, pinner, privatePinner, bystander, card };
});

afterAll(async () => {
  await dropScratchDatabases();
});

/**
 * Arm every account in the shared world with `repin: true`, at the START of each cell.
 *
 * This file shares ONE scratch database and ONE published upstream across its cells, because
 * publishing two bundles through T100 per cell would dominate its runtime. Shared fixtures are
 * fine; shared MUTABLE state restored at the END of a cell is not, and that is what this
 * replaces.
 *
 * The `repin` OFF cell below used to set the preference false and put it back on its last
 * line. That restore does not run when the cell FAILS — and the cell fails exactly when the
 * preference gate is broken, which is the one moment it matters. Four later cells would then
 * red with "an account that pins the card was not notified", pointing at the derivation, while
 * the real cause was a leftover boolean two cells up. A red that reports a plausible wrong
 * cause is worse than a red that reports none: it sends the implementer to the wrong file with
 * a confident message in hand.
 *
 * So no cell here depends on another cell's cleanup. Each one states what it needs.
 */
async function armed(world: RepinWorld): Promise<RepinWorld> {
  for (const account of [world.pinner, world.privatePinner, world.bystander]) {
    await setPreferencesColumn(world.scratch, account.accountId, { repin: true });
  }
  return world;
}

describe("T190: `enqueueRepinEvents` notifies the accounts that pin the card", () => {
  it("the owner of a bundle pinning the card gets exactly one row", async () => {
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch, world.pinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.9");

    const added = (await queueRows(world.scratch, world.pinner.accountId)).slice(before.length);
    expect(
      added.length,
      `\`enqueueRepinEvents(db, "${world.card.id}", "9.9.9")\` queued ${added.length} row(s) ` +
        `for the account whose published release pins \`${world.card.id}@${world.card.version}\`.\n` +
        `  D-190-04: the recipients are "owners of bundles any of whose releases pin any ` +
        `version of that card". The card was read out of \`release.card_refs\` rather than ` +
        `chosen, so a zero here is the derivation and not a wrong fixture.`,
    ).toBe(1);
    expect(added[0]!.kind).toBe("repin");

    expect(
      added[0]!.subject,
      `D-190-07(1) publishes the repin subject as \`{ cardId: string, version: string }\`, ` +
        `exactly those two keys, and the row carries ` +
        `${JSON.stringify(added[0]!.subject)}.\n` +
        `  Asserted as an EQUALITY and not a containment. The mock's \`{cardId, from, to}\` ` +
        `would add the reader's OWN pinned version to a subject that is supposed to be one ` +
        `event: two accounts pinning different versions of one card would then digest ` +
        `differently for the same repin, and the "one row per recipient per new version" the ` +
        `ruling names would become one row per recipient per pair.`,
    ).toEqual({ cardId: world.card.id, version: "9.9.9" });
  });

  /**
   * D-190-04's clause that reads oddly beside AC1 and is ruled anyway: "private bundles
   * included (the recipient is the pinner; AC1's invisibility rule is not in play)".
   *
   * AC1 keeps a private FORK from announcing itself to somebody ELSE. Here the private bundle
   * is the recipient's own, and telling people about their own private work announces nothing.
   */
  it("the owner of a PRIVATE bundle pinning the card is notified too", async () => {
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch, world.privatePinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.8");

    expect(
      (await queueRows(world.scratch, world.privatePinner.accountId)).slice(before.length),
      `D-190-04 includes private bundles: "the recipient is the pinner; AC1's invisibility ` +
        `rule is not in play". A visibility filter copied from the fork path silences the one ` +
        `notification §T190 calls "the one a version-pinned registry genuinely needs", for ` +
        `exactly the people working privately.`,
    ).toHaveLength(1);
  });

  /** The control that makes the two zeros below mean anything: not everyone is notified. */
  it("an account that pins nothing is not notified", async () => {
    /* Armed, so this zero is "not a recipient" and cannot be "the preference is off". */
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch, world.bystander.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.7");

    expect(
      (await queueRows(world.scratch, world.bystander.accountId)).slice(before.length),
      "an account owning no bundle at all was queued a repin. The derivation is over " +
        "`release.card_refs`, so an account with no releases cannot appear in it.",
    ).toEqual([]);
  });

  it("a card nobody pins notifies nobody", async () => {
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, "core.no-such-card-t190", "1.0.0");

    expect(
      (await queueRows(world.scratch)).slice(before.length),
      "an unknown card produced queue rows, so the derivation is not filtering on the card at " +
        "all and every repin would reach every account in the registry.",
    ).toEqual([]);
  });

  /**
   * The preference gate again, at this source. D-190-02(1) is a property of `enqueue`, so it
   * has to hold whichever verb reached it — a second source that wrote rows directly would
   * bypass the one place the check lives.
   */
  it("an account with `repin` OFF is not notified", async () => {
    const world = await armed(await setup.require());
    await setPreferencesColumn(world.scratch, world.pinner.accountId, { repin: false });
    const before = await queueRows(world.scratch, world.pinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.6");

    expect(
      (await queueRows(world.scratch, world.pinner.accountId)).slice(before.length),
      `D-190-02(1): a kind that is OFF for the account writes NO ROW. If this source writes ` +
        `rows without going through the one place the preference is checked, the criterion ` +
        `holds for the fork path and leaks here.`,
    ).toEqual([]);
  });

  /** Twice for one `(card, version)` is once, which is the same unique key AC5 rests on. */
  it("repeating one repin does not queue a second row", async () => {
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch, world.pinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.5");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.5");

    expect(
      (await queueRows(world.scratch, world.pinner.accountId)).slice(before.length),
      "one repin announced twice queued two rows, so this source is not writing through the " +
        "unique key on (kind, account_id, subject_digest).",
    ).toHaveLength(1);
  });

  /** And a DIFFERENT version is a different event, or the second repin is never announced. */
  it("a second version of the same card is a second row", async () => {
    const world = await armed(await setup.require());
    const before = await queueRows(world.scratch, world.pinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.3");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "9.9.4");

    expect(
      (await queueRows(world.scratch, world.pinner.accountId)).slice(before.length),
      `two different versions of \`${world.card.id}\` collapsed into one row, so a card that ` +
        `publishes twice is announced once. The subject has to carry the version.`,
    ).toHaveLength(2);
  });
});

describe("T190 D-190-09(2): the publishing account is excluded from its own repin", () => {
  /**
   * "`enqueueRepinEvents` gains `publisherAccountId: string | undefined = undefined` (the arity
   * spelling, per T250's rule): when present, that account is EXCLUDED from the recipients. An
   * account that pins a card and then publishes its new version must not announce the publish
   * to itself — the same refusal T110 made for a fork announced to its own author."
   *
   * The discriminating fixture is an account that is BOTH publisher and pinner. Exclude the
   * publisher when it pins nothing and the cell is green against an implementation that never
   * excludes anybody, because that account was never in the recipient set to begin with.
   *
   * Driven in a PAIR, and the pair is the instrument: the same account, the same card, one
   * call passing the publisher and one omitting it. A cell asserting only the exclusion cannot
   * tell "excluded" from "not a recipient in the first place"; a cell asserting only the
   * default cannot see the exclusion at all. The two together pin the parameter as the thing
   * that made the difference.
   */
  it("is a recipient when the publisher is not named, and not one when it is", async () => {
    const world = await armed(await setup.require());

    /* Half one: the DEFAULT. `world.pinner` owns a published bundle pinning this card, so it
       is in the recipient set — and this half proves it, which is what makes half two mean
       "removed" rather than "absent". */
    const beforeDefault = await queueRows(world.scratch, world.pinner.accountId);

    /* Bound HERE and not above, after the premise read. This cell was the one in the file
       that bound first, and the blind run showed the cost precisely: its eight siblings red
       with "`notification_queue` could not be read", naming the migration, and this one redded
       with "the barrel does not load", naming the module. Both are true and only one is the
       NEAREST unmet condition. A cell that binds early reports the furthest cause it can see. */
    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "8.8.1");
    const withDefault = (await queueRows(world.scratch, world.pinner.accountId)).slice(
      beforeDefault.length,
    );
    expect(
      withDefault,
      `the pinner is not a recipient even with no publisher named, so the exclusion half below ` +
        `would be asserting a zero it gets for free. D-190-09(2) spells the parameter ` +
        `\`string | undefined = undefined\`, so omitting it excludes nobody.`,
    ).toHaveLength(1);

    /* Half two: the SAME account, the SAME card, named as the publisher. */
    const beforeExcluded = await queueRows(world.scratch, world.pinner.accountId);
    await enqueueRepinEvents(world.scratch.db, world.card.id, "8.8.2", world.pinner.accountId);

    expect(
      (await queueRows(world.scratch, world.pinner.accountId)).slice(beforeExcluded.length),
      `D-190-09(2): the account named as \`publisherAccountId\` was queued a repin for the ` +
        `version it published itself. "An account that pins a card and then publishes its new ` +
        `version must not announce the publish to itself."\n` +
        `  The version differs from the call above (8.8.2 vs 8.8.1), so this zero is the ` +
        `exclusion and not the unique key collapsing a repeat.`,
    ).toEqual([]);
  });

  /** And the exclusion is ONE account, not the whole fan-out. */
  it("excluding the publisher leaves every other pinner notified", async () => {
    const world = await armed(await setup.require());
    const beforePrivate = await queueRows(world.scratch, world.privatePinner.accountId);

    const enqueueRepinEvents = await bind("enqueueRepinEvents");
    await enqueueRepinEvents(world.scratch.db, world.card.id, "8.8.3", world.pinner.accountId);

    expect(
      (await queueRows(world.scratch, world.privatePinner.accountId)).slice(beforePrivate.length),
      `naming a publisher silenced a DIFFERENT account's repin. The exclusion removes one ` +
        `account from the recipients, and an implementation that skips the whole fan-out when ` +
        `the parameter is present passes the cell above and loses every other pinner.`,
    ).toHaveLength(1);
  });
});
