/* ============================================================
   T261 / D-261-10 — the metrics band moves NO honesty markers in
   this cutover, and asserting otherwise would red a correct page.

   D-261-10 landed `blueprintViewOver` on `lib/content/view.ts` as
   the assembled-values projection the canonical page renders
   through, with `toBlueprintView` delegating to it (`view.ts:53`)
   so the six formulas have ONE implementation.

   The ruling that binds a cell here: **four of the six metrics
   STAY seeded** (T160 is todo, so no ballot and no telemetry
   exists to make them real), and only `autonomy` and `security`
   are engine-derived. So this is D-78's STAYS direction, and a
   marker-off assertion over the band would red a correct cutover
   — the D-260-08 shape, one task over.

   ── the thing that would have made this cell wrong ──
   "Four seeded rows" is one sentence and THREE mechanisms, which
   a single assertion would have flattened:

     efficacy, reliability, transparency
         source "community", detail ends "Seeded, no ballot exists."
     cost
         source "reported", and its no-report branch says something
         ELSE entirely — "The figure is a seeded placeholder, not a
         measurement." (`view.ts`'s `reportedDetail`)
     autonomy, security
         source "auto", engine sentences, no marker at all

   A cell asserting `"Seeded, no ballot exists."` across all four
   would red `cost` against a correct implementation. The marker is
   per-row and it is asserted per-row.

   ── driven over the real archive, not a hand-built input ──
   `AssembledViewInput` is assembled by callers, and a fixture
   built field-by-field here could satisfy a projection no writer
   in the system produces — T260's own D-260-24 lesson. So these
   run over `allBlueprints()`: nine real bundles through the real
   delegate.

   ── declared limit, so a green run is not read as more than it is ──
   This drives the ARCHIVE caller. The registry caller hands
   `BlueprintSchematic`'s members to the same function, which is
   exactly D-261-10's point — one implementation, so the six
   formulas asserted here are the six the canonical page renders.
   What this file does NOT do is prove the registry caller passes
   the right inputs. That needs the route and the registry, and it
   is in the DB-window family with AC4 and AC6.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import type { MetricKey, MetricSource } from "@/lib/types";

const BLUEPRINTS = allBlueprints();

/** What each row is, and what makes it honest. Per row, because the mechanisms differ. */
interface Row {
  readonly key: MetricKey;
  readonly source: MetricSource;
  /** A fragment the row's own `detail` must carry, or `undefined` for the engine-derived two. */
  readonly marker?: string;
  readonly why: string;
}

const BAND: readonly Row[] = [
  {
    key: "autonomy",
    source: "auto",
    why: "§8.1's share of the graph that runs unattended — the engine's own reading, real today and real after the cutover. It carries no marker because there is nothing to disclose.",
  },
  {
    key: "efficacy",
    source: "community",
    marker: "Seeded, no ballot exists.",
    why: "would be community-rated task success. T160 is todo, so there is no ballot; the marker STAYS (D-78, stays-direction).",
  },
  {
    key: "reliability",
    source: "community",
    marker: "Seeded, no ballot exists.",
    why: "would be rated across repeated executions. Same absent ballot, same direction.",
  },
  {
    key: "transparency",
    source: "community",
    marker: "Seeded, no ballot exists.",
    why: "would be a vote on documented internal decisions. Same absent ballot, same direction.",
  },
  {
    key: "cost",
    source: "reported",
    marker: "seeded placeholder, not a measurement",
    why: "cost and time are REPORTED by whoever runs the blueprint and never measured here (doc 1 §8). Nothing in this build reports, so the no-report branch fires and says so in its own words — NOT the ballot sentence. A cell reusing that sentence here would red a correct page.",
  },
  {
    key: "security",
    source: "auto",
    why: "§8.2's penalties against a clean 4, clamped. Engine-derived, real, no marker.",
  },
];

describe("D-261-10: the band the projection builds", () => {
  /*
   * The premise. Every cell below iterates the archive, and a walk that came back empty
   * would satisfy all of them at once — the vacuous-green this suite refuses at file level
   * everywhere else.
   */
  it("runs over the nine archive bundles", () => {
    expect(BLUEPRINTS.length, "the archive walk returned nothing; every case below is vacuous")
      .toBe(9);
    for (const bp of BLUEPRINTS) {
      expect(bp.metrics.length, `${bp.slug} has no metrics band`).toBe(BAND.length);
    }
  });

  it("has exactly the six keys, in the projection's own order", () => {
    for (const bp of BLUEPRINTS) {
      expect(bp.metrics.map((m) => m.key), bp.slug).toEqual(BAND.map((row) => row.key));
    }
  });
});

describe("D-78 stays-direction: four rows keep their marker", () => {
  it.each(BAND.filter((row) => row.marker !== undefined))(
    "$key stays $source and says so",
    ({ key, source, marker, why }) => {
      for (const bp of BLUEPRINTS) {
        const row = bp.metrics.find((m) => m.key === key);
        expect(row, `${bp.slug} dropped the ${key} row`).toBeDefined();

        expect(
          row?.source,
          `${bp.slug}: ${key} is now sourced "${row?.source}" rather than "${source}".\n\n` +
            `${why}\n\n` +
            `D-261-10 rules the metrics band moves NO markers in this cutover. If this row ` +
            `became real, the thing that made it real has to exist — and T160 is todo.`,
        ).toBe(source);

        expect(
          row?.detail,
          `${bp.slug}: the ${key} row no longer discloses that its figure is seeded.\n\n` +
            `${why}\n\n` +
            `Removed early is a false claim (D-78). The figure did not become real; only ` +
            `autonomy and security are engine-derived.`,
        ).toContain(marker);
      }
    },
  );
});

describe("and the two that are real carry no marker", () => {
  /*
   * The control. Without it every cell above is satisfiable by a band where all six rows
   * are seeded, which is the opposite error and just as dishonest: a marker over a figure
   * that IS real is a page apologising for its own engine.
   */
  it.each(BAND.filter((row) => row.marker === undefined))("$key is engine-derived", ({ key, source, why }) => {
    for (const bp of BLUEPRINTS) {
      const row = bp.metrics.find((m) => m.key === key);
      expect(row?.source, `${bp.slug}: ${key} — ${why}`).toBe(source);
      expect(
        row?.detail,
        `${bp.slug}: the ${key} row now calls itself seeded. It is the engine's own reading ` +
          `and always has been — a marker over a real figure is the false direction of D-78, ` +
          `and it tells a reader the one number on this band they can trust is guesswork.`,
      ).not.toContain("Seeded, no ballot exists.");
    }
  });

  it("exactly two of the six are engine-derived", () => {
    // A count, held BESIDE the per-row cells rather than instead of them: it is what fails
    // if a seeded row is quietly promoted while another is quietly demoted to compensate.
    for (const bp of BLUEPRINTS) {
      expect(
        bp.metrics.filter((m) => m.source === "auto").map((m) => m.key),
        `${bp.slug}: the set of engine-derived metrics changed`,
      ).toEqual(["autonomy", "security"]);
    }
  });
});
