/* ============================================================
   T100 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why the load is a dynamic import ──
   These tests were written against a worktree in which
   `lib/server/publish/**` does not exist: the implementer is
   building it in a tree this author never sees. A static top-level
   import of an absent module fails the whole *file* at collection,
   which reports one red where the protocol asks for one per
   acceptance criterion and hides eight criteria behind the first
   missing module. Loading inside the test that needs it turns "the
   module is not there yet" into exactly the per-criterion red the
   hand-off is supposed to produce. The specifier stays a literal so
   the `@` alias resolves.

   The same reason keeps the failure OUT of `beforeAll`. A throw in
   a hook produces SKIPS, not reds — measured in this run at 127
   merged cells going silent under one broken writer while thirteen
   cells that recorded the setup failure and re-raised it per cell
   went red. Same defect, opposite visibility. Every criterion below
   raises its own copy.

   ── one barrel under test, seven merged ones as fixtures ──
   `@/lib/server/publish` is T100 and is loaded dynamically, here
   and only here. T010's `@/lib/server/archive`, T020's
   `@/lib/server/cards`, T025's `@/lib/server/versioning`, T040's
   `@/lib/server/engine`, T050's `@/lib/server/accounts`, T060's
   `@/lib/server/policy` and T090's `@/lib/server/export` are merged
   on `backend`, ship in this worktree, and are imported statically
   by `fixtures.ts` — they are how a bundle gets into the database
   and how its digest is checked, not the thing under test.

   ── no candidate lists ──
   Every name below is bound exactly as the Published signatures
   block spells it, and an absent one throws quoting the clause that
   published it. T000 paid two rounds for the alternative: a
   candidate list resolved `encodeSession` instead of the cookie
   writer and produced five false reports of a broken round trip.
   Where the contract names something, guessing is worse than
   binding; where it does not, the orchestrator hears about it
   rather than this file inventing an answer.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const PUBLISH = "@/lib/server/publish";

let publishModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadPublish(): Promise<Namespace> {
  publishModule ??= import("@/lib/server/publish").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${PUBLISH} does not load.\n` +
          `  T100 owns \`lib/server/publish/**\` and \`app/api/bundles/**\`, and its ` +
          `Published signatures block names \`publish\`, \`PublishInput\` and \`PublishResult\`, ` +
          `with "Barrel: \`@/lib/server/publish\`".\n` +
          `  This is a failed acceptance criterion — the publishing layer is absent — and not a ` +
          `broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return publishModule;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of T100's contract, quoted verbatim so a red says where the
 * name comes from rather than leaving a reader to guess which document decided it.
 *
 * `vocabulary` carries D-133-09's correction inline because the block itself does: the field was
 * `readonly OntologyTerm[]` until 2026-08-22 and `addRelease` now refuses a bare array at the
 * write. Every vocabulary this suite plants is the published `StoredVocabulary`.
 */
export const PUBLISHED = {
  PublishInput:
    "interface PublishInput { ownerHandle: string; slug: string; version: string; " +
    "manifest: BundleManifest; dot: string; cardFiles: Record<string, string>; " +
    "vocabulary?: StoredVocabulary; visibility?: \"public\" | \"private\"; " +
    "lineage?: { ownerHandle: string; slug: string; version: string } }",
  PublishResult:
    "interface PublishResult { bundleId: string; releaseId: string; digest: string; " +
    "created: boolean }",
  publish: "publish(db: Db, actor: Actor, input: PublishInput): Promise<PublishResult>",
} as const;

/**
 * The five refusal kinds, quoted from the contract's own list.
 *
 * "A single `PublishRefusedError` carrying a `kind` of `\"unfinished\" | \"in-error\" |
 * \"conflict\" | \"not-owner\" | \"version-not-higher\"` is the shape; a generic refusal
 * satisfies 'is refused' and loses the sentence the UI needs."
 */
export const REFUSAL_KINDS = [
  "unfinished",
  "in-error",
  "conflict",
  "not-owner",
  "version-not-higher",
] as const;

export type RefusalKind = (typeof REFUSAL_KINDS)[number];

/**
 * The admissible message forms, as patterns over the contract's own table.
 *
 * Anchored at both ends on purpose. An unanchored pattern passes on a message that appends
 * engine diagnostic text after the admissible sentence, which is the one thing the contract
 * forbids outright: "No diagnostic text from the engine appears in the message — diagnostics
 * travel in the 200-with-diagnostics envelope (B-03), and a refusal that inlines them is a
 * second rendering of the same content in a place the whitelist has to police separately."
 *
 * `in-error` admits both "1 error." and "2 errors.". The contract's table writes only
 * "<n> errors." with no singular branch, while the UI it cites writes
 * `error${errorCount === 1 ? "" : "s"}` (`UploadFlow.tsx:1195-1197`). Two readings, and this
 * suite is deliberately PERMISSIVE on the axis the contract did not decide — reding a correct
 * implementation over a plural `s` the contract never ruled on would be this author's guess
 * reaching an assertion. The count itself is asserted strictly by the capture group.
 */
export const MESSAGE_FORMS = {
  unfinished: /^publish: unfinished — (\d+) of (\d+) nodes carded\.$/u,
  "in-error": /^publish: in-error — (\d+) errors?\.$/u,
  /** AC6's form: the bundle's bytes are already published. */
  conflict: /^publish: conflict — release `([^`]+)` already holds these bytes\.$/u,
  /**
   * The conflict's SECOND form, added by D-100-02.
   *
   * **Five kinds, six forms.** When B2 — a card pinned at bytes differing from the stored row —
   * was ruled into `conflict` with no sixth kind, the kind was decidable and the message was
   * not: the release form names a version and a release, and in the card case neither exists.
   * `<ref>` is `id@version`, the caller's own submission, so the whitelist's rule that a
   * message carries only the operation, the kind, the caller's own counts and version strings
   * it sent or already owns still holds.
   */
  "conflict-card": /^publish: conflict — card `([^`]+)` is already published with different content\.$/u,
  "not-owner": /^publish: not-owner — not this bundle's owner\.$/u,
  "version-not-higher": /^publish: version-not-higher — `([^`]+)` is not higher than `([^`]+)`\.$/u,
} as const;

/**
 * Every admissible form, by kind — the whitelist a refusal message must match one of.
 *
 * `conflict` carries two. Nothing else carries more than one.
 */
export const ADMISSIBLE_FORMS = {
  unfinished: [MESSAGE_FORMS.unfinished],
  "in-error": [MESSAGE_FORMS["in-error"]],
  conflict: [MESSAGE_FORMS.conflict, MESSAGE_FORMS["conflict-card"]],
  "not-owner": [MESSAGE_FORMS["not-owner"]],
  "version-not-higher": [MESSAGE_FORMS["version-not-higher"]],
} as const satisfies Record<RefusalKind, readonly RegExp[]>;

/** Whether a refusal's message is one of the forms published for its kind. */
export function matchesAdmissibleForm(kind: RefusalKind, message: string): boolean {
  return ADMISSIBLE_FORMS[kind].some((form) => form.test(message));
}

/* --------------------- reading a refusal --------------------- */

/**
 * What a refusal looked like, read off the thrown VALUE rather than off a class.
 *
 * The contract names `PublishRefusedError` in prose and its Published signatures block does
 * not list it, so whether the barrel must export the class is UNSTATED and has been charged to
 * the orchestrator rather than decided here. Binding the class would make every refusal cell
 * fail for a reason the contract never required; binding `kind` off the value asserts exactly
 * what the contract does require — that the three sentences the UI writes stay distinguishable
 * — and stays correct under either ruling.
 */
export interface Refusal {
  kind: unknown;
  message: string;
  name: string;
  error: Error;
}

export function refusalOf(thrown: unknown): Refusal {
  if (!(thrown instanceof Error)) {
    throw new Error(
      `publish rejected with a non-Error: ${typeof thrown} ${JSON.stringify(thrown)}.\n` +
        `  T100's contract requires a \`PublishRefusedError\` carrying a \`kind\`; a caller ` +
        `cannot branch on a value that is not an Error and the routes cannot map it to a status.`,
    );
  }
  return {
    kind: (thrown as unknown as { kind?: unknown }).kind,
    message: thrown.message,
    name: thrown.name,
    error: thrown,
  };
}

/**
 * Awaits a call that must be refused and returns the refusal.
 *
 * Rejects loudly when the call RESOLVES, and names what it resolved to. `rejects.toThrow()`
 * cannot say that, and a publish that succeeds where the contract requires a refusal is the
 * defect these cells exist to find.
 */
export async function refusalFrom(call: Promise<unknown>, criterion: string): Promise<Refusal> {
  let resolved: unknown;
  try {
    resolved = await call;
  } catch (thrown) {
    return refusalOf(thrown);
  }
  throw new Error(
    `${criterion}: publish RESOLVED where the contract requires a refusal.\n` +
      `  It returned ${JSON.stringify(resolved)}.`,
  );
}

/* --------------------- calling the module under test --------------------- */

/**
 * `PublishInput` as the CONTRACT spells it, declared here rather than imported.
 *
 * Importing the real one would make every cell's call site agree with the implementation by
 * construction — if the implementer widened a field, the cells would widen with it and no
 * assertion would notice. This declaration is the contract's, so a call that stops compiling
 * against it is a signature that stopped matching what was published. The `Exact<>` pins in
 * `surface.test.ts` are what compare the two once the barrel exists.
 */
export interface ContractPublishInput {
  ownerHandle: string;
  slug: string;
  version: string;
  manifest: unknown;
  dot: string;
  cardFiles: Record<string, string>;
  vocabulary?: { text: string; terms?: readonly unknown[] | null };
  visibility?: "public" | "private";
  lineage?: { ownerHandle: string; slug: string; version: string };
}

export type PublishFn = (
  db: unknown,
  actor: unknown,
  input: ContractPublishInput,
) => Promise<unknown>;

/**
 * `publish`, bound off the barrel, or a red naming the clause that published it.
 *
 * Called inside each cell rather than in a hook, so an absent module costs one red per
 * acceptance criterion instead of one skip for the file.
 */
export async function boundPublish(): Promise<PublishFn> {
  const mod = await loadPublish();
  const fn = mod["publish"];
  if (typeof fn !== "function") {
    throw new Error(
      `${PUBLISH} does not export \`publish\`.\n` +
        `  Published as: ${PUBLISHED.publish}\n` +
        `  It exports: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  return fn as PublishFn;
}

/**
 * `PublishResult`, read off the returned value with each member checked rather than cast.
 *
 * A cast would let a missing `created` reach an assertion as `undefined` and compare unequal to
 * `true` with a message about booleans, which sends a reader looking for an idempotency defect
 * when the real one is a member the contract published and the module never returned.
 */
export function resultOf(value: unknown, criterion: string): {
  bundleId: string;
  releaseId: string;
  digest: string;
  created: boolean;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      `${criterion}: publish resolved to ${typeof value}, not a PublishResult.\n` +
        `  Published as: ${PUBLISHED.PublishResult}`,
    );
  }
  const record = value as Record<string, unknown>;
  const missing = (["bundleId", "releaseId", "digest", "created"] as const).filter(
    (member) => record[member] === undefined,
  );
  if (missing.length > 0) {
    throw new Error(
      `${criterion}: the PublishResult is missing ${missing.join(", ")}.\n` +
        `  Published as: ${PUBLISHED.PublishResult}\n` +
        `  It returned: ${JSON.stringify(value)}`,
    );
  }
  return record as unknown as {
    bundleId: string;
    releaseId: string;
    digest: string;
    created: boolean;
  };
}
