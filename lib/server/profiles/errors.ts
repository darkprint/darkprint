/* ============================================================
   DarkPrint backend — lib/server/profiles typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters. TWO classes, and the count is MEASURED against this
   module rather than copied from a neighbour's shape — the brief
   for this task said so explicitly, and T081's implementer got a
   different answer from T050's by taking that measurement instead
   of reasoning by analogy.

   It shipped as ONE and D-130-10 made it two. That is recorded
   rather than smoothed: the second class exists because this file
   argued a distinction in `http.ts` and the module next door broke
   it in the same commit.

   ── TWO classes, and the split is about WHOSE fault it is ──
   The question is whether this module has DECISIONS: refusals it
   authors itself, which a wrapper must pass through rather than
   seal.

   The measurement and the question it answers, in one sentence,
   because an earlier version of this paragraph got them apart and
   said something false. `grep -rn "throw "` over
   `lib/server/profiles/` and `app/api/authors/` matches this
   file's and `http.ts`'s own PROSE about the rule as well as the
   statements — so a count answers "does the string appear", which
   is not the question.

   The answer, which has NOT changed and is the one that matters:
   **no published function of this module refuses anything a caller
   can send.** `getProfile` answers `undefined` for an unknown
   handle, for a handle no account holds, and for one that is not a
   legal name at all (D-130-02). That is B-03 one layer down —
   *no such handle* and *nothing you may see* are ONE value, so a
   caller cannot use the difference as an existence oracle, and the
   404 is the route's to produce from the absence.

   What D-130-10 added is a refusal about the ARCHIVE'S OWN
   CONTENT, which is a different subject. A stored vocabulary this
   module cannot read is not a caller's mistake and not the store
   failing to answer — the store answered, with something no reader
   in this repository accepts. So there are two classes and the
   line between them is *whose fault the condition is*, not how it
   is raised.

   `tests/store-modules-seal-their-faults.test.ts` requires this
   file to exist at all: this module imports `@/lib/db`, so
   whatever the driver rejects with has to leave sealed. Its domain
   is `git ls-tree backend`, so it does not see this module until
   the merge — the requirement is real and its enforcement arrives
   one commit later than the code.

   So there is exactly ONE arm to pass a refusal through, and it is
   in `store.ts`. There is still no `isDecision` predicate: a
   predicate is what you build when the set is open, and this set
   has one member that the wrapper can name directly. Building one
   would be a rule written against T050's instance rather than
   against this module's property — the same charge that kept it
   out when the count was zero.

   The hygiene clause, as `lib/server/registry/errors.ts` applies
   it: `Object.keys(err)` is empty and `JSON.stringify(err)` is
   exactly `"{}"`; `cause` is present but non-enumerable, which the
   ES2022 Error-cause option installs by spec rather than by anyone
   remembering `Object.defineProperty`; `stack` is retained.
   Whitelist, not blacklist — the only thing any rendering carries
   is the operation.

   ── Why the message constant is not exported ──
   A test importing its expected message from the module under test
   asserts that the module agrees with itself, and passes unchanged
   the day the wording starts interpolating something it should
   not. A suite has to hardcode.
   ============================================================ */

/**
 * A read against Postgres failed while serving a profile.
 *
 * `message` is `` `${operation}: the profile store failed.` `` and nothing else — the form
 * D-81-01 ruled for the registry and the convention shipped four times now
 * (`archive/errors.ts`, T050's accounts, T081's registry). `operation` is the name of the
 * published reader that was running, always a literal this module supplies and never a
 * value a caller sent, which is what makes an exact-match pin writable by a blind author
 * and makes D-13 hold BY CONSTRUCTION: a message equal to a known string cannot contain a
 * statement. A scan for the statement's own tokens would over-match on `bundle` or
 * `release` and red a correct implementation (T-04).
 *
 * The driver error travels on `cause`, which carries the statement, the bound parameters
 * and the SQLSTATE, and which is exactly what non-enumerable hides from every rendering.
 *
 * `cause` is required and typed `unknown`. Passing `undefined` still installs the property,
 * which is what keeps the one- and two-argument shapes rendering identically —
 * `tests/error-hygiene.test.ts` constructs error classes at both arities for that reason.
 */
export class ProfileStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the profile store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field is
   itself an own enumerable property, which `Object.keys(err) === []` does not allow. */
Object.defineProperty(ProfileStoreError.prototype, "name", {
  value: "ProfileStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * The archive holds a local vocabulary no reader in this repository accepts.
 *
 * **D-130-10, and the charge behind it is this module's own argument turned on itself.**
 * `http.ts` argues at length that pulling a foreign sealed fault into `withProfileStore`
 * would RELABEL it — naming a store that was working — and `terms.ts` then sealed a
 * *parse* failure as `the profile store failed.` for exactly that reason one layer in, in
 * the same commit. The store answered; what it returned could not be read. A caller told
 * *"Store failed"* is told something false about a component that was working.
 *
 * **Its own `type` at the transport, not `store-failed`**, which is what makes the
 * distinction reach a caller rather than living only in a class name nothing renders.
 *
 * The message carries the operation and nothing else, for the same reason
 * `ProfileStoreError`'s does and with a sharper edge here: the thing on `cause` is
 * `parseOntologyTerms`'s own `Error`, whose message quotes **the offending entry's index
 * and its `kind`** — that is stored content, and stored content is exactly what D-13 keeps
 * out of every enumerable rendering. So the sanitization is load-bearing rather than
 * conventional, and `cause` is where all of it lives.
 *
 * Why 500 rather than a 4xx: the caller did nothing wrong and there is nothing they can
 * change. **The cost of that, measured by T130's adversary rather than estimated: one
 * release in a refused shape makes every profile for that handle answer 500 forever.**
 * That is D-130-07's true price, and it is on the record here rather than only in a thread,
 * because the person who meets this class is reading this file.
 */
export class MalformedStoredVocabularyError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the stored vocabulary could not be read.`, { cause });
  }
}

/* On the prototype, not as an instance field — see `ProfileStoreError` above. */
Object.defineProperty(MalformedStoredVocabularyError.prototype, "name", {
  value: "MalformedStoredVocabularyError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/* ============================================================
   T131 — and now there is a THIRD, because this module finally
   authors a refusal of its own.

   The two above are faults: the store could not answer, or it
   answered with content no reader here accepts. Neither is about
   a CALLER, and until T131 this module had no caller to refuse —
   every absent answer in the published surface was a VALUE
   (D-130-02), which is why `getProfile` returns `undefined`
   rather than raising.

   Three write verbs change that. `setPins`, `toggleFollow` and
   `toggleSupport` all take something a caller supplies and can
   all be handed something the contract does not admit, so there
   is a refusal here that belongs to nobody else. ONE class for
   all four conditions, on T180's precedent — a refusal means fix
   the request and a store fault means try again, and that is the
   distinction a caller actually branches on.
   ============================================================ */

/**
 * Why a write was refused. **`no-such-account` deliberately covers TWO states** — the
 * account does not exist, and it exists but is not this actor's to write — and that is
 * D-130-02's argument one layer along, for writes. A caller able to tell those apart has
 * exactly the existence oracle B-03 closes, and the route answers 404 for both
 * (D-131-07). Collapsing them HERE rather than at the transport is what keeps a future
 * route from leaking the difference by accident: there is nothing for it to leak.
 *
 * A handle that is `null` is the same answer again. An account that has claimed no handle
 * has no profile page, and "no handle" and "no account" are one state to a caller.
 */
export type ProfileRefusedKind =
  | "not-signed-in"
  | "no-such-account"
  | "too-many-pins"
  | "malformed-pin";

/**
 * A write this module refuses, as opposed to a store that could not answer it.
 *
 * **Every message form here is safe by construction, which is what D-13 asks and what makes
 * an exact-match pin writable by a blind author.** Each is the published verb's name, the
 * refusal, and at most a bound this module itself supplies — `MAX_PINS`, a literal. **No
 * caller value is ever interpolated**: not the handle, not the account id, and above all not
 * the pin, whose whole content is a string a caller sent. A refusal that quoted the pin it
 * rejected would put caller data into the one rendering the transport copies verbatim.
 *
 * `kind` is non-enumerable, matching `BallotRefusedError` and the four classes before it:
 * a caller branches on it, and `Object.keys(err)` stays empty so no rendering can carry it
 * into a body by accident.
 */
export class ProfileRefusedError extends Error {
  declare readonly kind: ProfileRefusedKind;

  constructor(kind: ProfileRefusedKind, message: string) {
    super(message);
    Object.defineProperty(this, "kind", { value: kind, enumerable: false, writable: false });
  }
}

/* On the prototype, not as an instance field — see `ProfileStoreError` above. */
Object.defineProperty(ProfileRefusedError.prototype, "name", {
  value: "ProfileRefusedError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * Module-boundary only, and it is worth saying so where somebody will read it:
 * `withSession` answers 401 before any of the three verbs is entered, so **this refusal is
 * unreachable through HTTP** and is reached only by a direct caller. T120's lifecycle
 * errors carry the same note for the same reason. It exists because a module whose
 * anonymous path is "whatever the driver does with `undefined`" is a module with an
 * unstated precondition.
 */
export function notSignedIn(operation: string): ProfileRefusedError {
  return new ProfileRefusedError("not-signed-in", `${operation}: not signed in.`);
}

/** B-03's one answer for three states — absent, handle-less, and not yours. */
export function noSuchAccount(operation: string): ProfileRefusedError {
  return new ProfileRefusedError("no-such-account", `${operation}: no such account.`);
}

/**
 * AC3's published bound. The number is interpolated from this module's own constant rather
 * than written into the sentence twice, so the message cannot disagree with the check.
 */
export function tooManyPins(operation: string, max: number): ProfileRefusedError {
  return new ProfileRefusedError(
    "too-many-pins",
    `${operation}: at most ${max} pins.`,
  );
}

/**
 * The union's own shape, refused without quoting what arrived. **The offending value is on
 * `cause` and never in the message** — `cause` is D-13's sanctioned carrier, and a pin is
 * caller-supplied content in its entirety.
 */
export function malformedPin(operation: string, cause: unknown): ProfileRefusedError {
  const err = new ProfileRefusedError(
    "malformed-pin",
    `${operation}: a pin must be {kind:"blueprint",slug} or {kind:"node",ref}.`,
  );
  Object.defineProperty(err, "cause", { value: cause, enumerable: false, writable: true, configurable: true });
  return err;
}
