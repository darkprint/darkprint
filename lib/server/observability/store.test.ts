/* ============================================================
   DarkPrint backend — observability: the store boundary
   What crosses `withStore` is a value, this module's own refusal,
   or an `AuditStoreError` naming the operation. These cells cover
   all three arms plus the one that exists for a call graph that
   does not exist yet.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { AuditStoreError, NotPermittedError } from "./errors";
import { withStore } from "./store";

describe("withStore", () => {
  it("returns the value when nothing throws", async () => {
    await expect(withStore("listAudit", async () => 41 + 1)).resolves.toBe(42);
  });

  /**
   * The decision arm. Sealing this would replace "not the operator" — an answer a caller
   * can act on — with a store fault, and AC5's whole point is that a refusal and a fault
   * must not read alike. Asserted as identity: the class that came out is the instance
   * that went in, so a wrapper that re-minted an equivalent one would still red.
   */
  it("lets the refusal through unwrapped and unreplaced", async () => {
    const refusal = new NotPermittedError();
    const thrown = await withStore("listAudit", async () => {
      throw refusal;
    }).catch((err: unknown) => err);
    expect(thrown).toBe(refusal);
    expect(thrown).not.toBeInstanceOf(AuditStoreError);
  });

  it("seals an arbitrary fault as this operation's store error", async () => {
    const thrown = await withStore("writeAudit", async () => {
      throw new Error('Failed query: insert into "audit" -- params: dp_live_s3cr3t');
    }).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(AuditStoreError);
    expect((thrown as AuditStoreError).message).toBe("writeAudit: the audit store failed.");
    expect(JSON.stringify(thrown)).toBe("{}");
    expect(String(thrown)).not.toContain("dp_live_s3cr3t");
  });

  /** A throw that is not an `Error` at all still must not reach a caller raw. */
  it("seals a non-Error throw", async () => {
    const thrown = await withStore("writeAudit", async () => {
      throw "dp_live_s3cr3t";
    }).catch((err: unknown) => err);
    expect(thrown).toBeInstanceOf(AuditStoreError);
    expect((thrown as AuditStoreError).message).toBe("writeAudit: the audit store failed.");
  });

  /**
   * The already-sealed arm. A sanitizer applied twice does not sanitize twice, it
   * RELABELS: without this arm the outer call renames the operation, so a rendering
   * would name a reader that was still working. The cell asserts the INNER operation
   * survives — asserting only `instanceof AuditStoreError` would pass under the defect.
   */
  it("does not relabel an error that is already sealed", async () => {
    const inner = new AuditStoreError("writeAudit", undefined);
    const thrown = await withStore("listAudit", async () => {
      throw inner;
    }).catch((err: unknown) => err);
    expect(thrown).toBe(inner);
    expect((thrown as AuditStoreError).message).toBe("writeAudit: the audit store failed.");
    expect((thrown as AuditStoreError).message).not.toContain("listAudit");
  });
});
