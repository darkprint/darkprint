/* ============================================================
   T110 AC4 and AC5 — what drift says, and what it must not say

   ── the direction `moved` compares in ──
   `from` is THIS COPY's pin and `to` is the UPSTREAM's current pin.
   Settled by the tree rather than by the prose: `UpstreamMoved`'s
   docstring is "A card the upstream repinned after this copy was
   taken" (`lib/data/bundles.ts:107`) and the component renders
   "<owner>/<slug> repinned `card@from → to`. Your copy still carries
   `<from>`". The other reading — compare against the newest card
   version anywhere in the store — would report drift for a bundle
   with no upstream at all, which contradicts `Drift` carrying no
   upstream field.

   ── `Repin.at` and `Repin.card` ──
   `at` is the createdAt of the upstream RELEASE that carries the new
   pin, not of the card version's row: the surface renders it as
   "repinned `card@from → to` **on** <date>", the date of the
   repinning event. `card` is the bare card id — "Card id, which is
   also the route: `/nodes/<card>`" (`lib/data/bundles.ts:109`) —
   never the `id@version` ref. Both ruled at dispatch.

   ── why AC4 is measured over two differently-built copies ──
   Once over a copy planted by T010's merged writers, so `driftOf` is
   measured on its own; once over a copy `forkBundle` produced, so
   the composition is measured too. The first still reports on
   `driftOf` when `forkBundle` is what is broken — which, in the
   blind position, is every cell in the file until the module exists.

   ── which upstream each cell reaches for ──
   The `blocked` copy hangs off the STABLE upstream, which has one
   release and has never repinned anything. So its tone can only be
   `blocked` or `ok`, and no cell in this file depends on a
   precedence between `blocked` and `moved` that the contract does
   not state.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ReleaseRecord } from "@/lib/server/archive";

import {
  DRIFT_TONES,
  PUBLISHED,
  RULINGS,
  RecordedSetup,
  boundDriftOf,
  boundForkBundle,
  bundleRecordOf,
  describe as describeValue,
  driftResultOf,
  warmWith,
} from "./contract";
import {
  type Account,
  type Published,
  type Repinned,
  type Scratch,
  bundleWithoutLineage,
  plantCopy,
  plantUnresolvableCopy,
  publishBundle,
  releasesOf,
  repinOneCard,
  resolvingCorpus,
  revisionOf,
  scratchDatabase,
  seedAccount,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  author: Account;
  forker: Account;
  /** Published at 1.0.0, then again at 2.0.0 with exactly one card repinned. */
  moved: Published;
  /** The second release of `moved`, whose createdAt is the `at` every AC4 cell asserts. */
  movedRelease: ReleaseRecord;
  repin: Repinned;
  /** One release, never repinned. Everything that must not report `moved` hangs off this. */
  stable: Published;
}

const setup = new RecordedSetup<Env>("the T110 drift fixture");

/* Before the fixture hook, so the transform cost is paid where there is headroom for it. */
/* This suite's cells build their own fixture — see `RecordedSetup` — and a fixture here publishes
   two or three bundles through T100, which is engine work, database writes and object storage.
   The shared `testTimeout` is 20s (`vitest.config.ts`), raised there from vitest's 5s default
   because "with nine worktree sessions competing for ten cores, one of them crossed 5s and
   reported a timeout for a test that was never wrong". The same argument reaches further here:
   with the planting inside the cell, four cells crossed 20s on a loaded machine and reported
   `Test timed out` in place of the cause they exist to report.

   Raised per FILE rather than in `vitest.config.ts`, which is shared and is not this task's to
   widen for everybody. A genuine hang still fails, four times later. */
vi.setConfig({ testTimeout: 80_000, hookTimeout: 80_000 });

beforeAll(warmWith(setup));

setup.provide(async () => {
  const scratch = await scratchDatabase("drift");
  const author = await seedAccount(scratch, "t110-drift-author");
  const forker = await seedAccount(scratch, "t110-drift-forker");
  const corpus = resolvingCorpus();

  const moved = await publishBundle(scratch, author, corpus, "drift-upstream", "1.0.0", "public");
  const repin = repinOneCard(corpus);
  await publishBundle(scratch, author, repin.corpus, "drift-upstream", "2.0.0", "public");

  const releases = await releasesOf(scratch, moved.bundleId);
  const movedRelease = releases.find((r) => r.version === "2.0.0");
  if (movedRelease === undefined) {
    throw new Error(
      `The drift fixture published \`drift-upstream@2.0.0\` and \`listReleases\` reports ` +
        `${releases.map((r) => r.version).join(", ") || "(nothing)"}. Every AC4 cell asserts ` +
        `\`Repin.at\` against this release's createdAt and cannot be written without it.`,
    );
  }

  const stable = await publishBundle(
    scratch,
    author,
    revisionOf(corpus, "an upstream that never repins anything"),
    "drift-stable",
    "1.0.0",
    "public",
  );

  return { scratch, author, forker, moved, movedRelease, repin, stable };
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

/** Every tone the module answered must be one of the three the union publishes. */
function assertKnownTone(tone: unknown, criterion: string): void {
  expect(
    DRIFT_TONES as readonly string[],
    `${criterion}: the Drift's tone is ${JSON.stringify(tone)}.\n` +
      `  Published as: ${PUBLISHED.DriftTone}`,
  ).toContain(tone);
}

describe("T110 AC4: a copy pinning an older card reports `moved`", () => {
  /**
   * `driftOf` measured on its own, over a copy planted by T010's merged writers.
   *
   * Exercises the read path: lineage → the upstream's current release → the pins that differ. No
   * T110 write is involved, so a red here is about `driftOf` and cannot be about `forkBundle`.
   */
  it("names the card, both versions, and the release that moved it", async () => {
    const env = await setup.require();

    const copy = await plantCopy(env.scratch, env.forker, "drift-planted-copy", env.moved);

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, copy.bundle.id),
      "AC4",
    );

    assertKnownTone(drift.tone, "AC4");
    expect(
      drift.tone,
      `AC4: \`${env.moved.slug}\` repinned \`${env.repin.card}\` from ` +
        `\`${env.repin.from}\` to \`${env.repin.to}\` in its 2.0.0 release, and this copy was ` +
        `taken at 1.0.0 and still carries \`${env.repin.from}\`. The drift reads ` +
        `${JSON.stringify(drift.tone)}.\n` +
        `  ${RULINGS.F4_movedDirection}.`,
    ).toBe("moved");

    expect(
      drift.repins.length,
      `AC4: the fixture moved exactly one pin and the drift lists ${drift.repins.length}:\n` +
        `  ${JSON.stringify(drift.repins)}\n` +
        `  The other ${env.repin.unchanged.length} pinned card(s) — ` +
        `${env.repin.unchanged.join(", ")} — are byte-identical across the two releases and must ` +
        `not appear. A drift that lists every pinned card satisfies "names both versions" for the ` +
        `one that moved and is still wrong about the rest.`,
    ).toBe(1);

    const repin = drift.repins[0];
    expect(
      repin.card,
      `AC4: \`Repin.card\` is ${JSON.stringify(repin.card)} and the card that moved is ` +
        `\`${env.repin.card}\`.\n  ${RULINGS.Q3_repinCard}.`,
    ).toBe(env.repin.card);
    expect(
      repin.from,
      `AC4: \`Repin.from\` is the version THIS COPY carries, \`${env.repin.from}\`.\n` +
        `  ${RULINGS.F4_movedDirection}.`,
    ).toBe(env.repin.from);
    expect(
      repin.to,
      `AC4: \`Repin.to\` is the version the UPSTREAM now carries, \`${env.repin.to}\`.\n` +
        `  ${RULINGS.F4_movedDirection}.`,
    ).toBe(env.repin.to);
  });

  /**
   * `Repin.at`, asserted against the release rather than against "is a Date".
   *
   * Its own cell because it is its own claim and fails for its own reason. `toBeInstanceOf(Date)`
   * would admit `new Date(0)` — the value a field that is never populated arrives as — so the
   * assertion is an equality against a timestamp this fixture did not choose and cannot predict:
   * the createdAt Postgres stamped on the upstream's second release.
   */
  it("dates the repin at the upstream release that carries the new pin", async () => {
    const env = await setup.require();

    const copy = await plantCopy(env.scratch, env.forker, "drift-at-copy", env.moved);

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, copy.bundle.id),
      "AC4 `at`",
    );
    const repin = drift.repins[0];
    if (repin === undefined) {
      throw new Error(
        `AC4 \`at\`: the drift lists no repins (tone ${JSON.stringify(drift.tone)}), so there is ` +
          `no timestamp to read. The cell above says what that means.`,
      );
    }

    expect(
      repin.at,
      `AC4: \`Repin.at\` is ${describeValue(repin.at)}.\n  Published as: ${PUBLISHED.Repin}`,
    ).toBeInstanceOf(Date);

    const at = repin.at as Date;
    expect(
      at.getTime(),
      `AC4: \`Repin.at\` is ${at.toISOString()} and the upstream release that carries the new ` +
        `pin (\`${env.moved.slug}@2.0.0\`) was created at ` +
        `${env.movedRelease.createdAt.toISOString()}.\n` +
        `  ${RULINGS.Q2_repinAt}.\n` +
        `  Asserted as an equality against a timestamp Postgres chose, and not as ` +
        `\`toBeInstanceOf(Date)\`: that predicate admits \`new Date(0)\`, which is what an ` +
        `unpopulated field arrives as, and it would pass over a \`Repin\` whose date member is ` +
        `never filled in.`,
    ).toBe(env.movedRelease.createdAt.getTime());

    expect(
      at.getTime(),
      "AC4: `Repin.at` is the Unix epoch, which is the value an unset date member takes.",
    ).not.toBe(0);
  });

  /**
   * The same criterion over a copy `forkBundle` really produced — the composition.
   *
   * The module is bound LAST, after the upstream is in place; the fork is taken at 1.0.0 while the
   * upstream's latest is 2.0.0, so this also exercises `forkBundle` copying the release it was
   * asked for rather than the newest one. If this cell reds while the planted-copy cell above is
   * green, the defect is in what `forkBundle` writes, not in what `driftOf` reads.
   */
  it("reports the same `moved` over a copy forkBundle produced", async () => {
    const env = await setup.require();

    const forkBundle = await boundForkBundle();
    const fork = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        { ownerHandle: env.author.handle, slug: env.moved.slug, version: "1.0.0" },
        { slug: "drift-forked-copy", visibility: "private" },
      ),
      "AC4 composed",
    );

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, fork.id),
      "AC4 composed",
    );

    assertKnownTone(drift.tone, "AC4 composed");
    expect(
      drift.tone,
      `AC4 composed: the fork was taken at \`${env.moved.slug}@1.0.0\` while the upstream's ` +
        `latest is 2.0.0, which repinned \`${env.repin.card}\` ${env.repin.from} → ` +
        `${env.repin.to}. Drift over it reads ${JSON.stringify(drift.tone)}.\n` +
        `  The planted-copy cell above measures \`driftOf\` alone. If that one is green and this ` +
        `one is red, what \`forkBundle\` wrote is the difference — most likely the release whose ` +
        `bytes it copied, or the version it recorded in lineage.`,
    ).toBe("moved");
    expect(drift.repins.map((r) => ({ card: r.card, from: r.from, to: r.to }))).toEqual([
      { card: env.repin.card, from: env.repin.from, to: env.repin.to },
    ]);
  });
});

describe("T110: `ok` is the answer where nothing moved", () => {
  /**
   * A copy of an upstream that has published once and repinned nothing.
   *
   * The negative half of AC4, and it is what stops `moved` from being a constant. An
   * implementation that answers `moved` for every bundle with lineage passes every cell above.
   */
  it("a copy of an upstream that has not moved reports `ok` with no repins", async () => {
    const env = await setup.require();

    const copy = await plantCopy(env.scratch, env.forker, "drift-stable-copy", env.stable);

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, copy.bundle.id),
      "drift over an unmoved upstream",
    );

    assertKnownTone(drift.tone, "drift over an unmoved upstream");
    expect(
      drift.tone,
      `\`${env.stable.slug}\` has one release and has repinned nothing, and this copy carries ` +
        `exactly its pins. Drift reads ${JSON.stringify(drift.tone)} with ` +
        `${drift.repins.length} repin(s): ${JSON.stringify(drift.repins)}.\n` +
        `  Without this cell, an implementation that answers \`moved\` for every bundle carrying ` +
        `lineage passes every AC4 cell in this file.`,
    ).toBe("ok");
    expect(drift.repins).toEqual([]);
  });

  /**
   * A bundle with no lineage at all — the dispatch's Q4 ruling.
   *
   * "A bundle with no upstream has not drifted from anything, and a refusal there would make
   * callers branch on a condition the type does not express."
   */
  it("a bundle that is nobody's copy reports `ok` with no repins", async () => {
    const env = await setup.require();

    const own = await bundleWithoutLineage(
      env.scratch,
      env.forker,
      revisionOf(resolvingCorpus(), "a bundle of the forker's own, copied from nobody"),
      "drift-no-lineage",
    );

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, own.bundleId),
      "Q4, a bundle with no lineage",
    );

    assertKnownTone(drift.tone, "Q4, a bundle with no lineage");
    expect(
      { tone: drift.tone, repins: drift.repins },
      `\`${own.slug}\` carries no lineage — the fixture checks its \`lineage_owner_id\` is null ` +
        `before this cell runs — and drift over it reads ${JSON.stringify(drift.tone)} with ` +
        `${drift.repins.length} repin(s).\n  ${RULINGS.Q4_noLineage}.`,
    ).toEqual({ tone: "ok", repins: [] });
  });
});

describe("T110 AC5: a copy with an unresolvable node reports `blocked`", () => {
  /**
   * The tone, the reason, and the silence about the upstream — one cell, because AC5 is one
   * criterion and its three halves fail for the same defect.
   *
   * The copy hangs off the STABLE upstream, so `moved` is not available as an answer and a green
   * here cannot be a precedence accident.
   */
  it("says what is wrong with this bundle without naming the upstream", async () => {
    const env = await setup.require();

    const planted = await plantUnresolvableCopy(
      env.scratch,
      env.forker,
      "drift-blocked-copy",
      env.stable,
    );

    const driftOf = await boundDriftOf();
    const drift = driftResultOf(
      await driftOf(env.scratch.db, env.forker.actor, planted.bundle.id),
      "AC5",
    );

    assertKnownTone(drift.tone, "AC5");
    expect(
      drift.tone,
      `AC5: this copy pins \`${planted.ghostRef}\`, and the fixture checked no \`card_version\` ` +
        `row holds it. Drift over it reads ${JSON.stringify(drift.tone)}.\n` +
        `  "\`blocked\` describes this bundle's own problem and never frames it as falling ` +
        `behind" — the upstream \`${env.stable.slug}\` has one release and has moved nowhere, so ` +
        `\`moved\` is not an available answer here and \`ok\` would be a claim that a bundle ` +
        `nothing can resolve is fine.`,
    ).toBe("blocked");

    expect(
      typeof drift.reason === "string" && drift.reason.length > 0,
      `AC5: the drift is \`blocked\` and its \`reason\` is ${describeValue(drift.reason)} ` +
        `(present as an own property: ${drift.hasReason}).\n` +
        `  ${RULINGS.Q5_blockedReason}.\n` +
        `  Published as: ${PUBLISHED.Drift}. The block's argument for \`reason?\` existing at ` +
        `all is that "a \`blocked\` drift must be renderable without naming the upstream at all", ` +
        `which a \`blocked\` carrying no reason cannot do — it renders as nothing. Asserting only ` +
        `"the Drift does not mention the upstream" would be satisfied by that empty case ` +
        `vacuously, which is the shape that reddened 0 of 164 cells elsewhere in this run.`,
    ).toBe(true);

    /* The whole returned value, not only `reason`: an implementation that keeps the upstream out
       of the sentence and puts it in a second member has satisfied the words and not the
       criterion. `repins` is in here too, which is the member most likely to carry it. */
    const rendered = JSON.stringify(drift);
    for (const secret of [env.stable.slug, env.author.handle, env.author.accountId]) {
      expect(
        rendered.includes(secret),
        `AC5: the Drift names \`${secret}\`, which is the upstream.\n` +
          `  The whole value: ${rendered}\n` +
          `  "a \`blocked\` drift must be renderable WITHOUT NAMING THE UPSTREAM AT ALL (AC5) ... ` +
          `A single message string would make it impossible to satisfy that without string ` +
          `surgery at the call site." The check is over the whole \`Drift\` and not only over ` +
          `\`reason\`, because an upstream moved out of the sentence and into another member is ` +
          `still on the surface that renders it.`,
      ).toBe(false);
    }
  });
});
