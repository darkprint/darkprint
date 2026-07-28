import type { Metadata } from "next";
import Link from "next/link";

import { SectionLevels } from "@/components/home/SectionLevels";
import { CLIMB_ROUTE, RoutePager } from "@/components/howto";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Redesign spec §4.2, on the author's instruction: "/which-tasks
   should be placed in The climb part which I'd rename Towards a
   Dark Factory". So the section is three pages and this is its
   first, and §3 sends the 1-5 ladder here from the landing, which
   was carrying it as one of eight sections nobody reached the
   bottom of.

   The overview is deliberately thin. `SectionLevels` is the whole
   argument for this page and it arrives with five drawings, the
   two-scales panel and its own sources; anything written above it
   competes with the thing a reader came for. Two sentences and a
   two-item index, then the ladder.

   ── Why the ladder is imported and not rewritten ──
   `components/home/SectionLevels.tsx` is owned elsewhere this pass
   and `levels.test.ts` holds two claims on its copy: that the site
   does not credit its five rung names to the HackerNoon piece,
   which numbers its own ladder 1, 2, 3, 3.5, 4 and names none of
   them, and that the two-scales panel keeps the sentence doc 2
   §1.1 is actually about. Imported by path rather than through the
   `components/home` barrel, so that moving it off the landing's
   index cannot break this route.

   ── Doc 2 §1.1 ──
   The ladder describes an organisation and has a top. A
   blueprint's autonomy class describes one graph and records where
   its author decided a person should stand. `SectionLevels` names
   the two apart under `#autonomy`, and the other two pages of this
   route link there rather than restating it.
   ============================================================ */

export const metadata: Metadata = {
  title: "Towards a Dark Factory",
  description:
    "Five levels of working with agents, and where most teams actually sit. The gap between level 2 and level 5 is architectural and organisational, which makes it a design problem.",
};

const HERE = "/towards-a-dark-factory";

export default function TowardsPage() {
  const [, ...onwards] = CLIMB_ROUTE;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The route"
            title="Towards a Dark Factory"
            lead="Start by finding yourself on the ladder below. Where you land decides which problem you have, and the two pages after this one answer the two questions that follow."
          />

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {onwards.map((stop) => (
              <li key={stop.href}>
                <Link
                  href={stop.href}
                  className="panel group flex h-full flex-col gap-1.5 p-5 transition-colors hover:border-cyan/50"
                >
                  <span className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-cyan">
                    {stop.label}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{stop.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <SectionLevels />

      <section className="border-t border-line bg-void py-14">
        <div className="container-page">
          <RoutePager href={HERE} />
        </div>
      </section>
    </>
  );
}
