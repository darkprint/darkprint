/* ============================================================
   `darkprint export --attractor`

   Two things are being checked and they are not the same thing.
   The first is that the command produces a file Attractor accepts,
   which is `parseDot` plus `lintAttractor` over the real output —
   the same pair `lib/server/export/build.ts` gates a release with,
   so a bundle this command exports is one the site would publish.
   The second is that the command REFUSES rather than half-answers:
   a bundle DarkPrint reports errors on has no honest pipeline, and
   a DOT written from it looks complete while carrying a node that
   runs nothing.

   The renderer is driven through `runCli`, not by calling
   `runExport`, because the split that matters is stdout against
   stderr — `darkprint export ./b --attractor > factory.dot` has to
   leave a parseable file behind, and a warning on the wrong stream
   is a line no DOT parser accepts sitting inside the pipeline.
   ============================================================ */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { hasErrors, lintAttractor, parseDot } from "../../../lib/core";
import { CliError } from "./errors";
import { EXPORT_FORMATS, exportPipeline } from "./export";
import { importPipeline } from "./import";
import { collectingIo } from "./io";
import { runCli } from "./run";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-export-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** `layout.test.ts`'s helper, for the same reason: a copy something can be broken in. */
function bundleCopy(name: string, slug = "frontline-triage"): string {
  const dir = join(scratch, name);
  cpSync(`public/bundles/${slug}`, dir, { recursive: true });
  const legacy = join(dir, "blueprint.dot");
  if (existsSync(legacy)) renameSync(legacy, join(dir, "topology.dot"));
  return dir;
}

/**
 * An orphan card: a real card of the bundle, re-versioned so no node pins it.
 *
 * Written from the folder's own bytes rather than hand-authored, because a hand-authored
 * card is one field away from being an ERROR fixture instead of a WARNING one, and the two
 * cells below are about the warning path. The first version of this helper wrote a card
 * that produced two errors and made both of them measure the refusal instead.
 */
function addOrphanCard(dir: string): void {
  const source = join(dir, "cards", "kb-resolver@1.0.0.yaml");
  const text = readFileSync(source, "utf8").replace(/^version: .*$/m, "version: 9.9.9");
  writeFileSync(join(dir, "cards", "kb-resolver@9.9.9.yaml"), text);
}

/** Parse the emitted DOT, refusing to assert anything else about a file that did not. */
function reparse(dot: string) {
  const parsed = parseDot(dot, "factory.dot");
  expect(hasErrors(parsed.diagnostics), parsed.diagnostics.map((d) => d.message).join("; ")).toBe(
    false,
  );
  if (parsed.graph === undefined) throw new Error("the exported DOT did not parse");
  return parsed.graph;
}

describe("the exported pipeline", () => {
  it("is a DOT Attractor's own grammar and lint rules both accept", () => {
    const result = exportPipeline(bundleCopy("clean"), "attractor");
    const graph = reparse(result.dot);
    /* The publish gate's exact test (`checkFactoryDot`), so "the command wrote something"
       and "the something is runnable" are not allowed to be the same claim. */
    expect(lintAttractor(graph, result.dot, "factory.dot")).toEqual([]);
  });

  it("carries the disclosure header, naming the format and the source it came from", () => {
    const dir = bundleCopy("header");
    const result = exportPipeline(dir, "attractor");

    expect(result.format).toBe("attractor");
    expect(result.source).toContain("header");
    expect(result.dot.startsWith("// Attractor-compatible DOT")).toBe(true);
    /* One name off each scope's list. The list itself is derived and is held to
       `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` in `lib/core/attractor/emit.test.ts`; what this
       asserts is that the export carries it at all, which is the only reason a person
       reading the file on another machine ever learns any of it. */
    for (const missing of ["goal_gate", "timeout", "loop_restart", "model_stylesheet"]) {
      expect(result.dot.includes(missing), `the header does not mention \`${missing}\``).toBe(true);
    }
  });

  it("gives every carded node its prompt and its card pin", () => {
    // The two claims doc 1 §0.1.2 and §4 make about the artefact: the spec is the payload,
    // and the pin says which card version produced it.
    const graph = reparse(exportPipeline(bundleCopy("payload"), "attractor").dot);
    const carded = graph.nodes.filter((node) => node.attrs.card !== undefined);
    expect(carded.length).toBeGreaterThan(0);
    for (const node of carded) {
      expect(node.attrs.prompt, `\`${node.id}\` has a card and no prompt`).toBeDefined();
      expect(node.attrs.card).toMatch(/@\d+\.\d+\.\d+$/);
    }
  });

  it("reports a warning and exports anyway", () => {
    /* A card in `cards/` that no node pins is `bundle/orphan-card`, a warning. It is worth
       telling somebody about beside a file they are going to run, and it is not a reason to
       withhold the file: the pipeline the DOT describes is unaffected by a card nothing in
       the topology mentions. */
    const dir = bundleCopy("orphan");
    addOrphanCard(dir);

    const result = exportPipeline(dir, "attractor");
    expect(result.diagnostics.map((d) => d.code)).toContain("bundle/orphan-card");
    expect(result.diagnostics.every((d) => d.severity !== "error")).toBe(true);
    reparse(result.dot);
  });

  it("exports a bundle the engine reports errors on, when every node still has a card", () => {
    /* The gate is `lib/core/gate.ts`'s named list plus one condition checked on the graph,
       and no longer "any error". An edge between two cards that declare no ports is
       `bundle/port-mismatch` at ERROR severity, and the pipeline compiled from it is
       complete: every node has its type, its label and its prompt. Withholding the file
       over it was severity answering a question nobody asked it, and it made
       `darkprint import` write a folder this command would not read back.

       The fixture is an imported draft, which is exactly the bundle that used to be
       refused, so this cell fails the moment the two verbs stop agreeing again. */
    const draft = importPipeline("tests/attractor-corpus/parallel-fan-in.dot", {
      as: "mara-veil",
      out: join(scratch, "imported-draft"),
    });
    const result = exportPipeline(draft.root, "attractor");

    expect(result.diagnostics.some((d) => d.code === "bundle/port-mismatch")).toBe(true);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    const graph = reparse(result.dot);
    expect(lintAttractor(graph, result.dot, "factory.dot")).toEqual([]);
    for (const node of graph.nodes.filter((n) => n.attrs.card !== undefined)) {
      expect(node.attrs.prompt, `\`${node.id}\` has a card and no prompt`).toBeDefined();
    }
  });

  it("still refuses an author's own declared prohibition, which is not an inference", () => {
    /* Rule 3 of `gate.ts`: `bundle/prohibition-violated` is the one blocking code that is
       not about legibility. The card says it must never receive an `acceptance-criteria`
       and the topology wires one in, and honouring that is doing as the author asked. */
    const dir = bundleCopy("prohibited", "starter-software-factory");
    const dot = join(dir, "topology.dot");
    const source = readFileSync(dot, "utf8");
    /* The starter's own demonstration switch, thrown on purpose: `code-builder` declares
       `cannot: [acceptance-criteria]` and `spec-planner` outputs one, and the edge between
       them is the edge that blueprint exists to leave out. */
    expect(source).toContain('builder  [card="code-builder@1.0.0"]');
    expect(source).not.toContain("planner  -> builder");
    writeFileSync(dot, source.replace(/\n}\s*$/, "\n  planner -> builder;\n}\n"));

    expect(() => exportPipeline(dir, "attractor")).toThrow(CliError);
    expect(() => exportPipeline(dir, "attractor")).toThrow(/does not resolve/);
  });

  it("refuses a bundle with errors instead of writing a pipeline nobody can run", () => {
    /* A node pinning a card the folder does not hold. The bundle still RESOLVES — that node
       simply arrives with no card — so the emitter would happily write a graph whose middle
       step has no `prompt`. That file is worse than no file: it looks complete. */
    const dir = bundleCopy("missing-card");
    rmSync(join(dir, "cards"), { recursive: true, force: true });
    mkdirSync(join(dir, "cards"));

    expect(() => exportPipeline(dir, "attractor")).toThrow(CliError);
    expect(() => exportPipeline(dir, "attractor")).toThrow(/does not resolve/);
    expect(() => exportPipeline(dir, "attractor")).toThrow(/darkprint validate/);
  });

  it("refuses a format it does not write, and names the ones it does", () => {
    const dir = bundleCopy("format");
    expect(() => exportPipeline(dir, "mermaid")).toThrow(CliError);
    expect(() => exportPipeline(dir, "mermaid")).toThrow(/attractor/);
    // The empty string is what a caller passes when no flag was given, and it must not be
    // read as "the default one".
    expect(() => exportPipeline(dir, "")).toThrow(CliError);
    expect(EXPORT_FORMATS).toEqual(["attractor"]);
  });

  it("refuses a folder with no topology, without naming a verb the caller did not run", () => {
    const dir = join(scratch, "empty");
    mkdirSync(dir, { recursive: true });
    expect(() => exportPipeline(dir, "attractor")).toThrow(/topology\.dot/);
    expect(() => exportPipeline(dir, "attractor")).not.toThrow(/^validate:/);
  });
});

describe("`darkprint export`, as a person runs it", () => {
  it("puts the DOT on stdout and nothing else, so a redirect leaves a runnable file", async () => {
    const dir = bundleCopy("stdout");
    const io = collectingIo();
    const code = await runCli(["export", dir, "--attractor"], io);

    expect(code).toBe(0);
    /* Not `stderr === []`: a bundle the archive publishes can still carry a warning, and
       `frontline-triage` does. What the redirect depends on is that stdout holds the whole
       file and only the file. */
    reparse(io.stdout.join(""));
    expect(io.stdout.join("").endsWith("}\n")).toBe(true);
    expect(io.stderr.join("")).not.toContain("digraph");
  });

  it("takes the flag before the directory as well as after it", async () => {
    /* The parser assumes a `--flag` takes the token after it, so `--attractor ./dir` used to
       swallow the directory and export the current one instead — a wrong answer that reads
       like a right one, which is why the switch set exists and why this cell names both
       orders. */
    const dir = bundleCopy("order");
    const before = collectingIo();
    const after = collectingIo();

    expect(await runCli(["export", "--attractor", dir], before)).toBe(0);
    expect(await runCli(["export", dir, "--attractor"], after)).toBe(0);
    expect(before.stdout.join("")).toBe(after.stdout.join(""));
  });

  it("keeps warnings off stdout, so they cannot land inside the pipeline", async () => {
    const dir = bundleCopy("streams");
    addOrphanCard(dir);

    const io = collectingIo();
    expect(await runCli(["export", dir, "--attractor"], io)).toBe(0);
    expect(io.stderr.join("")).toContain("no node instantiates it");
    reparse(io.stdout.join(""));
  });

  it("refuses with no format, names the flag, and writes nothing to stdout", async () => {
    const io = collectingIo();
    const code = await runCli(["export", bundleCopy("no-flag")], io);

    expect(code).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join("")).toContain("--attractor");
  });

  it("renders a refusal as one line and returns 1", async () => {
    const io = collectingIo();
    const code = await runCli(["export", join(scratch, "nowhere"), "--attractor"], io);

    expect(code).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join("")).toContain("topology.dot");
  });

  it("is on the published usage block", async () => {
    const io = collectingIo();
    await runCli(["--help"], io);
    expect(io.stderr.join("")).toContain("darkprint export [<dir>] --attractor");
  });
});
