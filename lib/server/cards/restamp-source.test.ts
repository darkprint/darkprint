/* ============================================================
   DarkPrint backend — restampCardSource
   Pure over strings, so no database: the subject is what comes
   back out of the `yaml` writer for a document somebody wrote by
   hand.

   ── what this file does NOT cover, said out loud ──
   The round-trip equality inside `restampCardSource` is a guard
   against the writer and not against any input, and no document
   here or in `content/` makes it fire (the module's header lists
   the four that were probed). Its arms below are the ones that CAN
   be driven: a document that does not parse and one that is not a
   mapping. A cell claiming to cover the third would be claiming
   coverage this file does not have.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/core";
import { restampCardSource } from "./restamp-source";

const STAMP = { id: "berti/planner", author: "berti", provenance: "fork:darkprint planner@1.0.0 by lupo" };

const HAND_WRITTEN = [
  "# the phases this node belongs to were argued over",
  "id: planner",
  "name: Planner",
  "type: agent",
  "phase:",
  "  - planning",
  "",
  "action: plan",
  "spec: |",
  "  Write the plan.",
  "  Two lines of it.",
  "version: 1.0.0",
  "author: lupo",
  "",
].join("\n");

describe("restampCardSource", () => {
  it("sets the three keys and leaves everything else saying what it said", () => {
    const out = restampCardSource(HAND_WRITTEN, STAMP);
    expect(out).toBeDefined();

    const value = parseDocument(out!, "yaml").value as Record<string, unknown>;
    expect(value.id).toBe(STAMP.id);
    expect(value.author).toBe(STAMP.author);
    expect(value.provenance).toBe(STAMP.provenance);
    expect(value.name).toBe("Planner");
    expect(value.phase).toEqual(["planning"]);
    /* The block scalar survives as a block scalar's VALUE: a re-emitter would have turned
       it into a JSON string with a `\n` in it, which is the loss this module exists to avoid. */
    expect(value.spec).toBe("Write the plan.\nTwo lines of it.\n");
  });

  it("keeps the author's own comment", () => {
    const out = restampCardSource(HAND_WRITTEN, STAMP);
    expect(out).toContain("# the phases this node belongs to were argued over");
  });

  it("adds the keys that were not in the document at all", () => {
    const withoutAuthor = HAND_WRITTEN.replace("author: lupo\n", "");
    const out = restampCardSource(withoutAuthor, STAMP);
    const value = parseDocument(out!, "yaml").value as Record<string, unknown>;
    expect(value.author).toBe(STAMP.author);
    expect(value.provenance).toBe(STAMP.provenance);
  });

  it("refuses a document that does not parse", () => {
    expect(restampCardSource("id: [unclosed\n", STAMP)).toBeUndefined();
  });

  it("refuses a document that is not a mapping", () => {
    expect(restampCardSource("- planner\n- planner\n", STAMP)).toBeUndefined();
  });

  it("refuses an empty document", () => {
    /* `parseDocument("")` is legal YAML and parses to `null`, which is not a mapping — so a
       row holding an empty source is unforkable rather than forkable into a one-key file. */
    expect(restampCardSource("", STAMP)).toBeUndefined();
  });
});
