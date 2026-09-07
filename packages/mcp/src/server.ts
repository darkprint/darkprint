/* ============================================================
   darkprint mcp: the stdio transport
   Glue only. The protocol lives in `protocol.ts` and the tools are
   executed over HTTP, so this file is what turns a pipe into an
   MCP server and nothing more.
   ============================================================ */

import { handleMethod } from "./protocol";
import type { RegistryOptions } from "./registry";
import { serve } from "./rpc";
import { httpExecutor } from "./tools";

/** Runs the server until stdin closes. */
export async function runServer(
  options: RegistryOptions,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  const executor = httpExecutor(options);
  await serve(input, output, (method, params) => handleMethod(method, params, executor));
}
