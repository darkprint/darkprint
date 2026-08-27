/* ============================================================
   T071 AC5 — every handle in the archive still validates

     "(5) every handle in the archive still validates, measured over
      `content/` rather than asserted — the longest is 11"

   ── "measured rather than asserted" is the whole instruction ──
   So no list of names appears in this file. A cell holding
   `["hachi", "k0bra", …]` is green the day somebody adds a
   seventh author with a name this bound refuses, and it is green
   forever after, because the list it checks is its own.

   What IS recorded, because it is a premise and not an assertion:
   walked on `66f502a`, `content/` carried 66 `author:` lines over 6
   distinct values, the longest of them 11 characters — which is the
   figure the contract states, arrived at independently. The floors
   below are set from that measurement so a walk that lost the
   archive reds rather than passing over an empty set.

   ── the carrier is `author`, and that was checked ──
   `lib/core/card/schema.ts:154` and `lib/core/bundle/types.ts:26`
   both declare `author?: string`, and it is the only handle-shaped
   field on either. Enumerated by what the loader reads rather than
   by what a grep spells.

   ── a reader that cannot see a form must RED, not skip ──
   A regular expression over YAML answers "absent" for every shape it
   was not written for — a quoted value, a different case, a folded
   scalar — and an absence is indistinguishable from a clean archive.
   So the walk counts the raw `author:` lines and the values it
   managed to read, and requires the two to be EQUAL. A form this
   file cannot parse reds as a form this file cannot parse.

   ── and the validation goes through the published door ──
   `checkHandle` against an empty scratch database, which is what a
   handle "validating" means to every caller: `{ available: true }`.
   A pure length comparison here would be this file agreeing with
   itself about a bound the module might not share.
   ============================================================ */

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { availableNow, bind } from "./contract";
import { authorsIn } from "./sources";
import { MAX_HANDLE_LENGTH, clean, closeDatabase, db, openDatabase } from "./fixtures";

const CONTENT = fileURLToPath(new URL("../../../content/", import.meta.url));

/* Measured at `66f502a`: 66 lines, 6 distinct, longest 11. The floors sit under those so a walk
   that lost the archive — a moved directory, a renamed extension — reds instead of quantifying
   over nothing. They are lower bounds and the archive is expected to grow past them. */
const AUTHOR_LINE_FLOOR = 40;
const DISTINCT_HANDLE_FLOOR = 6;

function yamlFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // reported by the premise cell, which names the count it got
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...yamlFiles(path));
    else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) out.push(path);
  }
  return out;
}

interface Walked {
  /** Every line the archive spells as an `author:`, however its value is written. */
  lines: number;
  /** Every value the reader managed to READ. Equal to `lines` or the walk is blind. */
  values: string[];
  /** The lines whose value it could not read, quoted so a red says which form. */
  unread: string[];
  files: number;
}

/**
 * The walk. The READING is in `sources.ts` — see its header for why the two counts exist and
 * why they are separable: a reader that cannot be handed a synthetic source cannot be shown to
 * distinguish a form it parses from one it silently drops.
 */
function walkArchive(): Walked {
  const files = yamlFiles(CONTENT);
  const values: string[] = [];
  const unread: string[] = [];
  let lines = 0;
  for (const file of files) {
    const read = authorsIn(file.slice(CONTENT.length), readFileSync(file, "utf8"));
    lines += read.lines;
    values.push(...read.values);
    unread.push(...read.unread);
  }
  return { lines, values, unread, files: files.length };
}

beforeAll(openDatabase, 60_000);
afterAll(closeDatabase, 60_000);
beforeEach(clean, 60_000);

describe("premise: the archive walk can see the archive", () => {
  it(`reaches at least ${AUTHOR_LINE_FLOOR} \`author:\` lines`, () => {
    const walked = walkArchive();
    expect(
      walked.lines,
      `the walk found ${walked.lines} \`author:\` lines across ${walked.files} YAML files under ` +
        `\`content/\`. Measured at \`66f502a\`: 66 lines over 6 distinct values. AC5 quantifies ` +
        `over this set, and a criterion quantified over nothing passes without measuring ` +
        `anything — which is the exact thing "measured over \`content/\` rather than asserted" ` +
        `is guarding against.`,
    ).toBeGreaterThanOrEqual(AUTHOR_LINE_FLOOR);
  });

  it("reads a value for every line it found — a form it cannot see must RED, not skip", () => {
    /* The trap this cell exists for: a regex reader answers "absent" for every shape it was not
       written for, and an absence is indistinguishable from a clean archive. Equality between
       what was spelled and what was read is the only thing that tells them apart. */
    const walked = walkArchive();
    expect(
      walked.unread,
      `these \`author:\` lines are in a form this file's reader cannot parse. They were NOT ` +
        `checked against the bound, and a silently skipped handle is exactly the one AC5 would ` +
        `have caught. Widen the reader; do not narrow the walk.`,
    ).toEqual([]);
    expect(walked.values.length, "every spelled author line yielded a value").toBe(walked.lines);
  });

  it(`carries at least ${DISTINCT_HANDLE_FLOOR} distinct handles`, () => {
    const distinct = new Set(walkArchive().values);
    expect(
      [...distinct].sort().length,
      `the archive carries ${distinct.size} distinct author handles: ` +
        `${[...distinct].sort().join(", ")}. Six were measured at \`66f502a\`.`,
    ).toBeGreaterThanOrEqual(DISTINCT_HANDLE_FLOOR);
  });
});

describe("AC5: every handle in the archive is still a handle", () => {
  it(`no archive handle exceeds ${MAX_HANDLE_LENGTH} characters`, () => {
    /* The cheap half, and it needs no module and no database. The contract's own figure — "the
       longest is 11" — is deliberately NOT asserted: AC5 says measured rather than asserted, and
       a cell pinning 11 reds the day a seventh author with a twelve-character name is added,
       which is not a failure of anything. What is asserted is the property the bound creates. */
    const walked = walkArchive();
    const over = [...new Set(walked.values)].filter((h) => h.length > MAX_HANDLE_LENGTH);
    expect(
      over.map((h) => `${h} (${h.length})`),
      `an author handle already in \`content/\` is longer than the bound T071 introduces. ` +
        `Nothing in the archive may be made illegal by this task — §T071's \`Out of scope\` ` +
        `line says migrating an over-length handle is not a thing that can happen, and it says ` +
        `that because none exists.`,
    ).toEqual([]);
  });

  it("and `checkHandle` answers `available` for each of them against an empty database", async () => {
    /* The half that goes through the published door. Length is this file's own reading of the
       bound; `checkHandle` is the module's, and AC5 is a claim about the module. Driven against
       an empty scratch database so `taken` cannot arise and the only refusal reachable is
       `illegal` — which is what "still validates" means here.

       Quantified over the walk in ONE cell rather than `it.each` over a list: the list is
       derived at run time, and an `it.each([])` reports no failures and no tests, which reads
       as a pass. The premise cells above are what make the set non-empty; this one reports
       every offender at once rather than the first. */
    const handles = [...new Set(walkArchive().values)].sort();
    const check = await bind("checkHandle");

    const refused: string[] = [];
    for (const handle of handles) {
      try {
        await availableNow(() => check(db(), handle), `checkHandle(db, "${handle}")`);
      } catch (err) {
        refused.push(`${handle}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    expect(
      refused,
      `the registry refuses a handle its own archive already publishes cards under. Every one ` +
        `of these is an author line in \`content/\`, and a bound that refuses them makes the ` +
        `existing archive unrepresentable.`,
    ).toEqual([]);
    expect(handles.length, "and the loop really ran").toBeGreaterThanOrEqual(
      DISTINCT_HANDLE_FLOOR,
    );
  });
});
