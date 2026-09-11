import { PanelHeading } from "darkprint";

/**
 * The tier between a section title and a mono label: a genuine heading drawn at panel
 * scale. Sweeps `as`/`size`, the two axes real callers actually vary — `/skill`'s numbered
 * spine asks for `h2` at `2xl`, everything else takes the `h3` default.
 */

/** `ScoringModel`'s own panel titles: default `h3` at the default `xl` size. */
export const DefaultPanel = () => <PanelHeading>Risk markers</PanelHeading>;

/** `SkillSetup`'s numbered step, `as="h2"` for the outline with `size="2xl"` for the screen. */
export const NumberedStep = () => (
  <PanelHeading as="h2" size="2xl">
    1. Connect the runtime
  </PanelHeading>
);
