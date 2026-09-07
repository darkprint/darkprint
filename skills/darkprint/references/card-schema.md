<!--
  GENERATED FILE. Do not edit by hand.
  Rendered from lib/core/card/schema.ts and lib/core/card/validate.ts by scripts/skill-refs.ts.
  Regenerate with: npm run generate:skill-refs
  scripts/generate-skill-refs.test.ts fails the suite if this file drifts.
-->

# The node card, on the wire

A card is one YAML or JSON document describing one node. The wire format is
**snake_case** (`risk_markers`, `will_not`), and the validator maps it onto the
camelCase model quoted at the bottom of this file.

## Every key the validator accepts

Exactly this set, and nothing else. An unrecognised key is reported as `info` and
**ignored**, so a typo does not fail the card; it silently does nothing.

- `action`
- `agent`
- `author`
- `cannot`
- `dependencies`
- `id`
- `inputs`
- `mcp`
- `model`
- `name`
- `notes`
- `outputs`
- `params`
- `phase`
- `phases`
- `provenance`
- `riskMarkers`
- `risk_markers`
- `skill`
- `spec`
- `tools`
- `type`
- `version`
- `willNot`
- `will_not`

Where two spellings appear (`phase`/`phases`, `will_not`/`willNot`,
`risk_markers`/`riskMarkers`) both load. Writing both on one card is an `info` and the
snake_case one wins. Prefer snake_case: it is what every shipped card is written in.

## Required, and what happens when they are missing

A missing, null, non-string or blank value on any of these is an **error**, and no card
comes back at all.

| key | rule | diagnostic |
| --- | --- | --- |
| `id` | lowercase words joined by single hyphens, at most one namespace segment: `solver`, `me/solver-a` | `card/bad-id` |
| `name` | any non-blank string | `card/missing-field` |
| `type` | exactly one `node-type` term | `card/unknown-term`, `card/wrong-term-kind` |
| `action` | non-blank; short and machine-readable | `card/missing-field` |
| `spec` | non-blank; under 40 trimmed characters is `card/spec-too-thin`, a warning | `card/missing-field` |
| `inputs` | must be **present**; write `[]` explicitly when the node needs nothing | `card/missing-field` |
| `outputs` | must be **present**; `[]` is how a sink is declared | `card/missing-field` |
| `version` | full semver `MAJOR.MINOR.PATCH` | `card/bad-version` |

## A port

| key | rule |
| --- | --- |
| `name` | required, non-blank, **unique within its side** (`card/duplicate-port`, error) |
| `type` | required, one `data-type` term |
| `description` | optional string |
| `required` | optional boolean, **inputs only**; on an output it is an `info` and is dropped. Defaults to true. |

## Optional, and what they default to

| key | default | checked against the ontology? |
| --- | --- | --- |
| `phase` / `phases` | `[]` | yes: the five, never namespaced |
| `tools` | `[]` | yes: `tool` terms |
| `mcp` | `[]` | **no**: free text, installed server names |
| `params` | `{}` | no: any JSON-serialisable mapping, nesting depth under 100 |
| `dependencies` | `[]` | not here: checked against the graph by the resolver |
| `cannot` | `[]` | yes: `data-type` terms, and see below |
| `will_not` | `[]` | **no**: free text, see below |
| `risk_markers` | `[]` | yes: `risk-marker` terms |
| `model`, `agent`, `skill`, `notes`, `author`, `provenance` | absent | no |

## `cannot` and `will_not` are two prohibitions, and only one is checked

Write a prohibition in the field that matches what you want to happen to it.

`cannot` holds **`data-type` term ids and nothing else**. The resolver refuses any
incoming edge whose *carrier* is that type or anything narrower, with
`bundle/prohibition-violated`, an error. That is what turns an absent edge from a
convention somebody remembered into a rule the engine holds the graph to. A sentence
written here is `card/unknown-term`, an error, and the card does not load.

**What counts as the carrier** decides how far the enforcement reaches, so read this
twice. On an edge with no `out=` pin the carriers are **every output of the source card**,
so an edge out of a node that emits the criteria at all is refused. On an edge pinned with
`out=`, the carrier is **that one port**, so pinning the edge to a different port satisfies
the prohibition. The bundle then loads, and the analyzer charges `criteria-leak` anyway,
because its topological walk reads the graph at node level and does not care which port an
edge carries. `cannot` is the fast tripwire that stops the bundle loading; the analyzer is
the backstop that prices it. Neither replaces the other.

`will_not` holds **your own sentences**: "never opens a shell", "does not edit the code
under test". Nothing checks them, because no engine can decide a sentence against a
topology. They are addressed to whoever reads the card and to the agent instantiated from
it, which is a real audience and not a lesser one. Putting a `data-type` here is
`card/prohibition-misfiled`, a **warning**: the card loads, the entry is shown, and
nothing enforces it.

Two asymmetries that decide what to put in `cannot`:

- Subsumption runs one way. `cannot: [structured]` refuses an incoming
  `acceptance-criteria`, because that is narrower. `cannot: [acceptance-criteria]` does
  **not** refuse an incoming `structured`.
- An output typed `any` never violates a narrower prohibition. Lazy typing makes the
  whole mechanism unenforceable.

## Who acts at the node

`type`, and nothing else. A `type` subsumed by `human-in-the-loop` (`human-gate`,
`human-input`, or `human-in-the-loop` itself, since subsumption is reflexive) is a node
where a person acts, and every other type is a node that runs unattended. The autonomy
reading, the schematic and the card page all ask that one question of that one field.

There used to be a `requires_human` boolean beside it. A card could set it to `false` on
a `human-gate`, or to `true` on a `tool`, and nothing refused the document. Writing it
today is `card/retired-field`, a **warning**: the card still loads, the key is ignored,
and the diagnostic says what the card's own `type` answers instead.

## Which vocabulary a card is read against

The one this build ships. A card used to declare `ontology_version`, and the engine read
it against the vocabulary that string named, but a release stores its whole scorecard at
publish time, so no score is ever recomputed against an older vocabulary and nothing ever
asked for the older one. Terms are added and retired inside the one vocabulary with
`deprecated: {since, replacedBy}`, which is what a card naming a renamed term follows.
Writing `ontology_version:` today is `card/retired-field`, a **warning**, on the same
terms as `requires_human`.

## Re-emitting a card

A published version is never edited in place. Rewriting a card's content while leaving
the old file beside it is `bundle/digest-mismatch` (error). A card version nothing
instantiates is `bundle/orphan-card` (warning): delete the superseded file rather than
keep it for history.

Bumping too small for what changed is `card/version-bump-too-small` (error). The engine
infers the smallest bump the edit needs, from `lib/core/version/bump.ts`, and the
declared version has to be at least that. The strongest reason wins when an edit touches
several rows.

| bump | forced by |
| --- | --- |
| **major** | a port removed or renamed |
| **major** | a port's `type` changed |
| **major** | an existing input made required |
| **major** | a required input added |
| **major** | `id` changed |
| **major** | `type` changed |
| **major** | a `cannot` entry added |
| **major** | a `will_not` entry withdrawn |
| **minor** | `spec` changed |
| **minor** | `skill` set, repointed or dropped |
| **minor** | `model` set, changed or dropped |
| **minor** | an optional input added |
| **minor** | an output added |
| **minor** | a `tools`, `mcp`, `risk_markers` or `dependencies` entry added |
| **minor** | a `params` key added |
| **minor** | a `cannot` entry withdrawn |
| **minor** | a `will_not` entry stated |
| **minor** | a phase added or dropped |
| **patch** | `name`, `action` or `notes` reworded |
| **patch** | a port `description` changed |
| **patch** | `agent` changed |
| **patch** | a `params` value changed, or a `params` key removed |
| **patch** | an input no longer required |
| **patch** | a `tools`, `mcp`, `risk_markers` or `dependencies` entry withdrawn |
| **patch** | a list reordered |

## `lib/core/card/schema.ts`, verbatim

The engine's own model, quoted byte for byte. Read the sentences; the `doc 1 §3.2` style
citations point at design documents that do not ship with this skill and can be ignored.

```ts
/* ============================================================
   DarkPrint core — the node card
   The contract that holds everything else up: identity,
   behaviour, interfaces and evaluation metadata for one node.
   Design doc §3–§4, engine spec §4.

   ── Who reads which of these fields ──
   A card is read twice, by two parties that never meet, and it
   is worth knowing which of them is reading a field before
   deciding what to write in it.

   Some fields are handed to the RUNTIME. When a bundle is
   exported, `attractor/emit.ts` writes them onto the DOT under
   the names Attractor reserves for them, and the runner acts on
   them: `spec` becomes `prompt`, `name` becomes `label`, `model`
   becomes `llm_model`, `params.max_iterations` becomes
   `max_retries`, `params.tool_command` becomes the node attribute
   of the same name, and `type` and `phases` become the node's
   `class` (prefixed `dp-`), which a `model_stylesheet` selects
   on. Write those fields for a machine that will execute them.

   Everything else is read by DARKPRINT, and by whoever opens the
   card. `cannot`, `will_not`, `risk_markers`, `inputs`,
   `outputs`, `dependencies`, `notes`, `tools`, `mcp` and `skill`
   are scored, indexed, drawn and shown; no Attractor runner sees
   any of them. The one thing that crosses back is the card's
   identity, which travels as `card="id@version"` on the node.
   Attractor does not reserve that name, so it ignores it, and
   that is the entire reason a DarkPrint bundle runs unchanged.

   The line between the two is a property of the NAME a value is
   written under, never of the intention behind it: a DarkPrint
   field emitted under a reserved Attractor name would not be
   ignored, it would configure a run. `attractor/emit.ts` declares
   both halves as lists and its tests hold the emitter to them, so
   nothing crosses that line by accident. Nothing here asks a card
   author to check anything; it asks them to know that `type` and
   `spec` are instructions somebody's machine will follow, and
   that `will_not` is a promise addressed to a person.
   ============================================================ */

/** Any value that survives a JSON round-trip — what `params` is allowed to hold. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** A declared input or output port. */
export interface Port {
  name: string;
  /** `data-type` term id from the ontology. */
  type: string;
  description?: string;
  /** Inputs only. Defaults to true. */
  required?: boolean;
}

/**
 * One node, fully described. The wire format (YAML/JSON on disk) is snake_case —
 * `risk_markers`, `will_not` — and `validate.ts` maps it onto this camelCase model.
 */
export interface NodeCard {
  /* 3.1 identity */
  /** Unique id, optionally namespaced ("berti/solver-a"). Ties the card to its DOT node. */
  id: string;
  name: string;
  /**
   * `node-type` term id. Doc 3 §1: exactly one.
   *
   * It is also the whole of the card's answer to whether a person acts at this node. A
   * type subsumed by doc 3 §3's `human-in-the-loop` category is staffed and nothing else
   * is, and `ontology/resolve.ts`'s `requiresHuman` is where that is read. There used to
   * be a `requires_human` boolean here as well, so a card could say `type: human-gate`
   * and `requires_human: false` in the same document: the archive loaded it, the
   * schematic drew a person on the node, and the autonomy reading counted it unattended.
   * Nothing in the system compared the two, and a field that can contradict the field
   * beside it is not a second opinion, it is a second source of truth.
   *
   * It is also the field the exporter reads twice: once for the node's `shape`, which is
   * how Attractor picks the handler that runs the node, and once for its `class`, where
   * the type and every category above it are written out as `dp-agent`, `dp-human-gate`,
   * `dp-orchestration` and so on. A `model_stylesheet` selects on class, so the second
   * one is what lets whoever runs the bundle say "every agent on this machine runs on the
   * cheap model" without editing a single card.
   */
  type: string;
  /**
   * `phase` term ids: any number of doc 3 §2's five, never namespaced (doc 3 §7 keeps the
   * phases closed).
   *
   * Optional and repeatable, which reverses doc 3 §1's cardinality row on the author's
   * ruling: the five phases are *"the expected high level phases a dark factory should
   * have, but do not necessarily have to stick to nodes"*. They describe the **factory**,
   * not every node in it. An intake, a retrieval step or a memory store sits in none of
   * the five, and `phases: []` is its complete and correct answer — not a hole to be
   * filled. A node that genuinely spans two, such as a synthesiser that both builds and
   * repairs, declares both.
   *
   * Nothing downstream may render an empty list as a defect: it feeds phase coverage,
   * which doc 2 §1.1 and doc 3 §2 make descriptive rather than a score.
   *
   * Each declared phase is also written onto the exported node as a `dp-planning`,
   * `dp-testing` class beside the type's, so a stylesheet can route by lifecycle stage as
   * well as by what the node is. A card that declares none carries no phase class, which
   * is the same answer `phases: []` gives everywhere else.
   *
   * The wire key stays the singular `phase` and accepts a scalar or a sequence, because
   * both spellings read naturally in YAML; `validate.ts` normalises them onto this field.
   */
  phases: string[];

  /* 3.2 behaviour */
  /** The operation the node performs, short and machine-readable. Doc 1 §3.2. */
  action: string;
  /**
   * The natural-language specification handed to the agent. Doc 1 §0.1.2 and §3.2: this is
   * the payload delivered to Claude Code, or an equivalent agent, when the graph is
   * instantiated, so it must be self-sufficient — the agent reading it does not see the
   * rest of the graph. It must also respect the graph's isolation rules: information a
   * node is not meant to have does not appear here either, because an absent edge with the
   * criteria written into the prose is a false isolation.
   */
  spec: string;
  /**
   * Which model the agent is instantiated with, written the way the provider writes the
   * identifier: `claude-opus-5`, `claude-haiku-4-5`.
   *
   * **A default rather than a binding**, and that is the whole of its contract. Engine
   * spec §2.6 reserves `llm_model` as "LLM model identifier. Overridable by stylesheet",
   * and §8 gives the graph a `model_stylesheet` whose rules set the model for every node
   * matching a shape, a class or an id.
   *
   * **An explicit node attribute outranks the sheet**, and the spec says so twice. §8.5
   * gives the resolution order and puts the explicit node attribute first, above the
   * matching stylesheet rule, above the graph-level default, above the handler default,
   * and it gives the mechanism in the same section: the stylesheet is a transform that
   * "only sets properties that the node does not already have explicitly". §8.3 states the
   * same rule from the selector side, "Explicit node attributes always override stylesheet
   * values (highest precedence)", and its specificity table ranks the sheet's own rules
   * against each other rather than against the node. So `attractor/emit.ts` writing this
   * field onto the node is what makes the downloaded bundle run on the named model until
   * whoever runs it says otherwise, and a sheet the recipient adds cannot take it back.
   *
   * §2.6 is cited above for the NAME and never for the ranking. Its whole gloss is
   * "Overridable by stylesheet", which says the sheet can reach a node and says nothing
   * about what happens when both speak; reading it as a ranking is how four surfaces on
   * this site came to print the reverse, and `components/spec/rows.test.ts` holds those
   * four to §8.5 now. This docblock is the fifth carrier of the same claim, and
   * `schema.test.ts` holds it to the same thing.
   *
   * Absent on most cards, and absence is an answer rather than a hole: the node takes
   * whatever the graph or the runner supplies. Nothing that renders a card may draw the
   * empty case as missing data.
   *
   * `version/bump.ts` prices a change here as minor for the same reason the field is a
   * default: it moves what the node does without moving any port, type or param a
   * blueprint declared against, and the operator can override it either way.
   */
  model?: string;
  agent?: string;
  /** `tool` term ids; `[]` when the node needs none. */
  tools: string[];
  /**
   * The MCP servers this node needs, under the names they are registered with on the
   * machine that runs the graph, such as `filesystem` or `github`.
   *
   * Free text by design: an MCP server is a concrete process somebody installed, and the
   * vocabulary has no term for one. That is what keeps this field apart from `tools`,
   * which holds `tool` capability terms. `tools` says what the node is permitted to do
   * and `mcp` says which server supplies it, a node can carry either without the other,
   * and merging the two would lose the question each of them answers.
   *
   * `[]` when the node needs none, which is the ordinary case.
   */
  mcp: string[];
  /**
   * Where the skill document defining this agent's behaviour lives, as a path inside the
   * bundle or the repository that carries it, such as `skills/planner.md`.
   *
   * A pointer, and nothing in the engine reads what it points at. Doc 2 §3 puts a skill
   * one level below the graph: a skill hands one agent a capability, while the blueprint
   * decides who is wired to whom. Absent on a node whose `spec` is the whole of its
   * instruction, and absence carries no judgement.
   */
  skill?: string;
  /**
   * Nested configuration for the node, free-form but JSON-serializable.
   *
   * Free-form is not the same as unread. Two top-level keys are interpreted, and an author
   * who does not know which they are is one edit away from moving a published score or a
   * runnable bundle without meaning to:
   *
   * `max_iterations`, also spelled `maxIterations` or `max_retries`, is the iteration cap.
   * `card/iteration-cap.ts` is its one reader and two callers ask it the same question:
   * `analysis/security.ts` charges doc 3 §4.1's `unbounded-loop` against a cycle no node
   * of which declares a cap, and `attractor/emit.ts` writes the value onto the exported
   * node as Attractor's reserved `max_retries`. One key, a security score and a runnable
   * DOT.
   *
   * `tool_command` is the shell command a `shell-tool` node runs, and it is the whole of
   * that node's instruction. Engine spec §4.10's tool handler reads a node attribute of
   * that name and FAILs the node outright when it is empty ("No tool_command specified"),
   * so a `shell-tool` card that omits it describes a node that cannot run: `validate.ts`
   * says so at warning severity. Carrying it onto the exported node under Attractor's own
   * name is `attractor/emit.ts`'s half.
   *
   * It sits in `params` rather than as a top-level card field on the owner's call. `params`
   * already carries runner configuration and a command is more of that, so a shell-tool
   * node costs the wire format no new key and every card written before the term still
   * parses.
   *
   * Every other key travels with the card to whoever runs the graph and is read by nothing
   * here, which is what the field is for. A third interpreted key belongs in this list on
   * the day it is added.
   */
  params: Record<string, JsonValue>;

  /* 3.3 interfaces */
  inputs: Port[];
  outputs: Port[];
  /** Ids of other cards this one receives data from. */
  dependencies: string[];
  /**
   * What this node must never RECEIVE, as ontology `data-type` term ids the engine
   * enforces. The negative half of the interface: `inputs` and `dependencies` say what
   * arrives, and this says what may not.
   *
   * `bundle/resolve.ts` holds the graph to every entry: an incoming edge able to carry
   * the type, meaning the type itself or a narrower kind of it, raises
   * `bundle/prohibition-violated` at error severity, naming the card, the edge and the
   * type. That is what turns doc 2 §3's isolation argument from prose into something the
   * engine enforces. `code-builder` declaring `cannot: [acceptance-criteria]` makes the
   * starter's absent edge a rule the analyzer checks, in place of a convention the author
   * happened to remember.
   *
   * A `data-type` is the only thing this field takes, because a data type is the only
   * thing an edge carries and therefore the only thing the resolver can refuse. An entry
   * naming a `phase`, a `node-type`, a `tool` or nothing at all is a `card/unknown-term`
   * or a `card/wrong-term-kind` here, and belongs in `willNot` instead.
   *
   * `[]` when the node declares no enforced prohibition, which is the ordinary case.
   */
  cannot: string[];
  /**
   * What this node undertakes never to do, in the author's own sentences. The prohibitions
   * that are real and that no engine can check: "never opens a shell", "does not edit the
   * code under test", "cannot recommend an outcome".
   *
   * ── Why this is a field of its own, and why it is named this ──
   * These two lists were one list until the split. That list carried two different
   * promises under one key, and the only way to tell them apart was to resolve each entry
   * against the vocabulary yourself — so a page that showed the list either lied by
   * omission or grew a count (`enforcedCount`) to apologise for the conflation. A reader
   * has to be able to tell which promise they are being given without running anything,
   * and two keys is the only way to say it in the file itself.
   *
   * `will_not` rather than `unenforced`, `advisory`, `notes` or `soft_cannot`. Those words
   * grade the promise, and this half is not the lesser half: a node that undertakes not to
   * push to a repository is making the more consequential statement of the two on most
   * cards in the archive. The English already draws the line the engine draws. `cannot` is
   * an incapacity somebody else imposes and holds you to. `will not` is an undertaking you
   * give, in your own words, and stand behind. The difference between them is exactly the
   * difference between a rule `bundle/resolve.ts` checks and a rule it has no way to see,
   * and it survives being read aloud by somebody who has never opened this file.
   *
   * Nothing in the engine checks an entry here, and nothing may report one as a defect for
   * that reason. It is addressed to whoever reads the card and to the agent instantiated
   * from it, which is a real audience: on `maintainer-approval` the entries here are
   * restated in the `spec` the agent actually executes.
   *
   * An entry that names a `data-type` term is a `card/prohibition-misfiled` warning, since
   * the author has written something the engine could have enforced into the field where
   * it never will be. The card still loads and the entry is still shown, because what it
   * says is what this field says.
   *
   * `[]` when the node states no undertaking.
   */
  willNot: string[];

  /* 3.4 evaluation metadata */
  /** `risk-marker` term ids. */
  riskMarkers: string[];
  notes?: string;

  /* 3.5 service fields */
  /**
   * Semver of the card itself. §4: a published version is never edited in place.
   *
   * The only version anywhere in DarkPrint that names a contract. There used to be an
   * `ontology_version` here too, naming the vocabulary the author wrote the card against,
   * and the engine resolved that string to a stored vocabulary before reading the card.
   * Nothing consumed the resolution, and the field asked every author to maintain an
   * answer no reader had a question for. The vocabulary has since stopped carrying a
   * version at all: it names what an Attractor node is, and Attractor's shapes are fixed
   * by its spec. `deprecated: {since, replacedBy}` is what lets the one living vocabulary add and
   * retire terms without any of that.
   *
   * This one stays, and it is not the same kind of thing: it pins a node to an exact card,
   * it travels to Attractor as `card="id@version"`, and §4 makes a published version
   * immutable so the pin means something.
   */
  version: string;
  author?: string;
  provenance?: string;
}

/**
 * The `params` key that carries a `shell-tool` node's command (engine spec §4.10).
 *
 * Two modules ask the same question of it. `card/validate.ts` warns when a `shell-tool`
 * card leaves it empty, and `attractor/emit.ts` writes the value onto the exported node
 * under Attractor's own `tool_command`. They have to spell it the same way and agree on
 * what counts as empty, or a card is told it is complete and exports without a command, or
 * told it is incomplete and exports with one. That is the accident `card/iteration-cap.ts`
 * was extracted to end over the same bag, with three keys instead of one.
 *
 * Named here because this file owns the wire vocabulary, so there is one spelling to import
 * rather than two literals to keep level.
 */
export const TOOL_COMMAND_KEY = "tool_command";

/** "id@version" — how a DOT node pins the exact card it instantiates. */
export type CardRef = string;

/**
 * Mirrors the §5 `card/bad-id` rule. Kept private: `validate.ts` owns the
 * user-facing diagnostic, this file only needs it to reject malformed refs.
 */
const CARD_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Loose version shape: starts with a digit, then semver-ish characters. Full semver
 * validation belongs to `parseSemver`; refusing "latest" here is what makes §4's
 * "always pin the exact version" checkable at the reference site.
 */
const REF_VERSION = /^[0-9][0-9A-Za-z.+-]*$/;

/** Build the canonical "id@version" reference. Does not validate its arguments. */
export function cardRef(id: string, version: string): CardRef {
  return `${id}@${version}`;
}

/**
 * Split a reference back into its parts, or `undefined` when it is not a pinned
 * reference at all — an unversioned "solver-a", a malformed id, "solver-a@latest".
 * Surrounding whitespace is tolerated because refs arrive from hand-written DOT
 * attributes; anything else is rejected rather than repaired.
 */
export function parseCardRef(ref: string): { id: string; version: string } | undefined {
  const trimmed = ref.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return undefined;
  const id = trimmed.slice(0, at);
  const version = trimmed.slice(at + 1);
  if (!CARD_ID.test(id) || !REF_VERSION.test(version)) return undefined;
  return { id, version };
}
```
