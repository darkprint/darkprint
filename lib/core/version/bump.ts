/* ============================================================
   DarkPrint core — inferring the version bump
   Design doc §4: a published card is immutable, so every edit is
   a new version, and the size of the bump has to match the size
   of the change. This works out which bump a diff demands and
   whether the declared one is strong enough. Engine spec §6.
   ============================================================ */

import type { NodeCard, Port } from "../card/schema";
import { canonicalJson } from "../hash/canonical";
import { compareSemver, parseSemver } from "./semver";

/** How large a version bump is. `none` means nothing changed at all. */
export type BumpLevel = "major" | "minor" | "patch" | "none";

export interface BumpAnalysis {
  level: BumpLevel;
  /** Human-readable, e.g. "output `draft` changed type: json → report". Strongest first. */
  reasons: string[];
}

const LEVEL_RANK: Record<BumpLevel, number> = { none: 0, patch: 1, minor: 2, major: 3 };

/** Every reason carries the bump it forces; the analysis takes the strongest. */
interface Reason {
  level: Exclude<BumpLevel, "none">;
  message: string;
}

/** Reasons are shown to users, so long free text is elided rather than dumped. */
const MAX_SHOWN = 40;

/**
 * Fields that play no part in a bump: `version` is the thing being decided, and
 * `author`/`provenance` are excluded from a card's identity anyway (see `cardDigest`).
 */
const NOT_CONTENT: readonly (keyof NodeCard)[] = ["version", "author", "provenance"];

/**
 * `canonicalJson` throws on values with no JSON form. A card that malformed is
 * invalid anyway, and the validator calls this while reporting on user data, so
 * degrade instead of crashing.
 */
function stable(value: unknown): string {
  try {
    return canonicalJson(value);
  } catch {
    try {
      return JSON.stringify(value) ?? "undefined";
    } catch {
      return "[unserializable]";
    }
  }
}

function truncate(text: string): string {
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}…` : text;
}

/** Quoted and elided — for free text like `name`. */
function showText(value: string | undefined): string {
  return value === undefined ? "(none)" : JSON.stringify(truncate(value));
}

/** Elided JSON — for `params` values, which can be any nested shape. */
function showValue(value: unknown): string {
  return truncate(stable(value));
}

/** §4 defaults `required` to true, so an input is optional only when it says so. */
function isRequired(port: Port): boolean {
  return port.required !== false;
}

/** First declaration wins; `card/duplicate-port` is the validator's problem, not ours. */
function portsByName(ports: readonly Port[]): Map<string, Port> {
  const map = new Map<string, Port>();
  for (const port of ports) if (!map.has(port.name)) map.set(port.name, port);
  return map;
}

function comparePorts(
  kind: "input" | "output",
  previous: readonly Port[],
  next: readonly Port[],
  push: (level: Reason["level"], message: string) => void,
): void {
  const before = portsByName(previous);
  const after = portsByName(next);

  // Previous order first, then next order: the reason list reads like the diff.
  for (const [name, port] of before) {
    const updated = after.get(name);
    if (updated === undefined) {
      // A rename shows up here as a removal plus an addition — both breaking.
      push("major", `${kind} \`${name}\` was removed`);
      continue;
    }
    if (updated.type !== port.type) {
      push("major", `${kind} \`${name}\` changed type: ${port.type} → ${updated.type}`);
    }
    if (kind === "input") {
      if (!isRequired(port) && isRequired(updated)) {
        push("major", `input \`${name}\` is now required`);
      } else if (isRequired(port) && !isRequired(updated)) {
        // §4 makes an *added* optional port minor; relaxing an existing one adds
        // nothing to the declared surface, so it falls under "patch otherwise".
        push("patch", `input \`${name}\` is no longer required`);
      }
    }
    if ((port.description ?? "") !== (updated.description ?? "")) {
      push("patch", `${kind} \`${name}\` description changed`);
    }
  }

  for (const [name, port] of after) {
    if (before.has(name)) continue;
    if (kind === "input" && isRequired(port)) {
      // A new required input breaks every graph already wired to this card.
      push("major", `required input \`${name}\` was added`);
    } else if (kind === "input") {
      push("minor", `optional input \`${name}\` was added`);
    } else {
      push("minor", `output \`${name}\` was added`);
    }
  }

  const sameSequence =
    previous.length === next.length && previous.every((p, i) => p.name === next[i].name);
  const sameNames = before.size === after.size && [...before.keys()].every((n) => after.has(n));
  if (!sameSequence && sameNames) {
    push("patch", `${kind} ports were reordered`);
  }
}

/**
 * Added/removed members of a list field. §4 makes *growth* of the declared surface a
 * minor bump; a member that goes away claims less than before, which breaks nothing a
 * blueprint pinned, so it lands in "patch otherwise" along with a pure reorder — order
 * is not meaningful in `tools`, `risk_markers` or `dependencies`.
 */
function compareList(
  previous: readonly string[],
  next: readonly string[],
  describe: { added: (v: string) => string; removed: (v: string) => string; reordered: string },
  push: (level: Reason["level"], message: string) => void,
): void {
  const before = new Set(previous);
  const after = new Set(next);
  for (const value of previous) if (!after.has(value)) push("patch", describe.removed(value));
  for (const value of next) if (!before.has(value)) push("minor", describe.added(value));

  const sameMembers =
    previous.length === next.length &&
    previous.every((v) => after.has(v)) &&
    next.every((v) => before.has(v));
  // Same members, different sequence. Joined on a space, which no term id contains.
  if (sameMembers && previous.join(" ") !== next.join(" ")) {
    push("patch", describe.reordered);
  }
}

/**
 * Doc 3 §2's phases, which the author's ruling made optional and repeatable.
 *
 * Membership only, in both directions, at `minor`; a pure reorder is a `patch`. The card
 * carries the phases in the order the author wrote them, so the sequence can differ while
 * the statement does not — and phase coverage reports in the lifecycle order regardless,
 * which is why a reorder cannot move anything a reader sees.
 */
function comparePhases(
  previous: readonly string[],
  next: readonly string[],
  push: (level: Reason["level"], message: string) => void,
): void {
  const before = new Set(previous);
  const after = new Set(next);
  for (const phase of previous) if (!after.has(phase)) push("minor", `phase \`${phase}\` was withdrawn`);
  for (const phase of next) if (!before.has(phase)) push("minor", `phase \`${phase}\` was declared`);

  const sameMembers =
    previous.length === next.length &&
    previous.every((p) => after.has(p)) &&
    next.every((p) => before.has(p));
  // Joined on a space, which no phase id contains.
  if (sameMembers && previous.join(" ") !== next.join(" ")) push("patch", "`phase` entries were reordered");
}

/**
 * `cannot`, whose two directions are the reverse of every other list on the card.
 *
 * `compareList` reads a list as a *claim*: adding to it claims more (minor) and dropping
 * from it claims less, which breaks no wiring (patch). A prohibition is not a claim about
 * what the node can do, it is a constraint on what may be wired into it, so both
 * directions invert.
 *
 * **Adding is major.** It narrows the contract. A blueprint that pinned this card and ran
 * clean can start raising `bundle/prohibition-violated` on an edge nobody touched, which
 * is exactly the "breaks something a blueprint pinned" test §4 reserves major for. Whether
 * the entry is an ontology `data-type` — enforced — or free text is not consulted: the
 * vocabulary can grow a term that turns yesterday's free text into today's rule, and a
 * bump level that changed under the card's feet would be worse than one that is
 * occasionally strict.
 *
 * **Withdrawing is minor.** It widens what the node accepts, the way `requires_human`
 * going true → false does. Nothing that resolved before stops resolving.
 *
 * A pure reorder claims the same set in a different sequence and falls under §4's "patch
 * otherwise".
 */
function compareCannot(
  previous: readonly string[],
  next: readonly string[],
  push: (level: Reason["level"], message: string) => void,
): void {
  const before = new Set(previous);
  const after = new Set(next);
  for (const entry of next) {
    if (!before.has(entry)) {
      push("major", `prohibition \`${entry}\` was declared, which narrows what the node accepts`);
    }
  }
  for (const entry of previous) {
    if (!after.has(entry)) push("minor", `prohibition \`${entry}\` was withdrawn`);
  }

  const sameMembers =
    previous.length === next.length &&
    previous.every((v) => after.has(v)) &&
    next.every((v) => before.has(v));
  // Joined on a newline, which a `cannot` entry cannot contain: entries are free text and
  // a space would make ["a b"] and ["a", "b"] compare equal.
  if (sameMembers && previous.join("\n") !== next.join("\n")) push("patch", "`cannot` entries were reordered");
}

/** The part of a card that decides its identity, for the "did anything at all change" check. */
function contentSignature(card: NodeCard): string {
  const payload: Record<string, unknown> = { ...card };
  for (const field of NOT_CONTENT) delete payload[field];
  return stable(payload);
}

/**
 * Which bump the change from `previous` to `next` demands (design doc §4).
 *
 * MAJOR — the card breaks something a blueprint pinned: a port removed, renamed or
 * retyped, an input that became required, the node's `type` or `id` changed,
 * `requires_human` flipped false → true, or an entry *added* to `cannot`. The last two are
 * judgement calls. `requires_human` does not break the wiring, but it invalidates every
 * autonomy score already computed against the card, and invalidating a published result is
 * exactly what a major bump is for. A new `cannot` entry narrows the contract: an edge
 * that resolved clean yesterday can raise `bundle/prohibition-violated` today with nobody
 * having touched the graph, which is the definition of breaking a blueprint that pinned
 * this card. `compareCannot` carries the rest of the reasoning.
 *
 * MINOR — the declared surface *grew*: an optional port, an output, a tool, an MCP server,
 * a param key, a risk marker, a dependency, `spec`, `skill`, `model`, `requires_human`
 * true → false, a `cannot` entry *withdrawn*, or a change to the set of declared phases.
 *
 * `mcp` follows `tools` exactly, since both list something the node requires of its
 * environment: adding one grows what the card asks for, dropping one asks for less and
 * lands in "patch otherwise". `skill` follows `spec`: doc 2 §3 makes the skill document
 * the definition of the agent's behaviour, so pointing at a different one, or at one for
 * the first time, changes what the node does while every port, type and param a blueprint
 * declared against stays where it was. Withdrawing the pointer is the same size of edit in
 * the other direction and is minor too.
 *
 * `model` sits at the same level for a weaker version of the same reason. Engine spec §2.6
 * calls `llm_model` "overridable by stylesheet" and §8.5 settles it at run time from the
 * node attribute, the graph's `model_stylesheet`, the graph default and the handler
 * default in that order, so the field is the default a card was written against rather
 * than a term anything is held to. Naming a model, renaming it or withdrawing it moves
 * what the node runs on and narrows nothing: every port, type, param and prohibition a
 * blueprint declared against this card stays exactly where it was, no already-published
 * score changes, and a graph that disagrees says so in the DOT. That is the line between
 * this field and a `cannot` entry, which the resolver enforces and which is therefore
 * major on the way in.
 *
 * `spec` is the original judgement call here: doc 1 §3.2 makes it the
 * instruction the agent actually executes, so rewriting it changes what the node *does*
 * while every port, type and param a blueprint declared against stays exactly where it
 * was — behaviour moved, the interface did not. That is the definition of minor, and it is
 * a level above `action`, which is a machine-readable label for the same operation rather
 * than the operation.
 *
 * `phase` is the other, and it is a **documented reversal**. This function used to call a
 * phase change *major*, on the reasoning that phase coverage re-buckets and a blueprint
 * that covered five phases would silently cover four. That reasoning rested on the phase
 * being a required, exactly-one field, which the author's ruling has withdrawn: the five
 * phases describe the factory, not every node in it, so the field is optional and
 * repeatable and its coverage is a description of scope, not a published figure a consumer
 * pinned. A phase edit now changes no interface, breaks no wiring and invalidates no
 * score — it restates what the same node was always doing. Minor in both directions:
 * adding a phase claims more, dropping one claims less, and neither is a break. A pure
 * reorder claims exactly what it claimed before and falls under §4's "patch otherwise".
 *
 * PATCH — everything else, per §4's "patch otherwise": wording (`name`, `action`,
 * `notes`, `ontology_version`, a port description), a param's value, a reordering, a
 * relaxed `required`, a different `agent`, and anything *withdrawn* from
 * `tools`, `mcp`, `risk_markers`, `dependencies` or `params` — a card that claims less breaks
 * no wiring a blueprint declared against it.
 */
export function inferBump(previous: NodeCard, next: NodeCard): BumpAnalysis {
  const reasons: Reason[] = [];
  const push = (level: Reason["level"], message: string): void => {
    reasons.push({ level, message });
  };

  if (previous.id !== next.id) {
    push("major", `card id changed: ${previous.id} → ${next.id}, these are different cards`);
  }
  if (previous.type !== next.type) {
    push("major", `node type changed: ${previous.type} → ${next.type}`);
  }
  // Reversed from major — see the note in the doc comment above. `compareList` is not
  // reused here because its convention makes a removal a patch ("the card claims less"),
  // and a phase is not a claim a blueprint wires against: dropping one is the same size of
  // edit as adding one. Both are minor, and only a reorder is a patch.
  comparePhases(previous.phases, next.phases, push);

  comparePorts("input", previous.inputs, next.inputs, push);
  comparePorts("output", previous.outputs, next.outputs, push);

  if (previous.requiresHuman !== next.requiresHuman) {
    if (next.requiresHuman) {
      push("major", "`requires_human` changed false → true, which breaks the autonomy contract");
    } else {
      push("minor", "`requires_human` changed true → false");
    }
  }

  compareList(
    previous.tools,
    next.tools,
    {
      added: (v) => `tool \`${v}\` was added`,
      removed: (v) => `tool \`${v}\` was removed`,
      reordered: "`tools` were reordered",
    },
    push,
  );
  compareList(
    previous.mcp,
    next.mcp,
    {
      added: (v) => `MCP server \`${v}\` was added`,
      removed: (v) => `MCP server \`${v}\` was removed`,
      reordered: "`mcp` entries were reordered",
    },
    push,
  );
  compareCannot(previous.cannot, next.cannot, push);
  compareList(
    previous.riskMarkers,
    next.riskMarkers,
    {
      added: (v) => `risk marker \`${v}\` was declared`,
      removed: (v) => `risk marker \`${v}\` was withdrawn`,
      reordered: "`risk_markers` were reordered",
    },
    push,
  );
  compareList(
    previous.dependencies,
    next.dependencies,
    {
      added: (v) => `dependency \`${v}\` was added`,
      removed: (v) => `dependency \`${v}\` was removed`,
      reordered: "`dependencies` were reordered",
    },
    push,
  );

  const beforeParams = previous.params;
  const afterParams = next.params;
  for (const key of Object.keys(beforeParams)) {
    if (!(key in afterParams)) push("patch", `parameter \`${key}\` was removed`);
  }
  for (const key of Object.keys(afterParams)) {
    if (!(key in beforeParams)) {
      push("minor", `parameter \`${key}\` was added`);
      continue;
    }
    if (stable(beforeParams[key]) !== stable(afterParams[key])) {
      push(
        "patch",
        `parameter \`${key}\` changed: ${showValue(beforeParams[key])} → ${showValue(afterParams[key])}`,
      );
    }
  }

  // Minor in both directions, and the direction is why it is not major: engine spec §2.6
  // makes `llm_model` overridable by the graph's stylesheet, so this field states the
  // default the card was written against rather than a term a blueprint is held to. What
  // the node runs on moves; no port, type, param or prohibition does. Contrast
  // `compareCannot`, where an *addition* narrows what the node accepts and is major.
  if (previous.model !== next.model) {
    push("minor", `\`model\` changed: ${showText(previous.model)} → ${showText(next.model)}`);
  }
  if (previous.agent !== next.agent) {
    push("patch", `\`agent\` changed: ${showText(previous.agent)} → ${showText(next.agent)}`);
  }

  if (previous.name !== next.name) {
    push("patch", `\`name\` changed: ${showText(previous.name)} → ${showText(next.name)}`);
  }
  // Doc 1 §3.2: `spec` is the instruction the agent runs, so a rewrite changes behaviour
  // without touching the interface — minor. The text itself is not quoted: specs are
  // paragraphs, and a diff belongs in the UI, not in a one-line reason.
  if (previous.spec !== next.spec) {
    push("minor", "`spec` changed, the instruction handed to the agent is different");
  }
  // Same reasoning as `spec` and the same level: the skill document is where the agent's
  // behaviour is defined, so repointing it, setting it or dropping it changes what the node
  // does without moving anything a blueprint wired against. The path is short enough to
  // quote, unlike a spec.
  if (previous.skill !== next.skill) {
    push("minor", `\`skill\` changed: ${showText(previous.skill)} → ${showText(next.skill)}`);
  }
  if (previous.action !== next.action) {
    push("patch", "`action` wording changed");
  }
  if (previous.notes !== next.notes) {
    push("patch", "`notes` changed");
  }
  if (previous.ontologyVersion !== next.ontologyVersion) {
    push(
      "patch",
      `\`ontology_version\` changed: ${previous.ontologyVersion} → ${next.ontologyVersion}`,
    );
  }

  if (reasons.length === 0) {
    // Safety net: a field nobody enumerated above (or one added to NodeCard later)
    // still forces a version bump rather than passing as "nothing changed".
    if (contentSignature(previous) !== contentSignature(next)) {
      return { level: "patch", reasons: ["card content changed"] };
    }
    return { level: "none", reasons: [] };
  }

  const ordered = reasons
    .map((reason, index) => ({ reason, index }))
    .sort((a, b) => LEVEL_RANK[b.reason.level] - LEVEL_RANK[a.reason.level] || a.index - b.index)
    .map((entry) => entry.reason);

  return { level: ordered[0].level, reasons: ordered.map((r) => r.message) };
}

/**
 * The bump the two version strings actually declare. A downgrade, an unchanged
 * version or a version that is not semver at all declares nothing — `"none"` —
 * which is what makes `bumpSatisfies` reject it. Promoting a prerelease
 * ("1.0.0-rc.1" → "1.0.0") counts as a patch: the release components are equal.
 */
export function declaredBump(previousVersion: string, nextVersion: string): BumpLevel {
  const before = parseSemver(previousVersion);
  const after = parseSemver(nextVersion);
  if (before === undefined || after === undefined) return "none";
  if (compareSemver(after, before) <= 0) return "none";
  if (after.major !== before.major) return "major";
  if (after.minor !== before.minor) return "minor";
  return "patch";
}

/** True when `declared` is at least as strong as `required`. */
export function bumpSatisfies(declared: BumpLevel, required: BumpLevel): boolean {
  return LEVEL_RANK[declared] >= LEVEL_RANK[required];
}
