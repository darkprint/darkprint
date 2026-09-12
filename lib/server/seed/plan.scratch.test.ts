/* ============================================================
   T250 scratch — the contract-report instrument, not a deliverable.

   Two questions AC1 and the `ImportPlan` shape turn on, answered off
   the tree rather than from the section: do the digests the merged
   loader computes equal the ones each bundle's generated README prints,
   and does every file in the shared card library reach a bundle.

   Falsified: pointing `SCRATCH_MARK` at a marker the README does not
   carry makes `printed` undefined and reds all nine, so the equality
   is discriminating rather than two absents agreeing.
   ============================================================ */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { readContent, contentVocabulary } from "@/lib/content/read";

const MARK = process.env.SCRATCH_MARK ?? "bundle digest";

describe("T250 scratch: what the content tree already answers", () => {
  it("reproduces every digest the site prints today (AC1)", () => {
    const loaded = readContent();
    expect(loaded.length).toBe(16);
    for (const b of loaded) {
      const readme = readFileSync(`public/bundles/${b.slug}/README.md`, "utf8");
      const printed = new RegExp(`${MARK}\\s+(sha256:[0-9a-f]{64})`).exec(readme)?.[1];
      expect(printed, `${b.slug}: README prints no digest`).toBeTypeOf("string");
      expect(b.blueprint.digest, b.slug).toBe(printed);
    }
  });

  /**
   * Both directions, and only one of them is an equality now.
   *
   * A pin naming no file is still a broken archive, so that stays `[]`. A file no pin names
   * is a card published on its own, which the library is allowed to hold, so the unpinned
   * set is asserted to be EXACTLY the standalone ones rather than left unbounded: a card
   * quietly dropped out of a topology would otherwise land in this set and read as intended.
   */
  it("names a file for every pin, and pins every file except the standalone ones", () => {
    const pinned = new Set<string>();
    for (const b of readContent()) for (const n of b.blueprint.nodes) pinned.add(n.ref);
    const fileRefs = readdirSync("content/cards")
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, ""));
    expect(fileRefs.length).toBe(111);
    expect([...pinned].filter((r) => !fileRefs.includes(r))).toEqual([]);
    expect(fileRefs.filter((r) => !pinned.has(r)).sort()).toEqual([
      "dynamic-repriority@1.0.0",
      "llm-judge@1.0.0",
      "panel-fan-in@1.0.0",
      "panel-fanout@1.0.0",
      "priority-scorer@1.0.0",
      "queue-scheduler@1.0.0",
      "sandboxed-python-runner@1.0.0",
      "trajectory-auditor@1.0.0",
    ]);
  });

  it("the ontology overlay is one file carrying the terms content declares", () => {
    const vocabulary = contentVocabulary();
    expect(vocabulary?.file).toBe("content/ontology/extensions.yaml");
    expect(vocabulary?.terms.length).toBe(5);
  });
});
