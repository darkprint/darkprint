/* ============================================================
   T140 — fixtures, and the state AC3 is about

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── SAVES are seeded through the module under test; TARGETS are not ──
   Every `save` row in this suite is created by `saveTarget`. That
   is D-70-22's lesson taken literally: T070's blind suite "covered"
   the `released_at` trap only because a route fixture manufactured
   a `status = 'released'` row with a NULL `released_at` — a state
   the ruling says cannot occur — so a broken predicate read the
   right way and the mutation was caught by accident. A hand-written
   `save` row is exactly that hazard here, because whatever
   `saveTarget` normalises about a target is precisely what a
   hand-written row would skip.

   The TARGETS a save points at are seeded by raw SQL, and the
   difference is deliberate rather than convenient. `bundle`,
   `card_version` and `ontology_term` carry no cross-column
   invariant a raw insert could violate — a bundle is
   `(owner, slug, visibility)` and that is the whole of it — so
   there is no impossible row to manufacture, which is the property
   D-70-22 is actually about. Going through `createBundle`/`addCard`
   would instead make this suite red for T010's and T020's reasons,
   and a blind suite whose fixture depends on three other tasks'
   modules cannot tell their failure from its own subject's.

   Where a premise has to hold before a test means anything it is
   ASSERTED at seed time rather than assumed, so a broken fixture
   reds as a broken fixture instead of silently inverting a later
   result.

   ── the shared refId, and why one string names three kinds ──
   AC4 is "the three kinds round-trip distinguishably", and the cell
   that discriminates is two saves differing ONLY in `kind`. That
   needs one `refId` that legitimately names a target of each kind
   at once. `save.target_id` for a blueprint is the bundle's uuid
   (B-10, and `lib/db/schema.ts:320-330` says so), so the shared
   string is forced to be a uuid — and a lowercase uuid satisfies
   `CARD_ID` (`lib/core/card/schema.ts:167`,
   `/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/`),
   so it is a legal card id too, and a legal bare term id. That is
   ASSERTED through T070's published `validateCardId` rather than
   read off the regex, so this fixture cannot quietly manufacture a
   card id production would refuse.

   ── a term that is visible under EVERY reading of "resolve" ──
   The contract does not say what a `term` refId resolves against:
   `ontology_term` rows, `getLatestOntologyVersion`, or
   `openView(db, version)` over the merged core view are all live.
   A CORE term id with no `ontology_term` row discriminates between
   them, so this suite never uses one. Its visible term is a real
   `ontology_term` row under the only published `ontology_version`
   in its scratch database, which resolves under all three; its
   invisible term is a namespaced id in none of them, which fails to
   resolve under all three. Choosing fixtures that do not
   discriminate between two live readings is how a suite asserts
   only as far as the contract decides.
   ============================================================ */

import { CORE_ONTOLOGY, cardDigest, type NodeCard } from "@/lib/core";
import { validateCardId } from "@/lib/server/naming";

import {
  type Scratch,
  type Target,
  type TargetKind,
  bind,
  describe_,
  dropScratchDatabases,
  mark,
  scratchDatabase,
  targetSetOf,
} from "./contract";

export type { Scratch, Target, TargetKind };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<void> {
  await dropScratchDatabases();
}

/* --------------------- accounts --------------------- */

export interface AccountFixture {
  id: string;
  handle: string;
}

export async function seedAccount(s: Scratch, label = "t140"): Promise<AccountFixture> {
  const handle = mark(label);
  const [row] = await s.query(
    "insert into account (github_id, github_login, handle) values ($1, $2, $3) returning id",
    [`gh-${handle}`, `login-${handle}`, handle],
  );
  const id = row?.id;
  if (typeof id !== "string" || id === "") {
    throw new Error(`Could not seed an account: its id came back as ${describe_(id)}.`);
  }
  return { id, handle };
}

/* --------------------- blueprints --------------------- */

export interface BundleFixture {
  /** `save.target_id` for a blueprint is the bundle's uuid — B-10, `schema.ts:320-330`. */
  id: string;
  ownerId: string;
  slug: string;
}

export async function seedBundle(
  s: Scratch,
  o: { ownerId: string; visibility?: "public" | "private"; slug?: string },
): Promise<BundleFixture> {
  const slug = o.slug ?? mark("bp");
  const [row] = await s.query(
    "insert into bundle (owner_id, slug, visibility) values ($1, $2, $3) returning id",
    [o.ownerId, slug, o.visibility ?? "public"],
  );
  const id = row?.id;
  if (typeof id !== "string" || id === "") {
    throw new Error(`Could not seed a bundle: its id came back as ${describe_(id)}.`);
  }
  return { id, ownerId: o.ownerId, slug };
}

export async function setBundleVisibility(
  s: Scratch,
  bundleId: string,
  visibility: "public" | "private",
): Promise<void> {
  const rows = await s.query("update bundle set visibility = $2 where id = $1 returning id", [
    bundleId,
    visibility,
  ]);
  if (rows.length !== 1) {
    throw new Error(
      `Setting bundle ${bundleId} to ${visibility} touched ${rows.length} rows, expected 1. The ` +
        `premise of every AC3 cell is that the target really changed state.`,
    );
  }
}

export async function deleteBundle(s: Scratch, bundleId: string): Promise<void> {
  const rows = await s.query("delete from bundle where id = $1 returning id", [bundleId]);
  if (rows.length !== 1) {
    throw new Error(`Deleting bundle ${bundleId} touched ${rows.length} rows, expected 1.`);
  }
}

/* --------------------- ontology version --------------------- */

/** The version cards declare, and the only one this suite publishes into a scratch database. */
export const ONTOLOGY_VERSION = "0.1.0";

/* --------------------- cards --------------------- */

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(cardId: string, version = "1.0.0"): NodeCard {
  return {
    id: cardId,
    name: "T140 fixture card",
    type: "agent",
    phases: [],
    action: "do-the-fixture-thing",
    spec: "A self-sufficient instruction for the fixture node.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version,
  };
}

/** The wire form of a card. Stored verbatim in `card_version.source`, which is NOT NULL. */
function cardSource(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${card.name}`,
    `type: ${card.type}`,
    `version: ${card.version}`,
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "",
  ].join("\n");
}

export interface CardFixture {
  /** `save.target_id` for a card is the BARE card id — never `id@version` (B-10). */
  cardId: string;
  version: string;
  ownerId: string;
}

/**
 * One card version. `digest` is computed by `cardDigest` rather than filled with a placeholder,
 * so the row is one `addCard` could have written — a fixture carrying a digest that is not the
 * card's digest is an impossible row, and an impossible row is what makes a trap read as covered.
 */
export async function seedCard(
  s: Scratch,
  o: { ownerId: string; cardId?: string; version?: string; visibility?: "public" | "private" },
): Promise<CardFixture> {
  const cardId = o.cardId ?? mark("card");
  assertLegalCardId(cardId);
  const version = o.version ?? "1.0.0";
  const body = nodeCard(cardId, version);
  const [row] = await s.query(
    "insert into card_version (card_id, version, digest, owner_id, visibility, body, source) " +
      "values ($1, $2, $3, $4, $5, $6, $7) returning id",
    [
      cardId,
      version,
      cardDigest(body),
      o.ownerId,
      o.visibility ?? "public",
      JSON.stringify(body),
      cardSource(body),
    ],
  );
  if (typeof row?.id !== "string") {
    throw new Error(`Could not seed a card: its row id came back as ${describe_(row?.id)}.`);
  }
  return { cardId, version, ownerId: o.ownerId };
}

export async function setCardVisibility(
  s: Scratch,
  cardId: string,
  visibility: "public" | "private",
): Promise<void> {
  const rows = await s.query(
    "update card_version set visibility = $2 where card_id = $1 returning id",
    [cardId, visibility],
  );
  if (rows.length === 0) {
    throw new Error(`Setting card \`${cardId}\` to ${visibility} touched no rows, expected at least 1.`);
  }
}

export async function deleteCard(s: Scratch, cardId: string): Promise<void> {
  const rows = await s.query("delete from card_version where card_id = $1 returning id", [cardId]);
  if (rows.length === 0) {
    throw new Error(`Deleting card \`${cardId}\` touched no rows, expected at least 1.`);
  }
}

/**
 * The fixture's own premise, asserted through T070's published grammar rather than against the
 * regex restated here.
 *
 * It matters for exactly one fixture: the AC4 cell needs ONE string that names a blueprint, a
 * card and a term at once, and a blueprint's is forced to be a uuid. If a uuid is not a legal
 * card id this throws here, at seed time, naming what to do — rather than letting a later cell
 * red as though the module were wrong.
 */
export function assertLegalCardId(cardId: string): void {
  const diagnostics = validateCardId(cardId);
  if (diagnostics.length !== 0) {
    throw new Error(
      `The fixture card id \`${cardId}\` is not one \`validateCardId\` accepts:\n` +
        `  ${diagnostics.map((d) => d.message).join("\n  ")}\n` +
        `  This is a BROKEN FIXTURE and not a failed criterion. The AC4 cell needs one refId ` +
        `naming a blueprint, a card and a term at once, and a blueprint's refId is forced to be ` +
        `the bundle's uuid. If a uuid has stopped satisfying CARD_ID, split that cell into a ` +
        `card/term pair over a legal id plus a separate blueprint/card pair.`,
    );
  }
}

/* --------------------- ontology terms --------------------- */

/*
 * D-140-03: a saved TERM asks a different question from a saved blueprint or card. A term has
 * no owner and B-07 keeps terms public, so the predicate is EXISTENCE rather than visibility.
 *
 * ── What "exists" means changed, and these fixtures moved with it ──
 * It used to mean EXISTENCE IN THE CURRENT ONTOLOGY VERSION, read out of `ontology_term` rows
 * under the newest `ontology_version` row. So this file seeded term rows, seeded a second
 * version, and drove "published in 0.1.0 and absent from 0.2.0" as AC3's *deleted*. That
 * registry is gone: nothing writes either table, and `visible.ts` asks `CORE_ONTOLOGY` whether
 * it carries the id.
 *
 * Two consequences the cells below live with, stated here rather than discovered:
 *
 *   1. A term exists because the VOCABULARY carries it, so a fixture cannot mint one. These
 *      helpers hand out real core term ids instead of seeding rows, and they hand out a
 *      distinct one per call because two saves of one id are one save.
 *   2. **AC3's *deleted* is no longer separately reachable for a term.** A vocabulary term
 *      cannot stop existing at run time — `deprecated: {since, replacedBy}` retires a term
 *      while leaving its id in the vocabulary — so the only way a saved term id fails to
 *      resolve is that the vocabulary never carried it, which is D-140-07's *never existed*.
 *      The two branches merged because the thing that separated them was the version registry.
 */

/** Core term ids in a fixed order, so an allocation is reproducible across runs. */
const VOCABULARY_TERM_IDS: readonly string[] = [...CORE_ONTOLOGY.terms.map((term) => term.id)].sort();

/** Per scratch database: how many core term ids this file has handed out. */
const allocatedTerms = new Map<Scratch, number>();

/**
 * One term the living vocabulary really carries, or the caller's own id verbatim.
 *
 * Nothing is written. A term is not a row any more, so "seed" here means "reserve an id no
 * other cell in this database is using", which is what every caller actually needed.
 *
 * A supplied `termId` is returned unchanged, INCLUDING one the vocabulary does not carry: the
 * AC4 cells need a term sharing a bundle's uuid, and that id is legitimately unresolvable.
 */
export function seedTerm(s: Scratch, termId?: string): { termId: string; version: string } {
  if (termId !== undefined) return { termId, version: ONTOLOGY_VERSION };

  const used = allocatedTerms.get(s) ?? 0;
  const id = VOCABULARY_TERM_IDS[used];
  if (id === undefined) {
    throw new Error(
      `This database has already taken all ${VOCABULARY_TERM_IDS.length} core term ids, so ` +
        `there is no distinct term left to hand out.\n` +
        `  This is a BROKEN FIXTURE and not a failed criterion: two saves of one term id are ` +
        `ONE save, so a repeated id would make a cell measure deduplication under the name of ` +
        `whatever it thought it was measuring.`,
    );
  }
  allocatedTerms.set(s, used + 1);
  return { termId: id, version: ONTOLOGY_VERSION };
}

/** An id the living vocabulary does not carry, which is the whole of "this term does not resolve". */
export function absentTermId(): string {
  const id = mark("t140/absent");
  if (VOCABULARY_TERM_IDS.includes(id)) {
    throw new Error(
      `\`${id}\` is a real vocabulary term, so a cell built on it would assert the opposite of ` +
        `what it says. This is a BROKEN FIXTURE and not a failed criterion.`,
    );
  }
  return id;
}

/*
 * There is deliberately no `deleteTerm` helper here, and its absence is the D-140-03 ruling
 * rather than an omission. A saved term stops being listed when THE CURRENT ONTOLOGY VERSION
 * stops carrying it, not when somebody deletes an `ontology_term` row — versions are append-only
 * and a row deleted out of a published one is a state production does not reach. A helper that
 * offered it would invite a cell driving a state the contract does not describe, which is the
 * impossible-row hazard D-70-22 records, pointed at a fixture nobody would question.
 */

/* ============================================================
   Reading the state, through the barrel and past it

   `listSaves` is the published instrument and is what every set
   comparison uses. `storedRowCount` reaches PAST the barrel into
   the `save` table, and it is the one place this suite does — AC3
   rules that "the save row SURVIVES and the listing omits it", and
   survival is a claim about a row that no published return can
   describe by construction. R2's precedent is the same shape read
   the other way: `released_at` is on no published return, so
   T070's blind suite could not observe it and said so. Here the
   ruling makes the unobservable half load-bearing, so it is
   observed by the only instrument that reaches it, and the reach is
   confined to this one helper.
   ============================================================ */

export async function storedRowCount(s: Scratch, accountId: string): Promise<number> {
  const rows = await s.query("select count(*)::int as n from save where account_id = $1", [
    accountId,
  ]);
  const n = rows[0]?.n;
  if (typeof n !== "number") {
    throw new Error(`\`select count(*) from save\` answered ${describe_(n)}.`);
  }
  return n;
}

/** The owner's own visible set, as `kind:refId`, sorted. Ordering is unpublished and unpinned. */
export async function visibleTargets(
  s: Scratch,
  actor: unknown,
  accountId: string,
): Promise<string[]> {
  const listSaves = await bind("listSaves");
  return targetSetOf(
    await listSaves(s.db, actor, accountId),
    `listSaves(db, actor, "${accountId}")`,
  );
}

/** `kind:refId`, the identity this suite compares. Mirrors `targetOf` on the record side. */
export function key(target: Target): string {
  return `${target.kind}:${target.refId}`;
}
