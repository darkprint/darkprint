import { SourceBadge } from "darkprint";

/* `MetricBars`'s own row shape: a label at the left, the badge at the right. Real
   key/label/source triples off `lib/content/view.ts`'s `metricsFor` — autonomy is
   computed off the graph, cost is what a runner self-reported, efficacy is a community
   ballot. */
function Row({ label, source }: { label: string; source: "auto" | "reported" | "community" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      <SourceBadge source={source} />
    </div>
  );
}

/** Computed straight off the graph's own structure, no runner and no ballot involved. */
export const Auto = () => <Row label="Autonomy" source="auto" />;

/** Sent back by a runner after their own execution, never observed by DarkPrint. */
export const Reported = () => <Row label="Cost / time" source="reported" />;

/** A community ballot's aggregate, `VoteControl`'s own write target. */
export const Community = () => <Row label="Efficacy" source="community" />;
