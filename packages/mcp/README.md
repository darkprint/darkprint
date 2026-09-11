# darkprint

The [DarkPrint](https://www.darkprint.io) registry from your terminal and from an agent
session. One package, three things:

- the `darkprint` command: `clone`, `validate`, `export`, `import`, `bump`, `report`;
- the DarkPrint blueprint-writing skill, which `darkprint skill install` copies into
  `~/.claude/skills/darkprint` (Claude Code) or, with `--codex`, `~/.agents/skills/darkprint`;
- the registry over MCP on stdio, as `darkprint mcp`, for a client that cannot reach the
  remote server at `https://www.darkprint.io/api/mcp`.

```bash
npx -y darkprint skill install            # Claude Code
npx -y darkprint skill install --codex    # Codex
npx -y darkprint clone autogen/starter-software-factory --out starter
npx -y darkprint clone spec-planner@1.0.0 # one card, as cards/spec-planner@1.0.0.yaml
npx -y darkprint validate ./starter
npx -y darkprint --help
```

`npx -y` fetches the package from npm on the first run and keeps it in its cache. Nothing
here runs a blueprint. Environment: `DARKPRINT_URL` (registry base, default
`https://www.darkprint.io`), `DARKPRINT_API_KEY` (raises the read ceiling),
`DARKPRINT_SESSION` (the session cookie `report` sends). Every operation, with its status,
is listed at [darkprint.io/capabilities](https://www.darkprint.io/capabilities).
