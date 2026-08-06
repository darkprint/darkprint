"use client";

import { useEffect, useRef } from "react";

/* ============================================================
   Two dropdowns in one header row, one open at a time.

   `/blueprints/[slug]` and `/nodes/[...id]` both end their header row with a group of
   actions, and that group now holds two things that open a floating panel: `ForkAction`
   and `CloneMenu`. Both panels are `-translate-x-1/2`-centred under their own trigger and
   both are wider than the gap between the triggers, so with both open the second lands on
   top of the first and the reader is looking at two overlapping boxes.

   The two cannot simply share state: they are separate components, mounted by the page
   independently, and one of them is a native `<details>` (the disclosure primitive the
   rest of the site uses) whose open state lives on the DOM element rather than in React.
   HTML's own exclusive-accordion `name=""` attribute would solve it if both were
   `<details>`, and `ForkAction` is not — its panel has to sit inside a `relative` wrapper
   that a `<summary>` built to look like a button would complicate, and that shape is
   locked by its own spec.

   So the coordination is one event on `document`, carrying the id of whatever just
   opened. Everything that can open a panel announces itself and closes on hearing anybody
   else. It is a handful of lines, it needs no context provider around the page, and a
   third menu joins by calling the same two functions.

   This is presentation only. Nothing here decides what a panel *says*: both panels render
   their content into the prerendered HTML regardless, which is what keeps the "not built
   yet" sentences inside them real SSR text.
   ============================================================ */

const MENU_OPENED = "darkprint:menu-opened";

/** Say that the menu identified by `id` has just opened. Everything else should close. */
export function announceMenuOpened(id: string): void {
  document.dispatchEvent(new CustomEvent<string>(MENU_OPENED, { detail: id }));
}

/**
 * Close this menu when a different one opens.
 *
 * `close` is held in a ref rather than listed as a dependency: a caller passing an inline
 * arrow would otherwise tear down and re-add the listener on every render of the page.
 * The ref is written in its own effect and not during render — a ref is not render state
 * and writing one while rendering is what `react-hooks/refs` exists to catch — which is
 * enough here because the listener only ever reads it from an event, long after commit.
 */
export function useCloseWhenAnotherMenuOpens(id: string, close: () => void): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    function onOpened(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) latest.current();
    }
    document.addEventListener(MENU_OPENED, onOpened);
    return () => document.removeEventListener(MENU_OPENED, onOpened);
  }, [id]);
}
