import { Pinned } from "darkprint";

/* `app/u/[username]/page.tsx` mounts one: `<Pinned items={pinned} />`. A pin resolves to
   either a whole blueprint or a whole node card (`PinnedItem`'s two-member union), and the
   real page always draws two side by side, so both fixtures are built full rather than
   trimmed to what one card variant reads. */

const blueprint = {
  kind: "blueprint" as const,
  slug: "starter-software-factory",
  title: "Starter Software Factory",
  summary:
    "The canonical five-node factory: plan, build, test, debug, release, and the one edge it deliberately does not have.",
  tags: ["starter", "tutorial", "isolation", "software"],
  author: { username: "orin", displayName: "Orin Solace", avatarHue: 190, validator: true },
  autonomy: {
    autonomyClass: "closed-loop" as const,
    label: "Closed-loop",
    isDarkFactory: true,
    level: 4 as const,
    blurb: "No node in this graph waits for a person.",
  },
  votes: 58,
  analysis: {
    autonomy: {
      contributions: [
        { nodeId: "planner", ref: "spec-planner@1.0.0", name: "Spec Planner", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "builder", ref: "code-builder@1.0.0", name: "Code Builder", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "tester", ref: "acceptance-tester@1.0.0", name: "Acceptance Tester", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "debugger", ref: "targeted-debugger@1.0.0", name: "Targeted Debugger", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
        { nodeId: "deployer", ref: "release-gate@1.0.0", name: "Release Gate", requiresHuman: false, resolved: true, explanation: "Runs unattended." },
      ],
    },
  },
};

const nodeRecord = {
  ref: "code-builder@1.0.0",
  id: "code-builder",
  version: "1.0.0",
  card: {
    name: "Code Builder",
    action: "Work through the build brief and emit the source it describes, adding nothing the brief does not ask for.",
  },
};

/** The archive's own pair: a blueprint and a node card, side by side. */
export const Mixed = () => (
  <Pinned
    items={[
      { kind: "blueprint", blueprint },
      { kind: "node", record: nodeRecord, typeLabel: "Agent", usedIn: 6, support: 21 },
    ]}
  />
);

const secondBlueprint = {
  ...blueprint,
  slug: "guarded-merge-bot",
  title: "Guarded Merge Bot",
  summary: "Six blocks: nothing merges without a passing check and a signed release tag.",
  tags: ["merge", "release", "software"],
  votes: 14,
  autonomy: {
    autonomyClass: "supervised" as const,
    label: "Supervised",
    isDarkFactory: false,
    level: 2 as const,
    blurb: "One node in this graph waits for a person.",
  },
};

/** Two blueprint pins, the other shape a builder's shelf can take. */
export const TwoBlueprints = () => (
  <Pinned items={[{ kind: "blueprint", blueprint }, { kind: "blueprint", blueprint: secondBlueprint }]} />
);
