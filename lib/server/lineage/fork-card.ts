/* ============================================================
   DarkPrint backend — forkCard
   The card half of the fork, written from `fork.ts` rather than
   beside it: same shape, same refusal discipline, same barrel,
   same status map. Where the two differ, they differ because a
   card is not a bundle, and each of those places is argued below
   rather than left as a choice somebody made once.

   ── what a fork of a card IS ──
   One new `card_version` row, owned by the forker, at an id in
   the forker's own namespace, carrying the upstream's bytes with
   three fields changed: `id`, `author`, `provenance`. Nothing is
   written on the upstream row and no second table is touched —
   `fork.ts` records the same non-effect for the bundle, and it
   holds here for the stronger reason that a `card_version` row is
   immutable once written.

   ── DECISION 1: the forked card's ID ──
   `<forker handle>/<name>`, always, and `name` defaults to the
   upstream id's last segment.

   `CARD_ID` (`lib/core/card/schema.ts:167`) admits exactly ONE
   optional namespace segment, so forking `lupo/planner` cannot
   produce `berti/lupo/planner` — that id does not parse, and a
   card whose id does not parse cannot be pinned by a DOT node,
   which is the whole purpose of a card id. So a fork REPLACES the
   namespace rather than nesting under it, and a fork of a fork
   lands at one segment deep like the first one did.

   The namespace is the forker's handle and is never the caller's
   to choose. That is a security decision and not a naming taste:
   a freely chosen target id makes this endpoint a probe for
   private cards, because 409 and 201 are distinguishable and the
   409 would confirm that somebody holds `<somebody>/<guess>`. A
   caller who may only ever write inside their own namespace can
   only ever learn about their own namespace. It also makes the
   namespace mean something — `berti/solver-a` is berti's, which
   is what a reader already assumes it says, and what nothing in
   the tree enforced before this function.

   **When the id is taken, the fork is refused rather than added
   to.** `addCard` alone would have appended a version to whatever
   chain already sits at that id, INCLUDING one owned by somebody
   else: nothing in `lib/server/cards` compares a new version's
   owner against the owner of the versions already there, and the
   unique index is on `(card_id, version)`, so two owners at one id
   and two versions never collide. A squatter on
   `<your handle>/planner` would have received a version written by
   you, and your fork would have vanished into their card. That
   hole is open for every other writer and is reported rather than
   closed here; at this door it is closed by `cardIdInUse`, which
   is deliberately owner- and visibility-BLIND, because the
   filtered question could not see a private squatter at all.

   ── DECISION 2: the forked card's VERSION ──
   The source version, unchanged.

   A card version pins a node to exact bytes and travels to
   Attractor as `card="id@version"` (`schema.ts:290-300`), so the
   question is what the fork's version should MEAN. Kept, it means
   what it meant upstream: `berti/planner@1.2.0` is the content
   the upstream published as `1.2.0`, and the next edit's bump is
   priced by `checkVersionChain` against the real predecessor.
   Reset to `0.1.0`, it would mean a generation that never
   existed: the same bytes would claim to be an early draft, and a
   later breaking change would be priced against a version nobody
   ever published. `import.ts` resets to `0.1.0` for the opposite
   case, a card COMPILED from a pipeline that was never a card at
   all, and says so ("the first thing this draft needs is for
   somebody to edit it"). A fork needs no edit to be correct.

   **What that means for `bundleDigest`.** `cardDigest` hashes
   every field except `author` and `provenance`, so the id is
   inside it and the fork's digest differs from the upstream's
   even though nothing about the node's behaviour changed. A
   blueprint that repins from `planner@1.2.0` to
   `berti/planner@1.2.0` therefore moves its `cardDigests`, and
   `bundleDigest` is taken over the DOT and those digests, so it
   moves too. A fork can never be a silent substitution inside a
   release: the pin, the card digest and the bundle digest all
   change together, and the release that carries the fork is a
   different release by content and not only by name. The one
   thing that does NOT move is the content identity
   `archive/registry.ts` computes for `duplicates()`, which holds
   `id`, `version`, `author` and `provenance` aside — so a fresh
   fork and its upstream group as the same card wearing two
   labels, which is true and is what that query is for.

   ── attribution, which is the whole reason this is not a copy ──
   `lib/core/attractor/import.ts`'s header is the governing text:
   a card in an archive that came from somebody else with no name
   on it is laundering, `author` says who is answerable for this
   row being here, `provenance` says where the content came from,
   and neither stands in for the other. A fork is exactly that
   situation. `author` becomes the forker's handle; `provenance`
   becomes `fork:darkprint <id>@<version> by <upstream handle>`,
   which is the marker, the exact upstream release taken, and the
   person whose writing it is.

   The upstream's own `author` value is overwritten, so the
   `by <handle>` clause is the only place the upstream author
   survives — it is written from the OWNER OF THE ROW rather than
   from the upstream body's `author` string, because the row's
   owner is the account the registry actually answers for and the
   body's `author` is free text somebody typed. An upstream owner
   with no handle yet leaves the clause off rather than inventing
   one; the ref alone still names the row, and a name nobody chose
   is the one thing worse than no name (`import.ts`'s rule).
   ============================================================ */

import type { Db } from "@/lib/db";
import { getAccount, publicAuthorsByIds } from "@/lib/server/accounts";
import {
  addCard,
  cardIdInUse,
  getCard,
  getLatestCard,
  restampCardSource,
  type CardRecord,
} from "@/lib/server/cards";
import { MAX_NAME_LENGTH, validateCardId, validateNamespace } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import type { NodeCard } from "@/lib/server/types";
import {
  cardIdInvalid,
  cardIdTaken,
  noHandle,
  noSuchCard,
  noSuchCardVersion,
  notSignedIn,
  unreadableCard,
} from "./errors";

/** The upstream release a card fork takes: an id and the version, as the caller named them. */
export interface CardForkSource {
  cardId: string;
  version: string;
}

/**
 * Where it lands. `name` is the un-namespaced half only — the namespace is the forker's
 * handle and is not the caller's to choose (see the header). `visibility` omitted means the
 * forker's own account default, never a constant here.
 */
export interface CardForkTarget {
  name?: string;
  visibility?: "public" | "private";
}

/**
 * The marker every forked card's `provenance` opens with.
 *
 * `derived:attractor`'s sibling and written to the same rule: a `<what happened>:<where>`
 * marker a reader AND a grep can tell from a hand-written provenance. Published so a caller
 * rendering "forked from" reads the marker off this module rather than retyping the literal.
 */
export const CARD_FORK_PROVENANCE_PREFIX = "fork:darkprint";

/**
 * Copy one card version into the actor's namespace, recording who took it and from where.
 *
 * Throws `ForkRefusedError`; `http.ts` maps every `kind` to its status. A card that is not
 * there and one the caller may not read are the same refusal for the same reason the bundle
 * fork gives (AC6, B-03), and `fork-card.db.scratch.test.ts` asserts the two MESSAGES are
 * equal rather than merely both refusing.
 *
 * **The version copied is the version named.** As in `forkBundle`, and against the same
 * alternative: falling back to the newest version would satisfy every "a fork records where
 * it came from" reading by writing a true sentence about the wrong release.
 */
export async function forkCard(
  db: Db,
  actor: Actor,
  from: CardForkSource,
  to: CardForkTarget,
): Promise<CardRecord> {
  /* `fork.ts`'s rule, unchanged: the id is a candidate the actor OFFERS and `getAccount`
     is what turns it into a decision, so every identity ruling T060 holds applies here
     without a second copy. Unreachable through HTTP, where `withSession` answers 401 first. */
  const forkerId = candidateAccountId(actor);
  if (forkerId === undefined) throw notSignedIn("forkCard");
  const forker = await getAccount(db, actor, forkerId);
  if (forker === undefined) throw notSignedIn("forkCard");

  /* A handle-less account is legal (T050 AC1) and has no namespace to fork into. Refused
     before the upstream is read, because it is a fact about the caller and needs no lookup —
     and because refusing after the read would make the refusal depend on what was found. */
  const handle = forker.author.handle;
  if (handle === null) throw noHandle();

  /* THE READ GRANT, and it is `getLatestCard` rather than a query: it applies T060's `can`
     over every stored version through `fetchVisibleVersions`, so an id nothing holds and an
     id whose every version is private to somebody else both answer `undefined` here. A
     second `can` call in this file would be a second opinion about a decision
     `lib/server/cards` already makes, which is the shape this repository charges hardest.

     Written and watched failing first: with the upstream read straight off the table
     instead, the stranger in `fork-card.db.scratch.test.ts`'s first cell forked a private
     card and the cell reported a `CardRecord` where it wanted a refusal. */
  const readable = await getLatestCard(db, actor, from.cardId);
  if (readable === undefined) throw noSuchCard();

  /* Named only after the grant, which is D-110-11 one layer down: a caller who may not read
     this card must not learn from the wording whether the version it guessed at exists. */
  const source = await getCard(db, actor, from.cardId, from.version);
  if (source === undefined) throw noSuchCardVersion();

  /* A row written under an older schema cannot be copied honestly — see `unreadableCard`.
     `body` is already `NodeCard | undefined` because `toCardRecord` asks `storedCard`, so
     this branch costs no second parse: `undefined` here IS "the stored body is not a card". */
  if (source.body === undefined) throw unreadableCard();
  const upstream: NodeCard = source.body;

  /* The upstream's own name, not its id: `<forker>/<upstream namespace>/<name>` is not an id
     `CARD_ID` admits, so a fork of a namespaced card replaces the namespace (header, D1). */
  const name = to.name ?? lastSegment(from.cardId);
  const targetId = `${handle}/${name}`;
  assertForkableId(handle, name, targetId);

  /* The published refusal for a collision, asked HERE so the caller gets the sentence the
     contract admits rather than a constraint name, and asked over EVERY version at the id
     rather than only the one being written: appending `1.2.0` to a chain that already exists
     is not a fork, and appending it to somebody else's chain is worse than not a fork.

     **`cardIdInUse` and not `listCardVersions`, and the difference was measured rather than
     reasoned about.** The visibility-filtered reader cannot see a PRIVATE row, and the unique
     index constrains `(card_id, version)` — so a stranger holding `<your handle>/planner@0.1.0`
     privately let this write `<your handle>/planner@1.0.0` straight into their chain, with no
     refusal anywhere. The cell that found it is named for it. `cardIdInUse` takes no `Actor`
     for that reason, and the bit it leaks is a bit about the caller's own namespace, which is
     the only namespace this function ever writes in.

     The read still cannot be atomic with the insert and does not need to be: `addCard`'s
     unique index arbitrates the race for the same version, and the fault arm below re-reads
     to tell that conflict from a store fault. */
  if (await cardIdInUse(db, targetId)) throw cardIdTaken(targetId);

  const provenance = `${CARD_FORK_PROVENANCE_PREFIX} ${source.cardId}@${source.version}${await upstreamClause(
    db,
    source.ownerId,
  )}`;
  const stamp = { id: targetId, author: handle, provenance };

  /* The body's three fields and the document's three keys, stamped from the same object so
     they cannot disagree. A `source` still declaring the upstream's id under the fork's row
     is what `/api/files/cards/**` would serve and what `darkprint validate` would then blame
     the downloader for; `restampCardSource` refuses rather than guesses when the stored
     document cannot take the edit, and an unrewritable document is an unforkable card. */
  const body: NodeCard = { ...upstream, ...stamp };
  const document = restampCardSource(source.source, stamp);
  if (document === undefined) {
    throw unreadableCard("Its document cannot be restamped without changing what it says.");
  }

  /* D-110-09's rule, which is `forkBundle`'s: the forker's own account default and never a
     module constant, and never the UPSTREAM's visibility either — a fork of a public card by
     somebody whose account defaults to private is private, and a fork of a private card by
     its own owner takes their default like any other write. */
  const visibility = to.visibility ?? forker.defaultVisibility;

  try {
    return await addCard(db, {
      cardId: targetId,
      version: source.version,
      ownerId: forkerId,
      visibility,
      body,
      source: document,
    });
  } catch (cause) {
    /* The race the read above cannot close, and the re-read is what tells it from a fault:
       if the id is occupied NOW, somebody else got there between the check and the insert
       and the caller is owed the same `card-id-taken` a moment earlier would have given
       them. Anything else is `addCard`'s own rejection and travels unaltered — a
       `CardStoreError` the route answers 500, which is right for a store that failed and
       for a body this function built wrongly, neither of which is the caller's fault.

       Asked with the same owner-blind reader as the check above, so a private winner of the
       race is refused with the same sentence rather than reported as a store fault. */
    if (await cardIdInUse(db, targetId)) throw cardIdTaken(targetId);
    throw cause;
  }
}

/** The un-namespaced half of a card id. `CARD_ID` admits one separator, so this is total. */
function lastSegment(cardId: string): string {
  const slash = cardId.lastIndexOf("/");
  return slash === -1 ? cardId : cardId.slice(slash + 1);
}

/**
 * Refuse a target id no DOT node could pin, naming which half is at fault.
 *
 * Both grammars come from `lib/server/naming`, which derives them from the engine's own
 * `CARD_ID` through `parseCardRef` rather than restating the regex — so a tightening in the
 * engine tightens this for free. The name is checked as a NAMESPACE-shaped segment because
 * that predicate is exactly "one legal segment, no `/`", which is what the second half of a
 * namespaced id has to be; a name carrying its own `/` is refused here rather than silently
 * producing a three-segment id that `validateCardId` would then reject with a sentence about
 * the whole id.
 *
 * The length bound is `MAX_NAME_LENGTH` and it is not decoration: `card_version_id_version_key`
 * is a btree unique index and a btree tuple has a hard ceiling (D-70-13 measured 2692
 * characters on this server, SQLSTATE 54000 above it). `validateCardId` is the pure grammar
 * and bounds nothing, so an unbounded name would pass every check here and raise a driver
 * error at the insert. A handle is at most 32, so the composed id is at most 288.
 */
function assertForkableId(handle: string, name: string, targetId: string): void {
  if (name.length > MAX_NAME_LENGTH) {
    throw cardIdInvalid(`\`${name.slice(0, 32)}…\` is longer than ${MAX_NAME_LENGTH} characters.`);
  }
  const nameIssues = validateNamespace(name);
  if (nameIssues.length > 0) {
    /* `validateNamespace`'s sentence says "Namespace", which is the wrong word for the half
       the caller submitted, so this one is written here — it is the only place a naming
       sentence is not passed through, and the reason is that it would name the wrong thing. */
    throw cardIdInvalid(`\`${name}\` is not a legal card name.`);
  }
  const handleIssues = validateNamespace(handle);
  if (handleIssues.length > 0) throw cardIdInvalid(handleIssues[0]!.message);
  const idIssues = validateCardId(targetId);
  if (idIssues.length > 0) throw cardIdInvalid(idIssues[0]!.message);
}

/**
 * ` by <handle>` for the upstream row's owner, or `""` when that account has no handle.
 *
 * Read off the OWNER of the row rather than the upstream body's `author` string: the owner is
 * the account this registry answers for, and `author` is free text the upstream author typed,
 * which may name somebody else entirely. `getPublicAuthor` is keyed by handle, so the id has
 * to go through `accounts`' own reader; a handle-less owner yields no clause rather than a
 * placeholder, on `import.ts`'s rule that a name nobody chose is worse than no name.
 */
async function upstreamClause(db: Db, ownerId: string): Promise<string> {
  const handle = await handleOf(db, ownerId);
  return handle === undefined ? "" : ` by ${handle}`;
}

/**
 * The handle an account id holds, or `undefined`.
 *
 * `resolveOwner` goes the other way (handle to id) and `getPublicAuthor` is keyed by handle,
 * so neither answers this question; `publicAuthorsByIds` does, and it is the reader
 * `lib/server/accounts` publishes for exactly this direction (D-WAVE-03). Failing to find one is not a
 * refusal — the fork still records the ref, which names the row that names the owner.
 */
async function handleOf(db: Db, ownerId: string): Promise<string | undefined> {
  const authors = await publicAuthorsByIds(db, [ownerId]);
  return authors.get(ownerId)?.handle ?? undefined;
}

/**
 * The account id an actor OFFERS, read as an own property and never inherited.
 *
 * `fork.ts`'s function, and it is duplicated rather than shared for one wave only — see the
 * Log. Read through `Object.hasOwn` because `is-owner.ts` does, and typed loosely because a
 * malformed actor is a refusal rather than a `TypeError` (2026-08-14 ruling).
 */
function candidateAccountId(actor: Actor): string | undefined {
  if (typeof actor !== "object" || actor === null || !Object.hasOwn(actor, "accountId")) return undefined;
  const offered = (actor as { accountId?: unknown }).accountId;
  return typeof offered === "string" && offered.length > 0 ? offered : undefined;
}
