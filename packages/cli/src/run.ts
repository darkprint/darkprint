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
import type { Io } from "./io";
import { validate } from "./validate";

const USAGE = `darkprint — the DarkPrint registry from your terminal.

  darkprint clone <owner>/<slug> [--version <v> | --digest <d>] [--out <dir>]
  darkprint validate [<dir>]
  darkprint bump [<dir>] --declare <version> --target <owner>/<slug>
  darkprint mcp

Environment:
  DARKPRINT_URL      registry base URL (default https://darkprint.io)
  DARKPRINT_API_KEY  an API key, which raises the rate limit ceiling
`;

/**
 * Run one command.
 *
 * Returns the exit code rather than setting one: a caller that is a test wants the number,
 * and a caller that is the bin shim can assign it. 0 for success, 1 for a refusal or a
 * bundle carrying errors, 2 for a command line this does not understand.
 */
export async function runCli(argv: readonly string[], io: Io): Promise<number> {
  const command = argv[0];
  if (command === undefined || command === "--help" || command === "-h") {
    io.err(USAGE);
    return command === undefined ? 2 : 0;
  }

  try {
    switch (command) {
      case "validate":
        return runValidate(argv.slice(1), io);
      case "clone":
        return await runClone(argv.slice(1), io);
      case "bump":
        return await runBump(argv.slice(1), io);
      default:
        io.err(`darkprint: unknown command \`${command}\`.\n\n${USAGE}`);
        return 2;
    }
  } catch (thrown) {
    /* `message` alone, deliberately: a stack or a `cause` chain would put an endpoint or a
       driver string in front of a user, which the admissible-message clause forbids. The
       cause still travels on the error for anything that wants it. */
    io.err(`${thrown instanceof Error ? thrown.message : String(thrown)}\n`);
    return 1;
  }
}

/* --------------------- the three verbs, rendered --------------------- */

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

async function runClone(args: readonly string[], io: Io): Promise<number> {
  const { flags, positional } = parseFlags(args);
  const target = positional[0];
  if (target === undefined) {
    io.err("clone: name a blueprint as <owner>/<slug>.\n");
    return 2;
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
    return 2;
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
 * `--flag value` and `--flag=value`, with everything else positional.
 *
 * Deliberately small: the published command lines use long flags with values and nothing
 * else — no short forms, no clustering, no negation — so a general parser would be more
 * surface than the contract has.
 */
function parseFlags(args: readonly string[]): {
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
      flags[body.slice(0, eq)] = body.slice(eq + 1);
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
