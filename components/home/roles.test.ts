/* ============================================================
   `SectionRoles` claims its figure is the starter blueprint. This
   is what makes the claim checkable.

   The section's header comment said "every node, every edge and
   every label below is read off
   `content/blueprints/starter-software-factory/topology.dot`"
   while every one of them was a literal in the JSX with no test in
   sight. The values were right, and nothing would have said so
   after the next edit to the DOT. `components/hero/graph.test.ts`
   has done exactly this job for the hero's figure since it was
   written; this is the same job for the second figure that makes
   the same claim.

   The two arguments the drawing exists to make are checked against
   the archive as well, because both are enforced somewhere:
   the absent planner → builder edge against `cannot` on
   `code-builder@1.0.0`, and the loop's cap against
   `params.max_retries` on `targeted-debugger@1.1.0`.
   ============================================================ */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseDot } from "@/lib/core";

import {
  ROLE_ABSENCE,
  ROLE_BLUEPRINT,
  ROLE_BOXES,
  ROLE_LOOP_CAP,
  ROLE_WIRES,
  boxProps,
  roleBox,
  wireProps,
} from "./roles";

/** Repo root: this file is `<root>/components/home/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

const parsed = parseDot(read(ROLE_BLUEPRINT));

describe("the roles figure draws the starter blueprint", () => {
  it("parses the source it claims to draw", () => {
    // Everything below reads `parsed.graph`. A parse that failed would make each of them
    // vacuously true.
    expect(parsed.graph, `${ROLE_BLUEPRINT} did not parse`).toBeDefined();
    expect(parsed.graph?.nodes).toHaveLength(5);
    expect(parsed.graph?.edges).toHaveLength(5);
  });

  it("draws the DOT's nodes, in its order", () => {
    expect(ROLE_BOXES.map((box) => box.id)).toEqual(parsed.graph?.nodes.map((n) => n.id));
  });

  it("names the card each node pins, at the exact version", () => {
    expect(ROLE_BOXES.map((box) => box.card)).toEqual(
      parsed.graph?.nodes.map((n) => n.attrs.card),
    );
  });

  /**
   * The kind each disc is coloured by, held to the kind the registry resolves.
   *
   * `roles.ts` mirrors this rather than deriving it, so that the file stays plain data the
   * node suite can import. The mirror is only safe because of this case: `agentNodeKind`
   * reads a card's `type` through the ontology, so a card that changes type, or an ontology
   * edit that re-parents one, silently recolours the same node on `/blueprints` and would
   * leave the landing painting the old colour with nothing complaining.
   *
   * Resolved through `allBlueprints()` — the reader the gallery itself uses — rather than
   * by calling `agentNodeKind` here with hand-built arguments, because the position clause
   * that makes `deployer` a `ship` rather than a `tool` depends on the whole graph.
   */
  it("colours each disc by the kind the registry resolves for it", async () => {
    const { allBlueprints } = await import("@/lib/content");
    const starter = allBlueprints().find((bp) => bp.slug === "starter-software-factory");
    expect(starter, "the starter blueprint is not in the archive").toBeDefined();
    expect(ROLE_BOXES.map((box) => `${box.id}:${box.kind}`)).toEqual(
      starter?.graph.nodes.map((n) => `${n.id}:${n.kind}`),
    );
  });

  it("draws the DOT's edges, in its order", () => {
    expect(ROLE_WIRES.map((w) => `${w.source} -> ${w.target}`)).toEqual(
      parsed.graph?.edges.map((e) => `${e.source} -> ${e.target}`),
    );
  });

  it("labels each wire with what the DOT says it carries", () => {
    expect(ROLE_WIRES.map((w) => w.label)).toEqual(
      parsed.graph?.edges.map((e) => e.attrs.label),
    );
  });

  it("draws no edge the DOT does not write", () => {
    const drawn = new Set(ROLE_WIRES.map((w) => `${w.source} -> ${w.target}`));
    const written = new Set(parsed.graph?.edges.map((e) => `${e.source} -> ${e.target}`));
    expect([...drawn].filter((w) => !written.has(w))).toEqual([]);
  });
});

describe("the two arguments the figure makes are in the archive", () => {
  it("marks an absence the DOT really has", () => {
    const written = parsed.graph?.edges.map((e) => `${e.source} -> ${e.target}`) ?? [];
    expect(written).not.toContain(`${ROLE_ABSENCE.source} -> ${ROLE_ABSENCE.target}`);
    // Both ends are nodes, so the gap is a run that was not written rather than one that
    // could not have been.
    expect(ROLE_BOXES.map((b) => b.id)).toContain(ROLE_ABSENCE.source);
    expect(ROLE_BOXES.map((b) => b.id)).toContain(ROLE_ABSENCE.target);
  });

  it("names a prohibition the builder's card actually declares", () => {
    // The label on the dashed non-edge is the `cannot` entry that makes the absence a rule
    // the resolver holds the graph to rather than a convention somebody remembered.
    const builder = read(`content/cards/${roleBox(ROLE_ABSENCE.target).card}.yaml`);
    const cannot = /^cannot:\n((?:\s+-\s.*\n)+)/m.exec(builder)?.[1] ?? "";
    expect(cannot).toContain(ROLE_ABSENCE.prohibition);
  });

  it("quotes the cap the debugger's card declares", () => {
    const debuggerCard = read(`content/cards/${ROLE_LOOP_CAP.card}.yaml`);
    const declared = new RegExp(`^\\s+${ROLE_LOOP_CAP.param}:\\s*(\\d+)\\s*$`, "m").exec(
      debuggerCard,
    )?.[1];
    expect(declared, `${ROLE_LOOP_CAP.card} declares no ${ROLE_LOOP_CAP.param}`).toBeDefined();
    expect(Number(declared)).toBe(ROLE_LOOP_CAP.value);
  });

  it("hangs the cap on the node that declares it", () => {
    expect(roleBox("debugger").card).toBe(ROLE_LOOP_CAP.card);
  });
});

describe("the props the drawing is built from", () => {
  it("drops the version from the card id under each box", () => {
    expect(boxProps("builder")).toEqual({
      id: "builder",
      label: "Builder",
      sub: "code-builder",
    });
  });

  it("throws on a node or a wire the figure does not have", () => {
    // A missing lookup must fail loudly. Rendering `undefined` into a label would ship a
    // hole in the drawing and pass every assertion above.
    expect(() => roleBox("nobody")).toThrow(/no role box/);
    expect(() => wireProps("planner", "builder")).toThrow(/no role wire/);
  });
});

/* A fourth describe stood here: "the section says nothing about a blueprint that is not
   true of it". Both its cases read `components/home/SectionRoles.tsx`, which the author
   asked deleted on 2026-08-07 as one of four components mounted nowhere.

   They guarded a closing paragraph that claimed Guarded Merge Bot "uses the same five
   roles" — it has six nodes, no debugger, and no absent edge, so only the human gate ever
   survived the comparison. The paragraph is gone with the component and there is nothing
   on the site making that claim. Its sibling case asserted the DOT still writes
   `gate -> merge [label="human approve"]`; that is true and now says nothing, because no
   page reads it.

   What this file still holds is the part that matters: `ROLE_BOXES` and `ROLE_WIRES` are
   the DATA the landing's blueprint is placed from, and every case above checks them against
   `content/blueprints/starter-software-factory/`. That survives the component by design —
   `graph.ts` reads the data, not the section. */
