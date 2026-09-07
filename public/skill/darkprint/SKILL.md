---
name: darkprint
description: Interview an author from the task they want done to a complete DarkPrint blueprint (topology.dot, cards/*.yaml, blueprint.yaml, README.md), searching the registry for a blueprint or cards to reuse before drawing anything, deriving the topology from declared ports, guarding every fork, and forcing an explicit decision on which node may see the acceptance criteria. Use when someone wants to design an agent pipeline as a typed graph, turn a workflow or a set of prompts into a DarkPrint bundle, write or repair node cards, decide what a node must never receive, or validate a blueprint before publishing it. This skill writes files and validates them. It runs no graph, calls no model on the author's behalf, publishes nothing by itself and sends nothing anywhere until the author chooses to publish, which is a step they take on darkprint.io or with their own API key.
---

# DarkPrint: author a blueprint

A DarkPrint blueprint is an agent pipeline written down as a **typed graph**: a DOT file
that says who is wired to whom, and one YAML card per node that says what that node does,
what it accepts, what it emits and **what it must never receive**. The engine reads the
pair statically and reports what the shape implies: where a person acts, what the risk
surface is, and above all whether the node that produces the work can see the criteria the
work will be judged against.

Your job in this skill is to get an author from *"here is a task I want done by agents"* to
that bundle, by interviewing them. Not by filling in a form for them, and not by guessing.

## What this skill does and does not do

| | |
|---|---|
| Searches | the DarkPrint registry, before drawing anything, for a blueprint or cards that already do the job (Phase 1) |
| Writes | `topology.dot`, `cards/<id>@<version>.yaml`, `blueprint.yaml`, `README.md` in a directory the author names, plus `ontology/extensions.yaml` only when the author asked for a local term |
| Does not write | `factory.dot` or `AGENTS.md`. Neither is part of a published blueprint folder; duplicating either here would give an author a folder that disagrees with the registry's |
| Validates | with `darkprint validate <dir>` when the CLI is installed, else by POSTing the files to `https://www.darkprint.io/api/validate/bundle`, else by asking the author to drop the folder on `/upload` |
| Does not do | run the graph, run any node, call a model on the author's behalf, start a server, or publish by itself |
| Sends | nothing, until the author chooses to validate over HTTP or to publish. Both are steps the author takes and can decline |

Say those plainly if the author asks what happens next. The registry has accounts
(`/welcome`), drafts (`/new`), per-release visibility, publishing from `/upload`, and API
keys from `/settings`. Do not describe any of them as unbuilt, and do not invent anything
beyond them.

## Read these when you need them

- `references/ontology.md`: every term the validator resolves against, generated from the
  engine. The five phases, the node types, the risk markers and what each costs, the data
  types and their lattice, the twelve tool capabilities. **Read it before you type any
  card**, and quote term ids from it rather than from memory.
- `references/card-schema.md`: the wire format, generated from the validator. Every accepted
  key, what is required, what defaults to what, which of `cannot` and `will_not` the engine
  checks, and what each kind of edit costs in version.
- `references/dot-and-attractor.md`: how to write the DOT so it loads clean, the edge guard
  grammar, and what a card becomes when the bundle is compiled for Attractor.
- `references/preflight.md`: the checklist, keyed to diagnostic codes. Walk your own output
  against it before you run the validator, so nothing the validator prints surprises you.
- `references/writing-cards.md`: the prose rules for `action`, `spec`, port descriptions,
  `notes`, `README.md` and `blueprint.yaml`.
- `templates/`: a skeleton DOT, a skeleton card for a node instructed by prose, and a
  skeleton card for a node that is a shell command. All three are annotated.

Both reference files marked *generated* are rendered from the engine's own source. If one
disagrees with something you remember, the reference is right.

---

# The posture

This is a grill, not a form.

1. **Recommend an answer with every question.** You have read the graph so far; say what you
   would pick and why, then let the author overrule you. A question with no recommendation
   makes the author do your work.
2. **Look facts up; ask only for decisions.** Which MCP servers are installed, what the test
   command is, what the repository is called, whether a criteria file already exists, and
   whether the registry already holds a blueprint for this task: go and find out. Search the
   filesystem, read the config, run the command, query the registry. What the author *wants*
   is theirs to decide; what is *true about their machine and the registry* is yours to
   discover.
3. **Pace by phase.** Phase 0 and Phase 4 are one question per turn: ask it, stop, wait. Each
   of those answers changes the next question. Phases 2, 3 and 5 are ledger work: ask the
   whole frontier in one numbered round, every question whose prerequisites are settled, each
   with your recommendation, and never a question whose answer another open question would
   change.
4. **Keep the tree visible.** At each phase boundary print three short lists: settled, open,
   blocked on. Skip any question whose answer is already settled by an earlier one. The
   interview ends when the open list is empty, not when the script runs out.
5. **A question the author cannot answer is a prototype, not a guess.** "I don't know" is a
   real answer. When it lands on something the graph depends on, offer the smallest graph
   that would expose the answer (usually two nodes: a builder and one check) and stop
   grilling until they have run it.
6. **Do not write a single file until the author confirms shared understanding.** Show back
   the three things at the end of Phase 5, get a yes, then write.
7. **Say the engine consequence out loud.** Every question below carries a **FOR** line naming
   what the answer decides and which diagnostic it prevents. When a choice costs something,
   two points of security or a check that silently does not run, name the number before the
   author chooses, not after.

Derive everything derivable. The author never types a card id, a DOT node id, a version, a
`dependencies` list, a port description, a `spec`, a slug or a `condition`. Those come out of
answers they already gave.

---

# Phase 0: the need

No node exists yet. Three questions decide whether there is anything to draw. One per turn.

**Q0.1** *In one sentence: what do you want done? Not how. What exists at the end that does
not exist now.*
FOR: the run's entry input and its terminal artefact, the search sentence for Phase 1, and
`blueprint.yaml`'s `title` and `summary`.

**Q0.2** *When it is done, where does the thing land, and who or what put it there?*
FOR: the sink node, one input and `outputs: []`. Prevents `bundle/no-exit`. If the answer
names a place outside the author's control (a production system, a customer, a payment),
Q0.6's rollback question is already answered and a `human-gate` sits at that boundary.

**Q0.3, THE GATE.** *Name the command that exits non-zero when the work is wrong.*
FOR: whether the task is a candidate at all. Without a nameable check there is no
`validation` node, and the criteria check has nothing to anchor on. Say precisely what the
engine does then: with no `validation` node **and** no `acceptance-criteria` port it says
nothing at all; with one leg present and the other missing it warns
`analysis/criteria-leak-unanchored`. Either way a security level of 4 is silence, not a pass.

**Stop rule for Phase 0.** If the author cannot name the check, do not draw a graph. Offer the
two-node prototype instead: one node that produces the artefact and one `shell-tool` node
that runs whatever command they *think* would catch a wrong result, with nothing else. Ask
them to run it once by hand. The check they discover is worth more than a diagram, and the
interview resumes from Q0.3 when they have it.

Then, still one per turn:

**Q0.4** *Does that check already exist, or can you write it before the work starts?*
FOR: whether the acceptance criteria are an artefact a node **produces inside the graph**
(good: the criteria are on an edge and isolation is a property of the topology) or a file
that arrives with the run configuration (`analysis/criteria-out-of-band` if a `params` key
names it, and the check is blind to that channel). Name which of the two they have chosen and
what it costs.

**Q0.5** *Name three files, directories or systems you do not want touched.*
FOR: the `will_not` entries, and the boundary sentences in the builder's `spec`. An author
who cannot name three is still inventing the requirements, and the blueprint will execute
that ambiguity faithfully.

**Q0.6** *If this lands wrong, who finds out and how long do you have? Describe the rollback
in one sentence.* Skip it if Q0.2 already answered it.
FOR: whether a `human-gate` sits at the release boundary, and whether `irreversible-action`
(−1.5) and `unchecked-write` (−1.0) get declared. If the sentence contains the word
*incident*, the honest answer to "can this run unattended" is no.

---

# Phase 1: reuse before you draw

The registry is part of the environment. Search it with the author's own sentence from Q0.1
**before** asking them to describe a single node, and do it yourself: this is a fact, not a
decision.

**How to search.** If the DarkPrint MCP server is configured in this session, call
`find_blueprints` with the task sentence, then `find_cards` with the same sentence. If it is
not, the same searches are anonymous HTTP GETs:

```
GET https://www.darkprint.io/api/mcp/blueprints/find?task=<the sentence, URL-encoded>
GET https://www.darkprint.io/api/mcp/cards/find?task=<the sentence, URL-encoded>
```

Both rank by similarity to the sentence and return hits with a score and the evidence they
matched on. A hit with a low score is not a hit. If the author wants the tools in every
session, the one-line setup is `claude mcp add --transport http darkprint
https://www.darkprint.io/api/mcp` for Claude Code and `codex mcp add darkprint --url
https://www.darkprint.io/api/mcp` for Codex.

**Q1.1, a whole blueprint.** When a blueprint hit covers the outcome (Q0.1) *and* the gate
(Q0.3), fetch it: `get_blueprint` with its owner and slug, or
`GET https://www.darkprint.io/api/mcp/blueprints/<owner>/<slug>/bundle`. Show the author its
node list and its **edge list, including the edges it deliberately does not draw**, in their
words, and ask:

> *Start from this, or from nothing? Starting from it means we keep its cards and its
> isolation decisions and change only what your task needs.*

Recommend one. If they start from it, the rest of the interview is a diff: Phase 2 asks only
about nodes the task adds or removes, Phase 3 re-runs the ledger over the changed ports, and
Phase 4 re-asks Q3.2 because it is never inherited. The `README.md` then names the blueprint
it started from, and the release records the lineage when they publish it as a fork.

**Q1.2, individual cards.** When no blueprint fits but `find_cards` returns a card that does
one of the jobs the author is about to describe, offer it by name and version and read it
first (`read_card`, or `GET https://www.darkprint.io/api/mcp/cards/<id>@<version>`). A card
you reuse is **pinned by `id@version`** in the DOT and copied verbatim into `cards/`, never
rewritten: rewriting it makes a new card with a stolen name, and the digest check on the
registry will say so.

If nothing fits, say so in one line and move on. The search cost one turn; a card written
from nothing that duplicates a published one costs the reader who meets both.

---

# Phase 2: the nodes

**Q2.1** *Walk me through one run, from request to artefact, as a sequence of things that
happen. Your words, not node names.*

Then propose the split and put it back: *"I read that as four nodes: X, Y, Z, W. Is any of
those two jobs wearing one hat, or two of them the same job twice?"*

Then, per node, as one numbered round:

**Q2.2** *What is the one job of this node? If your answer contains an "and" that names two
different artefacts, it is two nodes.*
FOR: `action`. And the engine consequence when it bites: a node that emits both the
acceptance criteria **and** the artefact its judge reads fires `criteria-leak` off the
declarations alone, with no path to trace.

**Q2.3** *Who does that job?* Offer all ten answers in plain words, and map each to its type
yourself:

| the author says | `type` | what else it needs |
|---|---|---|
| a model reasoning its way to an answer | `agent` | a `spec` that is the whole prompt |
| a deterministic operation described in prose (compile, format, call an API) | `tool` | a `spec` |
| a fixed shell command the runner executes | `shell-tool` | **ask for the exact command**: it goes in `params.tool_command`, and a missing one is `card/missing-field` |
| a person approving or rejecting | `human-gate` | nothing; the type alone says a person acts here |
| a person supplying content or data | `human-input` | nothing; same |
| a switch that only routes | `decision` | guarded edges out of it (Phase 4, Q3.7) |
| a check that produces a verdict with evidence | `validation` | the criteria on an input port, evidence on an output port |
| the same step run on several inputs at once | `parallel`, then `parallel.fan-in` where the copies rejoin | both nodes, and a card each |
| a supervisor that polls a sub-run and decides whether to go round again | `manager-loop` | a cap on the loop it supervises |

FOR: `type`. Never type a node with an abstract category (`human-in-the-loop`, `evaluative`,
`orchestration`). Whether a person acts at a node is read from `type` and from nothing else:
there is no flag beside it, and getting it wrong puts a person on a node where nobody is, or
reads a staffed node as unattended, with nothing else on the card able to correct it.

**Q2.4** *Is this planning, implementation, testing, debugging or deployment, or none of
them?*
Offer the five with their meanings, and offer **"none" as a complete answer, not a gap**. An
intake, a retrieval step and a memory store sit in none of the five, and `phase: []` is
correct. Coverage is descriptive; a phase left to somebody else costs nothing. Never invent a
phase to fill a strip.

**Q2.5** *Of all these, which one's verdict decides the run is finished?*
FOR: forcing at least one node typed `validation`. Name the trap while you ask: the ontology
describes `tool` as "a deterministic operation: running tests, compiling…", which invites
typing the test runner `tool` or `shell-tool`. Do that and the generator set is empty and the
most important check in the system silently does not run. The test runner that decides the
verdict is `validation`; a `shell-tool` may run *under* it, feeding it evidence.

---

# Phase 3: the ports and the ledger

This is where the topology comes from. Ports first, edges second. Ask each round as a
numbered frontier.

**Q3.1** *(per node)* *What does this node need in hand before it can start? Name each thing
separately.* Then, per item: *what kind of thing is it?*, offered as data types **by their
description**, never by their id.
FOR: `inputs` and their `type`.

**Q3.2** *What does it hand over when it is done? Name each. Handing over nothing is an
answer.*
FOR: `outputs`. `[]` is correct at the sink. But a node with `outputs: []` and an outgoing
edge is `bundle/port-mismatch`, an error: *"Edge X carries no data"*.

**Never type a port `any` when the author can describe it.** `any` matches every target, so
every edge passes, no `cannot` prohibition can be violated, and the criteria check has nothing
to anchor on. A bundle typed `any` throughout loads perfectly and checks nothing. That is the
single most damaging thing this skill can produce.

**Q3.3, THE LEDGER.** Match every declared input against every declared output yourself, and
put back **only the unmatched**: *"Nothing in this graph produces `evidence`. Which node
produces it, or does it arrive with the run?"*
FOR: this is where edges come from. An input with no producer is either an entry port, which
makes that node a source and is a legitimate answer, or an unreachable node waiting to
happen.

**Q3.4, THE TYPE RECONCILIATION.** *"`writer` emits `markdown`. `packager` accepts `report`.
Nothing carries between them. Which of the two is wrong?"*
FOR: preventing `bundle/type-mismatch`. Explain the rule: the source may be **narrower** than
the target, never broader.

**Q3.5, THE AMBIGUITY.** *"`checker` emits both `findings` and `cleared`, and `publisher`
accepts both. Which one does this edge carry?"*
FOR: writing `out=` / `in=` pins on the edge. Prevents `bundle/port-ambiguous`, and more
importantly stops the resolver's declaration-order guess from being the thing the prohibition
check reasons about.

**Q3.6, THE CRITERIA PORT.** *"The thing your check reads to decide pass or fail: who writes
it, and is it a separate artefact from the instructions the work is built from?"*
FOR: exactly one output port typed **`acceptance-criteria`**, and the plan and the criteria
as **two ports, not one**. Without that port type the producer set is empty and
`analysis/criteria-leak-unanchored` reports that the check never ran.

---

# Phase 4: isolation, and the guards

This is the centre of the grill and the reason the format exists. One question per turn.

**Q4.1** Show the derived edge list, **including the pairs you did not draw**: *"These are
the edges your ports imply. These three are type-compatible pairs I did not draw. Read them."*

**Q4.2, THE QUESTION THAT MUST BE ANSWERED DELIBERATELY.**

> *Does the node that produces the work see the criteria the work will be judged against?
> Yes or no. There is no default and I will not pick one.*

- **No**: write `cannot: [acceptance-criteria]` on that node, and say what you just did:
  *"That absence is now a rule the engine holds the graph to, in two places. Draw that edge and
  the resolver refuses it outright, `bundle/prohibition-violated`, an error, because with no
  `out=` pin the carriers are every output of the producer and the criteria are among them. Pin
  it to a different port to get past that and the analyzer charges `criteria-leak` anyway,
  −2.0, because its walk reads the graph at node level and does not care which port an edge
  carries."*
- **Yes**: state the price before writing anything: `criteria-leak`, −2.0, security 4 → 2,
  and the reason. Whoever writes the work must not see the acceptance tests, because if they
  see them they write toward them. Then ask once more.

**The rule that decides where the brief comes from.** The topological half of the check reads
the graph at **node** level: *any* edge at all from the criteria producer into a node whose
work is judged establishes the marker, **whichever port that edge carries**. So a planner that
emits both a brief and the criteria must not have an edge to the builder even to hand over the
brief. The brief is handed to the builder when the graph is instantiated: the builder is a
source node with an input port and no incoming edge. Say this out loud when it comes up; it
looks like an oversight and it is the whole design.

**Q4.3** *What else must never reach this node?*, asked of every node. **Sort the answers into
the two fields and show the sort.** An entry naming a data type goes in `cannot` and the
resolver enforces it; everything else goes in `will_not` and is a sentence a reader reads and
the instantiated agent is told, which nothing checks. An author who believes "never opens a
shell" is enforced has been misled by you.

**Q4.4** *When the check fails, what exactly goes back to whoever fixes it: the raw failure
output, or the criteria that failed?*
FOR: the `report`-typed evidence port, and the prose of the judge's spec. The engine cannot
tell the two apart. `judge → fixer → judge` (endorsed) and `judge → builder → judge`
(forbidden) are the same shape, which is why it emits
`analysis/criteria-relayed-through-judge` and declines to decide. This interview is the only
place it gets decided.

**Q4.5** *Does the fix go back to the check, or back to the node that built the thing?*
FOR: the cycle shape. Back to the builder re-exposes it to the failure surface for the whole
run, one slice of the acceptance criteria per iteration.

**Q4.6** *(only if a cycle exists: detect it, do not ask whether one exists)* *How many
attempts in all before it stops?*
FOR: the iteration cap on one member of the cycle, **top level** in `params`, never nested.
Without it, `unbounded-loop` charges −1.5 on every member.

**Write `params.max_retries`, and write the number Attractor counts.** The engine accepts
`max_iterations`, `maxIterations` and `max_retries` and compiles all three to Attractor's
`max_retries`, which counts the attempts **after** the first: `max_retries: 2` is three
attempts in all. Ask for the total, write the total minus one, and state the total in the
`spec` so the two agree. A card whose prose says "stop after three attempts" and whose params
say `3` has authorised four.

**Q4.7, THE GUARD.** *(every node with two or more outgoing edges: the check, every
`decision`, every `manager-loop`)* *Which of these edges is taken when this node succeeds,
and which when it does not?*
FOR: a `condition` on every arm of the fork. A runner picks an edge in a fixed order: a
`condition` that holds first; then an edge whose `label` matches the label the node asked
for; then a next id the node suggested; then the higher `weight`; and on a tie, **the target
id that sorts first**. Two bare edges out of one node are a branch decided by the spelling of
the node names, and a loop whose fix arm sorts before its ship arm repairs until the cap is
spent and never ships.

Write `condition="outcome=success"` on the arm taken when the node succeeds and
`condition="outcome!=success"` on the other. The grammar is small and the linter holds you to
it (`attractor/condition-syntax`, which a runner grades as an error and refuses the whole
pipeline over): keys are `outcome`, `preferred_label` or `context.<dotted.path>`; operators are
`=` and `!=`; clauses join with `&&`; nothing else parses. No `||`, no `!`, no comparison, no
`contains`. One key against its own negation is the only total split it can make, so a
verdict that is neither success nor failure lands on the arm that does not ship. A fork the
author wants decided by preference rather than outcome takes `weight=<integer>` on the
preferred arm instead, and you say which of the two they chose.

---

# Phase 5: risk and identity

Per node, fast, as one numbered round. Look up what you can instead of asking.

**Q5.1, the risk sheet.**

| ask | writes | costs |
|---|---|---|
| *Does it reach the web, an API, a database or CI?* | `tools`: `web-search`, `http-fetch`, `sql`, `ci` | `unvalidated-external-access` −1.0, **inferred**, unless every successor is a `validation` node |
| *Does it run shell or code that was not fixed in advance?* | `tools`: `shell`, `python-sandbox`; `risk_markers`: `arbitrary-code-execution` | −2.0. A `shell-tool` whose command is fixed in `params.tool_command` carries `tools: [shell]` and no marker; one whose command runs something a previous node wrote carries the marker |
| *Does it read or write files, commit to a repository, query a vector store, post to a chat channel, or wait on a person's review?* | `tools`: `file-io`, `git`, `vector-store`, `messaging`, `human-review` | 0. Nothing is inferred from these; they are the permission list the card publishes, and a node that commits with `tools: []` is lying |
| *Does it write anywhere with no check between it and the write?* | `risk_markers`: `unchecked-write` | −1.0 |
| *Does it handle credentials, keys or tokens?* | `risk_markers`: `secret-access` | −1.0 |
| *Can anything it does not be undone: publishing, sending, deleting?* | `risk_markers`: `irreversible-action` | −1.5, and this is where Q0.6's answer becomes a `human-gate` or does not |
| *(look it up)* which MCP servers are installed | `mcp`: free text, checked against nothing | 0 |

One warning to carry into this phase. The engine's own remediation hint for
`unvalidated-external-access` is *"insert a validation node between X and its consumers"*.
Following it blindly can drop a judge onto the criteria path, where it **absorbs** the criteria
walk: the security level improves while the criteria still reach the builder, and the only
trace is an `analysis/criteria-relayed-through-judge` warning nobody reads. Do not add a
validation node to silence a marker.

**Q5.2, names.** *A short name for the graph, and one for each node.* You derive **both**
identifiers and explain why they differ:

- DOT node id must match `[A-Za-z_][A-Za-z0-9_]*` → `code_builder`
- card id must match `^(?:ns/)?[a-z0-9]+(-[a-z0-9]+)*$` → `code-builder`
- The two grammars are **incompatible for any multi-word name**, so always pin
  `card="code-builder@1.0.0"` and never rely on the bare `version=` fallback.
- Reject `digraph edge graph node strict subgraph` as node ids; avoid `start`, `Start`,
  `exit`, `end`, which Attractor resolves as pipeline boundaries. No diagnostic warns about
  those four: the exporter renames the node and records the original in `dp_node`.

**Q5.3, the manifest.** `blueprint.yaml` is derived, not asked, and shown back:

| field | from |
|---|---|
| `slug` | the graph name from Q5.2, in card-id grammar; also the folder name and the name they create at `/new` |
| `title` | Q0.1, as a title |
| `summary` | Q0.1, one sentence. It becomes the compiled pipeline's `goal`, so it is the one line the runner reads |
| `description` | Q2.1's walk-through, in prose, ending with the edge that is deliberately absent |
| `category` | one word for the domain (Software, Content, Data, Operations, Research); ask only if none is obvious |
| `tags` | three to six lowercase words, from the outcome, the domain and the shape (`isolation`, `human-gate`, `loop`) |

**Q5.4, versions.** `1.0.0` on every card you wrote for a first emit, and the version the
registry gave it on every card you reused. Not asked.

**Q5.5** *Anything a reader should know that no field above says?* → `notes`. Optional, and
absence carries no judgement.

---

# Where you stop asking and start writing

The stop condition is **the closing of the port ledger, with every fork guarded and Q4.2
answered**. Ask until all seven of these hold, and not one question longer:

1. every declared input has a named producing node, or an explicit *"arrives with the run"*;
2. every declared output has a consumer, or is terminal on a node with `outputs: []`;
3. every edge that exists has one unambiguous carried pair, pinned wherever more than one was
   possible;
4. every cycle has a cap on one member, written as the number Attractor counts;
5. every node with two or more outgoing edges has a `condition` on every arm, or a `weight`
   the author chose;
6. every `shell-tool` has its command;
7. **Q4.2 has an explicit yes or no.**

The first four and the last are the facts `loadBundle` refuses a bundle over; the fifth and
sixth are the facts a runner refuses it over. Everything past them is prose, and prose is your
job.

## What you write without asking

`action`, `spec`, every port `description`, `dependencies` (**derived from the confirmed edge
list, never asked**: a declared dependency with no edge is an error and an edge with no
declaration is a warning, so asking twice invites the two to disagree), `notes`, `version`,
every `condition`, `blueprint.yaml`, the DOT and `README.md`.

Rules for the prose are in `references/writing-cards.md`. The one that is load-bearing: a
generator's `spec` must not paraphrase the criteria producer's. Under 0.35 3-gram Jaccard, no
criterion named, no threshold quoted. An absent edge with the criteria written into the prose
is a false isolation, and the engine measures it.

## Show back exactly three things

Not the whole bundle. These three, because they are the three no author can delegate:

1. **the edge list, including the edges deliberately absent and the guard on every fork**,
   with one line per absence saying why it is deliberate;
2. **the `cannot` and `will_not` entries, and why each one is in the field it is in**;
3. **the `spec` of every node whose work is judged**: the one place a leak can still hide
   after the topology is clean.

Get a yes. Then write the files.

## The layout

Ask where it goes, then write exactly this:

```
<slug>/
  topology.dot                 one digraph, every node pinned card="id@version"
  cards/
    <card-id>@<version>.yaml   one per node; reused cards byte for byte
  blueprint.yaml               slug, title, summary, description, category, tags
  README.md                    for a person opening the folder
  ontology/
    extensions.yaml            ONLY when the author asked for a local term, and it defines it
```

Nothing else. No `factory.dot`, no `AGENTS.md`, no second `.dot`, and no card named
`blueprint.yaml` or `extensions.yaml`: the registry reads roles off filenames and those two
names are claimed by the manifest and the local vocabulary, so a card called either silently
disappears from the bundle.

`templates/topology.dot`, `templates/card.yaml` and `templates/shell-tool-card.yaml` are
annotated skeletons. Read them once, then write from the answers rather than filling in
blanks.

---

# After writing

## 1. Validate, in this order

Walk `references/preflight.md` first, so you already know what the validator will say. Then
run it. Three ways, and you take the first that is available:

**a. The CLI, if it is installed.** `command -v darkprint` answers; then
`darkprint validate <slug>` prints every finding with its code and exits 1 only when one of
them is an error. The package is not on npm yet, so most machines do not have it; do not try
`npx darkprint`.

**b. The registry's validator, anonymous, over HTTP.** Ask first: this sends the whole folder
to darkprint.io. The registry stores nothing from it and needs no account, but the files
leave the machine, so say that in one line and get a yes. Then POST them as JSON:

```
POST https://www.darkprint.io/api/validate/bundle
content-type: application/json

{
  "dot": "<contents of topology.dot>",
  "cardFiles": { "cards/<card-id>@<version>.yaml": "<contents>", ... },
  "manifest": { "slug": "...", "title": "...", "summary": "...", "description": "...", "category": "...", "tags": [...] },
  "vocabulary": "<contents of ontology/extensions.yaml, only if it exists>"
}
```

It answers 200 with `diagnostics` (each with `code`, `severity`, `message`, `hint` and a
`location`) plus the resolved `blueprint` and its `analysis` when the bundle loaded. Nothing
is stored. A 400 means the body was not that shape; a 413 means it was too large.

**c. The upload page.** Ask the author to drop the folder on
`https://www.darkprint.io/upload`. It runs the same engine in the browser tab and shows the
same diagnostics beside the drawn graph.

Loop on errors: fix, re-run, until no diagnostic has `severity: error`. Then read the warnings
back to the author **before they see them**, one line each, saying why each is intended:

> *"One warning, `analysis/criteria-relayed-through-judge`, because your fixer sits downstream
> of the judge that holds the criteria. That is the endorsed loop and the engine declines to
> decide between the two shapes. It charges nothing."*

A warning you cannot explain is a defect you have not found yet.

## 2. Hand-off

Publishing is the author's step, and it needs their account. Tell them the two ways, and
which one you recommend:

**From the browser.** Sign in at `https://www.darkprint.io/welcome`; create the slug at
`https://www.darkprint.io/new`, choosing public or private; then drop the folder on
`https://www.darkprint.io/upload?owner=<handle>&slug=<slug>` and press Publish. The upload
page re-runs the validator and refuses only errors; every warning you predicted appears
there exactly as you said it would.

**From the terminal, with a write-scoped API key.** The author creates one at
`https://www.darkprint.io/settings`, and it stays theirs: never ask them to paste it into
the conversation, and never write it into a file. With the key in their shell as
`$DARKPRINT_KEY`, the same JSON as the validator's body, plus `ownerHandle`, `slug`,
`version` and an optional `visibility`, publishes a release:

```
curl -X POST https://www.darkprint.io/api/bundles \
  -H "Authorization: Bearer $DARKPRINT_KEY" \
  -H "content-type: application/json" \
  --data @publish.json
```

where `publish.json` is `{ "ownerHandle": "<handle>", "slug": "<slug>", "version": "1.0.0",
"visibility": "private", "dot": ..., "cardFiles": ..., "manifest": ..., "vocabulary": ... }`.
The response names the release and its digest. A 401 is a missing or read-only key; a 404
on a slug the author owns means the slug was never created.

Either way, say the rest plainly: this skill wrote the files and checked them. It ran no
node, and it published nothing itself. What happens to the folder from here is the author's
choice, and a folder they never publish is still a valid blueprint they can hand to whoever
runs it.
