/* ============================================================
   DarkPrint backend: lib/server/tutorial typed rejection
   One class. Everything this module cannot answer is a fact about
   the infrastructure: a token that is unknown or expired is a
   VALUE (`undefined`) rather than a rejection, because the route
   answers it 404 and a distinct wording per cause would tell a
   caller holding a random string whether it was ever real.

   The hygiene clause, as every other store class here applies it:
   `Object.keys(err)` is empty and `JSON.stringify(err)` is `"{}"`;
   `cause` is installed non-enumerable by the language; `stack` is
   kept; `name` sits on the prototype rather than on the instance.
   ============================================================ */

/**
 * A statement behind one of the three verbs failed.
 *
 * `message` is `` `${operation}: the tutorial store failed.` `` and nothing else. The
 * operation is the verb's own exported name, always a literal this module supplies and never
 * a value a caller sent, so the rendering cannot carry a token, a draft or a bound parameter.
 * The driver error travels whole on `cause`, where an operator reads it.
 */
export class TutorialStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the tutorial store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a class field is an own enumerable property,
   which the hygiene clause does not allow. */
Object.defineProperty(TutorialStoreError.prototype, "name", {
  value: "TutorialStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
