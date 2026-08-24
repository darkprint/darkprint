/* ============================================================
   DarkPrint backend — the MCP surface's store boundary
   One function, and every published verb goes through it. What
   crosses this line is either a value, an `McpRefusedError` or an
   `McpStoreError` naming the operation; nothing else leaves.

   It converts EVERY rejection rather than a classified set, for
   `search/store.ts`'s reason, and with the same extra edge one
   layer further out: this module calls FIVE other modules'
   readers — T200's searchers, T020's cards, T050's accounts,
   T010's archive, T090's export — and most of those already seal
   their own faults with their own class. Those arrive here as
   ordinary rejections and are resealed under this module's
   operation name, which is the honest label: what failed from an
   agent's point of view is `mcpProvenance`, and the original class
   and its statement travel intact on `cause` where an operator
   reads them.

   The cost is the same one T080 and T200 state rather than hide: a
   bug in the pure projection half of a reader is converted too, so
   it reaches a caller labelled as a store failure. The answer is a
   500 either way, so nothing downstream can branch on it.
   ============================================================ */

import { ExportError } from "@/lib/server/export";
import { McpRefusedError, McpStoreError } from "./errors";

/**
 * Run a published verb's body and seal whatever it rejects with.
 *
 * `operation` is the verb's own exported name, written as a literal at each call site. It
 * is never assembled from a parameter: a caller-supplied handle, slug, digest or card ref
 * reaching the message would put caller data in the one rendering this module pins by
 * exact equality, and would make the pin depend on the request.
 *
 * An already-sealed fault is rethrown unchanged rather than re-wrapped. A sanitizer applied
 * twice does not sanitize twice, it RELABELS: re-wrapping would replace the verb that
 * actually failed with whichever one happened to be outermost. That arm is also what lets
 * a verb `throw new McpRefusedError(...)` from inside its own body and reach the caller
 * intact.
 *
 * ── The one classified arm, and why it is exactly one class wide ──
 *
 * `exportRelease` refuses an absent, invisible or unreleased digest with `ExportError`
 * (D-90-A: a fact about the release, which a route answers 404). D-220-06 rules that
 * converted here, so the four-verb surface refuses with one voice instead of publishing
 * T090's taxonomy on T220's. The `cause` carries the original whole.
 *
 * **`ExportReadError` is deliberately NOT in this arm and must not be added to it.** It is
 * T090's sibling class for a driver failure, and D-90-A's own record says what happens when
 * the two share a type: a Postgres outage starts answering "no such release", alerting reads
 * an outage as traffic to missing files, and **a client holding a pinned digest concludes
 * the release was withdrawn and stops retrying** — the one reference AC2 promises never
 * moves is the one an outage made look deleted. It falls through to `McpStoreError` below,
 * which is a 500, which is what it was before it got here.
 */
export async function withMcpStore<T>(operation: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (cause) {
    if (cause instanceof McpRefusedError) throw cause;
    if (cause instanceof McpStoreError) throw cause;
    if (cause instanceof ExportError) throw new McpRefusedError(operation, cause);
    throw new McpStoreError(operation, cause);
  }
}
