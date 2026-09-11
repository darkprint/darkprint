/* ============================================================
   DarkPrint backend — observability: the two rejection classes,
   held to D-13's hygiene clause from the day they ship
   `tests/error-hygiene.test.ts` walks every barrel on `backend`,
   so this module is checked for hygiene there but does NOT move
   that guard's equality until its merge commit. These cells are
   what stands in the meantime — and they assert the clause on the
   RENDERINGS as well as on enumerability, because a class can
   satisfy `Object.keys(err) === []` while its `message` carries
   the statement.

   Every expected message is typed as a literal rather than
   imported from the module under test. A test that imports its
   expectation asserts that the module agrees with itself, and
   goes on passing the day the wording starts interpolating
   something it should not.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { AuditStoreError, NotPermittedError } from "./errors";

/** The shape `drizzle-orm` actually raises: the statement and every bound value, enumerable. */
function driverError(): Error & { query: string; params: unknown[] } {
  const err = new Error(
    'Failed query: insert into "audit" ("actor_id", "action", "detail") values ($1, $2, $3) ' +
      "-- params: 9f3c1d20-0000-4000-8000-000000000000,key.issue,{\"secret\":\"dp_live_s3cr3t\"}",
  ) as Error & { query: string; params: unknown[] };
  err.query = 'insert into "audit" ("actor_id", "action", "detail") values ($1, $2, $3)';
  err.params = ["9f3c1d20-0000-4000-8000-000000000000", "key.issue", { secret: "dp_live_s3cr3t" }];
  return err;
}

describe("AuditStoreError", () => {
  it("renders the operation and nothing else", () => {
    const err = new AuditStoreError("writeAudit", driverError());
    expect(err.message).toBe("writeAudit: the audit store failed.");
  });

  /**
   * The discriminating cell. A rendering that merely *starts* with the right sentence
   * satisfies a `toContain` and still ships the statement, so this excludes the bad
   * output rather than admitting the good one: the driver's message, its statement, its
   * bound uuid and the credential inside `detail` must all be absent from every
   * rendering a caller can reach without asking for `cause`.
   */
  it("leaks neither the statement, nor a bound parameter, nor the detail payload", () => {
    const err = new AuditStoreError("writeAudit", driverError());
    for (const rendering of [err.message, String(err), JSON.stringify(err), `${err}`]) {
      expect(rendering).not.toContain("insert into");
      expect(rendering).not.toContain("9f3c1d20");
      expect(rendering).not.toContain("dp_live_s3cr3t");
      expect(rendering).not.toContain("params");
    }
  });

  it("keeps the driver error on cause, non-enumerably", () => {
    const cause = driverError();
    const err = new AuditStoreError("writeAudit", cause);
    expect(err.cause).toBe(cause);
    expect(Object.keys(err)).toEqual([]);
    expect(Object.propertyIsEnumerable.call(err, "cause")).toBe(false);
    expect(JSON.stringify(err)).toBe("{}");
  });

  /**
   * Passing `undefined` still INSTALLS `cause` — the spec installs on `HasProperty`
   * rather than on the value — so the one- and two-argument shapes must render
   * identically. Constructed at both arities for exactly that reason.
   */
  it("renders identically whether or not a cause was passed", () => {
    const withCause = new AuditStoreError("listAudit", driverError());
    const without = new AuditStoreError("listAudit", undefined);
    expect(without.message).toBe(withCause.message);
    expect(Object.keys(without)).toEqual(Object.keys(withCause));
    expect(JSON.stringify(without)).toBe(JSON.stringify(withCause));
    expect(Object.hasOwn(without, "cause")).toBe(true);
  });

  it("carries its name on the prototype and a retained stack", () => {
    const err = new AuditStoreError("writeAudit", undefined);
    expect(err.name).toBe("AuditStoreError");
    expect(Object.hasOwn(err, "name")).toBe(false);
    expect(typeof err.stack).toBe("string");
    expect(err.stack).not.toBe("");
  });

  /**
   * `for...in` rather than `Object.keys`, and the difference is the whole cell.
   *
   * D-13's hygiene clause is written as *`Object.keys` empty, `JSON.stringify(err)`
   * exactly `"{}"`* — and **both read only OWN properties**. Flipping this class's
   * prototype `name` to `enumerable: true` leaves each of them unchanged and is
   * invisible to every other cell in this file: measured, that mutation reds **zero**.
   * `for...in` walks the prototype chain, so it is the one reading under which the
   * `enumerable: false` this module writes is load-bearing rather than decorative.
   *
   * This is the inverse of the known hazard: there, a non-enumerable property evaded a
   * leak walker; here, an own-only walker misses an inherited one it should have seen.
   */
  it("exposes nothing to a walker that follows the prototype chain", () => {
    const keys: string[] = [];
    for (const key in new AuditStoreError("writeAudit", driverError())) keys.push(key);
    expect(keys).toEqual([]);
  });
});

describe("NotPermittedError", () => {
  it("is exactly the published sentence", () => {
    expect(new NotPermittedError().message).toBe("listAudit: not permitted.");
  });

  /**
   * Structural, not editorial. The block forbids the refusal naming the target, and a
   * parameter that exists is a parameter somebody interpolates later — so the guard is
   * that the constructor **takes nothing to interpolate**. `Function.length` counts
   * declared parameters at runtime, where a `?` would erase and a default would not
   * count, so this reds if anyone adds one.
   */
  it("takes no argument, so there is no target to interpolate", () => {
    expect(NotPermittedError.length).toBe(0);
  });

  it("holds D-13's hygiene clause", () => {
    const err = new NotPermittedError();
    expect(err.name).toBe("NotPermittedError");
    expect(Object.hasOwn(err, "name")).toBe(false);
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(typeof err.stack).toBe("string");
    expect(err.stack).not.toBe("");
    const keys: string[] = [];
    for (const key in err) keys.push(key);
    expect(keys).toEqual([]);
  });
});
