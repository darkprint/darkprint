/* ============================================================
   T262 AC6 (as scoped by D-262-01) and D-262-10's rendered half

   AC6 as the section words it — "no import of `lib/data/**`
   remains anywhere" — is FALSE OF A CORRECT T262 and D-262-01
   scoped it to T262's own surfaces. The closure this author
   measured is why: `lib/content/index.ts` and `view.ts` both import
   `@/lib/data`, 81 files import `@/lib/content`, so the closure is
   98 files, 83 outside T262's `Owns` and 60 outside all four
   cutover tasks combined. Nothing in this file scans outside the
   partition, and that is a RULING being obeyed rather than a scope
   this author chose.

   ── the premise is positive and it fails OUTSIDE the negative ──
   Every cell below is an absence, and an absence is green against
   an absent tree: no files, no matches, pass — and no mutation to
   the implementation can red it, because the instrument never
   reached the implementation. So `sources()` refuses a missing,
   emptied or shrunken partition, and the two premise describes
   below assert things that are TRUE ONLY IF THE CUTOVER HAPPENED:
   the files parse and carry imports at all, and the partition
   collectively reaches the three barrels the section says T262
   consumes. A tree where nothing was done fails those. A tree where
   the files were deleted fails those. Only then is an absence read
   as evidence.

   ── every clause is scoped to the FILE that must carry it ──
   `it.each` over the partition, never a union. A cell asserting a
   set-wide count stays green when one file keeps its import and
   another loses two, and three such maskings were found in one
   T263 suite with two of them surfacing only after repairs.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  type Source,
  importSpecifiers,
  renderedMentions,
  sources,
} from "./contract";
import { COMPONENT_FLOOR, EXCLUDED, components, scanned } from "./partition";

/* Bound LAST is the rule for a module under test; these are files on disk, so the read happens
   here and a failure to read is a PartitionError naming the path rather than a silent empty set. */
const partition: Source[] = sources(scanned(), 10);
const byPath = new Map(partition.map((s) => [s.path, s]));

describe("premise: the partition is real, and it is the cutover's own tree", () => {
  it(`the component walk found at least ${COMPONENT_FLOOR} files`, () => {
    /*
     * The walk is what keeps this suite honest about renames, and it is also the one thing that
     * can silently shrink to nothing. A floor turns that into a red instead of a green.
     */
    expect(
      components().length,
      "the walk over `components/profile/**` plus the two named components returned fewer files " +
        "than the tree it was written against held. Every absence below is vacuous over a file " +
        "the walk did not reach.",
    ).toBeGreaterThanOrEqual(COMPONENT_FLOOR);
  });

  it.each(scanned())("%s parses and carries imports", (path) => {
    const source = byPath.get(path);
    expect(source, `${path} is not in the partition`).toBeDefined();
    expect(
      importSpecifiers(source!).length,
      `${path} yielded no module specifiers at all. Either it does not parse, or it is not the ` +
        `file this suite thinks it is — and in both cases the \`@/lib/data\` absence asserted ` +
        `below is a fact about the SCANNER rather than about the file.`,
    ).toBeGreaterThan(0);
  });

  it("the partition reaches the three barrels the section says T262 consumes", () => {
    /*
     * The positive that fails outside the negative, and the reason it is stated set-wide rather
     * than per file: the section publishes no per-file mapping, so requiring `accounts` of the
     * saved tab would be this author inventing a contract. What it CAN require is that the
     * cutover happened at all. A tree still on fixtures reaches none of these.
     */
    const reached = new Set(
      partition.flatMap((s) => importSpecifiers(s).map((i) => i.spec)),
    );
    for (const barrel of ["@/lib/server/accounts", "@/lib/server/profiles", "@/lib/server/saves"]) {
      expect(
        [...reached].some((s) => s === barrel || s.startsWith(`${barrel}/`)),
        `no file in T262's partition imports \`${barrel}\`. The section's published-signatures ` +
          `line says this task consumes it, so a partition that reaches none of the three is a ` +
          `tree where the cutover has not happened — and every absence in this file is then ` +
          `green for the wrong reason.`,
      ).toBe(true);
    }
  });
});

describe("AC6: no file in T262's partition imports `@/lib/data`", () => {
  it.each(scanned())("%s", (path) => {
    const source = byPath.get(path)!;
    const fixtures = importSpecifiers(source).filter((i) => i.spec.startsWith("@/lib/data"));
    expect(
      fixtures.map((f) => `line ${f.line}: ${f.spec}`),
      `${path} still imports the fixtures AC6 retires. This is decided by the PARSER, so a ` +
        `docblock or a rendered sentence naming \`lib/data\` cannot produce this red — only a ` +
        `real module specifier can, static or dynamic.`,
    ).toEqual([]);
  });
});

describe("D-262-10: and no file still PRINTS a fixture path to the reader", () => {
  /*
   * The separate cell, because it has a separate repair. AC6's is a rewire; this one is a
   * rewrite under D-78, and D-262-10 rules these are NOT exempt: they are honesty copy that
   * became false, `BundleDropzone.tsx:580`'s shape exactly.
   *
   * Comments are stripped first, so the twenty docblocks that explain the retired fixtures do
   * not red a tree that retired them. That is the whole point of the 2x2 and it is the
   * direction that charges a correct implementer with the work they did.
   */
  it.each(scanned())("%s", (path) => {
    const source = byPath.get(path)!;
    expect(
      renderedMentions(source).map((m) => `line ${m.line}: ${m.spec}`),
      `${path} still names \`lib/data\` in text that reaches the reader — a \`<span>\`, a ` +
        `\`title=\` tooltip or a string that survives comment-stripping. Comments were already ` +
        `removed before this check, so this red is NOT a docblock: it is copy on the screen ` +
        `pointing at a fixture file that no longer feeds the page.`,
    ).toEqual([]);
  });
});

describe("the three exclusions are recorded, not silently dropped", () => {
  /*
   * A scan that quietly stops short of a file reads as coverage of it. Each exclusion is a
   * ruling, so it is asserted as one: the file still exists (nobody deleted it under cover of
   * the exclusion) and it is genuinely outside the scanned set.
   */
  it.each(EXCLUDED)("%s is excluded by ruling and still present", (path) => {
    expect(scanned()).not.toContain(path);
    expect(
      sources([path], 1),
      `${path} is excluded from T262's scan by D-262-03 or D-262-08, which makes it read-only ` +
        `rather than absent. If it is gone, a frozen file was deleted.`,
    ).toHaveLength(1);
  });
});
