/* ============================================================
   DarkPrint backend — the one refusal lib/server/auth authors
   The write-key guard reads the api_key table, and a driver fault
   there must not reach a caller as a DrizzleQueryError whose
   message opens with the query and the bearer secret. It is
   re-raised as this class, which carries the operation and keeps
   the driver error on `cause`, non-enumerable, so a rendering of
   the error shows nothing but the operation.
   ============================================================ */

export class AuthStoreError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`${operation}: the auth store failed.`, { cause });
  }
}

Object.defineProperty(AuthStoreError.prototype, "name", {
  value: "AuthStoreError",
  enumerable: false,
  writable: true,
  configurable: true,
});
