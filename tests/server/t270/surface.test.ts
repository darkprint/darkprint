/* ============================================================
   T270 — the published surface exists and has the published shape

   One red per published name, which is what makes the hand-off
   legible: a barrel missing `clone` says so on the `clone` cell
   rather than taking every criterion down with it.

   Every cell here binds the module LAST, after its premises. In
   the blind position all of these red on the same cause — the
   module is not on disk — and that is the position, not a defect.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  bindVerb,
  CLI,
  loadCli,
  recordingIo,
  RUN_CLI,
  RUN_CLI_ARITY,
  VERB_FUNCTIONS,
  VERBS,
} from "./contract";

describe("the CLI barrel", () => {
  it(`exports \`${RUN_CLI}\``, async () => {
    /* Premise first, module last. `VERBS` is derived from the section, and an empty one would
       make every `it.each` below expand to nothing — so it is asserted here, in a cell, where
       it produces a red rather than a silently shorter run. */
    expect(VERBS.length).toBeGreaterThan(0);

    const barrel = await loadCli();
    expect(typeof barrel[RUN_CLI], `\`${RUN_CLI}\` on \`${CLI}\``).toBe("function");
  });

  it(`\`${RUN_CLI}\` takes ${RUN_CLI_ARITY} parameters — argv and io`, async () => {
    const barrel = await loadCli();
    const runCli = barrel[RUN_CLI];
    expect(typeof runCli).toBe("function");

    /* `Function.length` stops at the first parameter with a default and TypeScript's `?`
       erases to nothing — so an optional parameter spelled `?` still counts and one spelled
       `= undefined` does not. Both spellings have shipped in this repository and the `?` was
       charged. Stated as the block's parameter list, with the spelling that would move it
       named, so a red here is readable rather than a bare number mismatch. */
    expect(
      (runCli as (...args: never[]) => unknown).length,
      `\`${RUN_CLI}(argv, io)\` publishes two parameters. A count of 1 means \`io\` was ` +
        `spelled \`= undefined\`; a count of 3 means a third was added.`,
    ).toBe(RUN_CLI_ARITY);
  });

  it.each(VERB_FUNCTIONS)("exports the per-verb function `%s`", async (name) => {
    /* D-270-03 (2)-(3). Bound by name and red on absence, "rather than inventing synonyms" —
       so a barrel publishing `validateDir` instead of `validate` reds HERE, once, naming what
       it did export, instead of reddening every AC1 cell with a confusing cause. */
    await expect(bindVerb(name)).resolves.toBeTypeOf("function");
  });
});

describe("rendering goes through `io` and nowhere else", () => {
  it("`runCli` writes nothing to process.stdout or process.stderr", async () => {
    /* D-270-03 (1): "nothing under `packages/cli/src/**` writes to
       `process.stdout`/`process.stderr` except the bin shim that passes the real streams."

       Driven rather than grepped. A grep over the source would answer a question about text;
       this answers the question about behaviour, and it is the one that catches a `console.log`
       reached through a helper. `console.log` writes through `process.stdout.write`, so
       patching the write is what covers both spellings.

       The patch is installed BEFORE the module is bound and removed in a `finally`, so a
       throw inside the call cannot leave the process without its streams. */
    const io = recordingIo();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const realOut = process.stdout.write.bind(process.stdout);
    const realErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
      /* `--help` rather than a verb: it is the one invocation that must render something
         without touching a directory or a network, so a stream write here is unambiguously
         the CLI's own and not a dependency's. */
      await runCli(["--help"], io);
    } finally {
      process.stdout.write = realOut;
      process.stderr.write = realErr;
    }

    /* Excludes the bad output rather than admitting the good one: asserting only that `io`
       received something would pass against a CLI that writes to BOTH. */
    expect(stdout.join(""), "`runCli` wrote to process.stdout").toBe("");
    expect(stderr.join(""), "`runCli` wrote to process.stderr").toBe("");
    expect(io.all(), "`runCli --help` rendered nothing through `io`").not.toBe("");
  });
});
