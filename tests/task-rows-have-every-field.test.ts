/* ============================================================
   The task index is pipe-delimited and a vitest count reads
   `1 failed | 5361 passed | 0 skipped`. The delimiter and the
   result format are the same character, and a triple result is
   the single most likely thing anyone pastes into an Evidence
   cell. So the row splits at the count's own separators and
   every cell after Evidence shifts.

   Twice in two days: T005's adversary hit it and fixed it, then
   the orchestrator did it again in T050's row one task over. Two
   occurrences from two different sessions is a rate, not a slip,
   and the second was written by the session that had just read
   the first.

   WHAT THIS ACTUALLY PREVENTS, which is worse than a broken
   table. `task-state-agreement` reads field 7 as State. With ten
   fields it reads a fragment of the Evidence prose instead and
   reports that the row and the section disagree — a **false
   finding about a named task**, in a guard that is working
   correctly, sourced from a defect two columns away. The failure
   mode is not a red that says "the table is malformed". It is a
   red that says something untrue about T050 and sends whoever
   reads it to the wrong file. A guard that makes another guard
   lie costs more than the defect it reports.

   THE AUTHORITY IS THE HEADER, not agreement between the rows.
   "Every row has the same count as every other row" passes if
   the whole table is broken identically; the header declares
   what the table's shape IS, and it has no Evidence cell so it
   is the one row that cannot acquire a stray pipe from a paste.

   THE FIX when this reds is to change the pasted text, never the
   table: write `1 failed, 5361 passed, 0 skipped`. Escaping as
   `\|` also parses, and is worse — it survives here and then
   reappears verbatim in anything that reads the cell.

   Fails CLOSED: no header, or a header with no rows under it,
   are errors rather than a pass over an empty set.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/** The task index's own header line, which declares the shape every row owes. */
const HEADER = "| ID | Title | Deps | Owns (paths) | Worktree | Branch | State | Evidence |";

/** A row of the task index: `| T050 | …`. Task ids are the table's own key. */
const TASK_ROW = /^\| T\d{3} \|/;

describe("every task index row carries every field", () => {
  it("no row splits into more or fewer cells than the header declares", () => {
    const lines = readFileSync(BACKEND_MD, "utf8").split("\n");

    const headerAt = lines.findIndex((line) => line.trim() === HEADER);
    expect(
      headerAt,
      `The task index header was not found verbatim in backend.md. It is the authority for how ` +
        `many fields a row has, so without it this check has nothing to compare against and would ` +
        `pass over every row. If a column was added or renamed, update HEADER here in the same ` +
        `commit — do not let this guard go quiet.`,
    ).toBeGreaterThanOrEqual(0);

    const expected = lines[headerAt]!.split("|").length;

    /* Rows are taken from the header down to the first line that is not a table row, so a second
       pipe table elsewhere in the file cannot enter the domain and a row moved out of the table
       cannot stay in it. */
    const rows: { line: number; text: string }[] = [];
    for (let i = headerAt + 1; i < lines.length; i++) {
      const text = lines[i]!;
      if (!text.startsWith("|")) break;
      if (TASK_ROW.test(text)) rows.push({ line: i + 1, text });
    }

    expect(
      rows.length,
      "The task index header was found but no `| T000 |`-shaped rows follow it. Either the table " +
        "is empty or the row format changed, and both make the assertion below vacuous.",
    ).toBeGreaterThan(0);

    const malformed = rows
      .map(({ line, text }) => ({ line, got: text.split("|").length, text }))
      .filter(({ got }) => got !== expected)
      .map(
        ({ line, got, text }) =>
          `backend.md:${line} splits into ${got} fields, header declares ${expected}: ` +
          `${text.slice(0, 90)}…`,
      );

    expect(
      malformed,
      "A task index row has the wrong number of fields, which almost always means an unescaped " +
        "`|` inside a cell — a vitest count pasted into Evidence (`1 failed | 5361 passed`) is " +
        "how this has happened both times. The row is not merely ugly: `task-state-agreement` " +
        "reads field 7 as State, so a shifted row makes that guard report a FALSE disagreement " +
        "about a real task, and whoever reads it goes looking in the wrong place. Rewrite the " +
        "pasted text with commas — `1 failed, 5361 passed, 0 skipped`. Do not escape it as `\\|`: " +
        "that parses here and then reappears verbatim in anything that renders the cell.",
    ).toEqual([]);
  });
});
