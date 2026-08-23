/* ============================================================
   T200 — the public world every filter cell reads

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   Nothing here is private. AC4's fixture lives in `privacy.test.ts`
   with its own database and its own tells, and it is separate on
   purpose: the leak sweep's claim is "these characters cannot
   appear except by leaking", which is only checkable when the
   admissible set is small enough to enumerate. A world carrying
   both halves makes that proof harder for no gain.

   ── the numbers that make the AC2 cells discriminate ──
   Four blueprints, whose slugs sort `s1 < s2 < s3 < s4` and whose
   stored autonomy levels in that order are **3, 1, 4, 2**. That
   sequence is non-monotone, and no rotation of it is: autonomy
   ascending is `s2 s4 s1 s3`, descending is `s3 s1 s4 s2`, and
   neither is the slug order. So a module that has quietly started
   ordering by autonomy cannot answer the same sequence as one that
   has not, which is the whole reason the levels are not 1, 2, 3, 4.

   ── the token that makes the AC5 cells discriminate ──
   `queryToken` appears in **s1's title, s2's title, and s3's
   summary**. Two hits therefore share one field-level fact and a
   third does not, so a response with `ordered: true` has at least
   one pair whose evidence can legitimately be identical — which is
   what gives the contiguity check something to measure. A token
   present once per blueprint would make every evidence value
   distinct and the check vacuous.
   ============================================================ */

import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "@/lib/core";

import {
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  type AccountFixture,
  type BundleFixture,
  type CardFixture,
  type OntologyFixture,
  type ReleaseFixture,
  type Scratch,
} from "./fixtures";

export interface Shelf {
  bundle: BundleFixture;
  release: ReleaseFixture;
  /** The stored `autonomy.level`, so a cell can state the sequence it expects. */
  level: number;
  autonomyClass: string;
  isDarkFactory: boolean;
}

export interface World {
  alpha: AccountFixture;
  beta: AccountFixture;

  s1: Shelf;
  s2: Shelf;
  s3: Shelf;
  /** A published fork of `s1`, so the `forks` key has something to include and exclude. */
  s4: Shelf;

  ontology: OntologyFixture;

  cardPlan: CardFixture;
  cardImpl: CardFixture;
  cardTest: CardFixture;
  /**
   * A card declaring NO phase, so `phase=unphased` has something to select.
   *
   * D-200-31: `unphased` is `NodeBrowser`'s sentinel for "cards that declare no phase"
   * (`const UNPHASED = "unphased"`, and `passes()` reads it as `node.phases.length > 0`).
   * It is accepted as a filter VALUE and is deliberately absent from the `phase` facet,
   * because a sentinel in the offered vocabulary makes that list neither a vocabulary nor a
   * projection of the hits — the same third thing D-200-24 refused for the five core phases.
   */
  cardUnphased: CardFixture;

  /** In s1.title, s2.title and s3.summary. Three hits, two sharing one field. */
  queryToken: string;
  /** In s2's summary and nowhere else. */
  soloToken: string;
  /** In s1's manifest `description` and nowhere else. D-200-21 puts `description` in scope. */
  descToken: string;
  /**
   * In s2's manifest `author` and nowhere else, and it must match NOTHING.
   *
   * D-200-21 keeps `manifest.author` out of the corpus while `ownerHandle` is in, and the
   * distinction is the whole point: `ownerHandle` is the registry's answer to who owns
   * this, and `manifest.author` is the bundle's own stale claim, which T250's
   * re-attribution deliberately left unrewritten. Searching the second matches handles
   * that hold no accounts.
   */
  authorToken: string;
  /** In nothing at all, and not a substring of anything seeded. */
  missToken: string;

  tagA: string;
  tagB: string;
  tagC: string;
  catA: string;
  catB: string;

  /** Every slug, in the order slug-ascending puts them. */
  slugsInOrder: readonly string[];
}

/** A `PhaseCoverage` covering exactly `covered`, with the rest of the five reported missing. */
function phaseCoverage(covered: readonly string[]): Record<string, unknown> {
  const byPhase: Record<string, string[]> = {};
  for (const id of CORE_PHASE_IDS) byPhase[id] = covered.includes(id) ? ["n0"] : [];
  return {
    covered: CORE_PHASE_IDS.filter((id) => covered.includes(id)),
    missing: CORE_PHASE_IDS.filter((id) => !covered.includes(id)),
    byPhase,
    unphased: [],
  };
}

/**
 * A complete `SecurityResult`, present on every release for a reason that is not decoration.
 *
 * `scoresOf` (`lib/server/registry/scores.ts`) answers `undefined` unless `autonomy`,
 * `security`, `phase_coverage` AND `scored_ontology_version_id` are all present — "a
 * half-written scorecard is not a scorecard". A release carrying `autonomy` alone would
 * therefore be invisible to a module that reads the scorecard through T080's published
 * reader, and the `autonomy` and `df` filter cells would have reddened a correct
 * implementation for a hole in this fixture.
 */
function security(level: number): Record<string, unknown> {
  return {
    level,
    raw: level,
    penalties: [],
    findings: [],
    rationale: `fixture: level ${level}`,
    ontologyVersion: "0.1.0",
    diagnostics: [],
  };
}

function autonomy(level: number, autonomyClass: string, isDarkFactory: boolean): Record<string, unknown> {
  return {
    autonomyClass,
    isDarkFactory,
    level,
    label: autonomyClass,
    fraction: level / 4,
    autonomousNodes: level,
    totalNodes: 4,
    contributions: [],
    rationale: `fixture: level ${level}`,
    ontologyVersion: "0.1.0",
    diagnostics: [],
  };
}

/**
 * No search token may be a substring of anything else the world plants, and no two may
 * overlap.
 *
 * A blacklist asserted with `includes` answers "do these characters appear" where the claim
 * is "did this match", and the two differ exactly when a token is a substring of admissible
 * content. `mark()` makes a collision very unlikely and "very unlikely" is not the claim a
 * filter cell makes, so it is checked rather than trusted — and a collision is a broken
 * fixture, raised here, not a red charged to somebody else's module.
 */
function assertTokensAreDiscriminating(
  tokens: Record<string, string>,
  others: readonly string[],
): void {
  const collisions: string[] = [];
  const entries = Object.entries(tokens);
  for (const [name, token] of entries) {
    for (const other of others) {
      if (other.includes(token)) {
        collisions.push(`${name} ${JSON.stringify(token)} is inside ${JSON.stringify(other)}`);
      }
    }
    for (const [otherName, otherToken] of entries) {
      if (otherName === name) continue;
      if (otherToken.includes(token)) {
        collisions.push(`${name} ${JSON.stringify(token)} is inside ${otherName}`);
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `A T200 search token is a substring of other fixture content, so a filter cell would ` +
        `match for the wrong reason.\n  ${collisions.join("\n  ")}\n` +
        `  This is a broken fixture. Re-mint the identifier; do not relax the cell.`,
    );
  }
}

export async function buildWorld(s: Scratch): Promise<World> {
  /* The published core vocabulary, seeded as rows rather than assumed.
     D-200-14 takes `/cards`'s `type` and `risk` facets and `/terms`'s `kind` facet from
     merged T030's ontology — a vocabulary, not a projection of the hit set — and T030
     reads them out of `ontology_term`. A version row with no term rows would leave those
     facets legitimately empty, and the AC3 cells would have reddened a correct module for
     a hole in this fixture. */
  const ontology: OntologyFixture = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
  for (const term of CORE_ONTOLOGY.terms) {
    await insertOntologyTerm(s, {
      versionId: ontology.id,
      term: term as unknown as Record<string, unknown>,
    });
  }
  const alpha = await insertAccount(s, mark("t200a"));
  const beta = await insertAccount(s, mark("t200b"));

  const queryToken = mark("qtok");
  const soloToken = mark("stok");
  const descToken = mark("dtok");
  const authorToken = mark("atok");
  const missToken = mark("mtok");
  const tagA = mark("taga");
  const tagB = mark("tagb");
  const tagC = mark("tagc");
  const catA = mark("cata");
  const catB = mark("catb");

  const cardPlan = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-plan"),
    phases: ["planning"],
    type: "agent",
    requiresHuman: false,
    riskMarkers: [],
    name: "Plan the work",
  });
  const cardImpl = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-impl"),
    phases: ["implementation"],
    type: "tool",
    requiresHuman: true,
    riskMarkers: [],
    name: "Write the code",
  });
  const cardTest = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-test"),
    phases: ["testing"],
    type: "agent",
    requiresHuman: false,
    riskMarkers: ["irreversible-action"],
    name: "Run the suite",
  });
  /* No phase at all, which is the normal state for an intake or a retrieval step and is
     never a gap (`lib/core/analysis/phase-coverage.ts`). It declares `agent` and carries no
     risk marker, so it changes no other filter cell's expected set. */
  const cardUnphased = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-unphased"),
    phases: [],
    type: "agent",
    requiresHuman: false,
    riskMarkers: [],
    name: "Fetch the input",
  });

  const shelf = async (
    slug: string,
    o: {
      owner: AccountFixture;
      title: string;
      summary: string;
      description?: string;
      author?: string;
      tags: readonly string[];
      category: string;
      cards: readonly CardFixture[];
      covered: readonly string[];
      level: number;
      autonomyClass: string;
      isDarkFactory: boolean;
      lineage?: { ownerId: string; slug: string; version: string };
    },
  ): Promise<Shelf> => {
    const bundle = await insertBundle(s, { owner: o.owner, slug, visibility: "public" });
    if (o.lineage !== undefined) {
      await s.query(
        "update bundle set lineage_owner_id = $1, lineage_slug = $2, lineage_version = $3 where id = $4",
        [o.lineage.ownerId, o.lineage.slug, o.lineage.version, bundle.id],
      );
    }
    const release = await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: o.cards,
      manifest: manifest({
        slug,
        title: o.title,
        summary: o.summary,
        description: o.description,
        author: o.author,
        tags: o.tags,
        category: o.category,
      }),
      autonomy: autonomy(o.level, o.autonomyClass, o.isDarkFactory),
      security: security(o.level),
      phaseCoverage: phaseCoverage(o.covered),
      scoredOntologyVersionId: ontology.id,
    });
    return {
      bundle,
      release,
      level: o.level,
      autonomyClass: o.autonomyClass,
      isDarkFactory: o.isDarkFactory,
    };
  };

  const slug1 = mark("t200-s1");
  const slug2 = mark("t200-s2");
  const slug3 = mark("t200-s3");
  const slug4 = mark("t200-s4");

  const s1 = await shelf(slug1, {
    owner: alpha,
    title: `First shelf ${queryToken}`,
    summary: "A blueprint that plans.",
    description: `A longer account of the first shelf, ${descToken}.`,
    tags: [tagA],
    category: catA,
    cards: [cardPlan],
    covered: ["planning"],
    level: 3,
    autonomyClass: "conditional",
    isDarkFactory: false,
  });
  const s2 = await shelf(slug2, {
    owner: alpha,
    title: `Second shelf ${queryToken}`,
    summary: `A blueprint that implements, ${soloToken}.`,
    tags: [tagB],
    category: catB,
    author: authorToken,
    cards: [cardImpl],
    covered: ["implementation"],
    level: 1,
    autonomyClass: "assisted",
    isDarkFactory: false,
  });
  const s3 = await shelf(slug3, {
    owner: alpha,
    title: "Third shelf",
    summary: `A blueprint that tests, ${queryToken}.`,
    tags: [tagA, tagC],
    category: catA,
    cards: [cardTest],
    covered: ["testing"],
    level: 4,
    autonomyClass: "closed-loop",
    isDarkFactory: true,
  });
  const s4 = await shelf(slug4, {
    owner: beta,
    title: "Fourth shelf, a fork of the first",
    summary: "A blueprint forked from the first.",
    tags: [],
    category: catB,
    cards: [cardPlan, cardUnphased],
    covered: ["planning"],
    level: 2,
    autonomyClass: "supervised",
    isDarkFactory: false,
    lineage: { ownerId: alpha.id, slug: slug1, version: "1.0.0" },
  });

  /* Proved rather than assumed, and it became necessary at D-200-21: the blueprint corpus
     now includes `slug` AND `ownerHandle`, so a query token that happened to be a substring
     of a minted slug or handle would make a filter cell green for the wrong reason. Each
     search token is checked against every other string this world plants. */
  assertTokensAreDiscriminating(
    { queryToken, soloToken, descToken, authorToken, missToken },
    [
      slug1,
      slug2,
      slug3,
      slug4,
      alpha.handle,
      beta.handle,
      tagA,
      tagB,
      tagC,
      catA,
      catB,
      cardPlan.cardId,
      cardImpl.cardId,
      cardTest.cardId,
      cardUnphased.cardId,
      cardPlan.ref,
      cardImpl.ref,
      cardTest.ref,
      cardUnphased.ref,
      CORE_ONTOLOGY.version,
      ...CORE_ONTOLOGY.terms.map((term) => term.id),
    ],
  );

  return {
    ontology,
    alpha,
    beta,
    s1,
    s2,
    s3,
    s4,
    cardPlan,
    cardImpl,
    cardTest,
    cardUnphased,
    queryToken,
    soloToken,
    descToken,
    authorToken,
    missToken,
    tagA,
    tagB,
    tagC,
    catA,
    catB,
    slugsInOrder: [slug1, slug2, slug3, slug4],
  };
}
