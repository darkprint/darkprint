/* ============================================================
   The card, as a listing a reader can select and copy.

   Three rules from spec §3.2 shape every decision in here.

   "Real text in the DOM, syntax-coloured with spans." Every token
   is a `<span>` with a class from `TOKEN_CLASS`; nothing is a
   background image, a canvas or a `dangerouslySetInnerHTML`. The
   colours are Tailwind utilities generated from the `--color-*`
   variables in `app/globals.css`, so no hex is written here.

   "It must be selectable." Which is why the line number and the
   step marker are `select-none`: a reader who drags across ten
   lines of a card wants ten lines of YAML on the clipboard rather
   than ten lines of YAML with a number welded to the front of each
   one. `SourcePanel` already does this and this matches it.

   "It must survive into the prerendered HTML." Nothing here reads
   the DOM, so the listing renders identically on the server, and
   the row height is *declared* rather than inherited from the mono
   face's metrics, which is what lets `geometry.ts` do its
   arithmetic without measuring anything.

   The marker column is the static layout's answer to the leader
   line. Under reduced motion there is no choreography to connect an
   annotation to its lines, so the step's number is printed in the
   left margin against the run it annotates, and the same run
   carries a rule down its edge. A reader who never sees the
   animation still sees which nine places on this card the nine
   notes are about.

   ── Why every colour in here is copper ──
   The author asked for the node card to read orange rather than
   blue. The listing is where that is decided: fifty-two rows of
   keys and values are most of the figure's ink, so the register has
   to reach the tokens and not only the paper under them. Keys take
   the register's line colour, values its ink, and the marking of a
   run takes the same pair at two weights.

   `number` and `bool` used to be `text-amber`, which was a third
   spelling of a colour the site reserves for "not built yet" and
   "this box leaves the page", sitting on a card the engine really
   enforces. They are `text-fg` now: a scalar constant is a value
   rather than a status, and a neutral is the one thing in a warm
   register that cannot be mistaken for a signal.
   ============================================================ */

import { cx } from "@/lib/format";

import { NC } from "./geometry";
import type { ResolvedAnnotation } from "./annotations";
import type { YamlLine, YamlTokenKind } from "./yaml";

/** Whether a run has been reached, and whether it is the one being read now. */
export type BandState = "pending" | "attached" | "active";

const TOKEN_CLASS: Record<YamlTokenKind, string> = {
  plain: "",
  key: "text-copper-line",
  sep: "text-dim",
  block: "text-dim",
  /* Folded prose inside `spec` and `notes`. Quieter than a scalar, because it is the
     longest thing on the card, and now that `spec` is a step of its own the eight lines
     of it a reader lands on have to sit under the run's marking rather than fight it. */
  text: "text-muted",
  string: "text-copper-ink",
  number: "text-fg",
  bool: "text-fg",
  comment: "text-dim",
};

/*
 * A run's marking, in three halves, which is the shape two mounts of one listing forced.
 *
 * The BASE classes are the *finished* marking, which is what the stacked layout and the
 * reduced-motion layout want: every run marked at once, because every note is
 * open at once beside them. The `lg:` LIVE half is `CardWalk`'s, and it is only emitted
 * while the choreography is running. Without the split, a phone reader would watch runs
 * light up one at a time under notes that were all already readable, which says the wrong
 * thing about which note is being read: none of them, all of them.
 *
 * The PICKED half is `CardBreakdown`'s, and it carries NO breakpoint prefix on purpose.
 * That figure is driven by a click, a click works at 390 as well as at 1440, and a
 * highlight gated on `lg:` would leave a phone reader tapping a button that changes
 * nothing. The two halves are the two mounts and never appear together: `CardWalk` passes
 * `live` and never `picked`, `CardBreakdown` passes `picked` and never `live`.
 */
const ROW_MARKED = "bg-copper/25";
const ROW_LIVE: Record<BandState, string> = {
  pending: "lg:bg-transparent",
  attached: "lg:bg-copper/25",
  active: "lg:bg-copper-line/10",
};

/* The rule is a boundary rather than a word, so it is held to 3:1 and not to 4.5:1. The
   register's line at 60% measures 3.6:1 on the listing's ground; the active state is the
   same colour at full, which is 8.4:1 and reads as the brighter of the two at a glance. */
const RULE_MARKED = "border-copper-line/60";
const RULE_LIVE: Record<BandState, string> = {
  pending: "lg:border-transparent",
  attached: "lg:border-copper-line/60",
  active: "lg:border-copper-line",
};

/* A step number IS a word, so the attached weight is 80% (5.4:1) rather than the rule's
   60%. Below 80 the register stops clearing AA at 11px. */
const STEP_MARKED = "text-copper-line/80";
const STEP_LIVE: Record<BandState, string> = {
  pending: "lg:text-dim/60",
  attached: "lg:text-copper-line/80",
  active: "lg:text-copper-line",
};

/*
 * The picked run, at every width. `CardBreakdown`'s half of the marking.
 *
 * A ground SWAP and not a second ground. `background-color` is one property, so a picked
 * row cannot wear `bg-copper/25` and a brighter copper at once and have the answer be
 * anything but "whichever Tailwind emitted last" — which is a rule held up by stylesheet
 * order rather than by a decision. So the picked row takes `bg-copper-line/15` INSTEAD of
 * the marked ground, and the rule and the step number go to full strength beside it.
 *
 * Nothing is taken away from the eight runs that were not picked: they keep the ground,
 * the rule and the number they wear when nothing at all is picked. The figure's standing
 * claim is that nine places on this card are annotated, and a click is not an argument
 * against the other eight.
 *
 * Contrast, computed over the grounds this listing actually mixes — `bg-surface-2/40` on
 * `bg-void` is #090b14, a marked row is #1f1311, a picked row is #2e1e1c:
 *
 *   copper-line          8.41 : 1 plain / 7.76 : 1 marked / 6.76 : 1 picked
 *   copper-line at 80%          —        / 5.38 : 1 marked / 4.83 : 1 picked  (the 11px
 *                                                                             number, AA)
 *   copper-line at 60%          —        / 3.60 : 1 marked                    (the rule,
 *                                                              a non-text boundary, 3:1)
 *
 * 15% and not 10: at 10 the picked ground resolves to #221818 against the marked row's
 * #1f1311, which is a fifth of a step of luminance and reads as the same band.
 */
const ROW_PICKED = "bg-copper-line/15";
const RULE_PICKED = "border-copper-line";
const STEP_PICKED = "text-copper-line";

/**
 * Which runs carry a row ground, which is the one thing the two mounts disagree about.
 *
 * `"every"` is `CardWalk`'s and the default: all nine runs banded at once, because the
 * walk's static state stands beside nine open notes and has to say which nine places on
 * the card they are about, with no pick and nothing to pick with.
 *
 * `"picked"` is `CardBreakdown`'s, and it is `DotBreakdown`'s rule restated in copper.
 * That file's reasoning transfers exactly, because the premise transfers: the nine
 * annotations very nearly TILE this card — lines 1 to 35 of 52 — so grounding all nine
 * ends with the listing lit, which is the same as nothing being lit, and a pick then has
 * to out-shout eight bands of its own colour. Measured on the built page before this
 * split: a picked run at `bg-copper-line/15` beside eight at `bg-copper/25` reads as a hue
 * shift rather than as a selection.
 *
 * What carries the standing claim instead is the pair that was always doing the real work:
 * the rule down the margin, one bracket per run, and the step number at its head. Both are
 * unconditional and both are in the prerendered HTML, so a reader with no script still sees
 * nine numbered brackets against nine open notes. The ground stops meaning "this run is
 * annotated" and starts meaning "this is the one you asked for", which is the only job it
 * can do well when a reader can ask.
 */
export type Grounding = "every" | "picked";

interface LineMark {
  state: BandState;
  /** Printed once per run, on the line the annotation's leader arrives at. */
  step?: number;
  /** True on every line of the run the reader picked. Always false while `live`. */
  picked: boolean;
  /**
   * 0-based index into `annotations`, on the run's FIRST line only.
   *
   * What `markRef` hands back to the caller. `CardBreakdown` scrolls a picked run into
   * view below `lg`, where the rail stacks under a 1144px listing and a pick can light
   * lines a screen and a half above the button that lit them.
   */
  opens?: number;
}

/**
 * Line number to marker, for the whole document.
 *
 * Built per render rather than memoised: it is one pass over fifty-odd lines and it has
 * to change on every step, so a cache keyed on the step would be the same work plus a
 * comparison.
 */
function markLines(
  annotations: readonly ResolvedAnnotation[],
  shown: number,
  active: number,
  picked: number,
): Map<number, LineMark> {
  const marks = new Map<number, LineMark>();
  annotations.forEach((annotation, index) => {
    const state: BandState =
      index === active ? "active" : index < shown ? "attached" : "pending";
    const isPicked = index === picked;
    for (let line = annotation.from; line <= annotation.to; line += 1) {
      marks.set(line, {
        state,
        picked: isPicked,
        ...(line === annotation.from ? { step: annotation.step, opens: index } : {}),
      });
    }
  });
  return marks;
}

export function YamlListing({
  lines,
  annotations,
  shown,
  active,
  live,
  picked = -1,
  grounded = "every",
  markRef,
}: {
  lines: readonly YamlLine[];
  annotations: readonly ResolvedAnnotation[];
  /** How many steps have attached. Every one of them, in the static layout. */
  shown: number;
  /** The step being read, or -1 when there is no single one, which is the static case. */
  active: number;
  /** Whether the choreography is running, so the per-step marking is worth emitting. */
  live: boolean;
  /**
   * The run a reader has picked, or -1. `CardBreakdown`'s half of the marking, emitted at
   * every width — see `ROW_PICKED`. `CardWalk` never passes it, so the walk's markup is
   * byte-identical to what it drew before this prop existed.
   */
  picked?: number;
  /** Which runs get a row ground. See `Grounding`; the default is the walk's. */
  grounded?: Grounding;
  /**
   * Ref callback for the FIRST row of each annotated run, indexed by position in
   * `annotations`. Optional, because only the click-driven mount needs to find a row: it
   * scrolls a pick into view when the pick lands off screen.
   */
  markRef?: (index: number) => (element: HTMLElement | null) => void;
}) {
  const marks = markLines(annotations, shown, active, picked);
  const gutter = String(lines.length).length;

  return (
    <div className="w-max min-w-full font-mono text-[12px]">
      {lines.map((line) => {
        const mark = marks.get(line.no);
        const state = mark?.state ?? "pending";
        const marked = mark !== undefined;
        const isPicked = mark?.picked === true;
        /* Hoisted out of the `ref` so the callback closes over a `number` rather than over
           the map entry: TypeScript cannot narrow `mark?.opens` inside a closure, and the
           cast that silences it is a cast that would survive the property being renamed. */
        const opens = mark?.opens;
        return (
          <div
            key={line.no}
            ref={
              markRef === undefined || opens === undefined ? undefined : markRef(opens)
            }
            className={cx(
              "flex items-center",
              // A swap, not a stack: one `background-color`, one decision. See `ROW_PICKED`
              // for why the picked ground replaces the marked one, and `Grounding` for why
              // one mount grounds all nine runs and the other grounds only the pick.
              isPicked ? ROW_PICKED : grounded === "every" && marked && ROW_MARKED,
              marked && live && ROW_LIVE[state],
            )}
            /* Declared, never inherited: `geometry.ts` computes every offset in this
               section from this number, and a row that ended up 21.6px tall because of
               the mono face's default leading would put the leader line a few pixels off
               the run it points at, further off with every line. */
            style={{ height: NC.line }}
          >
            <span
              aria-hidden
              className={cx(
                /* 11px, not 10 and certainly not 9. The site's mono floor is 11px with no
                   exceptions — `app/globals.css` writes it down on all three mono tiers —
                   and this marker is the static layout's whole answer to the leader line:
                   the number a reader who never sees the choreography uses to find which
                   note a run belongs to. It has no business being the smallest text in a
                   figure whose point is that it is readable. The column is unaffected:
                   `w-6` less the rule and `pl-1` leaves 18px, and a step number is one
                   digit. `leading-[18px]` is left alone so the marker keeps sitting on the
                   same optical line as the code beside it. */
                "w-6 shrink-0 self-stretch select-none border-l-2 pl-1 text-[11px] leading-[18px]",
                /* The rule and the number are ternaries and not a stack for the reason
                   `ROW_PICKED` gives: `border-color` and `color` are one property each, so
                   a picked run has to STATE its weight rather than be layered over the
                   marked one and trust the stylesheet's order. The `lg:` live classes below
                   are layered, and that is sound because a media query is emitted after the
                   base rule by construction. */
                marked ? (isPicked ? RULE_PICKED : RULE_MARKED) : "border-transparent",
                isPicked ? STEP_PICKED : STEP_MARKED,
                marked && live && RULE_LIVE[state],
                marked && live && STEP_LIVE[state],
              )}
            >
              {/* Two digits, the spelling both rails use.
                  ------------------------------------------------------------
                  This printed the number bare, and the rail beside it has always printed
                  `ordinal()` — so a run was "9" in the margin and "09" in the list, which
                  is two spellings of one number inside one figure. It went unnoticed while
                  the row ground did the joining; it does not any more, because
                  `CardBreakdown` grounds only the picked run and this marker is then half
                  of what says which lines belong to which part. `w-6` less the 2px rule and
                  `pl-1` leaves 18px, which holds two 11px mono digits with room over. */}
              {mark?.step === undefined ? "" : String(mark.step).padStart(2, "0")}
            </span>
            <span
              aria-hidden
              className="shrink-0 select-none pr-3 pl-1 text-right text-dim/80"
              style={{ width: `${gutter + 1.5}ch` }}
            >
              {line.no}
            </span>
            <span className="whitespace-pre">
              {line.tokens.map((token, i) => (
                <span key={i} className={TOKEN_CLASS[token.kind]}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
