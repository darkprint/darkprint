/* ============================================================
   T080 AC7 — "after an ontology release the stored scores carry
   the new version and the old values are gone"

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

   ── the third ontology version ──
   `7.3.0` is in the table and nothing references it. A reader that
   reports the newest ontology row rather than the stamp on the
   release it projected returns it, and that defect passes both
   "carries the new values" and "carries a new version" when they
   are checked separately.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

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
  insertOntologyVersion,
  insertRelease,
  mark,
  scratchDatabase,
} from "./contract";

const SLUG = "scored-bundle";
/** A bundle whose release carries `null` in all three score columns. */
const UNSCORED_SLUG = "unscored-bundle";
/** Stamped, one axis present, two null — the case a stamp check cannot tell from scored. */
const HALF_SCORED_SLUG = "half-scored-bundle";
/** All three axes, and an `autonomy` that does not say which vocabulary produced them. */
const UNSTAMPED_SLUG = "unstamped-bundle";

const OLD_ONTOLOGY = "7.1.0";
const NEW_ONTOLOGY = "7.2.0";
/** In `ontology_version` and referenced by nothing. */
const UNREFERENCED_ONTOLOGY = "7.3.0";
/* The stamp is `AutonomyResult.ontologyVersion` on the stored score, not a row id.
   `release.scored_ontology_version_id` and the `ontology_version` rows below are still
   written by this fixture and are read by nothing: keeping them is how the cells assert the
   reader IGNORES them, and `oldTells` carries the old row's id for exactly that. */

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
let oldOntologyId: string;
let newOntologyId: string;

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

  const oldOntology = await insertOntologyVersion(s, OLD_ONTOLOGY, "sha256:old-ontology");
  const newOntology = await insertOntologyVersion(s, NEW_ONTOLOGY, "sha256:new-ontology");
  await insertOntologyVersion(s, UNREFERENCED_ONTOLOGY, "sha256:unreferenced-ontology");
  oldOntologyId = oldOntology.id;
  newOntologyId = newOntology.id;

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
    scoredOntologyVersionId: oldOntology.id,
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
    scoredOntologyVersionId: newOntology.id,
  });

  /* Never scored: `release.autonomy`/`security`/`phase_coverage` are nullable because
     "T000 stores no feature logic to compute them" (lib/db/schema.ts), so this row is
     reachable and no fixture in this suite had one until a mutation went looking. */
  const unscored = await insertBundle(s, { owner, slug: UNSCORED_SLUG });
  await insertRelease(s, { bundle: unscored, version: "1.0.0", cards: [card] });

  /* Half written: one axis present and carrying its version, two null. */
  const half = await insertBundle(s, { owner, slug: HALF_SCORED_SLUG });
  await insertRelease(s, {
    bundle: half,
    version: "1.0.0",
    cards: [card],
    autonomy: { autonomyClass: "supervised", level: 2, ontologyVersion: NEW_ONTOLOGY },
    scoredOntologyVersionId: newOntology.id,
  });

  /* Three axes, and an `autonomy` that names no vocabulary. */
  const unstamped = await insertBundle(s, { owner, slug: UNSTAMPED_SLUG });
  await insertRelease(s, {
    bundle: unstamped,
    version: "1.0.0",
    cards: [card],
    autonomy: { autonomyClass: "supervised", level: 2 },
    security: { level: 3, raw: 3, penalties: [], findings: [], rationale: "4 − 1.00 → 3" },
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  });

  oldTells = [sentinels.oldAutonomy, sentinels.oldSecurity, sentinels.oldPhase, OLD_ONTOLOGY, oldOntology.id];

  assertTellsCannotOverMatch(oldTells, [
    sentinels.newAutonomy,
    sentinels.newSecurity,
    sentinels.newPhase,
    NEW_ONTOLOGY,
    UNREFERENCED_ONTOLOGY,
    newOntology.id,
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
        `SecurityResult; phaseCoverage: PhaseCoverage; ontologyVersion: string }\` for a ` +
        `bundle that exists and is scored.`,
    );
  }
  return answered as Record<string, unknown>;
}

describe("AC7 the reader returns the new values", () => {
  it("publishes the four members of Scores", async () => {
    expect(Object.keys(await scores()).sort()).toEqual([
      "autonomy",
      "ontologyVersion",
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

  it("stamps the scores with the ontology version the current release was scored under", async () => {
    const found = await scores();
    expect(
      found.ontologyVersion,
      `B-08: the axes are "stored beside the ontology version they were computed under", and ` +
        `\`Scores.ontologyVersion\` is declared \`string\` — the semver, as ` +
        `\`AutonomyResult.ontologyVersion\` carries it on the stored score, not the ` +
        `\`ontology_version.id\` uuid this release also still carries. ` +
        `${UNREFERENCED_ONTOLOGY} is the newest row in that table and is referenced by ` +
        `nothing, so reading "the latest ontology" answers that; \`CORE_ONTOLOGY.version\` ` +
        `is what reading "the vocabulary this build ships" answers, and neither is the ` +
        `version this release was scored under.`,
    ).toBe(NEW_ONTOLOGY);
    expect(found.ontologyVersion).not.toBe(UNREFERENCED_ONTOLOGY);
    expect(found.ontologyVersion).not.toBe(newOntologyId);
    expect(found.ontologyVersion).not.toBe(CORE_ONTOLOGY.version);
  });
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
    /* The case that distinguishes the rule from a stamp check. A release carrying
       `scored_ontology_version_id` and one of the three axes looks scored to anything that
       tests the stamp, or that tests "autonomy is present", and it is exactly the state a
       re-score interrupted halfway leaves behind. Without this fixture the all-four rule
       is satisfied by a module that only ever checks one of them. */
    const scoresOf = await bind("scoresOf");
    expect(
      await scoresOf(s.db, anonymous, handle, HALF_SCORED_SLUG),
      `\`${HALF_SCORED_SLUG}\`'s current release carries an \`autonomy\` naming its own ` +
        `vocabulary version, with \`security\` and \`phase_coverage\` null.`,
    ).toBeUndefined();
  });

  it("answers nothing for a scorecard with no ontology stamp", async () => {
    const scoresOf = await bind("scoresOf");
    expect(
      await scoresOf(s.db, anonymous, handle, UNSTAMPED_SLUG),
      `The fourth member is \`ontologyVersion: string\`, and B-08 is explicit that "a score ` +
        `that does not say which vocabulary produced it is not comparable with any other ` +
        `score" (lib/core/analysis/security.ts). Three axes whose \`autonomy\` names no ` +
        `vocabulary is a half-written scorecard in the direction nobody looks — and the one ` +
        `a reader is most likely to paper over, since substituting the version this build ` +
        `ships would produce a complete-looking answer that is a guess.`,
    ).toBeUndefined();
  });
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
        `${JSON.stringify(leaked)}. Old ontology row id was ${oldOntologyId}.`,
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
