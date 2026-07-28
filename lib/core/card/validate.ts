/* ============================================================
   DarkPrint core — card validation
   Turns an untrusted `unknown` document into a `NodeCard`, or
   into the complete list of reasons why it is not one. Every
   problem is reported in a single pass: the wizard shows them
   all at once, it does not play whack-a-mole.
   Design doc §3–§4 and §6.1, engine spec §5.

   Ontology v0.1 (doc 3) added three rules this file owns:
   §2 every phase a card declares is one of five closed values,
   §7 none of them is ever namespaced, and §3's note makes a human
   `type` with `requires_human` unset an error rather than a warning.
   Doc 1 §3.2 added `spec`, the prose the agent actually reads.

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
import { bumpSatisfies, declaredBump, inferBump, type BumpLevel } from "../version/bump";
import { formatSemver, parseSemver } from "../version/semver";
import { formatForFilename, parseDocument, type CardFormat } from "./parse";
import type { JsonValue, NodeCard, Port } from "./schema";

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
 */
const KNOWN_KEYS: ReadonlySet<string> = new Set([
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
  "params",
  "inputs",
  "outputs",
  "dependencies",
  "requires_human",
  "requiresHuman",
  "risk_markers",
  "riskMarkers",
  "notes",
  "version",
  "author",
  "provenance",
  "ontology_version",
  "ontologyVersion",
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

/** Doc 3 §3 — the abstract category the human-consistency rule is asked about. */
const HUMAN_CATEGORY = "human-in-the-loop";

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
  const params = readParams(read(value, "params", ds, file), ds, file);

  /* 3.3 interfaces */
  const inputs = readPorts(read(value, "inputs", ds, file), opts.ontology, ds, file);
  const outputs = readPorts(read(value, "outputs", ds, file), opts.ontology, ds, file, true);
  const dependencies = stringList(read(value, "dependencies", ds, file), ds, file);

  /* 3.4 evaluation metadata */
  const requiresHumanField = read(value, "requires_human", ds, file, "requiresHuman");
  const requiresHuman = readBoolean(requiresHumanField, ds, file);
  const riskMarkers = stringList(read(value, "risk_markers", ds, file, "riskMarkers"), ds, file, {
    kind: "risk-marker",
    ontology: opts.ontology,
  });
  const notes = optionalString(read(value, "notes", ds, file), ds, file);

  // Doc 3 §3's note: a type under `human-in-the-loop` and a `requires_human` that is not
  // true describe two different nodes, and the analysis would believe the flag. An error,
  // explicitly not a warning — the two fields feed the same metric.
  if (type !== undefined && !requiresHuman && isHumanType(type, opts.ontology)) {
    // Point at `requires_human` when the author wrote it, at `type` when they did not:
    // the diagnostic should land on something that exists in their document.
    const path = requiresHumanField.present ? requiresHumanField.key : typeField.key;
    ds.push(
      error(
        "card/human-type-inconsistent",
        `Type \`${type}\` puts a person in the loop, but \`requires_human\` is not \`true\`.`,
        {
          hint: `\`${type}\` is a \`${HUMAN_CATEGORY}\` node, so set \`requires_human: true\` — or pick a type that runs without a person.`,
          location: at(file, path),
        },
      ),
    );
  }

  /* 3.5 service fields */
  const versionField = read(value, "version", ds, file);
  const version = requiredSemver(versionField, ds, file);
  const author = optionalString(read(value, "author", ds, file), ds, file);
  const provenance = optionalString(read(value, "provenance", ds, file), ds, file);
  const ontologyVersion = requiredSemver(
    read(value, "ontology_version", ds, file, "ontologyVersion"),
    ds,
    file,
  );

  for (const key of Object.keys(value)) {
    if (KNOWN_KEYS.has(key)) continue;
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
    params,
    inputs,
    outputs,
    dependencies,
    requiresHuman,
    riskMarkers,
    version: version ?? "",
    ontologyVersion: ontologyVersion ?? "",
  };
  if (model !== undefined) card.model = model;
  if (agent !== undefined) card.agent = agent;
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
        hint: `Delete \`${camel}\` — \`${wire}\` is the spelling this schema reads.`,
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

/** A boolean with a documented default of `false`. */
function readBoolean(f: Field, ds: Diagnostic[], file: string | undefined): boolean {
  if (!f.present || f.value === null || f.value === undefined) return false;
  if (typeof f.value !== "boolean") {
    ds.push(badType(f.key, "a boolean", f.value, file));
    return false;
  }
  return f.value;
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

/**
 * True when the declared type puts a person in the loop (doc 3 §3).
 *
 * Asked of the *category*, never of a list of ids: a local type declaring
 * `broader: human-in-the-loop` is caught by the same call, and a human type added to the
 * core in a later version changes the answer without this file being touched. That is the
 * stated reason the category exists at all.
 */
function isHumanType(id: string, ontology: OntologyView): boolean {
  // A deprecated spelling resolves to its successor first, so an old alias of a human
  // type is held to the same rule as the term it points at (§6.2 keeps it valid).
  const resolved = ontology.resolve(id)?.term.id ?? id;
  return ontology.isA(resolved, HUMAN_CATEGORY);
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
