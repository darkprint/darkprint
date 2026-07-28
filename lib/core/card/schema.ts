/* ============================================================
   DarkPrint core — the node card
   The contract that holds everything else up: identity,
   behaviour, interfaces and evaluation metadata for one node.
   Design doc §3–§4, engine spec §4.
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
 * `requires_human`, `risk_markers`, `ontology_version` — and `validate.ts` maps it
 * onto this camelCase model.
 */
export interface NodeCard {
  /* 3.1 identity */
  /** Unique id, optionally namespaced ("berti/solver-a"). Ties the card to its DOT node. */
  id: string;
  name: string;
  /** `node-type` term id. Doc 3 §1: exactly one. */
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
  /** Nested configuration, free-form but JSON-serializable. */
  params: Record<string, JsonValue>;

  /* 3.3 interfaces */
  inputs: Port[];
  outputs: Port[];
  /** Ids of other cards this one receives data from. */
  dependencies: string[];
  /**
   * What this node must never do or receive. The negative half of the interface: `inputs`
   * and `dependencies` say what arrives, and this says what may not.
   *
   * **An entry naming an ontology `data-type` is enforced.** It is a declared prohibition
   * on receiving that type, and `bundle/resolve.ts` holds the graph to it: an incoming
   * edge able to carry the type, meaning the type itself or a narrower kind of it, raises
   * `bundle/prohibition-violated` at error severity, naming the card, the edge and the
   * type. That is what turns doc 2 §3's isolation argument from prose into something the
   * engine enforces. `code-builder` declaring `cannot: [acceptance-criteria]` makes the
   * starter's absent edge a rule the analyzer checks, in place of a convention the author
   * happened to remember.
   *
   * A `data-type` is the only kind of term enforced here, because it is the only kind an
   * edge carries. An entry naming a `phase`, a `node-type` or a `tool` is read as free
   * text.
   *
   * **An entry naming no ontology term is free text.** It is shown to the reader and
   * checked by nothing, because the engine has no way to decide "never opens a shell"
   * against a topology. Writing one is legitimate, and it addresses a reader rather than
   * the resolver.
   *
   * `[]` when the node declares no prohibitions.
   */
  cannot: string[];

  /* 3.4 evaluation metadata */
  requiresHuman: boolean;
  /** `risk-marker` term ids. */
  riskMarkers: string[];
  notes?: string;

  /* 3.5 service fields */
  /** Semver of the card itself. §4: a published version is never edited in place. */
  version: string;
  author?: string;
  provenance?: string;
  /** Semver of the vocabulary the card is written against. */
  ontologyVersion: string;
}

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
