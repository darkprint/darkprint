/* ============================================================
   The distributable, run rather than read.

   This suite exists because the last two things to go wrong with
   this build were both invisible to inspection: `tsc` emitting
   `require("@/lib/core")` into the output (a ruling was made on a
   stand-in that did not reproduce it), and a `banner` shebang
   landing on line 2 behind the entry file's own, which made every
   invocation a SyntaxError. Both compiled. Both passed a reading.
   Only running the emitted file found either.

   C11 puts the transport out of the BLIND suite's scope; it does
   not put it out of the implementer's, and this is the only guard
   on the artefact a user actually gets.
   ============================================================ */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const BIN = "packages/mcp/dist/cli.js";

/**
 * Exit code and BOTH streams, whatever the exit code.
 *
 * `spawnSync` rather than `execFileSync`: the latter returns only stdout on success and
 * only throws on failure, so a helper built on it silently reported an empty stderr for
 * every command that succeeded — and `--help` writes its usage to stderr and exits 0.
 * The cell that caught it was asserting on the usage text, and the defect was in this
 * helper rather than in the binary.
 */
function run(args: readonly string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [BIN, ...args], { encoding: "utf8" });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe("the bundled bin", () => {
  beforeAll(() => {
    execFileSync("node", ["packages/cli/build.mjs"], { stdio: "pipe" });
  }, 60_000);

  it("is emitted, and starts with exactly one shebang", () => {
    expect(existsSync(BIN)).toBe(true);
    const source = execFileSync("head", ["-c", "200", BIN], { encoding: "utf8" });
    expect(source.startsWith("#!/usr/bin/env node\n")).toBe(true);
    /* The bug this file was written for: a second shebang on line 2 is a SyntaxError, and
       a build that emits one still exits 0. */
    expect(source.slice(1).includes("#!/usr/bin/env node")).toBe(false);
  });

  it("runs `validate` with the engine bundled in — no MODULE_NOT_FOUND, no alias left behind", () => {
    const { code, stdout, stderr } = run(["validate", "public/bundles/frontline-triage"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    /* Both halves, through the real binary: the finding and its hint. */
    expect(stdout).toContain("warning: The `criteria-leak` check was not evaluated");
    expect(stdout).toContain("Type the port that carries the acceptance criteria");
  });

  it("keeps T220's exit codes, which C1's grant does not cover changing", () => {
    expect(run(["--help"]).code).toBe(0);
    expect(run([]).code).toBe(1);
    expect(run(["frobnicate"]).code).toBe(1);
    expect(run(["frobnicate"]).stderr).toContain("unknown command");
  });

  it("still advertises `mcp`, which is the command six client configs already run", () => {
    expect(run(["--help"]).stderr).toContain("darkprint mcp");
  });
});
