#!/usr/bin/env node
/* ============================================================
   darkprint — the command `/mcp` advertises
   `components/mcp/clients.ts` publishes `npx -y darkprint mcp` in
   all six client configurations and SEAM-87 restates it, so the
   package is `darkprint` and `mcp` is a SUBCOMMAND (D-220-08,
   F-220-H). A package named `@darkprint/mcp` with a bare bin would
   be a different command from the one the site tells six clients
   to run.

   Every message here goes to stderr. stdout is the JSON-RPC wire
   and a single stray line on it kills the session (see `rpc.ts`).
   ============================================================ */

import { runCli } from "../../cli/src/index";
import { optionsFromEnv } from "./registry";
import { runServer } from "./server";

const USAGE = `darkprint — the DarkPrint registry from your terminal and from an agent.

  npx -y darkprint mcp                      serve the registry over MCP (stdio)
  npx -y darkprint clone <owner>/<slug> [--version <v> | --digest <d>] [--out <dir>]
  npx -y darkprint validate [<dir>]
  npx -y darkprint export [<dir>] --attractor
  npx -y darkprint import <pipeline.dot> --as <handle> --out <dir>
  npx -y darkprint bump [<dir>] --declare <version> --target <owner>/<slug>
  npx -y darkprint report <run-dir> --target <owner>/<slug> --cost <units>

Environment:
  DARKPRINT_URL      registry base URL (default https://darkprint.io)
  DARKPRINT_API_KEY  an API key, which raises the rate limit ceiling
  DARKPRINT_SESSION  a signed-in session cookie. report is the one verb that
                     writes, and the route that takes a run report reads a
                     session: no write route accepts an API key.
`;

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

  /* Every other verb is T270's, and this is the whole of the dispatcher extension C1
     granted: ONE distributable, so `npx -y darkprint mcp` and `npx -y darkprint validate`
     are the same package and the site's six client configs keep working unchanged.

     The two real streams are passed HERE and nowhere else. `packages/cli` renders through
     `io` alone (D-270-03(1)) so a suite can drive a whole command in-process; this shim is
     the one place that turns that into a terminal. `out` goes to stdout and `err` to
     stderr — and note that this is the only branch where stdout is NOT the JSON-RPC wire,
     which is why the rule at the top of this file is about the `mcp` branch specifically. */
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
