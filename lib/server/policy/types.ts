/* ============================================================
   DarkPrint backend — authorization policy types
   T060's published signature, restated rather than imported: this
   module is pure (no I/O, no `lib/db`, no `lib/server/http`), so
   `Actor`/`Resource` are self-contained shapes rather than aliases
   onto another task's row types.
   ============================================================ */

/** The three read contexts the contract requires be distinguishable: anonymous, signed-in visitor, owner — plus the break-glass operator (B-13). */
export type Actor =
  | { kind: "anonymous" }
  | { kind: "account"; accountId: string; handle: string | null }
  | { kind: "operator"; accountId: string };

export type Resource =
  | { kind: "bundle"; ownerId: string; visibility: "public" | "private" }
  | { kind: "card"; ownerId: string; visibility: "public" | "private" }
  | { kind: "save"; ownerId: string }
  | { kind: "note"; authorId: string }
  | { kind: "account"; accountId: string };

export type Action = "read" | "write" | "delete" | "publish" | "transfer";
