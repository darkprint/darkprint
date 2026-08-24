/* ============================================================
   DarkPrint backend — lib/server/runs typed refusals
   D-13: no rejection may carry the failed statement or its bound
   parameters, and on this module that is not
   optional-by-construction. Every statement below binds a
   `release_digest` and the insert binds an `account_id`, a `model`
   and a submitted `cost_units` as well — so a `DrizzleQueryError`
   raised by any of them renders the acting account and the
   caller's whole report into its own message. The store class is
   what stands between those values and a caller.

   ── TWO classes, which is what the wave's equality moves by ──
   `<Module>StoreError` for the sealed fault, and ONE refusal for
   every caller error this module authors.

   ── The store class's noun is NOT the module's, and that is
      deliberate ──
   The shipped convention derives the noun from the module folder,
   and D-WAVE-12 ruled the SINGULAR form for T150: `counters` ->
   `` `<operation>: the counter store failed.` ``. Followed
   mechanically that gives `runs` -> *the run store failed*, and
   **this is the one module in the tree where that phrase is
   forbidden.** The registry holds the bundle and who owns it, and
   not *"a run, a key, or any telemetry about either"*
   (`components/bundle/Aside.tsx:33-36`) — a class whose message
   announces a *run store* names the exact thing the product says
   it does not have, on the surface a caller is most likely to
   paste into an issue. What this module stores is a run REPORT: a
   claim submitted by whoever ran the thing, never the run.

   So the noun is `run report`, singular per D-WAVE-12, and the
   deviation from the folder name is charged to the orchestrator
   rather than taken quietly.

   ── ONE refusal class, TWO messages, and that is ruled ──
   D-180-04: a malformed report and an unknown digest are **both
   caller errors and neither is a store fault**, so both are
   `RunReportRefusedError`. A caller distinguishing them by
   `instanceof` would be distinguishing two things it must handle
   identically. D-180-03 adds the third message on the same class
   for the same reason: an anonymous submitter is a caller error
   too.

   ── Why a refusal exists at all ──
   D-140-02's argument. `submitReport` returns `Promise<void>`, and
   `void` cannot express *denied*: a write that silently does
   nothing tells its caller the report was accepted, which is a
   write failing silently rather than a read declining to
   distinguish. `reportedCost` needs no refusal for the mirror
   reason — it answers `undefined` for a digest with nothing to
   report, and that is a value rather than a decision.

   ── Why the anonymous refusal is minted here rather than consumed
      ──
   `NotSignedInError` (`@/lib/server/counters`) is the same sentence
   and is unusable in fact: `lib/server/counters/**` is Forbidden to
   this task, and re-exporting or importing another module's
   rejection under this module's name is what D-50-08 forbids and
   what would count the class twice in
   `tests/error-hygiene.test.ts`'s walk. `NotAccountOwnerError`
   (`@/lib/server/accounts`) is an OWNERSHIP answer and this is not
   that — a run report has no owner and the thing refused is acting
   at all without a session. `NotPermittedError`
   (`@/lib/server/observability`) hardcodes `listAudit:` into its
   message, which is what makes it that module's own.

   ── The message forms, which are RULED and not derived ──
   D-180-03: `` `submitReport: a run report needs an account.` ``
   D-180-04: `` `submitReport: the run report is malformed.` ``
   The section's own block: ``
   `submitReport: no release at digest `<digest>`.` ``

   The digest one is the single place in this module where a
   caller's own VALUE is interpolated, and it is admissible because
   the block says so and because the value is the caller's own
   input coming straight back. D-140-06 otherwise admits the
   operation and the caller's own FIELD NAME and never a caller's
   own value — which is why the malformed message names no field.

   None of the constants is exported. A test importing its expected
   message from the module under test asserts that the module
   agrees with itself, and goes on passing the day the wording
   starts interpolating something it should not.
   ============================================================ */

/**
 * A `run_report` read or write against Postgres failed.
 *
 * `message` is `` `${operation}: the run report store failed.` `` and nothing else. The
 * driver error travels on `cause`, which carries the statement, the bound `release_digest`,
 * the bound `account_id`, the submitted `cost_units` and the SQLSTATE — all of it, and all
 * of it non-enumerable.
 *
 * `cause` is required and passed through the ES2022 option, so the property is installed
 * non-enumerably by the language rather than by anyone remembering `Object.defineProperty`.
 * Passing `undefined` still installs it, which is what keeps the one- and two-argument
 * shapes rendering identically — `tests/error-hygiene.test.ts` constructs at both arities
 * for exactly that reason.
 */
export class RunReportStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the run report store failed.`, { cause });
  }
}

/* On the prototype, not as an instance field: a `readonly name = "..."` class field would
   itself be an own enumerable property, which `Object.keys(err) === []` does not allow
   (`tests/error-hygiene.test.ts`, D-13's hygiene clause). */
Object.defineProperty(RunReportStoreError.prototype, "name", {
  value: "RunReportStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/**
 * `submitReport` declined the report, and nothing was written.
 *
 * **One class for all three refusals** (D-180-03, D-180-04). They are caller errors and
 * none of them is a store fault, and a caller telling them apart by `instanceof` would be
 * telling apart two things it must handle identically — fix the request and send it again.
 *
 * The message is supplied whole by the call site rather than assembled from parts here. A
 * constructor that took a digest, a field name or a reason would be a constructor somebody
 * later interpolates an account id into; taking the finished sentence keeps the three
 * admissible forms in one file where they can be read together, and keeps this class unable
 * to render anything nobody wrote down.
 */
export class RunReportRefusedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

Object.defineProperty(RunReportRefusedError.prototype, "name", {
  value: "RunReportRefusedError",
  enumerable: false,
  writable: true,
  configurable: true,
});

/* --------------------- the three admissible renderings --------------------- */

/**
 * D-180-03. Raised **before** the write, so no caller ever sees a constraint violation.
 *
 * `Actor`'s `anonymous` member carries no `accountId` while `run_report.account_id` is
 * `NOT NULL`, so the state is structurally unstorable and the database would refuse it as a
 * driver fault — which D-13 forbids surfacing as a store failure. The rendering names the
 * operation and nothing else: no digest, no claimed account id.
 */
export function refusedForNoAccount(): RunReportRefusedError {
  return new RunReportRefusedError("submitReport: a run report needs an account.");
}

/**
 * D-180-04, AC1's well-formedness half.
 *
 * **Names no field.** D-140-06 admits a caller's own field name, and this message declines
 * even that: the malformed-ness is structural and a caller sending a report it built itself
 * has the whole report in hand. A field name here would be one more string a later editor
 * interpolates a value beside.
 */
export function refusedAsMalformed(): RunReportRefusedError {
  return new RunReportRefusedError("submitReport: the run report is malformed.");
}

/**
 * AC1's digest half, in the section's own published form.
 *
 * The caller's own digest and nothing else. This is the one interpolation in the module and
 * it is admissible because the value is the caller's own input handed straight back — it
 * tells a submitter nothing it did not already type, and in particular it is not an
 * existence oracle for anything, because a digest is content-addressed and names no owner.
 */
export function refusedForUnknownDigest(digest: string): RunReportRefusedError {
  return new RunReportRefusedError(`submitReport: no release at digest \`${digest}\`.`);
}
