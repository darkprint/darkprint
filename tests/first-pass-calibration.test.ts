/* ============================================================
   The calibration clause in `backend.md` says the first adversarial
   PASS is shown to the owner once, because rounds of FAIL evidence an
   adversary's bar for *broken* and say nothing about its bar for
   *done*. It was skipped three times — T060, T010, T020 merged and
   tagged unsurfaced.

   The reason is structural rather than attentional, and it is T025's
   adversary's diagnosis: **the enforcer and the enforced are the same
   agent.** The orchestrator merges, tags, and is also the one who must
   remember to surface. Nothing inside a loop can fail closed against
   the agent operating that loop, so the clause had no mechanism and a
   governance clause with no mechanism is a reminder.

   This is the mechanism, in the idiom the repository already uses for
   `no-raw-control-bytes`: a repo-level guard that reds the suite for
   everyone, the orchestrator included. It runs inside every gate
   triple, so the first unsurfaced PASS fails the orchestrator's own
   run. It can be deleted — but a deletion is a diff someone reviews,
   and a reminder is not.

   Fails CLOSED: the assertion is on the *absence* of the marker, not
   on finding reassuring prose. A `backend.md` that says nothing about
   calibration reds, which is the state that has to be caught.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BACKEND_MD = fileURLToPath(new URL("../backend.md", import.meta.url));

/** A task row carrying a `*-verified` tag is one that merged on an adversarial PASS. */
const VERIFIED_TAG = /`(t\d{3})-verified`/g;

/**
 * The marker the orchestrator writes once, when it has actually put a PASS in front of the
 * owner. Deliberately a fixed shape rather than free prose: something that has to be *written*
 * cannot be satisfied by a sentence that happens to mention calibration.
 */
const SURFACED = /^First PASS surfaced to owner: (t\d{3}) on (\d{4}-\d{2}-\d{2})\.$/m;

describe("the first adversarial PASS is surfaced to the owner before the loop runs on", () => {
  it("reds while any task has merged on a PASS and no calibration marker exists", () => {
    const backendMd = readFileSync(BACKEND_MD, "utf8");
    const merged = [...backendMd.matchAll(VERIFIED_TAG)].map((m) => m[1]);
    const uniqueMerged = [...new Set(merged)].sort();

    if (uniqueMerged.length === 0) return; // nothing has merged yet; the clause has nothing to bind

    const marker = SURFACED.exec(backendMd);
    expect(
      marker,
      `${uniqueMerged.length} task(s) have merged on an adversarial PASS (${uniqueMerged.join(", ")}) ` +
        "and backend.md carries no calibration marker. The governance clause says the first PASS is " +
        "shown to the owner once, as calibration — rounds of FAIL evidence an adversary's bar for " +
        "broken and say nothing about its bar for done. Surface it, then record the fact as a line " +
        'reading exactly: "First PASS surfaced to owner: t0NN on YYYY-MM-DD."',
    ).not.toBeNull();
  });
});
