#!/usr/bin/env node
/* ============================================================
   darkprint: the bin
   `mcp` serves the registry over stdio; every other verb is the
   CLI's and is dispatched into `packages/cli`. One distributable,
   so `npx -y darkprint mcp` and `npx -y darkprint validate` are the
   same package.

   Every message here goes to stderr. On the `mcp` branch stdout is
   the JSON-RPC wire and a single stray line on it kills the session.
   This file must never import `./local`: that module reaches the
   database driver, and the bundler would ship it to every reader.
   ============================================================ */

import { CLI_VERBS, NPX_INVOCATION, renderCliUsage, runCli, type CliVerb } from "../../cli/src/index";
import { optionsFromEnv } from "./registry";
import { runServer } from "./server";

/* `mcp` first here and last in `packages/cli/src/run.ts`: this shim is the bin of a package
   named for that subcommand, so it leads. The verbs come from the same table either way. */
const MCP_FIRST: readonly CliVerb[] = [
  ...CLI_VERBS.filter((verb) => verb.name === "mcp"),
  ...CLI_VERBS.filter((verb) => verb.name !== "mcp"),
];

const USAGE = renderCliUsage(
  "darkprint: the DarkPrint registry from your terminal and from an agent.",
  NPX_INVOCATION,
  MCP_FIRST,
  true,
);

export async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0];

  if (command === undefined || command === "--help" || command === "-h") {
    process.stderr.write(USAGE);
    /* Exit 0 for an explicit `--help` and 1 for no subcommand at all: one is what the caller
       asked for, the other is a caller who has not yet said anything. */
    return command === undefined ? 1 : 0;
  }

  if (command === "mcp") {
    await runServer(optionsFromEnv(process.env), process.stdin, process.stdout);
    return 0;
  }

  /* The two real streams are passed here and nowhere else: `packages/cli` renders through
     `io` alone so a suite can drive a whole command in-process. */
  return await runCli(argv, {
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  });
}

/* `require.main === module` rather than a bare call, so importing this file for a test does
   not start a server that then holds stdin open forever. */
if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`darkprint: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    },
  );
}
