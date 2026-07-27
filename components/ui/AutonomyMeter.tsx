import type { AutonomyContribution } from "@/lib/core";
import type { AutonomyInfo } from "@/lib/types";
import { cx } from "@/lib/format";

/**
 * The autonomy band, stated.
 *
 * Doc 2 §1.1 governs every pixel here. The number is a description of a design choice,
 * not a grade, so this component:
 *
 * - names the band ("level 2 · Supervised") instead of implying a quantity. There is no
 *   four-segment gauge, no fill, no greyed remainder — nothing that reads as *2 out of 4*
 *   with a gap left to close;
 * - carries no level → colour ramp. The old one went dim → amber → cyan → emerald, which
 *   is the visual grammar of a warning climbing to a pass, i.e. a verdict painted onto a
 *   description. Every band now renders identically;
 * - spends its remaining space on **where the people are**, which is the thing a reader
 *   evaluating the blueprint actually needs, rather than on how far the graph sits from
 *   full autonomy.
 *
 * Compact by construction: it appears in the gallery grid, in the blueprint header and in
 * the upload preview, so it is one line of text at `sm` and one short line at `md`.
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
  showLabel = true,
  className,
}: {
  autonomy: AutonomyInfo;
  /**
   * The engine's per-node reading, when the caller has it (`analysis.autonomy.contributions`).
   * With it the meter can say which nodes hand control back to a person, which is what
   * doc 2 §1.1 asks the indicator to show. Without it the band still states itself.
   */
  contributions?: readonly AutonomyContribution[];
  size?: "sm" | "md";
  /** Show the band's name next to its number. Off only where the row is very tight. */
  showLabel?: boolean;
  className?: string;
}) {
  const { people, undescribed } = contributions
    ? partition(contributions)
    : { people: [], undescribed: [] };

  const names = people.map((c) => c.name).join(", ");
  // One string carries the whole reading for assistive tech and for a mouse, so the
  // compact variant can drop to a glyph and a count without dropping the meaning.
  const full = [
    `Autonomy level ${autonomy.level}, ${autonomy.label}.`,
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
      {/* The band. A bordered token, not a track: it has no empty half. */}
      <span className="inline-flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-0.5 text-fg">
        <span className="sr-only">Autonomy </span>
        level {autonomy.level}
        {showLabel && <span className="text-muted">· {autonomy.label}</span>}
      </span>

      {/* Where the people are. Glyph and word both, never colour alone — and the same
          ⏸ the schematic legend and the explainability panel use for a human gate, so
          the count points at something the reader can find in the graph. */}
      {contributions !== undefined && people.length > 0 && (
        <span className="inline-flex items-center gap-1 text-signal">
          <span aria-hidden>⏸</span>
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

      {/* A graph nobody has to attend says so in words at `md`; in a grid tile it says
          it by having nothing to point at, and the sentence stays for a screen reader. */}
      {contributions !== undefined && people.length === 0 && (
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
