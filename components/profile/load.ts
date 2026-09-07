import type { CardVersionRecord, OntologyTerm } from "@/lib/core";
import { requiresHuman } from "@/lib/core";
import type { Author, Blueprint } from "@/lib/types";
import {
  allBlueprints,
  allNodeCards,
  getNodeCard,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { getSharedDbClient, type Db } from "@/lib/db";
import type { SessionPayload } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";
import { actorFrom, getPublicAuthor, resolveOwner } from "@/lib/server/accounts";
import { getBundle } from "@/lib/server/archive";
import { type CounterTarget, getSignalsMany } from "@/lib/server/counters";
import { getProfile } from "@/lib/server/profiles";
import {
  type CardSummary,
  cardsOwnedBy,
  type OwnedBundleSummary,
  ownedBundles,
} from "@/lib/server/registry";
import { listSaves } from "@/lib/server/saves";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { authorFor } from "./author";
import type { OwnedRow } from "./OwnedBundles";
import { ownedRowsFor } from "./owned-rows";
import type { PinnedItem } from "./Pinned";
import { attachStars } from "./remove-save";
import type { ProfileTabId } from "./tabs";

/* ============================================================
   Everything the profile routes read, assembled once.

   SERVER ONLY: this reaches `@/lib/db` and `@/lib/content`. The profile pages are server
   components and each renders a different slice of this, so the alternative to one loader
   is the same queries copied per page, drifting the first time one of them changes what
   "authored by" means.

   `owner` compares the handle in this request's session with the handle in the URL, which
   is why the read happens per request rather than at build time.

   Two lists answer two different questions and are kept apart on purpose. `owned` is what
   the account HOLDS, live off the registry (`ownedBundles`, `cardsOwnedBy`), and it is the
   shelf a reader sees. `blueprints`, `cards` and `terms` are what the handle WROTE, read off
   `content/` by byline. The seeded archive puts every blueprint under one registry owner
   while crediting each one's author, so the two lists differ for almost every handle today.
   The shelf pairs a live row with its archive drawing by slug (`ownedRowsFor`), never by
   byline, or the owner's own profile draws no graph at all.

   `starsFor` is the one seeded figure left here: the support pill on a card tile. It has no
   column and no counter, and swapping the live star count in for it would answer a
   different question under the same label.
   ============================================================ */

/** A reader with no session. `Object.freeze` so a caller cannot make it somebody. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/** One node card, with the two figures a tile prints beside it. */
export interface NodeTile {
  record: CardVersionRecord;
  typeLabel: string;
  usedIn: number;
  /** The card's live star count, off `getSignalsMany`. */
  support: number;
}

/** A tile before its star count is known: the counters are read once for the whole shelf. */
type BareTile = Omit<NodeTile, "support">;

export interface ProfileView {
  author: Author;
  /** Whether the reader's own session names this handle. */
  owner: boolean;
  /** Whether the reader has ANY session — distinct from `owner`, which is this ONE handle. */
  viewerSignedIn: boolean;
  /** When the account was created. Off `getProfile`. */
  joinedAt: Date;
  /** Published in `content/`, authored by this handle. Counted. */
  blueprints: Blueprint[];
  cards: NodeTile[];
  /** Local vocabulary terms namespaced with this handle (doc 3 §7). Counted. */
  terms: OntologyTerm[];
  /** The account's own bundles, live off the registry: released and zero-release alike. */
  owned: OwnedRow[];
  /**
   * The account's own card shelf, live off `cardsOwnedBy(db, actor, username)` — the same
   * reader `getProfile` counts `counts.cards` with, so this
   * list and that count are two views of one query rather than two answers that can drift
   * apart. Already actor-scoped, the same way `owned` above is: everything for the owner,
   * public rows only for anyone else — no owner/visitor branch to write
   * here, and none in either `/u/[username]/cards` branch that reads this field.
   *
   * Distinct from `cards` above by the same axis `owned`/`blueprints` already split on:
   * `cards` answers "what did this handle AUTHOR" (the archive's `author:` byline);
   * `ownedCards` answers "what does this account HOLD" (`card_version.owner_id`,
   * authoritative and independent of what the body's own `author` field says).
   */
  ownedCards: NodeSummary[];
  saves: readonly SavedRow[];
  pinned: PinnedItem[];
  counts: Partial<Record<ProfileTabId, number>>;
  /** Accounts currently following this handle. Real, off `getProfile`. */
  watchers: number;
  /** Accounts currently endorsing this handle. Real, off `getProfile`. */
  support: number;
  /** Other accounts' public blueprints this handle has submitted a run report against. */
  validated: number;
  /** Summed `downloadCount` over this handle's own live bundles. Real, off `getSignalsMany`. */
  downloads: number;
  /** Summed `starCount` over this handle's own live bundles and published cards. */
  stars: number;
}

function tileFor(record: CardVersionRecord): BareTile {
  const ontology = getOntologyView();
  return {
    record,
    typeLabel:
      ontology.resolve(record.card.type, "node-type")?.term.label ?? record.card.type,
    usedIn: getRegistry().usersOf(record.id).length,
  };
}

/**
 * A `NodeTile` at `/nodes`' own tile altitude, so a profile's card grid is the same
 * component drawing the same fields instead of a second tile with its own idea of what a
 * node card shows. Resolves the same three ontology lookups `/nodes` resolves server-side
 * (phases, risk markers, author), off the same `NodeTile` this file already builds.
 */
export function nodeSummaryFor(tile: NodeTile, author: Author | undefined): NodeSummary {
  const ontology = getOntologyView();
  const { record, typeLabel, usedIn } = tile;
  const { card } = record;
  return {
    id: record.id,
    version: record.version,
    ref: record.ref,
    name: card.name,
    action: card.action,
    type: card.type,
    typeLabel,
    phases: card.phases.map((id) => ({
      id,
      label: ontology.resolve(id, "phase")?.term.label ?? id,
    })),
    tools: [...card.tools],
    // Derived, never stored. The card carries `type` and nothing beside it, so the tile
    // and the node page it links to cannot disagree about where the people are.
    requiresHuman: requiresHuman(ontology, card.type),
    riskMarkers: card.riskMarkers.map(
      (marker) => ontology.resolve(marker, "risk-marker")?.term.label ?? marker,
    ),
    usedIn,
    /* Passed in rather than looked up here, and that is the `lib/data` retirement rather
       than a signature preference: the identity row on a tile is ACCOUNT data, so it comes
       from `getPublicAuthor` now, and that is async where this function is not. Every
       caller draws one handle's cards, so the account is resolved once per page instead of
       once per tile. `undefined` for a card whose `author` names no account — the handle is
       inside the published bytes and nothing guarantees a row still holds it. */
    author,
    /* Explicit rather than left `undefined`: a card resolved off `content/` really is
       public, and saying so here is what lets `OwnedCards`/`NodeCardSummary` tell a
       private row apart from one that simply predates the `visibility` field. */
    visibility: "public",
  };
}

/**
 * A live `CardSummary` (`cardsOwnedBy`, `@/lib/server/registry`) at the same `NodeSummary`
 * shape `nodeSummaryFor` builds for an archive tile — `app/nodes/page.tsx`'s own inline
 * mapper resolves the identical three ontology lookups off the identical `NodeCard` body,
 * so this follows that shape rather than inventing a fourth.
 *
 * **Not a call to `nodeSummaryFor`.** That function takes a `NodeTile`, and building one
 * here would mean inventing a `CardVersionRecord.usedIn: string[]` (blueprint SLUGS) the
 * function never reads, only to satisfy a field `CardSummary.usedIn: BlueprintKey[]`
 * (owner + slug, B-09's two-part key) cannot supply — a fake value manufactured to please a
 * type is worse than the second short function this is.
 *
 * `visibility` is `row.visibility` rather than a constant: unlike every other card this
 * file draws, a row here can be the OWNER's own private card (`cardsOwnedBy` is the one
 * reader that admits an owner's own private rows), so the tile has to be able to say which it is.
 */
function nodeSummaryForOwned(row: CardSummary, author: Author | undefined): NodeSummary {
  const ontology = getOntologyView();
  const { card } = row;
  return {
    id: row.id,
    version: row.version,
    ref: row.ref,
    name: card.name,
    action: card.action,
    type: card.type,
    typeLabel: ontology.resolve(card.type, "node-type")?.term.label ?? card.type,
    phases: card.phases.map((id) => ({
      id,
      label: ontology.resolve(id, "phase")?.term.label ?? id,
    })),
    tools: [...card.tools],
    // Derived, never stored. The card carries `type` and nothing beside it, so the tile
    // and the node page it links to cannot disagree about where the people are.
    requiresHuman: requiresHuman(ontology, card.type),
    riskMarkers: card.riskMarkers.map(
      (marker) => ontology.resolve(marker, "risk-marker")?.term.label ?? marker,
    ),
    // The published join, over every version this exact ref pins — the same figure
    // `cardsOwnedBy` computes for `counts.cards`'s sibling reads, turned into a count
    // rather than left as the list a tile has no room to print.
    usedIn: row.usedIn.length,
    author,
    visibility: row.visibility,
  };
}

/**
 * One stored save as the Saved tab draws it.
 *
 * The display shape is defined HERE rather than imported from `lib/data/bundles`, and that
 * is deliberate: these rows are real now, they come out of `listSaves`, and they
 * carry the one thing the fixture's `Save` could not — the `target` that `Remove` needs to
 * un-save. A display type for live data belongs beside the reader that builds it.
 */
export interface SavedRow {
  /** Where it goes. */
  href: string;
  /** How it reads: the ref of a card, or the id of a term. */
  path: string;
  summary: string;
  kind: "blueprint" | "node card" | "vocabulary term";
  /** What `DELETE /api/account/saves` takes to remove this row. */
  target: { kind: "blueprint" | "card" | "term"; refId: string };
  /**
   * The star this save is the index of, for a row that has one.
   *
   * `Remove` has to clear both stores or the two disagree — a card leaves the shelf while
   * its public star stands, which is what §11.0 Q24 recorded. The star route is a TOGGLE,
   * so the removal needs to know where the star stands before it presses it, and that is
   * a read this loader already makes for other figures rather than a round trip the
   * client can afford per row. Absent on a term (no star exists) and on a blueprint (no
   * save row can be written for one).
   */
  star?: { api: string; starred: boolean };
}

/**
 * `SaveRecord` is `{ targetKind, refId, savedAt }` and `SavedRow` is a display row, so this
 * is the resolution between them. A target the archive cannot resolve yields `[]` rather
 * than a placeholder row: `listSaves` has already dropped everything the reader may not see
 *, so what is left here is a target that is visible and simply not in `content/`
 * — which is every blueprint save at the moment, because `FavoriteStar` cannot write one
 * and nothing else does.
 */
function saveRowsFor(record: { targetKind: string; refId: string }): SavedRow[] {
  if (record.targetKind === "card") {
    const card = allNodeCards().find((entry) => entry.id === record.refId);
    if (card === undefined) return [];
    return [
      {
        href: `/nodes/${card.id}`,
        path: card.ref,
        summary: card.card.action,
        kind: "node card",
        target: { kind: "card", refId: record.refId },
      },
    ];
  }
  if (record.targetKind === "term") {
    const term = getOntologyView().ontology.terms.find((entry) => entry.id === record.refId);
    if (term === undefined) return [];
    return [
      {
        href: `/ontology/${term.id}`,
        path: term.id,
        summary: term.description ?? term.label,
        kind: "vocabulary term",
        target: { kind: "term", refId: record.refId },
      },
    ];
  }
  return [];
}

/**
 * The saved rows again, each card row carrying where its star stands.
 *
 * One `getSignalsMany` over every card on the shelf rather than one read per row: the
 * shelf draws as many rows as the account holds, and the alternative is that many
 * requests for one boolean each. Only cards are asked about — a term has no star, and no
 * blueprint save exists to ask about — so a shelf of terms costs no query.
 *
 * `starredByCaller` is the reader's own, which is the right question here: the removal
 * presses a toggle on behalf of this account, not on behalf of the count.
 */
async function withStarState(
  db: Db,
  actor: Actor,
  rows: readonly SavedRow[],
): Promise<SavedRow[]> {
  const cardRows = rows.filter((row) => row.target.kind === "card");
  if (cardRows.length === 0) return [...rows];

  const signals = await getSignalsMany(
    db,
    actor,
    cardRows.map((row) => ({ kind: "card" as const, refId: row.target.refId })),
  );
  const starred = new Map(cardRows.map((row, i) => [row.target.refId, signals[i].starredByCaller]));

  return attachStars(rows, starred);
}

/**
 * Downloads and stars, off `getSignalsMany` — one query over every target this handle's own
 * live bundles and published cards resolve to.
 *
 * **Blueprint targets need a bundle id, and a live row does not carry one.**
 * `OwnedBundleSummary` (`lib/server/registry/owned.ts`) publishes a slug, not the row's own
 * primary key — the registry's public surface never has, for any reader (D-01: deep paths
 * are internal). `getBundle(db, accountId, slug)` is the same per-bundle resolution the
 * star route performs before every toggle, run here once per live row instead of once per
 * click. A slug that no longer resolves (read a moment after `ownedBundles` listed it)
 * contributes no target rather than failing the page — the same B-03 shape every reader in
 * this file already answers absence with.
 *
 * **Card targets need no resolution.** B-10 keys a card's counters on its bare id, the
 * same one `tileFor` already carries, whichever account wrote the published bytes — so
 * every entry in `cards` (this handle's own AUTHOR-credited, published cards) is a target
 * with no lookup in front of it.
 *
 * `downloads` sums the blueprint half only, matching the figure's own name: a card has no
 * "download" a reader would recognise as one. `stars` sums both halves. The per-card
 * counts come back as `cardStars` so each tile prints its own, and `pinnedCardIds` are
 * read in the same query without entering the sum: a pin is a preference, not authorship.
 */
async function signalsFor(
  db: Db,
  actor: Actor,
  username: string,
  liveRows: readonly OwnedBundleSummary[],
  cards: readonly BareTile[],
  pinnedCardIds: readonly string[],
): Promise<{ downloads: number; stars: number; cardStars: ReadonlyMap<string, number> }> {
  const owner = liveRows.length === 0 ? undefined : await resolveOwner(db, username);

  const bundleRecords =
    owner === undefined
      ? []
      : await Promise.all(liveRows.map((row) => getBundle(db, owner.accountId, row.slug)));

  const blueprintTargets: CounterTarget[] = bundleRecords.flatMap((record) =>
    record === undefined ? [] : [{ kind: "blueprint" as const, refId: record.id }],
  );
  const authored = cards.map((tile) => tile.record.id);
  const cardIds = [...new Set([...authored, ...pinnedCardIds])];
  const cardTargets: CounterTarget[] = cardIds.map((refId) => ({ kind: "card" as const, refId }));

  const targets = [...blueprintTargets, ...cardTargets];
  if (targets.length === 0) return { downloads: 0, stars: 0, cardStars: new Map() };

  const signals = await getSignalsMany(db, actor, targets);
  const blueprintSignals = signals.slice(0, blueprintTargets.length);
  const cardSignals = signals.slice(blueprintTargets.length);
  const cardStars = new Map(cardIds.map((id, i) => [id, cardSignals[i].starCount]));

  return {
    downloads: blueprintSignals.reduce((n, s) => n + s.downloadCount, 0),
    /* Summed over the authored list, versions included, so a card published twice counts
       its stars once per version the way the shelf draws it. */
    stars:
      blueprintSignals.reduce((n, s) => n + s.starCount, 0) +
      authored.reduce((n, id) => n + (cardStars.get(id) ?? 0), 0),
    cardStars,
  };
}

/**
 * Everything about one handle, for one reader.
 *
 * `undefined` when no account holds this handle — which the routes turn into a 404, and
 * which is also the answer for a handle outside T070's grammar. **`/u/Mara` is a 404 and
 * not a redirect to `/u/mara`:** the grammar admits `[a-z0-9-]` only, so `Mara`
 * is not a handle that can exist, and a redirect would assert that the two name one
 * identity — a claim the store never makes.
 */
export async function profileView(
  username: string,
  viewer: SessionPayload | undefined,
): Promise<ProfileView | undefined> {
  const { db } = getSharedDbClient();
  /* A signed-out reader is `anonymous` rather than no actor at all. That is what lets
     every read below take the same path for both readers and lets T060 decide what each
     one sees, instead of this file branching on "is there a session" and deciding for
     itself, which would be a second copy of the visibility rule. */
  const actor: Actor = viewer === undefined ? ANONYMOUS : actorFrom(viewer);

  const account = await getPublicAuthor(db, username);
  if (account === undefined) return undefined;

  const author = authorFor(account);
  const owner = viewer !== undefined && viewer.handle === username;

  /* Per actor, not per handle. An owner's counts include their private rows and a
     visitor's do not, and that falls out of the `Actor` rather than out of a branch here:
     a second owner/visitor test in this file would be the copy that goes stale when the
     policy changes. Also where `watchers`, `support`, `validated` and `pinned` come from. */
  const record = await getProfile(db, actor, username);

  const blueprints = allBlueprints().filter((b) => b.author.username === username);
  const authoredCards = allNodeCards()
    .filter((entry) => entry.card.author === username)
    .map(tileFor);
  const terms = getOntologyView().ontology.terms.filter((term) =>
    term.id.startsWith(`${username}/`),
  );

  /* Both readers are actor-scoped already: everything for the owner, public rows only for
     anyone else. The shelf pairs each live row with the archive by slug; see `ownedRowsFor`
     for why never by byline. */
  const liveRows = await ownedBundles(db, actor, username);
  const owned = ownedRowsFor(username, liveRows, allBlueprints());

  /* One reader answers both this list and `counts.cards` below, so the two cannot disagree
     for an account whose card exists only in the registry. */
  const ownedCardRows = await cardsOwnedBy(db, actor, username);
  const ownedCards: NodeSummary[] = ownedCardRows.map((row) => nodeSummaryForOwned(row, author));

  /* The stored, actor-filtered selection off `getProfile`, resolved against the content
     archive: `[]` for a pin the archive cannot resolve, rather than a placeholder card.
     `record` is only ever `undefined` on the same race `joinedAt`'s fallback below guards
     against. A pinned card gets its star count with the rest of the shelf, below. */
  type PinnedDraft = { kind: "blueprint"; blueprint: Blueprint } | { kind: "node"; tile: BareTile };
  const pinnedDrafts: PinnedDraft[] = (record?.pinned ?? []).flatMap((pin): PinnedDraft[] => {
    if (pin.kind === "blueprint") {
      const blueprint = allBlueprints().find((b) => b.slug === pin.slug);
      return blueprint === undefined ? [] : [{ kind: "blueprint", blueprint }];
    }
    const [id, version] = pin.ref.split("@");
    const card = getNodeCard(id ?? "", version);
    return card === undefined ? [] : [{ kind: "node", tile: tileFor(card) }];
  });

  /* The owner's own saves, off the account rather than out of a fixture. A visitor
     gets none — `PROFILE_TABS` marks Saved `ownerOnly`, and a save is a private bookmark,
     so a visitor may not see the list OR the count. Read for the reader's OWN account id,
     never for the profile's: `listSaves` would refuse the second, and asking for it would
     be asking the store a question this page has no business asking. */
  const saves: readonly SavedRow[] =
    owner && viewer !== undefined
      ? await withStarState(
          db,
          actorFrom(viewer),
          (await listSaves(db, actorFrom(viewer), viewer.accountId)).flatMap(saveRowsFor),
        )
      : [];

  /* The owner's Blueprints and Cards counts both include the private half and the
     visitor's never do, which is the whole point of the tab strip's own note: a visitor
     is told, in words, that the number they are reading is the public half. */
  const counts: Partial<Record<ProfileTabId, number>> = {
    blueprints: owner ? owned.length : (record?.counts.blueprints ?? blueprints.length),
    /* `ownedCardRows.length` rather than `record?.counts.cards` — `ownedCards` above is
       built from this exact array, so the count and the tile list are the SAME read
       rather than two reads of the same table that could race apart. `record.counts.cards`
       is `cardsOwnedBy(db, actor, handle).length` too, so the
       two numbers already agreed in practice; this just removes the second query the
       agreement depended on. */
    cards: ownedCardRows.length,
    /* No `terms` count: `ProfileTabId` admits no such tab, and a count with no tab to
       render it is a query nobody reads. `terms` itself is still
       computed above and still returned on the view, because the vocabulary is unchanged
       and only this one view of it left. */
  };
  if (owner) counts.saved = saves.length;

  const { downloads, stars, cardStars } = await signalsFor(
    db,
    actor,
    username,
    liveRows,
    authoredCards,
    pinnedDrafts.flatMap((pin) => (pin.kind === "node" ? [pin.tile.record.id] : [])),
  );
  const withStars = (tile: BareTile): NodeTile => ({
    ...tile,
    support: cardStars.get(tile.record.id) ?? 0,
  });
  const cards = authoredCards.map(withStars);
  const pinned: PinnedItem[] = pinnedDrafts.map((pin) =>
    pin.kind === "blueprint" ? pin : { kind: "node", ...withStars(pin.tile) },
  );

  return {
    author,
    owner,
    viewerSignedIn: viewer !== undefined,
    /* Real, off `getProfile`. `record` is `undefined` only if the account row went away
       between two statements — a rename or a deletion landing mid-request, which
       `getProfile` answers as "no such handle" — so `epoch` is a fallback for a race
       rather than for an ordinary reader; there is no seeded fixture left to fall back to
       for it. */
    joinedAt: record?.joinedAt ?? new Date(0),
    blueprints,
    cards,
    terms,
    owned,
    ownedCards,
    saves,
    pinned,
    counts,
    watchers: record?.watchers ?? 0,
    support: record?.support ?? 0,
    validated: record?.validated ?? 0,
    downloads,
    stars,
  };
}

/**
 * The identity behind one profile route's metadata, or `undefined` for a handle nobody
 * holds.
 *
 * Separate from `profileView` because `generateMetadata` runs beside the page rather than
 * inside it and needs one row, not the whole view. Reading the identity twice per request
 * is cheaper than assembling the archive twice, and Next caches neither for us.
 *
 * **Discriminated on absence rather than on a missing description.** The first shape of
 * this returned a bare `{ title }` and let each route detect "not found" by testing
 * `description === undefined` — which is also true of an account that simply has no bio,
 * so every bio-less builder would have lost their route's title suffix. An absent account
 * and an absent bio are different facts and a caller must not have to tell them apart by
 * their shadow.
 *
 * No session: metadata is the same for every reader. An owner and a visitor see different
 * PAGES at this URL and the same title, which is correct — a `<title>` that changed
 * with the reader would be a private fact in a shared string.
 */
export async function profileMetadata(username: string): Promise<Author | undefined> {
  const { db } = getSharedDbClient();
  const account = await getPublicAuthor(db, username);
  return account === undefined ? undefined : authorFor(account);
}

/**
 * The two public counts a profile's description quotes, read as a visitor so the shared
 * string never carries a private figure.
 */
export async function profileCounts(
  username: string,
): Promise<{ blueprints: number; cards: number }> {
  const { db } = getSharedDbClient();
  const record = await getProfile(db, ANONYMOUS, username);
  return { blueprints: record?.counts.blueprints ?? 0, cards: record?.counts.cards ?? 0 };
}
