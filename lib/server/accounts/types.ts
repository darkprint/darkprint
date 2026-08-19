/* ============================================================
   DarkPrint backend — accounts: the two record shapes
   T050's published signatures, and the split between them is
   AC2's whole mechanism rather than a naming choice.

   "`email` is absent from every response a non-owner can obtain"
   is unachievable by remembering to omit it — one forgotten call
   site and it ships. So `PublicAuthor` **has no `email` field at
   all** and is the only shape any non-owner path returns, while
   `AccountRecord` carries one and is reachable only through
   `getAccount`, which takes an `Actor`. The criterion holds
   structurally, and the test that matters asserts the **key set**
   a visitor receives rather than the value of one field.

   Which is why the optional fields here are optional rather than
   nullable, and why that distinction is load-bearing (D-50-09):
   **an absent value omits the key.** A record built as
   `{ bio: undefined }` has the key in the object a unit test
   inspects and NOT on the wire, because `Response.json` drops an
   `undefined` value — so an object-level and a wire-level key-set
   assertion would disagree about the same response. `records.ts`
   builds these absent, and the two readings agree.
   ============================================================ */

/**
 * What every non-owner surface receives. No `email`, by construction.
 *
 * `handle` is nullable (D-50-06) because AC1 rules a handle-less account legal and
 * `getAccount` has to be able to describe one. The narrower guarantee is the caller's
 * to know rather than the type's: `getPublicAuthor` is **keyed by** handle, so a
 * record it returns can never carry a null one, and the nullability is reachable only
 * through `getAccount().author`.
 */
export interface PublicAuthor {
  handle: string | null;
  displayName: string | null;
  avatarHue: number | null;
  validator: boolean;
  /** Omitted when the account has no bio — never `null`, never present-and-undefined. */
  bio?: string;
}

/** The owner's own view. Reachable only through `getAccount`, which takes an `Actor`. */
export interface AccountRecord {
  accountId: string;
  author: PublicAuthor;
  email: string | null;
  joinedAt: Date;
  /** Omitted for a non-validator. */
  validatorSince?: Date;
  validatorWeight: number;
  defaultVisibility: "public" | "private";
}
