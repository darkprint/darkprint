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
 * retyped, an input that became required, the node's `type`, `phase` or `id` changed, or
 * `requires_human` flipped false → true. The last two are judgement calls: neither breaks
 * the wiring, but `requires_human` invalidates every autonomy score already computed
 * against the card, and `phase` re-buckets it in every phase-coverage calculation (doc 3
 * §2) — a blueprint that covered five phases silently covers four. Invalidating a
 * published result is exactly what a major bump is for.
 *
 * MINOR — the declared surface *grew*: an optional port, an output, a tool, a param
 * key, a risk marker, a dependency, `spec`, or `requires_human` true → false. `spec` is
 * the judgement call here: doc 1 §3.2 makes it the instruction the agent actually
 * executes, so rewriting it changes what the node *does* while every port, type and
 * param a blueprint declared against stays exactly where it was — behaviour moved, the
 * interface did not. That is the definition of minor, and it is a level above `action`,
 * which is a machine-readable label for the same operation rather than the operation.
 *
 * PATCH — everything else, per §4's "patch otherwise": wording (`name`, `action`,
 * `notes`, `ontology_version`, a port description), a param's value, a reordering, a
 * relaxed `required`, a different `model`/`agent`, and anything *withdrawn* from
 * `tools`, `risk_markers`, `dependencies` or `params` — a card that claims less breaks
 * no wiring a blueprint declared against it.
 */
export function inferBump(previous: NodeCard, next: NodeCard): BumpAnalysis {
  const reasons: Reason[] = [];
  const push = (level: Reason["level"], message: string): void => {
    reasons.push({ level, message });
  };

  if (previous.id !== next.id) {
    push("major", `card id changed: ${previous.id} → ${next.id} — these are different cards`);
  }
  if (previous.type !== next.type) {
    push("major", `node type changed: ${previous.type} → ${next.type}`);
  }
  // Doc 3 §2: the phase is what every phase-coverage calculation buckets the card by, so
  // moving it changes a published, visible property of every blueprint using the card.
  if (previous.phase !== next.phase) {
    push("major", `phase changed: ${previous.phase} → ${next.phase} — every phase coverage using this card moves`);
  }

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

  // Who runs the node changes nothing a blueprint declared against it — no port, no
  // tool, no param key — so §4 leaves it under "patch otherwise", loud reason and all.
  if (previous.model !== next.model) {
    push("patch", `\`model\` changed: ${showText(previous.model)} → ${showText(next.model)}`);
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
    push("minor", "`spec` changed — the instruction handed to the agent is different");
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
