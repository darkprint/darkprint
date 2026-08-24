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

import { optionsFromEnv } from "./registry";
import { runServer } from "./server";

const USAGE = `darkprint mcp — serve the DarkPrint registry to an agent over MCP (stdio).

  npx -y darkprint mcp

Environment:
  DARKPRINT_URL      registry base URL (default https://darkprint.io)
  DARKPRINT_API_KEY  an API key, which raises the rate limit ceiling
`;

export async function main(argv: readonly string[]): Promise<number> {
  const command = argv[0];

  if (command === undefined || command === "--help" || command === "-h") {
    process.stderr.write(USAGE);
    /* Exit 0 for an explicit `--help` and 1 for no subcommand at all: one is what the caller
       asked for, the other is a caller who has not yet said anything. */
    return command === undefined ? 1 : 0;
  }

  if (command !== "mcp") {
    process.stderr.write(`darkprint: unknown command \`${command}\`.\n\n${USAGE}`);
    return 1;
  }

  await runServer(optionsFromEnv(process.env), process.stdin, process.stdout);
  return 0;
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
