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
import { starsFor } from "@/lib/data/node-community";
import { profileFor, type Profile } from "@/lib/data/profiles";
import type { OwnedRow } from "./OwnedBundles";
import type { PinnedItem } from "./Pinned";
import type { ProfileTabId } from "./tabs";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-54) (cited at line 78): folded into SEAM-42
// TODO(SEAM-64) (cited at line 81): GET /api/authors/{handle}/bundles?q&visibility&sort

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

  /* The owner's Blueprints count includes private bundles and the visitor's does not,
     which is the whole point of the tab strip's own note: a visitor is told, in words,
     that the number they are reading is the public half. */
  const counts: Partial<Record<ProfileTabId, number>> = {
    blueprints: owner ? owned.length : blueprints.length,
    cards: cards.length,
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
    saves: owner ? SAVES : [],
    pinned,
    counts,
  };
}
