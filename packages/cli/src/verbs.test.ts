/* ============================================================
   The verb table is what the CLI actually does
   ------------------------------------------------------------
   `CLI_VERBS` became the single source of two published help blocks
   and of `/capabilities`, and a table with three readers and no
   guard is a table that can start describing a command nobody
   implemented. Two things needed holding and neither was:

   1. `dispatchedBy` was pure documentation. Seven rows claim
      `runCli` handles them and one claims the shim does, and
      nothing compared either claim to a dispatcher. An eighth row
      added with `dispatchedBy: "packages/cli/src/run.ts"` and no
      `case` would have put a verb on `darkprint --help` that answers
      `unknown command`, which is the shape a help text is for
      preventing.

   2. The shim's inline gloss had one occurrence in the tree and no
      reader. Deleting `hint` on the `mcp` row, or the `true` that
      turns hints on, or the whole branch that renders them, dropped
      a line of published help and reddened nothing.

   Both are checked through the published surfaces rather than
   against the table, because the table agreeing with itself is what
   was already true.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CLI_VERBS, collectingIo, renderCliUsage, runCli } from "./index";

/** What `npx -y darkprint --help` prints, driven rather than read. See `import.test.ts`. */
async function shimUsage(): Promise<string> {
  const { main } = await import("../../mcp/src/cli");
  const written: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    written.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    await main(["--help"]);
  } finally {
    process.stderr.write = original;
  }
  return written.join("");
}

const OWN = CLI_VERBS.filter((verb) => verb.dispatchedBy === "packages/cli/src/run.ts");
const SHIM = CLI_VERBS.filter((verb) => verb.dispatchedBy === "packages/mcp/src/cli.ts");

describe("`dispatchedBy` is a claim about a dispatcher", () => {
  it("splits the table, so neither case below is vacuous", () => {
    expect(OWN.length).toBe(7);
    expect(SHIM.map((verb) => verb.name)).toEqual(["mcp"]);
  });

  /**
   * Driven with no arguments, which every one of the seven refuses.
   *
   * What is asserted is the refusal it gives: a verb the switch knows answers with its own
   * name and what it wanted, and a verb it does not know answers `unknown command` and
   * prints the whole usage block. So this distinguishes "dispatched and then refused for
   * want of an argument" from "not dispatched at all", which a bare exit code cannot: both
   * are 1.
   *
   * None of the seven writes anything on this path. `validate` and `export` default their
   * directory to `.`, so both are given a name that is not there and refuse on reading it.
   */
  it.each(OWN.map((verb) => [verb.name] as const))(
    "`runCli` dispatches `%s`",
    async (name) => {
      const io = collectingIo();
      const argv = name === "validate" || name === "export" ? [name, "no-such-directory"] : [name];
      await runCli(argv, io);
      const said = io.stderr.join("");
      expect(said, `\`${name}\` is not in runCli's switch`).not.toContain("unknown command");
      expect(said.length, `\`${name}\` said nothing at all`).toBeGreaterThan(0);
    },
  );

  /**
   * And the eighth is not, which is what its row says.
   *
   * This is the half that makes the seven above mean something. Without it the cells could
   * all pass against a `default` branch that had stopped refusing, and `dispatchedBy` would
   * be describing a distinction the code no longer draws.
   */
  it.each(SHIM.map((verb) => [verb.name] as const))(
    "`runCli` does NOT dispatch `%s`, and the shim's own branch is why",
    async (name) => {
      const io = collectingIo();
      const code = await runCli([name], io);
      expect(code).toBe(1);
      expect(io.stderr.join("")).toContain("unknown command");
    },
  );
});

describe("both published help blocks come off the table", () => {
  it.each(CLI_VERBS.map((verb) => [verb.name, verb.args] as const))(
    "`darkprint --help` prints `%s`",
    async (_name, args) => {
      const io = collectingIo();
      await runCli(["--help"], io);
      expect(io.stderr.join("")).toContain(`  darkprint ${args}`);
    },
  );

  it.each(CLI_VERBS.map((verb) => [verb.name, verb.args] as const))(
    "`npx -y darkprint --help` prints `%s`",
    async (_name, args) => {
      expect(await shimUsage()).toContain(`  npx -y darkprint ${args}`);
    },
  );

  /**
   * The gloss the shim printed before the table existed, still printed.
   *
   * It had no reader, so the refactor that moved it into `hint` could have dropped it
   * instead and nothing would have said so. A line of published help is a promise, and a
   * refactor is not a place to withdraw one quietly.
   */
  it.each(CLI_VERBS.filter((verb) => verb.hint !== undefined).map((v) => [v.name, v.hint!] as const))(
    "`npx -y darkprint --help` glosses `%s`",
    async (name, hint) => {
      const usage = await shimUsage();
      expect(usage).toContain(hint);
      /* On the verb's own line, not merely somewhere in the block: a gloss that had come
         adrift and printed on its own line would satisfy a bare `toContain`. */
      const line = usage.split("\n").find((text) => text.includes(` darkprint ${name}`));
      expect(line, `no line for \`${name}\``).toBeDefined();
      expect(line).toContain(hint);
    },
  );

  /**
   * And `darkprint --help` prints no gloss, which is the text it has always had.
   *
   * `renderCliUsage` takes `hints` precisely so the two blocks stay the two blocks they
   * were. Turning it on for this one would add a column to a published help text as a side
   * effect of a parameter default.
   */
  it("`darkprint --help` prints no gloss", async () => {
    const io = collectingIo();
    await runCli(["--help"], io);
    for (const verb of CLI_VERBS) {
      if (verb.hint === undefined) continue;
      expect(io.stderr.join("")).not.toContain(verb.hint);
    }
  });

  /**
   * The shim leads with `mcp` and this file's own block ends with it.
   *
   * `MCP_FIRST` reorders the table for one entry point and not the other, and deleting the
   * reordering reddened nothing: both blocks carried all eight verbs either way, which is
   * all any cell asked. The order is the difference the shim exists to make, since it is
   * the bin of a package named for that subcommand and the line six client configurations
   * on the site already run.
   */
  it("leads the shim's help with `mcp` and this file's with `clone`", async () => {
    const shim = (await shimUsage()).split("\n").filter((line) => line.startsWith("  npx"));
    expect(shim[0]).toContain(" darkprint mcp");

    const io = collectingIo();
    await runCli(["--help"], io);
    const own = io.stderr.join("").split("\n").filter((line) => line.startsWith("  darkprint"));
    expect(own[0]).toContain("darkprint clone");
    expect(own[own.length - 1]).toBe("  darkprint mcp");
  });

  /**
   * Every verb says what it does, in a sentence.
   *
   * `does` reaches `/capabilities` and nothing else, so this package is where an empty one
   * has to be caught: setting `does: ""` on a row rendered an empty cell there and reddened
   * nothing, because every string contains the empty string.
   */
  it.each(CLI_VERBS.map((verb) => [verb.name, verb.does] as const))(
    "`%s` carries a description",
    (_name, does) => {
      expect(does.trim().length).toBeGreaterThan(20);
      expect(does.trimEnd().endsWith(".")).toBe(true);
    },
  );

  /** The renderer does what the two call sites ask, which is what makes `hints` testable. */
  it("renders a gloss only when asked for one", () => {
    const withHints = renderCliUsage("h", "darkprint", CLI_VERBS, true);
    const without = renderCliUsage("h", "darkprint", CLI_VERBS);
    const gloss = CLI_VERBS.find((verb) => verb.hint !== undefined)?.hint;
    expect(gloss, "no row carries a hint, so this cell checks nothing").toBeDefined();
    expect(withHints).toContain(gloss);
    expect(without).not.toContain(gloss);
  });
});
