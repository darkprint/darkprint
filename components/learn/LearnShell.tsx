"use client";

import { usePathname } from "next/navigation";

import { RUNS, SPEC_SEQUENCE, runPosition } from "@/components/spec/sequence";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";

/**
 * Documentation-style navigation for Learn.
 *
 * The shared sequence supplies the active route, its sections, and the Start here and
 * Reference groups. The same group position drives the rail and the page crumb.
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
