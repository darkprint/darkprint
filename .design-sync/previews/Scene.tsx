import { Scene } from "darkprint";

/* `Scene` is the bare `<svg>` `Sheet.tsx` documents as its own partner: "Scene is the
   <svg> itself... a scene author has to remember the four attributes". No page mounts the
   bare pair directly (real pages reach for `FlowScene`, which wraps the identical job with
   the reveal stylesheet added), so this is the leaf-needs-a-parent case: composed here on
   drafting paper the way its own docblock frames it, plain shapes rather than the luminous
   glyphs `FlowScene` owns.

   The viewBox is sized close to the card's own rendered width (~580 CSS px) rather than a
   small round number: `Scene` scales its contents to fill the box (`preserveAspectRatio`
   is implicit at 1:1 through `w-full`/`aspectRatio`), so a narrow viewBox blows every glyph
   up by the ratio between the two — a 220-unit box in a 580px card drew 28px labels. */

export const TwoNode = () => (
  <div className="bp-grid rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-6">
    <Scene width={560} height={180} label="Intake handing a request to a planner">
      <circle cx="100" cy="90" r="13" fill="var(--color-cyan-bright)" />
      <circle cx="460" cy="90" r="13" fill="var(--color-cyan)" />
      <path d="M113 90 L440 90" stroke="var(--color-blueprint-line)" strokeWidth="1.6" />
      <path d="M440 90 L428 84 L428 96 Z" fill="var(--color-blueprint-line)" />
      <text x="100" y="122" textAnchor="middle" fontSize="11" fill="var(--color-blueprint-ink)">
        intake
      </text>
      <text x="460" y="122" textAnchor="middle" fontSize="11" fill="var(--color-blueprint-ink)">
        planner
      </text>
    </Scene>
  </div>
);

/** Denser: the starter blueprint's five-node pipeline, drawn as plain marks on a sheet. */
export const FiveNodePipeline = () => (
  <div className="bp-grid rounded-lg border border-blueprint-line/55 bg-blueprint-deep/60 p-6">
    <Scene width={580} height={160} label="Plan, build, test, debug, release, five nodes in a row">
      {[
        { x: 40, label: "planner" },
        { x: 165, label: "builder" },
        { x: 290, label: "tester" },
        { x: 415, label: "debugger" },
        { x: 540, label: "deployer" },
      ].map((n, i, arr) => (
        <g key={n.label}>
          <circle cx={n.x} cy={80} r="10" fill="var(--color-blueprint-line)" />
          <text x={n.x} y={108} textAnchor="middle" fontSize="10" fill="var(--color-blueprint-ink)">
            {n.label}
          </text>
          {i < arr.length - 1 && (
            <path
              d={`M${n.x + 11} 80 L${arr[i + 1].x - 11} 80`}
              stroke="var(--color-blueprint-line)"
              strokeWidth="1.4"
            />
          )}
        </g>
      ))}
    </Scene>
  </div>
);
