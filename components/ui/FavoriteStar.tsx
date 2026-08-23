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

   ── The star COUNT beside the button is a different thing and is still seeded ──
   The button is a private bookmark; the pill next to it is public community
   support. `toggleStar`/`getSignals` exist in `lib/server/counters`, but
   **`app/api/signals/**` does not** — D-WAVE-02 dropped `app/api/**` from T150's
   wave — and a client component cannot import that module, which reaches `pg`
   through `@/lib/db`. So the count has not become real, the `◐` marker over it
   stays, and D-78 moves a marker in one direction only (D-262-07).

   ── Why a sibling, not a nested button ──
   `ContentCard` and `NodeCardSummary` are a whole card wrapped in one `<Link>`. A
   `<button>` nested inside that anchor would be invalid HTML (interactive content
   inside interactive content) and would confuse a screen reader about what it can
   act on. Both callers instead render this as a sibling of a "stretched" link
   that covers the card (`absolute inset-0`, transparent), with this button's
   `z-index` above it: the anchor still owns every pixel a plain click lands on,
   and the bookmark, layered above it, wins only over the small area it covers.
   ============================================================ */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { compact, cx } from "@/lib/format";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-62 is LIVE for cards: POST /api/account/saves, DELETE /api/account/saves, body
// { kind, refId } (D-140-07). Its note that "mapping STORAGE_KEY onto the enum is T262's"
// is corrected by D-262-04: the card half is mapped here, and the blueprint half assigns a
// translation with nowhere to put it. SEAM-61 stays PLANNED for blueprints.

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
 * The bookmark. `id` is a compound key (`"blueprint:<slug>"`, `"node:<id>@<version>"`) so
 * the two kinds can never collide in the one `localStorage` bucket they share, and so
 * `targetFor` can tell which of them the account is able to hold.
 */
export function FavoriteStar({
  id,
  className,
  count,
  seeded = false,
}: {
  id: string;
  className?: string;
  /** Community support shown beside the save control. Still seeded — see the header. */
  count?: number;
  /** Marks a count that is illustrative rather than read from a live service. */
  seeded?: boolean;
}) {
  const [favorited, toggle] = useFavorite(id);
  const label = favorited ? "Remove from favorites" : "Add to favorites";

  const button = (
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
        "inline-flex items-center justify-center border border-line bg-surface-2/90 p-1.5 backdrop-blur-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:active:scale-[0.94]",
        count === undefined ? "rounded-full" : "gap-1.5 rounded-md px-2.5 py-1.5",
        favorited ? "text-amber" : "text-dim hoverable:hover:text-fg",
        count === undefined && className,
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
      {count !== undefined && (
        <span className="text-xs font-medium">{favorited ? "Saved" : "Save"}</span>
      )}
    </button>
  );

  if (count !== undefined) {
    return (
      <div
        className={cx("inline-flex items-stretch gap-2", className)}
        title={seeded ? "Seeded support count; no community backend is connected" : undefined}
      >
        {button}
        <span
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 font-mono text-[11px] text-muted"
          aria-label={`${count} community stars${seeded ? ", seeded" : ""}`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinejoin="round"
          >
            <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
          </svg>
          {compact(count)}
          {seeded && (
            <span className="text-amber" aria-hidden>
              ◐
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    button
  );
}
