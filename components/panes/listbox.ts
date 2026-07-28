"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";

/* ============================================================
   One tab stop per pane, arrow keys inside it.
   ------------------------------------------------------------
   Doc 2 §11 item 11 asks for four panes that are keyboard
   operable and screen-reader coherent, and the obvious way to get
   there fails on the first count: a button per DOT line puts
   thirty tab stops between the drawing and the card, and a reader
   who wants pane 4 has to walk the whole of pane 3 to reach it.

   So each pane is a single-select listbox with a roving tabindex,
   the pattern the ARIA authoring practices define for exactly
   this. One tab stop, arrow keys to move inside it, Home and End
   for the ends, and selection follows focus — which is the right
   behaviour here rather than a stylistic choice: arrowing down
   the DOT re-lights the other three panes line by line, and that
   is the lesson the view exists to teach.

   Rows that name nothing (a comment, a brace, a blank line) are
   skipped rather than landed on and dropped out of, so the arrow
   keys walk the statements of the file.

   **This hook holds no state.** The tab stop is the selected row,
   and the selected row is a fact about the shared selection —
   which is why `PaneSelection` carries the DOT line and the card
   line the reader is on, and not only the node and the field they
   resolve to. Several lines can resolve to one node, and a
   listbox whose tab stop were derived from the node alone would
   spring back up the file every time the arrow key landed on
   another line of the same statement.
   ============================================================ */

export interface RovingListbox {
  /** `tabIndex` for the option at `index`. Exactly one option in the list gets 0. */
  tabIndexFor: (index: number) => 0 | -1;
  /** Ref callback for the option at `index`, so the hook can move focus to it. */
  setRef: (index: number) => (element: HTMLElement | null) => void;
  /** Put on the listbox container. Arrow keys, Home, End, Enter and Space. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Call from an option's `onClick`, so a pointer and a key leave the list in one state. */
  onClickIndex: (index: number) => void;
}

export function useRovingListbox({
  selectable,
  activeIndex,
  onActivate,
}: {
  /** Per option: may it hold focus and be chosen. Same length and order as the rendered list. */
  selectable: readonly boolean[];
  /** The option the current selection is on, or -1 when the selection is not in this list. */
  activeIndex: number;
  onActivate: (index: number) => void;
}): RovingListbox {
  const refs = useRef<(HTMLElement | null)[]>([]);

  const setRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      refs.current[index] = element;
    },
    [],
  );

  const move = useCallback(
    (index: number) => {
      onActivate(index);
      // The element is already mounted, so this lands before the re-render that will
      // hand it the tab stop. Focus and selection therefore never disagree.
      refs.current[index]?.focus();
    },
    [onActivate],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = (direction: 1 | -1): number => {
        for (
          let i = activeIndex + direction;
          i >= 0 && i < selectable.length;
          i += direction
        ) {
          if (selectable[i]) return i;
        }
        return -1;
      };
      const edge = (direction: 1 | -1): number => {
        const start = direction === 1 ? 0 : selectable.length - 1;
        for (let i = start; i >= 0 && i < selectable.length; i += direction) {
          if (selectable[i]) return i;
        }
        return -1;
      };

      let next = -1;
      switch (event.key) {
        case "ArrowDown":
          next = step(1);
          break;
        case "ArrowUp":
          next = step(-1);
          break;
        case "Home":
          next = edge(1);
          break;
        case "End":
          next = edge(-1);
          break;
        case "Enter":
        case " ":
          next = activeIndex >= 0 && selectable[activeIndex] === true ? activeIndex : edge(1);
          break;
        default:
          return;
      }

      // Claimed either way. A held ArrowDown at the end of the list must not start
      // scrolling the page out from under the list the reader is still inside, and Space
      // on an option must not page down.
      event.preventDefault();
      if (next >= 0) move(next);
    },
    [activeIndex, move, selectable],
  );

  const tabIndexFor = useCallback(
    (index: number): 0 | -1 => {
      if (activeIndex >= 0) return index === activeIndex ? 0 : -1;
      // The selection is not in this list, or nothing in it is selectable at all. The
      // first row still takes the tab stop, so the list can be reached and scrolled.
      return index === 0 ? 0 : -1;
    },
    [activeIndex],
  );

  return { tabIndexFor, setRef, onKeyDown, onClickIndex: move };
}
