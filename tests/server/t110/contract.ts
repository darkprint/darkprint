/* ============================================================
   T110 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why the load is a dynamic import ──
   These tests were written against a worktree in which
   `lib/server/lineage/**` does not exist: the implementer is
   building it in a tree this author never sees. A static top-level
   import of an absent module fails the whole *file* at collection,
   which reports one red where the protocol asks for one per
   acceptance criterion and hides six criteria behind the first
   missing module. Loading inside the test that needs it turns "the
   module is not there yet" into exactly the per-criterion red the
   hand-off is supposed to produce. The specifier stays a literal so
   the `@` alias resolves.

   The same reason keeps the failure OUT of `beforeAll`. A throw in
   a hook produces SKIPS, not reds — measured in this run at 127
   merged cells going silent under one broken writer while thirteen
   cells that recorded the setup failure and re-raised it per cell
   went red. Same defect, opposite visibility. Every criterion below
   raises its own copy, through `RecordedSetup`.

   ── bind the module LAST ──
   Three cells in T100's suite had NEVER EXECUTED: each bound the
   module under test at the top, redded on the absent module, and so
   never ran the fixture writes below — one of them seeded the only
   card its own fixture builds to be un-storable, and two more were
   found only by reading the clock (0ms → 27ms and 0ms → 21ms once
   the binding moved down). So `boundForkBundle` and its two
   siblings are called at the END of a cell's arrangement, after
   every premise and every plant. **A red in 0ms where I/O was
   expected is a cell that never started**, and the duration column
   is how this suite is read.

   ── one barrel under test, six merged ones as fixtures ──
   `@/lib/server/lineage` is T110 and is loaded dynamically, here
   and only here. T010's `@/lib/server/archive`, T020's
   `@/lib/server/cards`, T030's `@/lib/server/ontology`, T040's
   `@/lib/server/engine`, T060's `@/lib/server/policy` and T100's
   `@/lib/server/publish` are merged on `backend`, ship in this
   worktree, and are imported statically by `fixtures.ts` — they are
   how an upstream gets into the database and how a premise is
   checked, not the thing under test.

   ── no candidate lists ──
   Every name below is bound exactly as the Published signatures
   block spells it, and an absent one throws quoting the clause that
   published it. T000 paid two rounds for the alternative: a
   candidate list resolved `encodeSession` instead of the cookie
   writer and produced five false reports of a broken round trip.
   Where the contract names something, guessing is worse than
   binding; where it does not, the orchestrator heard about it
   before a line of this was written, and the six answers are
   recorded in `RULINGS` below.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const LINEAGE = "@/lib/server/lineage";

let lineageModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadLineage(): Promise<Namespace> {
  lineageModule ??= import("@/lib/server/lineage").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${LINEAGE} does not load.\n` +
          `  backend.md §T110 owns \`lib/server/lineage/**\`, and its Published signatures block ` +
          `names \`forkBundle\`, \`driftOf\`, \`forksOf\`, \`DriftTone\`, \`Repin\` and \`Drift\`, ` +
          `with "Barrel: \`@/lib/server/lineage\`".\n` +
          `  This is a failed acceptance criterion — the lineage layer is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return lineageModule;
}

/**
 * Pays the module's transform cost in a HOOK rather than inside a cell.
 *
 * **Measured, not guessed.** The first `import("@/lib/server/lineage")` in a run makes vite
 * transform the whole graph behind the barrel — `lib/db`, drizzle, `pg`, `lib/server/archive`,
 * `accounts`, `policy` — and that was measured at **21.13s of transform against a 20s
 * `testTimeout`**. The first cell to await the import therefore timed out, and it did so with
 * `Error: Test timed out in 20000ms` on a cell whose subject is "the barrel exports
 * `forkBundle`" — a red that names a missing export while the export is present, which is the
 * worst kind: it reads as a defect report against an implementation that is correct.
 *
 * It surfaced in 10 of 19 runs of a mutation sweep, on mutations that could not have touched it,
 * which is how it was caught. It is load-dependent: another session was driving the same machine.
 *
 * The rejection is SWALLOWED, and that is the load-bearing part. A hook that throws produces
 * SKIPS, and an absent module must go on costing one red per criterion — so this warms the cache
 * and reports nothing. Every cell still calls its own `bound*`, which re-raises the same failure
 * per criterion. `hookTimeout` is 30s against `testTimeout`'s 20s (`vitest.config.ts`), so the
 * work is done where there is headroom for it.
 */
export async function warmLineage(): Promise<void> {
  await loadLineage().then(
    () => undefined,
    () => undefined,
  );
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of backend.md §T110, quoted so a red says where the name
 * comes from rather than leaving a reader to guess which document decided it.
 *
 * `lineage` carries the dispatch correction inline because the block itself does: it read
 * `{ owner, slug, version }` until 2026-08-23, which is `lib/data/bundles.ts`'s FRONTEND type
 * where `owner` is a handle. `BundleRecord.lineage` is `{ ownerId; slug; version }`
 * (`lib/server/archive/types.ts`), read off `lineage_owner_id uuid references account(id)`
 * (`lib/db/schema.ts:156-158`). Every cell in this suite asserts `ownerId`, a uuid.
 */
export const PUBLISHED = {
  DriftTone: 'type DriftTone = "ok" | "moved" | "blocked"',
  Repin: "interface Repin { card: string; from: string; to: string; at: Date }",
  Drift: "interface Drift { tone: DriftTone; repins: readonly Repin[]; reason?: string }",
  forkBundle:
    "forkBundle(db: Db, actor: Actor, from: { ownerHandle: string; slug: string; version: " +
    'string }, to: { slug: string; visibility?: "public" | "private" }): Promise<BundleRecord>',
  driftOf: "driftOf(db: Db, actor: Actor, bundleId: string): Promise<Drift>",
  forksOf:
    "forksOf(db: Db, actor: Actor, bundleId: string): Promise<readonly BundleRecord[]>",
  lineage:
    "lineage is one optional field on the ordinary bundle record — `{ ownerId, slug, version }` " +
    "— CORRECTED at dispatch: `ownerId`, a uuid, NOT `owner`, a handle",
} as const;

/**
 * The six answers to the six places this suite found the contract silent, charged before a line
 * of it was written and ruled by the orchestrator on 2026-08-23.
 *
 * Recorded here rather than in each cell's prose because several cells turn on the same one, and
 * because a ruling that lives in one message and six paraphrases is a ruling that drifts. Where a
 * cell depends on one it names it by key.
 *
 * **`Q1` and `Q6` are not yet in `backend.md`.** The block still reads "`forksOf` filters through
 * `visibleTo`" and still lists `app/api/lineage/**` under Owns; both were ruled the other way in
 * the dispatch message. `backend.md` is the orchestrator's document and this suite does not write
 * it — the divergence is reported, and these cells follow the ruling, not the stale sentence.
 */
export const RULINGS = {
  /**
   * PUBLIC ROWS ONLY, for everyone, always. The block's "filters through `visibleTo`" is loose
   * wording. The argument that settles it: under a `visibleTo` reading the fork's own owner sees
   * 1 and everyone else sees 0, so "the upstream's fork count" would not be a property of the
   * upstream at all — and AC2 is written as though it is. A count that changes with the viewer
   * cannot be "unchanged while the fork is private".
   */
  Q1_forksOf: "public rows only, for every actor, including the fork's own owner and an operator",
  /**
   * `Repin.at` is the timestamp of the upstream RELEASE that carries the new pin, not of the card
   * version's row. `lib/data/bundles.ts` renders it as "repinned `card@from → to` **on** <date>" —
   * the date of the repinning event, which is the release.
   */
  Q2_repinAt: "the createdAt of the upstream release that carries the new pin",
  /** The bare card id. `lib/data/bundles.ts:109` — "Card id, which is also the route: `/nodes/<card>`." */
  Q3_repinCard: "the bare card id, never the `id@version` ref",
  /**
   * A bundle with no lineage answers `{ tone: "ok", repins: [] }`. A bundle with no upstream has
   * not drifted from anything, and a refusal there would make callers branch on a condition the
   * type does not express.
   */
  Q4_noLineage: 'driftOf over a bundle with no lineage is { tone: "ok", repins: [] }',
  /**
   * `reason` is REQUIRED and non-empty whenever `tone === "blocked"`, and names neither the
   * upstream handle nor the upstream slug. The weaker form — "nothing in the Drift mentions the
   * upstream" — is satisfied vacuously by a `blocked` carrying no reason at all, which is the
   * intersection trap that reddened 0 of 164 cells elsewhere in this run.
   */
  Q5_blockedReason: "reason is present and non-empty whenever tone is `blocked`",
  /**
   * No route cells. `app/api/lineage/**` is removed from T110's Owns this wave: the block names no
   * path, method, status or envelope, so a route suite would be this author's design reaching an
   * assertion. AC6's "404" is asserted at the FUNCTION boundary, against the published sentence.
   */
  Q6_noRoutes: "app/api/lineage/** is out of scope this wave; AC6 is asserted at the function boundary",
  /**
   * `moved` compares THIS COPY's pin against the UPSTREAM's current pin: `from` is what the fork
   * carries, `to` is what the upstream now carries. Settled by the tree rather than by the prose —
   * `UpstreamMoved`'s docstring is "A card the upstream repinned after this copy was taken"
   * (`lib/data/bundles.ts:107`) and the component renders "Your copy still carries `<from>`". The
   * prose's other reading — compare against the newest card version in the store — would report
   * drift for a bundle with no upstream at all, which contradicts `Drift` carrying no upstream field.
   */
  F4_movedDirection: "from is this copy's pin, to is the upstream's current pin",
  /**
   * AC2's "publishes" is a FIXTURE-level transition. No merged published verb makes an existing
   * private bundle public: T100's `publish` computes
   * `existing?.visibility ?? input.visibility ?? owner.defaultVisibility` (`publish.ts:147`) and
   * says so — "Ignored on an append — a release being added is not an occasion to rewrite the
   * bundle row's visibility, and changing it is nobody's here." The two merged suites that need
   * the transition both take it with a raw update, and are the house pattern this suite follows:
   * `lib/server/saves/saves.db.scratch.test.ts:225,240` and
   * `lib/server/export/export.scratch.test.ts:545,553`.
   */
  AC2_transition: "the private → public flip is a fixture write; the cell exercises forksOf's filter",
  /**
   * D-110-09. An OMITTED `to.visibility` takes the FORKER's own `default_visibility`, never a
   * module constant. D-100-01's argument for `publish`, which transfers "with more force" — AC2's
   * entire property is that a fork can be invisible, so a constant `"public"` would defeat the
   * criterion at the default path while every explicit-value cell stayed green.
   */
  D110_09_defaultVisibility: "an omitted to.visibility is the forker's own account default",
  /**
   * D-110-10. An anonymous caller forking a PUBLIC upstream is refused with
   * `"forkBundle: not signed in."` — the one place where `can` and the operation disagree:
   * `can(anonymous, "read", publicBundle)` is `true`, and success would mean a `bundle` row owned
   * by nobody, since `bundle.owner_id` is not nullable. Unreachable through HTTP, where
   * `withSession` answers 401 first, so it is a module-boundary arm only.
   */
  D110_10_anonymous: 'an anonymous fork is refused with "forkBundle: not signed in."',
  /**
   * D-110-11. Forking at a release the upstream never published is refused with
   * `"forkBundle: no such release."` — naming the RELEASE, because the bundle exists and is
   * readable and `"no such bundle."` would be false. The hazard it closes: a fallback to the
   * latest release satisfies AC1 by writing a TRUE statement about the WRONG release, and a wrong
   * provenance is invisible where a refusal is loud.
   */
  D110_11_noSuchRelease: 'forking at an unpublished release is refused with "forkBundle: no such release."',
} as const;

/** The three tones, quoted from the contract's own union. */
export const DRIFT_TONES = ["ok", "moved", "blocked"] as const;
export type DriftTone = (typeof DRIFT_TONES)[number];

/**
 * The admissible message forms, as patterns over the contract's own table.
 *
 * Anchored at both ends on purpose. An unanchored pattern passes on a message that appends the
 * upstream's handle, or a reason, after the admissible sentence — and for AC6 that appended text
 * is the exact leak the sentence exists to prevent.
 */
export const MESSAGE_FORMS = {
  /** AC6. An upstream the caller cannot read, and one that does not exist, are the SAME sentence. */
  "no-such-bundle": /^forkBundle: no such bundle\.$/u,
  /** A slug collision in the forker's OWN namespace — the caller's own slug, theirs to see. */
  "slug-taken": /^forkBundle: `([^`]+)` is already yours\.$/u,
  /**
   * D-110-10. An anonymous caller, refused at the module boundary. Carries nothing about the
   * target — the read half of this operation would have ALLOWED it, so a sentence naming the
   * upstream here would disclose something the refusal is not about.
   */
  "not-signed-in": /^forkBundle: not signed in\.$/u,
  /**
   * D-110-11. The fourth form, and it names the RELEASE rather than the bundle: the bundle exists
   * and is readable, so `"no such bundle."` would be false. The version string is the caller's own
   * submission and is therefore theirs to see.
   */
  "no-such-release": /^forkBundle: no such release\.$/u,
} as const;

/* --------------------- reading a refusal --------------------- */

/**
 * What a refusal looked like, read off the thrown VALUE rather than off a class.
 *
 * T110's block names no error class at all — not in the Published signatures, not in prose — so
 * binding one would make every refusal cell fail for a reason the contract never required.
 * Binding the message asserts exactly what the contract does require: that the two sentences it
 * publishes are the two sentences a caller sees.
 */
export interface Refusal {
  message: string;
  name: string;
  error: Error;
}

export function refusalOf(thrown: unknown): Refusal {
  if (!(thrown instanceof Error)) {
    throw new Error(
      `forkBundle rejected with a non-Error: ${typeof thrown} ${JSON.stringify(thrown)}.\n` +
        `  A caller cannot read a message off a value that is not an Error, and the two ` +
        `admissible sentences backend.md §T110 publishes are the whole of its refusal contract.`,
    );
  }
  return { message: thrown.message, name: thrown.name, error: thrown };
}

/**
 * Awaits a call that must be refused and returns the refusal.
 *
 * Rejects loudly when the call RESOLVES, and names what it resolved to. `rejects.toThrow()`
 * cannot say that, and a fork that succeeds where the contract requires a refusal is the defect
 * these cells exist to find.
 */
export async function refusalFrom(call: Promise<unknown>, criterion: string): Promise<Refusal> {
  let resolved: unknown;
  try {
    resolved = await call;
  } catch (thrown) {
    return refusalOf(thrown);
  }
  throw new Error(
    `${criterion}: forkBundle RESOLVED where backend.md §T110 requires a refusal.\n` +
      `  It returned ${JSON.stringify(resolved)}.`,
  );
}

/* --------------------- calling the module under test --------------------- */

/**
 * The three signatures as the CONTRACT spells them, declared here rather than imported.
 *
 * Importing the real ones would make every cell's call site agree with the implementation by
 * construction — if the implementer widened a parameter, the cells would widen with it and no
 * assertion would notice. These declarations are the contract's, so a call that stops compiling
 * against one is a signature that stopped matching what was published.
 */
export interface ContractForkFrom {
  ownerHandle: string;
  slug: string;
  version: string;
}

export interface ContractForkTo {
  slug: string;
  visibility?: "public" | "private";
}

export type ForkBundleFn = (
  db: unknown,
  actor: unknown,
  from: ContractForkFrom,
  to: ContractForkTo,
) => Promise<unknown>;

export type DriftOfFn = (db: unknown, actor: unknown, bundleId: string) => Promise<unknown>;

export type ForksOfFn = (db: unknown, actor: unknown, bundleId: string) => Promise<unknown>;

async function boundFn(name: string, clause: string): Promise<UnknownFn> {
  const mod = await loadLineage();
  const fn = mod[name];
  if (typeof fn !== "function") {
    throw new Error(
      `${LINEAGE} does not export \`${name}\`.\n` +
        `  Published as: ${clause}\n` +
        `  It exports: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  return fn as UnknownFn;
}

/**
 * `forkBundle`, bound off the barrel, or a red naming the clause that published it.
 *
 * **Called at the END of a cell's arrangement, never at the top.** See this file's header: an
 * early binding reds on the absent module and silently skips every fixture write below it.
 */
export async function boundForkBundle(): Promise<ForkBundleFn> {
  return (await boundFn("forkBundle", PUBLISHED.forkBundle)) as unknown as ForkBundleFn;
}

export async function boundDriftOf(): Promise<DriftOfFn> {
  return (await boundFn("driftOf", PUBLISHED.driftOf)) as unknown as DriftOfFn;
}

export async function boundForksOf(): Promise<ForksOfFn> {
  return (await boundFn("forksOf", PUBLISHED.forksOf)) as unknown as ForksOfFn;
}

/* --------------------- reading what the module returned --------------------- */

/** What a value is, for a failure message that does not make the reader go looking. */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Date) return `a Date (${value.toISOString()})`;
  return typeof value;
}

export interface ReadBundleRecord {
  id: string;
  ownerId: string;
  slug: string;
  visibility: "public" | "private";
  lineage?: { ownerId: string; slug: string; version: string };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A `BundleRecord`, read off the returned value with each member checked rather than cast.
 *
 * A cast would let a missing `lineage` reach an assertion as `undefined` and compare unequal with
 * a message about objects, which sends a reader looking for a lineage-content defect when the real
 * one is that the record has no lineage at all.
 */
export function bundleRecordOf(value: unknown, criterion: string): ReadBundleRecord {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `${criterion}: forkBundle resolved to ${describe(value)}, not a BundleRecord.\n` +
        `  Published as: ${PUBLISHED.forkBundle}`,
    );
  }
  const record = value as Record<string, unknown>;
  const missing = (["id", "ownerId", "slug", "visibility", "createdAt", "updatedAt"] as const).filter(
    (member) => record[member] === undefined,
  );
  if (missing.length > 0) {
    throw new Error(
      `${criterion}: the BundleRecord is missing ${missing.join(", ")}.\n` +
        `  \`BundleRecord\` is T010's and is published in \`lib/server/archive/types.ts\` as ` +
        `{ id; ownerId; slug; visibility; lineage?; createdAt; updatedAt }.\n` +
        `  It returned: ${JSON.stringify(value)}`,
    );
  }
  return record as unknown as ReadBundleRecord;
}

export interface ReadRepin {
  card: unknown;
  from: unknown;
  to: unknown;
  at: unknown;
}

export interface ReadDrift {
  tone: unknown;
  repins: readonly ReadRepin[];
  reason: unknown;
  /** Whether `reason` was an OWN property, so "absent" and "present and undefined" stay apart. */
  hasReason: boolean;
}

/**
 * A `Drift`, read off the returned value with `tone` and `repins` checked rather than cast.
 *
 * `repins` is required to be an array by the published type — `readonly Repin[]`, with no
 * optional marker — so an absent one is a red here rather than an `undefined.length` further down
 * that reads as a different defect entirely.
 */
export function driftResultOf(value: unknown, criterion: string): ReadDrift {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `${criterion}: driftOf resolved to ${describe(value)}, not a Drift.\n` +
        `  Published as: ${PUBLISHED.Drift}`,
    );
  }
  const record = value as Record<string, unknown>;
  if (typeof record.tone !== "string") {
    throw new Error(
      `${criterion}: the Drift's \`tone\` is ${describe(record.tone)}.\n` +
        `  Published as: ${PUBLISHED.DriftTone}\n` +
        `  It returned: ${JSON.stringify(value)}`,
    );
  }
  if (!Array.isArray(record.repins)) {
    throw new Error(
      `${criterion}: the Drift's \`repins\` is ${describe(record.repins)}.\n` +
        `  Published as: ${PUBLISHED.Drift} — \`repins\` carries no \`?\`, so every Drift has ` +
        `one, empty where nothing moved.\n` +
        `  It returned: ${JSON.stringify(value)}`,
    );
  }
  return {
    tone: record.tone,
    repins: record.repins as readonly ReadRepin[],
    reason: record.reason,
    hasReason: Object.hasOwn(record, "reason"),
  };
}

/**
 * The array `forksOf` answered, checked for kind rather than cast.
 *
 * An implementation that answered a count, or a `{ rows }` wrapper, would otherwise reach
 * `.length` and produce a number — `undefined` for the wrapper, a digit count for a string — and
 * a cell asserting `0` would pass on a shape the contract does not publish.
 */
export function forkListOf(value: unknown, criterion: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `${criterion}: forksOf resolved to ${describe(value)}, not an array.\n` +
        `  Published as: ${PUBLISHED.forksOf}\n` +
        `  The count AC2 is about is \`forksOf(...).length\` from this same filtered query, so a ` +
        `shape with no \`length\` of its own cannot answer it.`,
    );
  }
  return value as readonly unknown[];
}

/* --------------------- setup that reds rather than skips --------------------- */

/**
 * A `beforeAll` result that fails IN THE CELLS.
 *
 * **A throw in `beforeAll` produces SKIPS, not reds** — the run stands down instead of failing,
 * and this run measured the difference: under one broken writer, 127 merged cells went silent
 * while thirteen cells in a suite that recorded its setup failure and re-raised it per cell went
 * red. Same defect, same hook, opposite visibility. A skipped criterion reads as "not applicable"
 * to a reviewer and as a passing gate to anyone reading the totals.
 *
 * So the hook records rather than throws, and every cell calls `require()` first. A scratch
 * database that cannot be created then costs one red per acceptance criterion, which is what the
 * hand-off protocol asks for.
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

  /** The set-up value, or a red carrying the setup failure. Call this first in every cell. */
  require(): T {
    if (this.failure !== undefined) {
      throw new Error(
        `${this.what} could not be set up, so this criterion was never exercised.\n` +
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
