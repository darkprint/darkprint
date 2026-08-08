"use client";

/* ============================================================
   The card, walked one part at a time. THE LANDING'S MOUNT, and
   the only one.

   ── What the author asked for, three times ──
   First for the landing: "I'd like you reprohose in the home in the
   current Every node is a card the idea reported in spec/card,
   where you scroll down and you can show all the component of a
   card. But in a lightweight version without using as background
   the blueprint."

   Then, of the reference page the lightweight version was derived
   from: "make /spec/card's scrollable node panel the same as the
   home's", and "it should scroll in the middle of the screen". For
   one release this file was therefore what BOTH `/` and
   `/spec/card` drew, and the fork it was written as a copy of —
   `NodeCardStage`, 534 lines, a `calc(100vh + 2500px)` track, a
   leader line and a dezoom — was deleted rather than kept as a
   second answer to one question.

   Then, of that same page: "in /spec/card avoid the effect on
   scrolling of the card panel (**keep it for the other pages**). I
   prefer here the approach adopted in /spec/topology for the panel
   starter-software-factory/blueprint.dot." So `/spec/card` mounts
   `./CardBreakdown.tsx` now — the same nine parts, picked with a
   click instead of walked with a scroll — and this component is the
   landing's again.

   THE PARENTHESIS IS THE INSTRUCTION. The scroll walk was not
   replaced; it was narrowed to the surface that asked for it. Do
   not "finish the migration" by deleting this file or by folding it
   into the breakdown: the landing is where a reader is shown a card
   without having decided to study one, and a figure that does
   nothing until it is clicked says nothing to a reader who is
   scrolling past.

   What did NOT fork: `annotations.ts` resolves the same nine runs
   against the same bytes, `yaml.ts` tokenises them, `YamlListing`
   draws the listing for both, and `prose.tsx` spells the step number
   and the line span for both. Only the interaction is two things.

   ── What "lightweight" cost, item by item ──
   Recorded because these were deletions from the reference page as
   well when it drew this figure, and none of them is free:

     the Sheet          the blue graticule ground, which is the one
                        thing the author named. This sits on plain
                        `bg-void` behind a hairline, the same frame
                        `/what-a-blueprint-is`'s figures use.
     the leader         an elbow drawn from the run being read to
                        the note about it, with the pixel geometry
                        that costs. The listing's own highlight and
                        the open note say the same thing here.
     the dezoom         the card shrinking into a node of the
                        starter graph at the end. `/spec/card` was
                        its only mount, so asking for the home's
                        version of this figure took it off the site;
                        `components/viz/scene-labels.test.ts` and
                        `ssr.test.ts` record the same removal where
                        they used to measure it.
     the reserve        the track is 190vh rather than 420, because
                        there is no dezoom to reserve a quarter of
                        the scroll for.
     the per-head       every rail head was a `<button>` scrolling
     buttons            the page to its own step. Nothing here is
                        clickable: the reader's gesture is the only
                        control, which is what makes the pin honest.

   What survives is the part the author asked for every time: nine
   parts of a real card, arriving one at a time, each marking its
   own lines.

   ── `bodies`, and why it is still a prop ──
   The landing gets the 25-word wording below; `annotations.ts`
   carries 45-word bodies, which are the ones `nodecard.test.ts`
   holds to the diagnostic codes the site can be grepped for. Those
   belong to `/spec/card`, and `CardBreakdown` reads them straight
   off `annotations.ts` with no override at all — so the empty
   `bodies={{}}` this component used to be passed from there is
   gone with the mount. The prop stays because the fallback is still
   what makes a NEW part appear in full rather than not at all:
   anything unkeyed in `WALK_BODY` falls through to `note.body`.

   ── Why one DOM and not two ──
   The choreography classes all carry `lg:` and are emitted only
   when `motion` is true, and `motion` is false on the server and on
   the first client render. So the prerendered markup is the static
   layout: the whole listing, all nine notes, no clipping. A phone
   reader and a reader who asked for stillness get that, and so does
   a crawler.
   ============================================================ */

import { useMemo } from "react";

import type { NodeCard } from "@/lib/core";

import { clamp01, stagesShown, useScrollProgress } from "@/components/viz/useScrollProgress";
import { cx } from "@/lib/format";

import { resolveAnnotations } from "./annotations";
import { CardStackFigure } from "@/components/learn/PartFigures";
import { NC, reelShift } from "./geometry";
import { body, lineSpan, ordinal } from "./prose";
import { YamlListing } from "./YamlListing";
import { tokenizeYaml } from "./yaml";

/**
 * The chrome around the window the listing scrolls inside.
 *
 * `NC.rows` whole rows, and nothing else. The arithmetic, because it has gone wrong
 * three times in the same place:
 *
 *   window   24 × NC.line = 528px of YAML, whole rows only
 *   chrome   PAD_Y = 2, the 1px border on each side and NOTHING MORE
 *   declared 528 + 2 = 530px, which `box-sizing: border-box` resolves to a 528px
 *            padding box — and the padding box is where `overflow: hidden` clips
 *
 * The trap, and it is not the obvious one. PAD_Y was 16 and counted `py-2` at both ends;
 * raising it to 18 to cover the border is still wrong, and measurement says so: with
 * `padding: 8px 0` the rows start 8px down and the clip is 544px, so 536px of window
 * holds 24 rows and the top eight pixels of a twenty-fifth. **A scroll container's
 * bottom padding does not hold a blank strip open at the bottom of the window.** It sits
 * after the last line of the file, 1160px down, and the space it appeared to reserve at
 * the visible edge is filled by the next row of content.
 *
 * The same argument runs at the top the moment the reel moves. Every shift `reelShift`
 * returns is a whole multiple of `NC.line`, so with the padding gone the window shows 24
 * whole rows in every state it can be in, and with 8px of padding it shows the bottom
 * 8px of one row, 23 whole ones, and the top 14px of another — in every state except the
 * first. Hence `lg:py-0`: the padding is right on a phone, where the listing stands at
 * its own height and has no window to align to, and wrong the instant there is one.
 */
const PAD_Y = 2;

/**
 * How far down the shared cell the card face sits, in CSS pixels.
 *
 * The cell is the LISTING's height — 613px — and the card is 271, so 342px of slack has to
 * go somewhere. Centring split it 171/171 and the author asked the card closer to its own
 * deck ("it is too distant"): those 171 pixels sit between the lead and the card before the
 * pin engages and read as a gap rather than as air. 71 above and 271 below measures 87px
 * from the deck at 1440 x 950, against 211 centred.
 *
 * This is the ONLY term that was allowed to move. The sticky offset below also places the
 * card — a pinned card lands at `top + FACE_TOP` — and spending 100px of it here was tried
 * and reverted, because `top` is what centres the listing and the listing owns the last 86%
 * of the pin. See that comment.
 *
 * Not a percentage: the two heights are fixed numbers this file already derives everything
 * else from, and a percentage of the cell would drift the moment `NC.rows` changes.
 */
const FACE_TOP = 71;

/**
 * The landing's wording for the nine parts. Roughly 25 words each, against the 45 that
 * `annotations.ts` carries.
 *
 * The long bodies stay where they are and are not edited: they are `/spec/card`'s, and
 * `nodecard.test.ts` holds three of them to the diagnostic codes the site can be checked
 * on (`bundle/prohibition-violated`, `bundle/port-mismatch`, `llm_model`). That is
 * reference material and it belongs on the reference page, which now draws it with
 * `CardBreakdown` and reads `note.body` directly rather than overriding anything.
 *
 * What the landing needs from the same nine parts is smaller: which part of a card this
 * is, and why anyone would write it down. Beat 3 carried 670 of the landing's 1090 words
 * with the reference sentences in it, on the page whose job is to get a reader as far as
 * the archive. The `L1–4` marks in the listing do the pointing that a sentence naming
 * line numbers would otherwise have to.
 *
 * Keyed by `AnnotationSpec.id`, and anything unkeyed falls back to the long body, so a
 * new part appears here in full rather than not at all.
 *
 * Measured while the reference bodies were still rendered in this layout: the notes column
 * is 433px at `lg`, one body is open at a time, and the nine heads plus the longest of the
 * long bodies came to 470px against the listing's 530px window beside them. So the
 * figure's height — and therefore the sticky half-height below — is the listing's, and the
 * short wording has margin to spare rather than a budget of its own.
 */
const WALK_BODY: Record<string, string> = {
  identity:
    "The first four lines fix identity. `code-builder` is the id a graph pins by version, " +
    "`agent` means a model runs this box, and `implementation` places it in the lifecycle.",
  action:
    "One line for what the node does. Nothing in the engine reads it, and it travels into " +
    "the download unchanged, for whoever opens the card next.",
  spec:
    "The brief an agent is handed when the graph is instantiated on your own machine. It has " +
    "to stand alone: whatever reads it never sees the rest of the graph.",
  // "the compiled export", not `factory.dot`: the author asked for that name off the
  // landing, and this walk renders there. Still true — the model line lands in the
  // compiled file and not in `blueprint.dot`, which carries no `model` line at all.
  model:
    "Which model the agent is instantiated with. The compiled export carries it, and " +
    "a card that names none inherits whatever the run supplies.",
  skill:
    "A pointer to where the behaviour is written. The engine reads nothing at the other end, " +
    "so no skill document travels in the download. You supply it.",
  reach:
    "`tools` is empty and `mcp` names one server, so this node touches the filesystem and " +
    "nothing else. A factory's whole reach reads off its cards before anything runs.",
  inputs:
    "One input, and it carries a type. `brief` is a `plan`, an ontology term rather than free " +
    "text, so the resolver can check an incoming edge against it.",
  outputs:
    "One output, typed the same way. `build` is `code`, and it is what the edge to the " +
    "acceptance tester carries. A downstream mismatch fails the bundle.",
  cannot:
    "The prohibition, and the engine holds the graph to it. An edge carrying " +
    "`acceptance-criteria` into this node fails the bundle rather than warning about it.",
};

/* `ordinal`, `lineSpan` and `body` used to be declared here. They moved to `./prose.tsx`
   when `/spec/card` stopped mounting this component: `CardBreakdown` draws the same nine
   heads with the same step numbers and the same line spans, and a run spelled `L24-27` in
   one mount and `L24–27` in the other would be two figures rather than one seen twice. */

export function CardWalk({
  source,
  cardRef,
  card,
  bodies = WALK_BODY,
}: {
  /** The card document, verbatim, read off the archive by the server half. */
  source: string;
  cardRef: string;
  /** The same card, parsed, for the face the walk opens on. */
  card: NodeCard;
  /**
   * Per-step wording, keyed by `AnnotationSpec.id`, overriding `annotations.ts`.
   *
   * Defaults to the landing's short set, which is the only set any caller wants today:
   * `SectionNodeIsCard` is the one mount left, and `/spec/card` reads the long reference
   * bodies through `CardBreakdown` rather than through an empty override here. What the
   * fallback still buys is a part that nobody has written short wording for yet — it
   * renders in full rather than blank.
   */
  bodies?: Record<string, string>;
}) {
  const lines = useMemo(() => tokenizeYaml(source), [source]);
  const notes = useMemo(() => resolveAnnotations(source), [source]);

  const { ref, progress, motion } = useScrollProgress<HTMLDivElement>({ steps: 120 });

  /* Pacing, worked out rather than guessed, at a 1440 × 900 reference viewport.
     ------------------------------------------------------------
     `scrollProgress` measures the pin as `height - viewport`. That is exact only when the
     sticky child is a full screen tall, and this one measures 612.5px pinned at
     `50vh - 19.25rem` = 142px, so the two clocks disagree by a fixed amount:

       reported span   R = 1710 - 900               = 810px  (progress 0 → 1)
       real pin        P = 1710 - 612.5 - 142       = 955px  (lock → release)

     P - R = 146px in which the figure is still pinned and `progress` is already 1. That
     gap is structural: it is `viewport - figureHeight - stickyTop`, which for a centred
     figure is `viewport/2 - figureHeight/2`. It shrinks only as the figure grows, which
     is one more thing C bought.

     Everything after the last step is dead scroll, so the last step is pushed as late as
     the arithmetic allows. The last of nine attaches at `head + (8/9)(1 - head - tail)`:

       tail 0.04  → 0.867 → 702px → 253px frozen
       tail 0     → 0.893 → 723px → 232px frozen

     which is one step's worth of dwell on the last note plus the structural 146px, and is
     the floor. THE PLAN SAID `tail: 0.20`; that is the wrong direction and it is recorded
     here rather than silently followed. A tail reserve moves the last step EARLIER, and
     lengthens the gap the change was written to close. There is still no dezoom here to
     spend a reserve on.

     The track was 240vh, came down to 170vh when that was where 436px of frozen scroll
     was going, and is 190vh now that the walk carries nine parts rather than seven. The
     20vh buys the pace back exactly: a step is `(1/9) × 0.96 × 810 = 86px`, which is the
     number seven steps had at 170vh. Two more notes at the same pace, for a fifth of a
     screen of landing. Leave the pace alone and each step would have fallen to 67px,
     which is under a single trackpad flick and would have made the walk skip. */
  /* `head` was 0.04 and is 0.22 because the walk no longer starts on the listing.
     ------------------------------------------------------------
     The author asked for a card drawn as a card first, swapped for its own YAML as a
     reader scrolls. That swap spends the first fifth of the pin (see `FACE_OUT` and
     `LIST_IN` above), and the annotations may not begin under it: step 1 attaching to a
     line nobody can see yet is the walk talking over itself.

     0.22 is the crossfade's end plus a little air, so the listing is fully opaque and has
     been still for a moment before the first head lights. The tail stays 0 for the reason
     the note below gives — a tail reserve moves the LAST step earlier, which is the wrong
     direction here. */
  const shown = motion ? stagesShown(progress, notes.length, { head: 0.22, tail: 0 }) : notes.length;
  const active = motion ? Math.min(notes.length, Math.max(1, shown)) - 1 : -1;
  const open = active >= 0 ? notes[active] : undefined;

  /* The face goes out, the listing comes in, and they overlap for a twentieth of the pin
     so the swap reads as one thing becoming another rather than as a cut. The hold before
     the turn starts is 0.08 of a 190vh track — about 75px — which is the least that reads
     as a card standing still rather than as one already leaving when it arrives. Both are inline
     opacity applied only once `motion` is confirmed: without it neither layer carries a
     style at all and the two render as ordinary blocks, one under the other, which is what
     the server and a reduced-motion reader get. `beats.test.ts` forbids shipping
     `opacity-0`, and this is why nothing here does. */
  const faceOpacity = 1 - clamp01((progress - 0.08) / 0.09);
  const listOpacity = clamp01((progress - 0.13) / 0.09);
  /* The same card flip `SourceSwap` does one beat up, and for the same reason the author
     gave: "the same transition should be also applied below to the node card that becomes
     the yaml". A layer is edge-on exactly when it is invisible, because the turn is tied to
     the same ramp as the opacity. `perspective` sits on the grid so both children share a
     vanishing point. */
  const layer = (opacity: number, turn: number) =>
    motion
      ? ({
          gridArea: "1 / 1",
          opacity,
          transform: `rotateY(${turn}deg)`,
          backfaceVisibility: "hidden",
          pointerEvents: opacity < 0.5 ? "none" : "auto",
        } as const)
      : undefined;

  return (
    <div ref={ref} className={cx(motion && "lg:h-[190vh]")}>
      {/* Centred while pinned, not tucked under the header.
          ------------------------------------------------------------
          The author: it "should start scrolling the list of fields when it is in the
          middle of the page and not when it is high". `top-24` pinned the figure 96px
          down, so the walk began with it against the top edge.

          `calc(50vh - 19.83rem)` is half a viewport less half the figure, which centres
          the LISTING at any height — 317.25px is half of the 634.5px it measures at `lg`
          (552 of window, 24 of `sm:p-6` at each end, 16 of `gap-4`, 18.5 of figcaption).
          It was 19.25rem against a 528px window; `NC.rows` gained a row so the overlay
          scrollbar stops sitting on the file's last line, and this number moved with it
          because the two are one measurement written twice. It also
          buys the settle for free: the figure locks when the track's top reaches this
          offset, and `scrollProgress` only starts counting once the top passes zero, so it
          sits still for those pixels before step 2 arrives.

          THE LISTING and not the card, deliberately, and the two cannot both be centred.
          `top` places the cell and `FACE_TOP` places the card inside it, so a pinned card
          lands at their sum; the listing lands at `top` alone. Moving 100px from one term to
          the other was tried and reverted — it centred the card at 473 and pushed the
          listing's middle to 573, a hundred pixels low. The listing is on screen for the
          last 86% of the pin and the card for the first 14%, so the offset belongs to the
          listing and the card takes the 102px of rise that leaves it. It is arriving at that
          point rather than being read.

          What closed the author's "it is too distant" is `FACE_TOP` alone, which is slack
          inside the cell rather than a term in this offset: 171px of it above the card
          became 71, and the gap between the deck and the card went 211 → 87 at 1440 x 950
          with nothing here changing.

          `max(4rem, …)` is the floor. Half the figure is 317px, so `50vh - 19.83rem` turns
          negative below a 635px viewport and would pin the figcaption under the 4rem sticky
          header. A window that short cannot hold the whole figure either way; what the floor
          decides is which end gets cut, and the top is where the card names itself. */}
      <div
        className={cx(motion && "lg:sticky lg:top-[max(4rem,calc(50vh_-_19.83rem))]")}
      >
        {/* Plain ground, one hairline. The author named the graticule as the thing to
            drop, and it is the whole difference between a figure the landing carries and
            a plate that reads as its own page. */}
        <div
          className={cx(motion && "lg:grid lg:items-start")}
          style={motion ? { perspective: "1800px" } : undefined}
        >
        {/* The card, before it is a file. Same shell, same grid cell, so the sticky box
            reserves the listing's height — which is the taller of the two and the height
            every number in the comment above is derived from. */}
        {/* `CardStackFigure`, the shape `/what-a-blueprint-is` draws, on the author's
            instruction: a card with ghosts stacked behind it for the other nodes in the
            graph, its id and version in the header, and six fields under a rule with
            `cannot` in the alarm colour. It replaced a face written for this beat alone —
            one figure for one idea, drawn the same way wherever the idea appears.

            Centred, because the listing it becomes is full width and the card is not. */}
        {/* Where the card sits in the cell, and why it is a number rather than an alignment.
            ------------------------------------------------------------
            The layer must not be the grid's default `stretch`: `CardStackFigure`'s ghosts
            are absolutely positioned to its wrapper, so a layer stretched to the LISTING's
            613px drew them as three outlines running 350px past the bottom of the card. Both
            `items-start` on the grid and `items-center` here solve that; what they disagree
            about is the 342px of slack, and the author has now ruled on both ends of it.

            `items-start` put the whole 342 under the card. Centring split it, 171 above and
            171 below — which centres the card on screen while pinned, and is why the author
            then asked for it closer to the heading: before the pin engages, those 171 pixels
            sit between the deck and the card and read as a gap rather than as air.

            `FACE_TOP` is the third answer: 71 above and 271 below. It takes 100px straight
            out of the pre-pin gap, and it is the only term here that may — the sticky offset
            also places the card, but it is what centres the LISTING, and the listing is on
            screen for the last 86% of the pin against the card's first 14%. */}
        <div
          className="flex items-start justify-center"
          style={{
            ...layer(faceOpacity, -90 * (1 - faceOpacity)),
            ...(motion ? { paddingTop: FACE_TOP } : {}),
          }}
        >
          <CardStackFigure card={card} nodes={5} size="stage" />
        </div>
        <div className={cx(!motion && "mt-5")} style={layer(listOpacity, 90 * (1 - listOpacity))}>
        <figure className="flex flex-col gap-4 rounded-xl border border-line bg-void p-4 sm:p-6">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-dim">
            <span className="text-muted">{cardRef}</span>
            <span className="flex items-baseline gap-3">
              <span>{lines.length} lines, as the archive stores them</span>
              {/* What the fade on the listing's right edge means, said in words.
                  A card's `spec` runs past any column this figure can be given, macOS
                  draws no scrollbar at rest, and the cut then reads as a bug rather than
                  as an edge. `aria-hidden` because the region below announces itself and
                  its length, and an arrow read aloud is noise. */}
              <span aria-hidden className="shrink-0 whitespace-nowrap text-dim/70">
                scroll →
              </span>
            </span>
          </figcaption>

          {/* 1.5fr against 1fr, not 1.05.
              ------------------------------------------------------------
              Measured at 1440: the listing had 552px of column against 784px of content,
              so 17 of the 52 rows lost their last ~32 characters and sentences ended
              mid-word ("...emit the source it describes, addin"). At 1.5fr the listing
              measures 647px and the notes keep 433px, which still holds the shortened
              bodies in three lines at 13px. 137px of a folded `spec` still runs past the
              edge and always will — no column this figure can be given holds it — so what
              is left over is marked as an edge rather than left to look like a cut. */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
            {/* The listing. Clipped to a window and slid, but only while the
                choreography runs; otherwise it stands at its own height and a reader
                scrolls the page past it. */}
            {/* `overflow-x-auto` always, and the height clip only while the walk runs.
                The pair is `NodeCardStage`'s, and it is the only combination that works:
                a card's `spec` runs past any column this figure could be given, so the
                listing has to scroll sideways, and CSS resolves `overflow-y: hidden`
                beside `overflow-x: auto` back to `auto` if you write it the other way
                round. A fixed height plus `overflow-y-hidden` states the clip without
                asking the two axes to disagree. */}
            <div
              /* A scroll container with no focusable child cannot be reached from the
                 keyboard at all (WCAG 2.1.1, Level A): there is nothing to tab to, so the
                 32 characters past the right edge are available to a mouse and to nobody
                 else. `role="region"` with a name is what makes the stop worth having —
                 "code-builder@1.0.0, 52 lines" rather than an unlabelled group. */
              tabIndex={0}
              role="region"
              aria-label={`${cardRef}, ${lines.length} lines`}
              className={cx(
                "min-w-0 overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2",
                /* The right edge, faded, so the truncation is a statement and not a
                   glitch. It has to be on THIS element and not on the reel inside it: the
                   mask is painted over the scroll container's own box, which is the part
                   that stays still while the content moves under it. Put on the reel it
                   would scroll away with the text. */
                "[mask-image:linear-gradient(to_right,black_calc(100%_-_3rem),transparent)]",
                motion && "lg:h-[var(--walk-window)] lg:overflow-y-hidden lg:py-0",
              )}
              /* The height goes through a custom property so the `lg:` prefix can gate it.
                 As an inline `height` it applied at every width, and a fixed height beside
                 `overflow-x: auto` makes the box scrollable on both axes, so a phone got a
                 264px nested scroller holding a 52-line file. `NodeCardStage`'s own note
                 states the rule this broke: "the sticky-scroll choreography must not trap
                 a phone reader". Below `lg` the listing now stands at its full height and
                 the page scrolls past it. */
              style={{ "--walk-window": `${NC.window + PAD_Y}px` } as React.CSSProperties}
            >
              <div
                /* The reel's shift goes through a custom property for exactly the reason
                   the height above does, and it was the half of that fix that got missed.
                   As an inline `transform` it applied at every width while the window clip
                   it drives is `lg:`-only, because `motion` tracks
                   `prefers-reduced-motion` and knows nothing about width. Measured on a
                   390px phone: the transform reached -638px against a container that
                   never clips, 28 of the 52 lines were slid above the box's top edge with
                   no way to get them back, and 647px of empty bordered box opened under
                   the last line. `NodeCardStage` proves the pattern — the property is set
                   at every width and only the `lg:` utility reads it. */
                className={cx(
                  motion &&
                    "lg:transition-transform lg:duration-500 lg:ease-out lg:[transform:translateY(var(--walk-reel,0px))]",
                )}
                style={
                  {
                    "--walk-reel":
                      motion && open !== undefined
                        ? `${reelShift(open.from, lines.length)}px`
                        : "0px",
                  } as React.CSSProperties
                }
              >
                <YamlListing
                  lines={lines}
                  annotations={notes}
                  shown={shown}
                  active={active}
                  live={motion}
                />
              </div>
            </div>

            {/* The nine parts. Every title is on screen from the start, so the figure
                says how many parts a card has before it has walked any of them, and the
                one being read opens under its own head. */}
            <ol className="flex min-w-0 flex-col">
              {notes.map((note, i) => {
                const reached = !motion || i < shown;
                const isOpen = i === active;
                return (
                  <li
                    key={note.id}
                    className="border-t border-line/70 py-2.5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        aria-hidden
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          /* Copper, because the listing beside it is: the card's register
                             is one colour and the number telling a reader which note is
                             open belongs to it. 8.7:1 on `bg-void`. */
                          isOpen ? "text-copper-line" : reached ? "text-dim" : "text-faint",
                        )}
                      >
                        {ordinal(note.step)}
                      </span>
                      <h3
                        className={cx(
                          "min-w-0 flex-1 text-[15px] font-medium leading-snug transition-colors",
                          isOpen ? "text-fg" : reached ? "text-muted" : "text-dim",
                        )}
                      >
                        {note.title}
                      </h3>
                      {/* `text-dim` and not `text-faint`. `--color-faint` is #3b4058 at
                          1.83:1 and `app/globals.css` reserves it for decorative
                          separators; this is the only thing telling a reader which lines
                          each part is about, and eight of the nine wear it at any moment,
                          so the whole column was below the contrast floor. */}
                      <span
                        className={cx(
                          "shrink-0 font-mono text-[11px] tabular-nums transition-colors",
                          isOpen ? "text-copper-line" : "text-dim",
                        )}
                      >
                        {lineSpan(note.from, note.to)}
                      </span>
                    </div>

                    {/* Open under its own head while the walk is running; all nine open
                        in the static layout, which is what makes the prerendered markup
                        readable without script.

                        `lg:sr-only`, and not `lg:hidden`. This carried `lg:hidden` —
                        `display: none`, which takes an element out of the accessibility
                        tree as well as out of the layout — so eight of the nine bodies
                        were unreachable to a screen reader, to find-in-page and to a text
                        extractor at `lg`, and the only route to them was scrolling a
                        190vh section one step at a time. `NodeCardStage` had the same bug
                        once and fixed it this way; that component is deleted and this is
                        the fix carried across rather than lost with it. `sr-only` is
                        `position: absolute` with a 1px clip, so the reel steps exactly as
                        it did and the column measures the same. */}
                    <p
                      className={cx(
                        "mt-1.5 pl-[1.9rem] text-[13px] leading-relaxed text-muted",
                        motion && !isOpen && "lg:sr-only",
                      )}
                    >
                      {body(bodies[note.id] ?? note.body)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </figure>
        </div>
        </div>
      </div>
    </div>
  );
}
