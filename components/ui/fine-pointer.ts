import { useSyncExternalStore } from "react";

/** A mouse or a trackpad rather than a finger: the same query `hoverable` in `app/globals.css` names. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(FINE_POINTER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the reader's pointer is fine. The server snapshot is `true`, so the prerendered
 * markup is the desktop one and a touch screen switches after hydration.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(FINE_POINTER_QUERY).matches,
    () => true,
  );
}
