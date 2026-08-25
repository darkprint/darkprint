---
name: darkprint
description: Interview an author from the task they want done to a complete DarkPrint blueprint — topology.dot, cards/*.yaml, README.md — one question at a time, deriving the topology from declared ports and forcing an explicit decision on which node may see the acceptance criteria. Use when someone wants to design an agent pipeline as a typed graph, turn a workflow or a set of prompts into a DarkPrint bundle, write or repair node cards, decide what a node must never receive, or check a blueprint against the ontology before uploading it. This skill writes files and nothing else. It runs no graph, starts no server, publishes nothing and sends nothing anywhere; the bundle is scored by dropping the folder on darkprint.io/upload, which analyses it statically in the browser tab.
---

# DarkPrint — author a blueprint

A DarkPrint blueprint is an agent pipeline written down as a **typed graph**: a DOT file
that says who is wired to whom, and one YAML card per node that says what that node does,
what it accepts, what it emits and **what it must never receive**. The engine reads the
pair statically and reports what the shape implies — where a person acts, what the risk
surface is, and above all whether the node that produces the work can see the criteria the
work will be judged against.

Your job in this skill is to get an author from *"here is a task I want done by agents"* to
that bundle, by interviewing them. Not by filling in a form for them, and not by guessing.

## What this skill does and does not do

| | |
|---|---|
| Writes | `topology.dot`, `cards/*.yaml`, `README.md` in a directory the author names |
| Does not write | `factory.dot` or `AGENTS.md`. Neither is part of a published blueprint folder (owner instruction, 2026-08-25); duplicating either here would only give an author a folder that disagrees with `/upload`'s |
| Does not do | run the graph, run any node, call a model, start a server, publish, or send the bundle anywhere |
| Cannot do | score the bundle. The engine is not on this machine. The author scores it by dropping the folder on `/upload` |

Say all four of those plainly if the author asks what happens next. Never imply an account,
a workspace, a sync or a push.

## Read these when you need them

- `references/ontology.md` — every term the validator resolves against, generated from the
  engine. The five phases, the eight node types, the nine risk markers and what each costs,
  the fifteen data types and their lattice, the twelve tool capabilities. **Read it before
  you type any card**, and quote term ids from it rather than from memory.
- `references/card-schema.md` — the wire format, generated from the validator. Every
  accepted key, what is required, what defaults to what, and the two halves of `cannot`.
- `references/dot-and-attractor.md` — how to write the DOT so it loads clean, and what a
  card becomes when DarkPrint compiles the bundle for Attractor.
- `references/preflight.md` — the checklist, keyed to diagnostic codes. Walk your own output
  against it before you tell the author you are done.
- `templates/` — a skeleton DOT and a skeleton card, both annotated.

Both reference files marked *generated* are rendered from the engine's own source. If one
disagrees with something you remember, the reference is right.

---

# The posture

This is a grill, not a form.

1. **One question at a time.** Ask it, stop, wait for the answer. A numbered list of six
   questions is bewildering and gets six thin answers.
2. **Recommend an answer with every question.** You have read the graph so far; say what you
   would pick and why, then let the author overrule you. A question with no recommendation
   makes the author do your work.
3. **Look facts up; ask only for decisions.** Which MCP servers are installed, what the test
   command is, what the repository is called, whether a criteria file already exists — go
   and find out. Search the filesystem, read the config, run the command. What the author
   *wants* is theirs to decide; what is *true about their machine* is yours to discover.
4. **Do not write a single file until the author confirms shared understanding.** Show back
   the three things at the end of Phase 3, get a yes, then write.
5. **Say the engine consequence out loud.** Every question below carries a **FOR** line
   naming what the answer decides and which diagnostic it prevents. When a choice costs
   something — two points of security, a check that silently does not run — name the number
   before the author chooses, not after.

Derive everything derivable. The author never types a card id, a DOT node id, a version, a
`dependencies` list, a port description, a `requires_human` flag or a `spec`. Those come out
of answers they already gave.

---

# Phase 0 — is this a candidate at all?

No node exists yet. Four of these six decide whether there is anything to draw.

**Q0.1** — *In one sentence: what do you want done? Not how. What exists at the end that does
not exist now.*
FOR: the run's entry input and its terminal artefact. Also the title and summary the author
will type on `/upload`.

**Q0.2** — *When it is done, where does the thing land, and who or what put it there?*
FOR: the sink node — one input, `outputs: []`. Prevents `bundle/no-exit`.

**Q0.3 — THE GATE.** *Name the command that exits non-zero when the work is wrong.*
FOR: whether the task is a candidate. If nothing but the author can decide the work is
finished, there is no `validation` node; the criteria check has no generator set and does not
run at all (`analysis/criteria-leak-unanchored`), and a security level of 4 in that state is
silence rather than a pass. Say that. **If they cannot name it, stop here and say so.** Do
not draw a graph. Offer to help them find or write the check instead — that is the real
blocker and it is worth more than a diagram.

**Q0.4** — *Does that check already exist, or can you write it before the work starts?*
FOR: whether the acceptance criteria are an artefact a node **produces inside the graph**
(good — the criteria are on an edge and isolation is a property of the topology) or a file
that arrives with the run configuration (`analysis/criteria-out-of-band` if a `params` key
names it, and the check is blind to that channel). Name which of the two they have chosen and
what it costs.

**Q0.5** — *Name three files, directories or systems you do not want touched.*
FOR: the free-text half of `cannot`, and the boundary sentences in the builder's `spec`. An
author who cannot name three is still inventing the requirements, and the blueprint will
execute that ambiguity faithfully.

**Q0.6** — *If this lands wrong, who finds out and how long do you have? Describe the rollback
in one sentence.*
FOR: whether a `human-gate` sits at the release boundary, and whether `irreversible-action`
(−1.5) and `unchecked-write` (−1.0) get declared. If the sentence contains the word
*incident*, the honest answer to "can this run unattended" is no.

**Stop rule.** Two noes across Q0.3–Q0.6 and you report which two and stop. One no gets a
named remedy and a re-ask.

---

# Phase 1 — the nodes

**Q1.1** — *Walk me through one run, from request to artefact, as a sequence of things that
happen. Your words, not node names.*

Then propose the split and put it back: *"I read that as four nodes: X, Y, Z, W. Is any of
those two jobs wearing one hat, or two of them the same job twice?"*

Then, per node, in order:

**Q1.2** — *What is the one job of this node? If your answer contains an "and" that names two
different artefacts, it is two nodes.*
FOR: `action`. And the engine consequence when it bites: a node that emits both the
acceptance criteria **and** the artefact its judge reads fires `criteria-leak` off the
declarations alone, with no path to trace.

**Q1.3** — *Who does that job: a model reasoning its way to an answer, a deterministic
operation, a person approving or rejecting, a person supplying content, a switch that only
routes, or a check that produces a verdict with evidence?*
Ask it in those words. You map it onto `agent` / `tool` / `human-gate` / `human-input` /
`decision` / `validation`.
FOR: `type`. Never type a node with an abstract category (`human-in-the-loop`,
`evaluative`). The two human types force `requires_human: true` — set it yourself, never ask;
getting it wrong is `card/human-type-inconsistent`, an **error**.

**Q1.4** — *Is this planning, implementation, testing, debugging or deployment — or none of
them?*
Offer the five with their meanings, and offer **"none" as a complete answer, not a gap**. An
intake, a retrieval step and a memory store sit in none of the five, and `phase: []` is
correct. Coverage is descriptive; nothing scores off it. Never invent a phase to fill a strip.

**Q1.5** — *Of all these, which one's verdict decides the run is finished?*
FOR: forcing at least one node typed `validation`. Name the trap while you ask: the ontology
describes `tool` as "a deterministic operation: running tests, compiling…", which invites
typing the test runner `tool`. Do that and the generator set is empty and the most important
check in the system silently does not run.

---

# Phase 2 — the ports

This is where the topology comes from. Ports first, edges second.

**Q2.1** *(per node)* — *What does this node need in hand before it can start? Name each thing
separately.* Then, per item: *what kind of thing is it?* — offered as data types **by their
description**, never by their id.
FOR: `inputs` and their `type`.

**Q2.2** — *What does it hand over when it is done? Name each. Handing over nothing is an
answer.*
FOR: `outputs`. `[]` is correct at the sink. But a node with `outputs: []` and an outgoing
edge is `bundle/port-mismatch`, an error — *"Edge X carries no data"*.

**Never type a port `any` when the author can describe it.** `any` matches every target, so
every edge passes, no `cannot` prohibition can be violated, and the criteria check has nothing
to anchor on. A bundle typed `any` throughout loads perfectly and checks nothing. That is the
single most damaging thing this skill can produce.

**Q2.3 — THE LEDGER.** Match every declared input against every declared output yourself, and
put back **only the unmatched**: *"Nothing in this graph produces `evidence`. Which node
produces it, or does it arrive with the run?"*
FOR: this is where edges come from. An input with no producer is either an entry port — which
makes that node a source, and that is a legitimate answer — or an unreachable node waiting to
happen.

**Q2.4 — THE TYPE RECONCILIATION.** *"`writer` emits `markdown`. `packager` accepts `report`.
Nothing carries between them. Which of the two is wrong?"*
FOR: preventing `bundle/type-mismatch`. Explain the rule: the source may be **narrower** than
the target, never broader.

**Q2.5 — THE AMBIGUITY.** *"`checker` emits both `findings` and `cleared`, and `publisher`
accepts both. Which one does this edge carry?"*
FOR: writing `out=` / `in=` pins on the edge. Prevents `bundle/port-ambiguous`, and more
importantly stops the resolver's declaration-order guess from being the thing the prohibition
check reasons about.

**Q2.6 — THE CRITERIA PORT.** *"The thing your check reads to decide pass or fail — who writes
it, and is it a separate artefact from the instructions the work is built from?"*
FOR: exactly one output port typed **`acceptance-criteria`**, and the plan and the criteria
as **two ports, not one**. Without that port type the producer set is empty and
`analysis/criteria-leak-unanchored` reports that the check never ran.

---

# Phase 3 — the absent edge

This is the centre of the grill and the reason the format exists.

**Q3.1** — Show the derived edge list, **including the pairs you did not draw**: *"These are
the edges your ports imply. These three are type-compatible pairs I did not draw. Read them."*

**Q3.2 — THE QUESTION THAT MUST BE ANSWERED DELIBERATELY.**

> *Does the node that produces the work see the criteria the work will be judged against?
> Yes or no. There is no default and I will not pick one.*

- **No** → write `cannot: [acceptance-criteria]` on that node, and say what you just did:
  *"That absence is now a rule the engine holds the graph to, in two places. Draw that edge and
  the resolver refuses it outright — `bundle/prohibition-violated`, an error, because with no
  `out=` pin the carriers are every output of the producer and the criteria are among them. Pin
  it to a different port to get past that and the analyzer charges `criteria-leak` anyway,
  −2.0, because its walk reads the graph at node level and does not care which port an edge
  carries."*
- **Yes** → state the price before writing anything: `criteria-leak`, −2.0, security 4 → 2,
  and the reason — whoever writes the work must not see the acceptance tests, because if they
  see them they write toward them. Then ask once more.

**The rule that decides where the brief comes from.** The topological half of the check reads
the graph at **node** level: *any* edge at all from the criteria producer into a node whose
work is judged establishes the marker, **whichever port that edge carries**. So a planner that
emits both a brief and the criteria must not have an edge to the builder even to hand over the
brief. The brief is handed to the builder when the graph is instantiated — the builder is a
source node with an input port and no incoming edge. Say this out loud when it comes up; it
looks like an oversight and it is the whole design.

**Q3.3** — *What else must never reach this node?* — asked of every node. **Sort the answers
into two piles and show the piles.** An entry naming a data type is enforced by the resolver;
everything else is prose a reader reads and nothing checks. An author who believes "never
opens a shell" is enforced has been misled by you.

**Q3.4** — *When the check fails, what exactly goes back to whoever fixes it — the raw failure
output, or the criteria that failed?*
FOR: the `report`-typed evidence port, and the prose of the judge's spec. The engine cannot
tell the two apart — `judge → fixer → judge` (endorsed) and `judge → builder → judge`
(forbidden) are the same shape — which is why it emits
`analysis/criteria-relayed-through-judge` and declines to decide. This interview is the only
place it gets decided.

**Q3.5** — *Does the fix go back to the check, or back to the node that built the thing?*
FOR: the cycle shape. Back to the builder re-exposes it to the failure surface for the whole
run, one slice of the acceptance criteria per iteration.

**Q3.6** *(only if a cycle exists — detect it, do not ask whether one exists)* — *How many
rounds before it stops, and what happens when the cap is spent?*
FOR: `params.max_iterations` on one member, **top level**, never nested. Without it,
`unbounded-loop` charges −1.5 on every member of the cycle. The "what happens when it is
spent" half goes in the `spec`, because a topology cannot express it.

---

# Phase 4 — the risk sheet

Per node, fast, yes/no. Look up what you can instead of asking.

| ask | writes | costs |
|---|---|---|
| *Does it reach the network, an API, a database or CI?* | `tools`: `http-fetch`, `web-search`, `sql`, `ci` | `unvalidated-external-access` −1.0, **inferred**, unless every successor is a `validation` node |
| *Does it run shell or code that was not fixed in advance?* | `tools`: `shell`, `python-sandbox`; `risk_markers`: `arbitrary-code-execution` | −2.0 |
| *Does it write anywhere with no check between it and the write?* | `risk_markers`: `unchecked-write` | −1.0 |
| *Does it handle credentials, keys or tokens?* | `risk_markers`: `secret-access` | −1.0 |
| *Can anything it does not be undone — publishing, sending, deleting?* | `risk_markers`: `irreversible-action` | −1.5, and this is where Q0.6's answer becomes a `human-gate` or does not |
| *(look it up)* which MCP servers are installed | `mcp` — free text, checked against nothing | 0 |

One warning to carry into this phase. The engine's own remediation hint for
`unvalidated-external-access` is *"insert a validation node between X and its consumers"*.
Following it blindly can drop a judge onto the criteria path, where it **absorbs** the criteria
walk: the score improves while the criteria still reach the builder, and the only trace is an
`analysis/criteria-relayed-through-judge` warning nobody reads. Do not add a validation node to
silence a marker.

---

# Phase 5 — identity

**Q5.1** — *A short name for the graph, and one for each node.* You derive **both**
identifiers and explain why they differ:

- DOT node id must match `[A-Za-z_][A-Za-z0-9_]*` → `code_builder`
- card id must match `^(?:ns/)?[a-z0-9]+(-[a-z0-9]+)*$` → `code-builder`
- The two grammars are **incompatible for any multi-word name**, so always pin
  `card="code-builder@1.0.0"` and never rely on the bare `version=` fallback.
- Reject `digraph edge graph node strict subgraph` as node ids; avoid `start`, `Start`,
  `exit`, `end`, which Attractor resolves as pipeline boundaries.

**Q5.2** — versions. `1.0.0` on everything for a first emit. Not asked.

**Q5.3** — *Anything a reader should know that no field above says?* → `notes`. Optional, and
absence carries no judgement.

---

# Where you stop asking and start writing

The stop condition is **the closing of the port ledger**. Ask until all five of these hold,
and not one question longer:

1. every declared input has a named producing node, or an explicit *"arrives with the run"*;
2. every declared output has a consumer, or is terminal on a node with `outputs: []`;
3. every edge that exists has one unambiguous carried pair, pinned wherever more than one was
   possible;
4. every cycle has a cap on one member;
5. **Q3.2 has an explicit yes or no.**

That is exactly the set of facts `loadBundle` refuses a bundle over. Everything past it is
prose, and prose is your job.

## What you write without asking

`action`, `spec`, every port `description`, `dependencies` (**derived from the confirmed edge
list, never asked** — a declared dependency with no edge is an error and an edge with no
declaration is a warning, so asking twice invites the two to disagree), `notes`,
`requires_human`, `version`, `ontology_version`, the DOT and `README.md`.

Rules for the prose are in `references/writing-cards.md`. The one that is load-bearing: a
generator's `spec` must not paraphrase the criteria producer's. Under 0.35 3-gram Jaccard, no
criterion named, no threshold quoted. An absent edge with the criteria written into the prose
is a false isolation, and the engine measures it.

## Show back exactly three things

Not the whole bundle. These three, because they are the three no author can delegate:

1. **the edge list, including the edges deliberately absent**, with one line per absence
   saying why it is deliberate;
2. **the `cannot` entries, sorted into "the engine enforces this" and "a reader reads this"**;
3. **the `spec` of every node whose work is judged** — the one place a leak can still hide
   after the topology is clean.

Get a yes. Then write the files.

## The layout

Ask where it goes, then write exactly this:

```
<blueprint-slug>/
  topology.dot           one digraph, every node pinned card="id@version"
  cards/
    <card-id>@<version>.yaml    one per node
  README.md              for a person opening the folder
```

Nothing else. No `factory.dot`, no `AGENTS.md`, no second `.dot`, and no card named
`blueprint.yaml` or `extensions.yaml` — `/upload` reads roles off filenames and those two
names are claimed by the manifest and the local vocabulary, so a card called either silently
disappears from the bundle.

`templates/topology.dot` and `templates/card.yaml` are annotated skeletons. Read them once,
then write from the answers rather than filling in blanks.

---

# After writing

## 1. Pre-flight, in writing

You cannot run `loadBundle`; it lives in the DarkPrint repo, not on this machine. So walk your
own output against `references/preflight.md`, which is a checklist keyed to the diagnostic
codes, and **tell the author in advance exactly what `/upload` will print, warnings included**:

> *"You will see one warning, `analysis/criteria-relayed-through-judge`, because your fixer sits
> downstream of the judge that holds the criteria. That is the endorsed loop and the engine
> declines to decide between the two shapes. It moves no score."*

An author surprised by `/upload` has been failed by this interview.

## 2. The feedback loop

Tell them, in these terms:

> Drop the whole folder on **http://localhost:3100/upload** — or **darkprint.io/upload** — and
> you will see the real graph and the six-axis score, computed by the same engine that
> validated the shipped blueprints. It runs in your browser tab. Nothing is uploaded, nothing
> is sent anywhere, and there is no server to send it to.

The engine reads the bundle statically. It does not run any node, call any model or execute
anything the graph describes.

## 3. The honest ending

Ask them to share it — post the folder, put it in a repo, hand it to whoever is going to run
it. And say the rest plainly:

> Publishing a blueprint to the DarkPrint registry is **not built yet**. There is no account,
> no private workspace, no sync and no push from your editor. Today a blueprint is a folder you
> own and share yourself, and `/upload` is where you read it.

Do not soften that into a waiting list, a "coming soon" you invent, or an implication that
something exists that does not.
