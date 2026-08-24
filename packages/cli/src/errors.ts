/* ============================================================
   darkprint CLI — the one refusal class
   The section's admissible-message clause is the whole design
   here: a CLI message carries what the server sent plus the
   caller's own arguments, and never a credential, an endpoint, a
   stack or a raw HTTP body. So a refusal is built from a sentence
   somebody else already owns, and this class adds no wording of
   its own beyond the verb's name.
   ============================================================ */

/**
 * A refusal a user can act on.
 *
 * `cause` is the sanctioned carrier for the underlying failure (D-13), so a driver error
 * or a fetch failure travels for a diagnostic reader without being rendered to the user:
 * `runCli` prints `message` alone.
 */
export class CliError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliError";
  }
}
