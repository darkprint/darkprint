/* ============================================================
   The docs drift guard, driven over text rather than over the tree.

   `scripts/check-docs-drift.mjs` compares two documents against the
   repository they describe, and it had been reporting the wrong
   number in one direction for as long as anyone had looked at it.
   Its anchor scan was a raw search for a token, so the comment at
   `lib/content/view.ts:30` announcing that the SEAM-74 anchor was
   REMOVED — a sentence that has to name the token to say anything
   at all — read to the checker as the anchor itself. The seam with
   no anchor anywhere was the one seam the checker called anchored
   (§11.0 Q33).

   ── what is tested here and what is not ──
   The walk is not tested. It reads five real directories off disk,
   and a cell over it would either assert on a tree that changes
   every day or build a fake one, which tests `readdirSync`. What IS
   tested is every decision the walk feeds: the use-versus-mention
   rule, the two table parsers, and the set comparison. Those are
   the parts that can be confidently wrong.

   ── the fixtures assemble the token, and that is not fussiness ──
   The checker walks `scripts/`, and this file is a `.ts` under it.
   A fixture written with the token spelled out would be read as a
   live anchor for a seam this repository does not have, which is
   the exact trap the subject exists to close. Assembling it at
   runtime keeps the fixtures independent of the rule they test: a
   fixture that relied on the backtick rule to hide itself would go
   quiet in precisely the case where the rule is broken. The last
   cell holds that property for whoever adds a fixture next.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  docRoutes,
  docSeamIds,
  quotedSpans,
  reportDrift,
  seamIdsIn,
  symmetricDifference,
} from "./check-docs-drift.mjs";

/** `TODO(SEAM-<id>)`, built at runtime so the literal never appears in this file. */
const anchor = (id: number) => "TODO" + `(SEAM-${id})`;

describe("use versus mention", () => {
  it("counts a bare token in a comment as an anchor", () => {
    const found = seamIdsIn(`// ${anchor(9001)} (cited at line 12): GET /api/thing`);

    expect([...found.anchored]).toEqual(["SEAM-9001"]);
    expect([...found.mentioned]).toEqual([]);
  });

  it("counts a backtick-quoted token as a mention, not an anchor", () => {
    const found = seamIdsIn(`// No seam is anchored here any more. \`${anchor(9001)}\` named a deleted route.`);

    expect([...found.mentioned]).toEqual(["SEAM-9001"]);
    expect([...found.anchored]).toEqual([]);
  });

  /* The two cells above are only worth having if the pair is a control: same id, same
     comment marker, same file, one pair of backticks between them. Asserted here as one
     difference rather than left to be inferred from two separate greens. */
  it("answers differently for the same id when the only change is the quoting", () => {
    const used = `// ${anchor(9001)}: a live anchor`;
    const mentioned = `// \`${anchor(9001)}\`: a live anchor`;

    expect(seamIdsIn(used).anchored.has("SEAM-9001")).toBe(true);
    expect(seamIdsIn(mentioned).anchored.has("SEAM-9001")).toBe(false);
  });

  /* Both forms a lookaround for one adjacent backtick would have missed. The second is the
     shape a careful author reaches for when retiring an anchor: quote the whole line. */
  it("sees a mention in double backticks and a mention wrapping a whole comment line", () => {
    const doubled = `// the token \`\`${anchor(9002)}\`\` came off with the component`;
    const wrapped = `// this file used to open with \`// ${anchor(9003)}: POST /api/thing\``;

    expect(seamIdsIn(doubled).anchored.size).toBe(0);
    expect(seamIdsIn(wrapped).anchored.size).toBe(0);
    expect([...seamIdsIn(doubled).mentioned]).toEqual(["SEAM-9002"]);
    expect([...seamIdsIn(wrapped).mentioned]).toEqual(["SEAM-9003"]);
  });

  /* A token inside a template literal is fixture data or generated output. Nothing in this
     tree anchors a seam from inside one, and a suite that writes an anchor-shaped line into
     a fixture string would otherwise satisfy a doc row it has nothing to do with. */
  it("reads a token inside a template literal as a mention", () => {
    const source = ["const fixture = `", `// ${anchor(9004)}: not real`, "`;"].join("\n");

    expect(seamIdsIn(source).anchored.size).toBe(0);
    expect([...seamIdsIn(source).mentioned]).toEqual(["SEAM-9004"]);
  });

  /* The failure mode a span-based rule has that a lookaround does not: one unpaired
     backtick opening a span that runs to end of file and silently eats every anchor below
     it. An unpaired run has to stay literal text. */
  it("does not let a stray backtick swallow the anchors after it", () => {
    const source = [
      "// a lone ` backtick, in prose, closing nothing",
      `// ${anchor(9005)}: still an anchor`,
      `// ${anchor(9006)}: and so is this one`,
    ].join("\n");

    expect([...seamIdsIn(source).anchored].sort()).toEqual(["SEAM-9005", "SEAM-9006"]);
    expect(seamIdsIn(source).mentioned.size).toBe(0);
  });

  it("pairs backtick runs by length and leaves an unmatched run alone", () => {
    expect(quotedSpans("a `b` c")).toEqual([[2, 5]]);
    expect(quotedSpans("a ``b`` c")).toEqual([[2, 7]]);
    expect(quotedSpans("a ` b")).toEqual([]);
  });
});

/* The defect this guard was written for, pinned against the file that carries it rather
   than against a fixture shaped like it. `view.ts` is not owned here and may well change;
   what must not change is that a comment retiring an anchor stops counting as one. If that
   file's sentence is rewritten or the seam is genuinely re-anchored, this cell is the place
   that says so out loud. */
describe("the real correction in lib/content/view.ts", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../lib/content/view.ts", import.meta.url)),
    "utf8",
  );

  it("mentions SEAM-74 and anchors nothing", () => {
    const found = seamIdsIn(source);

    expect([...found.mentioned]).toContain("SEAM-74");
    expect([...found.anchored]).toEqual([]);
  });
});

describe("the document parsers", () => {
  it("reads a seam id only from the first cell of a table row", () => {
    const doc = [
      "| SEAM-01 | anchored in `lib/thing.ts` | `GET /api/thing` |",
      "| SEAM-02 | RETIRED, see SEAM-03 for the replacement | none |",
      "Prose naming SEAM-99 in a sentence is not a row.",
      "| not a seam | SEAM-98 in the second cell | none |",
    ].join("\n");

    expect([...docSeamIds(doc)].sort()).toEqual(["SEAM-01", "SEAM-02"]);
  });

  it("reads a route only from a row whose second cell names a page file", () => {
    const doc = [
      "| `/build` | `app/build/page.tsx` | the builder |",
      "| `/nodes/[...id]` | `app/nodes/[...id]/page.tsx` | one card |",
      "| `/api/cards` | `app/api/cards/route.ts` | not a page |",
    ].join("\n");

    expect([...docRoutes(doc)].sort()).toEqual(["/build", "/nodes/[...id]"]);
  });
});

describe("the comparison", () => {
  it("reports both directions and sorts each", () => {
    const diff = symmetricDifference(
      new Set(["b", "a", "shared"]),
      new Set(["shared", "d", "c"]),
    );

    expect(diff.onlyA).toEqual(["a", "b"]);
    expect(diff.onlyB).toEqual(["c", "d"]);
  });
});

describe("the report", () => {
  const inSync = {
    fsRoutes: new Set(["/build"]),
    documentedRoutes: new Set(["/build"]),
    anchored: new Set(["SEAM-01"]),
    documentedSeamIds: new Set(["SEAM-01"]),
  };

  it("exits 0 and counts what it checked when nothing drifted", () => {
    const { lines, code } = reportDrift(inSync);

    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("in sync: 1 routes, 1 seams.");
  });

  it("exits 1 on drift in either direction", () => {
    expect(reportDrift({ ...inSync, fsRoutes: new Set(["/build", "/new"]) }).code).toBe(1);
    expect(reportDrift({ ...inSync, documentedSeamIds: new Set(["SEAM-01", "SEAM-02"]) }).code).toBe(1);
  });

  /* SEAM-74's own situation, offline: documented, not anchored, and the code holds a
     sentence naming it. The reader has to be told which of "nobody wrote the anchor" and
     "somebody wrote about the anchor" they are looking at, because the second one looks
     exactly like a false positive from a grep. */
  it("says where a documented-but-unanchored id is merely mentioned", () => {
    const { lines } = reportDrift({
      ...inSync,
      documentedSeamIds: new Set(["SEAM-01", "SEAM-74", "SEAM-82"]),
      mentionedAt: new Map([["SEAM-74", ["lib/content/view.ts"]]]),
    });

    expect(lines).toContain("    SEAM-74 (mentioned, not anchored, in lib/content/view.ts)");
    expect(lines).toContain("    SEAM-82");
  });
});

/* Kept last because it is about this file and not about the subject: no fixture above may
   ever anchor a seam. The checker walks `scripts/`, so a fixture that slipped one through
   would add a phantom id to the code side of the very report this suite defends, and it
   would do it in the direction nobody reads. */
describe("this suite's own fixtures", () => {
  it("anchors no seam in the tree the checker walks", () => {
    const own = readFileSync(fileURLToPath(import.meta.url), "utf8");

    expect([...seamIdsIn(own).anchored]).toEqual([]);
  });
});
