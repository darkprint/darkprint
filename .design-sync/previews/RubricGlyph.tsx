import { RubricGlyph } from "darkprint";

/** A rule-and-step glyph with no text of its own; the card gives it a ground and a size. */
export const Glyph = () => (
  <div className="text-fg">
    <RubricGlyph />
  </div>
);

/** Dimmed, which is how it sits beside body copy rather than above it. */
export const Muted = () => (
  <div className="text-dim">
    <RubricGlyph />
  </div>
);
