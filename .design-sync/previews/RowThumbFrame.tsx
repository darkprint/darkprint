import { ContentRow, RowThumbFrame } from "darkprint";

/**
 * `RowThumbFrame` is `ContentRow`'s zone-1 wrapper (`components/ui/ContentRow.tsx`): a
 * bordered, graph-paper-backed box that holds nothing but a `GraphThumbnail`. It never
 * mounts on its own, so this is the only render of it that is true: the whole row, the
 * archive's own starter-blueprint topology inside the frame.
 */
const starterGraph = {
  nodes: [
    { id: "planner", kind: "planner", label: "Spec Planner", cardId: "spec-planner", position: { x: 0, y: 0 } },
    { id: "builder", kind: "executor", label: "Code Builder", cardId: "code-builder", position: { x: 0, y: 180 } },
    { id: "tester", kind: "verifier", label: "Acceptance Tester", cardId: "acceptance-tester", position: { x: 200, y: 90 } },
    { id: "debugger", kind: "retry", label: "Targeted Debugger", cardId: "targeted-debugger", position: { x: 400, y: 180 } },
    { id: "deployer", kind: "ship", label: "Release Gate", cardId: "release-gate", position: { x: 400, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "planner", target: "tester", label: "acceptance criteria", variant: "flow" },
    { id: "e2", source: "builder", target: "tester", label: "build", variant: "flow" },
    { id: "e3", source: "tester", target: "debugger", label: "failure evidence", variant: "fallback" },
    { id: "e4", source: "debugger", target: "tester", label: "patch", variant: "flow" },
    { id: "e5", source: "tester", target: "deployer", label: "approved build", variant: "flow" },
  ],
};

const contributions = starterGraph.nodes.map((n) => ({
  nodeId: n.id,
  ref: `${n.cardId}@1.0.0`,
  name: n.label,
  requiresHuman: false,
  resolved: true,
}));

const orin = { username: "orin", displayName: "Orin", avatarHue: 192, validator: true };

const starter = {
  kind: "blueprint",
  ownerHandle: "orin",
  slug: "starter-software-factory",
  title: "Starter Software Factory",
  summary:
    "The canonical five-node factory: plan, build, test, debug, release, and the one edge it deliberately does not have.",
  tags: ["starter", "tutorial", "isolation", "software"],
  author: orin,
  autonomy: {
    autonomyClass: "closed-loop",
    label: "Closed-loop",
    isDarkFactory: true,
    level: 4,
    blurb: "No node in this graph waits for a person, and it covers all five lifecycle phases.",
  },
  graph: starterGraph,
  requiredTools: [],
  updatedAt: "2026-07-28",
  analysis: {
    autonomy: { contributions },
    // `ContentRow`'s zone 3 reads this straight off `item.analysis` (`CoverageStrip`), so
    // the fixture needs it even though `ContentCard`'s own tile never touches the field.
    phaseCoverage: {
      covered: ["planning", "implementation", "testing", "debugging", "deployment"],
      missing: [],
    },
  },
};

/** `/blueprints`'s lead row shape: the frame at row scale, wider and taller than the tile's. */
export const InRow = () => <ContentRow item={starter as never} forks={3} />;

/**
 * `/u/<owner>`'s own row shell draws the frame dashed for a bundle with no graph to show
 * (`components/profile/OwnedBundles.tsx`) — the site's register for "nothing lives here
 * yet" over a drawing this row genuinely does not have. The row around it is reproduced
 * here rather than imported: `OwnedBundles` is a whole shelf component, not a reusable
 * row, so this is that row's own zone-1 + zone-2 shape at the scale it actually renders.
 */
export const EmptyDraftRow = () => (
  <div className="grid grid-cols-[380px_minmax(0,1fr)] items-center gap-6 rounded-lg border border-line bg-surface p-4">
    <RowThumbFrame className="flex items-center justify-center border-dashed">
      <span className="px-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        no graph drawn
      </span>
    </RowThumbFrame>
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-display text-lg font-semibold text-fg">adversarial-consensus-line</span>
      <span className="font-mono text-[11px] text-dim">private · never released</span>
    </div>
  </div>
);
