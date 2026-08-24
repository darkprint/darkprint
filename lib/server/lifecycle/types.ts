/* ============================================================
   DarkPrint backend — lifecycle: the two published plan shapes
   Both are copied from T120's Published signatures block key for
   key, and neither gains a field: an added key reds an exact
   key-set pin against a correct module (D-180-01's reading (ii),
   refused there for the same reason).

   The block is stamped `checked against backend at 912666e` and
   base has moved through many merges since, so every type these
   two compose was re-read against the TREE rather than taken from
   the block — `Actor` from `@/lib/server/policy`, `BundleRecord`
   from `@/lib/server/archive`, `Db` from `@/lib/db`. All three
   agree with the block as written.
   ============================================================ */

/**
 * What `planTransfer` reports without writing anything.
 *
 * The two `plan*` verbs exist because AC3 refuses "before anything moves", and a criterion
 * about ordering needs a surface that can be observed without performing the act. So this
 * carries `collides` as a value rather than as a rejection: a caller can see the refusal
 * coming AND see that nothing moved, instead of inferring atomicity from an error.
 *
 * `collides` is one bit about another account's namespace, and it discloses nothing new:
 * `GET /api/names/slugs/[owner]/[slug]` is unauthenticated, merged, and already answers
 * `taken` for any handle and slug including a private bundle's. The block's *"Nothing
 * enumerates what the recipient holds"* survives because this is the same bit, not because
 * the bit is secret.
 */
export interface TransferPlan {
  bundleId: string;
  fromAccountId: string;
  toAccountId: string;
  /** The bundle's own slug, which is what moves into the recipient's namespace (B-09). */
  slug: string;
  collides: boolean;
}

/**
 * What `planDeletion` reports without destroying anything.
 *
 * Four figures rather than three (D-120-09) because AC6 is the one irreversible operation in
 * the registry: a plan that cannot distinguish what dies from what stays cannot be reviewed
 * before it runs, and AC5 is a property about *cards* while AC6 is about bundles and cards
 * both — so the unsplit `publishedRetained` was the one figure that could not be read against
 * either criterion. The four PARTITION the account's holdings: every bundle it owns is in
 * `privateBundles` or `publishedBundles`, every card version in `privateCards` or
 * `publishedCards`, and nothing is in two.
 *
 * **The two `private*` figures are what dies, and their predicate is NOT `visibility`**
 * (D-120-11). A card survives when some published release that itself survives pins it,
 * whatever the card's own column says — the product's own writer produces a public release
 * pinning a private card by byte-reuse at publish, and that card's bytes are already public
 * through that release. AC5 wins over AC6 there, so `privateCards` counts private cards *no
 * surviving published release reaches*.
 *
 * **Not the settings page's number.** `app/settings/page.tsx:220` computes `published` as
 * `(await blueprints(db, actor)).length` — the whole visible registry, not this account — and
 * renders it as *"{published} bundles in the registry would stop resolving."* Recorded here
 * because the two are a paragraph apart in the copy this section consumes as its spec
 * (D-120-09).
 */
export interface DeletionPlan {
  accountId: string;
  /**
   * `string | null`, per D-120-08, because `account.handle` is nullable and `schema.ts` says
   * why: a first sign-in reaches the row before a handle is chosen, and T050's AC1 rules such
   * a session signed in and *incomplete* rather than impossible. `null` is not a defect to
   * repair — it is an account with no reservation to release, so AC4 is vacuous for it and
   * `deleteAccount` skips `releaseHandle`. `""` was the alternative and it is the one value
   * that makes AC4's own delegated call throw `InvalidNameError`, another module's class, at
   * `naming/handles.ts:181`.
   */
  handle: string | null;
  privateBundles: number;
  privateCards: number;
  publishedBundles: number;
  publishedCards: number;
}
