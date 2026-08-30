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
import { starsFor } from "@/lib/data/node-community";
/* `starsFor` is the one `lib/data` import T280 leaves standing, and it feeds exactly one
   figure: the seeded `support` pill on a node-card tile (Pinned's mini-cards, `NodeTile`
   generally). It has no column and no counter — `lib/server/counters` counts a CARD's
   stars fine, but the pill this reads is `starsFor`'s own per-card seed number, a different
   figure from a live `getSignalsMany` star count, and swapping one for the other silently
   would be answering a question nobody asked rather than wiring the one that was.
   Everything else this file used to read off `lib/data/profiles.ts` — watchers, support,
   validated, pinned, and the join date — is gone from here as of T280: `0004_social` and
   `0007_drafts` gave every one of them a table, and `getProfile` and `ownedBundles` below
   read them off it. `lib/data/profiles.ts` and `lib/data/bundles.ts` are untouched and
   still exist — `tabs.test.ts` still holds their seeded rows against the archive — this
   file simply stopped being one of their readers. */
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { authorFor } from "./author";
import type { OwnedRow } from "./OwnedBundles";
import type { PinnedItem } from "./Pinned";
import type { ProfileTabId } from "./tabs";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-53 LIVE: the identity and the join date, off `@/lib/server/accounts` and
//   `@/lib/server/profiles` rather than a per-handle endpoint.
// SEAM-55 LIVE (T280): the pinned selection, off `getProfile`'s own `pinned` — see below.
// SEAM-56/57 LIVE (T280): watchers, support and the community signals line — see below.
// SEAM-59 LIVE (T132): the visitor's card shelf, off `cardsOwnedBy` — see below.
// SEAM-61 LIVE: the Saved tab, off `@/lib/server/saves`.
// SEAM-63/64 LIVE (T280): the owner's bundle shelf, off `ownedBundles` — see below.
// SEAM-113 LIVE (T132): the owner's card shelf, public and private together, off
//   `cardsOwnedBy` — see below. No dedicated `GET /api/authors/{handle}/cards` route was
//   built or is owed, the same in-process shape SEAM-63/64 settled for bundles.

/* ============================================================
   Everything the five profile routes read, assembled once.

   SERVER ONLY: this reaches `@/lib/db` and `@/lib/content`. The five pages are server
   components and each one renders a different slice of this, so the alternative to one
   loader is the same queries copied five times, drifting the first time one of them
   changes what "authored by" means.

   ── Who the owner is ──
   `owner` is a comparison between the handle in this request's session and the handle in
   the URL — see `readSession`'s own docblock for why that read has to happen at the
   client's request rather than at build time.

   ── T280: the shelf, the pins and the community line all cut over to the registry ──
   Four figures left the seeded fixture in this pass, and each one left because a table now
   holds it rather than because this file got tidier. A fifth, `ownedCards`, followed in the
   same wave once the count beside it (`counts.cards`, T132) started reading the registry
   and the tile list underneath it did not — see the bullet below the four:

   - `owned` used to be `bundlesOwnedBy(username)`, a fixture that invented five private
     rows per handle and called every public one by hand-copying its slug. It is
     `ownedBundles(db, actor, username)` now — a live reader over `bundle` itself
     (`lib/server/registry/owned.ts`), so a zero-release draft renders because it is a real
     row with no release yet, not because a fixture author decided this handle should have
     one. `OwnedRow` (`./OwnedBundles`) pairs each live row with the same slug's
     `content/`-archive entry when there is one, which is what lets a released row draw
     through the same `ContentRow` `/blueprints` uses.
   - `pinned` used to resolve `profileFor(username).pinned`, a hand-authored selection
     nobody's account could change. It resolves `getProfile`'s own `pinned` now — a stored,
     writable selection (`setPins`, T131) already filtered to what THIS actor may see
     (D-131-04) — so the archive lookup below is the same shape as before, over a
     different, live list of refs.
   - `watchers`, `support` and `validated` used to be `profileFor(username)`'s three
     other seeded figures. They are `getProfile`'s `watchers`/`support`/`validated` now —
     each a `count(*)` over a real table (`0004_social`'s `follow` and `account_support`,
     and `validated` over `run_report`), never a stored counter (T131's own AC1).
   - `downloads` and `stars`, the community-signals line `ProfileHeader` prints, used to be
     a fold over `Blueprint.downloads`/`.votes` and `NodeTile.support` — three more seeded
     fixture numbers, folded rather than read but no less invented for it. `signalsFor`
     below replaces the fold with one `getSignalsMany` call over the targets this handle's
     own live bundles and published cards resolve to (T150). Genuinely zero today for most
     handles, and that is the honest answer: nothing has starred or downloaded anything
     through the counters this pass wires, so a fold that still printed a seeded three-digit
     number would be the fiction this whole task exists to retire.
   - `ownedCards` used to be `cards.map(nodeSummaryFor)` (the archive's author-credited
     list, below) plus `privateCardsOwnedBy(username)`, a fixture seeded for one handle. It
     is `cardsOwnedBy(db, actor, username)` now (T132) — the same reader `counts.cards`
     already read — mapped through `nodeSummaryForOwned` below. Neither old source ever
     touched the registry, so an account whose card exists only there — published through a
     real bundle, no matching `content/cards/` file — counted 1 in the tab strip over an
     empty shelf underneath it. One reader now backs both figures, so they cannot disagree.

   `blueprints`, `cards` and `terms` — the AUTHOR-credited lists, read off `content/` by
   who wrote the byline — are unchanged, and deliberately so: they answer "what did this
   handle write", which is a fact about the archive, where `owned` answers "what does this
   account hold", a fact about the registry. The two questions have different answers for
   almost every seeded handle today, because B-20 puts the whole fixture archive under one
   registry owner while crediting each blueprint's author individually — and that gap is
   not a bug this file can close, only one it has to keep from blurring.
   ============================================================ */

/** A reader with no session. `Object.freeze` so a caller cannot make it somebody. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/** One node card, with the two figures a tile prints beside it. */
export interface NodeTile {
  record: CardVersionRecord;
  typeLabel: string;
  usedIn: number;
  support: number;
}

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
   * reader `getProfile` counts `counts.cards` with (T132, D-132-02 reading (a)), so this
   * list and that count are two views of one query rather than two answers that can drift
   * apart. Already actor-scoped, the same way `owned` above is: everything for the owner,
   * public rows only for anyone else (D-132-04 C-C) — no owner/visitor branch to write
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
  /** Accounts currently following this handle. Real, off `getProfile` (T131). */
  watchers: number;
  /** Accounts currently endorsing this handle. Real, off `getProfile` (T131). */
  support: number;
  /** Other accounts' public blueprints this handle has submitted a run report against. */
  validated: number;
  /** Summed `downloadCount` over this handle's own live bundles. Real, off `getSignalsMany`. */
  downloads: number;
  /** Summed `starCount` over this handle's own live bundles and published cards. */
  stars: number;
}

function tileFor(record: CardVersionRecord): NodeTile {
  const ontology = getOntologyView();
  return {
    record,
    typeLabel:
      ontology.resolve(record.card.type, "node-type")?.term.label ?? record.card.type,
    usedIn: getRegistry().usersOf(record.id).length,
    /* Seeded, and it stays seeded: this is `starsFor`'s own per-card figure, not the live
       `getSignalsMany` star count the profile's community-signals line now reads — see the
       file header. There is no `◐`-shedding change here, only the one this file already
       carries at the `starsFor` import. */
    support: starsFor(record.id),
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
 * reader that admits it, D-132-04 C-C), so the tile has to be able to say which it is.
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
 * is not AC6 bookkeeping: these rows are real now, they come out of `listSaves`, and they
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
}

/**
 * `SaveRecord` is `{ targetKind, refId, savedAt }` and `SavedRow` is a display row, so this
 * is the resolution between them. A target the archive cannot resolve yields `[]` rather
 * than a placeholder row: `listSaves` has already dropped everything the reader may not see
 * (T140 AC3), so what is left here is a target that is visible and simply not in `content/`
 * — which is every blueprint save at the moment, because `FavoriteStar` cannot write one
 * (D-262-04) and nothing else does.
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
 * "download" a reader would recognise as one. `stars` sums both halves, the same two
 * fixture folds (`Blueprint.votes` + `NodeTile.support`) this replaces.
 */
async function signalsFor(
  db: Db,
  actor: Actor,
  username: string,
  liveRows: readonly OwnedBundleSummary[],
  cards: readonly NodeTile[],
): Promise<{ downloads: number; stars: number }> {
  const owner = liveRows.length === 0 ? undefined : await resolveOwner(db, username);

  const bundleRecords =
    owner === undefined
      ? []
      : await Promise.all(liveRows.map((row) => getBundle(db, owner.accountId, row.slug)));

  const blueprintTargets: CounterTarget[] = bundleRecords.flatMap((record) =>
    record === undefined ? [] : [{ kind: "blueprint" as const, refId: record.id }],
  );
  const cardTargets: CounterTarget[] = cards.map((tile) => ({
    kind: "card" as const,
    refId: tile.record.id,
  }));

  const targets = [...blueprintTargets, ...cardTargets];
  if (targets.length === 0) return { downloads: 0, stars: 0 };

  const signals = await getSignalsMany(db, actor, targets);
  const blueprintSignals = signals.slice(0, blueprintTargets.length);
  const cardSignals = signals.slice(blueprintTargets.length);

  return {
    downloads: blueprintSignals.reduce((n, s) => n + s.downloadCount, 0),
    stars:
      blueprintSignals.reduce((n, s) => n + s.starCount, 0) +
      cardSignals.reduce((n, s) => n + s.starCount, 0),
  };
}

/**
 * Everything about one handle, for one reader.
 *
 * `undefined` when no account holds this handle — which the routes turn into a 404, and
 * which is also the answer for a handle outside T070's grammar. **`/u/Mara` is a 404 and
 * not a redirect to `/u/mara` (D-262-11):** the grammar admits `[a-z0-9-]` only, so `Mara`
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
     itself — which is the second copy of `visibleTo` that D-130-04 exists to prevent. */
  const actor: Actor = viewer === undefined ? ANONYMOUS : actorFrom(viewer);

  const account = await getPublicAuthor(db, username);
  if (account === undefined) return undefined;

  const author = authorFor(account);
  const owner = viewer !== undefined && viewer.handle === username;

  /* Per actor, not per handle. An owner's counts include their private rows and a
     visitor's do not, which is T130's AC2 falling out of the `Actor` rather than out of a
     branch here — a second owner/visitor test in this file would be the copy that goes
     stale when the policy changes. Also where `watchers`, `support`, `validated` and
     `pinned` come from now (T131) — see the file header. */
  const record = await getProfile(db, actor, username);

  const blueprints = allBlueprints().filter((b) => b.author.username === username);
  const cards = allNodeCards()
    .filter((entry) => entry.card.author === username)
    .map(tileFor);
  const terms = getOntologyView().ontology.terms.filter((term) =>
    term.id.startsWith(`${username}/`),
  );

  const bySlug = new Map(blueprints.map((b) => [b.slug, b]));

  /* T280: the account's own bundles, live. `ownedBundles` is already actor-scoped —
     everything for the owner, public rows only for anyone else — so there is no
     owner/visitor branch to write here either; see `lib/server/registry/owned.ts`. */
  const liveRows = await ownedBundles(db, actor, username);
  const owned: OwnedRow[] = liveRows.map((summary) => {
    const blueprint = bySlug.get(summary.slug);
    return blueprint === undefined ? { summary } : { summary, blueprint };
  });

  /* T132/SEAM-113: the account's own card shelf, live. `cardsOwnedBy` is already
     actor-scoped — everything for the owner, public rows only for anyone else — so there
     is no owner/visitor branch to write here either, matching `owned` above. This used to
     be `cards.map(nodeSummaryFor)` (the archive's author-credited list) plus
     `privateCardsOwnedBy(username)` (a seeded fixture): neither reads the registry, so an
     account whose card exists only there — published through a real bundle, no matching
     `content/cards/` file — counted 1 over an empty shelf. One reader now answers both the
     list and `counts.cards` below, so the two cannot disagree. */
  const ownedCardRows = await cardsOwnedBy(db, actor, username);
  const ownedCards: NodeSummary[] = ownedCardRows.map((row) => nodeSummaryForOwned(row, author));

  /* T280/SEAM-55: the stored, actor-filtered selection off `getProfile`, resolved against
     the content archive the same way the seeded selection always was — `[]` for a pin the
     archive cannot resolve, rather than a placeholder card. `record` is only ever
     `undefined` on the same race `joinedAt`'s fallback below guards against. */
  const pinned: PinnedItem[] = (record?.pinned ?? []).flatMap((pin): PinnedItem[] => {
    if (pin.kind === "blueprint") {
      const blueprint = allBlueprints().find((b) => b.slug === pin.slug);
      return blueprint === undefined ? [] : [{ kind: "blueprint", blueprint }];
    }
    const [id, version] = pin.ref.split("@");
    const card = getNodeCard(id ?? "", version);
    return card === undefined ? [] : [{ kind: "node", ...tileFor(card) }];
  });

  /* AC4: the owner's own saves, off the account rather than out of a fixture. A visitor
     gets none — `PROFILE_TABS` marks Saved `ownerOnly`, and a save is a private bookmark,
     so a visitor may not see the list OR the count. Read for the reader's OWN account id,
     never for the profile's: `listSaves` would refuse the second, and asking for it would
     be asking the store a question this page has no business asking. */
  const saves: readonly SavedRow[] =
    owner && viewer !== undefined
      ? (await listSaves(db, actorFrom(viewer), viewer.accountId)).flatMap(saveRowsFor)
      : [];

  /* The owner's Blueprints and Cards counts both include the private half and the
     visitor's never do, which is the whole point of the tab strip's own note: a visitor
     is told, in words, that the number they are reading is the public half. */
  const counts: Partial<Record<ProfileTabId, number>> = {
    blueprints: owner ? owned.length : (record?.counts.blueprints ?? blueprints.length),
    /* `ownedCardRows.length` rather than `record?.counts.cards` — `ownedCards` above is
       built from this exact array, so the count and the tile list are the SAME read
       rather than two reads of the same table that could race apart. `record.counts.cards`
       is `cardsOwnedBy(db, actor, handle).length` too (T132, D-132-02 reading (a)), so the
       two numbers already agreed in practice; this just removes the second query the
       agreement depended on. */
    cards: ownedCardRows.length,
    terms: record?.counts.terms ?? terms.length,
  };
  if (owner) counts.saved = saves.length;

  const { downloads, stars } = await signalsFor(db, actor, username, liveRows, cards);

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
 * PAGES at this URL (AC1) and the same title, which is correct — a `<title>` that changed
 * with the reader would be a private fact in a shared string.
 */
export async function profileMetadata(username: string): Promise<Author | undefined> {
  const { db } = getSharedDbClient();
  const account = await getPublicAuthor(db, username);
  return account === undefined ? undefined : authorFor(account);
}
