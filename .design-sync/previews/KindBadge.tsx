import { KindBadge } from "darkprint";

/** The three content kinds a card can carry, side by side: the whole enum this badge draws. */
export const AllKinds = () => (
  <div className="flex flex-wrap items-center gap-3">
    <KindBadge kind="blueprint" />
    <KindBadge kind="node" />
    <KindBadge kind="ontology" />
  </div>
);

/** As it sits on a gallery tile: beside the autonomy meter, in the card body's header row. */
export const OnATile = () => (
  <div className="flex w-64 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-md border border-line bg-surface p-3">
    <KindBadge kind="blueprint" />
    <span className="font-mono text-[11px] text-dim">guarded-merge-bot</span>
  </div>
);
