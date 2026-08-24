/* ============================================================
   DarkPrint backend — lib/server/mcp typed refusals
   Two classes, and D-220-06 rules both. The split is D-90-A's,
   applied one layer up: `McpRefusedError` is a fact about the
   REGISTRY — absent, unparseable, or not readable by this actor —
   and `McpStoreError` is a fact about the INFRASTRUCTURE. They are
   siblings rather than parent and child, so a caller branching on
   one cannot accidentally swallow the other.

   ── Why this module publishes classes at all, when it composes ──
   Every module T220 calls seals its own faults, so a wrapper here
   looks redundant until you read the two archive verbs.
   `getBundle` and `listReleases` are bare `db.select` calls with
   no try/catch, unlike `resolveOwner` and `registry.blueprint`,
   which go through their modules' own `withStore`. A driver outage
   on `mcpProvenance` therefore reaches a caller as a raw
   `DrizzleQueryError` opening with the whole SELECT — the exact
   D-13 leak `tests/store-modules-seal-their-faults.test.ts` exists
   for, and one that guard cannot see: it asks only whether a
   module exports AT LEAST ONE error class, and `lib/server/archive`
   exports two. D-220-06 ruled the seal T220's own boundary rather
   than an edit to T010.

   ── The four-verb surface refuses with ONE voice ──
   `exportRelease` throws `ExportError`, and letting it through
   would publish T090's taxonomy on T220's surface: a caller would
   have to know which of this module's dependencies answered in
   order to branch. `store.ts` converts it. `ExportReadError` is
   NOT converted the same way, and that is the whole point of
   D-90-A's sibling split surviving the trip: it is an outage, so
   it becomes an `McpStoreError` like every other outage.

   ── The hygiene clause ──
   As `search/errors.ts` and `archive/errors.ts` apply it:
   `Object.keys(err)` is empty and `JSON.stringify(err)` is exactly
   `"{}"`; `cause` is present but NON-ENUMERABLE (the ES2022
   Error-cause option installs it that way by spec, so it holds
   because the language does it and not because anyone remembered
   `Object.defineProperty`); `stack` is retained. Whitelist, not
   blacklist — the only thing a rendering carries is the operation.

   `tests/error-hygiene.test.ts` builds its domain from
   `git ls-tree -d <backend> lib/server/`, so this module is NOT in
   its COUNT until the merge, while its hygiene clause covers these
   two classes from the day this file exists. **The number is
   derived AT the merge and never carried**: T160 and T180 move the
   same equality from the same base, so merge order decides each
   figure and whoever lands runs the walk against the tree they are
   landing in.

   The message literals are NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

/**
 * The registry has no answer for this caller.
 *
 * **ONE sentence for three different facts** — nothing at that address, an address that
 * does not parse, and an address holding something this actor may not read — because B-03
 * answers 404 over 403 so existence does not leak, and a distinct wording per case
 * reinstates exactly the leak the status code closed. `noSuchRelease` states the same rule
 * one module down and this is the same decision, not a second one.
 *
 * `message` is `` `${operation}: no such object in the registry.` `` and nothing else.
 * `operation` is the published entry point that was running, always a literal this module
 * supplies and never a value a caller sent — so an exact-match pin is writable by a blind
 * author and D-13 holds BY CONSTRUCTION: a message equal to a known string cannot contain
 * a statement.
 *
 * In particular no handle, no slug, no digest and no card ref. Three of the four verbs take
 * an address the caller chose, and the address is the one thing here that is caller data.
 *
 * `cause` is optional because most refusals have none: they are a `undefined` from a reader
 * rather than a rejection. It carries `ExportError` on the one path that does.
 */
export class McpRefusedError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`${operation}: no such object in the registry.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(McpRefusedError.prototype, "name", {
  value: "McpRefusedError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * A read behind one of the four verbs failed.
 *
 * The form already shipped four times (`archive/errors.ts`'s `` `${operation}: the write
 * failed.` ``, T050's account one, T080's registry one, T200's search one), and it is
 * reproduced here rather than varied so a reader comparing modules finds one construction.
 *
 * `cause` is typed `unknown` and required. It carries the driver error whole, with its
 * stack, and non-enumerability is exactly what keeps it out of a rendering.
 */
export class McpStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the MCP store failed.`, { cause });
  }
}

Object.defineProperty(McpStoreError.prototype, "name", {
  value: "McpStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
