/* ============================================================
   T090 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── why the load is a dynamic import ──
   These tests were written in a worktree branched before
   `lib/server/export/**` existed. A static top-level import of an
   absent module fails the whole *file* at collection, which reports
   one red where the protocol asks for one per acceptance criterion
   and hides six criteria behind the first missing module. Loading
   inside the test that needs it turns "the module is not there yet"
   into exactly the per-criterion red the hand-off is supposed to
   produce. The specifier stays a literal so the `@` alias resolves.

   ── one barrel under test, three merged ones used as fixtures ──
   `@/lib/server/export` is T090 and is loaded dynamically. T010's
   `@/lib/server/archive`, T020's `@/lib/server/cards` and T030's
   `@/lib/server/ontology` are merged on `backend`, ship in this
   worktree, and are imported statically by `fixtures.ts` — they are
   how a release gets into the database, not the thing under test.
   `lib/content/bundle-export.ts` is shipped code too and decides the
   file set; T090's contract says it is "consumed, never restated",
   so this suite consumes it as the oracle for AC1 and AC3 rather
   than hand-listing names.

   ── no candidate lists ──
   Every name below is bound exactly as the Published signatures
   block spells it, and an absent one throws quoting the clause that
   published it. T000 paid two rounds for the alternative: a
   candidate list resolved `encodeSession` instead of the cookie
   writer and produced five false reports of a broken round trip.
   Where the contract names something, guessing is worse than
   binding; where it does not, the orchestrator hears about it in
   the Log instead.
   ============================================================ */

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const EXPORT = "@/lib/server/export";

let exportModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadExport(): Promise<Namespace> {
  exportModule ??= import("@/lib/server/export").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${EXPORT} does not load.\n` +
          `  T090 owns \`lib/server/export/**\` and \`app/api/files/**\`, and its ` +
          `Published signatures block names \`exportRelease\`, \`serveFile\`, \`serveCard\` and ` +
          `the \`ServedFile\` interface, with "Barrel: \`@/lib/server/export\`".\n` +
          `  This is a failed acceptance criterion — the distribution layer is absent — and not ` +
          `a broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return exportModule;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of T090's contract, quoted verbatim so a red says where the
 * name comes from rather than leaving a reader to guess which document decided it.
 */
export const PUBLISHED = {
  ServedFile: "interface ServedFile { path: string; bytes: Uint8Array; contentType: string }",
  exportRelease:
    "exportRelease(db: Db, actor: Actor, bundleId: string, digest: string): " +
    "Promise<readonly ExportedFile[]>",
  serveFile:
    "serveFile(db: Db, actor: Actor, ref: { ownerHandle: string; slug: string; version?: string; " +
    "digest?: string }, path: string): Promise<ServedFile | undefined>",
  serveCard: "serveCard(db: Db, actor: Actor, ref: CardRef): Promise<ServedFile | undefined>",
  recordDownload:
    'recordDownload(db: Db, target: { kind: "blueprint" | "card"; refId: string }): Promise<void>' +
    " — called by serveFile and serveCard exactly once each, and NOT by exportRelease; " +
    "`refId` is `bundle.id` for a release file and the bare `cardId` for a card",
} as const;

/**
 * The seven message forms the contract publishes, before any implementation existed.
 *
 * That order matters and is the one condition under which a message pin is a check rather than
 * the contract following the code: written afterwards to match shipped wording, the pin would be
 * tautological. Two were published with the block and five arrived with D-90-02, all as fixed
 * literals with no interpolation, so every one is pinnable by **exact match**.
 *
 * Written out here as literals and never rebuilt from the module under test. The rule: "a test
 * that builds its expectation from the module under test — importing the template, reusing the
 * format helper, reconstructing it from an exported constant — asserts 'does the module agree
 * with itself', and passes unchanged if the template itself starts interpolating a driver value."
 */
export const ADMISSIBLE = {
  noSuchRelease: "exportRelease: no such release.",
  doesNotResolve: "exportRelease: this release does not resolve.",
  badFactoryDot: "exportRelease: the emitted factory.dot is not valid Attractor input.",
  cardUnavailable: "exportRelease: a card this release pins is unavailable.",
  /* There is no `ontologyUnpublished`. It read "exportRelease: the ontology version this
     release names is not published." and was raised when a release's manifest named a
     vocabulary version nobody had published. A manifest names no version and `openView`
     merges over `CORE_ONTOLOGY` without reaching a store, so the condition is not
     constructible and the form is gone from `lib/server/export/errors.ts`. Six
     caller-observable forms stand where there were seven. */
  vocabularyNotTerms: "exportRelease: this release's stored vocabulary is not a term list.",
  noSuchFile: "serveFile: no such file in this release.",
  /**
   * The EIGHTH, and it arrived differently from the other seven.
   *
   * D-90-02 published five and the block published two; this one was invented in the
   * implementation **after** the forms were ruled, which is the contract following the code and
   * is why no blind suite could have pinned it. It is published now, so it is pinned now — and
   * it is the second time a form arriving after the ruling has cost coverage.
   *
   * It is also the one form whose CLASS matters as much as its wording: ruled a **sibling** of
   * `ExportError`, not an instance, so a driver failure reaches the route as a 500 rather than
   * sharing the type the route reads as "not found". A client holding a pinned digest reads 404
   * as *withdrawn, stop retrying*; an outage must not say that.
   *
   * And it is named `export:` rather than `exportRelease:`, because `bundleById`, `bundleByHandle`
   * and `resolveRelease` are reached from **both** `exportRelease` and `serveFile` — so the
   * `exportRelease:` prefix was simply **false on the serving path**. A message form that names
   * the wrong operation is a rendering that lies, which is the thing every other pin here exists
   * to prevent.
   *
   * It is not caller-observable: the route rethrows it and the caller gets a generic 500 with no
   * body from this module. **The forms a caller can observe are counted separately**, which is
   * why the count assertion below is over `RELEASE_FACT_FORMS` and not over every literal this
   * file knows. There were seven of them; the withdrawal of `ontologyUnpublished` leaves six.
   */
  readFailed: "export: reading this release failed.",
} as const;

/** The six that mean "a fact about the release" — everything except the driver-failure sibling. */
export const RELEASE_FACT_FORMS: readonly string[] = [
  ADMISSIBLE.noSuchRelease,
  ADMISSIBLE.doesNotResolve,
  ADMISSIBLE.badFactoryDot,
  ADMISSIBLE.cardUnavailable,
  ADMISSIBLE.vocabularyNotTerms,
  ADMISSIBLE.noSuchFile,
];

/*
 * D-90-02 also STRUCK `"serveFile: recording the download failed."` — "a counter write that fails
 * must not deny a legitimate download. The serve succeeds, the failure is audited through T240,
 * and the count is lost." The struck form is written out as a literal in `export.test.ts` rather
 * than exported from here, so the test that keeps it struck cannot be satisfied by this file
 * agreeing with itself.
 */

/**
 * Bind one published name, or throw naming the clause that published it.
 *
 * No fallback and no synonym: the rule is that "where a signature is left open,
 * the test author reports it rather than resolving it — a candidate list papers over the gap
 * and then resolves to whichever name happens to exist first".
 */
export function requiredFn(mod: Namespace, name: keyof typeof PUBLISHED): UnknownFn {
  const value = mod[name];
  if (typeof value !== "function") {
    const exported = Object.keys(mod).sort().join(", ");
    throw new Error(
      `${EXPORT} exports no function \`${name}\`.\n` +
        `  T090 Published signatures: ${PUBLISHED[name]}\n` +
        `  It exports: ${exported === "" ? "(nothing)" : exported}\n` +
        `  Bind this name rather than adding a synonym: the contract is what two agents who ` +
        `cannot see each other converge on.`,
    );
  }
  return value as UnknownFn;
}

/* --------------------- the two answers, which D-90-01 separated --------------------- */

/**
 * `serveFile` and `serveCard` have two distinct refusals and the signature alone conflates them.
 *
 * D-90-01: the block published `ServedFile | undefined` *and* a message form, and a returned
 * `undefined` carries no message — so the form can only belong to a throw. Ruled:
 *
 *   - **`undefined`** — the release is absent, or the actor may not see it. B-03, deliberately
 *     indistinguishable from each other, hence no message.
 *   - **throws** — the release resolved and the path is **not in its file list**. That is AC7's
 *     "refused", hence the message, pinned by exact match.
 *
 * Reading the signature alone a blind author writes `expect(await serveFile(...)).toBeUndefined()`
 * for exactly the discriminating AC7 case and reds a correct implementation. The ruling is what
 * makes both halves mean something, and the two helpers below keep them apart at every call site.
 */
export type Outcome =
  | { kind: "value"; value: unknown }
  | { kind: "undefined" }
  | { kind: "throw"; error: unknown; message: string };

/**
 * `() => unknown` rather than `() => Promise<unknown>`, because `requiredFn` hands back an
 * `UnknownFn` whose return type is `unknown` — a published function reached across a dynamic
 * import has no static type here, which is the whole point of binding it by name. `await` on a
 * non-promise is the identity, so a synchronous throw is captured the same way as a rejection.
 */
export async function outcomeOf(call: () => unknown): Promise<Outcome> {
  let value: unknown;
  try {
    value = await call();
  } catch (error) {
    return { kind: "throw", error, message: error instanceof Error ? error.message : String(error) };
  }
  return value === undefined ? { kind: "undefined" } : { kind: "value", value };
}

/**
 * Assert a call refused by throwing the exact published literal, and say what it did instead.
 *
 * The wrong outcome is content. This run has seen a suite that tolerated either a throw or an
 * intact base and passed with validation removed, "because the permitted outcome was the
 * silently-wrong one" — so nothing here admits a value, and the two admissible-looking wrong
 * answers (`undefined`, or a throw with different wording) each get their own sentence.
 */
export function expectThrewExactly(
  outcome: Outcome,
  expected: string,
  what: string,
): asserts outcome is { kind: "throw"; error: unknown; message: string } {
  if (outcome.kind === "value") {
    throw new Error(
      `${what} came back with a value instead of refusing: ${describe(outcome.value)}.\n` +
        `  D-90-01 ruled this path a throw carrying ${JSON.stringify(expected)}. Returning ` +
        `content here is the outcome the criterion exists to forbid.`,
    );
  }
  if (outcome.kind === "undefined") {
    throw new Error(
      `${what} answered \`undefined\`.\n` +
        `  D-90-01 gives \`undefined\` one meaning — the release is absent or the actor may not ` +
        `see it (B-03, no message) — and this path is the other one: the release resolved and ` +
        `the answer is a throw carrying ${JSON.stringify(expected)}. Collapsing the two loses ` +
        `the distinction the ruling exists to draw.`,
    );
  }
  if (outcome.message !== expected) {
    throw new Error(
      `${what} threw ${JSON.stringify(outcome.message)}.\n` +
        `  T090's contract publishes ${JSON.stringify(expected)} for this path, as a fixed ` +
        `literal with no interpolation, written before any implementation existed. The expected ` +
        `string is written out in this suite rather than imported, because a test that rebuilds ` +
        `its expectation from the module asks whether the module agrees with itself.`,
    );
  }
}

/** One value, described for a failure message without spilling a whole payload into it. */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `a string ${JSON.stringify(value.slice(0, 60))}`;
  if (value instanceof Uint8Array) return `a Uint8Array of ${value.length} bytes`;
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "object") {
    return `an object with keys [${Object.keys(value as object).sort().join(", ")}]`;
  }
  return `a ${typeof value}`;
}
