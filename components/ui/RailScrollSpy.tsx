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

export function RailScrollSpy() {
  useEffect(() => {
    const nav = document.getElementById(RAIL_NAV_ID);
    if (nav === null) return;

    /* Every row that points at a fragment, paired with the element it points at. Rows that
       point at another route are skipped: the rail already marks the current page through
       `active`, and a route is not a position on this one. `/spec/card#reach` counts —
       Learn's indented section links carry the path as well as the fragment. */
    const targets: { link: HTMLElement; el: HTMLElement }[] = [];
    for (const link of nav.querySelectorAll<HTMLAnchorElement>("a[href*='#']")) {
      const id = link.getAttribute("href")?.split("#")[1];
      if (id === undefined || id === "") continue;
      const el = document.getElementById(id);
      if (el !== null) targets.push({ link, el });
    }
    if (targets.length === 0) return;

    let current: HTMLElement | null = null;
    let queued = false;

    const apply = () => {
      queued = false;
      /* The last section whose top has passed under the header, or the first one when the
         reader is still above all of them — a rail that lights nothing at the top of a page
         reads as broken rather than as accurate. */
      let found = targets[0];
      for (const target of targets) {
        if (target.el.getBoundingClientRect().top - THRESHOLD <= 0) found = target;
      }
      if (found.link === current) return;
      current?.removeAttribute(`data-${ACTIVE}`);
      found.link.setAttribute(`data-${ACTIVE}`, "true");
      current = found.link;
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      current?.removeAttribute(`data-${ACTIVE}`);
    };
  }, []);

  return null;
}
