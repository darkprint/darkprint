# AGENTS.md

DarkPrint is a registry of blueprints: agent pipelines written down as a typed graph, one
`topology.dot` plus one YAML card per node plus a README, which a coding agent fetches and
instantiates on its own machine. This repository is the site, the engine, the Postgres-backed
registry, the MCP server, the CLI and the authoring skill. Nothing here runs a blueprint. Read
`docs/ARCHITECTURE.md` first; it describes the tree as it is.

## Run

- `docker compose up -d`, then `cp .env.example .env.local`, `npm run db:migrate`,
  `npm run seed:import`, `npm run dev`.
- The four gates before work is called done: `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`. Run them yourself; do not trust a report that says they passed.
- `npm test` needs the compose stack and `.env.local` loaded in the shell
  (`set -a; . ./.env.local; set +a`). It creates and drops scratch databases next to the one
  `DATABASE_URL` names, so never point `DATABASE_URL` at production.
- `npm run typecheck` needs the generated route types: run `npm run build` (or
  `npx next typegen`) once in a fresh checkout first.
- `npm run build` rewrites `public/bundles`, `public/cards` and `public/skill` from `content/`
  and `skills/`. Commit that diff with the change that caused it.
- `models/all-MiniLM-L6-v2` is vendored (23 MB). Without it search degrades to word matching.

## Rules

- This Next.js has breaking changes. Read the guide in `node_modules/next/dist/docs/` before
  touching a route, a layout or `next.config.ts`.
- `lib/core/**` is isomorphic: no `node:*`, no `Buffer`, no `Date.now()`, no `Math.random()`.
  It runs in the browser on `/upload`.
- Never run prettier. There is no config, and it reflows everything to 80 columns.
- Comments say why, in one or two sentences. No ruling ids, no dates, no history of what the
  code used to do; git log holds that.
- Shipped copy: no em dash used as a pause, no sentence built as a negation followed by a
  "but" correction, no rhythmic triplets, no empty emphasis, and none of the autonomy phrases
  `components/site/copy-rules.test.ts` forbids.
- Never take a `fullPage` screenshot. Chrome grows the viewport to the document height and
  every `100vh` block balloons into a layout no reader ever sees.
- When you add a guard, break the code once on purpose and watch it fail with the right
  message before you trust it.
- Never delete or loosen an assertion about accessibility, contrast, label overlap or an
  honesty disclaimer without the owner's explicit instruction.
- Code wins over docs. When they disagree, report the divergence; never edit the code to
  match a document.
- When a route, a table, a migration, an environment variable, a CLI verb, an MCP tool or an
  npm script changes, update the matching table in `docs/ARCHITECTURE.md` in the same change.
  `tests/architecture-current.test.ts` checks the routes and the server modules.
- No new markdown files at the repository root. No plans, status reports or session
  summaries anywhere in the repository; they stay in the conversation.
- Third-party skills live under `.agents/skills`, are locked in `skills-lock.json` and are
  ignored in `eslint.config.mjs`. Do all three or none.
