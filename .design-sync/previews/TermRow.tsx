import { TermColumnHeader, TermRow } from "darkprint";

/* A leaf: TermRow lays out on the column tracks TermColumnHeader (and the sibling row's
   own hairline) establishes, so the true render is the header plus a couple of rows,
   the way `TermTable`/`TermTree` actually mount it. Real terms, lib/core/ontology/core.ts
   §3 risk markers, with the configured weights from lib/core/config.ts. */

/** A root risk marker and two of its weighted children, the `showWeight` column on. */
export const RiskMarkers = () => (
  <div className="panel overflow-hidden">
    <div className="px-5 py-5">
      <TermColumnHeader showWeight />
      <ul className="divide-y divide-line">
        <li>
          <TermRow
            showWeight
            root
            term={{
              id: "execution-risk",
              kind: "risk-marker",
              label: "Execution risk",
              description:
                "The abstract category for markers about running code the blueprint did not fix in advance.",
              since: "0.1.0",
            }}
          />
        </li>
        <li>
          <TermRow
            showWeight
            term={{
              id: "arbitrary-code-execution",
              kind: "risk-marker",
              label: "Arbitrary code execution",
              description: "The node can run code or shell commands that were not decided in advance.",
              broader: "execution-risk",
              since: "0.1.0",
            }}
          />
        </li>
        <li>
          <TermRow
            showWeight
            term={{
              id: "unbounded-loop",
              kind: "risk-marker",
              label: "Unbounded loop",
              description: "The node sits in a cycle with no iteration cap and no exit condition.",
              since: "0.1.0",
            }}
          />
        </li>
      </ul>
    </div>
  </div>
);

/** The five phases, flat and closed (doc 3 §2), no weight column. */
export const Phases = () => (
  <div className="panel overflow-hidden">
    <div className="px-5 py-5">
      <TermColumnHeader />
      <ul className="divide-y divide-line">
        <li>
          <TermRow
            root
            term={{
              id: "planning",
              kind: "phase",
              label: "Planning",
              description: "From the request to a plan and the acceptance criteria.",
              since: "0.1.0",
            }}
          />
        </li>
        <li>
          <TermRow
            root
            term={{
              id: "implementation",
              kind: "phase",
              label: "Implementation",
              description: "From the plan to the artefact.",
              since: "0.1.0",
            }}
          />
        </li>
        <li>
          <TermRow
            root
            term={{
              id: "testing",
              kind: "phase",
              label: "Testing",
              description: "Runs the checks and produces the evidence.",
              since: "0.1.0",
            }}
          />
        </li>
      </ul>
    </div>
  </div>
);
