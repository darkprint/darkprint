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

import { cardSource, getNodeCard } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { CardWalk } from "./nodecard/CardWalk";

const CARD_REF = "code-builder@1.0.0";

/**
 * The card without its `notes` block.
 *
 * The author asked it off this beat (2026-08-08). It is a nine-line paragraph arguing doc 1
 * §3.2 — what isolation looks like on a card, the 3-gram Jaccard similarity against
 * `spec-planner@1.0.0` measured at 0.0356 against a 0.35 threshold, and what
 * `bundle/prohibition-violated` fires on. Every word of it is true and it stays in the file
 * and on `/nodes/code-builder`, where a reader is studying one card.
 *
 * It does not belong here. This beat says "every node is a card" and shows one; a third of
 * the listing being a footnote about a similarity metric is the reference arriving inside
 * the introduction, and it was the single tallest thing in the walk.
 *
 * A block scalar, so the value is the indented run under the key rather than the rest of
 * the line: the filter drops the `notes:` line and every line indented under it, stopping
 * at the first line that starts in column zero. `resolveAnnotations` re-derives its parts
 * from whatever it is handed, so the walk renumbers itself rather than pointing at lines
 * that moved.
 */
function withoutNotes(card: string): string {
  const lines = card.split("\n");
  const at = lines.findIndex((line) => /^notes:/.test(line));
  if (at === -1) return card;
  let end = at + 1;
  while (end < lines.length && (lines[end].trim() === "" || /^\s/.test(lines[end]))) end += 1;
  return [...lines.slice(0, at), ...lines.slice(end)].join("\n").trimEnd();
}

export function SectionNodeIsCard() {
  const source = cardSource(CARD_REF);
  /* The parsed card as well as its text. The face `CardWalk` opens on is
     `CardStackFigure`, which `/what-a-blueprint-is` already draws — the author asked for
     that shape rather than the one this beat had — and it reads a `NodeCard` rather than
     the document. Same card, two readings, and both come off the archive. */
  const card = getNodeCard("code-builder", "1.0.0")?.card;
  if (source === undefined || card === undefined) return null;

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
            source={withoutNotes(source)}
            cardRef={CARD_REF}
            card={card}
          />
        </div>
      </div>
    </section>
  );
}
