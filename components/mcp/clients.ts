/* ============================================================
   What each MCP client's config will look like, once the registry
   has a server to point at. Coming-soon content: see doc 2 §0.4 —
   `InstallTabs.tsx` and `app/mcp/page.tsx` both say plainly
   this isn't live, everywhere the capability is suggested.
   ============================================================ */

export interface McpClientSetup {
  id: string;
  label: string;
  snippet: string;
}

export const MCP_CLIENTS: readonly McpClientSetup[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    snippet: "claude mcp add darkprint -- npx -y darkprint mcp",
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
  },
] as const;
