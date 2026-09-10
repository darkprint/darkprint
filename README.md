# DarkPrint

**Reusable blueprints for agent workflows.**

DarkPrint is a registry of blueprints. A blueprint is an agent pipeline written down as a typed
graph: a `topology.dot` that says which nodes exist and what flows between them, one YAML card
per node that says what the node does, what it accepts, what it emits and what it must never
receive, and a README for the person opening the folder. The engine reads the pair statically
and reports what the shape implies: where a person acts, what the risk surface is, and whether
the node that produces the work can see the criteria the work is judged against.

This repository is `www.darkprint.io`: the site, the engine, the Postgres-backed registry, the
MCP server, the `darkprint` CLI and the blueprint-writing skill.

## What is real and what is not

Real: the registry in Postgres, with accounts (GitHub and Google), publishing, forks, drafts,
per-bundle visibility, saves, stars, notes, API keys and run-report ingestion. The autonomy
class, security level and phase coverage of every release, computed by `lib/core` at publish
and stored on the release row. Search that ranks by a sentence-encoder vector plus word
coverage, with the model vendored under `models/`. Seven MCP tools served over HTTP at
`/api/mcp`, which Claude Code, Codex, Cursor, VS Code and Gemini CLI connect to with nothing
installed. The `darkprint` package on npm, built from `packages/mcp`: `npx -y darkprint` runs
the CLI and the stdio MCP server, and `npx -y darkprint skill install` copies the
blueprint-writing skill it carries into the agent's skills folder. The site still serves the
DarkPrint skill's tree file by file with a manifest of hashes.

Not real: nothing here runs a blueprint, runs a node or calls a model on anyone's behalf. The
seeded community numbers that remain are labelled as seeded where they render. No mail is
sent.

## Getting started

```bash
docker compose up -d          # Postgres with pgvector on 5432, MinIO on 9000
cp .env.example .env.local
npm install
npm run db:migrate
npm run seed:import           # publishes the ten content/ blueprints into the registry
npm run dev                   # http://localhost:3000
```

The four gates, all of which must pass before work is done:

```bash
npm run typecheck   # tsc --noEmit; run a build (or npx next typegen) once first
npm run lint        # eslint
npm test            # vitest; needs the compose stack and .env.local loaded in the shell
npm run build       # prebuild regenerates public/bundles, public/cards and public/skill
```

`npm test` creates and drops scratch databases beside the one `DATABASE_URL` names. Never
point it at production. `npm run build` rewrites generated files under `public/`; commit that
diff with the change that caused it.

## Project structure

```
app/                 25 pages and 74 API route files (the tables are in docs/ARCHITECTURE.md §4)
components/          24 folders of UI, one per surface plus site, ui and viz
lib/core/            the engine: DOT, cards, ontology, bundle resolution, analysis, digests,
                     versioning, Attractor emit and import. Isomorphic; it runs on /upload too.
lib/content/         reads content/ at build time; exports a bundle as files
lib/db/              drizzle schema (22 tables), the pool, object storage, migrations
lib/server/          27 subsystems: accounts, archive, auth, cards, counters, engine, export,
                     http, lifecycle, limits, lineage, mcp, naming, notes, notifications,
                     observability, ontology, policy, profiles, publish, registry, runs,
                     saves, search, seed, terms, versioning
lib/data/            seeded fixtures that several surfaces still read
packages/cli/        the darkprint verbs: clone, validate, export, import, bump, report, skill
packages/mcp/        the darkprint package: the bin, the stdio MCP server, the tool table, a copy of the DarkPrint skill
skills/darkprint/    the blueprint-writing skill: SKILL.md, references, templates
content/             10 blueprints, 61 card versions, ontology/extensions.yaml
models/              all-MiniLM-L6-v2, quantised ONNX (23 MB)
scripts/             prebuild, seed import, re-embed, retrieval eval, production preflight
tests/               the backend suites, tree-wide guards, scratch-database support
docs/                ARCHITECTURE.md, the appendix, the source notes
```

## Where to read next

- `docs/ARCHITECTURE.md`: routes, data model, the engine pipeline, publishing, search, MCP,
  CLI, skill, auth, environment, local development, deploy, known gaps.
- `docs/appendix/`: how a blueprint, a node card, the ontology and the engine are defined,
  each with what breaks if you change it.
- `AGENTS.md` and `CLAUDE.md`: the rules an agent working in this repository follows.
- `/what-a-blueprint-is`, `/spec/topology`, `/spec/card`, `/spec/attractor` on the site: the
  same material for a reader.
