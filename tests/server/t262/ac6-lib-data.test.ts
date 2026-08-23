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
import { COMPONENT_FLOOR, EXCLUDED, components, resolved, scanned } from "./partition";

/* ============================================================
   THE PREMISE IS EVALUATED INSIDE THE CELLS, NOT AT MODULE SCOPE

   `sources()` throws on a missing, emptied or shrunken partition,
   which is what makes every absence below discriminating. Calling it
   at module scope turns that throw into a COLLECTION error, and a
   collection error deletes the file's cells instead of failing them.

   Measured on this suite: emptying three component files produced
   `Test Files 1 failed | 3 passed` beside `Tests 37 passed (37)` and
   exit 1 — nothing on the test line failed, and 68 cells were simply
   absent. Loud in the exit code and the file count, silent in the
   number a reader quotes. Same shape as a throw in `beforeAll`
   turning reds into skips.

   So the read is per cell, and a premise violation reds the cell it
   belongs to with the path in the message.
   ============================================================ */
function read(path: string): Source {
  const [source] = sources([resolved(path)], 1);
  return source;
}

function readAll(): Source[] {
  return scanned().map(read);
}

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
    const source = read(path);
    expect(
      importSpecifiers(source).length,
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
      readAll().flatMap((s) => importSpecifiers(s).map((i) => i.spec)),
    );
    for (const barrel of PUBLISHED_BARRELS) {
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

/* ============================================================
   D-262-16 — THE ONE PERMITTED FIXTURE IMPORT, AND WHY IT IS
   EXACT RATHER THAN A PREFIX

   AC6 is amended: no import of `lib/data/**` remains in T262's
   surfaces EXCEPT the seeded profile figures T130 has no column for.
   `validated`, `watchers`, `support` and `pinned` are rendered today
   under `◐` markers, `ProfileRecord` carries none of them, three
   have no column at all and `validated` depends on T180, which is
   `todo`. By D-78 all four stay, so their source stays with them.

   The allowance is the EXACT specifier, not a prefix and not the
   barrel. `@/lib/data` would pull the whole fixture surface back
   through one import and satisfy a prefix test, which is the
   narrowing being undone by the shape of the check rather than by a
   ruling.
   ============================================================ */
const PERMITTED: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "components/profile/load.ts",
    /* D-262-23 took the residue to option (1): four specifiers, not one. The three beyond
       `/profiles` feed figures whose READ does not exist yet, and the missing read is recorded
       as a gap against T080 rather than worked around here. Exact strings, never prefixes and
       never the barrel `@/lib/data`, which would pull the whole fixture surface back through one
       import and undo the narrowing by the shape of the check rather than by a ruling. */
    ["@/lib/data/profiles", "@/lib/data/node-community", "@/lib/data/bundles", "@/lib/data/cards"],
  ],
]);

/* The four figures D-262-16 keeps. Asserted BY NAME below, because option (3) — deleting them and
   the `Pinned` section — was explicitly rejected and would satisfy every absence cell in this
   file. A criterion that only forbids cannot tell a completed cutover from a deleted feature. */
const SEEDED_FIGURES = ["validated", "watchers", "support", "pinned"] as const;

/* The three the published-signatures line commits to. D-262-24 adds four more that the cutover
   consumes; those are separate cells below, because the section never committed to them and a
   hard premise built on a ruling's incidental list is how a correct implementer gets redded. */
const PUBLISHED_BARRELS = [
  "@/lib/server/accounts",
  "@/lib/server/profiles",
  "@/lib/server/saves",
] as const;

/* D-262-24. NOTE THE ARITHMETIC: the ruling says the cutover consumes SIX and names three plus
   four, which is seven. Reported rather than resolved here — this suite does not get to pick
   which of the seven is not really consumed. */
const D_262_24_ADDITIONS = [
  "@/lib/server/auth",
  "@/lib/server/policy",
  "@/lib/server/registry",
  "@/lib/db",
] as const;

describe("D-262-24: the four barrels beyond the published three", () => {
  it.each(D_262_24_ADDITIONS)("the partition reaches `%s`", (barrel) => {
    /*
     * Separate from the premise, and each in its own cell, because a red here is a finding
     * either way and the two readings need telling apart: either the cutover has not reached a
     * barrel D-262-24 says it consumes, or D-262-24 named one it does not. Rolled into the
     * premise, a single miss would have read as "the cutover has not happened".
     */
    const reached = readAll().flatMap((s) => importSpecifiers(s).map((i) => i.spec));
    expect(
      reached.some((s) => s === barrel || s.startsWith(`${barrel}/`)),
      `no file in T262's partition imports \`${barrel}\`. D-262-24 names it as one the cutover ` +
        `consumes — \`auth\` for the session, \`policy\` for the \`Actor\` type and the ` +
        `anonymous reader, \`registry\` for the settings counts, \`@/lib/db\` for ` +
        `\`getSharedDbClient\`. If the implementation genuinely does not need it, the RULING is ` +
        `what needs amending, not the code.`,
    ).toBe(true);
  });
});

describe("AC6 as amended by D-262-16: no fixture import beyond the one permitted", () => {
  it.each(scanned())("%s", (path) => {
    const source = read(path);
    const allowed = PERMITTED.get(path) ?? [];
    const fixtures = importSpecifiers(source)
      .filter((i) => i.spec.startsWith("@/lib/data"))
      /* D-262-25: a TYPE-ONLY import is outside AC6's domain, and is NOT an allow-list entry —
         an entry would imply it was a violation somebody forgave. It is erased at build, moves
         no fixture data and reaches no reader, and D-262-16's reason is about DATA. */
      .filter((i) => !i.typeOnly)
      .filter((i) => !allowed.includes(i.spec));
    expect(
      fixtures.map((f) => `line ${f.line}: ${f.spec}`),
      `${path} still imports the fixtures AC6 retires. This is decided by the PARSER, so a ` +
        `docblock or a rendered sentence naming \`lib/data\` cannot produce this red — only a ` +
        `real module specifier can, static or dynamic.` +
        (allowed.length === 0
          ? ""
          : ` D-262-16 and D-262-23 permit exactly ${allowed.map((a) => `\`${a}\``).join(", ")} ` +
            `in this file and nothing else, so the barrel \`@/lib/data\` reds here: it would ` +
            `pull the whole fixture surface back through one import and undo the narrowing by ` +
            `the shape of the check rather than by a ruling.`),
    ).toEqual([]);
  });

  it("`components/profile/load.ts` STILL imports the permitted one — option (3) is not a pass", () => {
    /*
     * The cell that makes the exception discriminating rather than merely permissive. D-262-16
     * rejected option (3), deleting the four figures and the `Pinned` section, on the ground that
     * it pays for a criterion with a feature and retires `SEAM-55` by making it invisible. That
     * option satisfies every absence assertion above perfectly. Only a positive catches it.
     */
    /* VALUE imports only. D-262-25 puts type-only imports outside AC6's domain because they
       move no data — and that cuts both ways: converting this one to `import type` would satisfy
       a spec-name check while leaving the four figures with no source at all, which is option (3)
       reached by a keyword. The positive has to ask for the thing that actually carries data. */
    const specs = importSpecifiers(read("components/profile/load.ts"))
      .filter((i) => !i.typeOnly)
      .map((i) => i.spec);
    expect(
      specs,
      "`components/profile/load.ts` no longer imports `@/lib/data/profiles`. D-262-16 keeps it " +
        "because `validated`, `watchers`, `support` and `pinned` have no column — three have " +
        "none at all and `validated` depends on T180, which is `todo` — so by D-78 all four " +
        "stay and their source stays with them. Its absence means either the figures were " +
        "deleted (rejected option 3) or they were relocated to satisfy the grep (rejected " +
        "option 2), and both are green against an absence check.",
    ).toContain("@/lib/data/profiles");
  });

  it.each([
    "@/lib/data/node-community",
    "@/lib/data/bundles",
    "@/lib/data/cards",
  ])("D-262-23: `%s` is permitted in `load.ts` and its read is a gap against T080", (spec) => {
    /*
     * Asserted as PERMITTED rather than as required. D-262-23 records the missing read as a gap
     * against T080, so an implementation that finds a real source for one of these and drops the
     * fixture is ahead of the ruling, not in breach of it — and must not red. What would be a
     * breach is the import surviving somewhere it was never permitted, which the per-file cell
     * above already catches.
     */
    expect(PERMITTED.get("components/profile/load.ts")).toContain(spec);
  });

  it.each(SEEDED_FIGURES)("the seeded figure `%s` still has its declared source", (figure) => {
    /*
     * The premise, and it is about `lib/data/profiles.ts` rather than about T262: D-262-01 keeps
     * the folder, so the four figures' source survives this task. If it stops declaring one, the
     * import `load.ts` keeps is an import of something that is no longer there and the figure is
     * gone whatever the components still say.
     */
    const [source] = sources([resolved("lib/data/profiles.ts")], 1);
    expect(
      source.code.includes(figure),
      `\`${figure}\` is gone from \`lib/data/profiles.ts\`, which D-262-16 names as the four ` +
        `figures' only source and D-262-01 keeps.`,
    ).toBe(true);
  });

  it.each(SEEDED_FIGURES)("the seeded figure `%s` is still rendered somewhere in the partition", (figure) => {
    /*
     * ── this clause is SET-WIDE, and that is a cost rather than an oversight ──
     * Every other absence in this file is scoped to the one file that must carry it, because a
     * set-wide clause stays green when the file that owed a word loses it and another file the
     * scan covers still has it. This one cannot be scoped that way without inventing the mapping.
     *
     * Measured across T262's partition, the four are not co-located: `validated` and `watchers`
     * are in `ProfileShell.tsx` and `ProfileHeader.tsx`, `pinned` is in `load.ts` and
     * `Pinned.tsx`, `support` is in eight files. No ruling says which component owes which
     * figure after the cutover, and a blind author picking one would be writing a contract rather
     * than testing one — the shape that costs a correct implementer a red.
     *
     * So it is written set-wide, labelled, and paired with the two cells above that ARE scoped:
     * the source still declares the figure, and `load.ts` still imports it. What this cell alone
     * cannot catch is a figure that moves from one covered file to another, and that is stated
     * here rather than left for a reader to discover. A per-section mapping has been asked for.
     */
    const rendered = readAll().some((s) => s.code.includes(figure));
    expect(
      rendered,
      `\`${figure}\` no longer appears anywhere in T262's surfaces. It is one of the four ` +
        `figures D-78 keeps under their \`◐\` markers because T130 has no column for them — ` +
        `three have no column at all and \`validated\` depends on T180, which is \`todo\`. ` +
        `Its disappearance is rejected option (3): paying for AC6 with a feature, and retiring ` +
        `SEAM-55 by making it invisible.`,
    ).toBe(true);
  });
});

/* ============================================================
   D-262-26 — THE CRITERION IS "NO COPY NAMES A FIXTURE THAT NO
   LONGER FEEDS IT", AND THE SERVED SET IS DERIVED, NOT LISTED

   D-262-10 ruled the rendered mentions not exempt — and it was ruled
   while `lib/data/**` was still going to be deleted, when every such
   sentence was about to become false. D-262-01 kept the folder and
   D-262-16/23 kept the READS, so a sentence naming a fixture that is
   still the source of the row beside it is TRUE, and D-78 keeps true
   markers. Charging it is the false-claim direction, the same one
   already ratified for `FavoriteStar`'s count and `load.ts`'s import.

   The served set is DERIVED from `load.ts`'s surviving value imports
   rather than hard-coded, because a list stops being edited and a
   derivation does not. When T080 gives one of those figures a real
   read and the fixture import goes, the copy naming it becomes false
   in the same commit and this cell starts charging it — with no
   ruling needed and nothing to remember to update.
   ============================================================ */
function stillServed(): string[] {
  const load = read("components/profile/load.ts");
  return importSpecifiers(load)
    .filter((i) => i.spec.startsWith("@/lib/data") && !i.typeOnly)
    /* `@/lib/data/bundles` is the module; the copy names the FILE, `lib/data/bundles.ts`. */
    .map((i) => `${i.spec.replace("@/", "")}.ts`);
}

describe("D-262-26: no copy names a fixture that no longer feeds it", () => {
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
    const source = read(path);
    const served = stillServed();
    const stale = renderedMentions(source).filter(
      (m) => !served.some((fixture) => m.spec.includes(fixture)),
    );
    expect(
      stale.map((m) => `line ${m.line}: ${m.spec}`),
      `${path} names a fixture in text that reaches the reader — a \`<span>\`, a \`title=\` ` +
        `tooltip or a string surviving comment-stripping — and that fixture is NO LONGER ` +
        `imported by \`components/profile/load.ts\`, so the sentence has become false. ` +
        `Comments are stripped first, so this is not a docblock. Fixtures still feeding the ` +
        `page, derived from \`load.ts\`: ${served.join(", ") || "(none)"}.`,
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
      sources([resolved(path)], 1),
      `${path} is excluded from T262's scan by D-262-03 or D-262-08, which makes it read-only ` +
        `rather than absent. If it is gone, a frozen file was deleted.`,
    ).toHaveLength(1);
  });
});
