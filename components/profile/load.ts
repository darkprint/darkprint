import type { CardVersionRecord, OntologyTerm } from "@/lib/core";
import type { Author, Blueprint } from "@/lib/types";
import {
  allBlueprints,
  allNodeCards,
  getNodeCard,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { getSharedDbClient } from "@/lib/db";
import type { SessionPayload } from "@/lib/server/auth";
import type { Actor } from "@/lib/server/policy";
import { actorFrom, getPublicAuthor } from "@/lib/server/accounts";
import { getProfile } from "@/lib/server/profiles";
import { listSaves } from "@/lib/server/saves";
import { bundlesOwnedBy } from "@/lib/data/bundles";
import { privateCardsOwnedBy, type PrivateCard } from "@/lib/data/cards";
import { starsFor } from "@/lib/data/node-community";
/* THE ONE `lib/data` IMPORT AC6 ALLOWS, AND IT IS ALLOWED BY ARGUMENT RATHER THAN BY
   EXEMPTION (D-262-16). `watchers`, `support`, `validated` and `pinned` have NO COLUMN:
   T130 measured that over all 125 columns across all 16 tables and cut all four from
   `ProfileRecord` for it, recording that the follow-up task "owes the tables before it
   owes the behaviour". `validated` additionally depends on T180's run reports, which are
   `todo`.

   So this is not a fixture the cutover forgot. It is four figures whose backend does not
   exist, and every one of them renders under a `◐` marker saying exactly that. D-78 moves
   a marker in one direction only, so removing them here would be the false-claim
   direction, and relocating them into an owned file would make AC6's grep green by
   changing an address rather than by changing what is behind the figures.

   **Delete this import when the columns land, and not before.** `joinedAt` has already
   gone — it is `getProfile`'s now — which is what the retirement of one of these looks
   like. */
import { profileFor, type Profile } from "@/lib/data/profiles";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { authorFor } from "./author";
import type { OwnedRow } from "./OwnedBundles";
import type { PinnedItem } from "./Pinned";
import type { ProfileTabId } from "./tabs";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-53 LIVE: the identity and the join date, off `@/lib/server/accounts` and
//   `@/lib/server/profiles` rather than a per-handle endpoint.
// SEAM-61 LIVE: the Saved tab, off `@/lib/server/saves`.
// TODO(SEAM-64) (cited at line 118): GET /api/authors/{handle}/bundles?q&visibility&sort
// TODO(SEAM-113) (cited at line 137): GET /api/authors/{handle}/cards?include=private&visibility

/* ============================================================
   Everything the five profile routes read, assembled once.

   SERVER ONLY: this reaches `@/lib/db` and `@/lib/content`. The five pages are server
   components and each one renders a different slice of this, so the alternative to one
   loader is the same queries copied five times, drifting the first time one of them
   changes what "authored by" means.

   ── Who the owner is, and it is no longer a fixture (AC1) ──
   `owner` is now a comparison between the handle in this request's session and the handle
   in the URL. **The assumption this replaces is the one the contract names as this task's
   central difficulty**: there was no session, `ACCOUNT` seeded exactly one handle as the
   signed-in one, and both variants were prerendered — so the owner view was a *page*, not
   a state, and every reader got the same one. It is a state now, one URL renders two
   things, and the routes are dynamic because of it.

   The old docblock said "There is a fiction and the page says so above the fold". There is
   no fiction left to disclose, so `ProfileShell` no longer discloses one.

   ── What is real, and what is still seeded ──
   Real: the identity (`getPublicAuthor` — an unknown handle is `undefined` and the route
   404s), the join date and the blueprint and term counts (`getProfile`, both computed per
   actor so an owner's counts include their private rows and a visitor's do not), and the
   Saved list (`listSaves`, filtered to what the reader may still see).

   Still seeded, each under its own `◐`: the archive-derived content, because moving that
   onto `@/lib/server/registry` is T260's and T261's cutover and **T262 does not depend on
   T080**; and the four account figures in the import note above.
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
  profile: Profile;
  /** Whether the reader's own session names this handle. */
  owner: boolean;
  /** When the account was created. Real, off `getProfile`. */
  joinedAt: Date;
  /** Published in `content/`, authored by this handle. Counted. */
  blueprints: Blueprint[];
  cards: NodeTile[];
  /** Local vocabulary terms namespaced with this handle (doc 3 §7). Counted. */
  terms: OntologyTerm[];
  /** The owner's list: published rows resolved against the archive, private ones seeded. */
  owned: OwnedRow[];
  /**
   * The owner's card shelf: `cards` above, plus this handle's rows from
   * `lib/data/cards.ts`, both already resolved to `NodeSummary` so `OwnedCards` never
   * needs to know two sources are behind the one list. For a visitor this is `cards`
   * mapped the same way and nothing else — `privateCardsOwnedBy` answers empty for every
   * handle but the one seeded, so the field would carry the same rows either way, but
   * computing it only for the owner keeps the rule "a visitor never receives a private
   * row" true of the DATA rather than true only of what the page chooses to render.
   */
  ownedCards: NodeSummary[];
  saves: readonly SavedRow[];
  pinned: PinnedItem[];
  counts: Partial<Record<ProfileTabId, number>>;
}

function tileFor(record: CardVersionRecord): NodeTile {
  const ontology = getOntologyView();
  return {
    record,
    typeLabel:
      ontology.resolve(record.card.type, "node-type")?.term.label ?? record.card.type,
    usedIn: getRegistry().usersOf(record.id).length,
    /* Seeded, and it stays seeded for D-262-07's reason: `getSignals` exists in
       `lib/server/counters` but `app/api/signals/**` does not, so nothing counts a star
       yet and the `◐` over this figure has not earned its removal. */
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
    requiresHuman: card.requiresHuman,
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
 * A `PrivateCard` fixture (`lib/data/cards.ts`) at the same `NodeSummary` shape, so
 * `OwnedCards` draws it with the one tile every card on the site now uses. `usedIn` is
 * `0` unconditionally — nothing published can pin a ref the archive does not carry — and
 * `author` is resolved the same way a public card's is, so the identity row at the top of
 * the tile looks like every other one.
 */
function privateNodeSummaryFor(card: PrivateCard, author: Author | undefined): NodeSummary {
  return {
    id: card.id,
    version: card.version,
    ref: `${card.id}@${card.version}`,
    name: card.name,
    action: card.action,
    type: card.type,
    typeLabel: card.typeLabel,
    phases: card.phases,
    tools: card.tools,
    requiresHuman: card.requiresHuman,
    riskMarkers: card.riskMarkers,
    usedIn: 0,
    author,
    visibility: "private",
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
     stale when the policy changes. */
  const record = await getProfile(db, actor, username);

  const seeded = profileFor(username);

  const blueprints = allBlueprints().filter((b) => b.author.username === username);
  const cards = allNodeCards()
    .filter((entry) => entry.card.author === username)
    .map(tileFor);
  const terms = getOntologyView().ontology.terms.filter((term) =>
    term.id.startsWith(`${username}/`),
  );

  const bySlug = new Map(blueprints.map((b) => [b.slug, b]));
  const owned: OwnedRow[] = bundlesOwnedBy(username).map((bundle) => {
    const blueprint = bySlug.get(bundle.slug);
    return blueprint === undefined ? { bundle } : { bundle, blueprint };
  });

  /* One account read for the whole shelf: every row on it is authored by the handle this
     page is about, so a per-tile lookup would be the same query N times. */
  const ownedCards: NodeSummary[] = [
    ...cards.map((tile) => nodeSummaryFor(tile, author)),
    ...privateCardsOwnedBy(username).map((card) => privateNodeSummaryFor(card, author)),
  ];

  /* `[]` for a pin the archive cannot resolve, rather than a placeholder card. The guard
     against that happening silently is `tabs.test.ts`, which holds every pin in
     `lib/data/profiles.ts` against the archive. */
  const pinned: PinnedItem[] = seeded.pinned.flatMap((pin): PinnedItem[] => {
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
    cards: owner ? ownedCards.length : cards.length,
    terms: record?.counts.terms ?? terms.length,
  };
  if (owner) counts.saved = saves.length;

  return {
    author,
    profile: seeded,
    owner,
    /* Real, and the one figure that has left the seeded four: `getProfile` reads the
       account's own `created_at`. `record` is `undefined` only if the account row went
       away between two statements — a rename or a deletion landing mid-request, which
       `getProfile` answers as "no such handle" — so the seeded date is the fallback for a
       race rather than for an ordinary reader. */
    joinedAt: record?.joinedAt ?? new Date(seeded.joinedAt),
    blueprints,
    cards,
    terms,
    owned,
    ownedCards,
    saves,
    pinned,
    counts,
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
