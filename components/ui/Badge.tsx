import type { MetricSource, ContentKind } from "@/lib/types";
import { METRIC_SOURCE_META, cx } from "@/lib/format";

/** Generic pill with a colored dot. */
export function Badge({
  children,
  color = "var(--color-muted)",
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/**
 * How a metric was scored (auto / reported / community).
 *
 * The word is the badge — the dot only repeats it in colour — and for the middle source
 * the word is *reported*, per doc 1 §8: DarkPrint never watches an execution, so a cost
 * or a duration is what a runner sent back, not something the platform measured. The
 * `title` is a hint for a mouse; the visually-hidden prefix is what makes "reported"
 * parse as a provenance rather than as part of the metric name when the badge is read
 * out next to its label and value.
 */
export function SourceBadge({ source }: { source: MetricSource }) {
  const meta = METRIC_SOURCE_META[source];
  return (
    <span
      // `rounded-sm` rather than a bare `rounded`: both compile to the same 5px token now
      // that app/globals.css sets `--radius: var(--radius-sm)`, but the named step says
      // which rung of the four-step ladder (sm 5 · md 8 · lg 12 · xl 18) this is on, and
      // it can be grepped. Neither of these badges carries a hover, so neither takes a
      // press: nothing here is pressable.
      className="inline-flex items-center gap-1 rounded-sm font-mono text-[11px] uppercase tracking-[0.12em]"
      style={{ color: meta.color }}
      title={meta.blurb}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      <span className="sr-only">score source: </span>
      {meta.short}
    </span>
  );
}

const KIND_META: Record<ContentKind, { label: string; color: string }> = {
  blueprint: { label: "Blueprint", color: "var(--color-cyan)" },
  node: { label: "Node", color: "var(--color-amber)" },
  ontology: { label: "Ontology", color: "var(--color-violet)" },
};

export function KindBadge({ kind }: { kind: ContentKind }) {
  const meta = KIND_META[kind];
  return <Badge color={meta.color}>{meta.label}</Badge>;
}
