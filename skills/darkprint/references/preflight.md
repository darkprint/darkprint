# Pre-flight

The checklist you walk your own output against **before** you run the validator, so that
nothing it prints surprises you. It is not a substitute for running it: `SKILL.md`'s
"After writing" names the three ways, and you take the first one available.

Work down it in order. Anything marked **error** means the bundle will not load and will
not publish, and you fix it. Anything marked *warning* the author will see, on the upload
page or in the validator's output, so **predict it out loud** before they do: an author
surprised by the upload screen has been failed by the interview.

---

## 1. The DOT parses

- [ ] `digraph`, not `graph`. Every edge `->`, never `--`. `dot/not-directed` **error**
- [ ] one graph in the file. *`attractor/multiple-graphs`, `dot/unsupported`*
- [ ] not `strict digraph`. *`attractor/strict-graph`*
- [ ] `//` or `/* */` comments only. *`attractor/hash-comment`*
- [ ] attributes comma-separated. *`attractor/attr-separator`*
- [ ] node ids match `[A-Za-z_][A-Za-z0-9_]*`, unquoted, not a statement keyword.
      *`attractor/bad-node-id`, `attractor/quoted-node-id`*
- [ ] no node named `start`, `Start`, `exit` or `end`. **No diagnostic**: the exporter renames
      such a node and records the original in `dp_node`, so the compiled file stops saying
      what the topology says. Check by eye
- [ ] **no `type=` on any node.** *`attractor/reserved-attribute`*, and it is the only reserved
      node attribute the linter reports
- [ ] no other reserved Attractor node attribute either (`prompt`, `max_retries`, `llm_model`,
      `label`, `shape`, `class`, `timeout`, `goal_gate`, `fidelity`, `thread_id`,
      `retry_target`, `fallback_retry_target`, `llm_provider`, `reasoning_effort`,
      `auto_status`, `allow_partial`). **No diagnostic**: each is written straight into the
      compiled file and configures the run silently. Grep for them yourself
- [ ] no node declared twice with different attributes. *`dot/duplicate-node`*
- [ ] no self-loops. *`dot/self-loop`*

## 2. Every node finds its card

- [ ] every node carries `card="<id>@<MAJOR.MINOR.PATCH>"`. `bundle/unpinned-card` **error**
- [ ] every pin names a card file the bundle actually carries. `bundle/missing-card` **error**
- [ ] every card file is instantiated by some node. *`bundle/orphan-card`*
- [ ] no two card files declare the same `id@version` with different content.
      `bundle/digest-mismatch` **error**
- [ ] a card reused from the registry is byte for byte the file the registry serves for that
      `id@version`. Same check, same error, on publish
- [ ] exactly one `.dot`; `blueprint.yaml` at the root is the manifest; no card named
      `blueprint.yaml` or `extensions.yaml`

## 3. Every card validates

- [ ] YAML parses. `card/parse-error` **error**. The one that bites in practice: a plain
      scalar containing `": "` is read as a nested mapping. `description: Where it failed: the
      line and the text` fails with *"nested mappings are not allowed in compact mappings"*.
      **Quote any value containing a colon-space**, or write it as a `>-` folded block
- [ ] `id` matches `^(?:ns/)?[a-z0-9]+(-[a-z0-9]+)*$`. `card/bad-id` **error**
- [ ] `name`, `action`, `spec` present and non-blank; `inputs` and `outputs` **present**, even
      when empty. `card/missing-field` **error**
- [ ] `version` is full semver. `card/bad-version` **error**
- [ ] `type` is one concrete `node-type`, never `human-in-the-loop`, `evaluative` or
      `orchestration`. `card/unknown-term`, `card/wrong-term-kind` **error**
- [ ] every node where a person acts carries a `type` subsumed by `human-in-the-loop`, and
      no node where nobody acts does. `type` is the only field that says it. Writing a
      `requires_human` key is `card/retired-field`, a **warning**, and it is ignored
- [ ] every `shell-tool` carries a non-blank `params.tool_command`. Missing is
      *`card/missing-field`*, blank is *`card/bad-type`*, and either way the node fails on its
      first execution
- [ ] every `phase` entry is one of the five, never namespaced, never repeated.
      `card/unknown-phase`, `card/namespaced-phase` **error**, *`card/duplicate-phase`*
- [ ] every `tools` entry is a `tool` term; every `risk_markers` entry is a `risk-marker` term
- [ ] port names unique within their side. `card/duplicate-port` **error**
- [ ] `required:` only on inputs
- [ ] every `spec` over 40 characters, and written as an instruction rather than a label.
      *`card/spec-too-thin`*
- [ ] the card names no vocabulary version. There is one vocabulary and every card is read
      against it, so writing an `ontology_version` key is `card/retired-field`, a
      **warning**, and it is ignored
- [ ] no key outside the accepted set (`references/card-schema.md`). A typo is an `info` and
      is **silently ignored**, so check the spelling of `risk_markers` and `will_not` by eye

## 4. Every edge carries something

- [ ] no edge out of a node whose `outputs` is `[]`, and no edge into a node whose `inputs` is
      `[]`. `bundle/port-mismatch` **error**, *"carries no data"*
- [ ] every `out=` / `in=` pin names a port the card actually declares.
      `bundle/port-mismatch` **error**
- [ ] every edge has at least one compatible pair. Source narrower than target, or equal, or
      either side `any`. `bundle/type-mismatch` **error**
- [ ] every edge where more than one pair would fit is **pinned**. *`bundle/port-ambiguous`*,
      and an unpinned ambiguous edge means the prohibition check is reasoning about the
      resolver's declaration-order guess rather than about your intent

## 5. Every fork is guarded

- [ ] every node with two or more outgoing edges has a `condition` on every arm, or a
      `weight` the author chose on purpose. **No diagnostic**: an unguarded fork is legal
      and the runner decides it by the spelling of the target ids, so a loop whose fix arm
      sorts before its ship arm never ships. Read `references/dot-and-attractor.md`, Part 2
- [ ] every `condition` uses only the keys `outcome`, `preferred_label` or `context.<path>`,
      the operators `=` and `!=`, and `&&` between clauses. *`attractor/condition-syntax`*
      here, and an error to the runner, which refuses the whole pipeline over it
- [ ] no `condition=""`. It is no condition at all, and the edge falls back to the order
      above without anything saying so
- [ ] the check's success arm is `outcome=success` and its other arm is `outcome!=success`,
      so a verdict that is neither lands on the arm that does not ship

## 6. The prohibitions

- [ ] every `cannot` entry names a `data-type` term id. A sentence here is
      `card/unknown-term` **error** and the card does not load
- [ ] every `will_not` entry is a sentence. A `data-type` here is
      *`card/prohibition-misfiled`*, and it means a rule the resolver could have enforced
      is sitting where nothing reads it
- [ ] no edge carries into a node a type its `cannot` refuses. `bundle/prohibition-violated`
      **error**. Two directions to keep straight:
      - **subsumption**: `cannot: [structured]` refuses an incoming `acceptance-criteria`;
        `cannot: [acceptance-criteria]` does **not** refuse an incoming `structured`;
      - **the carrier**: with no `out=` pin, the carriers are *every output of the source
        card*, so the edge is refused if any of them is prohibited. With an `out=` pin, only
        that one port counts, so a pinned edge can slip past a prohibition the unpinned one
        would have tripped. It still gets charged by the analyzer, which reads the graph at
        node level; `cannot` is the tripwire, not the whole guard
- [ ] no output typed `any` upstream of a node with a narrower prohibition. `any` never
      violates anything and the whole mechanism goes inert

## 7. Dependencies

- [ ] every `dependencies` entry has a matching incoming edge. `bundle/missing-dependency`
      **error**
- [ ] every incoming edge is listed in the target card's `dependencies`.
      *`bundle/undeclared-dependency`*
- [ ] entries name the supplier's **card id** or its **DOT node id**; either satisfies the check

## 8. Structure

- [ ] at least one node with no incoming edge. *`bundle/no-entry`*
- [ ] at least one node with no outgoing edge, and it declares `outputs: []`. *`bundle/no-exit`*
- [ ] every node reachable from a source. *`bundle/unreachable-node`*
- [ ] the graph is not empty. *`analysis/empty-graph`*

## 9. The checks that decide the security level

- [ ] **at least one node typed `validation`.** Without it the generator set is empty and the
      criteria check does not run. *`analysis/criteria-leak-unanchored`* when a producer
      exists, silence when neither leg does, and a 4 is silence either way
- [ ] **at least one output port typed `acceptance-criteria`.** Without it the producer set is
      empty, same outcome
- [ ] **no edge from the criteria producer into any node whose work is judged, whatever port
      that edge carries.** The topological walk reads the graph at node level. A brief that
      needs to reach the builder arrives with the run, not over an edge
- [ ] the criteria producer does not also emit the artefact the judge reads. One node writing
      both is charged off the declarations alone
- [ ] every generator's `spec` shares under 0.35 3-gram Jaccard with the producer's, names no
      criterion and quotes no threshold. *`analysis/criteria-leak-suspected`*
- [ ] no `params` key matching `/criteri/i` naming something nothing in the graph produces.
      *`analysis/criteria-out-of-band`*
- [ ] every cycle has `max_retries` as a **top-level** key of `params` on one member, holding
      a non-negative integer that counts the attempts **after** the first. `max_iterations`
      and `maxIterations` are accepted aliases for the same number. Nested, it is not read,
      and the cycle takes `unbounded-loop` on every member
- [ ] every node with `web-search`, `http-fetch`, `sql` or `ci` in `tools` either has no
      successors or hands to `validation` nodes only. Otherwise
      `unvalidated-external-access` is inferred, −1.0, whether or not it is declared
- [ ] you have **not** inserted a validation node purely to silence a marker

## 10. The manifest

- [ ] `blueprint.yaml` carries `slug`, `title`, `summary`, `description`, `category` and
      `tags`, and `slug` is the folder name and the name the author creates at `/new`
- [ ] `summary` is one sentence, because it becomes the compiled pipeline's `goal`

## 11. Predict the validator

Write out, for the author, the warnings you expect and why each is intended. The common
honest ones:

| warning | when it is fine |
|---|---|
| `analysis/criteria-relayed-through-judge` | the fixer sits downstream of the judge that holds the criteria. The engine cannot tell `judge → fixer → judge` from `judge → builder → judge` and declines to decide. Charges nothing |
| `bundle/undeclared-dependency` | never fine. Fix it |
| `bundle/no-entry` / `bundle/no-exit` | never fine in a first emit. A blueprint with no source and no sink is a loop with no way in |
| `bundle/port-ambiguous` | never fine. Pin the edge |
| `attractor/condition-syntax` | never fine. The runner refuses the whole pipeline over it |

And name the two figures the author will read. The autonomy class is read twice off `type`
and the weaker reading is the one that lands in a band: the share of all nodes not subsumed
by `human-in-the-loop`, and the same share taken over the **control points** only (the nodes
under `evaluative` or `orchestration`, plus `human-gate`), which decides a band only from two
control points up. A graph with one `human-gate` among its two control points reads 0.5 on
the second axis and lands a band lower than the first axis alone would say. The bands are in
`references/ontology.md`. The security level is 4 minus the sum of the distinct markers,
each charged once.

## 12. Re-emitting

If this is a second pass over a bundle that already exists:

- [ ] a card whose content changed has a **new version**, and the old file is **deleted**, not
      left beside it. `bundle/digest-mismatch` **error**, *`bundle/orphan-card`*
- [ ] the bump is large enough. `card/version-bump-too-small` **error**. The full table is in
      `references/card-schema.md`; the rows that bite in a second pass are these. **Major**:
      a port removed, renamed or retyped, an input made required or a required input added,
      `type` or `id` changed, a `cannot` entry added, a `will_not` entry withdrawn. **Minor**:
      `spec`, `model` or `skill` changed, an optional port added, a tool, MCP server, param
      key, risk marker or dependency added, a phase added or dropped, a `cannot` withdrawn, a
      `will_not` stated. **Patch**: wording, a param's value, a reorder, anything withdrawn
      from `tools`, `mcp`, `risk_markers`, `dependencies` or `params`
- [ ] every DOT pin updated to the new version
