/* ============================================================
   The landing's update panel prints four things a reader can go
   and check: a card ref, two `cannot` lists, a bump level and the
   version it forces. Every one of them is computed, and this file
   is what keeps them computed rather than remembered.

   Two halves. `nextVersion` is arithmetic and is tested as such.
   The rest reads the real archive, because the panel's claims are
   claims about *this* content: that the card exists at the version
   named, that the prohibition it adds is not already there, that
   the entry names a core data type so the resolver enforces it,
   and that the published starter keeps the same rule by having no
   edge rather than by declaring one. Any of those going false
   turns a sentence on the landing into a false sentence, and the
   build is where that should surface.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";
import { allBlueprints, getNodeCard, nodeCardVersions } from "@/lib/content";

import {
  DEMO_CARD_ID,
  DEMO_CARD_VERSION,
  DEMO_PROHIBITION,
  nextVersion,
  tightenProhibition,
} from "./bump-demo";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

function demoCard() {
  const record = getNodeCard(DEMO_CARD_ID, DEMO_CARD_VERSION);
  expect(record, `the archive no longer carries ${DEMO_CARD_ID}@${DEMO_CARD_VERSION}`).toBeDefined();
  return record!.card;
}

describe("nextVersion", () => {
  it.each([
    ["1.0.0", "major", "2.0.0"],
    ["1.4.2", "major", "2.0.0"],
    ["1.4.2", "minor", "1.5.0"],
    ["1.4.2", "patch", "1.4.3"],
    ["1.4.2", "none", "1.4.2"],
  ] as const)("%s + %s = %s", (version, level, expected) => {
    expect(nextVersion(version, level)).toBe(expected);
  });

  it("drops a prerelease suffix, since the bumped version is a release", () => {
    expect(nextVersion("2.0.0-rc.1", "patch")).toBe("2.0.1");
  });

  it("has no successor for a version that is not semver", () => {
    expect(nextVersion("latest", "major")).toBeUndefined();
  });
});

describe("the edit the panel draws", () => {
  it("is an edit: the published card does not already declare it", () => {
    expect(demoCard().cannot).not.toContain(DEMO_PROHIBITION);
  });

  it("costs a major bump, and the engine gives one reason for it", () => {
    const demo = tightenProhibition(demoCard(), DEMO_PROHIBITION);
    expect(demo).toBeDefined();
    expect(demo!.level).toBe("major");
    // One cause, because `tightenProhibition` moves one field. A second reason here would
    // mean the panel is showing a verdict the drawing beside it does not account for.
    expect(demo!.reasons).toHaveLength(1);
    expect(demo!.reason).toBe(demo!.reasons[0]);
    expect(demo!.reason).toContain(DEMO_PROHIBITION);
    expect(demo!.reason).toContain("narrows what the node accepts");
  });

  it("lands on 2.0.0, and leaves every other field where it was", () => {
    const card = demoCard();
    const demo = tightenProhibition(card, DEMO_PROHIBITION)!;
    expect(demo.ref).toBe(`${DEMO_CARD_ID}@${DEMO_CARD_VERSION}`);
    expect(demo.nextVersion).toBe("2.0.0");
    expect(demo.nextRef).toBe(`${DEMO_CARD_ID}@2.0.0`);
    expect(demo.before).toEqual(card.cannot);
    expect(demo.after).toEqual([...card.cannot, DEMO_PROHIBITION]);
  });

  it("demonstrates nothing when the entry is already declared", () => {
    const card = demoCard();
    expect(tightenProhibition(card, card.cannot[0])).toBeUndefined();
  });
});

describe("what the panel says about the edit is true of the archive", () => {
  /**
   * The panel says the resolver enforces the new entry. That is only true because the
   * entry names a term in the data lattice — `lib/core/card/schema.ts` allows free text in
   * `cannot` too, and free text is a note to a reader rather than a rule the bundle
   * resolver holds an edge to.
   */
  it("adds a core data type rather than free text", () => {
    expect(ONTOLOGY.resolve(DEMO_PROHIBITION, "data-type")).toBeDefined();
  });

  /**
   * And the reason `report` is the interesting one to prohibit: it is the type the tester
   * emits its failure evidence on, so the edit names a document that exists in the same
   * factory rather than a hypothetical one.
   */
  it("names the type the starter's tester emits its evidence on", () => {
    const tester = getNodeCard("acceptance-tester", "1.0.0");
    expect(tester).toBeDefined();
    const evidence = tester!.card.outputs.find((port) => port.name === "evidence");
    expect(evidence?.type).toBe(DEMO_PROHIBITION);
  });

  /**
   * The panel's last sentence: a pin names an exact version, so nothing already published
   * moves. It is only worth saying while a published blueprint is in fact pinned to the
   * version being edited.
   */
  it("leaves a published blueprint pinned to the version the edit starts from", () => {
    const pinned = allBlueprints().filter((bp) =>
      bp.cardRefs.includes(`${DEMO_CARD_ID}@${DEMO_CARD_VERSION}`),
    );
    expect(pinned.map((bp) => bp.slug)).toContain("starter-software-factory");
  });

  /**
   * Honesty, doc 2 §2.5 and spec constraint 0.4: the panel draws a version that does not
   * exist. If the archive ever publishes one, the drawing stops being a fork the reader
   * makes and starts being a page describing something the site already did, and the copy
   * has to change with it.
   */
  it("draws a version the archive does not carry", () => {
    const published = nodeCardVersions(DEMO_CARD_ID).map((entry) => entry.version);
    expect(published).toContain(DEMO_CARD_VERSION);
    expect(published).not.toContain("2.0.0");
  });
});
