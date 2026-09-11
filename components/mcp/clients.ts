
/* ============================================================
   What each MCP client's configuration looks like for the remote
   server. Every entry points at the same HTTP endpoint, so nothing
   is installed and nothing is kept up to date on the reader's
   machine. Each shape was checked against the client's own
   documentation; the docs link beside it is where to re-check.
   The host is spelled once, imported from the module that already
   names it for the skill archive.
   ============================================================ */

import { SKILL_SITE_ORIGIN } from "@/lib/skill";

/** The one address every client below points at. */
export const MCP_ENDPOINT_URL = `${SKILL_SITE_ORIGIN}/api/mcp`;

export interface McpClientSetup {
  id: string;
  label: string;
  snippet: string;
  note: string;
  docsHref?: string;
}

export const MCP_CLIENTS: readonly McpClientSetup[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    snippet: `claude mcp add --transport http darkprint ${MCP_ENDPOINT_URL}`,
    note: "One command in the terminal. Claude Code connects over HTTP and installs nothing.",
    docsHref: "https://code.claude.com/docs/en/mcp",
  },
  {
    id: "codex",
    label: "Codex",
    snippet: `codex mcp add darkprint --url ${MCP_ENDPOINT_URL}`,
    note: "The same entry serves Codex CLI, the IDE extension and the desktop app; they read one configuration.",
    docsHref: "https://developers.openai.com/codex/mcp",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    snippet: MCP_ENDPOINT_URL,
    note: "On claude.ai open Customize, then Connectors, click + and choose Add custom connector, then paste this address. The connector is available in Claude Desktop as well; claude_desktop_config.json is for local servers only.",
    docsHref: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
  },
  {
    id: "cursor",
    label: "Cursor",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "url": "${MCP_ENDPOINT_URL}"
    }
  }
}`,
    note: "Put this in ~/.cursor/mcp.json for every project, or in .cursor/mcp.json for one.",
    docsHref: "https://cursor.com/docs/context/mcp",
  },
  {
    id: "vscode",
    label: "VS Code",
    snippet: `{
  "servers": {
    "darkprint": {
      "type": "http",
      "url": "${MCP_ENDPOINT_URL}"
    }
  }
}`,
    note: "Put this in .vscode/mcp.json, or run MCP: Add Server from the command palette and choose HTTP.",
    docsHref: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "httpUrl": "${MCP_ENDPOINT_URL}"
    }
  }
}`,
    note: "Add this to ~/.gemini/settings.json. gemini mcp add --transport http writes the same entry.",
    docsHref: "https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md",
  },
] as const;
