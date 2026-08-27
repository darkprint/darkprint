import { FigureFrame } from "darkprint";

/** The frame's whole job is the caption under a drawing, so the drawing is real. */
export const CaptionedDrawing = () => (
  <FigureFrame caption="Four node cards: one branches to two, and both come back together at a fourth.">
    <svg viewBox="0 0 260 96" className="block h-auto w-full" role="img" aria-label="A branching blueprint" fill="none">
      <rect x="4" y="34" width="52" height="28" rx="4" stroke="var(--color-blueprint-line)" />
      <rect x="100" y="6" width="52" height="28" rx="4" stroke="var(--color-blueprint-line)" />
      <rect x="100" y="62" width="52" height="28" rx="4" stroke="var(--color-blueprint-line)" />
      <rect x="196" y="34" width="52" height="28" rx="4" stroke="var(--color-blueprint-line)" />
      <path d="M56 48 L100 20 M56 48 L100 76 M152 20 L196 48 M152 76 L196 48" stroke="var(--color-blueprint-line)" strokeOpacity="0.6" />
    </svg>
  </FigureFrame>
);
