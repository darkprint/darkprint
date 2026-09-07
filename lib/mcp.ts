/* ============================================================
   Pointing a client at the registry, as one string and one route.
   The mirror of `lib/skill.ts`, shaped the same way because the two
   sit side by side in the hero and a reader compares them at a
   glance. The command is derived from the client table rather than
   typed a second time, so the hero cannot start printing a flag the
   tab strip has already dropped; `MCP_CLIENTS[0]` being Claude Code
   is pinned by `components/mcp/honesty.test.ts`.
   ============================================================ */

import { MCP_CLIENTS } from "@/components/mcp/clients";

/**
 * The line a Claude Code user runs to connect. No `$` prompt in the value, matching
 * `SKILL_INSTALL_COMMAND`: the prompt belongs to whichever surface renders it, and a `$`
 * that reaches the clipboard is a command that fails.
 */
export const MCP_CONNECT_COMMAND = MCP_CLIENTS[0].snippet;

/** Where the command is explained, and where every surface that prints it links. */
export const MCP_ROUTE = "/mcp";
