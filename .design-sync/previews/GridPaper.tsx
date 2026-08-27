import { GridPaper } from "darkprint";

/* GridPaper is `absolute` and paints nothing of its own dimensions, so every cell needs a
   sized, `relative` ground to sit inside — the same two masks the site itself draws with
   (`Hero.tsx`'s GRID_MASK, `GridBand.tsx`'s GRID_CLEARING), not invented ones, because the
   clearing's geometry is tuned to the box it sits in. The ground's own height is an inline
   style rather than a Tailwind class: this DS bundle's CSS is compiled once from the real
   app's own source, so a size utility with no call site there (`h-72` has none) never
   reaches the sheet and the box silently collapses to 0. */

const GRID_MASK = "radial-gradient(ellipse at 50% 54%, black, transparent 74%)";
const GRID_CLEARING = "radial-gradient(ellipse at 50% 30%, black, transparent 88%)";

/** The hero's own ground: a centred clearing over a full box. */
export const HeroGround = () => (
  <div
    className="relative overflow-hidden rounded-lg border border-line bg-void"
    style={{ height: 280 }}
  >
    <GridPaper mask={GRID_MASK} className="inset-0" />
  </div>
);

/** A band's clearing: the paper only occupies the top strip, the way `GridBand` uses it. */
export const BandClearing = () => (
  <div
    className="relative overflow-hidden rounded-lg border border-line bg-void"
    style={{ height: 280 }}
  >
    <GridPaper mask={GRID_CLEARING} className="inset-x-0 top-0 h-40" />
  </div>
);
