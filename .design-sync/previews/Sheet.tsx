import { Sheet } from "darkprint";

/** The default register, drawn on drafting paper: `BlueprintWalk`'s own frame around the
    landing's schematic, label along the top and a title block along the bottom. */
export const Blueprint = () => (
  <Sheet label="starter software factory" title="five nodes, five edges" note="1:1">
    <div className="flex h-40 items-center justify-center font-mono text-[11px] text-dim">
      the drawing goes here
    </div>
  </Sheet>
);

/** The copper register: the pole `Sheet` offers as the alternative to blueprint cyan. */
export const Copper = () => (
  <Sheet register="copper" label="node-card@1.0.0" title="interfaces" note="2 in · 1 out">
    <div className="flex h-40 items-center justify-center font-mono text-[11px] text-dim">
      the drawing goes here
    </div>
  </Sheet>
);

/** `paper={false}`, beat 2's case: the structure without the graticule or the corner ticks,
    for a figure that is a readout rather than a drawing of a blueprint. */
export const FlatDark = () => (
  <Sheet register="dark" paper={false} label="run readout" title="latency by node">
    <div className="flex h-32 items-center justify-center font-mono text-[11px] text-dim">
      no grid, no ticks
    </div>
  </Sheet>
);
