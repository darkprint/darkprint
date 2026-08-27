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
  it("reproduces the nine digests the site prints today (AC1)", () => {
    const loaded = readContent();
    expect(loaded.length).toBe(9);
    for (const b of loaded) {
      const readme = readFileSync(`public/bundles/${b.slug}/README.md`, "utf8");
      const printed = new RegExp(`${MARK}\\s+(sha256:[0-9a-f]{64})`).exec(readme)?.[1];
      expect(printed, `${b.slug}: README prints no digest`).toBeTypeOf("string");
      expect(b.blueprint.digest, b.slug).toBe(printed);
    }
  });

  it("every one of the 57 library files is pinned by some bundle", () => {
    const pinned = new Set<string>();
    for (const b of readContent()) for (const n of b.blueprint.nodes) pinned.add(n.ref);
    const fileRefs = readdirSync("content/cards")
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, ""));
    expect(fileRefs.length).toBe(57);
    expect(fileRefs.filter((r) => !pinned.has(r))).toEqual([]);
    expect([...pinned].filter((r) => !fileRefs.includes(r))).toEqual([]);
  });

  it("the ontology overlay is one file carrying one term", () => {
    const vocabulary = contentVocabulary();
    expect(vocabulary?.file).toBe("content/ontology/extensions.yaml");
    expect(vocabulary?.terms.length).toBe(1);
  });
});
