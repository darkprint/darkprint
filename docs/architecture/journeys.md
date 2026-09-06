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
  crosswalk["/spec/attractor\n(Learn stop 01, the crosswalk)"]
  layers["Open a layer door:\n/spec/topology (02), /spec/card (03)"]
  darkFactory["/towards-a-dark-factory\n(Learn stop 04)"]
  doors{"Ready to act"}
  findOne["/blueprints"]
  makeOne["/new"]

  visit --> hero --> beats --> curious
  curious -->|yes| learnMenu --> whatIs --> crosswalk --> layers
  whatIs --> darkFactory
  curious -->|not yet| doors
  layers --> darkFactory
  darkFactory --> doors
  doors -->|"browse one"| findOne
  doors -->|"make one"| makeOne
```

**The order of the two middle boxes reversed on 2026-09-06 and the reason is the reader's,
not the diagram's.** The crosswalk was stop 04, after three DarkPrint documents, and a
reader who already knew Attractor met `card=` and `in=` in a shipped `topology.dot` three
pages before anything told them those attributes are DarkPrint's own. Attractor is now the
first thing the sequence says. The layer doors dropped from three to two in the same change:
`/spec/ontology` folded into `/spec/card`, because every ontology term exists to be a legal
value of a card field ([`DECISIONS.md`](../DECISIONS.md) D-156).

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
  WebUI-->>User: render explainer + two layer doors
  User->>WebUI: GET /towards-a-dark-factory
  Note over WebUI,API: hardcoded essay content — no archive read, MOCK (ROUTES.md)
  WebUI-->>User: render the 1-5 ladder and the dark-factory definition
```

---

## 5.2 · ~~Guided onboarding from node template to downloadable factory~~ RETIRED

> **RETIRED 2026-09-06: every screen in this journey is deleted.** The owner removed
> `/build` and `components/build/**` (*"it is not useful and make confusion"*,
> [`DECISIONS.md`](../DECISIONS.md) D-145), so the entry point, the workspace, the tab
> diffing, `DownloadStep` and `AgentHandoff` are all gone, and SEAM-99 to SEAM-102 are
> retired in place in [8 · Seams](seams.md) §N.
>
> **The section number and the two diagrams stay**, and neither is tidiness. The numbers
> are how every citation of this file addresses a journey, and renumbering 5.3 to 5.7
> would break them all to close one gap. The diagrams are the record of a path this site
> genuinely offered: a reader could change three controls and watch a real bundle be
> regenerated, rescored and re-exported in the tab, and **no journey in this document
> replaces it.** What is left of that shape is `/upload`, which validates a folder the
> reader already has rather than composing one, and §5.7, which reserves a blueprint and
> then sends the reader to their own machine to write it.
>
> **Read the two diagrams below as history, not as a route.** They describe screens that
> no longer exist.

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
  evidence["Requirements, tool scopes,\nAttractor compatibility"]
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
  WebUI-->>User: render graph, requirements [SEAM-05], Attractor verdict [SEAM-41]
  User->>WebUI: click a file / the clone command
  WebUI-->>Machine: file bytes or curl command [SEAM-19, SEAM-20]
```

**This journey lost its scoring stop on 2026-09-04.** The `evidence` node named
"Requirements, scorecard, `EvidenceLayers`" and the sequence hopped `SEAM-06`; the owner
asked the whole scoring reading off `/blueprints/{owner}/{slug}`, so the Score panel, the
ballot, the header autonomy meter, the explainability panel and the evidence layers all
came off and `EvidenceLayers` was deleted. **There is no longer a stop anywhere in this
journey that walks a reader from the graph to a score, a ballot or an explainability
panel.** A reader who wants a scored reading now gets it from a graph they are holding:
`/upload`'s validation report, and that is **one surface rather than two since 2026-09-06**, when `/build` was deleted (D-145) — the workspace named here was the other one. ~~`SEAM-41`'s Attractor verdict is
what stayed on the detail page.~~ **It did not stay: `AttractorCompatibility.tsx` was
unmounted with the rest on 2026-09-04 and DELETED on 2026-09-05** (`docs/ARCHITECTURE.md`
§11.0 Q30), so nothing on this page renders an engine reading of any kind now. The ballot
went further the same day — `GET`/`POST /api/blueprints/{owner}/{slug}/votes` and the write
path under it are deleted (§11.0 Q14), so the missing stop is no longer a stop that could be
restored by re-mounting a panel.

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
  download["Download the bundle:\ntopology.dot, cards, README.md"]
  onDisk["Folder lands on the user's machine"]
  ownHarness{"Point the user's own harness at the folder\n(Claude Code, Attractor, etc.)"}
  compiles["Harness compiles topology.dot + cards\ninto a runnable pipeline"]
  runs["Harness executes it\non the user's machine"]
  stays["Results and any run report\nstay on the user's machine"]
  reportGap["No path back to DarkPrint\n(run reporting is unbuilt)"]

  detail --> download --> onDisk --> ownHarness --> compiles --> runs --> stays --> reportGap
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
  WebUI-->>Machine: topology.dot + cards + README.md [SEAM-19]
  Note over Machine: DarkPrint distributes files. It never runs them (D-03).
  Machine->>Machine: user's own harness compiles topology.dot + cards into a\nrunnable pipeline and executes it — entirely outside this app
  Machine--)API: (future, unbuilt) submit a run report [SEAM-84]
  Note over WebUI,API: the word is "reported", never "measured" — the platform\nnever observes a run even once SEAM-84 exists [SEAM-86]
```

---

## 5.6 · Signing in and finishing an account

Signing in is real and completes end to end, **through either of two providers** since
2026-08-25: `GET /api/auth/github/login` or `GET /api/auth/google/login` starts B-02's
OAuth dance, the callback exchanges the code, upserts the account and mints the session
cookie. What the callback CANNOT do is choose a handle — T050 AC1 makes a session with
`handle: null` "signed in and INCOMPLETE", because a handle is allocated once and reserved
permanently (T070) and the registry may not pick one on a reader's behalf.

That unfinished state used to have nowhere to go: the callback redirected to `/` and a
reader arrived signed in with no visible difference from being signed out, having to find
`/settings` unaided to discover the one field gating publishing. `/welcome` closes it — the
callback sends a null-handle account there, and the route bounces a finished account back
to `/`, so it is safe to link at any time.

**Two providers, one account, when the address is proven.** A Google identity whose
**verified** address already belongs to an account links to it (`resolveFromProvider`,
`lib/server/accounts/identities.ts`) instead of minting a second one — so a reader who used
GitHub in January and Google in March lands in the same place. An **unverified** address
never links: that is the account-takeover path, and the cost of refusing is a duplicate
account, which is recoverable.

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
  myShelf["/u/:handle — your own bundle shelf\n(Blueprints is the profile's index now, T280)"]

  entry --> oauth --> callback --> hasHandle
  hasHandle -->|"yes, first sign-in"| welcome --> check --> claim --> profile --> home
  hasHandle -->|"no, returning"| home
  home --> publish
  home -->|"account menu"| myShelf
```

**Where a completed account's own content lives (T280).** Before this wave, `/u/[username]`
was the profile's overview: pinned items and local terms only, with the reader's actual
blueprints a click away on `/u/[username]/blueprints`. Blueprints took the segmentless slot
instead — the account menu's own link now opens straight onto the shelf a signed-in reader
came for, Pinned sitting above it rather than in front of it. §5.7 picks up from `myShelf`'s
own `New bundle` button.

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

---

## 5.7 · Creating a blueprint from a blank slate

Added 2026-08-25 (T280, `0007_drafts`). Real end to end, over a complete account
(§5.6): a blueprint may now exist as a row before it has a release — GitHub's empty-repo
state — reserved on `/new`, built locally by whichever means the reader chooses, and
published into the same slug from `/upload`. `publish()` on that last step is an APPEND
to the bundle `/new` already created, not a second creation — `PublishResult.created` is
`false` the whole way through this journey, and true only for a bundle `/upload` creates
from a bare graph with no `/new` visit first (§5.4, unchanged).

```mermaid
flowchart TD
  myShelf["/u/:handle\n(the profile's own bundle shelf, T280)"]
  newPage["/new\nreserve a slug and a title"]
  form["title, slug (debounced availability check),\nsummary, description, category, tags, visibility"]
  createPost["POST /api/bundles/draft"]
  draftLanding["/blueprints/:owner/:slug\nblueprint() undefined, draftBundle() answers: DraftLanding renders"]
  threeWays{"Three ways in, GitHub's own empty-repo panel"}
  skillPath["Point the blueprint-writing skill\nat your own goal"]
  handPath["Copy the starter folder layout\nand write topology.dot + cards by hand"]
  localBuild["A folder on the user's own machine:\ntopology.dot, cards/, README.md"]
  uploadPinned["/upload?owner=&slug=\npinned to the exact draft (B6's prefill contract)"]
  wizard["Steps 1-3: drop the folder or Load an example,\nvalidate in the tab — Details prefilled from the draft"]
  publishStep["Step 4: Publish"]
  detail["/blueprints/:owner/:slug\nblueprint() now resolves — the draft branch is gone"]
  rowVisibility["RowVisibility on /u/:handle\n(owner, per row, any time)"]
  draftSwitch["VisibilitySwitch on DraftLanding\n(owner, while there is no release)"]

  myShelf -->|"New bundle"| newPage --> form --> createPost --> draftLanding
  draftLanding --> threeWays
  threeWays -->|"Publish your first release"| uploadPinned
  threeWays -->|"install the skill"| skillPath --> localBuild
  threeWays -->|"start from the printed layout"| handPath --> localBuild
  localBuild -->|"come back with a folder"| uploadPinned
  uploadPinned --> wizard --> publishStep --> detail
  draftLanding -->|"owner, while it is a draft"| draftSwitch
  myShelf -->|"owner, per row"| rowVisibility
  detail -.->|"no control here since 2026-09-06"| myShelf
```

**Visibility moved off the blueprint page on 2026-09-06 and this diagram is the record of
where it went** (owner's instruction, [`DECISIONS.md`](../DECISIONS.md) D-146: *"remove the
panel visibility from the blueprint card; such option should be visible only on the user
account list of the blueprints"*). SEAM-67 stays LIVE and the write is the same `PATCH
/api/bundles/{owner}/{slug}/visibility` it always was; what changed is the surface. There are
two mounts now and they do not overlap: `RowVisibility` on the shelf, one control per row,
for a bundle at any stage — and the `VisibilitySwitch` `DraftLanding` still draws, which is
the only place an owner meets a bundle that has no release yet without going through the
shelf. **The published detail page now renders the same thing for the owner and for a
stranger**, which is why the dotted edge above points a reader back to the shelf rather than
naming a control on the page: `app/blueprints/[owner]/[slug]/page.tsx:324-331` records that
`isOwner` lost its last reader on that branch in the same edit.

```mermaid
sequenceDiagram
  actor User
  participant WebUI as Web UI
  participant API
  participant DB as Postgres
  participant Machine as User machine

  User->>WebUI: "New blueprint" (profile shelf, or /skill's accounts row)
  WebUI-->>User: GET /new
  loop each keystroke in the slug field, debounced 350ms
    WebUI->>API: GET /api/names/slugs/{owner}/{slug}
    API-->>WebUI: available | taken + suggestion | illegal
  end
  User->>WebUI: Create blueprint
  WebUI->>API: POST /api/bundles/draft [SEAM-114]
  API->>DB: checkSlug, then createBundle — a bundle row, no release
  DB-->>API: BundleRecord
  API-->>WebUI: 200 { bundle: { owner, slug, visibility, title, createdAt } }
  WebUI-->>User: redirect to /blueprints/{owner}/{slug}
  Note over WebUI,API: blueprint() answers undefined, no release yet\ndraftBundle() answers the row just created — DraftLanding renders (B-03: absent and unreadable answer alike, so the same branch also covers a private draft nobody else may see)
  User->>WebUI: "Publish your first release" (or install the skill, or copy the layout)
  opt the build itself happens off-platform
    Machine->>Machine: skill interview, or hand-authoring, produces\ntopology.dot + cards/ + README.md
  end
  User->>WebUI: GET /upload?owner={owner}&slug={slug} [SEAM-68]
  WebUI->>API: draftBundle(actor, owner, slug) — ownership checked server-side (session.handle === owner)
  API-->>WebUI: the draft's own title/summary/description/category/tags
  WebUI-->>User: wizard steps 1-3, Details prefilled
  User->>WebUI: drop the folder, review the validation, Publish
  WebUI->>API: POST /api/bundles [SEAM-69]
  API->>DB: publish() — APPENDS the first release to the existing bundle\n(created: false — the bundle already existed from /new)
  DB-->>API: PublishResult
  API-->>WebUI: 200 PublishResult
  WebUI-->>User: /blueprints/{owner}/{slug} — the draft branch is gone, the bundle is live
  User->>WebUI: (any time, draft or released) flip visibility
  WebUI->>API: PATCH /api/bundles/{owner}/{slug}/visibility [SEAM-67]
  API-->>WebUI: { bundle: { visibility, ... } }
```
