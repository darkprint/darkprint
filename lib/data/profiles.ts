/* ============================================================
   DarkPrint data — the profile half of an account, seeded

   `./users.ts` is the author table: who somebody is. This is what a
   profile page says about them that the archive cannot count — when
   they joined, who watches them, and which two things they chose to
   put at the top of their page.

   Every figure here is `◐ seeded` and the surfaces reading it say so.
   What is NOT here is anything countable: how many blueprints, cards
   or vocabulary terms a handle has authored is read off `content/` at
   build time and carries `✓ counted`. The moment a number that the
   engine can count gets seeded instead, the two markers stop being
   worth printing.

   ── Pinned is a choice, not a figure ──
   `pinned` names real things in the archive, so the pinned cards
   render counted content under a seeded *selection*: the fact that
   Sol pinned `guarded-merge-bot` is a preference nobody has stored,
   and everything drawn on the card comes off the bundle. That split
   is why the section can carry `✓ counted` honestly.

   PLAIN DATA: no `@/lib/content`, no filesystem, importable from a
   client component. `./index.ts` is the server-only barrel and does
   not re-export this.
   ============================================================ */

/** One thing a builder put at the top of their profile. Both forms name real archive rows. */
export type PinnedRef =
  | { kind: "blueprint"; slug: string }
  | { kind: "node"; ref: string };

export interface Profile {
  /** ISO date; rendered at month resolution, because nobody needs the day. */
  joinedAt: string;
  /**
   * People following this builder's output. There is no follow, no feed and nothing to
   * notify, so this is a shape rather than a tally, and `Watch` renders switched off.
   */
  watchers: number;
  /**
   * Community support for the person, the same seeded figure `FavoriteStar` prints beside
   * a blueprint. There is no ballot; doc 1 §8 keeps that limit on every surface it shows.
   */
  support: number;
  /**
   * How many OTHER accounts' blueprints this handle downloaded, ran, and submitted a run
   * report for (SEAM-84) that made it onto that blueprint's own evidence layer.
   *
   * Seeded, same limit as `support` and `watchers`: SEAM-84 has no submission form and no
   * endpoint, so nothing here was ever actually run. `EvidenceLayers`' "no verified runs"
   * state is the truth on every blueprint page regardless of what this figure claims about
   * an account — the two are not in tension, because this is what an account WOULD have
   * accrued through a run pipeline that does not exist yet, said with the same `◐` marker
   * as everything else on this account panel.
   */
  validated: number;
  /** At most two, which is what the two-column grid holds. */
  pinned: readonly PinnedRef[];
}

/**
 * Keyed by handle. Every `pinned` entry below resolves in `content/` — a pin at something
 * the archive does not carry renders nothing at all, so
 * `components/profile/tabs.test.ts` holds each one against the archive rather than letting
 * a profile quietly lose its first section.
 */
export const PROFILES: Record<string, Profile> = {
  "mara-veil": {
    joinedAt: "2026-02-11",
    watchers: 12,
    support: 214,
    validated: 6,
    pinned: [
      { kind: "blueprint", slug: "adversarial-consensus-line" },
      { kind: "node", ref: "weighted-vote@1.0.0" },
    ],
  },
  "sol-antczak": {
    joinedAt: "2026-01-19",
    watchers: 3,
    support: 128,
    validated: 9,
    pinned: [
      { kind: "blueprint", slug: "guarded-merge-bot" },
      { kind: "node", ref: "acceptance-verifier@2.0.0" },
    ],
  },
  k0bra: {
    joinedAt: "2026-03-02",
    watchers: 6,
    support: 97,
    validated: 2,
    pinned: [
      { kind: "blueprint", slug: "checkpoint-resume-runner" },
      { kind: "node", ref: "bounded-retry@2.0.0" },
    ],
  },
  orin: {
    joinedAt: "2026-02-27",
    watchers: 9,
    support: 176,
    validated: 4,
    pinned: [
      { kind: "blueprint", slug: "starter-software-factory" },
      { kind: "node", ref: "spec-planner@1.0.0" },
    ],
  },
  lupo: {
    joinedAt: "2026-01-08",
    watchers: 5,
    support: 143,
    validated: 3,
    pinned: [
      { kind: "blueprint", slug: "schema-forge-etl" },
      { kind: "node", ref: "schema-gate@1.1.0" },
    ],
  },
  hachi: {
    joinedAt: "2026-04-16",
    watchers: 2,
    support: 61,
    validated: 1,
    pinned: [
      { kind: "blueprint", slug: "frontline-triage" },
      { kind: "node", ref: "intent-router@2.0.0" },
    ],
  },
};

/** The row for a handle, or an empty profile — a builder nobody has seeded yet. */
export function profileFor(username: string): Profile {
  return (
    PROFILES[username] ?? {
      joinedAt: "2026-01-01",
      watchers: 0,
      support: 0,
      validated: 0,
      pinned: [],
    }
  );
}
