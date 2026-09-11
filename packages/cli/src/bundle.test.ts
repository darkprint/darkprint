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
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  /* `export` is the verb with the most of the engine behind it — the resolver, the ontology
     and the emitter — so it is the one most likely to leave an unresolved `@/` alias in the
     bundle. Run through the real binary for the reason in this file's banner: the two defects
     it exists for both compiled and both passed a reading. */
  it("runs `export --attractor` with the emitter bundled in", () => {
    const { code, stdout, stderr } = run([
      "export",
      "public/bundles/frontline-triage",
      "--attractor",
    ]);

    expect(stderr).not.toContain("MODULE_NOT_FOUND");
    expect(code).toBe(0);
    expect(stdout.startsWith("// Attractor-compatible DOT")).toBe(true);
    // The disclosure, through the artefact a user is actually handed.
    expect(stdout).toContain("goal_gate");
    expect(stdout.trimEnd().endsWith("}")).toBe(true);
    /* The redirect promise: `… --attractor > factory.dot` has to leave a DOT behind, so the
       graph may not appear on the stream the shell does not capture. */
    expect(stderr).not.toContain("digraph");
  });

  it("refuses `export` with no format, and writes nothing to stdout when it does", () => {
    const { code, stdout, stderr } = run(["export", "public/bundles/frontline-triage"]);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("--attractor");
  });

  /* `import` is the other half of the same engine plus `node:fs`, and it is the only verb
     that WRITES a tree. Both halves are worth running through the real binary: an esbuild
     bundle that resolves `@/lib/core` at build time can still fail on a `node:` import, and
     a verb that writes files is the one where a bundling defect leaves a mess behind. */
  it("runs `import` and leaves a folder `export` reads straight back", () => {
    const out = mkdtempSync(join(tmpdir(), "darkprint-bundle-import-"));
    // `mkdtemp` creates the directory, and the verb refuses a directory that already
    // exists with anything in it — an empty one is fine and is what this is.
    const imported = run([
      "import",
      "tests/attractor-corpus/conditional-routing.dot",
      "--as",
      "mara-veil",
      "--out",
      out,
    ]);

    expect(imported.stderr).not.toContain("MODULE_NOT_FOUND");
    expect(imported.code).toBe(0);
    expect(imported.stdout).toContain("topology.dot");
    expect(imported.stderr).toContain("DRAFT");

    const exported = run(["export", out, "--attractor"]);
    expect(exported.code).toBe(0);
    expect(exported.stdout).toContain("shape=diamond");
    rmSync(out, { recursive: true, force: true });
  });

  it("refuses `import` with no handle, and writes nothing", () => {
    const out = join(tmpdir(), "darkprint-bundle-import-nowhere");
    const { code, stdout, stderr } = run([
      "import",
      "tests/attractor-corpus/minimal.dot",
      "--out",
      out,
    ]);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("--as");
    expect(existsSync(out)).toBe(false);
  });

  /* `report` is the one verb that WRITES, so the cell that drives it through the real
     binary has to be one that cannot reach a registry. It refuses on the run directory
     before any credential is read and long before a socket opens, which is exactly the
     property worth holding here: a bundle missing `report.ts` would fall through to
     "unknown command" and a bundle that had it but resolved the network first would hang
     or reach out. Nothing here is sent anywhere. */
  it("refuses `report` with no run directory, without reaching a network", () => {
    const { code, stdout, stderr } = run(["report", "--target", "lupo/frontline-triage"]);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("name the run directory");
    expect(stderr).not.toContain("unknown command");
  });

  it("advertises `report` and the session variable in the bundled usage", () => {
    const { code, stderr } = run(["--help"]);
    expect(code).toBe(0);
    expect(stderr).toContain("report <run-dir>");
    expect(stderr).toContain("DARKPRINT_SESSION");
  });
});
