/* ============================================================
   T110 AC2 and AC3 — a private fork is invisible upstream in
   every direction

   ── the ruled reading of `forksOf` ──
   PUBLIC ROWS ONLY, for every actor, including the fork's own owner
   and B-13's operator. The block's "filters through `visibleTo`" was
   loose wording and was corrected at dispatch; the Contract line —
   "Fork counts and lists are computed over public rows only" — is
   the one that holds. The argument that settles it is AC2's own
   sentence: under a `visibleTo` reading the fork's owner would see 1
   while everyone else saw 0, so "the upstream's fork count" would
   not be a property of the upstream at all, and a count that changes
   with the viewer cannot be "unchanged while the fork is private".

   So every count cell below asks the SAME question of five
   different actors and asserts they all get the same answer. That is
   a stronger instrument than one privileged reader: an
   implementation that filters by `visibleTo` passes a cell that only
   ever asks the upstream's author.

   ── which path each cell exercises ──
   The AC2 transition cell exercises `forksOf`'s FILTER and no
   publish path at all. The private → public flip is a FIXTURE write
   — `db.update(schema.bundle).set({ visibility })`, the house
   pattern from `lib/server/saves/saves.db.scratch.test.ts:225,240`
   and `lib/server/export/export.scratch.test.ts:545,553` — because
   no merged published verb performs it: T100's `publish` computes
   `existing?.visibility ?? input.visibility ?? owner.defaultVisibility`
   (`publish.ts:147`) and says "changing it is nobody's here". A cell
   that called `publish` with `visibility: "public"` and asserted the
   count went up would red a correct implementation for a decision
   T100 already made and wrote down.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Actor } from "@/lib/server/policy";

import {
  RecordedSetup,
  boundForkBundle,
  boundForksOf,
  bundleRecordOf,
  forkListOf,
  warmLineage,
} from "./contract";
import {
  ANONYMOUS,
  type Account,
  type Published,
  type Scratch,
  operatorActor,
  publishBundle,
  resolvingCorpus,
  revisionOf,
  rowsAdded,
  scratchDatabase,
  seedAccount,
  setVisibility,
  snapshotRows,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  author: Account;
  forker: Account;
  stranger: Account;
  operator: Account;
  upstream: Published;
  /** A second public upstream nobody forks, so a list can be shown to be scoped. */
  otherUpstream: Published;
}

const setup = new RecordedSetup<Env>("the T110 visibility fixture");

/* Before the fixture hook, so the transform cost is paid where there is headroom for it. */
beforeAll(warmLineage);

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("visibility");
    const author = await seedAccount(scratch, "t110-vis-author");
    const forker = await seedAccount(scratch, "t110-vis-forker");
    const stranger = await seedAccount(scratch, "t110-vis-stranger");
    const operator = await seedAccount(scratch, "t110-vis-operator");
    const corpus = resolvingCorpus();

    const upstream = await publishBundle(scratch, author, corpus, "vis-upstream", "1.0.0", "public");
    const otherUpstream = await publishBundle(
      scratch,
      author,
      revisionOf(corpus, "a second upstream, so a fork list can be shown to be scoped"),
      "vis-other",
      "1.0.0",
      "public",
    );

    return { scratch, author, forker, stranger, operator, upstream, otherUpstream };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

/** The five readers AC2's count must answer identically. */
function readers(env: Env): readonly { name: string; actor: Actor }[] {
  return [
    { name: "the upstream's own author", actor: env.author.actor },
    { name: "the fork's own owner", actor: env.forker.actor },
    { name: "a signed-in stranger", actor: env.stranger.actor },
    { name: "an anonymous visitor", actor: ANONYMOUS },
    { name: "B-13's break-glass operator", actor: operatorActor(env.operator.accountId) },
  ];
}

/** `forksOf` asked of every reader, as `name -> the ids it answered`. */
async function forkIdsPerReader(env: Env, bundleId: string, criterion: string) {
  const forksOf = await boundForksOf();
  const answers = new Map<string, string[]>();
  for (const reader of readers(env)) {
    const list = forkListOf(
      await forksOf(env.scratch.db, reader.actor, bundleId),
      `${criterion} (as ${reader.name})`,
    );
    answers.set(
      reader.name,
      list.map((row) => bundleRecordOf(row, `${criterion} (as ${reader.name})`).id).sort(),
    );
  }
  return answers;
}

function render(answers: Map<string, string[]>): string {
  return [...answers.entries()]
    .map(([who, ids]) => `    ${who}: ${ids.length} — [${ids.join(", ")}]`)
    .join("\n");
}

describe("T110 AC2: the upstream's fork count", () => {
  /**
   * The baseline, and it is not a formality. `forksOf` must answer an ARRAY over a bundle nobody
   * has forked — an implementation that answers `undefined`, or throws, would make every count
   * below unreadable, and the cell after this one would report a criterion failure for it.
   *
   * Exercises the empty-result path.
   */
  it("is zero, for every reader, before anyone forks", async () => {
    const env = setup.require();

    const answers = await forkIdsPerReader(env, env.upstream.bundleId, "AC2 baseline");
    for (const [who, ids] of answers) {
      expect(
        ids,
        `AC2 baseline: nobody has forked \`${env.upstream.slug}\` and ${who} is shown ` +
          `${ids.length}.\n${render(answers)}`,
      ).toEqual([]);
    }
  });

  /**
   * AC2's first half. A private fork exists — as a row, checked — and no reader sees it.
   *
   * Exercises `forksOf`'s filter over a fork that is present and private. The premise that the
   * fork really was written is asserted separately from the count, so "the filter works" and
   * "`forkBundle` never wrote anything" cannot produce the same green.
   */
  it("is unchanged while the fork is private", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const fork = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.upstream.slug,
          version: env.upstream.version,
        },
        { slug: "vis-private-fork", visibility: "private" },
      ),
      "AC2",
    );

    /* The premise. Without it, an implementation of `forkBundle` that wrote nothing at all would
       make the count below zero for the most uninteresting possible reason and pass. */
    expect(fork.visibility, "AC2 premise: the fork was created private.").toBe("private");
    const row = await env.scratch.pool.query("select visibility from bundle where id = $1", [
      fork.id,
    ]);
    expect(
      row.rows[0],
      "AC2 premise: the private fork is a row. A count of zero over a fork that was never " +
        "written says nothing about the filter AC2 is a criterion about.",
    ).toEqual({ visibility: "private" });

    const answers = await forkIdsPerReader(env, env.upstream.bundleId, "AC2 while private");
    for (const [who, ids] of answers) {
      expect(
        ids,
        `AC2: a PRIVATE fork of \`${env.upstream.slug}\` exists (${fork.id}) and ${who} is ` +
          `shown ${ids.length} fork(s).\n${render(answers)}\n` +
          `  "a private fork is never announced on its upstream and its author is not told it ` +
          `exists" — the promise \`/settings\` §04 makes when it recommends Private as the ` +
          `default (\`lib/data/bundles.ts:508-526\`, \`components/bundle/Aside.tsx:262-265\`).\n` +
          `  Every reader is asked the same question here on purpose: an implementation that ` +
          `filters through \`visibleTo\` instead of on \`visibility\` passes when only the ` +
          `upstream's author is asked, and shows the fork's own owner a count nobody else sees.`,
      ).toEqual([]);
    }
  });

  /**
   * AC2's second half, and the transition itself.
   *
   * **The flip is a fixture write and this cell exercises `forksOf`'s filter, not a publish
   * path.** See this file's header for why there is no published verb to call instead. What is
   * measured is that the SAME bundle, the same row, crosses the boundary and the count follows —
   * which is the criterion. Two bundles in two states would measure two adjacent facts instead.
   */
  it("increases when that same fork becomes public", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const fork = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.upstream.slug,
          version: env.upstream.version,
        },
        { slug: "vis-transition-fork", visibility: "private" },
      ),
      "AC2 transition",
    );

    const before = await forkIdsPerReader(env, env.upstream.bundleId, "AC2 before the flip");
    for (const [who, ids] of before) {
      expect(
        ids.includes(fork.id),
        `AC2 transition, before: ${who} can already see the private fork ${fork.id}.\n` +
          `${render(before)}`,
      ).toBe(false);
    }

    await setVisibility(env.scratch, fork.id, "public");

    const after = await forkIdsPerReader(env, env.upstream.bundleId, "AC2 after the flip");
    for (const [who, ids] of after) {
      expect(
        ids.includes(fork.id),
        `AC2 transition, after: the fork ${fork.id} is now PUBLIC and ${who} is shown ` +
          `${ids.length} fork(s), not including it.\n${render(after)}\n` +
          `  The row was flipped in place — same bundle, same lineage, one column — so the only ` +
          `thing that changed between the two readings is the column \`forksOf\` filters on. A ` +
          `count that does not follow it is a count taken from somewhere else.`,
      ).toBe(true);
      expect(
        ids.length,
        `AC2 transition: ${who} is shown ${ids.length} forks and exactly one public fork of ` +
          `\`${env.upstream.slug}\` exists.\n${render(after)}`,
      ).toBe(before.get(who)!.length + 1);
    }
  });

  /**
   * The list is scoped to the upstream it was asked about.
   *
   * An implementation that answers "every bundle carrying any lineage" satisfies both halves of
   * AC2 over a fixture with one upstream, which is the fixture anybody writes first.
   */
  it("lists forks of the bundle asked about and no others", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const scoped = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.upstream.slug,
          version: env.upstream.version,
        },
        { slug: "vis-scoped-fork", visibility: "public" },
      ),
      "AC2 scope",
    );

    const otherLists = await forkIdsPerReader(
      env,
      env.otherUpstream.bundleId,
      "AC2 scope, the other upstream",
    );
    for (const [who, ids] of otherLists) {
      expect(
        ids.includes(scoped.id),
        `AC2 scope: ${scoped.id} is a public fork of \`${env.upstream.slug}\`, and ${who} is ` +
          `shown it in the fork list of \`${env.otherUpstream.slug}\`, which nobody has forked.\n` +
          `${render(otherLists)}\n` +
          `  An implementation that lists every bundle carrying lineage passes both halves of ` +
          `AC2 over a fixture with a single upstream.`,
      ).toBe(false);
    }
  });
});

describe("T110 AC3: a private fork announces nothing to the upstream's author", () => {
  /**
   * The non-effect, and it is table-agnostic on purpose.
   *
   * T190 is out of scope and there is no notification table on `backend` yet, so a cell naming one
   * would assert nothing today and go on asserting nothing the day one arrives. Instead: snapshot
   * every row in every table, take a private fork, snapshot again, and walk every value of every
   * added row looking for the upstream author's account id.
   *
   * **Exactly one occurrence is legitimate** — `bundle.lineage_owner_id` on the fork's own row,
   * which is the lineage AC1 requires. Anything else is a row that carries the upstream author's
   * identity into a table because of a fork they were never to be told about.
   */
  it("writes no row anywhere that carries the upstream author's id", async () => {
    const env = setup.require();

    const before = await snapshotRows(env.scratch);

    const forkBundle = await boundForkBundle();
    const fork = bundleRecordOf(
      await forkBundle(
        env.scratch.db,
        env.forker.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.upstream.slug,
          version: env.upstream.version,
        },
        { slug: "vis-ac3-fork", visibility: "private" },
      ),
      "AC3",
    );

    const added = rowsAdded(before, await snapshotRows(env.scratch));

    /* Every place the upstream author's id turned up in a row that did not exist before, as
       `table.column`, with the one permitted location filtered out. */
    const mentions: string[] = [];
    for (const [table, rows] of added) {
      for (const text of rows) {
        const row = JSON.parse(text) as Record<string, unknown>;
        for (const [column, value] of Object.entries(row)) {
          if (value !== env.author.accountId) continue;
          if (table === "bundle" && column === "lineage_owner_id") continue;
          mentions.push(`${table}.${column} (row: ${text})`);
        }
      }
    }

    expect(
      mentions,
      `AC3: taking a PRIVATE fork of \`${env.upstream.slug}\` wrote the upstream author's ` +
        `account id (${env.author.accountId}) into ${mentions.length} place(s):\n  ` +
        `${mentions.join("\n  ")}\n` +
        `  The only permitted occurrence is \`bundle.lineage_owner_id\` on the fork's own row ` +
        `(${fork.id}), which is the lineage AC1 requires and which is what makes the fork a copy ` +
        `rather than an unrelated bundle.\n` +
        `  This cell names no table, so it also catches the notification table T190 has not built ` +
        `yet, on the day it is built. If a row above is an audit entry rather than an ` +
        `announcement, that is a contract question for the orchestrator — the criterion is that ` +
        `the private fork is invisible upstream "in every direction", and an audit row keyed to ` +
        `the upstream author is a direction.`,
    ).toEqual([]);
  });

  /**
   * And the upstream's own row was not touched.
   *
   * A separate claim from the one above: that cell looks at rows that are NEW, and an update in
   * place adds none. A fork that bumped the upstream's `updated_at` — a denormalised fork count,
   * say — would be invisible to the row-delta instrument and perfectly visible to the upstream's
   * author on their own dashboard.
   */
  it("does not touch the upstream's own bundle row", async () => {
    const env = setup.require();

    const columns = "id, owner_id, slug, visibility, lineage_owner_id, lineage_slug, " +
      "lineage_version, created_at, updated_at";
    const before = await env.scratch.pool.query(
      `select ${columns} from bundle where id = $1`,
      [env.upstream.bundleId],
    );

    const forkBundle = await boundForkBundle();
    await forkBundle(
      env.scratch.db,
      env.forker.actor,
      { ownerHandle: env.author.handle, slug: env.upstream.slug, version: env.upstream.version },
      { slug: "vis-untouched-fork", visibility: "private" },
    );

    const after = await env.scratch.pool.query(
      `select ${columns} from bundle where id = $1`,
      [env.upstream.bundleId],
    );

    expect(
      after.rows[0],
      `AC3: the upstream's own bundle row changed when a private fork was taken.\n` +
        `  before: ${JSON.stringify(before.rows[0])}\n` +
        `  after:  ${JSON.stringify(after.rows[0])}\n` +
        `  An in-place update adds no row, so the delta instrument in the cell above cannot see ` +
        `it — and a bumped \`updated_at\`, or a denormalised count, is exactly the announcement ` +
        `AC3 forbids arriving by the one route that leaves no new row behind.`,
    ).toEqual(before.rows[0]);
  });
});
