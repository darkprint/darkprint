/* ============================================================
   T180 — the run-report contract surface

   Not a test file: the vitest glob reaches `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and never collected as one itself.

   The module under test is loaded dynamically so that an absent
   barrel reds per criterion instead of failing the whole file at
   collection, and `barrelExports()` separates three states
   through the public interface:

     • the import REJECTS            -> the module is absent
     • it resolves and a key is
       missing from `Object.keys`    -> the member is absent
     • the key is there              -> an assertion failed

   The published surface below is what the suites assert the
   barrel against: two signatures, the submitted and returned
   shapes, the three refusal messages and the naming rule.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/* ============================================================
   the module under test, named ONCE
   ============================================================ */

export const BARREL = "@/lib/server/runs";

let runs: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every cell that awaits it gets its own copy of the same red rather
 * than one cell's failure cascading into an unhandled rejection in the next.
 */
export function loadRuns(): Promise<Namespace> {
  runs ??= import("@/lib/server/runs").then((m) => m as unknown as Namespace);
  return runs;
}

export interface BarrelState {
  state: "module-absent" | "present";
  /** Every name the barrel exports, sorted. Empty when the module is absent. */
  keys: readonly string[];
  /** The import rejection, when there was one. */
  cause?: unknown;
}

export async function barrelExports(): Promise<BarrelState> {
  try {
    const mod = await loadRuns();
    return { state: "present", keys: Object.keys(mod).sort() };
  } catch (cause) {
    return { state: "module-absent", keys: [], cause };
  }
}

/** What a value is, for a failure message that does not make the reader go looking. */
export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return typeof value;
}

export function required(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${BARREL} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  The module RESOLVED, so this is a MEMBER absent and not the module absent — a ` +
      `failed acceptance criterion, not a naming difference. Do not add a synonym to a ` +
      `candidate list here; publish the name the contract states, or amend the contract.`,
  );
}

export function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = required(mod, name, clause);
  if (typeof value !== "function") {
    throw new Error(
      `${BARREL} exports \`${name}\` as ${describe_(value)}; the contract publishes it as a ` +
        `function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

/* ============================================================
   the published surface
   ============================================================ */

export interface PublishedSignature {
  name: string;
  /** One entry per declared parameter. */
  params: readonly string[];
  returns: string;
  text: string;
}

export interface PublishedInterface {
  name: string;
  /** `field: type`, in declaration order. */
  fields: readonly string[];
}

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  /** The refusal messages `submitReport` may throw, `<digest>` standing for the caller's value. */
  admissible: readonly string[];
}

/** The refusal messages `submitReport` may throw, sorted. */
export const REFUSAL_FORMS = [
  "submitReport: a run report needs an account.",
  "submitReport: no release at digest `<digest>`.",
  "submitReport: the run report is malformed.",
] as const;

const PUBLISHED: PublishedBlock = {
  signatures: [
    {
      name: "submitReport",
      params: ["db: Db", "actor: Actor", "report: RunReport"],
      returns: "Promise<void>",
      text: "submitReport(db: Db, actor: Actor, report: RunReport): Promise<void>",
    },
    {
      name: "reportedCost",
      params: ["db: Db", "actor: Actor", "releaseDigest: string"],
      returns: "Promise<ReportedCostUnits | undefined>",
      text: "reportedCost(db: Db, actor: Actor, releaseDigest: string): Promise<ReportedCostUnits | undefined>",
    },
  ],
  interfaces: [
    {
      name: "RunReport",
      fields: [
        "releaseDigest: string",
        "model: string",
        "provider: string",
        "hardware: string",
        "inputSize: number",
        "harnessVersion: string",
        "costUnits: number",
        "durationMs: number",
        "occurredAt: Date",
      ],
    },
    {
      name: "ReportedCostUnits",
      fields: [
        "runs: number",
        "median: number",
        "spread: { p10: number; p90: number }",
        "model: string",
        "excluded: number",
        "isSample: boolean",
      ],
    },
  ],
  admissible: REFUSAL_FORMS,
};

export function publishedBlock(): PublishedBlock {
  return PUBLISHED;
}

/** The one signature by name, or a throw naming what the surface does carry. */
export function signature(name: string): PublishedSignature {
  const found = PUBLISHED.signatures.find((s) => s.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface declares no \`${name}(...)\`. It declares: ` +
        `${PUBLISHED.signatures.map((s) => s.name).join(", ")}.`,
    );
  }
  return found;
}

/** The one interface by name, same contract as `signature`. */
export function published(name: string): PublishedInterface {
  const found = PUBLISHED.interfaces.find((i) => i.name === name);
  if (found === undefined) {
    throw new Error(
      `the published surface declares no \`interface ${name}\`. It declares: ` +
        `${PUBLISHED.interfaces.map((i) => i.name).join(", ")}.`,
    );
  }
  return found;
}

/** The response type. Its name carries the unit; its key set is what the cells pin. */
export function responseInterface(): PublishedInterface {
  return published("ReportedCostUnits");
}

/** `field` off a `field: type` entry, so a cell can quantify over names alone. */
export function fieldNames(iface: PublishedInterface): string[] {
  return iface.fields.map((f) => f.split(":")[0].trim().replace(/\?$/, ""));
}

/** Every `submitReport: ...` refusal message, sorted. */
export function ruledMessages(): string[] {
  return [...REFUSAL_FORMS];
}

/** The one ruled form containing `needle`, or a throw naming what was found. */
export function refusalForm(needle: string): string {
  const hits = ruledMessages().filter((m) => m.includes(needle));
  if (hits.length !== 1) {
    throw new Error(
      `${hits.length} \`submitReport\` message forms contain "${needle}"; this suite is ` +
        `written against exactly one. Published: ${JSON.stringify(ruledMessages())}.`,
    );
  }
  return hits[0];
}

/**
 * No key in the response shape may contain one of these words: an aggregate of self-reported
 * runs is a report, never a measurement, and a field name is the one place that claim would
 * otherwise leak.
 */
export const MEASUREMENT_WORDS = ["measured", "observed", "actual", "verified"] as const;

export function measurementWords(): string[] {
  return [...MEASUREMENT_WORDS];
}

/**
 * Every key in a value, including nested ones, as dotted paths.
 *
 * **Recursive, and that is the whole point.** `ReportedCost` carries
 * `spread: { p10, p90 }`, so a flat `Object.keys(response)` never sees `spread`'s own
 * keys and AC6's instrument is vacuous over exactly the part of the shape a later
 * contributor is most likely to extend. A `measuredP50` added inside `spread` would
 * pass a flat check forever.
 *
 * Arrays are walked by element so an index never masks a key. Cycles are tracked
 * because a response is not guaranteed acyclic and a walker that hangs reports nothing.
 */
export function nestedKeys(value: unknown, seen = new WeakSet<object>(), prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const out: string[] = [];
  if (Array.isArray(value)) {
    for (const [i, element] of value.entries()) {
      out.push(...nestedKeys(element, seen, `${prefix}[${i}]`));
    }
    return out;
  }
  for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    out.push(path);
    out.push(...nestedKeys(member, seen, path));
  }
  return out;
}

/**
 * The keys of `value` that AC6 forbids, as dotted paths, with the word that condemned each.
 *
 * Matched on the LAST path segment rather than on the whole path: a nested key under a
 * legitimately-named parent must be judged on its own name, and matching the dotted path
 * would let a parent's name condemn or excuse a child's.
 */
export function measurementNamed(value: unknown, words: readonly string[]): string[] {
  return nestedKeys(value).filter((path) => {
    const leaf = path.split(".").at(-1) ?? path;
    return words.some((word) => leaf.toLowerCase().includes(word.toLowerCase()));
  });
}
