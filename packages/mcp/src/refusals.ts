/* ============================================================
   darkprint mcp: the sentences a refused read answers with
   Shared by the HTTP client and the in-process executor so a
   refusal reads the same whichever transport carried it.
   ============================================================ */

/**
 * The 404. One sentence for absent, malformed and not-visible alike, because a distinct
 * wording per case would tell a caller whether a private address exists.
 */
export const NOT_FOUND_TEXT =
  "The registry holds nothing at that address, or it is not visible to this caller. " +
  "DarkPrint answers 404 rather than 403 so that a private bundle is indistinguishable " +
  "from one that does not exist.";

/**
 * An unreachable registry, which must never read like a refusal: an agent told "not found"
 * stops looking, where one told the host is unreachable retries or tells its user.
 */
export function unreachableText(baseUrl: string, cause: unknown): string {
  return (
    `Could not reach the DarkPrint registry at ${baseUrl}. ` +
    `${cause instanceof Error ? cause.message : String(cause)}`
  );
}
