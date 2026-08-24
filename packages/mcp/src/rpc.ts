/* ============================================================
   darkprint mcp — JSON-RPC 2.0 over stdio, with no dependencies
   D-220-08 ruled zero dependencies (G.3 option b), and the reason
   is not asceticism: `@modelcontextprotocol/sdk` is present in
   this repository's `node_modules` ONLY as a transitive of
   `shadcn`, a devDependency. Nothing declares it. Building a
   package meant for `npx` on an undeclared transitive dev
   dependency is a package that breaks the first time the tool
   above it drops the edge, and declaring it properly is a
   `package.json` change that is the orchestrator's.

   MCP's stdio transport is newline-delimited JSON-RPC 2.0: one
   message per line, no embedded newlines, `\n` terminated. That
   is the whole framing, which is why hand-writing it is a hundred
   lines rather than a project.

   ── stdout is the WIRE ──
   Nothing may write to it but this file. A stray `console.log`
   anywhere in the package emits a line the client tries to parse
   as a message and the session dies with a parse error naming
   nothing. Diagnostics go to stderr, which is where every MCP host
   already collects them.
   ============================================================ */

/** A request carries an `id`; a notification is the same shape without one. */
export interface RpcMessage {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
}

/** JSON-RPC 2.0's own codes. `-32000` and below are ours to use; we do not need one. */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

export class RpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Handles one method. Returning `undefined` means *this was a notification and there is
 * nothing to answer*, which is JSON-RPC's rule rather than a convenience: a response to a
 * notification is a protocol violation, and clients do disconnect over it.
 */
export type RpcHandler = (method: string, params: unknown) => Promise<unknown>;

/**
 * Reads newline-delimited JSON-RPC from `input` and writes answers to `output`.
 *
 * Resolves when the input ends, which is how an MCP host shuts a server down: it closes the
 * pipe. There is no other exit path and no signal handling, because the process has nothing
 * to flush — every answer is written before the next line is read.
 *
 * ── Malformed input answers and does not throw ──
 *
 * A line that is not JSON gets a `-32700` with a null id, which is JSON-RPC's own prescribed
 * answer for exactly this case, and the loop continues. A server that exits on one bad line
 * takes the agent's whole session with it, and the line it choked on is the one thing it
 * then cannot report.
 */
export async function serve(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
  handle: RpcHandler,
): Promise<void> {
  let buffer = "";
  input.setEncoding("utf8");

  for await (const chunk of input) {
    buffer += chunk as string;

    /* Everything up to the last newline is complete messages; the tail is a partial line and
       stays in the buffer. A chunk boundary can land anywhere, so treating a chunk as a
       message is the bug this loop exists to not have. */
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line !== "") await dispatch(line, output, handle);
      newline = buffer.indexOf("\n");
    }
  }

  /* A final message with no trailing newline. Some hosts do this on close. */
  const tail = buffer.trim();
  if (tail !== "") await dispatch(tail, output, handle);
}

async function dispatch(
  line: string,
  output: NodeJS.WritableStream,
  handle: RpcHandler,
): Promise<void> {
  let message: RpcMessage;
  try {
    message = JSON.parse(line) as RpcMessage;
  } catch {
    write(output, { jsonrpc: "2.0", id: null, error: { code: RPC_PARSE_ERROR, message: "Parse error." } });
    return;
  }

  const id = message.id;
  const isRequest = id !== undefined && id !== null;

  if (typeof message.method !== "string") {
    if (isRequest) {
      write(output, {
        jsonrpc: "2.0",
        id,
        error: { code: RPC_INVALID_REQUEST, message: "A request must carry a string `method`." },
      });
    }
    return;
  }

  try {
    const result = await handle(message.method, message.params);
    /* A notification gets NO response, even a successful one. */
    if (isRequest) write(output, { jsonrpc: "2.0", id, result: result ?? {} });
  } catch (err) {
    if (!isRequest) return;
    const code = err instanceof RpcError ? err.code : RPC_INTERNAL_ERROR;
    const text = err instanceof Error ? err.message : "Internal error.";
    write(output, { jsonrpc: "2.0", id, error: { code, message: text } });
  }
}

/**
 * One message, one line.
 *
 * `JSON.stringify` never emits a raw newline inside a string — it escapes them as `\n` — so
 * the framing holds for any payload, including a card's YAML.
 */
function write(output: NodeJS.WritableStream, message: unknown): void {
  output.write(`${JSON.stringify(message)}\n`);
}
