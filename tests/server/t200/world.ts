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
   `queryToken` appears in **s1's title, s2's SUMMARY and s3's
   title**, and that order is load-bearing. Two hits share one
   field-level fact so the contiguity check has an equal-evidence
   group, and the third sits BETWEEN them in slug order so a
   ranking that dropped the evidence tiebreak would split it.

   The obvious spread — title, title, summary — measures nothing,
   and the adversary round proved it: under `(score, identity)` the
   equal pair already sits at ranks 0 and 1, so deleting the
   evidence tiebreak from the real implementation reddened 0 of 227
   cells. A group has to be SPLITTABLE before "it was not split" is
   a finding.
   ============================================================ */

import { CORE_ONTOLOGY, CORE_PHASE_IDS } from "@/lib/core";

import {
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  manifest,
  mark,
  word,
  type AccountFixture,
  type BundleFixture,
  type CardFixture,
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
 * `security` and `phase_coverage` are all present — "a half-written scorecard is not a
 * scorecard". A release carrying `autonomy` alone would therefore be invisible to a module
 * that reads the scorecard through T080's published reader, and the `autonomy` and `df`
 * filter cells would have reddened a correct implementation for a hole in this fixture.
 *
 * The rule wanted a fourth, `scored_ontology_version_id`, until
 * `0009_drop_ontology_versioning` dropped that column with the `ontology_version` table it
 * pointed into.
 */
function security(level: number): Record<string, unknown> {
  return {
    level,
    raw: level,
    penalties: [],
    findings: [],
    rationale: `fixture: level ${level}`,
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
export function assertTokensAreDiscriminating(
  tokens: Record<string, string>,
  others: readonly string[],
): void {
  /* Split the way the matcher splits, not the way a reader reads. `normalise` lowercases
     and collapses every run of non-letter non-digit to a space, so the unit that can collide
     is the WORD inside an identifier, never the identifier. Checking whole strings for
     containment is what let `qtok-87169-3` and `taga-87169-8` both pass while sharing the
     word `87169`.

     Containment is neither necessary nor sufficient for a match, and the guard is DELIBERATELY
     not the matcher. It is not sufficient because the prefix pass wants the document word to
     START with the token; it is not necessary because the stem pass reaches `query` from
     `queries` and the 3-gram pass has never needed containment at all. So this zero covers the
     prefix channel and nothing else, which is the channel a minted token can realistically
     collide on. A hazard to know rather than to guard: a token whose trailing counter spells
     `s` is stripped by the stemmer and becomes a stem-prefix of every token sharing its
     prefix. T200 is safe because its five tokens use five distinct prefixes, each minted
     once, and the hazard pre-dates the stem pass — the 3-gram channel already reached that
     pair at 8 of 10. */
  const split = (text: string): string[] =>
    text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((x) => x !== "");

  const collisions: string[] = [];
  const entries = Object.entries(tokens);
  const otherWords = new Set(others.flatMap(split));
  for (const [name, token] of entries) {
    for (const part of split(token)) {
      for (const other of otherWords) {
        /* ONE direction, and it is the one a cell can be hurt by: a document word CONTAINING
           one of these tokens makes a cell match something it did not mean to, while a
           document word contained INSIDE one of them cannot, because no cell ever queries a
           document word. Containment is wider than the prefix the matcher asks for, which is
           the right way for a fixture guard to err.

           The reverse check was here for one round and the full suite is what removed it.
           `word()` builds from the pid, and on a pid whose base-26 spelling happened to
           contain `ci` every token "collided" with the core ontology's `ci` term — 20 cells
           reported a broken fixture that was not broken, and only on some process ids. A
           guard that fires on a condition the matcher cannot reach is a flake with a
           justification attached. */
        if (other.includes(part)) {
          collisions.push(
            `${name} ${JSON.stringify(token)} is inside the document word ` +
              `${JSON.stringify(other)}`,
          );
        }
      }
    }
    for (const [otherName, otherToken] of entries) {
      if (otherName === name) continue;
      for (const part of split(token)) {
        for (const otherPart of split(otherToken)) {
          /* Both directions between the tokens themselves, because each of them IS queried:
             either containment makes one cell's token find another cell's content. */
          if (otherPart.includes(part) || part.includes(otherPart)) {
            collisions.push(`${name} ${JSON.stringify(token)} shares a word with ${otherName}`);
          }
        }
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
  /* The core vocabulary used to be seeded as rows here. D-200-14 takes `/cards`'s `type`
     and `risk` facets and `/terms`'s `kind` facet from merged T030's ontology — a
     vocabulary, not a projection of the hit set — and T030 read them out of `ontology_term`,
     so a version row with no term rows would have left those facets legitimately empty and
     reddened a correct module for a hole in this fixture. `0009_drop_ontology_versioning`
     dropped both tables, and the vocabulary those facets are taken from is `CORE_ONTOLOGY`
     in the process, merged with each release's `local_vocabulary`. Nothing to seed. */
  const alpha = await insertAccount(s, mark("t200a"));
  const beta = await insertAccount(s, mark("t200b"));

  /* `word()` and not `mark()`, and the adversary round is what forced it: `mark()` embeds
     the pid, `lib/server/search/text.ts` splits on every non-alphanumeric, and every
     identifier in this world therefore SHARED the word `87169`. A query token built that
     way matches every blueprint in every field, and its one-character tail matches any
     document word containing that digit. See `word()`'s docblock. */
  const queryToken = word("qtok");
  const soloToken = word("stok");
  const descToken = word("dtok");
  const authorToken = word("atok");
  const missToken = word("mtok");
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
    riskMarkers: [],
    name: "Plan the work",
  });
  const cardImpl = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-impl"),
    phases: ["implementation"],
    type: "tool",
    riskMarkers: [],
    name: "Write the code",
  });
  const cardTest = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-test"),
    phases: ["testing"],
    type: "agent",
    riskMarkers: ["irreversible-action"],
    name: "Run the suite",
  });
  /* No phase at all, which is the normal state for an intake or a retrieval step and is
     never a gap (`lib/core/analysis/phase-coverage.ts`). It carries no risk marker and no
     phase, so it changes no other filter cell's expected set.

     It is also the world's one staffed card, and it is staffed the only way a card can be:
     `human-gate` is subsumed by `human-in-the-loop`, which is what `human=1` asks the
     published vocabulary. `card-impl` used to carry the staffing, as `type: "tool"` beside
     a `requires_human: true` — a combination the schema no longer admits, and one where
     the card's own type contradicted the filter that selected it. `human-gate` declares no
     phase for the same reason `agent` did: `phase=unphased` selects this card and nothing
     above may start disagreeing with that. */
  const cardUnphased = await insertCard(s, {
    ownerId: alpha.id,
    id: mark("card-unphased"),
    phases: [],
    type: "human-gate",
    riskMarkers: [],
    name: "Approve the input",
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
    title: "Second shelf",
    summary: `A blueprint that implements, ${queryToken}, ${soloToken}.`,
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
    title: `Third shelf ${queryToken}`,
    summary: "A blueprint that tests.",
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
      ...CORE_ONTOLOGY.terms.map((term) => term.id),
    ],
  );

  return {
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
