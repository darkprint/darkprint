/* ============================================================
   darkprint CLI — where output goes
   Published as part of the barrel (D-270-03a). Every verb and
   `runCli` render through this and nothing else, so a test can
   drive a command in-process and read what a user would see;
   only the bin shim in `packages/mcp` holds the real streams.
   ============================================================ */

/** The two sinks a command writes to. */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}

/**
 * An `Io` that keeps what it was given, for a caller that wants the text rather than a
 * terminal. Here rather than in a test helper because the blind suite binds this barrel
 * by name and cannot import a file it has not been told about.
 */
export function collectingIo(): Io & { readonly stdout: string[]; readonly stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (text) => {
      stdout.push(text);
    },
    err: (text) => {
      stderr.push(text);
    },
  };
}
