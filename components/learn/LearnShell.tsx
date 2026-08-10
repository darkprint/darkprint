"use client";

import { usePathname } from "next/navigation";

import { SPEC_SEQUENCE } from "@/components/spec/sequence";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";

/**
 * Documentation-style navigation for the Learn sequence.
 *
 * The header is the doorway: after a reader chooses a Learn page, the complete sequence
 * becomes a stable left rail on desktop. Small screens keep the compact sequence in each
 * page footer, where it does not consume the reading width.
 *
 * The rail's chrome lives in `components/ui/SideRail.tsx`, which the blueprint and node
 * pages mount too. This file is the part that is Learn's alone: which route is active, and
 * the seven-entry list it comes from. That split is why the sections a reader sees indented
 * under the active page are declared in `components/spec/sequence.ts` rather than here — a
 * client component cannot ask a server page what sections it has, so the ordered list every
 * Learn surface already derives from carries them as well.
 */
export function LearnShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = SPEC_SEQUENCE.find(
    (page) => pathname === page.href || pathname.startsWith(`${page.href}/`),
  );

  if (current === undefined) return children;

  const position = SPEC_SEQUENCE.indexOf(current) + 1;

  const items: SideRailItem[] = SPEC_SEQUENCE.map((page) => ({
    href: page.href,
    label: page.nav,
    step: page.step,
    active: page.href === current.href,
    sections: page.sections.map((section) => ({
      href: `${page.href}#${section.id}`,
      label: section.label,
    })),
  }));

  return (
    <SideRail
      label="Learn"
      meta={`${position} of ${SPEC_SEQUENCE.length}`}
      ariaLabel="Learn documentation"
      items={items}
    >
      {children}
    </SideRail>
  );
}
