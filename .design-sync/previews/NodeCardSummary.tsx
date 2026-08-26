import { NodeCardSummary } from "darkprint";

const sol = {
  username: "sol-antczak",
  displayName: "Sol Antczak",
  avatarHue: 32,
  validator: true,
  bio: "Validator. Writes the static analyzers that grade autonomy so you don't have to trust the README.",
};

const mara = {
  username: "mara-veil",
  displayName: "Mara Veiga",
  avatarHue: 268,
  validator: true,
  bio: "Orchestration researcher. Builds closed-loop agent lines and breaks them for a living.",
};

/* Real archive card, content/cards/merge-executor@1.0.0.yaml: two risk markers and a
   tool, the busiest tile the shelf draws. */
export const MergeExecutor = () => (
  <NodeCardSummary
    node={{
      id: "merge-executor",
      version: "1.0.0",
      ref: "merge-executor@1.0.0",
      name: "Merge Executor",
      action:
        "Merge the approved head into the base under the configured strategy and emit the resulting commit, refusing to act on anything but a maintainer approval.",
      type: "tool",
      typeLabel: "Tool",
      phases: [{ id: "deployment", label: "Deployment" }],
      tools: ["git"],
      requiresHuman: false,
      riskMarkers: ["Secret access", "Unchecked write"],
      usedIn: 1,
      author: sol,
    }}
  />
);

/* content/cards/maintainer-approval@1.0.0.yaml, `showType={false}` — the placement
   `NodeBrowser` uses inside a type-grouped run, where the heading above already says
   "Human gate". */
export const HumanGateInAGroup = () => (
  <NodeCardSummary
    showType={false}
    node={{
      id: "maintainer-approval",
      version: "1.0.0",
      ref: "maintainer-approval@1.0.0",
      name: "Maintainer Approval",
      action:
        "Hold the run at the merge boundary until a maintainer with write rights reads the green test report and approves.",
      type: "human-gate",
      typeLabel: "Human gate",
      phases: [{ id: "deployment", label: "Deployment" }],
      tools: ["human-review"],
      requiresHuman: true,
      riskMarkers: [],
      usedIn: 1,
      author: sol,
    }}
  />
);

/* lib/data/cards.ts's seeded private card, restated as the resolved NodeSummary shape
   OwnedCards passes: unpublished, so usedIn is honestly 0. */
export const PrivateCard = () => (
  <NodeCardSummary
    node={{
      id: "oncall-severity-router",
      version: "v0.1.0",
      ref: "oncall-severity-router@v0.1.0",
      name: "On-call Severity Router",
      action:
        "Score an incoming page against the severity rubric and pick which escalation class it enters, replacing the fixed on-call rotation.",
      type: "decision",
      typeLabel: "Decision",
      phases: [{ id: "planning", label: "Planning" }],
      tools: [],
      requiresHuman: false,
      riskMarkers: [],
      usedIn: 0,
      author: mara,
      visibility: "private",
    }}
  />
);
