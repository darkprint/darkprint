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
   * `phase` term id: exactly one of doc 3 §2's five, and never namespaced (doc 3 §7 keeps
   * the phases closed). Feeds phase coverage, which is descriptive and not a score.
   */
  phase: string;

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
  /** Nested configuration, free-form but JSON-serializable. */
  params: Record<string, JsonValue>;

  /* 3.3 interfaces */
  inputs: Port[];
  outputs: Port[];
  /** Ids of other cards this one receives data from. */
  dependencies: string[];

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
