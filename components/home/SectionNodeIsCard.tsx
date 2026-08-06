/* ============================================================
   Beat 3 of redesign spec §2: every node is a card, and here is
   one being read.

   ── The reversal, recorded ──
   This beat carried an annotated YAML listing. Spec §2 ruled a
   YAML block off the landing, the listing moved whole to
   `/spec/card`, and what stood here instead was a drawing: one lit
   disc with a blank document hanging off it, four grey rules
   standing in for lines nobody could read.

   The author has overruled that: "I'd like you reprohose in the
   home in the current Every node is a card the idea reported in
   spec/card, where you scroll down and you can show all the
   component of a card. But in a lightweight version without using
   as background the blueprint."

   So the listing is back, in `CardWalk`. **Do not move it off
   again** on the strength of spec §2: that line is superseded, and
   the drawing it protected said a node has a document behind it
   without ever showing one, which is the weaker claim on the page
   that has to make it.

   `CardWalk` began as `NodeCardStage`'s choreography at a third of
   its weight, on a plain ground rather than the graticule. It is no
   longer a lighter copy of anything: the author asked `/spec/card`
   for "the same as the home's" panel, the stage is deleted, and
   this beat and that page are now two mounts of one component. The
   only prop that differs is `bodies` — this one keeps the shorter
   landing wording, which is what `beats.test.ts` measures the beat
   against.

   ── Why the card is read and not typed ──
   `code-builder@1.0.0`, off the archive, because the seventh part
   of the walk is `cannot: [acceptance-criteria]` and the resolver
   really does enforce it. `/spec/card` opens the same document at
   full length, so the two beats are one card seen twice rather
   than two examples.

   Server component: `lib/content` is server-only, and the YAML has
   to be *text* here so the listing that lands in the prerendered
   HTML is the finished one.
   ============================================================ */

import { cardSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { CardWalk } from "./nodecard/CardWalk";

const CARD_REF = "code-builder@1.0.0";

export function SectionNodeIsCard() {
  const source = cardSource(CARD_REF);
  if (source === undefined) return null;

  return (
    <section id="node" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        {/* Left, not centred. A centred heading over a centred drawing was right when the
            drawing was a symmetrical scene; the walk below is a listing beside a list, and
            both start on the left margin. */}
        {/* No eyebrow. `.eyebrow` is rationed to one per page or per full-bleed band, and
            "ONE NODE" spent one of them saying what the headline beside it already says
            in bigger type. What was left was a cyan mono run competing with the cyan keys
            in the listing below it for the same reader's attention. */}
        <SectionHeading
          title="Every node is a card"
          lead="Open one and it says what it does, the brief it is handed, which model runs it, what arrives, and what must never reach it. Nine parts, on a card the archive really stores."
        />

        <div className="mt-10">
          <CardWalk
            /* The trailing newline every file on disk ends with would render as a blank
               line 53 under a 52-line card, and would count in the walk's arithmetic. */
            source={source.trimEnd()}
            cardRef={CARD_REF}
          />
        </div>
      </div>
    </section>
  );
}
