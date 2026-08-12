"use client";

/* ============================================================
   Saving a blueprint or node — browser-local, separate from stars.

   There is no account on this site and nothing here changes that: a
   favorite is a key in `localStorage`, one entry per browser, never sent
   anywhere. It does not survive a cleared browser, does not follow a
   reader to a second device, and nothing on the site reads or counts it
   but this component. That is the honest shape of "favorite" a site with
   no backend can offer (doc 2 §0.4), so the bookmark says nothing stronger.

   ── Why a sibling, not a nested button ──
   `ContentCard` and `NodeCardSummary` are a whole card wrapped in one
   `<Link>`. A `<button>` nested inside that anchor would be invalid HTML
   (interactive content inside interactive content) and would confuse a
   screen reader about what it can act on. Both callers instead render
   this as a sibling of a "stretched" link that covers the card
   (`absolute inset-0`, transparent), with this button's `z-index` above
   it: the anchor still owns every pixel a plain click lands on, and the
   bookmark, layered above it, wins only over the small area it covers.
   ============================================================ */

import { useCallback, useSyncExternalStore } from "react";
import { compact, cx } from "@/lib/format";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-62) (cited at line 97): POST /api/account/saves, DELETE /api/account/saves/{key}

const STORAGE_KEY = "darkprint:favorites";

/**
 * Every mounted bookmark's re-render trigger, notified after a write in this tab —
 * `storage` events only fire in *other* tabs, never the one that made the change.
 */
const listeners = new Set<() => void>();

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    // Private browsing, a full quota, a disabled store — the bookmark just stops
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
 * The bookmark. `id` is a compound key (`"blueprint:<slug>"`, `"node:<id>@<version>"`) so
 * the two kinds can never collide in the one `localStorage` bucket they share.
 */
export function FavoriteStar({
  id,
  className,
  count,
  seeded = false,
}: {
  id: string;
  className?: string;
  /** Fixture-backed community support shown beside the local save control. */
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
