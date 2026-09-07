"use client";

import { usePathname } from "next/navigation";

import { RUNS, SPEC_SEQUENCE, runPosition } from "@/components/spec/sequence";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";

/**
 * Documentation-style navigation for the Learn sequence.
 *
 * The header is the doorway: after a reader chooses a Learn page, the complete sequence
 * becomes a stable left rail on desktop. Small screens keep the compact sequence in each
 * page footer, where it does not consume the reading width.
 *
 * The rail's chrome lives in `components/ui/SideRail.tsx`, which the blueprint, node,
 * settings and bundle pages mount too. This file is the part that is Learn's alone: which
 * route is active, and the list it comes from. That split is why the sections a reader sees
 * indented under the active page are declared in `components/spec/sequence.ts` rather than
 * here — a client component cannot ask a server page what sections it has, so the ordered
 * list every Learn surface already derives from carries them as well.
 *
 * ── Two runs, one list ──
 * The rail was one flat run of seven and a reader saw one course, so somebody who came for
 * DOT syntax was told they were two-sevenths through something. It is now grouped: a
 * **Specification** (the door and the three file formats, with the worked example hanging
 * under the last of them) and **In practice** (what a reader does with them).
 *
 * The second run was described here as "how what they describe is graded" until 2026-09-04.
 * It held the grading page then; the owner asked that page off the site and `sequence.ts`
 * records the removal, so the run is the sandbox and the essay now — turn the dials, then
 * decide whether the work belonged to an agent at all. A docblock naming a run by a stop it
 * no longer contains is how the next reader learns the wrong shape of the rail.
 *
 * The grouping is drawn from `page.run` on the same flat list, not from a second structure.
 * One list, one `specNeighbours()` walk, one pager. `heading` on the first row of each run
 * is what turns the flat list into two named ones, which means a stop that changes run is a
 * one-word edit in `sequence.ts` and nothing here moves.
 *
 * The meta line under the rail's title names the run and the position INSIDE it —
 * "Specification · 3 of 4" — because how much of this is left is the question a reader in
 * the middle of it is asking, and the answer across both runs was never the one they wanted.
 */
export function LearnShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /* A reader's live page sits under `/tutorial/` in the URL and is not a Learn stop: it is
     one person's draft, and the rail would announce the tutorial as the page they are on. */
  const current = pathname.startsWith("/tutorial/live/")
    ? undefined
    : SPEC_SEQUENCE.find(
        (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
      );

  if (current === undefined) return children;

  const at = runPosition(current.href);
  /* The sandbox has no number, so it has no position to print either: the rail names the
     run it sits in and stops. Printing "Specification · 4 of 4" over an optional detour
     would be the numbering this pass removed, arriving by another door. */
  const meta =
    at === undefined
      ? RUNS[current.run]
      : `${RUNS[at.run]} · ${at.position} of ${at.total}`;

  const items: SideRailItem[] = SPEC_SEQUENCE.map((page, i) => {
    const first = SPEC_SEQUENCE.findIndex((entry) => entry.run === page.run) === i;
    const item: SideRailItem = {
      href: page.href,
      label: page.nav,
      active: page.href === current.href,
      sections: page.sections.map((section) => ({
        href: `${page.href}#${section.id}`,
        label: section.label,
      })),
    };
    if (page.step !== undefined) item.step = page.step;
    if (page.meta !== undefined) item.meta = page.meta;
    if (page.indent === true) item.indent = true;
    if (first) item.heading = RUNS[page.run];
    return item;
  });

  return (
    <SideRail label="Learn" meta={meta} ariaLabel="Learn documentation" items={items}>
      {children}
    </SideRail>
  );
}
