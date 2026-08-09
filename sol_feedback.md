# DarkPrint product, content, and information-architecture review

Date: 2026-08-09

Revision: the mock is treated as the complete target-product specification, including
fixture-backed services that will be implemented before release.

## Scope of this review

This review covers the repository's product documents, architecture notes, current route
hierarchy, rendered page headings and prose, navigation, mock registry data, blueprint and
card detail templates, authoring and validation flows, and target community and MCP
surfaces.

No application code was changed. The in-app browser was unavailable during the review, so
visual conclusions are based on rendered HTML, component structure, responsive classes, and
the repository's existing layout tests rather than a new screenshot pass. Before implementing
visual recommendations, they should be checked at desktop and mobile widths in a browser.

### Clarification about the mock

This document treats the mock as the specification of the intended production service, not
as a preview restricted to functionality that happens to be implemented today. Accounts,
publishing, private artifacts, forks, reputation, voting, run evidence, ontology promotion,
and MCP retrieval should remain in the mock when they belong to the intended release.

Recommendations to simplify or reposition those components are therefore based on their
role in the final product, not on their current implementation status. A fixture-backed
component is valid. What it needs is a defined data contract, complete interaction states,
and a clear place in the user journey. Implementation status belongs in project tracking or
a prototype-only annotation, not in the final information hierarchy.

## Confirmed product direction

The following interpretation was checked with the author during the review.

DarkPrint is a registry for reusable agent-workflow blueprints. It is not an agent runner.
It stores, validates, explains, versions, and distributes specifications; the user's own
agent harness adapts and executes them on the user's machine.

The primary artifact is a blueprint bundle:

- a typed DOT graph defining nodes, handoffs, loops, and deliberate absences;
- one version-pinned YAML card per node defining that node's contract;
- a controlled ontology shared by the graph and cards;
- documentation for the person and for the agent that will adapt the bundle.

The central product claim is that the useful reusable artifact is the **shape of the work**,
not a prompt or a model. DarkPrint makes that shape inspectable and statically checkable:
typed interfaces, explicit prohibitions, bounded loops, human checkpoints, tool reach,
version pins, provenance, and explainable diagnostics.

The GitHub analogy is valid in one important sense: DarkPrint serves both people looking for
an existing artifact and people creating or publishing one. Those are two connected loops,
not two different products:

```text
Find and reuse
goal -> search -> inspect -> take -> adapt locally -> validate

Create and publish
goal -> design locally -> validate -> publish -> version -> become discoverable
```

Both loops meet on the same registry and the same blueprint detail page. Website search is
the human interface to the registry; MCP/RAG is the agent interface to the same
registry.

### The determinism claim

DarkPrint should not promise a deterministic result. LLM nodes remain nondeterministic, and
graphs can branch, retry, or stop on runtime state.

What DarkPrint can promise is a **reproducible and checkable workflow specification**. The
same pinned topology and card contracts can be resolved and analyzed again, even when two
runs produce different outputs. Prefer `reproducible`, `version-pinned`, `inspectable`, and
`statically checked` over a broad claim that the agent system itself is deterministic.

## Executive assessment

The underlying product model is considerably stronger than the current first-visit story.
The engine, bundle format, immutability rules, typed boundaries, local execution model, and
criteria-isolation example form a coherent thesis. DarkPrint is not merely a gallery of
agent diagrams; it can become a trust and distribution layer for agent-workflow patterns.

The website currently exposes too much of that model at once. It often behaves as a complete
reference manual before establishing a visitor's task. The same ideas are explained in the
homepage, the conceptual introduction, three format pages, the authoring workspace, the
blueprint detail template, the card detail template, the scoring page, and the ontology.
Each explanation is individually careful, but their accumulation makes the product feel more
complex than its actual core loop.

The highest-leverage change is therefore not a visual redesign. It is a stronger hierarchy:

1. Lead with what people can find or make.
2. Let a blueprint detail page prove why the artifact can be trusted.
3. Move format education into contextual reference.
4. Model every target capability as a complete final-state workflow, even when fixtures
   currently stand behind it.
5. Keep the provenance of evidence explicit: computed, voted, reported, verified, or absent.

## How target functionality should appear in the mock

The mock should show the product as it is intended to behave at release. It should not be a
collection of "coming soon" notices. For every target capability, model at least:

- the successful state;
- an empty/new-user state;
- loading or processing where the operation is asynchronous;
- validation and service errors;
- permission and authentication boundaries;
- private, draft, published, superseded, and deleted states where applicable;
- partial evidence, such as too few runs or votes to compute a stable aggregate;
- the transition into and out of the workflow.

Fixture data should be realistic enough to exercise these states. Labels such as `seeded`
are useful while reviewing a public static prototype, but they are not a substitute for
designing the final provenance model. In the intended product, the interface should say
`computed`, `community-rated`, `self-reported`, `verified run`, `insufficient sample`, or
whatever the actual contract guarantees.

The same rule applies to navigation. MCP, publishing, and profiles should be promoted or
demoted according to their importance in the final product, never merely because their
backend has not been written yet.

## What should remain

Several choices are important differentiators and should survive simplification.

### Keep the registry/local-machine boundary

The sentence "the registry publishes files, your machine runs them" is one of the clearest
statements on the site. It resolves questions about execution, provider keys, privacy,
composition, and cost. It should appear early and remain consistent.

### Keep the absent-edge example

The criteria-isolation example is the best proof of the product's value. A missing
`planner -> builder` edge, combined with the builder card's
`cannot: [acceptance-criteria]`, demonstrates something a prompt collection cannot express.
It should remain the canonical worked example, but it only needs one full explanation.

### Keep cards versioned and reusable

The distinction is sound: a node is a position in a graph; a card is the reusable file
pinned at that position. The current navigation label `Cards` is clearer than `Nodes` for
the registry shelf, even if the stable URL remains `/nodes`.

### Keep autonomy descriptive

Human gates are legitimate design choices, not defects. Autonomy classes should remain
filters and explanations, never rankings, progress bars, or rewards. "Dark factory" should
remain one classification of one graph shape, not the site's category or the summit of the
product.

### Keep explainable validation

Diagnostics that name the node, rule, severity, and remediation are more valuable than a
single score. The resolved/error state and its explanation should be more prominent than
aggregate grading.

### Keep honest local validation

The browser-side validator is a credible part of the target service. It proves that a
downloaded or agent-authored bundle can be checked without sending it to DarkPrint. The
publishing flow can then consume the validated artifact and its report as a separate,
authenticated operation.

## Highest-priority findings

### 1. The headline still positions autonomy as the product

The homepage and metadata lead with "Autonomy you can read as a graph." The phrase is
memorable, but it conflicts with the documented trajectory: blueprints are the product;
autonomy is one property of a blueprint. It also narrows the audience to people pursuing
full automation, despite the site's careful statement that human-gated graphs are first
class.

Recommendation: make the primary promise about reusable, inspectable agent workflows.
Autonomy can remain a supporting line or a visual motif.

Possible direction, not final copy:

> Reusable blueprints for agent workflows.
> Inspect the graph, take the files, adapt them on your machine.

The current hero gives the MCP command first-viewport weight beside the authoring skill.
That is justified only if direct agent retrieval and assisted creation are intended to be
co-equal primary entry points at release. If MCP is the principal way repeat users discover
blueprints, keep it and make the distinction explicit: the skill authors a blueprint; MCP
searches and retrieves the registry. The problem is unclear roles, not implementation order.

### 2. The homepage has become a technical tutorial again

The homepage now contains an annotated DOT listing and an annotated YAML listing before the
visitor reaches the product actions. This contradicts the repository's own useful
distinction between a short conceptual onboarding and a deeper practical onboarding.

The source listings are accurate and visually distinctive, but a cold visitor does not need
five annotated DOT blocks and nine annotated card blocks to understand the offer. The page
currently proves the file format before it proves why someone should browse or create a
blueprint.

Recommendation: retain the graph-to-file and node-to-card transformations as short visual
moments, then link to the full annotated reference. The homepage should answer, in order:

1. What is this?
2. What can I get here?
3. Why is a graph better than a prompt collection?
4. Do I want to find one or create one?

### 3. `/build` promises general design but configures one starter

`/build` is titled "Design a blueprint", but its actual decisions are:

- one of four output types;
- tester or human approval;
- a retry cap.

Those are useful teaching controls, but they do not design an arbitrary blueprint. The page
then places the genuinely general creation tools near the bottom: the DarkPrint authoring
skill and a reusable brief for any agent.

This creates a scope mismatch. A visitor expects a general authoring tool and receives a
starter configurator with a large reference workspace.

Recommendation: choose one honest role for this route.

- Preferred: make it the creation entry point. Start from the user's goal, then use the
  authoring skill or copyable agent brief to produce the graph and cards. Keep the starter
  as an optional worked example or sandbox.
- Lower-cost alternative: rename the page "Customize the starter blueprint" and make the
  general authoring skill the separate primary create route.

Do not describe three starter parameters as the complete act of blueprint design.

### 4. Blueprint detail pages are references before they are decision pages

The detail template contains the core material a reuser needs, but it is surrounded by a
field-by-field card encyclopedia, long analysis explanations, an annotated DOT walk,
fixture-backed community notes, and repeated download interfaces.

The primary question on this page is: **Should I trust and reuse this pattern for my task?**
The page should answer it in this order:

1. What problem does it solve, and when should it not be used?
2. What is the graph shape?
3. What are its inputs, outputs, requirements, human checkpoints, and tool reach?
4. Does it resolve, and what did static analysis find?
5. Which exact version am I taking?
6. How do I use it?

Raw DOT, every card field, score methodology, and full download manifest are supporting
evidence. They should be available without becoming the main reading path.

There should also be one canonical "Use this blueprint" area. The current header download,
folder disclosure, individual files, and lower download panel repeat the same action and
explanation.

### 5. The social and reputation model is represented before it is fully specified

Downloads, votes, reputation, validator status, comments, forks, and several radar axes are
important target-service components. They should remain in the mock. Their current presence,
however, implies product rules that the repository has not yet fully settled: what counts as
a download, who may vote, how votes are weighted, how reputation accrues, how validator
status is earned or revoked, and how abuse is moderated.

Because these figures determine sorting, fill charts, occupy profile summaries, and make
some artifacts look more trusted than others, the mock must specify their semantics as
carefully as it specifies card versioning.

Recommendation:

- Keep fixture-backed counts, comments, reputation, validator marks, forks, and sorting in
  the mock when they are intended production features.
- Define the event and aggregation behind every number before treating the component as
  stable.
- Design default, empty, low-sample, mature, disputed, removed, and abuse-limited states.
- Decide which social signal, if any, may influence default discovery ranking. A popularity
  sort can remain, but it should be a deliberate product decision rather than a convenient
  use of fixture fields.
- On blueprint pages, separate **structural evidence**, **run evidence**, and **community
  assessment**. They can all be fully designed without pretending they share provenance.
- Use both complete and incomplete fixture examples. "No run evidence yet" is a required
  final-product state, not a reason to remove the full evidence component.

### 6. The six-axis radar combines unlike facts

Autonomy and security are computed from static structure. Efficacy, reliability, and
transparency come from votes. Cost/time comes from reported or verified runs. Rescaling them
onto one polygon gives them visual equivalence even though their provenance, units, and
availability are different.

Recommendation for the mock:

- Keep the full six-axis component if it is part of the intended service, but specify how
  each axis is produced and what the chart does when an axis has insufficient evidence.
- Make resolution status, diagnostics, autonomy class, human checkpoints, phase coverage,
  tool reach, and static risk findings the structural evidence layer.
- Make run evidence and community assessment distinct layers with visible provenance,
  sample size, uncertainty, and freshness.
- Design radar states for all axes present, one or more axes absent, low-confidence data,
  stale data, disputed data, and a change of ontology/scoring version.
- Do not plot a fixture value merely to close the polygon. An intentionally open or muted
  axis can communicate that the final service does not yet have enough evidence for a
  defensible value.

Also reconsider the label `Security`. The current number is a static risk-marker reading,
not a security audit. `Static risk exposure`, `Declared risk`, or similarly bounded wording
would set a more accurate expectation.

### 7. Reference material is promoted to primary navigation

The Learn menu currently asks visitors to distinguish:

- what a blueprint is;
- the DOT file;
- the YAML card;
- the vocabulary;
- blueprint design;
- blueprint grading;
- the dark-factory maturity essay.

This is a good documentation tree but an expensive product menu. The three file-format
pages are details of one concept, not peer destinations in the main user journey.

Recommendation: make the main navigation task-oriented and put the format pages under a
single Docs or Reference entry.

## Recommended information architecture

The exact labels can change, but the hierarchy should express tasks before implementation
formats.

```text
DarkPrint
|-- Explore
|   |-- Blueprints
|   `-- Cards
|-- Create
|   |-- Create a blueprint / authoring skill
|   `-- Starter sandbox
|-- Validate and publish
|   |-- Validate a local bundle
|   |-- Resolve publication blockers
|   `-- Publish a versioned release
|-- Docs
|   |-- What a blueprint is
|   |-- Blueprint file (DOT)
|   |-- Node card (YAML)
|   |-- Ontology
|   `-- Static analysis and evidence
|-- MCP
|   |-- Connect a client
|   |-- Search by task
|   `-- Fetch an exact release
`-- Guides
    `-- Towards a Dark Factory
```

A compact global navigation could therefore be:

```text
Blueprints | Cards | Create | Publish | MCP | Docs | Search | Profile
```

`Ontology` may remain globally visible if governance of the shared vocabulary is meant to
be a daily community activity. If it is mainly a schema reference, it belongs under Docs.
MCP can remain a top-level destination if agent-side discovery is a primary release
workflow. Its navigation position should be justified by that final importance, not by
whether the server is currently implemented. The page and label should make its distinct
job clear: search and retrieve the registry from an agent, rather than author a new
blueprint.

`Profile` represents the authenticated user menu rather than a permanent text link. It
should lead to drafts, private artifacts, published work, forks, validation/review activity,
account settings, and organization/workspace switching if organizations are in scope.

The GitHub analogy supports this structure. GitHub serves readers and authors, but its
primary object remains the repository. Creation, discovery, source inspection, history, and
collaboration all orbit that object. DarkPrint's primary object should similarly remain the
blueprint rather than the documentation tree.

## Vocabulary simplification

The site introduces many valid terms too early. Use a layered vocabulary.

### Product vocabulary

These are enough for the first visit:

- **Blueprint:** a reusable pattern for an agent workflow.
- **Card:** the versioned contract attached to one node.
- **Registry:** where blueprints and cards are published.
- **Validate:** check that the graph and cards agree.
- **Run:** what the user's own harness does outside DarkPrint.

### Reference vocabulary

Introduce these when the visitor inspects source or authors a bundle:

- bundle;
- topology / DOT;
- ontology;
- port and data type;
- digest and semantic version;
- harness, rubric, eval, and guardrail.

The current `/what-a-blueprint-is` begins clearly, then expands into bundle anatomy,
blueprint/card/ontology, harness, rubric, eval, guardrails, static versus online constraints,
and three constraint locations. Those ideas are sound, but not all belong in the first
conceptual explanation.

Specific terminology rules:

- Use **node** for a place in a graph and **card** for the reusable file.
- Qualify **DarkPrint authoring skill** so it is not confused with a card's `skill` field.
- Use **bundle** only when the folder contents matter; otherwise say blueprint.
- Use **dark factory** only for the all-phases, unattended classification or the essay.
- Do not use **deterministic** without specifying that it describes the workflow
  specification or a particular tool node, not LLM output.
- Do not call reported values measurements unless DarkPrint can verify the run. Fixture
  provenance is a prototype concern; final provenance labels should describe the real
  production source.

## Page-by-page review

### `/` - Homepage

Current role: brand hero, graph-to-DOT walkthrough, node-to-YAML walkthrough, five lifecycle
actions, and two registry doors.

What works:

- The brand and graph visual language are distinctive.
- The local execution boundary is explicit.
- Browse and create are both present.
- The graph/card relationship is demonstrated rather than only defined.

Simplify:

- Replace the autonomy-first headline with a blueprint-first promise.
- Keep the MCP command in the first decision area only if direct agent discovery is a
  primary launch workflow; distinguish it clearly from the authoring skill.
- Shorten both source walkthroughs to one transformation moment each.
- Give full visual weight to the target actions that define the final product. Group them by
  job: find, create, use, validate, and publish. Do not group them by which backend happens
  to be implemented first.
- End with the two confirmed doors: find/reuse and create/publish.

### `/blueprints` - Blueprint discovery

Current role: searchable/filterable shelf with a featured starter and nine fixture
blueprints.

What works:

- It is already shaped as a production result page rather than a decorative gallery.
- Goal-relevant facets such as phase and autonomy are descriptive rather than rankings.
- The starter is a sensible default entry.

Simplify and future-proof:

- Make task/goal search the strongest control; names and tags alone will not scale to the
  intended registry.
- Add facets around domain, inputs/outputs, tool requirements, human checkpoints,
  validation status, and risk markers only when they help selection.
- Keep popularity sorts if they belong in the final service, but define what is counted,
  how manipulation is handled, and whether popularity may affect default ranking.
- Cards should emphasize problem fit, graph shape, requirements, and evidence rather than
  social counters.
- Avoid exposing every possible facet before the corpus needs it; progressive filters can
  preserve the community-scale structure without making nine results feel over-filtered.

### `/blueprints/[slug]` - Blueprint detail

Current role: artifact overview, interactive graph, selected card breakdown, six-axis
scorecard, bundle facts, static analysis, source walk, community discussion, and downloads.

Recommended hierarchy:

1. Problem, fit, and limitations.
2. Graph with a concise selected-node contract.
3. Requirements and operational reach.
4. Validation and static findings.
5. Version, provenance, dependencies, and usage.
6. One primary use/download action.
7. Source and methodology as tabs or reference links.
8. Community evidence and discussion, with designed zero-evidence and low-sample states.

Move the field-by-field card explanation to the card schema reference. A blueprint page
should show values specific to this blueprint, not repeatedly teach what `id`, `name`,
`phase`, `author`, and `ontology_version` mean.

### `/nodes` - Card discovery

Current role: a 53-card expert shelf grouped by node type and filterable by type and phase.

What works:

- This is a real reusable dependency registry, not a decorative list.
- `Cards` is the right visible label.
- Grouping and filtering are appropriate at this density.

Simplify:

- Add search by job/capability, input, output, and prohibition as the library grows.
- Reduce each tile to job, interface summary, important reach/risk, current version, and
  usage count.
- Keep author and phase secondary to what the card can be reused for.
- Consider whether Cards stays top-level after blueprint search can return reusable cards
  contextually. It is valuable for expert users, but not necessarily a first-visit door.

### `/nodes/[...id]` - Card detail

Current role: contract overview, full specification, interfaces, prohibitions, every field
explained, author notes, version history, raw source, risk/autonomy, identity, and mock
community notes.

Recommended hierarchy:

1. What this card does.
2. Inputs, outputs, dependencies, reach, and prohibitions.
3. Specification handed to the agent.
4. Blueprints that pin it.
5. Version history and provenance.
6. Raw YAML.

The "Every field on this card" section repeats a schema manual across every card page and
accounts for much of the template's reading load. Show the values here and link each field
group to `/spec/card` for definitions. Do not repeat the action/spec/notes in multiple
forms on one page.

### `/ontology` - Vocabulary browser

Current role: explains five term kinds, lists all terms and weights, and describes core,
local, and promotion layers.

What works:

- The ontology is a real part of the product, not invented navigation.
- The five kinds and their connection to card fields are made explicit.
- Local namespaces versus the curated core is an important governance model for the target
  service.

Simplify:

- Make the index a searchable reference table/tree first.
- Put the long rationale for phases, roots, weights, lattices, and governance in short
  contextual introductions or linked documentation.
- Keep the complete promotion workflow in the mock. Specify proposal, eligibility,
  discussion, validator review, acceptance, rejection, conflicts, deprecation, and the
  equivalence pointer left behind after promotion.
- Reconcile the displayed core/local counts consistently. A local risk marker must not make
  the curated core appear to have a different size on different pages.

### `/ontology/[...term]` - Term detail

Current role: definition, hierarchy, weight where relevant, registry usage, facts, and
adoption.

The compact term pages are generally well scoped. Keep adoption as a target-service
component, but replace repeated explanatory prose with an actual state component: not
eligible, approaching threshold, eligible for review, in review, accepted, rejected,
superseded, or deprecated. Usage in real blueprints/cards is the strongest input and should
remain prominent.

### `/build` - Creation workspace

Current role: a five-tab technical workspace over one starter, three choices, one bundle
download, the authoring skill, and a generic agent brief.

The page contains three different products:

- a teaching sandbox;
- a starter configurator;
- a general blueprint authoring handoff.

They should not compete in one continuous page. Make general creation the entry, then offer
the starter as an example. The graph, DOT, card, vocabulary, and score views are valuable in
the sandbox, but they are not prerequisites to choosing a goal.

The authoring skill is the clearest general creation flow represented in the mock. If that
is the intended production method, promote it from the lower exit to the principal path for
someone creating a real blueprint.

### `/upload` - Validation and publication

Current role: four-step upload wizard that validates locally and is intended to finish by
publishing to the registry.

Keep **Upload blueprint** if validation followed by publication is the final workflow. The
mock should make the boundary explicit: selecting and validating files happens in the tab;
only the confirmed publish action sends the validated bundle to DarkPrint. That distinction
is stronger than renaming the whole route to validation and removing its intended outcome.

Recommended flow:

1. Choose/drop bundle.
2. Resolve and show diagnostics.
3. Preview computed structure and evidence.
4. Resolve publication blockers and metadata.
5. Sign in or choose the publishing identity.
6. Choose visibility, license, version, provenance, and release notes.
7. Publish, then land on the immutable release page.

The mock should include publication success, validation failure, version conflict,
unauthorized, private draft, duplicate digest, superseding release, and interrupted upload
states. It should also decide whether card-only and ontology-extension publication are part
of this route, their own flows, or explicitly outside the release scope. Do not leave them
as ambiguous disabled content types in the final mock.

### `/what-a-blueprint-is` - Conceptual introduction

Current role: blueprint definition, bundle anatomy, graph/card/ontology, harness, rubric,
eval, guardrails, static/runtime distinctions, and reference-page doors.

Keep this route, but reduce it to the product's minimum conceptual model:

1. A blueprint is a reusable pattern represented as a graph.
2. Each node pins a versioned card.
3. The ontology lets the files agree and be checked.
4. DarkPrint distributes and validates; the user's harness runs.
5. One absent edge demonstrates why topology matters.

Move eval/rubric/guardrail theory into an execution or evaluation guide. A visitor should
not need those concepts to browse and reuse a blueprint.

### `/spec/topology`, `/spec/card`, `/spec/ontology` - Format reference

These are documentation pages and should behave like a reference set rather than a primary
onboarding sequence.

- Keep the pager and contextual cross-links.
- Remove them as individual main-menu choices.
- Let examples be opened from real blueprint/card detail pages.
- On `/spec/card`, reduce the 1,800-word open explanation by defining each field once in a
  compact schema table, with longer rationale only where a rule is non-obvious.
- Avoid re-explaining the absent edge in prose after the diagram and diagnostic already
  demonstrate it.

### `/reading-the-radar` - Analysis and evidence methodology

Current role: explains the radar, provenance badges, computed and fixture-backed axes,
weights, autonomy bands, similarity threshold, and telemetry filters.

Reframe as **How DarkPrint analyzes a blueprint**. Lead with resolution and diagnostics,
then static readings, community assessments, and run evidence as three separate provenance
layers. Keep all six target axes, but define ballot eligibility, vote weighting, minimum
sample, run verification, aggregation, freshness, and missing-data behavior. The page should
explain the final model, not implementation status or placeholder arithmetic.

### `/towards-a-dark-factory` - Guide/essay

Current role: defines the dark-factory special case and presents an organizational maturity
ladder.

The page is coherent after its recent reduction, but it is not part of the core find/create
loop. Keep it as a guide or essay and link it contextually from autonomy classifications. It
should not occupy the same navigation level as creating, validating, or browsing artifacts.

### `/skill` - Authoring skill

Current role: working install and interview instructions, output explanation, validation
handoff, accounts/publishing, and registry-assisted authoring.

This is the clearest current creator journey and should live under **Create**, not under the
generic category **Set up**. The first three sections form a complete loop:

```text
install -> answer design questions -> validate the generated bundle
```

Keep account-backed publishing and registry-assisted authoring in the mock as complete next
steps. Turn them from explanatory "not built" blocks into target interactions: sign in,
choose or create a workspace, search suggested cards/blueprints through MCP, accept or reject
the suggestions, validate the generated bundle, choose visibility, and publish. The skill
page should still prioritize the linear authoring task over lengthy explanations of every
supporting service.

### `/mcp` - Agent discovery

Current role: semantic retrieval explanation and client setup for the agent-facing registry.

Keep the route and its global prominence if MCP is a principal release workflow. Replace the
preview framing in the final mock with the complete connection and use journey: client
selection, authentication, scopes, installation, connection test, example search, result
inspection, exact-version fetch, disconnect, and error recovery. Specify what semantic
ranking returns, how private artifacts are excluded or authorized, and how provenance and
versions are carried into agent context.

The current conceptual depth is still high for setup. Put the command and connection test
first; place retrieval internals and client-specific details after the first successful
connection.

### `/u/[username]` - Profiles

Current role: authored blueprints/cards plus fixture-backed reputation, downloads,
validator status, and forks.

Profiles are structurally important for the GitHub-like two-sided product. Keep both archive
facts and target community signals:

- published blueprints;
- published cards;
- versions and contributions;
- provenance/ownership;
- forks and lineage;
- validator status and review history;
- reputation, with its contributing events visible;
- public activity and private workspaces, subject to permissions.

The mock should define how each signal is earned and provide traceable detail rather than a
single unexplained reputation total. Include new-user, active author, validator, suspended,
private-only, and organization/team profiles if those are release roles.

## Cross-page duplication to remove

The same concepts currently recur across multiple routes. Assign each one a canonical home.

| Concept | Canonical home | Elsewhere |
|---|---|---|
| What a blueprint is | `/what-a-blueprint-is` | one-sentence definition + link |
| DOT syntax | `/spec/topology` | show source, do not reteach syntax |
| Card field definitions | `/spec/card` | show values + link |
| Ontology model | `/spec/ontology` and `/ontology` | short contextual labels |
| Criteria isolation | canonical starter blueprint detail | short proof/link elsewhere |
| Static-analysis arithmetic | analysis methodology | result + rationale on detail |
| Local execution boundary | short global product statement | repeat only at use/validate actions |
| Authoring interview | `/skill` or Create page | one CTA elsewhere |
| MCP retrieval | `/mcp` | one task-specific CTA elsewhere |
| Dark-factory maturity | guide page | classification definition only |

The rule should be: **teach once, demonstrate where relevant, link for the full definition**.

## The blueprint detail page as the product center

For the confirmed two-sided model, the blueprint detail page should become the strongest
surface. It is where a finder decides to reuse, an author sees what they published, a future
reviewer leaves evidence, and an agent-facing integration resolves a specific version.

A stable mock should prove these states:

- clean valid blueprint;
- blueprint with warnings;
- invalid/unpublishable blueprint;
- human-gated blueprint;
- blueprint using a local ontology extension;
- blueprint with a superseded card version;
- blueprint with no community/run evidence;
- blueprint with mature community/run evidence;
- blueprint with low-sample or disputed evidence;
- private/draft blueprint;
- blueprint fork with visible lineage;
- blueprint release awaiting moderation or validator review.

Designing these states is more valuable than filling every current page only with mature,
successful social numbers. Fixture data should cover the whole lifecycle.

## Product questions to settle before implementation

The mock should not be called stable until these decisions have explicit answers.

1. **What is publishable?** Does a warning block publication, or only an error?
2. **What is fork identity?** Is a locally adapted blueprint a fork with lineage, or simply
   a new blueprint with provenance?
3. **What is a version of a blueprint?** The cards have semver rules; the blueprint itself
   also needs immutable releases and a visible current version.
4. **What can be private?** Draft blueprints, cards, local ontology terms, and validation
   results may need different visibility rules.
5. **What earns trust?** Validity, author identity, usage, reviews, verified runs, and
   maintainer status must not collapse into one reputation number.
6. **How is run evidence normalized?** Cost and time are not comparable without model,
   provider, hardware, input size, harness version, and sample size.
7. **Who can change the ontology?** Promotion thresholds alone do not define review,
   conflicts, deprecation, or ownership.
8. **What does MCP return?** Exact releases, cards, excerpts, rankings, and provenance need
   a stable retrieval contract.
9. **What licenses apply?** Reusable prompts/specifications and generated bundles need a
   clear license model before community publishing.
10. **What prevents malicious bundles?** DarkPrint does not run them, but it distributes
    instructions and tool scopes that another agent may execute. Static checks, warnings,
    moderation, and provenance need an explicit boundary.
11. **Which account roles exist?** Author, organization owner, maintainer, validator,
    moderator, and ordinary runner need explicit permissions and transitions.
12. **What is a download or use event?** Browser download, MCP fetch, clone, fork, and run
    are different signals and should not be collapsed accidentally.
13. **How does discovery rank results?** Text relevance, semantic similarity, validation,
    usage, reputation, freshness, and personalization need a transparent ordering contract
    for both website search and MCP retrieval.
14. **What is the moderation lifecycle?** Reports, hidden artifacts, appeals, suspended
    accounts, malicious instructions, and disputed community evidence need mock states.
15. **What can be deleted?** Immutable published releases, private drafts, comments, run
    reports, and personal data have different retention and erasure requirements.

## Recommended stabilization order

### Phase 1 - Lock positioning and nouns

- Make blueprints the headline product.
- Document the reproducible-specification claim.
- Establish the public vocabulary: Blueprint, Card, Registry, Validate, Run.
- Decide the stable label for static risk analysis.

### Phase 2 - Lock the two user loops

- Finder: search -> detail -> use -> local adaptation -> validate.
- Creator: create/skill -> local files -> validate -> publish.
- Ensure every primary CTA advances one of those loops.
- Mock the complete target interaction for every primary CTA, including success and failure
  states, even when the current implementation is fixture-backed.

### Phase 3 - Simplify the route hierarchy

- Task-oriented global navigation.
- Format pages grouped under Docs/Reference.
- MCP placed according to its intended launch importance, with a complete setup and
  retrieval flow.
- Dark-factory material under Guides.

### Phase 4 - Make detail pages decision-oriented

- Blueprint detail centered on fit, graph, requirements, findings, version, and use.
- Card detail centered on contract, reuse, versions, and source.
- Move repeated schema education to reference pages.

### Phase 5 - Stabilize evidence and community states

- Separate computed, reported, verified-run, community-rated, and unavailable data
  structurally.
- Define how downloads, votes, reputation, validator status, comments, and forks are
  created, aggregated, moderated, and displayed.
- Use fixture data to exercise the final sorting and trust decisions after those rules are
  defined.
- Define empty, low-sample, loading, invalid, warning, unpublished, private, moderated,
  disputed, and superseded states.

### Phase 6 - Validate the mock visually and behaviorally

- Test the two complete loops at desktop and mobile widths.
- Check navigation comprehension with a cold technical user.
- Measure time to answer: what is this, where does it run, how do I find one, how do I make
  one, and why should I trust one?
- Verify that every target action has a complete mocked destination and state transition;
  no primary CTA should terminate in explanatory copy.
- Verify that a user can evaluate and take a blueprint without reading the reference manual.

## Suggested success test for the stable mock

A technical visitor with no prior explanation should be able to answer these questions after
three to five minutes:

1. A blueprint is a reusable, versioned specification of an agent workflow.
2. DarkPrint stores and checks it; my own tools run it.
3. The graph controls handoffs and isolation, while cards define nodes.
4. I can search for an existing blueprint or create one with my agent.
5. I can inspect the exact files and static findings before using it.
6. A human checkpoint is a valid design choice, not a lower-quality blueprint.
7. I can publish through the designed account flow and retrieve registry artifacts through
   the designed MCP flow.

If the visitor instead remembers DOT syntax, six radar axes, ontology promotion thresholds,
and the dark-factory maturity ladder but cannot explain how to find or create a useful
blueprint, the hierarchy is still inverted.

## Bottom line

DarkPrint's strongest trajectory is a **GitHub-like registry for reusable agent-workflow
specifications**, with both a human discovery interface and an agent discovery interface.
Its moat is the checkable structure around the instructions: typed handoffs, explicit
isolation, versioned contracts, provenance, and explainable diagnostics.

The mock already contains almost every concept the production service may need. Stability
now requires turning each intended capability into a defined workflow with real semantics,
representative states, and a justified place in the hierarchy. Simplification should remove
duplicate teaching and unclear roles, not remove target features merely because their
implementation comes later.
