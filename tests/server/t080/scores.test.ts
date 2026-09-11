/* ============================================================
   T080 AC7 — "after an ontology release the stored scores carry
   the new version and the old values are gone"

   ── what `0009_drop_ontology_versioning` took out of this file ──
   The criterion's "new version" was `Scores.ontologyVersion`, a
   fourth member resolved first through
   `release.scored_ontology_version_id` and later off the stored
   `autonomy`. The column, the `ontology_version` table behind it
   and the stamp on `AutonomyResult` are all gone: the vocabulary
   names what an Attractor node IS, Attractor fixes those shapes in
   its own spec and carries no vocabulary version, so a
   DarkPrint-only version on top was a second thing to keep in step
   with nothing. What survives here is the half of AC7 that is
   still checkable — the reader returns the CURRENT release's three
   axes and none of the superseded release's — and the old
   vocabulary string is kept as one of the tells, because a legacy
   `autonomy` jsonb really does still carry it and it is therefore
   a real fingerprint of the old row.

   Two things this test deliberately does not do.

   It does not invoke a re-score. "T080 owns the projection and the
   read; it does not own the trigger", so the fixture writes the
   rows an ontology release would have left behind and asks the
   reader what it makes of them.

   It does not read the table. D-80-02b added `scoresOf` precisely
   because AC7 "was unreachable through any published surface" —
   asserting against `release.autonomy` directly would be a test of
   the fixture, and it would pass against a module with no
   projection at all.

   ── why the old values must still be in the database ──
   If the only row carried the new values, every reader on earth
   would return them and this criterion would be asserting an
   outcome Postgres already guarantees. So the bundle has two
   releases: 1.0.0 scored under the old ontology and 2.0.0 under
   the new one, with 2.0.0 created *earlier* so "highest semver"
   (D-80-03) and "most recent row" disagree. The old scorecard is
   one join away throughout.

   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  anonymous,
  assertTellsCannotOverMatch,
  bind,
  dropScratchDatabases,
  findTokens,
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  mark,
  scratchDatabase,
} from "./contract";

const SLUG = "scored-bundle";
/** A bundle whose release carries `null` in all three score columns. */
const UNSCORED_SLUG = "unscored-bundle";
/** One axis present, two null — the case "autonomy is present" cannot tell from scored. */
const HALF_SCORED_SLUG = "half-scored-bundle";

/* Two vocabulary strings inside the two releases' stored `autonomy`, which is where a
   pre-0009 row really carries one. Nothing reads them now, so they are here as tells and
   not as stamps: `7.1.0` reaching a caller means the reader answered off release 1.0.0. */
const OLD_ONTOLOGY = "7.1.0";
const NEW_ONTOLOGY = "7.2.0";

let s: Scratch;
let handle: string;
let oldTells: string[];
let sentinels: {
  oldAutonomy: string;
  oldSecurity: string;
  oldPhase: string;
  newAutonomy: string;
  newSecurity: string;
  newPhase: string;
};

beforeAll(async () => {
  s = await scratchDatabase();
  const owner = await insertAccount(s, mark("t080-scores"));
  handle = owner.handle;

  sentinels = {
    oldAutonomy: mark("OLD-AUTONOMY"),
    oldSecurity: mark("OLD-SECURITY"),
    oldPhase: mark("OLD-PHASE"),
    newAutonomy: mark("NEW-AUTONOMY"),
    newSecurity: mark("NEW-SECURITY"),
    newPhase: mark("NEW-PHASE"),
  };

  const card = await insertCard(s, { ownerId: owner.id, id: "scored-card" });
  const bundle = await insertBundle(s, { owner, slug: SLUG });

  await insertRelease(s, {
    bundle,
    version: "1.0.0",
    cards: [card],
    createdAt: "2030-01-01T00:00:00Z",
    autonomy: { autonomyClass: sentinels.oldAutonomy, level: 1, ontologyVersion: OLD_ONTOLOGY },
    security: {
      level: 1,
      raw: 1,
      penalties: [],
      findings: [],
      rationale: sentinels.oldSecurity,
      ontologyVersion: OLD_ONTOLOGY,
    },
    phaseCoverage: { covered: [sentinels.oldPhase], missing: [], byPhase: {}, unphased: [] },
  });

  await insertRelease(s, {
    bundle,
    version: "2.0.0",
    cards: [card],
    createdAt: "2020-01-01T00:00:00Z",
    autonomy: { autonomyClass: sentinels.newAutonomy, level: 4, ontologyVersion: NEW_ONTOLOGY },
    security: {
      level: 4,
      raw: 4,
      penalties: [],
      findings: [],
      rationale: sentinels.newSecurity,
      ontologyVersion: NEW_ONTOLOGY,
    },
    phaseCoverage: { covered: [sentinels.newPhase], missing: [], byPhase: {}, unphased: [] },
  });

  /* Never scored: `release.autonomy`/`security`/`phase_coverage` are nullable because
     "T000 stores no feature logic to compute them" (lib/db/schema.ts), so this row is
     reachable and no fixture in this suite had one until a mutation went looking. */
  const unscored = await insertBundle(s, { owner, slug: UNSCORED_SLUG });
  await insertRelease(s, { bundle: unscored, version: "1.0.0", cards: [card] });

  /* Half written: one axis present, two null. */
  const half = await insertBundle(s, { owner, slug: HALF_SCORED_SLUG });
  await insertRelease(s, {
    bundle: half,
    version: "1.0.0",
    cards: [card],
    autonomy: { autonomyClass: "supervised", level: 2, ontologyVersion: NEW_ONTOLOGY },
  });

  oldTells = [sentinels.oldAutonomy, sentinels.oldSecurity, sentinels.oldPhase, OLD_ONTOLOGY];

  assertTellsCannotOverMatch(oldTells, [
    sentinels.newAutonomy,
    sentinels.newSecurity,
    sentinels.newPhase,
    NEW_ONTOLOGY,
    handle,
    SLUG,
    "scored-card@1.0.0",
  ]);
});

afterAll(async () => {
  await dropScratchDatabases();
});

async function scores(): Promise<Record<string, unknown>> {
  const scoresOf = await bind("scoresOf");
  const answered = await scoresOf(s.db, anonymous, handle, SLUG);
  if (answered === null || typeof answered !== "object") {
    throw new Error(
      `scoresOf(${handle}, ${SLUG}) returned ${answered === null ? "null" : typeof answered}; ` +
        `D-80-02b publishes \`interface Scores { autonomy: AutonomyResult; security: ` +
        `SecurityResult; phaseCoverage: PhaseCoverage }\` for a bundle that exists and is ` +
        `scored — three members since 0009 withdrew the fourth.`,
    );
  }
  return answered as Record<string, unknown>;
}

describe("AC7 the reader returns the new values", () => {
  it("publishes the three members of Scores", async () => {
    /* Four until 0009. `ontologyVersion` left the interface with the column, the table and
       `AutonomyResult`'s own stamp; a member with one possible value cannot tell two
       scorecards apart. */
    expect(Object.keys(await scores()).sort()).toEqual([
      "autonomy",
      "phaseCoverage",
      "security",
    ]);
  });

  it("returns the autonomy, security and phase coverage of the current release", async () => {
    const found = await scores();
    expect(findTokens(found.autonomy, [sentinels.newAutonomy])).toEqual([sentinels.newAutonomy]);
    expect(findTokens(found.security, [sentinels.newSecurity])).toEqual([sentinels.newSecurity]);
    expect(findTokens(found.phaseCoverage, [sentinels.newPhase])).toEqual([sentinels.newPhase]);
  });

  /* A cell asserting `Scores.ontologyVersion` was the semver the current release was scored
     under stood here, with a third `ontology_version` row nothing referenced to catch a
     reader answering "the newest vocabulary". It is deleted rather than repointed: 0009 took
     the member, the column and the table, so there is nothing left for it to be wrong
     about. */
});

describe("AC7 scoresOf is all four or nothing", () => {
  it("answers nothing for a release with no scorecard at all", async () => {
    const scoresOf = await bind("scoresOf");
    expect(
      await scoresOf(s.db, anonymous, handle, UNSCORED_SLUG),
      `Ruled: "\`scoresOf\` is all four or nothing. A half-written scorecard is not a ` +
        `scorecard." The three columns are nullable because "T000 stores no feature logic ` +
        `to compute them" (lib/db/schema.ts), so this release is ordinary rather than ` +
        `pathological.`,
    ).toBeUndefined();
  });

  it("answers nothing for a release stamped with one axis present and two null", async () => {
    /* One of the three axes present looks scored to anything that tests "autonomy is
       present", and it is exactly the state a re-score interrupted halfway leaves behind.
       Without this fixture the all-three rule is satisfied by a module that only ever
       checks one of them. */
    const scoresOf = await bind("scoresOf");
    expect(
      await scoresOf(s.db, anonymous, handle, HALF_SCORED_SLUG),
      `\`${HALF_SCORED_SLUG}\`'s current release carries an \`autonomy\`, with ` +
        `\`security\` and \`phase_coverage\` null.`,
    ).toBeUndefined();
  });

  /* A cell holding "three axes whose `autonomy` names no vocabulary is a half-written
     scorecard" stood here, with the `unstamped-bundle` fixture behind it. Both are deleted.
     `scoresOf` no longer skips a row for a missing version, and that widening is stated in
     `registry/scores.ts` rather than hidden: nothing can fail to name a vocabulary when
     there is one vocabulary and it carries no version. */
});

describe("AC7 no trace of the old values", () => {
  it("carries none of the superseded scorecard, and none of its ontology stamp", async () => {
    const found = await scores();
    const leaked = findTokens(found, oldTells);
    expect(
      leaked,
      `AC7: "the stored scores carry the new version and the old values are gone". Release ` +
        `1.0.0 still holds them — it is one join away, and it is the *most recent row*, so a ` +
        `reader ordering by \`created_at\` returns exactly this. Leaked: ` +
        `${JSON.stringify(leaked)}.`,
    ).toEqual([]);
  });

  it("does not merge the two releases' scorecards", async () => {
    /* A reader that aggregates rather than selects passes both halves above — the new
       values are present and the old ones are too — and the two assertions read as
       independent until they are put together. */
    const found = await scores();
    const newTokens = [sentinels.newAutonomy, sentinels.newSecurity, sentinels.newPhase];
    expect(findTokens(found, newTokens).sort()).toEqual([...newTokens].sort());
    expect(findTokens(found, oldTells)).toEqual([]);
  });
});
