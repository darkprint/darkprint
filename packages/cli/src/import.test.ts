/* ============================================================
   `darkprint import <pipeline.dot> --as <handle> --out <dir>`

   Three things are checked here and they are separate claims.
   The FOLDER: what lands on disk is a bundle the same engine reads
   back, so an import is validatable, exportable and publishable by
   the person who looked at it. The ATTRIBUTION: every card says who
   brought it and where the prose came from, and the command refuses
   to run without a handle. The GATE: the command writes a folder
   the engine reports errors on, because `isStorable`'s named list
   and `hasErrors` answer different questions and this is the call
   site where they differ.

   The round trip itself is not tested here — it is
   `tests/attractor-round-trip.test.ts`'s whole subject, over a
   corpus. What this file adds is the verb.
   ============================================================ */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { DERIVED_PROVENANCE_PREFIX, hasErrors, isStorable } from "../../../lib/core";
import { validateBundle } from "../../../lib/server/engine";
import { CliError } from "./errors";
import { exportPipeline } from "./export";
import { importPipeline } from "./import";
import { collectingIo } from "./io";
import { runCli } from "./run";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-import-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const CORPUS = "tests/attractor-corpus";

/** A fresh, absent directory for one cell to write into. */
function target(name: string): string {
  return join(scratch, name);
}

/** The written folder, read back in the shape `validateBundle` takes. */
function folder(root: string): { dot: string; cardFiles: Record<string, string> } {
  const cardFiles: Record<string, string> = {};
  for (const name of readdirSync(join(root, "cards"))) {
    cardFiles[`cards/${name}`] = readFileSync(join(root, "cards", name), "utf8");
  }
  return { dot: readFileSync(join(root, "topology.dot"), "utf8"), cardFiles };
}

describe("what lands on disk", () => {
  it("is a bundle the engine reads back, with one card per node", () => {
    const out = target("shape");
    const result = importPipeline(join(CORPUS, "conditional-routing.dot"), {
      as: "mara-veil",
      out,
    });

    expect(result.files[0]).toBe("topology.dot");
    expect(result.files).toHaveLength(5);
    expect(existsSync(join(out, "topology.dot"))).toBe(true);

    const read = folder(out);
    const checked = validateBundle({
      manifest: { slug: "conditional-routing", title: "t", summary: "", tags: [] },
      ...read,
    });
    expect(checked.blueprint?.nodes.map((n) => n.nodeId).sort()).toEqual([
      "auto",
      "classify",
      "person",
      "route",
    ]);
  });

  it("carries the prompt into the spec, unedited", () => {
    const out = target("prose");
    importPipeline(join(CORPUS, "conditional-routing.dot"), { as: "mara-veil", out });
    const card = readFileSync(join(out, "cards", "classify@0.1.0.yaml"), "utf8");
    /* The whole reason the two attribution fields exist: this sentence is somebody else's,
       and it reaches the card exactly as they wrote it. */
    expect(card).toContain("Read the ticket and score your confidence between 0 and 1.");
  });

  it("keeps the escapes Attractor's String rule defines", () => {
    /* DarkPrint's DOT lexer implements Graphviz's rule, where `\\n` is a label directive and
       not an escape. The importer applies the other half. Without it the spec would carry a
       literal backslash and an `n`, and a person reading the card would see the difference
       long before anybody's runner did. */
    const out = target("escapes");
    importPipeline(join(CORPUS, "escapes.dot"), { as: "mara-veil", out });
    const read = folder(out);
    const checked = validateBundle({
      manifest: { slug: "escapes", title: "t", summary: "", tags: [] },
      ...read,
    });
    const spec = checked.blueprint?.nodes.find((n) => n.nodeId === "read")?.card.spec ?? "";
    expect(spec).toContain("\n\t1. the path");
    expect(spec).not.toContain("\\n");
  });

  it("comes back out through `export` as a pipeline Attractor accepts", () => {
    /* The two verbs meeting on disk, which is the property a person actually uses: read
       somebody's pipeline, look at the folder, hand it back. */
    const out = target("exportable");
    importPipeline(join(CORPUS, "parallel-fan-out.dot"), { as: "mara-veil", out });
    const exported = exportPipeline(out, "attractor");
    expect(exported.dot).toContain("shape=component");
    expect(exported.dot).toContain("// Attractor-compatible DOT");
  });
});

describe("attribution", () => {
  it("names the importer in `author` and the pipeline in `provenance`", () => {
    const out = target("attribution");
    importPipeline(join(CORPUS, "minimal.dot"), { as: "mara-veil", out });
    const card = readFileSync(join(out, "cards", "answer@0.1.0.yaml"), "utf8");

    expect(card).toContain('author: "mara-veil"');
    expect(card).toContain(`provenance: "${DERIVED_PROVENANCE_PREFIX}`);
    expect(card).toContain("minimal.dot");
    /* A version nobody publishes by reflex. §4 makes a published version immutable and the
       first thing this draft needs is to be edited. */
    expect(card).toContain('version: "0.1.0"');
  });

  it("refuses to compile a pipeline into cards with nobody's name on them", () => {
    expect(() =>
      importPipeline(join(CORPUS, "minimal.dot"), { as: "   ", out: target("nameless") }),
    ).toThrow(CliError);
    expect(() =>
      importPipeline(join(CORPUS, "minimal.dot"), { as: "", out: target("nameless-2") }),
    ).toThrow(/--as/);
    expect(existsSync(target("nameless"))).toBe(false);
  });
});

describe("the refusals", () => {
  it("refuses a directory that already holds something, before writing a byte", () => {
    const out = target("occupied");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "README.md"), "somebody else's work\n");

    expect(() => importPipeline(join(CORPUS, "minimal.dot"), { as: "mara-veil", out })).toThrow(
      /not empty/,
    );
    expect(readdirSync(out)).toEqual(["README.md"]);
  });

  it("refuses a file that is not there", () => {
    expect(() =>
      importPipeline(join(scratch, "nowhere.dot"), { as: "mara-veil", out: target("nowhere") }),
    ).toThrow(/not a file I can read/);
  });

  it("refuses a file that is not a pipeline, and writes nothing", () => {
    /* `dot/parse-error` is one of the twelve codes `gate.ts` names, so this refusal is the
       named list doing its job rather than `hasErrors` doing it by accident. */
    const broken = join(scratch, "broken.dot");
    writeFileSync(broken, "this is not a graph at all\n");
    const out = target("broken-out");

    expect(() => importPipeline(broken, { as: "mara-veil", out })).toThrow(CliError);
    expect(() => importPipeline(broken, { as: "mara-veil", out })).toThrow(/cannot be read/);
    expect(existsSync(out)).toBe(false);
  });
});

describe("storable, and not approved", () => {
  it("writes a folder the engine reports errors on, and says what they are", () => {
    /* The discriminating cell for item 02, on a real folder. An imported draft has no ports
       on any card, so every edge is `bundle/port-mismatch` at error severity. `hasErrors`
       says rejected; the named blocking set says the folder parses, is addressable and is
       attributable, so it is written and the findings are printed. If the verb ever gates on
       `hasErrors` again, this cell reds and says which question it started asking. */
    const out = target("storable");
    const result = importPipeline(join(CORPUS, "parallel-fan-in.dot"), { as: "mara-veil", out });

    expect(hasErrors(result.diagnostics)).toBe(true);
    expect(isStorable(result.diagnostics)).toBe(true);
    expect(result.diagnostics.map((d) => d.code)).toContain("bundle/port-mismatch");
    expect(existsSync(join(out, "topology.dot"))).toBe(true);
  });

  it("writes a draft whose card is missing its spec, and names the node that has to fill it", () => {
    /* An Attractor node may carry no `prompt` — a `tool` node runs a `tool_command` and a
       `wait.human` node may simply wait — and a DarkPrint card must carry a `spec`. The
       draft is written with an empty one and the engine reports `card/missing-field`, which
       `gate.ts` narrows by the field it names: `spec` is not the card's address, so the
       folder is held and the missing half is work to be done rather than a refusal.

       This is the case that forced the narrowing. Holding `card/missing-field` on the
       refusing side as a whole code would make `darkprint import no-prompt.dot` refuse a
       legible, addressed, attributed folder because one field is still to be written. */
    const out = target("no-prompt");
    const result = importPipeline(join(CORPUS, "no-prompt.dot"), { as: "mara-veil", out });

    expect(existsSync(join(out, "cards", "sign-off@0.1.0.yaml"))).toBe(true);
    expect(readFileSync(join(out, "cards", "sign-off@0.1.0.yaml"), "utf8")).toContain('spec: ""');
    expect(result.diagnostics.some((d) => d.message.includes("`sign_off` carries no `prompt`"))).toBe(
      true,
    );
    expect(result.diagnostics.some((d) => d.code === "card/missing-field" && d.severity === "error")).toBe(
      true,
    );
    expect(isStorable(result.diagnostics)).toBe(true);
  });
});

describe("`darkprint import`, as a person runs it", () => {
  it("puts the file list on stdout and every finding on stderr", async () => {
    const out = target("cli");
    const io = collectingIo();
    const code = await runCli(
      ["import", join(CORPUS, "supervisor-loop.dot"), "--as", "mara-veil", "--out", out],
      io,
    );

    expect(code).toBe(0);
    expect(io.stdout.join("")).toContain("topology.dot");
    expect(io.stdout.join("")).toContain("cards/supervise@0.1.0.yaml");
    /* The word a person needs and the list they need are on different streams, so
       `| wc -l` counts files and not sentences. */
    expect(io.stdout.join("")).not.toContain("DRAFT");
    expect(io.stderr.join("")).toContain("DRAFT");
    expect(io.stderr.join("")).toContain("derived:attractor");
  });

  it("returns 0 with errors in the list, because a draft is not a rejection", async () => {
    const io = collectingIo();
    const code = await runCli(
      ["import", join(CORPUS, "weights.dot"), "--as", "mara-veil", "--out", target("cli-errors")],
      io,
    );
    expect(code).toBe(0);
    expect(io.stderr.join("")).toContain("error: Edge");
  });

  it("names each missing flag on its own, and writes nothing", async () => {
    const noFile = collectingIo();
    expect(await runCli(["import", "--as", "mara-veil", "--out", target("x")], noFile)).toBe(1);
    expect(noFile.stderr.join("")).toContain("name the pipeline");

    const noHandle = collectingIo();
    expect(
      await runCli(["import", join(CORPUS, "minimal.dot"), "--out", target("y")], noHandle),
    ).toBe(1);
    expect(noHandle.stderr.join("")).toContain("--as");

    const noOut = collectingIo();
    expect(
      await runCli(["import", join(CORPUS, "minimal.dot"), "--as", "mara-veil"], noOut),
    ).toBe(1);
    expect(noOut.stderr.join("")).toContain("--out");

    expect(noFile.stdout).toEqual([]);
    expect(existsSync(target("x"))).toBe(false);
    expect(existsSync(target("y"))).toBe(false);
  });

  it("renders a refusal as one line and returns 1", async () => {
    const io = collectingIo();
    const code = await runCli(
      ["import", join(scratch, "absent.dot"), "--as", "mara-veil", "--out", target("absent")],
      io,
    );
    expect(code).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.stderr.join("")).toContain("not a file I can read");
  });

  it("is on the published usage block, in both of them", async () => {
    const io = collectingIo();
    await runCli(["--help"], io);
    expect(io.stderr.join("")).toContain("darkprint import <pipeline.dot> --as <handle> --out <dir>");
    /* `packages/mcp/src/cli.ts` holds a second usage block, because it is the only file in
       either package that touches a real stream. The two drift silently unless something
       reads both. */
    const shim = readFileSync("packages/mcp/src/cli.ts", "utf8");
    expect(shim).toContain("darkprint import <pipeline.dot> --as <handle> --out <dir>");
  });
});
