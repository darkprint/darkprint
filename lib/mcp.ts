/* ============================================================
   Pointing a client at the registry, as one string and one route.
   ------------------------------------------------------------
   The mirror of `lib/skill.ts`, and deliberately shaped the same way, because the two now
   sit side by side in the hero and a reader compares them at a glance. What separates them
   is the only thing that matters here: the skill's command runs today, and this one does
   not. There is no MCP server behind the registry and no `darkprint` package on npm, so
   every surface that prints `MCP_CONNECT_COMMAND` has to mark it — doc 2 §0.4, and the
   same rule that made the landing's old `npx darkprint setup` chip wear a badge until the
   day a real command replaced it.

   ── Why the string is derived and not typed ──
   `components/mcp/clients.ts` already holds the four client configs the `/mcp` page shows
   in its tab strip, and Claude Code's is the first of them. The landing needs that one
   line on its own, away from the tabs. Typing it a second time here is how the hero starts
   printing a flag the tab strip has already dropped, so it is read out of the same array
   the page renders and there is exactly one place to change it.

   The index is asserted rather than assumed: `MCP_CLIENTS[0]` being Claude Code is a fact
   about a file someone can reorder, and the reorder would silently put a JSON blob in a
   one-line chip. `mcp.test.ts` pins it.
   ============================================================ */

import { MCP_CLIENTS } from "@/components/mcp/clients";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-21) (cited at line 6): n/a — CLI, wearing ComingSoonBadge

/**
 * The line a Claude Code user would run, once there is a server to run it against.
 *
 * No `$` prompt in the value, matching `SKILL_INSTALL_COMMAND`: the prompt belongs to
 * whichever surface renders it, and a `$` that reaches the clipboard is a command that
 * fails. Not that this one would succeed either way — see this file's header.
 */
export const MCP_CONNECT_COMMAND = MCP_CLIENTS[0].snippet;

/** Where the command is explained, and where every surface that prints it links. */
export const MCP_ROUTE = "/mcp";
