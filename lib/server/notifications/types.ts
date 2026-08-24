/* ============================================================
   DarkPrint backend — notifications: the published shapes
   T190's Published signatures block. `EventKind` and `Preferences`
   are the block's own; `NotificationDelivery` is D-190-03's seam.

   These are declared here rather than re-exported from `lib/core`
   because none of them is an engine shape: a preference is a
   registry account's setting and an event kind is a thing the
   platform does, neither of which `lib/core` knows about.
   ============================================================ */

/**
 * The four events, keyed by the ids `lib/data/account.ts:92-117` seeds.
 *
 * Those ids are the specification and are consumed rather than paraphrased: `repin`,
 * `fork`, `deprecation`, `digest` are the `id` fields of that fixture's four rows, and the
 * `notification_kind` enum in `lib/db/schema.ts` carries the same four labels in the same
 * order.
 */
export type EventKind = "repin" | "fork" | "deprecation" | "digest";

/**
 * Every kind, as a value, so a reader can iterate the union rather than restating it.
 *
 * Derived from a `Record<EventKind, true>` rather than written as an array, and the difference
 * is that the type system checks COMPLETENESS: a plain `readonly EventKind[]` accepts a list
 * missing a member, so a fifth kind added to the union above would leave every loop in this
 * module silently skipping it — `fillPreferences` would stop filling it, `setPreferences` would
 * stop writing it, and nothing would red. The record reds at `tsc` instead.
 */
const ALL_KINDS: Record<EventKind, true> = { repin: true, fork: true, deprecation: true, digest: true };

/** Declaration order, matching `lib/data/account.ts:92-117` and the `notification_kind` enum. */
export const EVENT_KINDS = Object.keys(ALL_KINDS) as readonly EventKind[];

/**
 * The four booleans an account holds, always all four.
 *
 * Total rather than partial on purpose: `account.notification_preferences` is `jsonb NOT
 * NULL DEFAULT '{}'`, so the STORED value is routinely missing keys, and `getPreferences`
 * filling from `DEFAULT_PREFERENCES` is what turns a partial column into this. A missing key
 * must never read as `true` anywhere (AC4), which a total type is what makes structural.
 */
export interface Preferences {
  repin: boolean;
  fork: boolean;
  deprecation: boolean;
  digest: boolean;
}

/**
 * The mailer, as a seam (D-190-01, D-190-03). **Nothing in this repository sends email.**
 *
 * `send` takes an `accountId` and never an address, and that is the whole point of the
 * shape: a real implementation resolves the address itself, so no email address is ever in
 * scope inside this module — which makes "no email address appears in any error message" a
 * property of what this code can reach rather than a rule somebody has to remember while
 * writing a rejection. The section's admissible forms stay closed by construction.
 *
 * `unsubscribeToken` is on every message because AC6 says every email carries a working
 * unsubscribe. It is the opaque token, never the account id and never the kind's meaning —
 * `unsubscribe_token` is the only thing that resolves it.
 */
export interface NotificationDelivery {
  send(message: {
    kind: EventKind;
    accountId: string;
    subject: Record<string, string>;
    unsubscribeToken: string;
  }): Promise<void>;
}

/** What `enqueue` is handed: the kind, who it is for, and the subject the digest is taken over. */
export interface NotificationEvent {
  kind: EventKind;
  accountId: string;
  subject: Record<string, string>;
}
