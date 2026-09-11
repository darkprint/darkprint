/* ============================================================
   Beat 3: every node is a card, and here is one.

   The figure is `CardStackFigure`, the shape `/what-a-blueprint-is`
   draws too: the blueprint's nodes in a row with this one lit and
   tethered, over a plate carrying the card's identity, what it does,
   its interface and the one thing that may never arrive. One figure
   for one idea, drawn the same way wherever the idea appears.

   `code-builder@1.0.0`, off the archive, because its plate ends on
   `cannot: acceptance-criteria`, and the resolver really does enforce
   that line. `/spec/card` opens the same document in full, so the two
   beats are one card seen twice rather than two examples.

   Server component: `lib/content` is server-only, and the figure has
   no interaction, so the prerendered HTML is the finished beat.
   ============================================================ */

import { getNodeCard } from "@/lib/content";
import { CardStackFigure } from "@/components/learn/PartFigures";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { BeatCaption } from "./BeatCaption";

export function SectionNodeIsCard() {
  const card = getNodeCard("code-builder", "1.0.0")?.card;
  if (card === undefined) return null;

  return (
    <section id="node" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        {/* Centred over a centred figure, matching the beat above it. No eyebrow, because
            `.eyebrow` is rationed to one per page and the hero spends it. Amber is the card
            register's own colour: `app/globals.css` gives it that job, and the figure under
            it draws copper, a neighbour on the wheel, so the beat reads as one warm block
            against the cyan blueprint beat above. */}
        <SectionHeading
          title={<span className="text-amber">Every node is a card</span>}
          lead="Open one and it says what it does, the brief it is handed, which model runs it, what arrives, and what must never reach it."
          align="center"
          className="mx-auto"
        />

        <div className="mt-10 flex justify-center">
          <CardStackFigure card={card} nodes={5} size="stage" />
        </div>

        {/* Copper rather than cyan, so the beat does not hand off in the blueprint's colour;
            `BeatCaption`'s tone map has no amber entry. */}
        <BeatCaption href="/spec/card" cta="Card format reference" tone="copper">
          Each node pins an exact card version: its job, interface, tool reach, and
          prohibitions. Reuse the card in another graph.
        </BeatCaption>
      </div>
    </section>
  );
}
