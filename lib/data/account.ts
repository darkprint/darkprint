/* ============================================================
   DarkPrint data — the signed-in account, seeded

   There are no accounts. `PROJECT.md` §2 says so in as many words
   and `README.md` lists them under "Not built". This module is the
   row an account would be, so the surfaces that describe one have
   something real to render instead of a placeholder: the same
   arrangement `./community.ts` makes for votes and `./users.ts`
   makes for the author table.

   **Everything here is `◐ seeded`, and every surface reading it
   says so in place.** Nothing writes back. `/settings` renders these
   values into an inert form and states, above the first field, that
   the form is inert — a control that appears to save and does not is
   the exact failure doc 2 §0.4 exists to prevent.

   PLAIN DATA, like its two siblings: no `@/lib/content`, no
   filesystem, importable from a client component. `./index.ts` is
   the server-only barrel and deliberately does not re-export this,
   so a client surface can take the account without pulling the
   archive reader in behind it.

   What is NOT here, on purpose: anything the archive already knows.
   How many blueprints and cards a handle has authored is counted off
   `content/` at build time by the page that prints it, and carries
   `✓ counted` rather than `◐ seeded`. Seeding a figure the engine can
   count is how the two markers stop meaning anything.
   ============================================================ */

import type { Author } from "@/lib/types";
import { AUTHORS } from "./users";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-103) (cited at line 87): POST /internal/events/card-published → fan-out
// TODO(SEAM-104) (cited at line 93): fan-out from SEAM-70
// TODO(SEAM-105) (cited at line 98): fan-out from an ontology release
// TODO(SEAM-106) (cited at line 103): scheduled job

/** One row of §03's notification list: what would be sent, and whether it would be. */
export interface NotificationSetting {
  /** Stable key. Also the `id` the row's label is bound to. */
  id: string;
  /** The event, as a reader would describe it. */
  title: string;
  /** Why it is on or off by default. One line. */
  note: string;
  on: boolean;
}

/** The account the signed-in surfaces render. */
export interface Account {
  /** The author record behind it — display name, handle, hue and validator flag. */
  author: Author;
  /**
   * Never rendered on a public surface. It is the one field on `/settings` a visitor
   * could not already read off the profile, which is why §03 says so beside it.
   */
  email: string;
  /** ISO date; rendered at month resolution by `monthYear`. */
  joinedAt: string;
  /**
   * When the validator badge was granted, on the accounts the badge sits on.
   *
   * Absent for a non-validator. The badge is a preview either way: validator voting is
   * not built, so `weight` below describes a design and never a number anything applies.
   */
  validatorSince?: string;
  /** The multiplier a validator's vote would carry, if there were a ballot. */
  validatorWeight: number;
  /** What a new bundle would default to. Per-bundle and overridable, per §04. */
  defaultVisibility: "public" | "private";
  notifications: readonly NotificationSetting[];
}

/**
 * The one account every signed-in surface renders, seeded as Mara Veiga.
 *
 * Singular rather than a table keyed by handle: there is no session, so "the signed-in
 * account" has exactly one answer this pass, and a lookup would imply a switch nothing
 * can flip. The design's own screens are drawn as `mara-veil`, and she is a validator,
 * which is what makes §05's preview visible at all.
 */
export const ACCOUNT: Account = {
  author: AUTHORS.mara,
  email: "mara@veiga.dev",
  joinedAt: "2026-02-11",
  validatorSince: "2026-03-04",
  validatorWeight: 3,
  /* Private, and the copy in §04 recommends it. A bundle you started from somebody
     else's is not announced to them until you decide it should be. */
  defaultVisibility: "private",
  notifications: [
    {
      id: "repin",
      title: "A card you pinned publishes a new version",
      note: "The one notification a version-pinned registry genuinely needs.",
      on: true,
    },
    {
      id: "fork",
      title: "Someone forks a blueprint you published",
      note: "Public forks only. A private fork is never announced to the upstream author.",
      on: true,
    },
    {
      id: "deprecation",
      title: "A term you authored is deprecated in the core ontology",
      note: "Comes with the pointer to whatever supersedes it.",
      on: true,
    },
    {
      id: "digest",
      title: "Weekly digest of new blueprints",
      note: "Off by default. The registry is small enough to browse.",
      on: false,
    },
  ],
};
