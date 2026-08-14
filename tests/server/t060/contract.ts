/* ============================================================
   T060 — the blind contract surface

   Not a test file. The glob in `vitest.config.ts` reaches `.test.ts`
   under `tests` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself. (Spelling
   that glob out here would close this comment on its own star.)

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before
   `lib/server/policy/**` existed. A static top-level import of a
   module that is not on disk fails the whole file at collection,
   which reports one red where the protocol asks for one per
   acceptance criterion, and hides five criteria behind the first
   missing module. Loading inside the test that needs it turns "the
   module is not there yet" into exactly the per-criterion red the
   hand-off is supposed to produce. The specifier stays a literal so
   the `@` alias in `vitest.config.ts` resolves it.

   ── why the barrel and not a deep path ──
   T060 owns `lib/server/policy/**`, and `lib/core/index.ts` states
   the rule this repository already follows: "The one module the app
   imports ... Deep paths are internal and may be rearranged, so
   nothing outside should reach for one." The Published signatures
   block names two functions and no file, so the barrel
   `@/lib/server/policy` is the one specifier bound here. That is a
   single binding, not a candidate list: if `can` and `visibleTo`
   turn out to live somewhere the barrel does not re-export, the red
   is correct, because a capability reachable only by a deep path is
   not public.

   ── one tier of binding, and no candidate list at all ──
   `backend.md` §T060 carries a Published signatures block, and the
   rule above it: "every task's Contract section states the exact
   exported signatures of its public surface". `can` and `visibleTo`
   are therefore bound *exactly*, and their absence is a red whose
   message quotes the clause that names them. Nothing in this
   directory guesses at a synonym. Two rounds of T000 were spent on
   candidate lists that resolved to the wrong export and reported
   defects that did not exist; where the contract has a name,
   guessing is worse than binding.

   ── why nothing here reads `tests/support/**` ──
   The hand-off for this task forbids it. Everything these suites
   need is in this directory, so an absent helper on another branch
   can never turn a red into a broken import.

   ── why no database and no object storage ──
   The Published signatures block opens with "Pure: no I/O, no
   imports from `lib/db` or `lib/server/http`", and criterion (5)
   restates it. A suite that connected to Postgres to test this
   module would be testing something the module is forbidden to do.
   The isolation rule is therefore satisfied by having nothing to
   isolate: these suites create no database, open no connection,
   write no object, and read no environment variable.
   ============================================================ */

export type Namespace = Record<string, unknown>;

/* --------------------- the published types --------------------- */

/**
 * The three type names from the Published signatures block, restated here so the fixtures
 * below are readable and so a fixture that drifts from the contract fails `npm run
 * typecheck` rather than passing quietly.
 *
 * Restated rather than imported, deliberately. Importing the implementation's own `Actor`
 * into every fixture would make one naming difference light up in forty places; the
 * identity check is done once, in `surface.test.ts` beside this file, where a single
 * assertion carries it.
 */
export type Actor =
  | { kind: "anonymous" }
  | { kind: "account"; accountId: string; handle: string | null }
  | { kind: "operator"; accountId: string };

export type Resource =
  | { kind: "bundle"; ownerId: string; visibility: "public" | "private" }
  | { kind: "card"; ownerId: string; visibility: "public" | "private" }
  | { kind: "save"; ownerId: string }
  | {
      kind: "note";
      authorId: string;
      /** Amended 2026-08-14. Without it a note on a private bundle was world-readable. */
      parent: { ownerId: string; visibility: "public" | "private" };
    }
  | { kind: "account"; accountId: string };

export type Action = "read" | "write" | "delete" | "publish" | "transfer";

/** Every action the contract publishes, in the order it publishes them. */
export const ACTIONS: readonly Action[] = ["read", "write", "delete", "publish", "transfer"];

/** Every resource discriminant the contract publishes. */
export const RESOURCE_KINDS = ["bundle", "card", "save", "note", "account"] as const;

/* --------------------- loading the barrel --------------------- */

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every test that awaits it gets its own copy of the same red rather
 * than one test's failure cascading into an unhandled rejection in the next.
 */
let policyModule: Promise<Namespace> | undefined;

export function loadPolicy(): Promise<Namespace> {
  policyModule ??= import("@/lib/server/policy").then((m) => m as unknown as Namespace);
  return policyModule;
}

/**
 * The Published signatures block of `backend.md` §T060, quoted so a red says where the name
 * comes from and not merely that a test wanted it. This is the whole of the named surface.
 */
export const PUBLISHED = {
  can: "can(actor: Actor, action: Action, resource: Resource): boolean",
  visibleTo: 'visibleTo(actor: Actor, ownerId: string): "all" | "public"',
} as const;

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Response) return `a Response (${value.status})`;
  if (value instanceof Promise) return "a Promise";
  return typeof value;
}

/**
 * A name the contract publishes. Absent is a red, and the red says so in as many words:
 * the whole point of the Published signatures block is that this name is no longer a thing
 * either side may choose.
 */
export function required(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `@/lib/server/policy exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. backend.md's T060 ` +
      `Published signatures block names this export exactly, and the rule above it ("the ` +
      `contract must name the interface, not only the behaviour") exists because two rounds ` +
      `of candidate lists in T000 each resolved to the wrong thing. Do not add a synonym to ` +
      `a list here; publish the name the contract states.`,
  );
}

export function requiredFn(mod: Namespace, name: string, clause: string): UnknownFn {
  const value = required(mod, name, clause);
  if (typeof value !== "function") {
    throw new Error(
      `@/lib/server/policy exports \`${name}\` as ${describe(value)}; the contract ` +
        `publishes it as a function: ${clause}`,
    );
  }
  return value as UnknownFn;
}

export type UnknownFn = (...args: unknown[]) => unknown;

/** `can`, exactly as published, with no assumption yet about what it answers. */
export type CanFn = (actor: unknown, action: unknown, resource: unknown) => unknown;

/** `visibleTo`, exactly as published, with no assumption yet about what it answers. */
export type VisibleToFn = (actor: unknown, ownerId: unknown) => unknown;

export async function canFn(): Promise<CanFn> {
  return requiredFn(await loadPolicy(), "can", PUBLISHED.can) as CanFn;
}

export async function visibleToFn(): Promise<VisibleToFn> {
  return requiredFn(await loadPolicy(), "visibleTo", PUBLISHED.visibleTo) as VisibleToFn;
}

/* --------------------- calling it --------------------- */

/**
 * One decision, with the return type the contract states enforced on the spot: "`can`
 * returns a boolean and never a `Response`". A module that answers `undefined` for a case
 * it forgot would otherwise read as a denial in every `=== true` comparison downstream and
 * pass the security half of this suite while failing criterion (3).
 *
 * Note the shape of the call: `can` is resolved *before* anything is wrapped, so a missing
 * module can never be mistaken for a denial.
 */
export function strictly(can: CanFn, actor: unknown, action: unknown, resource: unknown): boolean {
  const answer = can(actor, action, resource);
  if (typeof answer !== "boolean") {
    throw new Error(
      `can(${label(actor)}, ${JSON.stringify(action)}, ${label(resource)}) answered ` +
        `${describe(answer)}.\n` +
        `  the contract publishes: ${PUBLISHED.can}\n` +
        `  "can returns a boolean and never a Response: mapping a denied read to 404 rather ` +
        `than 403 belongs to the caller." An answer that is neither true nor false is an ` +
        `unhandled case, which is what criterion (3) forbids.`,
    );
  }
  return answer;
}

/**
 * Whether a call *granted*, for input the contract never has to accept. A throw is a
 * denial: an exhaustive `switch` that ends in `assertNever` is a legitimate reading of "an
 * exhaustive case list", and so is a fail-closed `return false`. What neither may do is
 * answer `true`, so that is the only thing asserted for malformed input.
 *
 * `can` is a parameter rather than resolved inside, for the same reason as above: if this
 * function loaded the module itself, an absent module would be caught here and reported as
 * a denial, and the whole suite would go green against nothing at all.
 */
export function granted(can: CanFn, actor: unknown, action: unknown, resource: unknown): boolean {
  try {
    return can(actor, action, resource) === true;
  } catch {
    return false;
  }
}

/** The same fail-closed reading for `visibleTo`: anything that is not `"all"` hides rows. */
export function widened(visibleTo: VisibleToFn, actor: unknown, ownerId: unknown): boolean {
  try {
    return visibleTo(actor, ownerId) === "all";
  } catch {
    return false;
  }
}

/** Enough of a value to recognise it in a failure message, and no more. */
export function label(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value) ?? String(value);
  const kind = (value as { kind?: unknown }).kind;
  const text = JSON.stringify(value);
  if (typeof kind === "string" && text !== undefined) {
    return text.length <= 80 ? text : `${kind}(…${text.length} chars)`;
  }
  return text === undefined ? Object.prototype.toString.call(value) : text;
}

/* --------------------- the cast --------------------- */

/**
 * Two accounts whose ids differ only in the last character, because an owner check written
 * with `startsWith` or a truncating comparison passes every fixture where the two ids look
 * nothing alike.
 */
export const ALICE = "acct_01J9Z3K7Q8V2M4X6";
export const BERTRAND = "acct_01J9Z3K7Q8V2M4X7";
export const OPERATOR_ACCOUNT = "acct_01J9Z3K7Q8V2M4X8";

export const anonymous: Actor = { kind: "anonymous" };
/** Owner of every fixture below. */
export const alice: Actor = { kind: "account", accountId: ALICE, handle: "aurelia" };
/** Signed in, and owner of nothing in these fixtures. The third read context. */
export const bertrand: Actor = { kind: "account", accountId: BERTRAND, handle: "bertrand" };
/** Signed up, handle not chosen yet. `handle: string | null` is in the published shape. */
export const aliceWithoutHandle: Actor = { kind: "account", accountId: ALICE, handle: null };
export const operator: Actor = { kind: "operator", accountId: OPERATOR_ACCOUNT };

/* --------------------- resources --------------------- */

export function bundle(ownerId: string, visibility: "public" | "private"): Resource {
  return { kind: "bundle", ownerId, visibility };
}

export function card(ownerId: string, visibility: "public" | "private"): Resource {
  return { kind: "card", ownerId, visibility };
}

export function save(ownerId: string): Resource {
  return { kind: "save", ownerId };
}

/**
 * A note, with the parent the 2026-08-14 amendment added. The parent is explicit at every
 * call site and has no default: the amendment exists because a note whose privacy was
 * decided without one was world-readable, and a default here would put that reading back
 * into the fixtures.
 */
export function note(
  authorId: string,
  parent: { ownerId: string; visibility: "public" | "private" },
): Resource {
  return { kind: "note", authorId, parent };
}

/** The ordinary case: an author's note on their own public blueprint. */
export function noteOnOwnPublicBundle(authorId: string): Resource {
  return note(authorId, { ownerId: authorId, visibility: "public" });
}

export function account(accountId: string): Resource {
  return { kind: "account", accountId };
}

/** Every resource shape the contract publishes, all of them belonging to `ownerId`. */
export function everyResourceOwnedBy(ownerId: string): { label: string; resource: Resource }[] {
  return [
    { label: "public bundle", resource: bundle(ownerId, "public") },
    { label: "private bundle", resource: bundle(ownerId, "private") },
    { label: "public card", resource: card(ownerId, "public") },
    { label: "private card", resource: card(ownerId, "private") },
    { label: "save", resource: save(ownerId) },
    { label: "note on their own public bundle", resource: noteOnOwnPublicBundle(ownerId) },
    { label: "account", resource: account(ownerId) },
  ];
}

/** Every resource whose contract promise is that a stranger never sees it. */
export function everyPrivateResourceOwnedBy(
  ownerId: string,
): { label: string; resource: Resource }[] {
  return [
    { label: "private bundle", resource: bundle(ownerId, "private") },
    { label: "private card", resource: card(ownerId, "private") },
    { label: "save", resource: save(ownerId) },
    {
      label: "note on their own private bundle",
      resource: note(ownerId, { ownerId, visibility: "private" }),
    },
  ];
}

/* --------------------- fixtures with rows in them --------------------- */

/**
 * A row as a route would hold one: an id the test can compare sets on, the resource the
 * policy decides about, and — for the rows that have one — the visibility column a query
 * would filter on. Criteria (1) and (2) are about a *list* and a *count* agreeing, so both
 * have to be derivable from the same fixture by two different published functions.
 */
export interface Row {
  id: string;
  resource: Resource;
  visibility?: "public" | "private";
}

function bundleRow(id: string, ownerId: string, visibility: "public" | "private"): Row {
  return { id, resource: bundle(ownerId, visibility), visibility };
}

function cardRow(id: string, ownerId: string, visibility: "public" | "private"): Row {
  return { id, resource: card(ownerId, visibility), visibility };
}

/**
 * Criterion (1). One private fork, and nothing else, over the upstream owned by Alice.
 * The contract's promise, in its own words: "a private fork is never announced on its
 * upstream, in fork counts, fork lists or the upstream author's notifications".
 *
 * Alice is in the cast of this fixture on purpose. She owns the upstream, so an
 * implementation that reasoned about lineage rather than ownership would hand her the
 * fork, and that is the exact announcement the promise forbids.
 */
export const PRIVATE_FORK: Row = bundleRow("fork-of-alices-upstream", BERTRAND, "private");
export const UPSTREAM: Row = bundleRow("alices-upstream", ALICE, "public");
export const FORKS_OF_UPSTREAM: readonly Row[] = [PRIVATE_FORK];

/** The same list with public forks beside the private one, so "empty" is not the only shape tested. */
export const MIXED_FORKS: readonly Row[] = [
  bundleRow("fork-public-a", ALICE, "public"),
  PRIVATE_FORK,
  bundleRow("fork-public-b", ALICE, "public"),
];

/**
 * Criterion (2). One handle — Alice's — carrying both halves of every count the profile
 * tab strip prints. The private rows are listed separately so the test asserts the
 * difference *is* those rows and not merely a number that happens to match.
 */
export const ALICE_PUBLIC_BUNDLES: readonly Row[] = [
  bundleRow("bp-atlas", ALICE, "public"),
  bundleRow("bp-frontline-triage", ALICE, "public"),
  bundleRow("bp-nightshift", ALICE, "public"),
];
export const ALICE_PRIVATE_BUNDLES: readonly Row[] = [
  bundleRow("bp-draft-ledger", ALICE, "private"),
  bundleRow("bp-scratch", ALICE, "private"),
];
export const ALICE_PUBLIC_CARDS: readonly Row[] = [
  cardRow("card-extract", ALICE, "public"),
  cardRow("card-reconcile", ALICE, "public"),
];
export const ALICE_PRIVATE_CARDS: readonly Row[] = [cardRow("card-inhouse", ALICE, "private")];
export const ALICE_SAVES: readonly Row[] = [
  { id: "save-1", resource: save(ALICE) },
  { id: "save-2", resource: save(ALICE) },
  { id: "save-3", resource: save(ALICE) },
  { id: "save-4", resource: save(ALICE) },
];

export const ALICE_BUNDLES: readonly Row[] = [...ALICE_PUBLIC_BUNDLES, ...ALICE_PRIVATE_BUNDLES];
export const ALICE_CARDS: readonly Row[] = [...ALICE_PUBLIC_CARDS, ...ALICE_PRIVATE_CARDS];

/* --------------------- the two ways a route counts --------------------- */

/**
 * How a route builds a *list*: one `can(actor, "read", row)` decision per row. This is the
 * per-row half of the criterion.
 */
export function listVisibleTo(can: CanFn, actor: Actor, rows: readonly Row[]): string[] {
  return rows.filter((row) => strictly(can, actor, "read", row.resource)).map((row) => row.id);
}

/**
 * How a route builds a *count*: one `visibleTo(actor, ownerId)` for the whole query, which
 * is what the contract says the function is for — "how the counting rule is honoured
 * without every query reinventing it".
 *
 * A row with no `visibility` column is private by nature: a save has no public half, and
 * the contract says so ("a save is private and so is its count").
 */
export function countVisibleTo(
  visibleTo: VisibleToFn,
  actor: Actor,
  ownerId: string,
  rows: readonly Row[],
): number {
  const mode = visibleTo(actor, ownerId);
  if (mode !== "all" && mode !== "public") {
    throw new Error(
      `visibleTo(${label(actor)}, ${JSON.stringify(ownerId)}) answered ${describe(mode)}` +
        `${typeof mode === "string" ? ` (${JSON.stringify(mode)})` : ""}.\n` +
        `  the contract publishes: ${PUBLISHED.visibleTo}\n` +
        `  There are two answers and no third. A caller turns this into a WHERE clause, so ` +
        `a third value is a query with no filter on it.`,
    );
  }
  return mode === "all" ? rows.length : rows.filter((row) => row.visibility === "public").length;
}

/* --------------------- purity helpers --------------------- */

/** Deep-frozen, so a module that writes to what it was handed throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/**
 * A structural snapshot, for proving the arguments came back unchanged. Key order is part
 * of it: a module that deletes a field and puts it back has still written to its argument.
 */
export function snapshot(value: unknown): string {
  return JSON.stringify(value);
}
