import { cx } from "@/lib/format";

/** A small, plain "not live yet" marker — amber, never the alarm/signal color, since
    this states a timeline fact and not a defect. Doc 2 §0.4: used wherever a surface
    describes something that does not exist yet. */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-amber",
        className,
      )}
    >
      Coming soon
    </span>
  );
}
