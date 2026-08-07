# Writing the prose

The author decides the shape. You write the words. Four things carry prose — `action`,
`spec`, port `description`, `notes` — plus the two files that sit beside the bundle.

---

## `action`

One sentence, imperative, naming the operation and the artefact. It is the line a reader
scans; it is not the instruction the agent receives.

> Turn the incoming request into two separate artefacts: an ordered brief, and the acceptance
> criteria the finished work will be judged against.

If it contains an "and" naming two different artefacts *and* the node emits both, check
against the criteria rule below before you keep it.

---

## `spec` — the one that matters

**`spec` is compiled into the node's `prompt`.** It is delivered verbatim to an agent that
does not see the rest of the graph, so it has to be self-sufficient — and it has to respect
the isolation the topology declares, because an absent edge with the criteria paraphrased into
the prose is a false isolation. The engine measures that, it does not take your word for it.

Aim for **150–400 words**. Under 40 characters is `card/spec-too-thin`. Under three words is
excluded from the similarity comparison entirely, so a placeholder card is both useless and
unchecked.

Write it as:

1. **What arrives.** Name the input ports and say what is in them.
2. **What to do**, in the order it is done.
3. **What to emit, on which port**, and in what form.
4. **What not to do** — the boundaries from Q0.5 and Q3.3, in the second person.

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

One line. What is in it, and who it came from — not what the receiving node should do with it.

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

## `README.md`

For a person opening the folder. Written from the answers, not from a template with the blanks
filled:

1. **What the blueprint does**, in the author's own sentence from Q0.1.
2. **The node table** — DOT id, card, type, phase, one line each.
3. **The edges, including the ones deliberately absent**, with a line per absence saying why.
   This is the section that earns the file.
4. **What a reader will see on `/upload`** — the two levels, and each warning you predicted
   with the reason it is intended.
5. **How to read it further**: drop the folder on `darkprint.io/upload` (or
   `http://localhost:3100/upload` when running the site locally). It is analysed in the
   browser tab, nothing is uploaded, nothing is sent anywhere.

Do not claim the bundle has been validated. It has not — the engine is not on this machine.
Say what you checked and against what.

## `AGENTS.md`

For the next agent that opens the directory. Short, and about the rules of this bundle rather
than about DarkPrint in general:

- the card version is the key to the content: never edit a published card in place, bump it and
  update the pin;
- the edges that are deliberately absent, and the `cannot` entries that enforce them;
- which `cannot` entries are enforced by the engine and which are prose;
- where the iteration cap lives and what it is for;
- the one instruction that matters: **do not add an edge from the criteria producer into any
  node whose work is judged**, not even to hand over something else. The check reads the graph
  at node level and the port on that edge does not save it.

---

## Re-emitting an existing bundle

A published card version is never edited in place.

- Content changed ⇒ new version, old file **deleted**, DOT pin updated.
- A changed `spec` prices as a **minor** bump. A changed port, `type` or `param` prices as
  **major**. Under-bumping is `card/version-bump-too-small`, an error.
- Leaving the superseded file in `cards/` is `bundle/orphan-card` at best and
  `bundle/digest-mismatch` at worst.
- When a card's identity is a parameter — the starter encodes its debugger's iteration cap as
  `1.<cap>.0` — keep that convention. Two caps behind one pin would be two contents behind one
  reference.
