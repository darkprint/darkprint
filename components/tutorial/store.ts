/* ============================================================
   Where the tutorial's typed values live
   ------------------------------------------------------------
   A module-level snapshot behind `useSyncExternalStore`, which is
   the shape `components/ui/FavoriteStar.tsx` already uses for the
   same problem: state that only exists in the browser, on a page
   that is server-rendered first.

   ── why not `useState` plus an effect ──
   The obvious form is an empty initial state and a `useEffect` that
   reads `localStorage` and sets it. That is a synchronous `setState`
   inside an effect, which this repository's lint rules refuse by
   name, and the refusal is right: it renders the page once with
   nothing in it, then again with everything, and every field the
   reader can see flickers through empty on a reload. `getSnapshot`
   reads the store on its first call instead, so the first render
   after hydration already carries what was typed.

   `getServerSnapshot` is a frozen empty state and must stay one.
   React renders the server snapshot during hydration and swaps to
   the client's afterwards, and returning anything that touched
   `window` from here would throw in the render that has no window.

   ── one key, one object ──
   Forty-four keys would be forty-four things a reader can clear by
   hand and leave the page in a state no code path produces. The
   store is written whole on every change.
   ============================================================ */

import type { BlankValues } from "./blanks";

export interface TutorialState {
  readonly values: BlankValues;
  /** 1 to 7. Restored from the address, so a reload and a shared link agree. */
  readonly step: number;
}

const STORAGE_KEY = "darkprint:tutorial";
const STEPS = 7;

/** What the server renders, and what a browser with an empty store renders too. */
const EMPTY: TutorialState = Object.freeze({ values: Object.freeze({}), step: 1 });

let snapshot: TutorialState = EMPTY;
let read = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * The step named in the address, or 1.
 *
 * Read here rather than in a `hashchange` handler alone, because a reader arriving on
 * `/tutorial#step-5` from somewhere else has no hash change to react to.
 */
function stepFromHash(): number {
  const at = Number(window.location.hash.replace("#step-", ""));
  return Number.isInteger(at) && at >= 1 && at <= STEPS ? at : 1;
}

function readLocal(): TutorialState {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    const values =
      stored !== null && typeof stored === "object" && !Array.isArray(stored)
        ? (stored as BlankValues)
        : {};
    return { values, step: stepFromHash() };
  } catch {
    /* Private browsing, a full quota, or something else holding this key. The page works
       without a store and the reader's answer is to type again, so there is nothing here
       worth interrupting them about. */
    return { values: {}, step: stepFromHash() };
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The current state, read from the browser the first time it is asked for.
 *
 * The identity is stable between changes, which is what `useSyncExternalStore` compares:
 * building a fresh object here would re-render every mounted field on every tick.
 */
export function getSnapshot(): TutorialState {
  if (!read) {
    snapshot = readLocal();
    read = true;
  }
  return snapshot;
}

/** Frozen, and never reads `window`. See the header. */
export function getServerSnapshot(): TutorialState {
  return EMPTY;
}

/** Replace the typed values, and persist them. */
export function writeValues(values: BlankValues): void {
  snapshot = { values, step: snapshot.step };
  read = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    /* Same tolerance as the read. */
  }
  notify();
}

/**
 * Move to a step, and put it in the address.
 *
 * `replaceState` rather than assigning the hash: assigning pushes a history entry per
 * step, which turns Back into a walk through the seven rather than a way off the page.
 */
export function goToStep(step: number): void {
  const next = Math.min(STEPS, Math.max(1, step));
  snapshot = { values: snapshot.values, step: next };
  read = true;
  window.history.replaceState(null, "", `#step-${next}`);
  notify();
}

/** The address changed under us, from a link on the page or from the reader's own edit. */
export function syncStepFromHash(): void {
  const next = stepFromHash();
  if (next === snapshot.step) return;
  snapshot = { values: snapshot.values, step: next };
  read = true;
  notify();
}
