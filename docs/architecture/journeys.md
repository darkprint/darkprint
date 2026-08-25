# 5 · User journeys

[← Back to the index](../ARCHITECTURE.md)

Each journey is a `flowchart` of screens and decisions, followed by a `sequenceDiagram`
with actors `User`, `Web UI`, `API (future)` and `User machine`. Every call across the
`Web UI` / `API (future)` boundary cites the `SEAM` id it corresponds to
([8 · Backend contract seams](seams.md)). A **solid** arrow into `API (future)` is a call
this document proposes for the backend; today, every one of those calls is actually a
build-time read or an in-tab computation, never a real network request — the sequence
diagrams draw the boundary where a real request would cross once a backend exists. A
**dashed** arrow marks something that is explicitly unbuilt today (per the seam's own
`PLANNED` status), so the reader can see which parts of the journey are real now and which
are the proposal.

---

## 5.1 · First visit and understanding what a dark factory is

```mermaid
flowchart TD
  visit["Land on / (the landing)"]
  hero["Hero: the claim + two ways in"]
  beats["Scroll five more beats:\nreproducibility, blueprint, node card, lifecycle"]
  curious{"Curious what “dark factory” means?"}
  learnMenu["Open the Learn menu"]
  whatIs["/what-a-blueprint-is\n(Learn stop 00)"]
  layers["Open a layer door:\n/spec/topology, /spec/card, /spec/ontology"]
  darkFactory["/towards-a-dark-factory\n(Learn stop 06)"]
  doors{"Ready to act"}
  findOne["/blueprints"]
  buildOne["/build"]

  visit --> hero --> beats --> curious
  curious -->|yes| learnMenu --> whatIs --> layers
  whatIs --> darkFactory
  curious -->|not yet| doors
  darkFactory --> doors
  doors -->|"browse one"| findOne
  doors -->|"make one"| buildOne
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API (future)
  participant Machine as User machine

  User->>WebUI: GET /
  WebUI->>API: bundle source for the landing figure [SEAM-04]
  API-->>WebUI: DOT + cards
  WebUI->>API: card source for the landing figure [SEAM-10]
  API-->>WebUI: card YAML
  WebUI-->>User: render five beats
  User->>WebUI: open Learn menu, GET /what-a-blueprint-is
  WebUI->>API: blueprint list [SEAM-01], card [SEAM-09/10], ontology view [SEAM-14]
  API-->>WebUI: archive facts
  WebUI-->>User: render explainer + three layer doors
  User->>WebUI: GET /towards-a-dark-factory
  Note over WebUI,API: hardcoded essay content — no archive read, MOCK (ROUTES.md)
  WebUI-->>User: render the 1-5 ladder and the dark-factory definition
```

---

## 5.2 · Guided onboarding from node template to downloadable factory

```mermaid
flowchart TD
  entry["Open /build\n(Learn rail “SANDBOX”, or footer Learn)"]
  template["Five-node starter template loads"]
  controls{"Adjust output / approval / iteration-cap"}
  regen["Workspace regenerates, rescores\nand re-exports — in the browser tab"]
  inspect["Inspect graph / source / score tabs\n(marks which tab actually moved)"]
  satisfied{"Happy with the combination?"}
  download["DownloadStep: nine files"]
  handoff["AgentHandoff brief\n(what a harness still needs)"]
  disk["Folder lands on the user's machine"]

  entry --> template --> controls --> regen --> inspect --> satisfied
  satisfied -->|"adjust more"| controls
  satisfied -->|"done"| download --> handoff --> disk
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API (future)
  participant Machine as User machine

  User->>WebUI: GET /build
  Note over WebUI: five-node starter, 80 pre-verified combinations [SEAM-99]
  WebUI-->>User: render template + three controls
  loop each control change
    User->>WebUI: change output / approval / iteration cap
    WebUI->>WebUI: buildStarterBundle(choices) then loadBundle — entirely client-side [SEAM-99]
    WebUI-->>User: regenerated graph, source, score, diffed tabs [SEAM-102]
  end
  User->>WebUI: click Download
  WebUI-->>Machine: nine files as data: URLs [SEAM-100]
  Note over WebUI,API: SEAM-100 names an optional server counterpart —\na server would only duplicate work already done in the tab
```

---

## 5.3 · Browsing and opening a blueprint

```mermaid
flowchart TD
  browse["/blueprints"]
  filter{"Filter, search or sort"}
  results["Filtered grid\n(URL-backed state)"]
  clear{"No matches?"}
  clearFilters["Clear filters"]
  open["Open a tile"]
  detail["/blueprints/:slug"]
  panes["Synchronised panes:\ngraph, DOT, card source"]
  evidence["Requirements, scorecard, EvidenceLayers"]
  download["Download files or copy clone command"]

  browse --> filter --> results --> clear
  clear -->|yes| clearFilters --> filter
  clear -->|no| open --> detail --> panes
  detail --> evidence
  detail --> download
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API (future)
  participant Machine as User machine

  User->>WebUI: GET /blueprints
  WebUI->>API: list blueprints [SEAM-01]
  API-->>WebUI: BlueprintSummary[], categories, tags
  WebUI-->>User: render grid
  User->>WebUI: type in search / pick a filter
  WebUI->>API: filtered list, debounced 250ms [SEAM-02]
  API-->>WebUI: filtered BlueprintSummary[]
  WebUI-->>User: render "No blueprints match" or the narrowed grid
  User->>WebUI: open a tile
  WebUI->>API: GET one blueprint [SEAM-03]
  API-->>WebUI: Blueprint view model
  WebUI->>API: bundle + card source for the panes [SEAM-04]
  API-->>WebUI: DOT + card text
  WebUI-->>User: render graph, requirements [SEAM-05], evidence [SEAM-06]
  User->>WebUI: click a file / the clone command
  WebUI-->>Machine: file bytes or curl command [SEAM-19, SEAM-20]
```

---

## 5.4 · Uploading and evaluating a blueprint

```mermaid
flowchart TD
  step1["/upload step 1:\nchoose Blueprint / Node / Ontology"]
  kindGate{"Kind = Blueprint?"}
  blocked["Node / Ontology validation:\ndisabled, not wired up"]
  dropOrExample{"Drop bundle files,\nor Load an example"}
  classify["classifyBundle sorts files\n(manifest / dot / cards / vocabulary)"]
  step2["Step 2: manifest details\n(prefilled from blueprint.yaml, or typed)"]
  step3["Step 3: validate\nparse DOT, resolve, score — in the tab"]
  outcome{"resolves / unfinished / rejected"}
  step4["Step 4: review the report"]
  reportDL["Download REPORT.md"]
  publish{"Publish?"}
  disabledPublish["Publish: disabled\n(not wired up / blocked / still being written)"]

  step1 --> kindGate
  kindGate -->|no| blocked
  kindGate -->|yes| dropOrExample --> classify --> step2 --> step3 --> outcome
  outcome --> step4 --> reportDL
  step4 --> publish
  publish --> disabledPublish
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API (future)
  participant Machine as User machine

  User->>WebUI: drop files or click "Load an example"
  Note over WebUI,Machine: Browser File API, in-tab only [SEAM-27]
  WebUI->>API: (future) fetch an example as upload files [SEAM-28]
  API-->>WebUI: {title, files}
  WebUI->>WebUI: parse DOT [SEAM-29], layer local vocabulary [SEAM-31]
  WebUI->>WebUI: resolve + score bundle, lib/core in-tab [SEAM-30]
  WebUI-->>User: diagnostics, autonomy, security, phase coverage
  User->>WebUI: click "Download REPORT.md"
  WebUI-->>Machine: report as a data: URL [SEAM-32]
  User->>WebUI: click "Publish blueprint"
  WebUI-->>User: disabled — "not wired up" (SEAM-69)
  WebUI--)API: (future, unbuilt) POST /api/bundles [SEAM-69]
```

---

## 5.5 · Running a blueprint locally

```mermaid
flowchart TD
  detail["/blueprints/:slug"]
  download["Download the bundle:\nDOT, cards, README.md, AGENTS.md, factory.dot"]
  onDisk["Folder lands on the user's machine"]
  ownHarness{"Point the user's own harness at the folder\n(Claude Code, Attractor, etc.)"}
  runs["Harness executes factory.dot\non the user's machine"]
  stays["Results and any run report\nstay on the user's machine"]
  reportGap["No path back to DarkPrint\n(run reporting is unbuilt)"]

  detail --> download --> onDisk --> ownHarness --> runs --> stays --> reportGap
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API (future)
  participant Machine as User machine

  User->>WebUI: GET /blueprints/:slug
  WebUI->>API: blueprint + source [SEAM-03, SEAM-04]
  API-->>WebUI: view model
  User->>WebUI: download the bundle
  WebUI-->>Machine: DOT + cards [SEAM-19], factory.dot [SEAM-24], README.md/AGENTS.md [SEAM-25]
  Note over Machine: DarkPrint distributes files. It never runs them (D-03).
  Machine->>Machine: user's own harness executes factory.dot — entirely outside this app
  Machine--)API: (future, unbuilt) submit a run report [SEAM-84]
  Note over WebUI,API: the word is "reported", never "measured" — the platform\nnever observes a run even once SEAM-84 exists [SEAM-86]
```

---

## 5.6 · Signing in and finishing an account

Signing in is real and completes end to end: `GET /api/auth/github/login` starts B-02's
OAuth dance, the callback exchanges the code, upserts the account and mints the session
cookie. What the callback CANNOT do is choose a handle — T050 AC1 makes a session with
`handle: null` "signed in and INCOMPLETE", because a handle is allocated once and reserved
permanently (T070) and the registry may not pick one on a reader's behalf.

That unfinished state used to have nowhere to go: the callback redirected to `/` and a
reader arrived signed in with no visible difference from being signed out, having to find
`/settings` unaided to discover the one field gating publishing. `/welcome` closes it — the
callback sends a null-handle account there, and the route bounces a finished account back
to `/`, so it is safe to link at any time.

**Still not reachable from here:** the MCP server and the CLI are `private: true` and
unpublished, so `npx -y darkprint mcp` fails for a reader even though both run locally
against a dev server (`DARKPRINT_URL`). Registration does not unlock them; publishing to
npm would.

```mermaid
flowchart TD
  entry["Sign in with GitHub\n(header, /settings, or /welcome)"]
  oauth["GET /api/auth/github/login\n302 to github.com, CSRF state cookie"]
  callback["GET /api/auth/github/callback\nexchange code, upsertFromGitHub, mint session"]
  hasHandle{"account.handle === null?"}
  welcome["/welcome — choose your handle\ndisplay name offered, not required"]
  check["GET /api/names/handles/{handle}\navailable | taken + suggestion | illegal"]
  claim["PATCH /api/account/handle\nallocates the handle AND re-mints the cookie (D-50-06)"]
  profile["PATCH /api/account/profile\ndisplay name, only when one was typed"]
  home["/ — signed in and complete"]
  publish["/upload can now publish:\nownerHandle comes from session.handle"]

  entry --> oauth --> callback --> hasHandle
  hasHandle -->|"yes, first sign-in"| welcome --> check --> claim --> profile --> home
  hasHandle -->|"no, returning"| home
  home --> publish
```

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API as API
  participant GitHub
  participant DB as Postgres

  User->>API: GET /api/auth/github/login
  API-->>User: 302 to GitHub, state cookie [B-02]
  User->>GitHub: authorize (scopes: read:user user:email)
  GitHub-->>API: GET /api/auth/github/callback?code&state
  API->>GitHub: exchange code for an identity
  API->>DB: upsertFromGitHub(githubId, githubLogin)
  DB-->>API: account, handle null on first sign-in
  API-->>User: 302 /welcome + session cookie (handle: null)
  User->>WebUI: GET /welcome
  WebUI-->>User: the handle field, display name offered
  User->>API: GET /api/names/handles/{candidate}
  API-->>User: available, or taken with a free suggestion [T070]
  User->>API: PATCH /api/account/handle
  API->>DB: allocate + reserve the handle permanently
  API-->>User: 200 AccountRecord + RE-MINTED cookie (handle set) [D-50-06]
  User->>API: PATCH /api/account/profile (only if a name was typed)
  User->>WebUI: land on / , signed in and complete
```
