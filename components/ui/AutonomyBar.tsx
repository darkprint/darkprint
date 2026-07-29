import type { AutonomyLevel } from "@/lib/types";
import { cx } from "@/lib/format";

/* ============================================================
   The segmented autonomy gauge — a deliberate, documented exception
   to "no autonomy ordinal on any user-facing surface" (PROJECT.md,
   doc 2 §1.1). See docs/superpowers/specs/2026-07-29-visual-polish-design.md
   §1 for the full reasoning and docs/superpowers/plans/2026-07-29-visual-polish.md
   Task 4 for where the rest of the codebase notes this amendment.

   AutonomyMeter.tsx's inline row is untouched and keeps the
   no-ordinal behavior; this is a separate, additive element.
   ============================================================ */

const SEGMENT_COUNT = 4;

/** One color per level, fixed — segment N is always this color when filled, regardless
    of which level the blueprint actually reached. */
const LEVEL_COLOR: Record<AutonomyLevel, string> = {
  1: "var(--color-violet)",
  2: "var(--color-amber)",
  3: "var(--color-cyan)",
  4: "var(--color-emerald)",
};

const SEGMENTS = [1, 2, 3, 4] as const satisfies readonly AutonomyLevel[];

export interface AutonomyBarProps {
  /** 1-4. Segments 1..level render filled; the rest render dim/neutral. */
  level: AutonomyLevel;
  /** The class name in title case, e.g. "Closed-loop" — for the accessible name only. */
  label: string;
  className?: string;
}

/**
 * A thin, 4-segment gauge for the card top: which segments are filled says the level.
 *
 * Purely decorative (`aria-hidden` on the wrapper): `role="img"` is a
 * children-presentational role, so a nested `aria-label` would have been the only
 * thing assistive tech ever reached, and the sr-only span that existed only to carry
 * text for `plainText()` in the original test also became the DOM's first child,
 * which broke `first:rounded-l-sm` on the actual first segment (it matched the
 * invisible span instead). `AutonomyMeter`, which sits right below this in
 * `ContentCard.tsx`, already announces the class textually, so this bar duplicating
 * that announcement would be redundant for assistive tech even if it were exposed.
 * `title` stays for a mouse-hover tooltip — harmless on an aria-hidden element.
 */
export function AutonomyBar({ level, label, className }: AutonomyBarProps) {
  const accessibleName = `Autonomy class ${label}, level ${level} of ${SEGMENT_COUNT}`;

  return (
    <div aria-hidden title={accessibleName} className={cx("flex gap-0.5", className)}>
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          className="h-1.5 flex-1 first:rounded-l-sm last:rounded-r-sm"
          style={{
            background: segment <= level ? LEVEL_COLOR[segment] : "var(--color-line)",
          }}
        />
      ))}
    </div>
  );
}
