/* ============================================================
   T120 — the lifecycle contract surface

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

   The published surface below is the transcription the suites
   assert the barrel against: signatures, plan shapes, refusal
   forms and error classes.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;
export type Row = Record<string, unknown>;

/* ============================================================
   the module under test, named ONCE
   ============================================================ */

export const BARREL = "@/lib/server/lifecycle";

let lifecycle: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every cell that awaits it gets its own copy of the same red rather
 * than one cell's failure cascading into an unhandled rejection in the next.
 *
 * The specifier stays a literal so the `@` alias resolves.
 */
export function loadLifecycle(): Promise<Namespace> {
  lifecycle ??= import("@/lib/server/lifecycle").then((m) => m as unknown as Namespace);
  return lifecycle;
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
    const mod = await loadLifecycle();
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
  if (value instanceof Date) return `Date(${value.toISOString()})`;
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

/** One admissible refusal form: the verb that raises it and the sentence, placeholders intact. */
export interface RuledForm {
  verb: string;
  /** The sentence after `<verb>: `. */
  body: string;
  /** `<verb>: <body>`. */
  message: string;
  /** The error class published beside the form, where one is. */
  className?: string;
}

export interface PublishedBlock {
  signatures: readonly PublishedSignature[];
  interfaces: readonly PublishedInterface[];
  /** Every (verb, body) refusal pair the module may raise. */
  forms: readonly RuledForm[];
  /** A pairing that reads like a published form and is refused on purpose: a transfer sentence under the deletion verb. */
  forbidden: readonly RuledForm[];
  /** The error classes the barrel publishes, sorted. */
  errorClasses: readonly string[];
}

function form(verb: string, body: string, className?: string): RuledForm {
  return className === undefined
    ? { verb, body, message: `${verb}: ${body}` }
    : { verb, body, message: `${verb}: ${body}`, className };
}

const PUBLISHED: PublishedBlock = {
  signatures: [
    {
      name: "planTransfer",
      params: ["db: Db", "actor: Actor", "bundleId: string", "toHandle: string"],
      returns: "Promise<TransferPlan>",
      text: "planTransfer(db: Db, actor: Actor, bundleId: string, toHandle: string): Promise<TransferPlan>",
    },
    {
      name: "transferBundle",
      params: ["db: Db", "actor: Actor", "bundleId: string", "toHandle: string"],
      returns: "Promise<BundleRecord>",
      text: "transferBundle(db: Db, actor: Actor, bundleId: string, toHandle: string): Promise<BundleRecord>",
    },
    {
      name: "planDeletion",
      params: ["db: Db", "actor: Actor", "accountId: string"],
      returns: "Promise<DeletionPlan>",
      text: "planDeletion(db: Db, actor: Actor, accountId: string): Promise<DeletionPlan>",
    },
    {
      name: "deleteAccount",
      params: ["db: Db", "actor: Actor", "accountId: string"],
      returns: "Promise<void>",
      text: "deleteAccount(db: Db, actor: Actor, accountId: string): Promise<void>",
    },
  ],
  interfaces: [
    {
      name: "TransferPlan",
      fields: [
        "bundleId: string",
        "fromAccountId: string",
        "toAccountId: string",
        "slug: string",
        "collides: boolean",
      ],
    },
    {
      name: "DeletionPlan",
      fields: [
        "accountId: string",
        "handle: string | null",
        "privateBundles: number",
        "privateCards: number",
        "publishedBundles: number",
        "publishedCards: number",
      ],
    },
  ],
  forms: [
    form("deleteAccount", "no account at `<accountId>`."),
    form("deleteAccount", "not this account's owner.", "DeletionRefusedError"),
    form("planDeletion", "no account at `<accountId>`."),
    form("planDeletion", "not this account's owner."),
    form("planTransfer", "no account holds `<handle>`."),
    form("planTransfer", "no bundle at `<bundleId>`."),
    form("planTransfer", "only the owner may transfer a bundle."),
    form("transferBundle", "`<handle>` already has a bundle at `<slug>`.", "TransferRefusedError"),
    form("transferBundle", "a transfer needs an account."),
    form("transferBundle", "no account holds `<handle>`."),
    form("transferBundle", "no bundle at `<bundleId>`."),
    form("transferBundle", "only the owner may transfer a bundle."),
  ],
  forbidden: [form("deleteAccount", "only the owner may transfer a bundle.")],
  errorClasses: ["DeletionRefusedError", "LifecycleStoreError", "TransferRefusedError"],
};

export function publishedBlock(): PublishedBlock {
  return PUBLISHED;
}

/** Whether `message` is one of the published refusal forms for `verb`, placeholders widened. */
export function isAdmissible(verb: string, message: unknown): boolean {
  if (typeof message !== "string") return false;
  if (PUBLISHED.forbidden.some((f) => bodyPattern(f.verb, f.body).test(message))) return false;
  return PUBLISHED.forms
    .filter((f) => f.verb === verb)
    .some((f) => bodyPattern(verb, f.body).test(message));
}

/**
 * The regex one published body becomes. A placeholder is widened to a backtick-bounded run
 * rather than to `.+?`: a lazy wildcard swallows an appended sentence, and a reader that
 * accepts a message with a sentence appended cannot see a reworded refusal at all.
 */
export function bodyPattern(verb: string, body: string): RegExp {
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const widened = body
    .split(/`<\w+>`/)
    .map(literal)
    .join("`[^`]*`");
  return new RegExp(`^${literal(`${verb}: `)}${widened}$`);
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

/** The published key set of an interface, in declaration order, `?` stripped. */
export function keysOf(name: string): readonly string[] {
  return published(name).fields.map((field) =>
    field.slice(0, field.indexOf(":")).trim().replace(/\?$/, ""),
  );
}

/* ============================================================
   setup that reds per cell instead of skipping
   ============================================================ */

/**
 * A throw in `beforeAll` produces SKIPS, not reds: the run stands down rather than failing,
 * and a skipped criterion is invisible in the totals — measured at 127 merged cells going
 * silent under one broken writer. Per-criterion reds belong in the cells.
 *
 * This suite's own copy rather than an import from another task's `contract.ts`: the
 * partition is `tests/server/t120/**` and a helper another task can edit is a helper that
 * can change what this suite means without anyone touching it.
 */
export class RecordedSetup<T> {
  private value: T | undefined;
  private failure: unknown;
  private ran = false;

  constructor(private readonly what: string) {}

  async run(make: () => Promise<T>): Promise<void> {
    this.ran = true;
    try {
      this.value = await make();
    } catch (cause) {
      this.failure = cause;
    }
  }

  /** The set-up value, or a red carrying the setup failure. Call this FIRST in every cell. */
  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was NEVER EXERCISED.\n` +
          `  Re-raised per cell on purpose: a throw in \`beforeAll\` skips, and a skipped ` +
          `criterion is invisible in the totals.\n` +
          `  Cause: ${this.failure instanceof Error ? this.failure.stack : String(this.failure)}`,
      );
    }
    if (!this.ran || this.value === undefined) {
      throw new Error(`${this.what} was never set up: the \`beforeAll\` did not run.`);
    }
    return this.value;
  }

  /** For teardown, which must not itself throw when setup never produced anything. */
  optional(): T | undefined {
    return this.failure === undefined ? this.value : undefined;
  }
}
