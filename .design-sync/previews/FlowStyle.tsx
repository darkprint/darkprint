import { FlowStyle } from "darkprint";

/* FlowStyle paints nothing itself: it is a <style> tag carrying the luminous-flow reveal
   rule (FLOW_CSS in components/viz/flow.ts), which only does anything once an svg carries
   `data-viz-flow` + `data-viz-labels` and a group inside it carries `data-viz-reveal`. That
   is exactly how `FlowScene` mounts it, so the cells below reproduce that markup rather than
   inventing a new one. A hover state cannot render statically, so the right glyph is shown
   in its rest state — opacity:0 on its label — which is the one FlowStyle governs. */

export const RevealRule = () => (
  <>
    <FlowStyle />
    <svg
      viewBox="0 0 320 120"
      className="block h-auto w-full"
      role="img"
      aria-label="Two lit nodes: one label always shown, one waiting for a pointer"
      fill="none"
      data-viz-flow=""
      data-viz-labels="hover"
    >
      <g data-viz-reveal="always" transform="translate(80 60)">
        <circle r="13" fill="var(--color-cyan)" opacity="0.9" />
        <circle r="16.5" fill="none" stroke="var(--color-cyan)" strokeWidth="1" opacity="0.5" />
        <text data-viz="label" y="34" textAnchor="middle" fontSize="11" fill="var(--color-fg)">
          planner (always)
        </text>
      </g>
      <g data-viz-reveal="hover" transform="translate(240 60)">
        <circle r="13" fill="var(--color-violet)" opacity="0.9" />
        <circle r="16.5" fill="none" stroke="var(--color-violet)" strokeWidth="1" opacity="0.5" />
        <text data-viz="label" y="34" textAnchor="middle" fontSize="11" fill="var(--color-fg)">
          review gate (hover)
        </text>
      </g>
    </svg>
    <p className="mt-2 font-mono text-[11px] text-dim">
      The right label sits at opacity:0 until a pointer or focus finds it. FlowStyle is the
      rule that hides it.
    </p>
  </>
);

/** Without `data-viz-labels="hover"` on the scene, both reveal modes render open. */
export const AlwaysOpen = () => (
  <>
    <FlowStyle />
    <svg
      viewBox="0 0 320 120"
      className="block h-auto w-full"
      role="img"
      aria-label="Two lit nodes, both labels shown"
      fill="none"
      data-viz-flow=""
      data-viz-labels="always"
    >
      <g data-viz-reveal="always" transform="translate(80 60)">
        <circle r="13" fill="var(--color-cyan)" opacity="0.9" />
        <circle r="16.5" fill="none" stroke="var(--color-cyan)" strokeWidth="1" opacity="0.5" />
        <text data-viz="label" y="34" textAnchor="middle" fontSize="11" fill="var(--color-fg)">
          planner
        </text>
      </g>
      <g data-viz-reveal="hover" transform="translate(240 60)">
        <circle r="13" fill="var(--color-violet)" opacity="0.9" />
        <circle r="16.5" fill="none" stroke="var(--color-violet)" strokeWidth="1" opacity="0.5" />
        <text data-viz="label" y="34" textAnchor="middle" fontSize="11" fill="var(--color-fg)">
          review gate
        </text>
      </g>
    </svg>
  </>
);
