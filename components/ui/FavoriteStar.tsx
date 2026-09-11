"use client";

/* ============================================================
   Saving a blueprint or a node card.

   ── What changed, and what did not (T262, AC4) ──
   This was a browser-local bookmark: a key in `localStorage`, one entry per
   browser, never sent anywhere. **A card save now reaches the account** through
   `POST`/`DELETE /api/account/saves`, so it survives a cleared browser, follows a
   reader to a second device, and appears in the owner's Saved tab — which is the
   disjointness `SavedList` used to apologise for.

   **A BLUEPRINT save is still browser-local, and that is a recorded gap rather
   than an oversight (D-262-04).** `save.target_id` holds a bundle **id** for a
   blueprint, this component holds a **slug**, and nothing published maps one to
   the other: `BlueprintSummary` carries no `id`, which is the same fact that
   struck T080 from two `Depends on` lines. Posting the slug anyway would be
   worse than not posting it — `app/api/account/saves/route.ts:22-27` has no 404
   on a write by design, and `lib/server/saves/visible.ts:69-80` drops a non-uuid
   `refId` from the listing rather than raising, so the save would be accepted
   with a `200` and then never appear anywhere, with no error at any layer. The
   fix is a `bundleId` on `BlueprintSummary` or a resolver route, both T080's.

   ── Save FOLDED INTO Star, on the owner's instruction (2026-09-05) ──
   This file used to draw TWO controls side by side wherever a live count was
   available: a private bookmark, and a public star pill. The owner ruled them
   one concept — "starring is the gesture, and the saved shelf reads stars" — so
   a caller that supplies `star` now gets ONE control, `StarControl` below.

   The old sentence *"the button is a private bookmark; the pill next to it is
   public community support"* is retired rather than merely deleted: the two
   stores still exist and the star is now the single gesture that moves both. A
   card star writes the counter through `star.api` AND the account save through
   `/api/account/saves`, because **the Saved tab reads `save` rows, not the star
   table** — `lib/server/counters` publishes `getSignals`/`getSignalsMany`, both
   of which answer about targets the caller names, and nothing there can answer
   "what has this account starred". Until such a reader exists the save row IS
   the shelf's index of stars, and writing it is what keeps the owner's ruling
   true on screen instead of only in the header band.

   A blueprint star moves the counter alone, which is D-262-04's gap unchanged:
   `save.target_id` holds a bundle id and this component holds a slug.

   ── The seeded count keeps its marker, and folds too ──
   `count`/`seeded` is a figure a caller has from a fixture rather than from
   `getSignals`. It used to draw the bookmark plus a read-only pill; it now draws
   the SAME single star the live branch does, switched off, still carrying `◐`
   and still saying *"seeded support count; no community backend is connected"*
   in its title. The fold is about how many controls a reader sees, and D-78
   moves a marker in one direction only: the figure has not become real on this
   path, so the marker cannot come off it (D-262-07).

   ── Why a sibling, not a nested button ──
   `ContentCard` and `NodeCardSummary` are a whole card wrapped in one `<Link>`. A
   `<button>` nested inside that anchor would be invalid HTML (interactive content
   inside interactive content) and would confuse a screen reader about what it can
   act on. Both callers instead render this as a sibling of a "stretched" link
   that covers the card (`absolute inset-0`, transparent), with this button's
   `z-index` above it: the anchor still owns every pixel a plain click lands on,
   and the bookmark, layered above it, wins only over the small area it covers.
   ============================================================ */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ActionPill } from "@/components/ui/ActionPill";
import { cx } from "@/lib/format";

// The card save (`POST`/`DELETE /api/account/saves`, body `{ kind, refId }`) has two callers
// in this file: the bookmark a tile still draws, and `StarControl`, since the fold above made
// the star the save gesture too.

const STORAGE_KEY = "darkprint:favorites";

/** The saves this account already holds, folded in on first sign-in (T140 AC5). */
const MIGRATE_PATH = "/api/account/saves/migrate";
const SAVES_PATH = "/api/account/saves";

/**
 * Every mounted bookmark's re-render trigger, notified after a write in this tab —
 * `storage` events only fire in *other* tabs, never the one that made the change.
 */
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/* ---------------------------------------------------------------
   The compound key, and the one direction of it that maps.
   --------------------------------------------------------------- */

/** What the account can hold, or `undefined` for a key with no column behind it. */
function targetFor(id: string): { kind: "card"; refId: string } | undefined {
  /* `node:<id>@<version>` → the BARE card id. B-10 aggregates per id, so two versions of
     one card share one save — which is why starring a card at v1 shows it starred on v2's
     page. That is the column's semantics rather than a rounding of them; the alternative
     would be a second bookmark for a version bump the reader did not make. */
  if (id.startsWith("node:")) {
    const ref = id.slice("node:".length);
    const at = ref.lastIndexOf("@");
    const cardId = at === -1 ? ref : ref.slice(0, at);
    return cardId === "" ? undefined : { kind: "card", refId: cardId };
  }
  return undefined;
}

/* ---------------------------------------------------------------
   The store behind every mounted star.
   --------------------------------------------------------------- */

type Snapshot = {
  /** `undefined` until the first `/api/account/saves` answers. */
  signedIn: boolean | undefined;
  /** Compound keys held in this browser. The only home a blueprint save has. */
  local: ReadonlySet<string>;
  /** Bare card ids held by the account. Empty for a signed-out reader. */
  cards: ReadonlySet<string>;
};

let snapshot: Snapshot = { signedIn: undefined, local: new Set(), cards: new Set() };

/* `useSyncExternalStore` compares snapshots by identity, so every write replaces the
   object rather than mutating a set in place. A mutated set is the same reference and no
   mounted star re-renders. */
function setSnapshot(next: Snapshot): void {
  snapshot = next;
  notify();
}

function readLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    // Private browsing, a full quota, a disabled store — the bookmark just stops
    // persisting rather than throwing over a feature nothing else depends on.
    return new Set();
  }
}

function writeLocal(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Same tolerance as the read above.
  }
}

let resolving: Promise<void> | undefined;

/**
 * Resolves who is reading, once per page, however many stars are mounted.
 *
 * One request for the whole page rather than one per star: a card grid draws thirty of
 * these and thirty identical `GET`s for one answer is the shape that makes a list feel
 * broken. The promise is memoised rather than the result, so thirty stars mounting in the
 * same tick share the one in flight.
 */
function resolveOnce(): void {
  if (resolving !== undefined) return;
  resolving = (async () => {
    const local = readLocal();
    try {
      const response = await fetch(SAVES_PATH);
      if (!response.ok) {
        /* 401 is the ordinary signed-out answer. Anything else means the account's set is
           unknown, and a reader whose bookmarks silently emptied would re-save things they
           already have — so an unknown answer falls back to what this browser holds. */
        setSnapshot({ signedIn: false, local, cards: new Set() });
        return;
      }
      const view = (await response.json()) as {
        saves: readonly { targetKind: string; refId: string }[];
      };
      const cards = new Set(
        view.saves.filter((s) => s.targetKind === "card").map((s) => s.refId),
      );

      /* First sign-in folds this browser's card bookmarks into the account (T140 AC5).
         Idempotent at the database — `save_account_target_key` refuses the second row — so
         this runs on every sign-in without a "have I done this" flag to get wrong. Only
         the targets the account does not already hold are worth a request. */
      const unmigrated = [...local]
        .map(targetFor)
        .filter((t): t is { kind: "card"; refId: string } => t !== undefined)
        .filter((t) => !cards.has(t.refId));
      if (unmigrated.length > 0) {
        try {
          const merged = await fetch(MIGRATE_PATH, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ targets: unmigrated }),
          });
          if (merged.ok) {
            const after = (await merged.json()) as {
              saves: readonly { targetKind: string; refId: string }[];
            };
            for (const save of after.saves) {
              if (save.targetKind === "card") cards.add(save.refId);
            }
          }
        } catch {
          /* The migration is a convenience and the account's own set is already correct
             without it. Failing here must not lose the local set, which is why it is not
             cleared: the next page load tries again. */
        }
      }
      setSnapshot({ signedIn: true, local, cards });
    } catch {
      setSnapshot({ signedIn: false, local, cards: new Set() });
    }
  })();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  const onStorage = () => setSnapshot({ ...snapshot, local: readLocal() });
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

/**
 * The server's snapshot, and it is a constant for the reason it always was: the third
 * argument of `useSyncExternalStore` is what keeps the server's markup and the client's
 * first paint in agreement. Neither knows who is reading at that point — the server has no
 * `localStorage` and has not been given a session here, and the client has not asked yet.
 */
const SERVER_SNAPSHOT: Snapshot = {
  signedIn: undefined,
  local: new Set(),
  cards: new Set(),
};

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Whether `id` is saved, and a toggle for it.
 *
 * A card save goes to the account when there is one and to this browser when there is not.
 * A blueprint save is always browser-local — see the file header for why, and for what
 * would have to land before that changes.
 */
function useFavorite(id: string): [boolean, () => void] {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(resolveOnce, []);

  const target = targetFor(id);
  const onAccount = state.signedIn === true && target !== undefined;
  const favorited = onAccount ? state.cards.has(target.refId) : state.local.has(id);

  const toggle = useCallback(() => {
    const current = snapshot;
    const wanted = !(current.signedIn === true && target !== undefined
      ? current.cards.has(target.refId)
      : current.local.has(id));

    if (current.signedIn === true && target !== undefined) {
      /* Optimistic, then reconciled. The button is the only feedback a reader gets and a
         round trip before it moves reads as a dropped click; a failed write puts the star
         back rather than leaving the screen disagreeing with the account. */
      const cards = new Set(current.cards);
      if (wanted) cards.add(target.refId);
      else cards.delete(target.refId);
      setSnapshot({ ...current, cards });

      void (async () => {
        try {
          const response = await fetch(SAVES_PATH, {
            method: wanted ? "POST" : "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(target),
          });
          if (!response.ok) throw new Error(String(response.status));
          const view = (await response.json()) as {
            saves: readonly { targetKind: string; refId: string }[];
          };
          setSnapshot({
            ...snapshot,
            cards: new Set(
              view.saves.filter((s) => s.targetKind === "card").map((s) => s.refId),
            ),
          });
        } catch {
          const rolled = new Set(snapshot.cards);
          if (wanted) rolled.delete(target.refId);
          else rolled.add(target.refId);
          setSnapshot({ ...snapshot, cards: rolled });
        }
      })();
      return;
    }

    const local = new Set(current.local);
    if (wanted) local.add(id);
    else local.delete(id);
    writeLocal(local);
    setSnapshot({ ...current, local });
  }, [id, target]);

  return [favorited, toggle];
}

/**
 * The star, and the bookmark that folded into it.
 *
 * `id` is a compound key (`"blueprint:<slug>"`, `"node:<id>@<version>"`) so the two kinds
 * can never collide in the one `localStorage` bucket they share, and so `targetFor` can
 * tell which of them the account is able to hold.
 *
 * Three renderings, and they are not three concepts:
 *   - with `star`, ONE control over a live counter (`StarControl`), which is the header's
 *     and the card page's Star;
 *   - with `count`, the same pill switched off over a figure that is not live, marker and
 *     all (`SeededStar`);
 *   - with neither, the plain bookmark a shelf tile draws in its corner. A tile has no
 *     owner handle and no signals read behind it, so it cannot address `POST /api/…/star`,
 *     and leaving it as the save is what keeps a card reachable from the Saved tab while
 *     the shelf still reads `save` rows.
 */
export function FavoriteStar({
  id,
  className,
  count,
  seeded = false,
  star,
}: {
  id: string;
  className?: string;
  /** A star figure the caller already holds. Read-only: it has no toggle behind it. */
  count?: number;
  /** Marks a `count` that is illustrative rather than read from a live service. */
  seeded?: boolean;
  /**
   * The live counter this control toggles. Present on a surface that has read `getSignals`
   * for the target; absent on a tile, which has not.
   */
  star?: {
    /** `POST /api/blueprints/{owner}/{slug}/star` or `POST /api/cards/{id}/star`. Toggles. */
    api: string;
    count: number;
    starred: boolean;
    signedIn: boolean;
  };
}) {
  if (star !== undefined) return <StarControl id={id} star={star} className={className} />;
  if (count !== undefined) return <SeededStar count={count} seeded={seeded} className={className} />;
  return <Bookmark id={id} className={className} />;
}

/**
 * A star figure a caller holds from a fixture: the same pill, switched off, with the marker
 * over the number saying so.
 *
 * Disabled rather than absent for `StarControl`'s reason and one more: a reader who cannot
 * see the control cannot see the marker either, and the marker is the whole point of this
 * branch.
 */
function SeededStar({
  count,
  seeded,
  className,
}: {
  count: number;
  seeded: boolean;
  className?: string;
}) {
  return (
    <ActionPill
      glyph="star"
      label="Star"
      count={count}
      disabled
      ariaLabel={`${count} community stars${seeded ? ", seeded" : ""}`}
      title={
        seeded
          ? "Seeded support count; no community backend is connected"
          : "Nothing stores a star for this yet"
      }
      marker={
        seeded ? (
          <span className="text-amber" aria-hidden>
            ◐
          </span>
        ) : undefined
      }
      className={className}
    />
  );
}

/** The tile's corner bookmark: the save, unchanged, on the surfaces that have only it. */
function Bookmark({ id, className }: { id: string; className?: string }) {
  const [favorited, toggle] = useFavorite(id);
  const label = favorited ? "Remove from favorites" : "Add to favorites";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex items-center justify-center rounded-full border border-line bg-surface-2/90 p-1.5 backdrop-blur-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:active:scale-[0.94]",
        favorited ? "text-amber" : "text-dim hoverable:hover:text-fg",
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={16}
        height={16}
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      >
        <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75V21L12 17.65 6.75 21V4.75z" />
      </svg>
    </button>
  );
}

/**
 * Star, over `lib/server/counters` — and, for a card, over the account's saves in the same
 * click.
 *
 * ── Why one click writes two stores ──
 * The owner folded Save into Star, and the Saved tab reads `save` rows: `listSaves` is a
 * per-account query and `lib/server/counters` has no per-account reader at all, only
 * `getSignals`/`getSignalsMany` over targets the caller already names. So a star that wrote
 * the counter alone would empty the shelf for every reader, and a shelf that read stars is
 * a server module this pass may not write. The save write is therefore the star's index,
 * not a second gesture: it is issued only when `targetFor` resolves (a card), and only when
 * the account's bookmark disagrees with where the star is going.
 *
 * A star that predates the fold has no save row behind it, so the first toggle is what puts
 * one there. That self-corrects on use rather than needing a backfill, which is the reason
 * the sync compares the two states instead of assuming them equal.
 *
 * ── Signed out ──
 * Disabled with a `title`, the same idiom the header's own drawn-and-disabled Watch and
 * Fork use. A signed-out reader can no longer keep anything, which is the accepted cost of
 * the fold, and a control that silently did nothing on click would hide it. Nothing is
 * hidden either: the count is real and readable without an account.
 */
function StarControl({
  id,
  star,
  className,
}: {
  id: string;
  star: NonNullable<FavoriteStarProps["star"]>;
  className?: string;
}) {
  const [favorited, toggleSave] = useFavorite(id);
  const [state, setState] = useState({ count: star.count, starred: star.starred });
  const [pending, setPending] = useState(false);
  const target = targetFor(id);

  const toggle = useCallback(() => {
    if (!star.signedIn || pending) return;
    const wanted = !state.starred;
    const rollback = state;

    /* The shelf half, before the request: `useFavorite` is optimistic and reconciled on its
       own, so it needs no rollback here — a failed save leaves the star where the counter
       says it is and the bookmark where the account says it is, which is the honest
       outcome for two writes that can fail apart. */
    if (target !== undefined && favorited !== wanted) toggleSave();

    setState({ starred: wanted, count: state.count + (wanted ? 1 : -1) });
    setPending(true);
    void (async () => {
      try {
        const response = await fetch(star.api, { method: "POST" });
        if (!response.ok) throw new Error(String(response.status));
        const json = (await response.json()) as {
          signals: { starCount: number; starredByCaller: boolean };
        };
        setState({ count: json.signals.starCount, starred: json.signals.starredByCaller });
      } catch {
        setState(rollback);
      } finally {
        setPending(false);
      }
    })();
  }, [star.api, star.signedIn, pending, state, target, favorited, toggleSave]);

  const label = star.signedIn
    ? state.starred
      ? "Remove your star"
      : "Star this"
    : "Sign in to star this";

  return (
    <ActionPill
      glyph="star"
      label={state.starred ? "Starred" : "Star"}
      count={state.count}
      active={state.starred}
      pressed={state.starred}
      onClick={toggle}
      disabled={!star.signedIn}
      ariaLabel={`${label}. ${state.count} stars.`}
      title={
        star.signedIn
          ? undefined
          : "Sign in to star this. A star is also what keeps it on your saved list."
      }
      className={className}
    />
  );
}

/** Named so `StarControl`'s prop type can be pulled off the exported component's own props. */
type FavoriteStarProps = Parameters<typeof FavoriteStar>[0];
