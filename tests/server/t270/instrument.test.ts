/* ============================================================
   T270 — falsifying this suite's own instrument

   Every other file here quantifies over what `contract.ts` parsed
   out of backend.md §T270. If that parser is wrong, the suite is
   confidently wrong in whatever direction the parser leans, and
   NOTHING ELSE IN THIS DIRECTORY CAN SEE IT: the parser and the
   cells that consume it have the same author, so agreement
   between them is a consistency check and never a second axis.

   So this file drives the parser on SYNTHETIC usage blocks whose
   right answer is known before it runs. The real section is one
   input; these are the inputs that separate a parser that works
   from one that merely resolves on the document it was written
   against.

   Two of the cells below exist because the parser was WRONG in
   exactly the way they test, and printing the parse is what found
   it — not reading it:

     `--declare <version>` parsed as a flag taking NOTHING plus a
     stray required positional `<version>`, while `clone`'s
     `[--version <v> | --digest <d>]` parsed correctly. The two
     forms went down different code paths and only the bracketed
     one was right, so the bug was invisible in `clone` and fatal
     in `bump`. A cell asserting "`--declare` takes a version"
     would have reddened a correct implementation.

     The withdrawal reader required `**` immediately before
     `WITHDRAWN`; the ruling puts the emphasis around the clause
     LABEL instead. It matched nothing and THREW against a
     correctly-amended document.

   Neither was foreseeable by inspection. Both are pinned here.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ac6ProseVerbsIn,
  BLOCK_COMMANDS,
  CRITERIA,
  DIVERGENCES,
  FORBIDDEN_IN_RENDERING,
  LOCAL_ONLY_VERBS,
  parseUsageBlock,
  VERBS,
  WITHDRAWN_CRITERIA,
  WITHDRAWN_VERBS,
} from "./contract";

/** A section fragment shaped like the real one: eight-space indent, no fence. */
function usage(...lines: string[]): string {
  return ["- **Published signatures**", "", ...lines.map((line) => `        ${line}`), ""].join(
    "\n",
  );
}

describe("the usage-block parser discriminates", () => {
  it("pairs a bare `--flag <arg>` rather than splitting it into a flag and a positional", () => {
    /* THE REGRESSION. Outside brackets the argument list is split on whitespace, which is
       right for two independent arguments and wrong for the two halves of one. */
    const [command] = parseUsageBlock(usage("darkprint bump [<dir>] --declare <version>"));

    expect(command.flags).toEqual([
      { name: "--declare", arg: "<version>", optional: false, exclusiveWith: [] },
    ]);
    /* Excludes the bad output rather than merely admitting the good one: the defect's
       signature is `<version>` appearing HERE, and a `toHaveLength(1)` would pass on it. */
    expect(command.positionals).toEqual([{ text: "<dir>", optional: true }]);
  });

  it("reads an alternation group as mutual exclusion, both directions", () => {
    const [command] = parseUsageBlock(
      usage("darkprint clone <owner>/<slug> [--version <v> | --digest <d>]"),
    );
    const flags = Object.fromEntries(command.flags.map((flag) => [flag.name, flag]));

    expect(flags["--version"].exclusiveWith).toEqual(["--digest"]);
    expect(flags["--digest"].exclusiveWith).toEqual(["--version"]);
  });

  it("keeps two independent optional flags INDEPENDENT", () => {
    /* The near miss that separates the instrument from one that merely resolves: this differs
       from the cell above by one character — `|` becomes `]` `[` — and the answer must flip.
       Without this, a parser that marked every optional flag mutually exclusive would pass
       the alternation cell and be wrong about `clone`'s `--out`. */
    const [command] = parseUsageBlock(
      usage("darkprint clone <owner>/<slug> [--version <v>] [--out <dir>]"),
    );

    for (const flag of command.flags) expect(flag.exclusiveWith).toEqual([]);
  });

  it("does not treat `<` as bracket depth, or the alternation is lost", () => {
    /* If `<` opened a depth level the `|` below would sit at depth 2, never split, and both
       flags would collapse into one unparseable positional. Asserted on the COUNT, which is
       what moves. */
    const [command] = parseUsageBlock(usage("darkprint x [--a <one> | --b <two>]"));
    expect(command.flags.map((flag) => flag.name)).toEqual(["--a", "--b"]);
  });

  it("marks a bracketed positional optional and a bare one required", () => {
    const [command] = parseUsageBlock(usage("darkprint x <required> [<optional>]"));
    expect(command.positionals).toEqual([
      { text: "<required>", optional: false },
      { text: "<optional>", optional: true },
    ]);
  });

  it("keeps `<owner>/<slug>` as ONE positional", () => {
    /* Splitting it would invent a two-argument form the block does not publish. What it
       MEANS — B-09's two-part key — is the section's business, not the parser's. */
    const [command] = parseUsageBlock(usage("darkprint clone <owner>/<slug>"));
    expect(command.positionals).toEqual([{ text: "<owner>/<slug>", optional: false }]);
  });

  it("strips a trailing `//` note off the command text and keeps it as the note", () => {
    const [command] = parseUsageBlock(usage("darkprint validate [<dir>]   // local, no network"));
    expect(command.text).toBe("darkprint validate [<dir>]");
    expect(command.note).toBe("local, no network");
  });

  it("ignores a `//` line that is not a command", () => {
    /* The amended block carries exactly such a line — the withdrawal note — and a parser that
       took it for a command would publish a verb called `` `publish` ``. */
    const commands = parseUsageBlock(
      usage("darkprint validate [<dir>]", "// `publish` and `report` WITHDRAWN (D-270-01)"),
    );
    expect(commands.map((command) => command.verb)).toEqual(["validate"]);
  });

  it("THROWS rather than returning [] when no command line is present", () => {
    /* The property the whole suite rests on. An empty parse would make every `it.each` over
       `VERBS` vacuous and report a pass per cell that never existed. */
    expect(() => parseUsageBlock("- **Published signatures** (nothing indented here)")).toThrow(
      /publishes no `darkprint <verb>` usage line/,
    );
  });
});

describe("what the parser read out of the real section", () => {
  /* These pin the CURRENT ruled surface. They are not a second opinion about backend.md —
     they are the tripwire for the document moving under a suite that quantifies over it. A
     change here is a prompt to re-read the section, not automatically a defect. */

  it("publishes three live verbs, with `publish` and `report` withdrawn", () => {
    expect(BLOCK_COMMANDS.map((command) => command.verb)).toEqual(["clone", "validate", "bump"]);
    expect(WITHDRAWN_VERBS).toEqual(["publish", "report"]);
    /* Excludes the bad output: a withdrawn verb reaching `VERBS` is what builds cells against
       a verb no implementer will write. */
    for (const verb of WITHDRAWN_VERBS) expect(VERBS).not.toContain(verb);
  });

  it("covers `validate` alone with AC6's offline clause", () => {
    /* D-270-01 C8. The block's own `//` note agrees since the amendment; the ruling is what
       governs, and this asserts the governed answer rather than the note. */
    expect(LOCAL_ONLY_VERBS).toEqual(["validate"]);
  });

  it("carries four live criteria, numbered as the document numbers them", () => {
    expect(CRITERIA.map((criterion) => criterion.n)).toEqual([1, 2, 4, 6]);
    expect(WITHDRAWN_CRITERIA.slice().sort()).toEqual([3, 5]);
  });

  it("reads all five forbidden content classes out of the rendering clause", () => {
    /* A shortened list is a quietly narrowed leak scan — D-180-06's recorded failure mode.
       The floor inside `contract.ts` is four; the clause names five and this pins that. */
    expect(FORBIDDEN_IN_RENDERING).toEqual([
      "credential",
      "endpoint",
      "stack",
      "driver",
      "HTTP body",
    ]);
  });
});

describe("the AC6-prose reader discriminates", () => {
  /* The divergence list is a computed constant, so it cannot be driven both ways against the
     real document — the document only says one thing at a time. The READER is a function and
     can be, and that is where the falsification belongs. A reader that answered `[]` for
     every input would produce an empty `DIVERGENCES` and report all-clear against any
     document at all, which is the shape this whole file exists to exclude. */

  const paragraph = (sentence: string): string =>
    `  **AC6 defines which verbs are local, and the block above says so**: ${sentence}\n`;

  it("names both verbs when the prose names both", () => {
    expect(
      ac6ProseVerbsIn(paragraph("`validate` and `bump` take no credential and reach nothing.")),
    ).toEqual(["validate", "bump"]);
  });

  it("names one when the prose names one — the amendment this reader is waiting for", () => {
    expect(ac6ProseVerbsIn(paragraph("`validate` takes no credential and reaches nothing."))).toEqual(
      ["validate"],
    );
  });

  it("answers [] when the paragraph is absent, rather than throwing", () => {
    /* Deliberately not a throw. Nothing is quantified over this reader, so its silence deletes
       no cell — and a divergence reader that failed when the divergence was FIXED would make a
       correct amendment look like a regression. */
    expect(ac6ProseVerbsIn("- **Acceptance criteria:** (1) something")).toEqual([]);
  });

  it("reports the real section's AC6 prose as diverging while it still names `bump`", () => {
    /* A statement about the document at this commit, not a criterion. It goes green — and the
       entry disappears — the moment the prose is narrowed to `validate`. */
    const ac6 = DIVERGENCES.find((divergence) => divergence.subject.includes("AC6"));
    expect(ac6 === undefined || /`bump` takes no credential/.test(ac6.block)).toBe(true);
  });
});
