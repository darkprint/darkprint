import type { CardVersionRecord, OntologyTerm } from "@/lib/core";
import type { Author, Blueprint } from "@/lib/types";
import {
  allBlueprints,
  allNodeCards,
  getNodeCard,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { getAuthor } from "@/lib/data";
import { ACCOUNT } from "@/lib/data/account";
import { SAVES, bundlesOwnedBy, type Save } from "@/lib/data/bundles";
import { privateCardsOwnedBy, type PrivateCard } from "@/lib/data/cards";
import { starsFor } from "@/lib/data/node-community";
import { profileFor, type Profile } from "@/lib/data/profiles";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import type { OwnedRow } from "./OwnedBundles";
import type { PinnedItem } from "./Pinned";
import type { ProfileTabId } from "./tabs";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-54) (cited at line 79): folded into SEAM-42
// TODO(SEAM-64) (cited at line 82): GET /api/authors/{handle}/bundles?q&visibility&sort
// TODO(SEAM-113) (cited at line 138): GET /api/authors/{handle}/cards?include=private&visibility

/* ============================================================
   Everything the five profile routes read, assembled once.

   SERVER ONLY: `@/lib/content` reaches the filesystem at build time. The five pages are
   server components and each one renders a different slice of this, so the alternative to
   one loader is the same six archive queries copied five times, drifting the first time
   one of them changes what "authored by" means.

   ── Who the owner is, and why that is a fixture ──
   There is no session. `ACCOUNT` in `lib/data/account.ts` seeds exactly one handle as the
   signed-in one, so `/u/mara-veil` renders the owner view and every other profile renders
   the visitor view. Both are prerendered, which is the only way this can work with no
   server: the owner view is a *page*, not a state.

   That is a fiction and the page says so above the fold rather than letting a reader
   conclude they are logged in.
   ============================================================ */

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
  /** Whether the seeded signed-in account is this handle. */
  owner: boolean;
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
  saves: readonly Save[];
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
    support: starsFor(record.id),
  };
}

/**
 * A `NodeTile` at `/nodes`' own tile altitude, so a profile's card grid is the same
 * component drawing the same fields instead of a second tile with its own idea of what a
 * node card shows. Resolves the same three ontology lookups `/nodes` resolves server-side
 * (phases, risk markers, author), off the same `NodeTile` this file already builds.
 */
export function nodeSummaryFor(tile: NodeTile): NodeSummary {
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
    author: card.author === undefined ? undefined : getAuthor(card.author),
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
function privateNodeSummaryFor(card: PrivateCard): NodeSummary {
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
    author: getAuthor(card.owner),
    visibility: "private",
  };
}

/** Everything about one handle, or `undefined` when the author table has no such row. */
export function profileView(username: string): ProfileView | undefined {
  const author = getAuthor(username);
  if (author === undefined) return undefined;

  const owner = username === ACCOUNT.author.username;
  const profile = profileFor(username);

  const blueprints = allBlueprints().filter((b) => b.author.username === username);
  const cards = allNodeCards()
    .filter((record) => record.card.author === username)
    .map(tileFor);
  const terms = getOntologyView().ontology.terms.filter((term) =>
    term.id.startsWith(`${username}/`),
  );

  const bySlug = new Map(blueprints.map((b) => [b.slug, b]));
  const owned: OwnedRow[] = bundlesOwnedBy(username).map((bundle) => {
    const blueprint = bySlug.get(bundle.slug);
    return blueprint === undefined ? { bundle } : { bundle, blueprint };
  });

  const ownedCards: NodeSummary[] = [
    ...cards.map(nodeSummaryFor),
    ...privateCardsOwnedBy(username).map(privateNodeSummaryFor),
  ];

  /* `[]` for a pin the archive cannot resolve, rather than a placeholder card. The guard
     against that happening silently is `tabs.test.ts`, which holds every pin in
     `lib/data/profiles.ts` against the archive. */
  const pinned: PinnedItem[] = profile.pinned.flatMap((pin): PinnedItem[] => {
    if (pin.kind === "blueprint") {
      const blueprint = allBlueprints().find((b) => b.slug === pin.slug);
      return blueprint === undefined ? [] : [{ kind: "blueprint", blueprint }];
    }
    const [id, version] = pin.ref.split("@");
    const record = getNodeCard(id ?? "", version);
    return record === undefined ? [] : [{ kind: "node", ...tileFor(record) }];
  });

  /* The owner's Blueprints and Cards counts both include the private half and the
     visitor's never do, which is the whole point of the tab strip's own note: a visitor
     is told, in words, that the number they are reading is the public half. */
  const counts: Partial<Record<ProfileTabId, number>> = {
    blueprints: owner ? owned.length : blueprints.length,
    cards: owner ? ownedCards.length : cards.length,
    terms: terms.length,
  };
  if (owner) counts.saved = SAVES.length;

  return {
    author,
    profile,
    owner,
    blueprints,
    cards,
    terms,
    owned,
    ownedCards,
    saves: owner ? SAVES : [],
    pinned,
    counts,
  };
}
