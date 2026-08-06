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
 * A run's marking, in two halves.
 *
 * The base classes are the *finished* marking, which is what the stacked layout and the
 * reduced-motion layout want: every run marked at once, because every note is
 * open at once beside them. The `lg:` half is the live state, and it is only emitted while
 * the choreography is running. Without the split, a phone reader would watch runs light up
 * one at a time under notes that were all already readable, which says the wrong thing
 * about which note is being read: none of them, all of them.
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
const STEP_LIVE: Record<BandState, string> = {
  pending: "lg:text-dim/60",
  attached: "lg:text-copper-line/80",
  active: "lg:text-copper-line",
};

interface LineMark {
  state: BandState;
  /** Printed once per run, on the line the annotation's leader arrives at. */
  step?: number;
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
): Map<number, LineMark> {
  const marks = new Map<number, LineMark>();
  annotations.forEach((annotation, index) => {
    const state: BandState =
      index === active ? "active" : index < shown ? "attached" : "pending";
    for (let line = annotation.from; line <= annotation.to; line += 1) {
      marks.set(line, { state, ...(line === annotation.from ? { step: annotation.step } : {}) });
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
}: {
  lines: readonly YamlLine[];
  annotations: readonly ResolvedAnnotation[];
  /** How many steps have attached. Every one of them, in the static layout. */
  shown: number;
  /** The step being read, or -1 when there is no single one, which is the static case. */
  active: number;
  /** Whether the choreography is running, so the per-step marking is worth emitting. */
  live: boolean;
}) {
  const marks = markLines(annotations, shown, active);
  const gutter = String(lines.length).length;

  return (
    <div className="w-max min-w-full font-mono text-[12px]">
      {lines.map((line) => {
        const mark = marks.get(line.no);
        const state = mark?.state ?? "pending";
        const marked = mark !== undefined;
        return (
          <div
            key={line.no}
            className={cx(
              "flex items-center",
              marked && ROW_MARKED,
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
                "w-6 shrink-0 self-stretch select-none border-l-2 pl-1 text-[11px] leading-[18px] text-copper-line/80",
                marked ? RULE_MARKED : "border-transparent",
                marked && live && RULE_LIVE[state],
                marked && live && STEP_LIVE[state],
              )}
            >
              {mark?.step ?? ""}
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
