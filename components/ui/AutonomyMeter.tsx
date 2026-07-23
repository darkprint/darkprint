import type { AutonomyInfo } from "@/lib/types";
import { cx } from "@/lib/format";

const LEVEL_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: "var(--color-dim)",
  2: "var(--color-amber)",
  3: "var(--color-cyan)",
  4: "var(--color-emerald)",
};

/** Four-segment autonomy gauge (1–4) with label. */
export function AutonomyMeter({
  autonomy,
  size = "md",
  showLabel = true,
  className,
}: {
  autonomy: AutonomyInfo;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const color = LEVEL_COLOR[autonomy.level];
  const segH = size === "sm" ? "h-1.5" : "h-2";
  const segW = size === "sm" ? "w-5" : "w-7";
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cx("rounded-full transition-colors", segH, segW)}
            style={{ background: i <= autonomy.level ? color : "var(--color-line)" }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="font-mono text-xs" style={{ color }}>
          A{autonomy.level}
          <span className="ml-1 text-muted">· {autonomy.label}</span>
        </span>
      )}
    </div>
  );
}
