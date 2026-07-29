import type { AutonomyContribution } from "@/lib/core";
import type { AutonomyInfo } from "@/lib/types";
import { HUMAN_PRESENCE_MARK, cx } from "@/lib/format";

/**
 * The autonomy class, stated.
 *
 * Doc 2 §1.1 governs every pixel here. What the meter shows is a description of a design
 * choice, so this component:
 *
 * - names the class ("Supervised") and prints no number at all. There is no four-segment
 *   gauge, no fill, no greyed remainder, nothing that reads as *2 out of 4* with a gap
 *   left to close. The band behind the class is an ordinal the engine keeps for sorting
 *   and it is never rendered, so the only number a reader meets on this site stays the
 *   1-to-5 organisational maturity ladder, which is a different scale about a different
 *   subject;
 * - carries no class → colour ramp. The old one went dim → amber → cyan → emerald, which
 *   is the visual grammar of a warning climbing to a pass, i.e. a verdict painted onto a
 *   description. Every class now renders identically;
 * - spends its remaining space on **where the people are**, which is the thing a reader
 *   evaluating the blueprint actually needs.
 *
 * `isDarkFactory` is rendered here as a second classification and in the same chrome as
 * the first. It says the graph has no human node, the way "acyclic" says a graph has no
 * cycle. The token is deliberately the plainest thing on the row: same border, same
 * surface, same type size as the class beside it, no gold, no ribbon, no rank. A graph
 * where a person acts gets a statement of equal weight in its place, naming the nodes,
 * which is more information rather than less. Neither reading is an award and nothing on
 * this site sorts on either.
 *
 * Compact by construction: it appears in the gallery grid, in the blueprint header and in
 * the upload preview, so it is one line of text at `sm` and one short line at `md`.
 *
 * ── The one named exception ──
 * Added 2026-07-29: `components/ui/AutonomyBar.tsx` renders a *separate* component — a
 * segmented gauge on the blueprint card's top edge and the `/build` score panel — that
 * deliberately does show level as a filled/empty 4-segment bar. It is not rendered by
 * this file and does not change anything below: this component's own row (the class
 * label, the dark-factory token, "N nodes wait for a person") keeps the no-ordinal
 * behavior described above, unchanged. See
 * `docs/superpowers/specs/2026-07-29-visual-polish-design.md` §1 for the reasoning.
 */

/**
 * The three-way partition of the engine's contributions.
 *
 * `total − autonomous` is **not** the number of nodes with a person in them: a node whose
 * card is missing from the bundle is neither unattended nor staffed (`resolved: false`),
 * and subtracting would print an intervention marker where nobody is. Read the flags.
 */
function partition(contributions: readonly AutonomyContribution[]): {
  people: AutonomyContribution[];
  undescribed: AutonomyContribution[];
} {
  const people: AutonomyContribution[] = [];
  const undescribed: AutonomyContribution[] = [];
  for (const c of contributions) {
    if (c.requiresHuman) people.push(c);
    else if (!c.resolved) undescribed.push(c);
  }
  return { people, undescribed };
}

/** "1 node waits for a person" / "3 nodes wait for a person". */
function waitPhrase(count: number): string {
  return count === 1 ? "1 node waits for a person" : `${count} nodes wait for a person`;
}

/** "1 node has no card in the bundle" — the third category, never folded into the second. */
function undescribedPhrase(count: number): string {
  return count === 1
    ? "1 node has no card in the bundle"
    : `${count} nodes have no card in the bundle`;
}

export function AutonomyMeter({
  autonomy,
  contributions,
  size = "md",
  className,
}: {
  autonomy: AutonomyInfo;
  /**
   * The engine's per-node reading, when the caller has it (`analysis.autonomy.contributions`).
   * With it the meter can say which nodes hand control back to a person, which is what
   * doc 2 §1.1 asks the indicator to show. Without it the class still states itself.
   */
  contributions?: readonly AutonomyContribution[];
  size?: "sm" | "md";
  /* `showLabel` is gone with the number it used to sit beside. It suppressed the class
     name on a tight row and left the band standing on its own; with the band unrendered
     that switch can only produce an empty token, and the class is the reading. No caller
     ever passed it. */
  className?: string;
}) {
  const { people, undescribed } = contributions
    ? partition(contributions)
    : { people: [], undescribed: [] };

  const names = people.map((c) => c.name).join(", ");
  // One string carries the whole reading for assistive tech and for a mouse, so the
  // compact variant can drop to a glyph and a count without dropping the meaning.
  const full = [
    `Autonomy class ${autonomy.label}.`,
    autonomy.isDarkFactory
      ? "Classed a dark factory: no node in this graph waits for a person."
      : undefined,
    contributions === undefined
      ? undefined
      : people.length === 0
        ? "No node waits for a person."
        : `${waitPhrase(people.length)}: ${names}.`,
    undescribed.length > 0 ? `${undescribedPhrase(undescribed.length)}.` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const compactSize = size === "sm";

  return (
    <span
      className={cx(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-mono",
        compactSize ? "text-[11px]" : "text-xs",
        className,
      )}
      title={full}
    >
      {/* The class. A bordered token, not a track: it has no empty half. */}
      <span className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-0.5 text-fg">
        <span className="sr-only">Autonomy class </span>
        {autonomy.label}
      </span>

      {/* The other classification, in the same chrome as the first on purpose: it names
          a shape the graph has, and the moment it is drawn as a prize the blueprint next
          to it starts reading as a failed attempt at one. Glyph and words, no colour of
          its own. */}
      {autonomy.isDarkFactory && (
        <span className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-0.5 text-fg">
          <span aria-hidden>◼</span>
          dark factory
          <span className="sr-only">
            : no node in this graph waits for a person
          </span>
        </span>
      )}

      {/* Where the people are. Glyph and word both, never colour alone, and the same
          glyph the explainability panel and the node pages use for a human gate, so the
          count points at something the reader can find in the graph.

          The colour comes from `HUMAN_PRESENCE_MARK` and it is violet. This row used to
          be `text-signal`, the alarm colour the site spends on the criteria-leak marker
          and the error count, on the one component that puts the reading on the gallery
          grid and the blueprint header. A graph with nobody in it got a neutral token and
          a graph with somebody in it got an alarm beside it: the pass/fail pair doc 2
          §1.1 rules out, and the rule was already written down twice elsewhere. */}
      {contributions !== undefined && people.length > 0 && (
        <span
          className={cx("inline-flex items-center gap-1", HUMAN_PRESENCE_MARK.className)}
        >
          <span aria-hidden>{HUMAN_PRESENCE_MARK.glyph}</span>
          {compactSize ? (
            <>
              <span aria-hidden>{people.length}</span>
              <span className="sr-only">
                {waitPhrase(people.length)}: {names}
              </span>
            </>
          ) : (
            <>
              {waitPhrase(people.length)}
              <span className="text-muted">· {names}</span>
            </>
          )}
        </span>
      )}

      {/* A graph nobody has to attend says so in words at `md`, unless the dark factory
          token above has already said it. In a grid tile it says it by having nothing to
          point at, and the sentence stays for a screen reader. */}
      {contributions !== undefined && people.length === 0 && !autonomy.isDarkFactory && (
        <span className={cx("text-dim", compactSize && "sr-only")}>
          no node waits for a person
        </span>
      )}

      {/* Neither unattended nor staffed. Named rather than silently absorbed into one
          of the other two counts. */}
      {undescribed.length > 0 && !compactSize && (
        <span className="text-dim">
          <span aria-hidden>◌</span> {undescribedPhrase(undescribed.length)}
        </span>
      )}
    </span>
  );
}
