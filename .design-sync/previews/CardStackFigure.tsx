import { CardStackFigure } from "darkprint";

/* `code-builder@1.0.0`, the card `/what-a-blueprint-is` and the landing both draw off the
   starter blueprint's own archive entry (content/cards/code-builder@1.0.0.yaml). */
const codeBuilder = {
  id: "code-builder",
  name: "Code Builder",
  type: "agent",
  phases: ["implementation"],
  action:
    "Work through the build brief and emit the source it describes, adding nothing the brief does not ask for.",
  spec: "A build brief arrives with the run: an ordered list of steps, each naming the file or module it touches and what should exist once it is done.",
  model: "claude-sonnet-5",
  tools: [],
  mcp: ["filesystem"],
  skill: "skills/code-builder.md",
  params: {},
  inputs: [
    {
      name: "brief",
      type: "plan",
      description: "The ordered build steps the run was instantiated with, the only thing this node sees.",
    },
  ],
  outputs: [
    {
      name: "build",
      type: "code",
      description: "One complete, compiling change implementing the brief, with no commentary attached.",
    },
  ],
  dependencies: [],
  cannot: ["acceptance-criteria", "read the checks the work will be run against"],
  requiresHuman: false,
  riskMarkers: [],
  version: "1.0.0",
  author: "orin",
  ontologyVersion: "0.1.0",
};

/** `/what-a-blueprint-is`'s placement: a 19rem card sitting beside a column of prose. */
export const Inline = () => <CardStackFigure card={codeBuilder} nodes={5} />;

/** The landing's placement: a whole pinned stage, the card blown up with the deck read as a file. */
export const Stage = () => <CardStackFigure card={codeBuilder} nodes={5} size="stage" />;
