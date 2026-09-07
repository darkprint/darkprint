/* ============================================================
   DarkPrint core — card validation
   Turns an untrusted `unknown` document into a `NodeCard`, or
   into the complete list of reasons why it is not one. Every
   problem is reported in a single pass: the wizard shows them
   all at once, it does not play whack-a-mole.
   Design doc §3–§4 and §6.1, engine spec §5.

   Ontology v0.1 (doc 3) added two rules this file owns: §2 every
   phase a card declares is one of five closed values, and §7 none
   of them is ever namespaced. Doc 1 §3.2 added `spec`, the prose
   the agent actually reads.

   §3's note used to add a third, making a human `type` beside a
   `requires_human` that was not `true` an error. That rule existed
   because the card said the same thing twice and the two spellings
   could disagree. The field is gone and `type` is the whole
   answer, so the contradiction is no longer expressible and there
   is nothing left for a cross-field rule to check. What replaced
   it is `card/retired-field`: a card still carrying the withdrawn
   key is told so, and told what its `type` answers instead.

   `mcp` and `skill` land here with no rule of their own: `mcp`
   defaults to `[]`, `skill` is optional, and neither is checked
   against the vocabulary, because an MCP server is a process
   somebody installed and the ontology describes no such thing.

   The two prohibition fields are checked, and they are checked in
   opposite directions. `cannot` holds `data-type` term ids and
   nothing else, so it goes through `checkTerm` exactly as `tools`
   and `risk_markers` do; whether an entry is VIOLATED is still
   `bundle/resolve.ts`'s question, since only the graph has edges.
   `will_not` holds the author's sentences, so it is checked for
   the one thing that can be wrong with a free-text field beside a
   typed one: an entry naming a term the resolver could have
   enforced is `card/prohibition-misfiled`, pointing at `cannot`.

   `phase` is **optional and repeatable**, which supersedes doc 3
   §1's "esattamente 1" on the author's ruling: the five phases
   describe the factory, not every node in it. A card that names
   none of them is complete, and this file emits nothing at all
   about it — see `readPhases`.
   ============================================================ */

import {
  error,
  hasErrors,
  info,
  warning,
  type Diagnostic,
  type DiagnosticLocation,
} from "../diagnostics";
import type { TermKind } from "../ontology/types";
import type { OntologyView } from "../ontology/resolve";
import { requiresHuman } from "../ontology/resolve";
import { bumpSatisfies, declaredBump, inferBump, type BumpLevel } from "../version/bump";
import { compareVersionStrings, formatSemver, parseSemver } from "../version/semver";
import { formatForFilename, parseDocument, type CardFormat } from "./parse";
import { TOOL_COMMAND_KEY, type JsonValue, type NodeCard, type Port } from "./schema";

/**
 * Deliberate copy of the private regex in `schema.ts`: that one guards
 * `parseCardRef`, this one owns the user-facing `card/bad-id` message. They are
 * the same string and must stay that way.
 */
const CARD_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Every key the validator understands, including the camelCase spellings it
 * accepts silently. Anything else is reported as `info` — a card written against
 * a later schema must still load here (§6.2's "adding is safe").
 *
 * Exported, and deliberately so: `scripts/skill-refs.ts` renders it into
 * `skills/darkprint/references/card-schema.md`, the wire vocabulary the authoring skill
 * hands to whoever is writing a card by hand. That reference is the *enforced* key set
 * rather than a transcription of it, and `scripts/generate-skill-refs.test.ts` fails the
 * suite when the committed file stops matching this constant. Narrowing this back to a
 * module-private `const` would take the skill's reference with it, so it stays public
 * even though nothing inside `lib/core` reads it from outside this file.
 */
export const CARD_KNOWN_KEYS: ReadonlySet<string> = new Set([
  "id",
  "name",
  "type",
  "phase",
  // The plural. `phase` became optional and repeatable, and `NodeCard.phases` is the
  // model's own name for the field, so `phases:` is the spelling an author reaches for —
  // and it used to load clean with every declared phase silently dropped, on an `info`.
  "phases",
  "action",
  "spec",
  "model",
  "agent",
  "tools",
  "mcp",
  "skill",
  "params",
  "inputs",
  "outputs",
  "dependencies",
  "cannot",
  "will_not",
  // The camelCase spelling, accepted for the same reason `requiresHuman` and
  // `riskMarkers` are: the model's own name for the field is what an author who has read
  // `schema.ts` reaches for, and a silently dropped list is worse than either spelling.
  "willNot",
  "risk_markers",
  "riskMarkers",
  "notes",
  "version",
  "author",
  "provenance",
]);

/** What a withdrawn key is told: the sentence naming the successor, and the advice. */
interface RetiredKey {
  /** Completes "Field `k` is no longer part of the card schema: <what>." */
  what: string;
  /**
   * The advice. A function rather than a string because `requires_human` needs to quote
   * the card's own `type` back before it can say whether deleting the key drops a claim.
   */
  hint: (type: string | undefined, ontology: OntologyView) => string;
}

/**
 * Keys the schema used to carry, mapped to the sentence that says what happened to them.
 *
 * `requires_human` stored whether a person acts at the node, beside a `type` that already
 * answered the same question, and the two were free to disagree: `type: human-gate` with
 * `requires_human: false` loaded, drew a person on the schematic, and scored as
 * unattended. `type` is the whole answer now.
 *
 * `ontology_version` named the vocabulary the card was written against, so the engine
 * could read an old card against the vocabulary it meant. Nothing ever asked for that: a
 * release stores its whole scorecard at publish time, so no score is recomputed against a
 * historical vocabulary, and the version a score WAS computed under is recorded on the
 * score. What the field actually produced was a third copy of one number, next to the
 * bundle manifest's and the vocabulary's own, and two diagnostics whose whole job was to
 * report the three copies disagreeing.
 *
 * Both spellings of each, because both used to load. A key here is deliberately NOT in
 * `CARD_KNOWN_KEYS`: that set is what the validator accepts and this one is what it
 * refuses to accept quietly, and merging them would put a withdrawn key back into the
 * wire vocabulary `scripts/skill-refs.ts` publishes to card authors.
 */
const RETIRED_KEYS: ReadonlyMap<string, RetiredKey> = new Map([
  [
    "requires_human",
    { what: "whether a person acts at this node is read from `type`", hint: humanKeyHint },
  ],
  [
    "requiresHuman",
    { what: "whether a person acts at this node is read from `type`", hint: humanKeyHint },
  ],
  [
    "ontology_version",
    { what: "there is one living vocabulary and a card is always read against it", hint: vocabularyKeyHint },
  ],
  [
    "ontologyVersion",
    { what: "there is one living vocabulary and a card is always read against it", hint: vocabularyKeyHint },
  ],
]);

/**
 * How deep a `params` value may nest. The walk below is recursive and `params` is
 * untrusted: a JSON document can nest far deeper than the JS stack of whichever host —
 * browser or Node — is reading it. Real configuration is two or three levels deep, so
 * anything past this is reported as a bad value rather than allowed to overflow.
 */
const MAX_PARAM_DEPTH = 100;

/**
 * Below this many characters a `spec` is a placeholder, not an instruction (doc 1 §3.2:
 * the agent that receives it "non vede il resto del grafo", so it has to be
 * self-sufficient). Deliberately *not* in `DARKPRINT_CONFIG`: that file holds the
 * numbers doc 1 §11 left open to calibration, and this one is a lint threshold nobody
 * scores against. It only ever produces a warning, so getting it slightly wrong costs
 * an author nothing.
 */
const MIN_SPEC_LENGTH = 40;

/** The outcome of validating one document. */
export interface CardValidation {
  /** Present only when there are no `error`-severity diagnostics. */
  card?: NodeCard;
  diagnostics: Diagnostic[];
}

/** What the validator needs besides the document itself. */
export interface ValidateCardOptions {
  ontology: OntologyView;
  /** For diagnostic locations. */
  file?: string;
  /** The previous published version, when checking a version bump (§4). */
  previous?: NodeCard;
}

/**
 * Validate a parsed document against the card schema. Reports every problem it
 * finds; returns the card only when none of them is an error.
 */
export function validateCard(value: unknown, opts: ValidateCardOptions): CardValidation {
  const ds: Diagnostic[] = [];
  const file = opts.file;

  if (!isMapping(value)) {
    ds.push(
      error("card/bad-type", `A card must be a mapping of fields, but this document is ${describe(value)}.`, {
        hint: "Write the fields as top-level `key: value` pairs.",
        location: at(file),
      }),
    );
    return { diagnostics: ds };
  }

  /* 3.1 identity */
  const idField = read(value, "id", ds, file);
  const id = requiredString(idField, ds, file);
  if (id !== undefined && !CARD_ID.test(id)) {
    ds.push(
      error("card/bad-id", `Card id \`${id}\` is not a legal identifier.`, {
        hint: "Use lowercase words joined by single hyphens, optionally namespaced: `berti/solver-a`.",
        location: at(file, idField.key),
      }),
    );
  }
  const name = requiredString(read(value, "name", ds, file), ds, file);
  const typeField = read(value, "type", ds, file);
  const type = requiredString(typeField, ds, file);
  if (type !== undefined) checkTerm(type, "node-type", typeField.key, opts.ontology, ds, file);
  // Doc 3 §2's dimension, optional and repeatable. `[]` is a legal, silent answer.
  //
  // Both spellings are read. `phase` is the wire key and the one the documents use, but
  // the field holds a list now and the model calls it `phases`, so an author writing
  // `phases: [implementation]` is writing the obvious thing. Without the alias that card
  // loaded *clean* — `ok: true`, an `info` nobody reads, and every declared phase
  // silently dropped — which is worse than either accepting it or rejecting it.
  const phases = readPhases(read(value, "phase", ds, file, "phases"), opts.ontology, ds, file);

  /* 3.2 behaviour */
  const action = requiredString(read(value, "action", ds, file), ds, file);
  const specField = read(value, "spec", ds, file);
  const spec = requiredString(specField, ds, file);
  if (spec !== undefined) checkSpec(spec, specField.key, ds, file);
  const model = optionalString(read(value, "model", ds, file), ds, file);
  const agent = optionalString(read(value, "agent", ds, file), ds, file);
  const tools = stringList(read(value, "tools", ds, file), ds, file, {
    kind: "tool",
    ontology: opts.ontology,
  });
  // No ontology check, and that is the difference from `tools` one line up. An MCP server
  // is a process somebody installed and the vocabulary names no such thing, so every entry
  // here is free text. Defaults to `[]`.
  const mcp = stringList(read(value, "mcp", ds, file), ds, file);
  const skill = optionalString(read(value, "skill", ds, file), ds, file);
  const paramsField = read(value, "params", ds, file);
  const params = readParams(paramsField, ds, file);
  if (type !== undefined) checkToolCommand(type, params, paramsField.key, opts.ontology, ds, file);

  /* 3.3 interfaces */
  const inputs = readPorts(read(value, "inputs", ds, file), opts.ontology, ds, file);
  const outputs = readPorts(read(value, "outputs", ds, file), opts.ontology, ds, file, true);
  const dependencies = stringList(read(value, "dependencies", ds, file), ds, file);
  // Checked against the vocabulary, and pinned to one kind. `cannot` is the enforced half
  // of the prohibition pair: every entry is a `data-type` the resolver holds every
  // incoming edge to. A `data-type` is the only kind of term an edge carries, so it is the
  // only kind that can be refused, and `checkTerm` says so at the entry rather than
  // letting a `phase` or a `tool` sit here looking enforced. "never opens a shell" belongs
  // in `will_not` and is `card/unknown-term` here, which is the whole point of the split.
  // Defaults to `[]`.
  const cannotField = read(value, "cannot", ds, file);
  const cannot = stringList(cannotField, ds, file, {
    kind: "data-type",
    ontology: opts.ontology,
  });
  // The stated half. Free text by construction, so no `checkTerm`: an entry here is a
  // sentence and the ontology has nothing to say about a sentence. `checkMisfiled` below
  // makes the one check a free-text field beside a typed one can carry.
  const willNotField = read(value, "will_not", ds, file, "willNot");
  const willNot = stringList(willNotField, ds, file);
  checkMisfiled(willNot, willNotField.key, opts.ontology, ds, file);

  /* 3.4 evaluation metadata */
  const riskMarkers = stringList(read(value, "risk_markers", ds, file, "riskMarkers"), ds, file, {
    kind: "risk-marker",
    ontology: opts.ontology,
  });
  const notes = optionalString(read(value, "notes", ds, file), ds, file);

  /* 3.5 service fields */
  const versionField = read(value, "version", ds, file);
  const version = requiredSemver(versionField, ds, file);
  const author = optionalString(read(value, "author", ds, file), ds, file);
  const provenance = optionalString(read(value, "provenance", ds, file), ds, file);

  for (const key of Object.keys(value)) {
    if (CARD_KNOWN_KEYS.has(key)) continue;
    if (RETIRED_KEYS.has(key)) {
      // Reported before the generic branch, because the generic branch's advice is wrong
      // here: "check the spelling" invites the author to fix a key that was withdrawn on
      // purpose. `type` is quoted back so the author can see the answer they now have.
      ds.push(retiredField(key, type, opts.ontology, file));
      continue;
    }
    ds.push(
      info("card/bad-type", `Field \`${key}\` is not part of the card schema and is ignored.`, {
        hint: "Unknown fields are kept for forward compatibility; check the spelling if you expected it to apply.",
        location: at(file, key),
      }),
    );
  }

  // The placeholders below only ever survive when an error was already recorded
  // for that field, and an errored card is never returned.
  const card: NodeCard = {
    id: id ?? "",
    name: name ?? "",
    type: type ?? "",
    phases,
    action: action ?? "",
    spec: spec ?? "",
    tools,
    mcp,
    params,
    inputs,
    outputs,
    dependencies,
    cannot,
    willNot,
    riskMarkers,
    version: version ?? "",
  };
  if (model !== undefined) card.model = model;
  if (agent !== undefined) card.agent = agent;
  if (skill !== undefined) card.skill = skill;
  if (notes !== undefined) card.notes = notes;
  if (author !== undefined) card.author = author;
  if (provenance !== undefined) card.provenance = provenance;

  // §4: only meaningful once the card is otherwise sound — `inferBump` compares
  // two complete cards. `previous` is assumed to describe the same card id; the
  // caller owns that pairing.
  if (opts.previous && !hasErrors(ds)) {
    checkVersionBump(opts.previous, card, versionField.key, ds, file);
  }

  return hasErrors(ds) ? { diagnostics: ds } : { card, diagnostics: ds };
}

/** `parseDocument` + `validateCard`. Format falls back to the filename, then YAML. */
export function loadCard(
  text: string,
  opts: ValidateCardOptions & { format?: CardFormat },
): CardValidation {
  const format =
    opts.format ?? (opts.file !== undefined ? formatForFilename(opts.file) : "yaml");
  const parsed = parseDocument(text, format, opts.file);
  if (parsed.value === undefined) return { diagnostics: parsed.diagnostics };
  const validated = validateCard(parsed.value, opts);
  const diagnostics = [...parsed.diagnostics, ...validated.diagnostics];
  return validated.card ? { card: validated.card, diagnostics } : { diagnostics };
}

/* --------------------- field access --------------------- */

/** One top-level field as it appears in the document. */
interface Field {
  /** The spelling actually used, so diagnostics point at what the author wrote. */
  key: string;
  value: unknown;
  present: boolean;
}

/**
 * Reads a field by its snake_case wire name, accepting the camelCase spelling
 * too. When both are present the wire name wins and the clash is surfaced —
 * silently picking one of two conflicting values would be worse.
 */
function read(
  doc: Record<string, unknown>,
  wire: string,
  ds: Diagnostic[],
  file: string | undefined,
  camel?: string,
): Field {
  const hasWire = has(doc, wire);
  const hasCamel = camel !== undefined && has(doc, camel);
  if (hasWire && hasCamel && camel !== undefined) {
    ds.push(
      info("card/bad-type", `Fields \`${wire}\` and \`${camel}\` are both present; \`${wire}\` is used.`, {
        // Not "snake_case is the wire spelling": the alias pairs are no longer all
        // snake/camel. `phase`/`phases` is a singular and a plural of the same field.
        hint: `Delete \`${camel}\`, \`${wire}\` is the spelling this schema reads.`,
        location: at(file, camel),
      }),
    );
  }
  if (hasWire) return { key: wire, value: doc[wire], present: true };
  if (hasCamel && camel !== undefined) return { key: camel, value: doc[camel], present: true };
  return { key: wire, value: undefined, present: false };
}

/** A required string: present, a string, and not blank. */
function requiredString(f: Field, ds: Diagnostic[], file: string | undefined): string | undefined {
  if (!f.present || f.value === null || f.value === undefined) {
    ds.push(missing(f.key, file));
    return undefined;
  }
  if (typeof f.value !== "string") {
    ds.push(badType(f.key, "a string", f.value, file));
    return undefined;
  }
  if (f.value.trim() === "") {
    ds.push(
      error("card/missing-field", `Field \`${f.key}\` is empty.`, {
        hint: "An empty value carries no more meaning than a missing one.",
        location: at(file, f.key),
      }),
    );
    return undefined;
  }
  return f.value;
}

/** An optional string. Absent and `null` both mean "not given". */
function optionalString(f: Field, ds: Diagnostic[], file: string | undefined): string | undefined {
  if (!f.present || f.value === null || f.value === undefined) return undefined;
  if (typeof f.value !== "string") {
    ds.push(badType(f.key, "a string", f.value, file));
    return undefined;
  }
  return f.value;
}

/** A required semver string. */
function requiredSemver(f: Field, ds: Diagnostic[], file: string | undefined): string | undefined {
  const raw = requiredString(f, ds, file);
  if (raw === undefined) return undefined;
  if (parseSemver(raw) === undefined) {
    ds.push(
      error("card/bad-version", `Field \`${f.key}\` is \`${raw}\`, which is not a semantic version.`, {
        hint: "Use MAJOR.MINOR.PATCH, e.g. `1.0.0`.",
        location: at(file, f.key),
      }),
    );
    return undefined;
  }
  return raw;
}

/**
 * A list of strings, defaulting to `[]`. Non-string entries are reported and dropped.
 * `term` opts the entries into the ontology check; the path always carries the index as
 * written in the document, not the index in the filtered result.
 */
function stringList(
  f: Field,
  ds: Diagnostic[],
  file: string | undefined,
  term?: { kind: TermKind; ontology: OntologyView },
): string[] {
  if (!f.present || f.value === null || f.value === undefined) return [];
  if (!Array.isArray(f.value)) {
    ds.push(badType(f.key, "a list of strings", f.value, file));
    return [];
  }
  const out: string[] = [];
  f.value.forEach((entry: unknown, i) => {
    const path = `${f.key}[${i}]`;
    if (typeof entry !== "string") {
      ds.push(badType(path, "a string", entry, file));
      return;
    }
    if (term !== undefined) checkTerm(entry, term.kind, path, term.ontology, ds, file);
    out.push(entry);
  });
  return out;
}

/* --------------------- phase, spec and the human rule --------------------- */

/**
 * The phase ids as the vocabulary *declares* them.
 *
 * Judgement call: read off `ontology.terms` rather than `byKind("phase")`, which sorts
 * by id and would print the five in alphabetical order. Doc 3 §2 declares them in
 * lifecycle order — planning, implementation, testing, debugging, deployment — and that
 * is the order an author should be shown them in.
 *
 * Judgement call: the set comes from the ontology the card is validated against, not
 * from a literal in this file. The five phases are closed (doc 3 §7), but "closed" is a
 * property of the vocabulary, and the vocabulary is the contract this validator reads.
 * The only extension mechanism doc 3 defines is the namespace, and `card/namespaced-phase`
 * below shuts that door.
 */
function phaseIds(ontology: OntologyView): string[] {
  return ontology.ontology.terms.filter((t) => t.kind === "phase").map((t) => t.id);
}

/**
 * Doc 3 §2 and §7 — every phase a card declares is one of the five, and none of them is
 * ever namespaced.
 *
 * **Absence is legal and silent.** The author's ruling supersedes doc 3 §1's "esattamente
 * 1": the five phases are the high-level phases a dark *factory* is expected to have, and
 * they "do not necessarily have to stick to nodes". An intake that receives work, a
 * retrieval step that fetches evidence, a memory store that survives a restart — none of
 * these occupies one of the five, and forcing a guess on them produces a coverage badge
 * that describes the guess rather than the factory. So no diagnostic of any kind is
 * emitted for a card that names no phase, not even an `info`: this validator is the last
 * place a "gap" could be invented, and there is nothing here to invent it with.
 *
 * Both wire spellings are accepted, because both read naturally in YAML:
 *
 *     phase: implementation
 *     phase: [implementation, debugging]
 *     # absent entirely
 *
 * What still fails, and why each keeps its own code:
 *  - a namespaced entry → `card/namespaced-phase` (error). Doc 3 §7 makes `phase` the one
 *    dimension a local namespace may not extend; this is not a typo but an attempt to
 *    extend a closed set, so it is checked before membership and owns the message.
 *  - an entry that is not one of the five, blank included → `card/unknown-phase` (error).
 *    Declaring a phase and getting it wrong is a different act from declaring none.
 *  - the same phase twice → `card/duplicate-phase` (warning), and the repeat is collapsed.
 *    The card describes one node in one phase either way, so it still loads.
 *
 * A value of the wrong JS type reports `card/bad-type` like every other field: that is a
 * complaint about the document, not about the vocabulary. Entries are returned in the
 * order the author wrote them, the way `tools` and `risk_markers` are — the canonical
 * lifecycle order is the *reporting* order and belongs to phase coverage, not to the card.
 */
function readPhases(
  f: Field,
  ontology: OntologyView,
  ds: Diagnostic[],
  file: string | undefined,
): string[] {
  const ids = phaseIds(ontology);
  const list = `Use any of: ${ids.map((id) => `\`${id}\``).join(", ")}.`;
  const optional =
    "The field is optional: a node that does not sit in one of the five phases leaves it out, and that is a complete answer rather than a gap.";

  // Absent, `null`, or `phase:` with nothing after it. The normal state for an intake.
  if (!f.present || f.value === null || f.value === undefined) return [];

  // Scalar or sequence; anything else is a malformed document.
  let entries: unknown[];
  if (typeof f.value === "string") entries = [f.value];
  else if (Array.isArray(f.value)) entries = f.value;
  else {
    ds.push(badType(f.key, "a phase or a list of phases", f.value, file));
    return [];
  }

  const scalar = typeof f.value === "string";
  /** `phase` for the scalar spelling, `phase[2]` for the sequence — what the author wrote. */
  const pathOf = (i: number): string => (scalar ? f.key : `${f.key}[${i}]`);

  const out: string[] = [];
  entries.forEach((entry: unknown, i) => {
    const path = pathOf(i);
    if (typeof entry !== "string") {
      ds.push(badType(path, "a string", entry, file));
      return;
    }
    if (entry.trim() === "") {
      ds.push(
        error("card/unknown-phase", `Field \`${path}\` is empty.`, {
          hint: `${list} ${optional}`,
          location: at(file, path),
        }),
      );
      return;
    }
    if (entry.includes("/")) {
      ds.push(
        error("card/namespaced-phase", `Phase \`${entry}\` is namespaced.`, {
          hint: `The five phases are closed and cannot be extended locally, unlike \`type\` and \`risk_markers\`. ${list}`,
          location: at(file, path),
        }),
      );
      return;
    }
    if (!ids.includes(entry)) {
      ds.push(
        error("card/unknown-phase", `Phase \`${entry}\` is not one of the five phases.`, {
          hint: `${list} ${optional}`,
          location: at(file, path),
        }),
      );
      return;
    }
    if (out.includes(entry)) {
      ds.push(
        warning("card/duplicate-phase", `Phase \`${entry}\` is declared more than once.`, {
          hint: "A node is in a phase or it is not; the repeat is ignored. Delete the duplicate.",
          location: at(file, path),
        }),
      );
      return;
    }
    out.push(entry);
  });
  return out;
}

/**
 * Doc 1 §3.2 — `spec` is the payload handed to the agent, which does not see the rest of
 * the graph, so a one-liner is a placeholder rather than an instruction. A warning, not
 * an error: the card is still loadable and the author is the one who knows whether their
 * node really needs three words.
 *
 * Deliberately the *only* rule about the prose. Doc 1 §3.2 also asks that a spec not leak
 * what the node is isolated from, but that is a property of two nodes read together, so
 * the criteria-leak analysis owns it (doc 3 §4.1) and this function does not try to guess
 * at it from one card. Length is measured after trimming — padding is not instruction.
 */
function checkSpec(spec: string, path: string, ds: Diagnostic[], file: string | undefined): void {
  const length = spec.trim().length;
  if (length >= MIN_SPEC_LENGTH) return;
  ds.push(
    warning(
      "card/spec-too-thin",
      `Field \`${path}\` is ${length} characters long, which is too short to instruct an agent on its own.`,
      {
        hint: "`spec` is everything the agent reading this node sees: say what to do, what to produce, and what not to look at.",
        location: at(file, path),
      },
    ),
  );
}

/* --------------------- ports --------------------- */

/**
 * `inputs` and `outputs` are required — §4 lists the defaulted fields and these
 * are not among them, so a node with no interface has to say so explicitly.
 * An absent `required` stays absent on the port rather than being materialised as
 * `true`: `Port.required` is optional, and consumers apply the default themselves.
 */
function readPorts(
  f: Field,
  ontology: OntologyView,
  ds: Diagnostic[],
  file: string | undefined,
  isOutput = false,
): Port[] {
  if (!f.present || f.value === null || f.value === undefined) {
    ds.push(missing(f.key, file, "Write `[]` when the node has none."));
    return [];
  }
  if (!Array.isArray(f.value)) {
    ds.push(badType(f.key, "a list of ports", f.value, file));
    return [];
  }
  const ports: Port[] = [];
  const seen = new Set<string>();
  f.value.forEach((entry: unknown, i) => {
    const path = `${f.key}[${i}]`;
    if (!isMapping(entry)) {
      ds.push(badType(path, "a mapping with `name` and `type`", entry, file));
      return;
    }
    const nameField: Field = { key: `${path}.name`, value: entry["name"], present: has(entry, "name") };
    const typeField: Field = { key: `${path}.type`, value: entry["type"], present: has(entry, "type") };
    const name = requiredString(nameField, ds, file);
    const type = requiredString(typeField, ds, file);
    if (type !== undefined) checkTerm(type, "data-type", typeField.key, ontology, ds, file);

    if (name !== undefined) {
      if (seen.has(name)) {
        ds.push(
          error("card/duplicate-port", `Port name \`${name}\` is declared more than once in \`${f.key}\`.`, {
            hint: "Port names address the ends of an edge, so they have to be unique within a side.",
            location: at(file, nameField.key),
          }),
        );
      }
      seen.add(name);
    }

    const port: Port = { name: name ?? "", type: type ?? "" };
    const description = optionalString(
      { key: `${path}.description`, value: entry["description"], present: has(entry, "description") },
      ds,
      file,
    );
    if (description !== undefined) port.description = description;

    const requiredFlag: unknown = entry["required"];
    if (has(entry, "required") && requiredFlag !== null && requiredFlag !== undefined) {
      if (typeof requiredFlag !== "boolean") {
        ds.push(badType(`${path}.required`, "a boolean", requiredFlag, file));
      } else if (isOutput) {
        // Keeping it on the port would be misleading: §4 defines `required` for inputs only.
        ds.push(
          info("card/bad-type", `Field \`${path}.required\` has no meaning on an output port.`, {
            hint: "`required` describes what a node needs, so it applies to inputs.",
            location: at(file, `${path}.required`),
          }),
        );
      } else {
        port.required = requiredFlag;
      }
    }
    ports.push(port);
  });
  return ports;
}

/* --------------------- params --------------------- */

/**
 * Doc 3 §3's node types as this codebase extends them: the term for a node whose whole
 * instruction is a command. Local rather than imported for the same reason
 * `analysis/security.ts` keeps `VALIDATION_TYPE` local: one module asking one question of
 * the vocabulary, spelled once where the question is asked.
 */
const SHELL_TOOL_TYPE = "shell-tool";

/**
 * A `shell-tool` card that declares no command to run.
 *
 * Engine spec §4.10's tool handler opens by reading `tool_command` and returns FAIL with
 * "No tool_command specified" when it is empty, so a card of this type carrying no command
 * describes a node that resolves, scores, exports, and then fails on its first execution.
 * Moving that earlier is what this file is for.
 *
 * `isA` rather than `type === SHELL_TOOL_TYPE`: a local type rooted at it (doc 3 §7) runs
 * on the same handler and needs the same command, and asking the vocabulary is how every
 * other type question in the engine is asked.
 *
 * A WARNING, on the ground `card/prohibition-misfiled` states. The card is legible and
 * everything else about it is checkable, and a draft is allowed to be unfinished:
 * `attractor/import.ts` deliberately writes a card with an empty `spec` for an Attractor
 * node that carried no `prompt`, so refusing this one would say a card cannot be worked on
 * until it is done.
 *
 * ── Why it borrows a code instead of minting one ──
 * `DiagnosticCode` is a shared union in `lib/core/diagnostics.ts` and this file does not
 * own it, so a `card/missing-tool-command` is owed rather than taken here. The two codes
 * used are the honest readings meanwhile: a `shell-tool` card without the key IS missing a
 * field its own type requires, and one that spells the key with something that is not a
 * command has put a value of the wrong type in it. Neither can move `gate.ts`, which
 * refuses storage on `severity === "error"` alone and narrows both of these codes further
 * to the two fields that carry a card's address.
 */
function checkToolCommand(
  type: string,
  params: Readonly<Record<string, JsonValue>>,
  key: string,
  ontology: OntologyView,
  ds: Diagnostic[],
  file: string | undefined,
): void {
  if (!ontology.isA(type, SHELL_TOOL_TYPE)) return;
  const path = `${key}.${TOOL_COMMAND_KEY}`;
  // No `hasOwnProperty` dance, unlike `card/iteration-cap.ts` over the same bag: that one
  // reads a card's raw `params` and this one reads what `readParams` built out of
  // `Object.keys`, so an inherited key was already dropped and `undefined` here can only
  // mean the author wrote nothing.
  if (params[TOOL_COMMAND_KEY] === undefined) {
    ds.push(
      warning("card/missing-field", `Field \`${path}\` is missing, and \`type: ${type}\` runs a command.`, {
        hint: "Write the command the node runs, or declare a `type` whose instruction is the prose in `spec`. Engine spec §4.10 fails a tool node with no `tool_command` before it does anything.",
        location: at(file, path),
      }),
    );
    return;
  }
  const declared = params[TOOL_COMMAND_KEY];
  // Whitespace is what §4.10 refuses, so a command of spaces is the empty case and not a
  // command that happens to be short.
  if (typeof declared === "string" && declared.trim() !== "") return;
  ds.push(
    warning(
      "card/bad-type",
      typeof declared === "string"
        ? `Field \`${path}\` is blank, and \`type: ${type}\` runs a command.`
        : `Field \`${path}\` must be a command string, but it is ${describe(declared)}.`,
      {
        hint: "Engine spec §4.10 reads it as the shell command for the node and fails the node when it is empty.",
        location: at(file, path),
      },
    ),
  );
}

/** Free-form nested configuration, defaulting to `{}` and required to survive JSON. */
function readParams(
  f: Field,
  ds: Diagnostic[],
  file: string | undefined,
): Record<string, JsonValue> {
  if (!f.present || f.value === null || f.value === undefined) return {};
  if (!isMapping(f.value)) {
    ds.push(badType(f.key, "a mapping", f.value, file));
    return {};
  }
  const out: Record<string, JsonValue> = {};
  for (const key of Object.keys(f.value)) {
    const converted = toJsonValue(f.value[key], `${f.key}.${key}`, ds, file, new Set<object>(), 1);
    if (converted !== undefined) out[key] = converted;
  }
  return out;
}

/**
 * Walks a params value and returns it when the whole subtree is JSON-serializable.
 * Every offending leaf is reported before giving up, so one bad value does not
 * hide the next; a failing child fails its parent rather than being silently dropped.
 * `depth` is the nesting level of `value` itself, counted from 1 for a top-level param.
 */
function toJsonValue(
  value: unknown,
  path: string,
  ds: Diagnostic[],
  file: string | undefined,
  seen: Set<object>,
  depth: number,
): JsonValue | undefined {
  if (depth > MAX_PARAM_DEPTH) {
    // A diagnostic, not a stack overflow: this is user data arriving from an upload.
    ds.push(notJson(path, `it nests more than ${MAX_PARAM_DEPTH} levels deep`, file));
    return undefined;
  }
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      ds.push(notJson(path, `\`${String(value)}\` has no JSON representation`, file));
      return undefined;
    }
    return value;
  }
  if (typeof value !== "object") {
    ds.push(notJson(path, `a value of type ${typeof value} cannot be serialized`, file));
    return undefined;
  }

  const node = value as object;
  if (seen.has(node)) {
    ds.push(notJson(path, "it closes a reference cycle", file));
    return undefined;
  }
  seen.add(node);
  try {
    if (Array.isArray(node)) {
      const items: JsonValue[] = [];
      let ok = true;
      node.forEach((item: unknown, i) => {
        const converted = toJsonValue(item, `${path}[${i}]`, ds, file, seen, depth + 1);
        if (converted === undefined) ok = false;
        else items.push(converted);
      });
      return ok ? items : undefined;
    }
    const proto: unknown = Object.getPrototypeOf(node);
    if (proto !== Object.prototype && proto !== null) {
      ds.push(notJson(path, `${describe(node)} is not a plain mapping`, file));
      return undefined;
    }
    const record = node as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    let ok = true;
    for (const key of Object.keys(record)) {
      const converted = toJsonValue(record[key], `${path}.${key}`, ds, file, seen, depth + 1);
      if (converted === undefined) ok = false;
      else out[key] = converted;
    }
    return ok ? out : undefined;
  } finally {
    // Only siblings sharing a node are fine; removing on the way out means a
    // repeated (but acyclic) reference is not mistaken for a cycle.
    seen.delete(node);
  }
}

/* --------------------- ontology --------------------- */

/**
 * §6.1: structural fields are references, not free text. Unknown ids and
 * kind mismatches are errors; a deprecated id stays valid and only warns (§6.2).
 */
/**
 * The one check a free-text field can carry when a typed field stands beside it.
 *
 * `will_not` holds sentences and `cannot` holds `data-type` term ids, and the mistake two
 * fields make possible is writing the value into the wrong one. An author who puts
 * `acceptance-criteria` under `will_not` has written down a rule `bundle/resolve.ts` would
 * have held every incoming edge to, in the field where it will never be looked at. The
 * card reads as though the rule is in force and no edge is ever checked against it, which
 * is the exact failure the split was made to end.
 *
 * Pinned to `data-type` for the same reason `cannot` is: a `phase`, a `node-type` or a
 * `tool` is not something an edge carries, so moving one into `cannot` would not buy the
 * author an enforced rule and telling them to is bad advice. `resolve` rather than `get`,
 * so a deprecated spelling of a data type is caught too.
 *
 * A warning: what the entry says is what the field says, and the card still loads with it.
 * The hint names the destination, since "this is in the wrong field" is only useful with
 * the right one attached.
 */
function checkMisfiled(
  entries: readonly string[],
  key: string,
  ontology: OntologyView,
  ds: Diagnostic[],
  file: string | undefined,
): void {
  entries.forEach((entry, i) => {
    const resolved = ontology.resolve(entry, "data-type");
    if (resolved === undefined) return;
    ds.push(
      warning(
        "card/prohibition-misfiled",
        `\`${entry}\` is a \`data-type\` in the vocabulary, and nothing enforces it here.`,
        {
          hint: `Move it to \`cannot\` and the resolver refuses every incoming edge that could carry \`${resolved.term.id}\`. Left here it is a sentence, and the engine reads it as one.`,
          location: at(file, `${key}[${i}]`),
        },
      ),
    );
  });
}

function checkTerm(
  id: string,
  kind: TermKind,
  path: string,
  ontology: OntologyView,
  ds: Diagnostic[],
  file: string | undefined,
): void {
  const exact = ontology.get(id);
  const resolved = ontology.resolve(id);
  if (!exact && !resolved) {
    ds.push(
      error("card/unknown-term", `Term \`${id}\` is not in the ontology.`, {
        hint: `Use an existing \`${kind}\` term, or declare your own in a local namespace such as \`me/${id}\`.`,
        location: at(file, path),
      }),
    );
    return;
  }
  const term = exact ?? resolved?.term;
  if (term === undefined) return; // unreachable: one of the two is defined here
  if (term.kind !== kind) {
    ds.push(
      error("card/wrong-term-kind", `Term \`${id}\` is a \`${term.kind}\`, but \`${path}\` needs a \`${kind}\`.`, {
        hint: `Pick a \`${kind}\` term instead.`,
        location: at(file, path),
      }),
    );
    return;
  }
  // A deprecation is read off the requested term; `resolve` may already have
  // followed the pointer, in which case the successor itself is not deprecated.
  const deprecation = exact?.deprecated;
  const replacedBy = deprecation?.replacedBy ?? (resolved?.redirected ? resolved.term.id : undefined);
  if (!deprecation && !resolved?.redirected) return;
  ds.push(
    warning("card/deprecated-term", `Term \`${id}\` is deprecated.`, {
      hint: replacedBy
        ? `Use \`${replacedBy}\` instead.${deprecation?.note ? ` ${deprecation.note}` : ""}`
        : deprecation?.note ?? "It has no replacement; drop it when you can.",
      location: at(file, path),
    }),
  );
}

/* --------------------- versioning --------------------- */

/**
 * §4 across a whole chain of published versions of one card id.
 *
 * `validateCard`'s `opts.previous` checks one step and needs a caller holding the
 * predecessor, which nothing in this repository was: the check was declared, described
 * on `/spec` as an error that refuses a bundle, and unreachable, while the archive
 * published three cards that fail it. This is the reachable form. It takes the versions
 * a caller already has, orders them, and holds every consecutive pair to the rule.
 *
 * Ordering is by semver rather than by the order they arrived, because "the last
 * published one" is a fact about the numbers and not about a directory listing. Every
 * card reaching here parses: `card/bad-version` is an error, so `validateCard` returns
 * no card at all for one that does not, and this function never sees it.
 *
 * Duplicate versions are not this function's problem either: `resolveBundle` reports two
 * files claiming one version as `bundle/digest-mismatch`, which is a sharper message.
 */
export function checkVersionChain(
  versions: readonly { card: NodeCard; file?: string }[],
): Diagnostic[] {
  const ds: Diagnostic[] = [];
  const ordered = [...versions].sort((a, b) =>
    compareVersionStrings(a.card.version, b.card.version),
  );
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1].card;
    const next = ordered[i];
    if (previous.version === next.card.version) continue;
    checkVersionBump(previous, next.card, "version", ds, next.file);
  }
  return ds;
}

/** §4: the declared bump must be at least as strong as the change requires. */
function checkVersionBump(
  previous: NodeCard,
  card: NodeCard,
  path: string,
  ds: Diagnostic[],
  file: string | undefined,
): void {
  const required = inferBump(previous, card);
  const declared = declaredBump(previous.version, card.version);
  if (bumpSatisfies(declared, required.level)) return;
  const target = nextVersionFor(previous.version, required.level);
  const what =
    declared === "none"
      ? `Version \`${card.version}\` is unchanged from the published card`
      : `Version \`${card.version}\` is only a ${declared} bump on \`${previous.version}\``;
  const reasons = required.reasons.length > 0 ? ` ${required.reasons.join("; ")}.` : "";
  ds.push(
    error("card/version-bump-too-small", `${what}, but the changes require a ${required.level} bump.`, {
      hint: target ? `Publish \`${target}\` or higher.${reasons}` : reasons.trim(),
      location: at(file, path),
    }),
  );
}

/**
 * The lowest version that would satisfy `level`. Any prerelease qualifier on
 * the previous version is dropped: the answer we suggest is always a release.
 */
function nextVersionFor(previousVersion: string, level: BumpLevel): string | undefined {
  const v = parseSemver(previousVersion);
  if (v === undefined) return undefined;
  switch (level) {
    case "major":
      return formatSemver({ major: v.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemver({ major: v.major, minor: v.minor + 1, patch: 0 });
    case "patch":
      return formatSemver({ major: v.major, minor: v.minor, patch: v.patch + 1 });
    default:
      return undefined;
  }
}

/* --------------------- diagnostics plumbing --------------------- */

function at(file?: string, path?: string): DiagnosticLocation {
  const location: DiagnosticLocation = {};
  if (file !== undefined) location.file = file;
  if (path !== undefined) location.path = path;
  return location;
}

function missing(path: string, file: string | undefined, hint?: string): Diagnostic {
  return error("card/missing-field", `Field \`${path}\` is missing.`, {
    hint: hint ?? "It is required by the card schema.",
    location: at(file, path),
  });
}

function badType(
  path: string,
  expected: string,
  actual: unknown,
  file: string | undefined,
): Diagnostic {
  return error("card/bad-type", `Field \`${path}\` must be ${expected}, but it is ${describe(actual)}.`, {
    location: at(file, path),
  });
}

/**
 * A key the schema withdrew, and what the card now answers without it.
 *
 * The hint quotes the card's own `type` back rather than describing the rule in the
 * abstract, because the author's question is not "what is the rule" but "does deleting
 * this line change what my card says". For `requires_human` the two possible answers are
 * different pieces of advice: a `human-gate` card is already saying what the key said, and
 * a `tool` card that set the key to `true` has just lost a claim and has to move it into
 * the type or drop it.
 *
 * `type` may be absent or unresolvable here — the card is being validated and its own
 * `type` may be one of the things wrong with it — so the hint degrades to naming the field
 * rather than guessing at an answer it cannot compute.
 */
function retiredField(
  key: string,
  type: string | undefined,
  ontology: OntologyView,
  file: string | undefined,
): Diagnostic {
  const retired = RETIRED_KEYS.get(key);
  const what = retired?.what ?? "it has been withdrawn from the card schema";
  const hint = retired?.hint(type, ontology) ?? "Delete the key.";
  return warning("card/retired-field", `Field \`${key}\` is no longer part of the card schema: ${what}.`, {
    hint,
    location: at(file, key),
  });
}

/** `requires_human`'s advice, which turns on whether `type` already staffs the node. */
function humanKeyHint(type: string | undefined, ontology: OntologyView): string {
  if (type === undefined) return "Delete the key and check that `type` says what you meant.";
  return requiresHuman(ontology, type)
    ? `\`type: ${type}\` already puts a person in the loop, so deleting the key changes nothing this card says.`
    : `\`type: ${type}\` runs unattended. Delete the key, and if a person acts here declare a \`human-in-the-loop\` type such as \`human-gate\` instead.`;
}

/**
 * `ontology_version`'s advice. It takes no arguments it uses: unlike `requires_human`,
 * deleting this key drops no claim about the node, so there is nothing to check against
 * the rest of the card and nothing to warn the author they are giving up.
 */
function vocabularyKeyHint(): string {
  return "Delete the key. Terms are added and retired with `deprecated: {since, replacedBy}` inside the one vocabulary, and the version a score was computed under is recorded on the score.";
}

/** `card/bad-type` doubles as the params-serialization code — §1 has no narrower one. */
function notJson(path: string, why: string, file: string | undefined): Diagnostic {
  return error("card/bad-type", `Field \`${path}\` is not JSON-serializable: ${why}.`, {
    hint: "`params` is stored and hashed as JSON, so every value has to survive a round-trip.",
    location: at(file, path),
  });
}

/** A short noun phrase for a value's type, for use inside a sentence. */
function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "absent";
  if (Array.isArray(value)) return "a list";
  switch (typeof value) {
    case "string":
      return "a string";
    case "number":
      return "a number";
    case "boolean":
      return "a boolean";
    case "function":
      return "a function";
    case "object": {
      const ctor = (value as { constructor?: { name?: string } }).constructor;
      const name = ctor?.name;
      return name !== undefined && name !== "Object" ? `a ${name}` : "a mapping";
    }
    default:
      return `a ${typeof value}`;
  }
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function has(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
