import { Logo } from "darkprint";

/** The mark redraws itself per size — `rungFor` picks the drawing, so a sweep is the story. */
export const Sizes = () => (
  <div className="flex items-end gap-6">
    <Logo size={24} title="DarkPrint" />
    <Logo size={48} title="DarkPrint" />
    <Logo size={96} title="DarkPrint" />
    <Logo size={192} title="DarkPrint" />
  </div>
);

/** The two grounds it is drawn for. */
export const Grounds = () => (
  <div className="flex gap-6">
    <div className="rounded bg-void p-5">
      <Logo size={96} ground="dark" title="DarkPrint on the dark ground" />
    </div>
    <div className="rounded bg-blueprint p-5">
      <Logo size={96} ground="sheet" title="DarkPrint on the blueprint sheet" />
    </div>
  </div>
);
