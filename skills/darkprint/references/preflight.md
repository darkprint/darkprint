# Pre-flight

You cannot run the engine. It lives in the DarkPrint repository, not on this machine, so
nothing here is executed — this is a checklist you walk your own output against before you
tell the author the bundle is finished.

Work down it in order. Anything marked **error** means the bundle will not load, and you fix
it. Anything marked *warning* the author will see on `/upload`, so **predict it out loud**
before they do: an author surprised by the upload screen has been failed by the interview.

---

## 1. The DOT parses

- [ ] `digraph`, not `graph`. Every edge `->`, never `--`. — `dot/not-directed` **error**
- [ ] one graph in the file — *`attractor/multiple-graphs`, `dot/unsupported`*
- [ ] not `strict digraph` — *`attractor/strict-graph`*
- [ ] `//` or `/* */` comments only — *`attractor/hash-comment`*
- [ ] attributes comma-separated — *`attractor/attr-separator`*
- [ ] node ids match `[A-Za-z_][A-Za-z0-9_]*`, unquoted, not a statement keyword, not
      `start`/`Start`/`exit`/`end` — *`attractor/bad-node-id`, `attractor/quoted-node-id`*
- [ ] **no `type=` on any node**, and no other reserved Attractor node attribute —
      *`attractor/reserved-attribute`*
- [ ] no node declared twice with different attributes — *`dot/duplicate-node`*
- [ ] no self-loops — *`dot/self-loop`*

## 2. Every node finds its card

- [ ] every node carries `card="<id>@<MAJOR.MINOR.PATCH>"` — `bundle/unpinned-card` **error**
- [ ] every pin names a card file the bundle actually carries — `bundle/missing-card` **error**
- [ ] every card file is instantiated by some node — *`bundle/orphan-card`*
- [ ] no two card files declare the same `id@version` with different content —
      `bundle/digest-mismatch` **error**
- [ ] exactly one `.dot`; no card named `blueprint.yaml` or `extensions.yaml`

## 3. Every card validates

- [ ] YAML parses — `card/parse-error` **error**. The one that bites in practice: a plain
      scalar containing `": "` is read as a nested mapping. `description: Where it failed: the
      line and the text` fails with *"nested mappings are not allowed in compact mappings"*.
      **Quote any value containing a colon-space**, or write it as a `>-` folded block
- [ ] `id` matches `^(?:ns/)?[a-z0-9]+(-[a-z0-9]+)*$` — `card/bad-id` **error**
- [ ] `name`, `action`, `spec` present and non-blank; `inputs` and `outputs` **present**, even
      when empty — `card/missing-field` **error**
- [ ] `version` is full semver — `card/bad-version` **error**
- [ ] `type` is one concrete `node-type`, never `human-in-the-loop` or `evaluative` —
      `card/unknown-term`, `card/wrong-term-kind` **error**
- [ ] every node where a person acts carries a `type` subsumed by `human-in-the-loop`, and
      no node where nobody acts does. `type` is the only field that says it — writing a
      `requires_human` key is `card/retired-field`, a **warning**, and it is ignored
- [ ] every `phase` entry is one of the five, never namespaced, never repeated —
      `card/unknown-phase`, `card/namespaced-phase` **error**, *`card/duplicate-phase`*
- [ ] every `tools` entry is a `tool` term; every `risk_markers` entry is a `risk-marker` term
- [ ] port names unique within their side — `card/duplicate-port` **error**
- [ ] `required:` only on inputs
- [ ] every `spec` over 40 characters, and written as an instruction rather than a label —
      *`card/spec-too-thin`*
- [ ] the card names no vocabulary version. There is one vocabulary and every card is read
      against it, so writing an `ontology_version` key is `card/retired-field`, a
      **warning**, and it is ignored
- [ ] no key outside the accepted set (`references/card-schema.md`) — a typo is an `info` and
      is **silently ignored**, so check the spelling of `risk_markers` and `will_not` by eye

## 4. Every edge carries something

- [ ] no edge out of a node whose `outputs` is `[]`, and no edge into a node whose `inputs` is
      `[]` — `bundle/port-mismatch` **error**, *"carries no data"*
- [ ] every `out=` / `in=` pin names a port the card actually declares —
      `bundle/port-mismatch` **error**
- [ ] every edge has at least one compatible pair. Source narrower than target, or equal, or
      either side `any` — `bundle/type-mismatch` **error**
- [ ] every edge where more than one pair would fit is **pinned** — *`bundle/port-ambiguous`*,
      and an unpinned ambiguous edge means the prohibition check is reasoning about the
      resolver's declaration-order guess rather than about your intent

## 5. The prohibitions

- [ ] every `cannot` entry names a `data-type` term id. A sentence here is
      `card/unknown-term` **error** and the card does not load
- [ ] every `will_not` entry is a sentence. A `data-type` here is
      *`card/prohibition-misfiled`*, and it means a rule the resolver could have enforced
      is sitting where nothing reads it
- [ ] no edge carries into a node a type its `cannot` refuses — `bundle/prohibition-violated`
      **error**. Two directions to keep straight:
      - **subsumption** — `cannot: [structured]` refuses an incoming `acceptance-criteria`;
        `cannot: [acceptance-criteria]` does **not** refuse an incoming `structured`;
      - **the carrier** — with no `out=` pin, the carriers are *every output of the source
        card*, so the edge is refused if any of them is prohibited. With an `out=` pin, only
        that one port counts, so a pinned edge can slip past a prohibition the unpinned one
        would have tripped. It still gets charged by the analyzer, which reads the graph at
        node level; `cannot` is the tripwire, not the whole guard
- [ ] no output typed `any` upstream of a node with a narrower prohibition — `any` never
      violates anything and the whole mechanism goes inert

## 6. Dependencies

- [ ] every `dependencies` entry has a matching incoming edge — `bundle/missing-dependency`
      **error**
- [ ] every incoming edge is listed in the target card's `dependencies` —
      *`bundle/undeclared-dependency`*
- [ ] entries name the supplier's **card id** or its **DOT node id**; either satisfies the check

## 7. Structure

- [ ] at least one node with no incoming edge — *`bundle/no-entry`*
- [ ] at least one node with no outgoing edge, and it declares `outputs: []` — *`bundle/no-exit`*
- [ ] every node reachable from a source — *`bundle/unreachable-node`*
- [ ] the graph is not empty — *`analysis/empty-graph`*

## 8. The checks that decide the security level

- [ ] **at least one node typed `validation`.** Without it the generator set is empty and the
      criteria check does not run — *`analysis/criteria-leak-unanchored`*, and a 4 is silence
- [ ] **at least one output port typed `acceptance-criteria`.** Without it the producer set is
      empty, same outcome
- [ ] **no edge from the criteria producer into any node whose work is judged, whatever port
      that edge carries.** The topological walk reads the graph at node level. A brief that
      needs to reach the builder arrives with the run, not over an edge
- [ ] the criteria producer does not also emit the artefact the judge reads. One node writing
      both is charged off the declarations alone
- [ ] every generator's `spec` shares under 0.35 3-gram Jaccard with the producer's, names no
      criterion and quotes no threshold — *`analysis/criteria-leak-suspected`*
- [ ] no `params` key matching `/criteri/i` naming something nothing in the graph produces —
      *`analysis/criteria-out-of-band`*
- [ ] every cycle has `max_iterations` (or `maxIterations`, or `max_retries`) as a **top-level**
      key of `params` on one member, holding a non-negative integer. Nested, it is not read
- [ ] every node with `web-search`, `http-fetch`, `sql` or `ci` in `tools` either has no
      successors or hands to `validation` nodes only — otherwise
      `unvalidated-external-access` is inferred, −1.0, whether or not it is declared
- [ ] you have **not** inserted a validation node purely to silence a marker

## 9. Predict the upload

Write out, for the author, the warnings you expect and why each is intended. The common
honest ones:

| warning | when it is fine |
|---|---|
| `analysis/criteria-relayed-through-judge` | the fixer sits downstream of the judge that holds the criteria. The engine cannot tell `judge → fixer → judge` from `judge → builder → judge` and declines to decide. Charges nothing |
| `bundle/undeclared-dependency` | never fine. Fix it |
| `bundle/no-entry` / `bundle/no-exit` | never fine in a first emit. A blueprint with no source and no sink is a loop with no way in |
| `bundle/port-ambiguous` | never fine. Pin the edge |

And name the two figures the author will read: the autonomy level (the share of nodes not
subsumed by `human-in-the-loop`, banded > 0.9 / ≥ 0.7 / ≥ 0.5) and the security level
(4 minus the sum of the distinct markers, each charged once).

## 10. Re-emitting

If this is a second pass over a bundle that already exists:

- [ ] a card whose content changed has a **new version**, and the old file is **deleted**, not
      left beside it — `bundle/digest-mismatch` **error**, *`bundle/orphan-card`*
- [ ] the bump is large enough: a changed `spec` prices as **minor**; a changed port, `type` or
      `param` prices as **major** — `card/version-bump-too-small` **error**
- [ ] every DOT pin updated to the new version
