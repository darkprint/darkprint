"use client";

import { useCallback, useSyncExternalStore } from "react";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-112) (cited at line 87): n/a — becomes real query parameters against SEAM-02 / SEAM-08 / SEAM-15

/* ============================================================
   DarkPrint — filter state that lives in the address bar

   Both registry browsers had the same defect and the site had two
   half-answers to it.

   `NodeBrowser` kept eight filters in `useState` and nowhere else:
   narrow to `1 of 53`, open a card, press Back, and the grid
   returned `53 of 53` with an empty query and scroll at 0. Filter →
   open → back → open the next is the only loop either page exists
   for, and it reset every time.

   `GalleryBrowser` was worse in an interesting way. It *read*
   `?tag=` on mount through a `useSearchParams` leaf and never wrote
   anything back, so `Clear filters` left the address bar reading
   `?tag=RAG` over a grid showing all nine, and a reload resurrected
   a filter the reader had deleted. A page that reads a deep link
   but cannot produce one is worse than one that does neither,
   because the read path implies the write path exists.

   ── Why not `useSearchParams` ──
   It is the framework's answer and it was tried first. The Next
   docs require a `Suspense` boundary around it or the production
   build fails, which is easy to read as the whole story; the next
   sentence is the real cost, that the client tree up to that
   boundary becomes client-rendered. Measured against `next start`,
   putting it at the top of `NodeBrowser` shipped `/nodes` as 56KB
   containing **zero `<article>` elements** — every card gone from
   the prerendered HTML of a static archive whose claim is that it
   can be read rather than trusted.

   `GalleryBrowser` had already found the containment trick: put the
   hook in a leaf behind its own boundary so only the leaf bails
   out. That works, and it is why `/blueprints` stayed static. But it
   only ever reads, and the shared answer here does both without
   needing a boundary at all.

   ── What this is instead ──
   The URL is being used as *storage*, not as routing input, so the
   browser's own history API is the right size of tool.
   `useSyncExternalStore` is the primitive built for reading an
   external mutable source: its server snapshot is the empty query,
   so both pages prerender their whole unfiltered shelf, and React
   re-renders once after hydration when a link carries filters. That
   re-render is documented behaviour, not a hydration error — which
   a lazy `useState` initialiser reading `window.location` would be.

   It also satisfies `react-hooks/set-state-in-effect`, whose own
   message points at exactly this shape: "subscribe for updates from
   some external system, calling setState in a callback".
   ============================================================ */

/**
 * Subscribers to the query string.
 *
 * `history.replaceState` fires no event, so whoever writes the URL has to say so;
 * `popstate` covers only the buttons the browser announces itself.
 */
let listeners: Array<() => void> = [];

function subscribe(onChange: () => void): () => void {
  listeners = [...listeners, onChange];
  window.addEventListener("popstate", onChange);
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const read = (): string => window.location.search;

/** The server has no address bar; the unfiltered shelf is what it can honestly render. */
const readOnServer = (): string => "";

/**
 * Replace the query string and tell React.
 *
 * `replaceState`, not `pushState`: typing four characters into a search box should not
 * cost four presses of Back to undo, and the address bar is being used as state rather
 * than as history. Because it replaces, the entry a reader leaves behind when they open
 * a card already carries their filters, so Back from that card restores them for free.
 */
export function writeQuery(params: URLSearchParams): void {
  const query = params.toString();
  const url = query === "" ? window.location.pathname : `${window.location.pathname}?${query}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(null, "", url);
  for (const listener of listeners) listener();
}

/**
 * The live query string, and the two writers a filter panel needs.
 *
 * `set` changes one key and leaves the rest alone; `clear` drops a named set in one
 * write, which is what a "clear filters" control wants — one history entry, not six.
 * Both read `window.location.search` at call time rather than closing over the render's
 * snapshot, so two changes in the same tick cannot clobber each other.
 */
export function useQueryState(): {
  params: URLSearchParams;
  set: (key: string, value: string | null) => void;
  clear: (keys: readonly string[]) => void;
} {
  const query = useSyncExternalStore(subscribe, read, readOnServer);

  const set = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    writeQuery(next);
  }, []);

  const clear = useCallback((keys: readonly string[]) => {
    const next = new URLSearchParams(window.location.search);
    for (const key of keys) next.delete(key);
    writeQuery(next);
  }, []);

  return { params: new URLSearchParams(query), set, clear };
}
