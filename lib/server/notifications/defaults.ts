/* ============================================================
   DarkPrint backend — notifications: the default four
   AC4's "off by default" is a fact about the DEFAULT, and the
   column defaults to `{}` rather than to four booleans. So the
   defaults live here, in one published constant, and
   `getPreferences` fills from it.
   ============================================================ */

import type { Preferences } from "./types";

/**
 * The four defaults, from `lib/data/account.ts:92-117`.
 *
 * **Hand-written, citing that fixture rather than importing it** (D-190-05). No module under
 * `lib/server` imports `@/lib/data` — zero of twenty-nine — and the layering is not the only
 * reason: `ACCOUNT.notifications` is one person's SAVED SETTINGS, and reading Mara's `on`
 * flags as the system's defaults would make every future edit to a frontend fixture a silent
 * change to what a new account is subscribed to.
 *
 * What the fixture fixes is the RULE, in its own notes. `digest` carries "Off by default. The
 * registry is small enough to browse." — the one default stated as a default, and the one
 * AC4 names. The other three carry no such note and are seeded on, which is what they are
 * here.
 *
 * A test may import `@/lib/data` (four suites do) and compare this constant against that
 * fixture. That comparison is a genuine second axis precisely because this constant is a
 * copy: derived from the fixture, it would agree with itself.
 *
 * **A missing key must not read as `true` anywhere** (AC4). Nothing in this module writes
 * `stored[kind] ?? true`; every read goes through `fillPreferences`, which reads its
 * fallback from this object per key.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  repin: true,
  fork: true,
  deprecation: true,
  digest: false,
};
