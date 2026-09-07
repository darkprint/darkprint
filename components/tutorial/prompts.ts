/* ============================================================
   The two prompts the tutorial hands a reader to paste into their agent.

   Defined once, here, because the page prints them, the client island fills the live URL
   into them, and the tests hold both against the same strings. Plain TypeScript, no JSX,
   so a node-environment test imports it without a DOM.

   Each prompt names the live page by a placeholder. The real address is only known in the
   browser, after `POST /api/tutorial/live` has answered with a token, so `withLiveUrl`
   swaps it in at render time and the reader copies one block with nothing left to edit.
   ============================================================ */

/** Where the reader's current live token is kept in the browser. */
export const LIVE_STORAGE_KEY = "darkprint:tutorial-live";

/** Stands in for the live page's address until the reader has opened one. */
export const LIVE_URL_PLACEHOLDER = "<your live page URL>";

/** The route the live page answers on, for a token the reader holds. */
export function livePagePath(token: string): string {
  return `/tutorial/live/${token}`;
}

/**
 * The first prompt: the task, and where to post the draft.
 *
 * The task is deliberately small and concrete. A handful of cards, three sites, one table
 * every morning: enough for a crawler, a comparison and a writer, and a check a person can
 * name (the table exists and every row names a site).
 */
export const DESIGN_PROMPT =
  "Use the DarkPrint skill to write a blueprint for this task: every morning, look up the " +
  "listed prices of a handful of Pokémon cards on three sites that list them, and write a " +
  "table with the lowest price for each card and which site had it. My DarkPrint live page " +
  `is ${LIVE_URL_PLACEHOLDER} and I want the draft posted there after every phase of the ` +
  "interview.";

/**
 * The second prompt, once the folder exists: search the registry over MCP and merge what
 * comes back. It asks for observability by need rather than by slug, because the search is
 * the step the reader is meant to watch happen.
 */
export const ENRICH_PROMPT =
  "Use the darkprint MCP server to find a blueprint that adds observability to a pipeline, " +
  "fetch it, and merge it into this folder with the DarkPrint skill's enrich mode. Then post " +
  `the grown draft to my live page at ${LIVE_URL_PLACEHOLDER}.`;

/** The prompt with the live page's address in place of the placeholder, or unchanged without one. */
export function withLiveUrl(prompt: string, liveUrl: string | undefined): string {
  if (liveUrl === undefined) return prompt;
  return prompt.replaceAll(LIVE_URL_PLACEHOLDER, liveUrl);
}
