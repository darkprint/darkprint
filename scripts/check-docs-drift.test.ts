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

/**
 * A shipped anchor, `SEAM-<id> LIVE`, and the combined `SEAM-<a>/SEAM-<b> LIVE` form.
 *
 * Built at runtime for the same reason `anchor` is, and the reason bit on the first draft:
 * this suite walks `scripts/`, so a fixture written as a literal IS an anchor in the tree the
 * checker reads, and `anchors no seam in the tree the checker walks` red on six of them. The
 * id and the status word are never adjacent in this file's own source.
 */
const shipped = (ids: readonly number[], tag = "LIVE") =>
  ids.map((id) => `SEAM-${id}`).join("/") + " " + tag;

/* ── The two anchor forms the checker could not see until 2026-09-06 ──
   A seam that has SHIPPED stops being a TODO and is re-marked `SEAM-nn LIVE`, which is the
   tag `seams.md` uses for a LIVE row. The matcher knew only the TODO form, so all 28 shipped
   anchors in the tree read as ids that had lost their anchor and the report named 50 drifted
   seams when the true figure was 22. A checker that over-reports trains its reader to ignore
   it, which is worse than not running it, and this is the checker committing the failure it
   exists to catch.

   The list form was found by asking what the ids STILL on the list looked like in the tree
   rather than trusting the first fix: `app/blueprints/page.tsx:30` opens `SEAM-01/SEAM-02
   LIVE:` because one read satisfies two rows, and a pattern expecting one id before the
   status word keeps the last and drops the rest silently. Both are cells here so neither can
   regress into a number nobody reads. */
describe("the anchor forms a shipped seam takes", () => {
  it("counts a LIVE-marked id as an anchor, not a mention", () => {
    const found = seamIdsIn(`// ${shipped([9101])}: the shelf reads the registry`);

    expect([...found.anchored]).toEqual(["SEAM-9101"]);
    expect([...found.mentioned]).toEqual([]);
  });

  it("keeps EVERY id in a combined anchor, not just the one beside the status word", () => {
    const found = seamIdsIn(`// ${shipped([9102, 9103])}: one read satisfies two rows`);

    expect(
      [...found.anchored].sort(),
      "a combined anchor lost an id, which is how a documented seam reads as unanchored",
    ).toEqual(["SEAM-9102", "SEAM-9103"]);
  });

  it("reads MOCK and PLANNED the same way, since a doc row may carry either", () => {
    expect(seamIdsIn(`// ${shipped([9104], "MOCK")}: seeded`).anchored.has("SEAM-9104")).toBe(true);
    expect(seamIdsIn(`// ${shipped([9105], "PLANNED")}: unbuilt`).anchored.has("SEAM-9105")).toBe(true);
  });

  /* The control the three cells above need. Quoting has to keep working for the new forms or
     the use-versus-mention rule holds for one anchor shape and not the other, which is the
     hole this file was written to close. */
  it("still answers differently when the only change is the quoting", () => {
    expect(seamIdsIn(`// ${shipped([9106])}: a real anchor`).anchored.has("SEAM-9106")).toBe(true);
    expect(seamIdsIn(`// \`${shipped([9106])}\`: quoted`).anchored.has("SEAM-9106")).toBe(false);
  });

  /* A status word is what separates an anchor from prose. Without this, every sentence that
     happens to name a seam id becomes an anchor and the drift list empties for the wrong
     reason — the opposite failure to the one being fixed, and the easier one to ship. */
  it("does not count a bare id in running prose as an anchor", () => {
    const found = seamIdsIn(`// SEAM-${9107} is the row this component used to satisfy.`);

    expect([...found.anchored]).toEqual([]);
  });
});

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
