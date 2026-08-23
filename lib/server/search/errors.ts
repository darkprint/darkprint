/* ============================================================
   DarkPrint backend — lib/server/search typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. One class, for the same measured reason
   `lib/server/registry/errors.ts` publishes one: every absent,
   empty or invisible answer in this module's published surface is
   a VALUE, not a refusal.

   Measured against this module rather than copied from another
   task's shape: the three searchers answer an empty `hits` with
   populated `facets` (AC3 — an empty result is an answer, not a
   missing resource), an unknown query key is IGNORED (AC1), an
   unrecognised `sort` value falls back rather than erroring
   (D-200-10), and `reembedRelease` answers an absent release with
   `void` (D-200-13). So there is no decision of this module's own
   for the wrapper to pass through, and no `isDecision` predicate:
   inventing one would be a rule written against another task's
   instance rather than against this module's property.

   The hygiene clause, as `registry/errors.ts` and
   `archive/errors.ts` apply it: `Object.keys(err)` is empty and
   `JSON.stringify(err)` is exactly `"{}"`; `cause` is present but
   NON-ENUMERABLE (the ES2022 Error-cause option installs it that
   way by spec, so it holds because the language does it and not
   because anyone remembered `Object.defineProperty`); `stack` is
   retained. Whitelist, not blacklist — the only thing a rendering
   carries is the operation.

   `tests/error-hygiene.test.ts` builds its domain from
   `git ls-tree -d <backend> lib/server/`, so this module is NOT in
   it until the merge and its published-class equality does not
   move in this worktree. **The number is derived AT the merge and
   never carried** — this task publishes one class, and whoever
   lands runs the walk against the tree they are landing in.

   The message literal is NOT exported. A test that imports its
   expected message from the module under test asserts that the
   module agrees with itself, and passes unchanged the day the
   wording starts interpolating something it should not.
   ============================================================ */

/**
 * A read or a write against Postgres failed.
 *
 * `message` is `` `${operation}: the search store failed.` `` and nothing else — the form
 * already shipped three times (`archive/errors.ts`'s `` `${operation}: the write failed.` ``,
 * T050's `` `${operation}: the account store failed.` ``, T080's registry one). `operation`
 * is the published entry point that was running, always a literal this module supplies and
 * never a value a caller sent, so an exact-match pin is writable by a blind author and D-13
 * holds BY CONSTRUCTION: a message equal to a known string cannot contain a statement.
 *
 * No statement, no bound parameter, no SQLSTATE, no constraint name, and in particular no
 * `q` — a search module is the one place where the caller's own text is the most tempting
 * thing to put in a message and the most damaging thing to leak into a log.
 *
 * `cause` is typed `unknown` and required. It carries the driver error whole, with its
 * stack, and non-enumerability is exactly what keeps it out of a rendering.
 */
export class SearchStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the search store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(SearchStoreError.prototype, "name", {
  value: "SearchStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
