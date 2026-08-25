
// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-87) (cited at line 16): n/a — MCP stdio server, npx -y darkprint mcp
/* ============================================================
   What each MCP client's config looks like, once `darkprint` is on npm to run it. T280
   gave the registry a server to point at — `/api/mcp/**`, and `packages/mcp` builds the
   same stdio server from a checkout — so every snippet below is real configuration for a
   real endpoint now. What still does not run is the command itself: `npx -y darkprint mcp`
   answers a 404 from npm, because the package has never been published there. See doc 2
   §0.4 — `InstallTabs.tsx` and `app/mcp/page.tsx` both say so, next to every one of these.
   ============================================================ */

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
    snippet: "claude mcp add darkprint -- npx -y darkprint mcp",
    note: "Adds the server from the terminal for Claude Code.",
  },
  {
    id: "codex",
    label: "Codex",
    snippet: "codex mcp add darkprint -- npx -y darkprint mcp",
    note: "Codex CLI, the IDE extension, and the ChatGPT desktop app share this host configuration.",
    docsHref: "https://developers.openai.com/codex/mcp",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
    note: "Add this server entry to Claude Desktop's MCP configuration.",
  },
  {
    id: "cursor",
    label: "Cursor",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
    note: "Use this entry in Cursor's MCP configuration.",
  },
  {
    id: "vscode",
    label: "VS Code",
    snippet: `{
  "servers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
    note: "Use this entry in VS Code's MCP server configuration.",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    snippet: `{
  "mcpServers": {
    "darkprint": {
      "command": "npx",
      "args": ["-y", "darkprint", "mcp"]
    }
  }
}`,
    note: "Add this entry to ~/.gemini/settings.json; Gemini Code Assist agent mode reads the same shape.",
    docsHref: "https://developers.google.com/gemini-code-assist/docs/use-agentic-chat-pair-programmer",
  },
] as const;
