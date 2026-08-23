/* ============================================================
   T170 — fixtures, and the state the criteria are about

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── NOTES ARE SEEDED THROUGH THE MODULE UNDER TEST; TARGETS ARE NOT ──
   Every `note` and every `note_vote` row in this suite is created by
   `postNote` and `voteNote`. That is D-70-22's lesson taken
   literally: T070's blind suite "covered" the `released_at` trap
   only because a fixture manufactured a row the ruling says cannot
   occur, so a broken predicate read the right way and the mutation
   was caught by accident. A hand-written `note` row is exactly that
   hazard here — whatever `postNote` normalises (the `target` upsert,
   the counter, the timestamp grain the cursor is keyed on) is
   precisely what a hand-written row would skip, and AC2 and AC6 are
   both ABOUT those things.

   The TARGETS a note attaches to are seeded by raw SQL, and the
   difference is deliberate rather than convenient. `bundle` and
   `card_version` carry no cross-column invariant a raw insert could
   violate — a bundle is `(owner, slug, visibility)` and that is the
   whole of it — so there is no impossible row to manufacture, which
   is the property D-70-22 is actually about. Going through
   `createBundle`/`addCard` would instead make this suite red for
   T010's and T020's reasons, and a blind suite whose fixtures depend
   on three other tasks' modules cannot tell their failure from its
   own subject's.

   Where a premise has to hold before a cell means anything it is
   ASSERTED at seed time, so a broken fixture reds as a broken
   fixture instead of silently inverting a later result.

   ── THE SHARED refId, AND WHY ONE STRING NAMES TWO KINDS ──
   AC1 is "a note posted on a blueprint never appears on a card", and
   the cell that discriminates is two targets differing ONLY in
   `kind`. A cell using two different refIds cannot see the defect it
   is about: an implementation that ignores `target.kind` entirely
   and keys on `refId` alone passes it, because the two refIds
   already differ. So AC1 needs ONE refId that legitimately names a
   target of each kind at once.

   `note.target_id` is `text` at `target.ref_id`'s grain (B-10), and
   for a blueprint that is the bundle's uuid — so the shared string
   is FORCED to be a uuid. A lowercase uuid also satisfies `CARD_ID`
   (`lib/core/card/schema.ts`), so it is a legal card id too. That is
   ASSERTED through T070's published `validateCardId` rather than
   read off the regex, so this fixture cannot quietly manufacture a
   card id production would refuse.

   ── SEQUENCED POSTS, AND WHY `createdAt` IS NOT LEFT TO CHANCE ──
   `seedNotes` posts one at a time and awaits each. AC2's cursor is
   keyset on `(createdAt, id)` and a page's ORDER is what the cell
   compares, so a fixture posting concurrently would hand every
   ordering cell a tie it cannot predict — T010 measured 32
   concurrent inserts landing on 12 distinct timestamps. Concurrency
   is what the AC4 and `target`-race cells drive DELIBERATELY, and
   nothing else here is concurrent by accident.
   ============================================================ */

import { cardDigest, type NodeCard } from "@/lib/core";
import { validateCardId } from "@/lib/server/naming";

import {
  type Namespace,
  type Scratch,
  type UnknownFn,
  bind,
  describe_,
  dropScratchDatabases,
  mark,
  scratchDatabase,
} from "./contract";

export type { Scratch };

/** One scratch database per suite file; vitest gives each file its own worker. */
export async function openDatabase(): Promise<Scratch> {
  return scratchDatabase();
}

export async function closeDatabase(): Promise<number> {
  return dropScratchDatabases();
}

/* --------------------- accounts --------------------- */

export interface AccountFixture {
  id: string;
  handle: string;
}

export async function seedAccount(s: Scratch, label = "t170"): Promise<AccountFixture> {
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

/** Several at once, so a vote cell can drive N distinct accounts without N call sites. */
export async function seedAccounts(
  s: Scratch,
  count: number,
  label = "voter",
): Promise<AccountFixture[]> {
  const made: AccountFixture[] = [];
  for (let i = 0; i < count; i += 1) made.push(await seedAccount(s, `${label}${i}`));
  return made;
}

/* --------------------- blueprints --------------------- */

export interface BundleFixture {
  /** `note.target_id` for a blueprint is the bundle's uuid — B-10, `schema.ts:250-256`. */
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

/**
 * Flips a bundle's visibility, asserting it really changed.
 *
 * This exists for one cell and the cell exists because of a hole in every other fixture
 * here: they all seed the bundle with `ownerId: author.id`, so the note's author is also
 * the parent's owner and AUTHORSHIP decides every refusal. A guard that consults the
 * PARENT is never what denies, so removing it reds nothing — and a single mutation on it
 * reports that zero and reads as *redundant with the authorship check*. Only an actor who
 * IS the author and is NOT the parent's owner reaches it.
 */
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
      `Setting bundle ${bundleId} to ${visibility} touched ${rows.length} rows, expected 1. ` +
        `The premise of the parent-gate cell is that the parent really changed state.`,
    );
  }
}

/* --------------------- cards --------------------- */

export const ONTOLOGY_VERSION = "0.1.0";

/** A complete `NodeCard`. Every required field of `lib/core/card/schema.ts` is present. */
export function nodeCard(cardId: string, version = "1.0.0"): NodeCard {
  return {
    id: cardId,
    name: "T170 fixture card",
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
    requiresHuman: false,
    riskMarkers: [],
    version,
    ontologyVersion: ONTOLOGY_VERSION,
  };
}

function cardSource(card: NodeCard): string {
  return [
    `id: ${card.id}`,
    `name: ${card.name}`,
    `type: ${card.type}`,
    `version: ${card.version}`,
    `ontology_version: ${card.ontologyVersion}`,
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "",
  ].join("\n");
}

/**
 * A card id `validateCardId` accepts, asserted rather than assumed. The AC1 cell needs one
 * refId naming a blueprint and a card at once, and a blueprint's refId is forced to be a
 * uuid — so if that ever stops being a legal card id, the cell must red HERE, as a broken
 * fixture, rather than quietly testing two targets that were never the same string.
 */
export function assertLegalCardId(cardId: string): void {
  const diagnostics = validateCardId(cardId);
  if (diagnostics.length !== 0) {
    throw new Error(
      `The fixture card id \`${cardId}\` is not one \`validateCardId\` accepts:\n` +
        `  ${diagnostics.map((d) => d.message).join("\n  ")}\n` +
        `  This is a BROKEN FIXTURE and not a failed criterion.`,
    );
  }
}

export interface CardFixture {
  /** `note.target_id` for a card is the BARE card id — never `id@version` (B-10). */
  cardId: string;
  version: string;
  ownerId: string;
}

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

/* --------------------- targets --------------------- */

export interface NoteTarget {
  kind: "blueprint" | "card";
  refId: string;
}

export function blueprintTarget(bundle: BundleFixture): NoteTarget {
  return { kind: "blueprint", refId: bundle.id };
}

export function cardTarget(card: CardFixture): NoteTarget {
  return { kind: "card", refId: card.cardId };
}

/**
 * One string naming a blueprint AND a card, for AC1's discriminating cell.
 *
 * The bundle's uuid is the shared string because a blueprint's refId cannot be anything
 * else; the card is then seeded UNDER THAT SAME ID, which `assertLegalCardId` proves is a
 * card id production would accept.
 */
export interface SharedRef {
  refId: string;
  bundle: BundleFixture;
  card: CardFixture;
  asBlueprint: NoteTarget;
  asCard: NoteTarget;
}

export async function seedSharedRef(s: Scratch, ownerId: string): Promise<SharedRef> {
  const bundle = await seedBundle(s, { ownerId });
  assertLegalCardId(bundle.id);
  const card = await seedCard(s, { ownerId, cardId: bundle.id });
  if (card.cardId !== bundle.id) {
    throw new Error(
      `The shared refId fixture did not share: bundle ${bundle.id}, card ${card.cardId}.\n` +
        `  AC1's discriminating cell needs ONE string naming both kinds. Two different ` +
        `strings make the cell pass against an implementation that ignores \`target.kind\` ` +
        `entirely, which is the defect it exists to catch.`,
    );
  }
  return {
    refId: bundle.id,
    bundle,
    card,
    asBlueprint: { kind: "blueprint", refId: bundle.id },
    asCard: { kind: "card", refId: bundle.id },
  };
}

/* --------------------- notes, through the module under test --------------------- */

/**
 * `postNote` bound and called, answering the id it created.
 *
 * Bound HERE rather than in a hook, so a cell using this fixture pays the absent-module red
 * at the point it plants — never before its premises have run. A red in 0ms where a
 * database round trip was expected is a cell that never started.
 */
export async function postOne(
  db: unknown,
  actor: unknown,
  target: NoteTarget,
  body: string,
): Promise<{ id: string; record: Record<string, unknown> }> {
  const postNote = await bind("postNote");
  const record = await postNote(db, actor, target, body);
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    throw new Error(`postNote answered ${describe_(record)}; the block publishes a NoteRecord.`);
  }
  const id = (record as Record<string, unknown>).id;
  if (typeof id !== "string" || id === "") {
    throw new Error(
      `postNote answered a record whose \`id\` is ${describe_(id)}. Every later cell keys ` +
        `on it — \`editNote\`, \`deleteNote\` and \`voteNote\` all take a \`noteId\`.`,
    );
  }
  return { id, record: record as Record<string, unknown> };
}

/**
 * `count` notes on one target, posted ONE AT A TIME and each awaited.
 *
 * Sequential on purpose: AC2's order is what the paging cells compare, and concurrent posts
 * collide on `createdAt` (T010: 32 inserts, 12 distinct timestamps) so the expected order
 * would stop being predictable. The suite's concurrency is deliberate and lives in the
 * cells that are ABOUT concurrency.
 */
export async function seedNotes(
  db: unknown,
  actor: unknown,
  target: NoteTarget,
  count: number,
  label = "note",
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const { id } = await postOne(db, actor, target, `${label} ${i} ${mark("body")}`);
    ids.push(id);
  }
  return ids;
}

/* --------------------- premises --------------------- */

/**
 * A premise, asserted rather than assumed.
 *
 * Every cell that plants state before measuring calls this on the planting, so a fixture
 * that silently did nothing reds as a broken premise instead of inverting the result below
 * it. The three-cell shape the last wave found — a cell sharing a one-shot fixture, where
 * the two cells WITH a premise guard reddened and the three without passed while measuring
 * a frozen branch — is what this exists for.
 */
export function premise(condition: boolean, what: string): void {
  if (condition) return;
  throw new Error(
    `PREMISE FAILED: ${what}\n` +
      `  This is a broken fixture, not a failed acceptance criterion. The measurement below ` +
      `it never ran against the state it names.`,
  );
}

/** The barrel's own namespace, for the surface cells. */
export async function notesNamespace(): Promise<Namespace> {
  const { loadNotes } = await import("./contract");
  return loadNotes();
}

export type { UnknownFn };
