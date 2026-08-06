"use client";

/* ============================================================
   Favoriting a blueprint or node — browser-local, nothing else.

   There is no account on this site and nothing here changes that: a
   favorite is a key in `localStorage`, one entry per browser, never sent
   anywhere. It does not survive a cleared browser, does not follow a
   reader to a second device, and nothing on the site reads or counts it
   but this component. That is the honest shape of "favorite" a site with
   no backend can offer (doc 2 §0.4), so the star says nothing stronger.

   ── Why a sibling, not a nested button ──
   `ContentCard` and `NodeCardSummary` are a whole card wrapped in one
   `<Link>`. A `<button>` nested inside that anchor would be invalid HTML
   (interactive content inside interactive content) and would confuse a
   screen reader about what it can act on. Both callers instead render
   this as a sibling of a "stretched" link that covers the card
   (`absolute inset-0`, transparent), with this button's `z-index` above
   it: the anchor still owns every pixel a plain click lands on, and the
   star, layered above it, wins only over the small area it covers.
   ============================================================ */

import { useCallback, useSyncExternalStore } from "react";
import { cx } from "@/lib/format";

const STORAGE_KEY = "darkprint:favorites";

/**
 * Every mounted star's re-render trigger, notified after a write in this tab —
 * `storage` events only fire in *other* tabs, never the one that made the change.
 */
const listeners = new Set<() => void>();

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    // Private browsing, a full quota, a disabled store — the star just stops
    // persisting rather than throwing over a feature nothing else depends on.
    return new Set();
  }
}

function writeFavorites(favorites: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
  } catch {
    // Same tolerance as the read above.
  }
  for (const notify of listeners) notify();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

const SERVER_SNAPSHOT = false;

/**
 * Whether `id` is favorited, and a toggle for it.
 *
 * `useSyncExternalStore` rather than an effect that calls `setState`: `localStorage` is
 * exactly the external, mutable-outside-React store the hook exists for, and its third
 * argument is what keeps the server's markup and the client's first paint in agreement
 * — both read the fixed `false` below, never `localStorage`, which the server has none
 * of and the client hasn't consulted yet at that point.
 */
function useFavorite(id: string): [boolean, () => void] {
  const favorited = useSyncExternalStore(
    subscribe,
    () => readFavorites().has(id),
    () => SERVER_SNAPSHOT,
  );

  const toggle = useCallback(() => {
    const current = readFavorites();
    if (current.has(id)) current.delete(id);
    else current.add(id);
    writeFavorites(current);
  }, [id]);

  return [favorited, toggle];
}

/**
 * The star. `id` is a compound key (`"blueprint:<slug>"`, `"node:<id>@<version>"`) so
 * the two kinds can never collide in the one `localStorage` bucket they share.
 */
export function FavoriteStar({ id, className }: { id: string; className?: string }) {
  const [favorited, toggle] = useFavorite(id);
  const label = favorited ? "Remove from favorites" : "Add to favorites";

  return (
    <button
      type="button"
      onClick={(event) => {
        // Both callers render this beside a stretched link over the whole card;
        // without these two the click would also navigate.
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cx(
        // 30px across (16px glyph + 6px padding + 1px border, both sides), so it takes the
        // deepest of the site's three press bands: ≤40px → 0.94, 40–200px → 0.97,
        // >200px → 0.99. The property list is written out rather than left as
        // `transition-colors` because a bare colour list cannot animate the press, and
        // `transition-all` would put a 40px-blur backdrop filter on the same clock.
        //
        // `scale` is named in that list on purpose. Tailwind v4 compiles `scale-[0.94]` to
        // the standalone `scale:` property, not to `transform: scale(…)`, and CSS treats
        // the two as different animatable properties — a list carrying only `transform`
        // leaves the press snapping in and out with no duration at all.
        //
        // `hoverable:` is `@media (hover: hover) and (pointer: fine)` (app/globals.css).
        // Without it a tap on a phone latches the hover border until the next tap
        // somewhere else — on a card grid, that reads as a star that stayed selected.
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
        <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
      </svg>
    </button>
  );
}
