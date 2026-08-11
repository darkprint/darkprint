"use client";

import { useEffect } from "react";

/* ============================================================
   Which section a reader is actually in, on every rail on the site.

   The rails carried `:target` marks: `body:has(#fields:target) &`, which lights the row a
   reader CLICKED and nothing else. It is honest as far as it goes — `:target` is exactly
   "the fragment you asked for" — but it answers a different question from the one a rail
   exists to answer, which is *where am I now*. Scroll away from the section you clicked and
   the mark stays behind on it; arrive by scrolling rather than by clicking and nothing
   lights at all.

   So this replaces them. The marks are gone from the three pages that set them, because two
   mechanisms lighting two different rows at once is worse than either alone.

   ── Why scroll position and not `IntersectionObserver` ──
   An observer answers "is this element in the viewport", and on a page whose sections are
   two screens tall the answer is often "three of them are". Picking one then needs a
   tie-break that is really just the rule below written less directly: **the active section
   is the last one whose top has passed under the header.** One `scroll` listener, one pass
   over a fixed list of offsets, no thresholds to tune, and it behaves the same whether a
   section is 40px or 4000px tall.

   ── What it costs when it does not run ──
   Nothing. The rail is a list of working links either way; this only adds a highlight. It
   is the whole reason the rail was built without a spy in the first place, and the reason
   adding one is safe: a reader with no JavaScript loses a cue, not a route.
   ============================================================ */

/** The id the rail's `<nav>` carries, so this can find it without a ref through a server
    component. One rail per page — every surface that mounts `SideRail` mounts exactly one. */
export const RAIL_NAV_ID = "side-rail-nav";

/** What the rows style off. `data-[rail-active=true]:…` in `SideRail`. */
const ACTIVE = "rail-active";

/**
 * How far under the viewport top a section counts as "reached".
 *
 * The header is `sticky top-0` over a 4rem row and every anchor on the site carries
 * `scroll-mt-24` (6rem) so a fragment does not land underneath it. 96px is that same
 * offset: a section is current from the moment its heading clears the header, which is the
 * moment a reader can see it.
 */
const THRESHOLD = 96;

/**
 * How close to the end of the scroll counts as the end of it.
 *
 * Sub-pixel layout and browser zoom leave `scrollY + innerHeight` a fraction under
 * `scrollHeight` at the true bottom, so an exact comparison is a rule that never fires at
 * some zoom levels and fires at others.
 */
const BOTTOM_SLACK = 2;

/** Where the reader is, in the terms the rule below needs. All in CSS pixels. */
export interface RailPosition {
  /** `RailScrollSpy`'s own `THRESHOLD`: how far under the viewport top a section is reached. */
  threshold: number;
  /** Viewport height, for deciding whether a section is on screen at all. */
  viewport: number;
  /** Whether the scroll has run out, within `BOTTOM_SLACK`. */
  atBottom: boolean;
}

/**
 * Which rail row to light, from each section's distance above or below the viewport top.
 *
 * A pure function, and pulled out of the effect for the reason `components/viz/useReveal.ts`
 * pulls `revealPhase` out of its hook: this repository has no jsdom and no testing-library,
 * so a decision left inside an effect is a decision nothing can assert on. The arithmetic is
 * the part that was wrong, so the arithmetic is the part that gets a test.
 *
 * ── The rule, and the case it used to miss ──
 * Normally the answer is the last section whose top has passed under the header, or the
 * first when the reader is still above all of them, because a rail that lights nothing at
 * the top of a page reads as broken rather than accurate.
 *
 * That rule cannot reach the last section on a page whose final section is shorter than the
 * viewport. Measured on `/ontology` at 1456x1160 before this fix: at maximum scroll
 * (`scrollY` 5266 of 5266) `#governance` sits 307px below the viewport top and needs to
 * reach 96, so it wants 211px of scroll the document does not have. The whole section and
 * the footer under it are on screen, the reader is plainly in it, and the rail lit
 * `05 Tool capabilities` — whose content had left the screen entirely.
 *
 * Generalised: any section beginning within `viewport - threshold` of the document bottom is
 * unreachable, which is most last sections and no others. So when the scroll has run out,
 * the answer is the last section that is on screen at all, and `atBottom` is the only new
 * input that needs. It never picks EARLIER than the normal rule — a page whose last section
 * has genuinely scrolled off the top behind a tall footer keeps the ordinary answer.
 */
export function activeRailIndex(
  tops: readonly number[],
  { threshold, viewport, atBottom }: RailPosition,
): number | null {
  if (tops.length === 0) return null;

  let passed = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i] - threshold <= 0) passed = i;
  }
  if (!atBottom) return passed;

  let onScreen = -1;
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i] < viewport) onScreen = i;
  }
  return onScreen > passed ? onScreen : passed;
}

export function RailScrollSpy() {
  useEffect(() => {
    const nav = document.getElementById(RAIL_NAV_ID);
    if (nav === null) return;

    /* Every row that points at a fragment, paired with the element it points at. Rows that
       point at another route are skipped: the rail already marks the current page through
       `active`, and a route is not a position on this one. `/spec/card#reach` counts —
       Learn's indented section links carry the path as well as the fragment.

       ── Resolved every pass, not once at mount ──
       It was resolved once, with an early return when nothing matched, and that is a race
       on any page whose sections can come and go. `/ontology` is the first: its catalog is
       the browser's unfiltered view, so arriving at `?kind=risk-marker` server-renders the
       catalog (a static page has no search params at SSR), hydrates, and only then removes
       it. Two client components hydrate in an order nobody promises. Lose the race and the
       rail lights a row whose section is no longer in the document; win it the other way
       round and the rail tracks nothing on a page that has sections after all.

       Re-reading is six `getElementById` calls against a live map, on a frame that is
       already doing layout work for the scroll. The bail is gone with it: an empty pass is
       a real answer now, and it clears the mark rather than freezing it. This codebase's
       own rule, from the blueprint page's rail: a rail that claims a position it is not
       tracking is worse than a rail that claims none. */
    const resolve = (): { link: HTMLElement; el: HTMLElement }[] => {
      const found: { link: HTMLElement; el: HTMLElement }[] = [];
      for (const link of nav.querySelectorAll<HTMLAnchorElement>("a[href*='#']")) {
        const id = link.getAttribute("href")?.split("#")[1];
        if (id === undefined || id === "") continue;
        const el = document.getElementById(id);
        if (el !== null) found.push({ link, el });
      }
      return found;
    };

    let current: HTMLElement | null = null;
    let queued = false;

    const mark = (link: HTMLElement | null) => {
      if (link === current) return;
      current?.removeAttribute(`data-${ACTIVE}`);
      link?.setAttribute(`data-${ACTIVE}`, "true");
      current = link;
    };

    const apply = () => {
      queued = false;
      const targets = resolve();
      /* The rule is `activeRailIndex`, which is where its reasoning lives and the only part
         of this component a test can reach. Everything here is measurement: one pass for the
         tops, and whether the scroll has run out. */
      const index = activeRailIndex(
        targets.map((target) => target.el.getBoundingClientRect().top),
        {
          threshold: THRESHOLD,
          viewport: window.innerHeight,
          atBottom:
            window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - BOTTOM_SLACK,
        },
      );
      mark(index === null ? null : targets[index].link);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    };

    apply();
    /* One more pass on the next frame, which is the other half of the fix above. Nothing
       scrolls or resizes when a sibling component finishes hydrating and rewrites the page
       under this one, so without a second look the first answer is the only answer. */
    const settle = requestAnimationFrame(apply);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mark(null);
    };
  }, []);

  return null;
}
