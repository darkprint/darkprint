# Writing the prose

The author decides the shape. You write the words. Four card fields carry prose (`action`,
`spec`, port `description`, `notes`), and two files beside the cards do (`blueprint.yaml`,
`README.md`).

---

## `action`

One sentence, imperative, naming the operation and the artefact. It is the line a reader
scans; it is not the instruction the agent receives.

> Turn the incoming request into two separate artefacts: an ordered brief, and the acceptance
> criteria the finished work will be judged against.

If it contains an "and" naming two different artefacts *and* the node emits both, check
against the criteria rule below before you keep it.

---

## `spec`, the one that matters

**`spec` is compiled into the node's `prompt`.** It is delivered verbatim to an agent that
does not see the rest of the graph, so it has to be self-sufficient, and it has to respect
the isolation the topology declares, because an absent edge with the criteria paraphrased into
the prose is a false isolation. The engine measures that; it does not take your word for it.

Aim for **150 to 400 words**. Under 40 characters is `card/spec-too-thin`. Under three words is
excluded from the similarity comparison entirely, so a placeholder card is both useless and
unchecked.

Write it as:

1. **What arrives.** Name the input ports and say what is in them.
2. **What to do**, in the order it is done.
3. **What to emit, on which port**, and in what form.
4. **What not to do**: the boundaries from Q0.5 and Q4.3, in the second person, the same
   sentences that went into `will_not`.

For a `shell-tool`, the `spec` still says what arrives and what is emitted; the command in
`params.tool_command` is what runs. For a node inside a cycle, the `spec` states the total
number of attempts in words, and `params.max_retries` holds that total minus one.

### The rule you cannot break

A node whose work is judged must not paraphrase the criteria producer's `spec`. The engine
computes 3-gram Jaccard similarity between the two and warns above **0.35**
(`analysis/criteria-leak-suspected`).

Concretely, in a generator's `spec`:

- name no criterion,
- quote no threshold,
- do not restate the planner's sentences in your own words,
- do not describe how the work will be checked.

The starter blueprint's builder spec measures **0.0356** against its planner's. That is what
independent prose looks like. If you find yourself writing "make sure it passes the checks",
you have just written the leak into the file.

The reason, stated to the author when they push back: whoever writes the work must not see the
acceptance tests, because a node that sees them writes toward them, and the check stops
measuring the work and starts measuring the aim.

### Do not write one house style and vary it per node

Six specs sharing a third of their trigrams cross the threshold against each other. Write each
one about its own job, in its own words.

---

## Port `description`

One line. What is in it, and who it came from, not what the receiving node should do with it.

> The ordered build steps the run was instantiated with, the only thing this node sees.

A one-line description is where the YAML trap lands, because a colon is the natural way to
write one. A plain scalar containing `": "` is parsed as a nested mapping and the whole card
fails with `card/parse-error`. Quote it, or fold it:

```yaml
description: Where it failed: the line and the text     # BREAKS the card
description: "Where it failed: the line and the text"   # fine
```

---

## `notes`

Optional, and absence carries no judgement. Use it for the thing a reader would otherwise
misread as an oversight: the edge you did not draw, the marker you deliberately did not
declare and why, the cap that is load-bearing twice over.

This is the right place to record a judgement call that could have gone the other way, with
what it would cost if it did:

> No `irreversible-action`, deliberately: this node writes one tagged artefact to the run's own
> release target, sends nothing to a third party and deletes nothing. If a reviewer decides a
> release target counts as publication, the marker costs this blueprint 1.5 and takes its
> security level from 4 to 3.

---

## `blueprint.yaml`

The manifest, derived from the interview (SKILL.md, Q5.3) and shown back before it is
written:

```yaml
slug: help-centre-line
title: Help Centre Article Line
summary: >-
  Outline, draft and check help-centre articles against acceptance criteria the drafter
  never sees, with one human approval before anything publishes.
description: |-
  One paragraph per node in the order a run visits them, in the author's words from Q2.1,
  ending with the edge that is deliberately absent and why.
category: Content
tags:
  - help-centre
  - editorial
  - isolation
  - human-gate
```

`summary` is one sentence, because it becomes the compiled pipeline's `goal`: the one line a
runner reads about the whole graph. `slug` is the folder name, the name the author creates
at `/new`, and the graph name in card-id grammar. Nothing else goes in the file; the
registry fills in the author and the dates when it publishes.

---

## `README.md`

For a person opening the folder. Written from the answers, not from a template with the
blanks filled, and in the shape the registry writes for every published bundle, so a folder
that came from this skill and a folder downloaded from the site read the same way:

1. **What the blueprint does**, in the author's own sentence from Q0.1, and the blueprint it
   started from if Phase 1 found one.
2. **The node table**: DOT id, card `id@version`, type, phase, one line each.
3. **The edges, including the ones deliberately absent**, with a line per absence saying why,
   and the guard on every fork. This is the section that earns the file.
4. **What is in the folder**: `topology.dot`, `cards/`, `blueprint.yaml`, and
   `ontology/extensions.yaml` when there is one.
5. **What the validator said**: which validator ran (`darkprint validate`, the
   `/api/validate/bundle` route, or the upload page), the autonomy class and the security
   level it computed, and each warning with the reason it is intended. Never claim the bundle
   validated cleanly without naming which of the three said so.
6. **What these files leave to the runner**: that ports, `cannot`, `will_not` and
   `risk_markers` are enforced when the bundle is validated and by nothing in the compiled
   pipeline, and that every Attractor attribute a card has no field for (goal gates, timeouts,
   the retry policy above `max_retries`) falls to the runner's own default.
7. **How to check it again**: drop the folder on `https://www.darkprint.io/upload`.

---

## Re-emitting an existing bundle

A published card version is never edited in place.

- Content changed ⇒ new version, old file **deleted**, DOT pin updated.
- The bump has to be at least what the engine infers. Under-bumping is
  `card/version-bump-too-small`, an error. The full table is in `references/card-schema.md`.
  The rows that catch people: a port removed, renamed or retyped, a required input added, a
  `cannot` entry added or a `will_not` entry withdrawn are all **major**; `spec`, `model` and
  a new tool, param key, risk marker or dependency are **minor**; a param's *value*, wording
  and reorders are **patch**.
- Leaving the superseded file in `cards/` is `bundle/orphan-card` at best and
  `bundle/digest-mismatch` at worst.
- A card reused from the registry is never re-emitted by you at all. If it needs to change,
  it is a new card with a new id, or the author publishes the change under their own name
  and the DOT pins that.
- When a card's identity is a parameter (the starter encodes its debugger's attempt count in
  the minor version) keep that convention. Two caps behind one pin would be two contents
  behind one reference.
