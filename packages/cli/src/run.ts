/* ============================================================
   darkprint CLI — argv in, exit code out
   D-270-03(2): the verbs return DATA and this file alone renders.
   Everything reaches the caller through `io`; nothing here touches
   `process.stdout` or `process.stderr`, which is what lets a suite
   drive a whole command in-process and read what a user sees.

   ── the admissible message form ──
   A rendering carries what the server sent plus the caller's own
   arguments. No credential, no endpoint, no stack, never a raw
   driver or HTTP body. `CliError` and `RegistryError` messages are
   already written to that rule by the modules that own them, so
   this file prints them and adds no wording of its own beyond the
   verb's name.
   ============================================================ */

import { hasErrors, type Diagnostic } from "../../../lib/core";
import { bump } from "./bump";
import { clone } from "./clone";
import { exportPipeline } from "./export";
import { importPipeline } from "./import";
import type { Io } from "./io";
import { report, RUN_MANIFEST } from "./report";
import { validate } from "./validate";

const USAGE = `darkprint — the DarkPrint registry from your terminal.

  darkprint clone <owner>/<slug> [--version <v> | --digest <d>] [--out <dir>]
  darkprint validate [<dir>]
  darkprint export [<dir>] --attractor
  darkprint import <pipeline.dot> --as <handle> --out <dir>
  darkprint bump [<dir>] --declare <version> --target <owner>/<slug>
  darkprint report <run-dir> --target <owner>/<slug> --cost <units>
  darkprint mcp

Environment:
  DARKPRINT_URL      registry base URL (default https://darkprint.io)
  DARKPRINT_API_KEY  an API key, which raises the rate limit ceiling
  DARKPRINT_SESSION  a signed-in session cookie. report is the one verb that
                     writes, and the route that takes a run report reads a
                     session: no write route accepts an API key.
`;

/**
 * Run one command.
 *
 * Returns the exit code rather than setting one: a caller that is a test wants the number,
 * and a caller that is the bin shim can assign it.
 *
 * **0 for success, 1 for everything else, and the flatness is deliberate.** A usage error
 * would conventionally be 2, and `packages/mcp/src/cli.ts` already shipped 1 for an unknown
 * command and 0 for an explicit `--help`. C1 grants that file for a dispatcher extension
 * ONLY, so introducing a 2 would change an exit code T220 shipped — through a delegation
 * rather than through a decision anybody made. The published convention wins over the
 * conventional one; if a 2 is wanted it is a ruling, not a refactor.
 */
export async function runCli(argv: readonly string[], io: Io): Promise<number> {
  const command = argv[0];
  if (command === undefined || command === "--help" || command === "-h") {
    io.err(USAGE);
    return command === undefined ? 1 : 0;
  }

  try {
    switch (command) {
      case "validate":
        return runValidate(argv.slice(1), io);
      case "export":
        return runExport(argv.slice(1), io);
      case "import":
        return runImport(argv.slice(1), io);
      case "clone":
        return await runClone(argv.slice(1), io);
      case "bump":
        return await runBump(argv.slice(1), io);
      case "report":
        return await runReport(argv.slice(1), io);
      default:
        io.err(`darkprint: unknown command \`${command}\`.\n\n${USAGE}`);
        return 1;
    }
  } catch (thrown) {
    /* `message` alone, deliberately: a stack or a `cause` chain would put an endpoint or a
       driver string in front of a user, which the admissible-message clause forbids. The
       cause still travels on the error for anything that wants it. */
    io.err(`${thrown instanceof Error ? thrown.message : String(thrown)}\n`);
    return 1;
  }
}

/* --------------------- the verbs, rendered --------------------- */

function runValidate(args: readonly string[], io: Io): number {
  const { positional } = parseFlags(args);
  const result = validate(positional[0] ?? ".");

  if (result.diagnostics.length === 0) {
    io.out("validate: no findings.\n");
    return 0;
  }
  for (const diagnostic of result.diagnostics) io.out(renderDiagnostic(diagnostic));
  /* An exit code that answers "may this be published", which is the question a caller in a
     script is asking. Warnings are findings and not failures — the same split the publish
     gate makes, where only an error severity refuses a release. */
  return hasErrors(result.diagnostics) ? 1 : 0;
}

/**
 * The DOT to stdout, everything else to stderr.
 *
 * The split is the whole ergonomics of the verb: `darkprint export ./bundle --attractor >
 * factory.dot` has to leave a runnable file behind, so a warning printed to stdout would
 * end up inside the pipeline as a line no DOT parser accepts. Nothing is written to disk
 * here. A verb that writes files needs a path, an overwrite rule and a decision about what
 * happens when the file is already there, and the shell already owns all three.
 *
 * The format is required rather than defaulted. `export` with no format would mean
 * `attractor` today and would have to keep meaning it forever, or silently change under
 * every script somebody wrote against it.
 */
function runExport(args: readonly string[], io: Io): number {
  const { flags, positional } = parseFlags(args, EXPORT_SWITCHES);
  if (flags.attractor === undefined) {
    io.err("export: name the format. `--attractor` is the only one this build writes.\n");
    return 1;
  }

  const result = exportPipeline(positional[0] ?? ".", "attractor");
  for (const diagnostic of result.diagnostics) io.err(renderDiagnostic(diagnostic));
  io.out(result.dot);
  return 0;
}

/**
 * The written file list to stdout, every finding to stderr.
 *
 * The same split `export` makes, for a weaker but still real reason: `darkprint import p.dot
 * --as me --out ./draft | head` should show what landed, and a warning about a node with no
 * `prompt` is not part of that list.
 *
 * **Returns 0 with errors in the list, and that is the point of the verb.** A draft
 * synthesised from a foreign pipeline has no ports on any card, so the engine reports every
 * edge as `bundle/port-mismatch` — errors, correctly, and not a reason to refuse to write
 * the folder. `importPipeline` refuses on `isStorable`'s named list instead, so a 1 here
 * means the file could not be read as a pipeline at all. What is left to write is printed,
 * not hidden.
 */
function runImport(args: readonly string[], io: Io): number {
  const { flags, positional } = parseFlags(args);
  const file = positional[0];
  if (file === undefined) {
    io.err("import: name the pipeline to read, as a path to a `.dot` file.\n");
    return 1;
  }
  if (flags.as === undefined || flags.as === "") {
    io.err(
      "import: say who this draft belongs to with `--as <handle>`. " +
        "A `prompt` is somebody's writing.\n",
    );
    return 1;
  }
  if (flags.out === undefined || flags.out === "") {
    io.err("import: give --out <dir>. A bundle is a folder, so it cannot go to stdout.\n");
    return 1;
  }

  const result = importPipeline(file, { as: flags.as, out: flags.out });
  for (const diagnostic of result.diagnostics) io.err(renderDiagnostic(diagnostic));
  io.out(`import: wrote ${result.files.length} files to ${result.root}\n`);
  for (const path of result.files) io.out(`  ${path}\n`);
  /* The draft is a draft and the wording says so once, on stderr, beside the findings that
     are the work left to do. Not on stdout: that stream is the file list. */
  io.err(
    "import: this is a DRAFT. Every card carries `provenance: derived:attractor`, and the " +
      "prompts in it are somebody else's writing.\n",
  );
  return 0;
}

async function runClone(args: readonly string[], io: Io): Promise<number> {
  const { flags, positional } = parseFlags(args);
  const target = positional[0];
  if (target === undefined) {
    io.err("clone: name a blueprint as <owner>/<slug>.\n");
    return 1;
  }

  const result = await clone(target, {
    ...(flags.version === undefined ? {} : { version: flags.version }),
    ...(flags.digest === undefined ? {} : { digest: flags.digest }),
    ...(flags.out === undefined ? {} : { out: flags.out }),
  });
  io.out(`clone: wrote ${result.files.length} files to ${result.root}\n`);
  for (const file of result.files) io.out(`  ${file}\n`);
  return 0;
}

async function runBump(args: readonly string[], io: Io): Promise<number> {
  const { flags, positional } = parseFlags(args);
  const declare = flags.declare;
  if (declare === undefined) {
    io.err("bump: give --declare <version>.\n");
    return 1;
  }

  const diagnostics = await bump(positional[0] ?? ".", declare, {
    ...(flags.target === undefined ? {} : { target: flags.target }),
  });

  /* The empty array is success (D-270-03(3)). `<declared>` is the caller's own argument,
     which the admissible-message clause permits. */
  if (diagnostics.length === 0) {
    io.out(`bump: ${declare} is enough.\n`);
    return 0;
  }
  for (const diagnostic of diagnostics) io.err(renderDiagnostic(diagnostic));
  return 1;
}

/**
 * What was claimed, to stdout; what was believed and what came back, to stderr.
 *
 * The same split `export` and `import` make, for a sharper reason here: this verb WRITES,
 * so a person needs to be able to see afterwards exactly what they told the registry
 * happened. stdout is that record and nothing else goes on it.
 *
 * The stderr half carries the two things a reader has to be able to doubt. **Which manifest
 * key the start instant came from**, because the Attractor spec names no field for it and
 * this had to guess between eight spellings — a guess stated is different from a guess made.
 * And **the node outcomes**, because a run that failed halfway is a perfectly reportable run
 * and the registry has no field for its outcome, so the only place a person can notice they
 * are reporting a broken run is here, before they read the median it joined.
 */
async function runReport(args: readonly string[], io: Io): Promise<number> {
  const { flags, positional } = parseFlags(args);
  const dir = positional[0];
  if (dir === undefined) {
    io.err("report: name the run directory Attractor wrote.\n");
    return 1;
  }

  const cost = flags.cost === undefined || flags.cost === "" ? undefined : Number(flags.cost);
  /* Refused HERE rather than by `Number.isFinite` inside the verb, because `--cost abc` and
     an absent `--cost` are different mistakes and `Number("abc")` is `NaN`, which would
     reach the verb looking exactly like a supplied value. */
  if (cost !== undefined && Number.isNaN(cost)) {
    io.err(`report: --cost must be a number. \`${flags.cost}\` is not one.\n`);
    return 1;
  }
  const inputSize =
    flags["input-size"] === undefined || flags["input-size"] === ""
      ? undefined
      : Number(flags["input-size"]);
  if (inputSize !== undefined && !Number.isInteger(inputSize)) {
    io.err(`report: --input-size must be a whole number. \`${flags["input-size"]}\` is not one.\n`);
    return 1;
  }

  const result = await report(dir, {
    ...(flags.target === undefined ? {} : { target: flags.target }),
    ...(cost === undefined ? {} : { cost }),
    ...(flags.model === undefined ? {} : { model: flags.model }),
    ...(flags.provider === undefined ? {} : { provider: flags.provider }),
    ...(flags.hardware === undefined ? {} : { hardware: flags.hardware }),
    ...(flags.harness === undefined ? {} : { harnessVersion: flags.harness }),
    ...(inputSize === undefined ? {} : { inputSize }),
    ...(flags.digest === undefined ? {} : { digest: flags.digest }),
  });

  if (result.startedFrom !== undefined) {
    io.err(
      `report: read the start time from \`${result.startedFrom}\` in ${RUN_MANIFEST}. The ` +
        "Attractor spec names no field for it.\n",
    );
  }
  const outcomes = Object.entries(result.outcomes);
  if (outcomes.length > 0) {
    io.err(
      `report: ${outcomes.map(([outcome, n]) => `${n} ${outcome}`).join(", ")}. The registry ` +
        "has no field for a run's outcome, so a failed run and a clean one are reported the " +
        "same way.\n",
    );
  }

  io.out(`report: sent to ${result.owner}/${result.slug}.\n`);
  for (const [key, value] of Object.entries(result.sent)) {
    io.out(`  ${key} ${String(value)}\n`);
  }
  /* The aggregate the route answers with, printed with its unit named every time. D-180-01
     refuses the normalisation these figures would need to go on the 0-100 scorecard axis,
     so a number here without `costUnits` beside it is a quantity in no unit at all. */
  if (result.reported !== undefined) {
    const a = result.reported;
    io.out(
      `  reported ${a.runs} runs on ${a.model}, median ${a.median} costUnits ` +
        `(p10 ${a.spread.p10}, p90 ${a.spread.p90}, ${a.excluded} excluded)` +
        `${a.isSample ? ", still a sample" : ""}\n`,
    );
  }
  return 0;
}

/**
 * One diagnostic, `message` AND `hint`, on separate lines.
 *
 * D-270-04(2) is the whole reason this function exists rather than a `.message` at each
 * call site: `checkDeclaredBump` splits its refusal, putting the reasons-free sentence in
 * `message` and `inferred.reasons` in `hint`. Printing `message` alone satisfies the verb
 * and fails the user, which is exactly what AC2 forbids — and it is the natural thing to
 * write, so it is written once, here, where it can be got right once.
 */
function renderDiagnostic(diagnostic: Diagnostic): string {
  const where = diagnostic.location?.file;
  const head = where === undefined ? "" : `${where}: `;
  const lines = [`${head}${diagnostic.severity}: ${diagnostic.message}`];
  if (diagnostic.hint !== undefined && diagnostic.hint !== "") lines.push(`  ${diagnostic.hint}`);
  return `${lines.join("\n")}\n`;
}

/**
 * The flags that carry no value, by verb.
 *
 * `--attractor` names a format, and the parser below assumes every `--flag` takes the token
 * after it. Without this set `darkprint export --attractor ./bundle` reads the directory as
 * the flag's value and exports the current one instead, which is a wrong answer rather than
 * a refusal. Declared per call site rather than globally, so a verb cannot accidentally
 * inherit another verb's switches.
 */
const EXPORT_SWITCHES: ReadonlySet<string> = new Set(["attractor"]);

/**
 * `--flag value`, `--flag=value` and a bare `--switch`, with everything else positional.
 *
 * Deliberately small: the published command lines use long flags with values and nothing
 * else — no short forms, no clustering, no negation — so a general parser would be more
 * surface than the contract has.
 *
 * A name in `switches` never consumes the token after it, and its value is the empty string
 * whether it was written bare or as `--switch=anything`. A caller asks whether the switch is
 * `undefined`, not what it holds.
 */
function parseFlags(
  args: readonly string[],
  switches: ReadonlySet<string> = new Set(),
): {
  flags: Record<string, string>;
  positional: string[];
} {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      const name = body.slice(0, eq);
      flags[name] = switches.has(name) ? "" : body.slice(eq + 1);
      continue;
    }
    if (switches.has(body)) {
      flags[body] = "";
      continue;
    }
    const next = args[i + 1];
    /* A flag whose value is missing takes the empty string rather than swallowing the next
       flag: `--declare --target x` is a mistake, and consuming `--target` would turn it
       into a confusing refusal about a version called `--target`. */
    if (next === undefined || next.startsWith("--")) flags[body] = "";
    else {
      flags[body] = next;
      i++;
    }
  }
  return { flags, positional };
}
