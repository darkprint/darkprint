/* ============================================================
   "The preamble is where a ruling is argued; the criteria and the
   published block are where it binds." That rule is in `backend.md`.
   It has now been broken three times — twice after it was written.

   D-70-18…21 landed preamble-only and were caught by T070's
   implementer. The rule was written from that. Then D-70-22 landed
   preamble-only too, and was caught by the same session running the
   same private check: it diffs T070's contract section on every base
   move. **Nobody downstream runs that check**, and the two readings
   a ruling can have — argued and binding — look identical to anyone
   who only reads one of the two places.

   A rule that has failed after being written needs an instrument,
   not a restatement.

   WHAT IS CHECKED. A ruling that got its own `##` heading in the
   preamble is one the document itself marks as argued at length.
   Its id must also appear in the section of the task it belongs to
   — `D-70-22` in `### T070, …` — because that section is what a
   downstream implementer reads. The heading is the trigger, so the
   domain is derived from the document's own structure rather than
   from a list somebody maintains.

   THE ESCAPE HATCH, and why it is a marker rather than a list. Some
   rulings are process rather than contract: D-70-12 re-opened a
   blind suite, which was executed and is over, and binds no future
   reader. Those carry `(process)` directly after the id in the
   heading. An exemption *list* would live here, away from the
   ruling, and would be maintained by whoever hits the red; a marker
   lives in the heading and is written by the author at the moment
   they know which kind of ruling they are making. Unmarked means
   binding — the default is the safe one.

   WHAT THIS CANNOT DO. It checks that the id is *present* in the
   section, not that what the section says matches what the preamble
   ruled. A citation is not a semantic check, and a `D-70-22` dropped
   into the section with wrong text would satisfy it. It closes the
   failure that actually happened three times — the ruling never
   arriving at all — and claims nothing beyond that.

   It also forced a smaller fix worth recording: `D-70-18/20/21` was
   the citation in AC6, and `D-70-20` is not findable in it. A
   compressed range is not a citation.

   Fails CLOSED: no headings found, or a task section missing for an
   id that names it, are errors rather than passes.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/**
 * `D-70-22`, `D-70-14a`, `D-90-A`, `D-140-07` — the id space this run actually uses.
 *
 * `\d{2,3}`, and the third digit is not cosmetic. This read `\d{2}` until now, which cannot match
 * `D-130-06` at all: after `D-` it takes `13`, then requires a `-` and finds `0`. So EVERY ruling
 * belonging to a three-digit task — every `D-130-*`, `D-140-*` and `D-230-*` in the document — was
 * outside this guard's domain, and the guard was green over them because it could not see them.
 *
 * Same shape as `error-hygiene`'s absent class: the domain was built to a pattern rather than to the
 * document, and the ids in flight were the ones the pattern excluded. It went unnoticed because no
 * preamble heading had opened with a three-digit id yet, so the excluded region was also empty —
 * a guard blind to a region only fails once something arrives there.
 */
const RULING = /\bD-(\d{2,3})-([0-9A-Za-z]+)\b/g;

interface Ruling { id: string; task: string; process: boolean }

function ruledInPreamble(md: string): readonly Ruling[] {
  /* Everything before the first task section. The task sections are `### T0NN, …`. */
  const preamble = md.split(/^### T\d{3},/m)[0] ?? "";
  const out: Ruling[] = [];
  for (const line of preamble.split("\n")) {
    /* The heading must OPEN with a ruling id. A ruling's own heading names it first — "## D-70-22:
       …" — while a *rule* heading may cite one in passing, as "## An amendment has TWO holders, and
       telling only the implementer manufactures D-70-12" does. Triggering on any mention made that
       second kind demand a citation for a ruling it was only using as an example. Opening position
       is the document's own convention for "this heading is about this ruling". */
    if (!/^## D-\d{2,3}-/.test(line)) continue;
    for (const match of line.matchAll(RULING)) {
      const id = match[0];
      /* `(process)` must follow the id it exempts, not merely appear in the heading — otherwise one
         process ruling would exempt every other id sharing its heading, which is exactly what
         "D-70-14 and D-70-12 (process), ruled" would do under a looser test. */
      const after = line.slice(match.index + id.length);
      out.push({
        id,
        /* `40` → `T040`, `130` → `T130`. Left-padding rather than a literal `T0` prefix, which
           was only correct while every task id had a leading zero to spare. */
        task: `T${match[1]!.padStart(3, "0")}`,
        process: /^\s*\(process\)/.test(after),
      });
    }
  }
  return out;
}

function sectionOf(md: string, task: string): string | undefined {
  return md.split(/^### /m).slice(1).find((chunk) => chunk.startsWith(`${task},`));
}

describe("a ruling argued in the preamble also binds in its task's section", () => {
  it("every ruling with its own preamble heading is cited in that task's section", () => {
    const md = readFileSync(BACKEND_MD, "utf8");
    const rulings = ruledInPreamble(md);

    expect(
      rulings.length,
      "No ruling headings were found in the preamble at all. Either the `## D-NN-xx` convention " +
        "changed or the preamble/section split moved — both make the assertion below vacuous.",
    ).toBeGreaterThan(0);

    const unbound: string[] = [];
    for (const { id, task, process } of rulings) {
      if (process) continue;
      const section = sectionOf(md, task);
      if (section === undefined) {
        unbound.push(`${id}: no section ${task} exists to bind it`);
      } else if (!section.includes(id)) {
        unbound.push(`${id}: argued in the preamble, absent from ${task}`);
      }
    }

    expect(
      unbound,
      "A ruling was argued under its own preamble heading and never reached the task section it " +
        "governs. The preamble is where a ruling is argued; the criteria and the published block " +
        "are where it binds — a downstream implementer reads the section, not the preamble, so a " +
        "ruling that lands only in the preamble is a decision nobody is required to honour and it " +
        "reads as settled to whoever wrote it. Cite it in the criteria or the published block. If " +
        "it is genuinely process rather than contract — a round re-opened, a suite re-run — write " +
        "`(process)` directly after the id in its heading, which exempts that id and no other.",
    ).toEqual([]);
  });
});
