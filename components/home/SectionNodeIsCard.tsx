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
 * Top-level keys this beat does not show.
 *
 * `notes` went first (2026-08-08): a nine-line paragraph arguing doc 1 §3.2 — what
 * isolation looks like on a card, the 3-gram Jaccard similarity against
 * `spec-planner@1.0.0` measured at 0.0356 against a 0.35 threshold, and what
 * `bundle/prohibition-violated` fires on. Every word of it is true, it stays in the file
 * and on `/nodes/code-builder`, and a third of the listing being a footnote about a
 * similarity metric is the reference arriving inside the introduction.
 *
 * The other five went the same day, on the same instruction: "remove from the yaml of the
 * card in the home page the fields requires_human, risk_markers, version, author,
 * ontology_version as they are unuseful details here to show to the user."
 *
 * They are the card's METADATA, and this beat is not about a card's metadata. Two of them
 * are empty or false, `version` is already printed in the figure's own header and in the
 * rail above the listing, and `author` and `ontology_version` are provenance — real, worth
 * having, and the business of `/nodes/[...id]`, where a reader is deciding whether to trust
 * a card rather than learning what one is.
 *
 * Nothing annotated is at risk: `annotations.ts` anchors its nine runs on `id`/`name`/
 * `type`/`phase`, `action`, `spec`, `model`, `tools`/`mcp`, `skill`, `inputs`, `outputs`
 * and `cannot`, and not one of these six is among them. The last run ends at `cannot`, and
 * all six sit below it.
 */
const HIDDEN_KEYS = [
  "notes",
  "requires_human",
  "risk_markers",
  "version",
  "author",
  "ontology_version",
] as const;

/**
 * The card with those keys, and anything indented under them, taken out.
 *
 * Block scalars and lists are why the value is "the indented run under the key" rather than
 * "the rest of the line": `notes:` is a `>-` block and `risk_markers:` could hold a list, so
 * the filter drops the key's line and every line indented under it, stopping at the first
 * line that starts in column zero. `resolveAnnotations` re-derives its parts from whatever
 * it is handed, so the walk renumbers itself and re-marks its lines rather than pointing at
 * lines that moved.
 *
 * Trailing blank lines collapse so the file does not end in the holes the removals left —
 * five of the six are consecutive at the foot of this card, and without it the listing
 * closed on four empty rows.
 */
function withoutKeys(card: string, keys: readonly string[]): string {
  let lines = card.split("\n");
  for (const key of keys) {
    const at = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
    if (at === -1) continue;
    let end = at + 1;
    while (end < lines.length && (lines[end].trim() === "" || /^\s/.test(lines[end]))) end += 1;
    lines = [...lines.slice(0, at), ...lines.slice(end)];
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
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
        {/* Centred, on the author's instruction (2026-08-08), and the reason the old note
            here gave for the left margin has expired. It argued that "the walk below is a
            listing beside a list, and both start on the left margin" — but the walk no
            longer OPENS on the listing. It opens on the card, which is a 38rem figure
            centred in its own cell, and a left-aligned heading over a centred card is the
            mismatch the note was written to prevent, pointing the other way.

            It matches the beat above it either way: `SectionBlueprint` centres the same
            pair over the same kind of figure. */}
        {/* No eyebrow. `.eyebrow` is rationed to one per page or per full-bleed band, and
            "ONE NODE" spent one of them saying what the headline beside it already says
            in bigger type. What was left was a cyan mono run competing with the cyan keys
            in the listing below it for the same reader's attention. */}
        {/* The lead ended "Nine parts, on a card the archive really stores." until the
            author asked it out. It was the deck counting the figure's own steps: the walk
            numbers its nine parts 01 to 09 down the rail and marks each one's lines in the
            margin, so the sentence was telling a reader a number they were about to be
            shown — and "the archive really stores" is a claim the figure makes by being
            drawn from the file, not one the deck has to assert. */}
        {/* Sticky, on the author's instruction 2026-08-08: this heading is not to "scroll
            away" while the figure below it is pinned.

            It works because the two are SIBLINGS in one scroll container, so each takes its
            own offset: the heading locks at `top-16`, just under the site header, and the
            figure locks lower down at its own centring offset. Neither is inside the other,
            which is what would have made the second one's offset meaningless.

            `bg-bg-surface` is not decoration. The figure passes underneath a sticky element,
            and a heading with a transparent ground would have a 460px drawing sliding
            through its letters. The class is the section's own ground, so the strip reads as
            the page rather than as a bar.

            `-mx-4 px-4` so the ground reaches past the text to the container's padding
            edge, and `pb-6` so the figure never touches the last line. `z-30` is the section
            chrome rung of `app/globals.css`'s ladder — above the figure, below the header at
            50. */}
        <div className="bg-surface sticky top-16 z-30 -mx-4 px-4 pb-6">
        <SectionHeading
          /* The card's own register, on the author's instruction: "colour using the amber
             colour typical of a node."

             `copper-line` and NOT `--color-amber`, and the difference is the point rather
             than a quibble. `app/globals.css` declares the copper pole for exactly this and
             writes down why it must never become amber: amber is spent sitewide on two
             claims — `ComingSoonBadge` ("not built yet") and `.route-box` ("this box leaves
             the page") — and a node card is the most literally-built thing on this site,
             read off `content/cards/` at build time with the engine enforcing what it
             declares. So copper IS the warm colour a reader means when they point at the
             card figure: the listing's keys, the walk's step numbers and the card's own
             frame are all already in it, at oklch hue 46 against amber's 75.

             The heading and the figure under it are now one register, and it pairs with the
             cyanotype title one beat up — a card is a document, a blueprint is a drawing,
             and the two say so before a word is read. */
          title={<span className="text-copper-line">Every node is a card</span>}
          lead="Open one and it says what it does, the brief it is handed, which model runs it, what arrives, and what must never reach it."
          align="center"
          className="mx-auto"
        />
        </div>

        {/* `mt-4`, not `mt-10`. The other 24px of the author's "it is too distant" — the
            rest came out of the card's own placement inside the cell, see `FACE_TOP`. A
            figure that turns into the file it describes belongs against its deck rather
            than a section-gap away from it; the 40px rhythm is for a section following a
            section, and this is a caption following its own picture. */}
        <div className="mt-4">
          <CardWalk
            /* The trailing newline every file on disk ends with would render as a blank
               line 53 under a 52-line card, and would count in the walk's arithmetic. */
            source={withoutKeys(source, HIDDEN_KEYS)}
            cardRef={CARD_REF}
            card={card}
          />
        </div>
      </div>
    </section>
  );
}
