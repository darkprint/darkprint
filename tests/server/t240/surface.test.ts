/* ============================================================
   T240 — the barrel, and the one instrument that can tell
   *the module is absent* from *a member is absent* from
   *an assertion failed*

   Nothing here asserts behaviour. It exists because every other
   file in this directory is downstream of a question none of
   them can answer about themselves: a type pin over an absent
   member is silently `true`, an import rejection and a missing
   export both surface as "the test failed", and a suite written
   blind against a module that has not landed will produce a
   wall of reds that all say the same thing while looking like
   five different findings.

   `barrelExports()` answers it once, here, in one cell, and the
   rest of the suite's reds can be read against that answer.

   ── the drift half ──
   The other cells compare the DERIVED published block against
   the transcribed floor this suite was written from. The floor
   is not a second source of truth: it is a tripwire for the day
   the parse and the contract disagree, which is the day every
   shape cell downstream silently changes its subject.

   And one of them, `GAP-240-A`, is a red I expect and stand
   behind — see its comment.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  BARREL,
  barrelExports,
  publishedBlock,
  REFUSAL_FORM_FLOOR,
  refusalForm,
  signature,
} from "./contract";

/* ============================================================
   what the contract publishes, transcribed ONCE as a floor

   Read off `### T240,` at `backend` `fe143a7`, block digest
   recorded below. Every list here is a FLOOR: the cells assert
   the parsed block still contains it, never that it equals it,
   so the orchestrator may add and the suite reds only on a
   removal or a change.
   ============================================================ */

/** D-240-03 and D-240-05 add two names the Published signatures block does not yet carry. */
const RULED_MEMBERS = ["AUDIT_ACTIONS", "AuditStoreError"] as const;

const BLOCK_MEMBERS = ["writeAudit", "listAudit"] as const;

const AUDIT_ENTRY_FIELDS = [
  "actorId",
  "actorKind",
  "action",
  "targetKind",
  "targetId",
  "decision",
  "detail",
] as const;

const RULINGS = [
  "D-240-01",
  "D-240-02",
  "D-240-03",
  "D-240-04",
  "D-240-05",
  "D-240-06",
  "D-240-07",
] as const;

describe("T240 — which of the three states this suite is being read in", () => {
  /**
   * The cell every other red in this directory should be read against.
   *
   * It never fails on the module's absence. A state is a measurement, not a criterion, and
   * a cell that reddened on "the module is absent" would be asserting the implementer had
   * already finished — the blind position stated backwards. What it does is put the answer
   * in the run's own output, so a reader of `writeAudit is not a function` does not have to
   * go and find out whether there was anything there to be a function.
   */
  it("reports the barrel state and the exact export list", async () => {
    const barrel = await barrelExports();
    console.log(
      `T240 barrel state: ${barrel.state}\n` +
        `  ${BARREL} exports: ${barrel.keys.join(", ") || "(nothing)"}\n` +
        (barrel.cause === undefined ? "" : `  import rejected with: ${String(barrel.cause)}\n`),
    );

    /* The discrimination this instrument CLAIMS, asserted rather than assumed: in the
       present state it must have produced a key list, and in the absent state it must have
       produced the rejection. An instrument that answers "present" with no keys and
       "absent" with no cause is answering a coin flip, and every red downstream would be
       read against that coin flip. */
    if (barrel.state === "present") {
      expect(
        Array.isArray(barrel.keys) && barrel.keys.length > 0,
        `barrelExports() reported \`present\` with an empty export list. A barrel that ` +
          `resolves and exports nothing is indistinguishable here from one that does not ` +
          `exist, which is the exact distinction this instrument is for.`,
      ).toBe(true);
    } else {
      expect(
        barrel.cause,
        `barrelExports() reported \`module-absent\` without carrying the import rejection, ` +
          `so nothing downstream can tell an absent module from a module that threw on load.`,
      ).toBeDefined();
      expect(
        barrel.keys,
        `barrelExports() reported \`module-absent\` and still listed exports.`,
      ).toEqual([]);
    }
  });

  /**
   * The named members, reported as one list rather than asserted one at a time.
   *
   * One cell rather than four, and deliberately: four cells reporting "absent" for the same
   * absent module is four reds for one fact, and this run has already paid for reading a
   * count of reds as a count of defects.
   */
  it("names every published member that is missing, in one red", async () => {
    const barrel = await barrelExports();
    if (barrel.state === "module-absent") {
      throw new Error(
        `${BARREL} is not on disk yet — the blind position, not a defect.\n` +
          `  import rejected with: ${String(barrel.cause)}\n` +
          `  This cell becomes a criterion the moment the module lands.`,
      );
    }

    const expected = [...BLOCK_MEMBERS, ...RULED_MEMBERS];
    const missing = expected.filter((name) => !barrel.keys.includes(name));

    expect(
      missing,
      `${BARREL} resolved but does not export: ${missing.join(", ")}.\n` +
        `  The Published signatures block names ${BLOCK_MEMBERS.join(" and ")}; D-240-03 ` +
        `publishes \`AUDIT_ACTIONS\` as a closed set and D-240-05 publishes ` +
        `\`AuditStoreError\`.\n` +
        `  found: ${barrel.keys.join(", ") || "(nothing)"}`,
    ).toEqual([]);
  });
});

describe("T240 — the derived published block still says what this suite was written from", () => {
  it("declares writeAudit and listAudit with the parameters the block writes", () => {
    const write = signature("writeAudit");
    const list = signature("listAudit");

    expect(
      write.params.map((p) => p.split(":")[0].trim()),
      `backend.md §T240 now writes \`${write.text}\`; every write cell in this suite calls ` +
        `writeAudit(db, entry).`,
    ).toEqual(["db", "entry"]);

    expect(
      list.params.map((p) => p.split(":")[0].trim()),
      `backend.md §T240 now writes \`${list.text}\`; every list cell in this suite calls ` +
        `listAudit(db, actor, filter).`,
    ).toEqual(["db", "actor", "filter"]);
  });

  it("declares AuditEntry with the seven fields the shape pins name", () => {
    const entry = publishedBlock().interfaces.find((i) => i.name === "AuditEntry");
    expect(
      entry,
      `backend.md §T240's published block no longer declares \`interface AuditEntry\`. Every ` +
        `shape pin in published-shape.test.ts is written against it.`,
    ).toBeDefined();

    const names = (entry?.fields ?? []).map((f) => f.split(/[?:]/)[0].trim());
    const missing = AUDIT_ENTRY_FIELDS.filter((f) => !names.includes(f));
    expect(
      missing,
      `AuditEntry no longer declares ${missing.join(", ")}.\n  parsed fields: ${names.join(", ")}`,
    ).toEqual([]);
  });

  it("still rules D-240-01 through D-240-07, which this suite is written against", () => {
    const ruled = publishedBlock().rulings;
    const missing = RULINGS.filter((r) => !ruled.includes(r));
    expect(
      missing,
      `backend.md §T240 no longer rules ${missing.join(", ")}. This suite's AC1 narrowing ` +
        `(D-240-01), listAudit read shape (D-240-02), action vocabulary (D-240-03), ` +
        `operator-only read (D-240-04), propagating writer (D-240-05), withdrawn AC4 ` +
        `(D-240-06) and AC3's split claim (D-240-07) each depend on one of them.\n` +
        `  parsed: ${ruled.join(", ") || "(none)"}`,
    ).toEqual([]);
  });

  it("publishes exactly one admissible message form, and it is listAudit's refusal", () => {
    expect(
      refusalForm(),
      `The admissible message form parsed out of backend.md §T240 is not the one this ` +
        `suite's refusal cells match against by EXACT equality.`,
    ).toBe(REFUSAL_FORM_FLOOR);
  });

  /**
   * The freeze, and why it is over the parsed block rather than over `backend.md`'s blob.
   *
   * The document is the orchestrator's and is edited continuously — twice within the hour
   * this file was written, blob `4729ff1d…` → `859f4669…`. A pin on the blob reds on every
   * prose edit, and a red that fires for a reason nobody needs to act on is a red people
   * learn to skip past, which then hides the ones that matter.
   *
   * This suite's domain is not the prose. It is the signature lines, `AuditEntry`'s fields,
   * the criteria, the rulings and the admissible form — so the digest is over exactly those
   * five, normalised, and nothing else. Prose moves freely underneath it; a signature cannot.
   *
   * **Recorded rather than compared.** A hard-coded expected digest would red on any
   * legitimate contract amendment, including one this suite asked for, and the cells above
   * already say *which* part moved, in words, which is the thing a digest cannot do. The
   * digest's job is to let a later reader tell two runs apart at a glance.
   */
  it("records the digest of the block this run was measured against", () => {
    const { pin, signatures, criteria, rulings } = publishedBlock();
    console.log(
      `T240 published-block digest: ${pin}\n` +
        `  signatures: ${signatures.map((s) => s.name).join(", ")}\n` +
        `  criteria: ${criteria.length}\n` +
        `  rulings: ${rulings.join(", ")}`,
    );

    expect(pin, "the block digest is not a sha256 hex string; the pin is broken.").toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(
      criteria.length,
      `§T240 parses ${criteria.length} acceptance criteria; it publishes five, of which AC4 ` +
        `is withdrawn by D-240-06 and AC1 narrowed by D-240-01. A different count means the ` +
        `criteria list moved and this suite's coverage claim moved with it.`,
    ).toBe(5);
  });

  /**
   * **GAP-240-A — the Published signatures block and the rulings below it disagree, and the
   * block is the half an implementer reads first.**
   *
   * Three divergences, measured against `backend` `fe143a7`:
   *
   *   1. the block writes `listAudit(...): Promise<AuditEntry[]>`; **D-240-02 rules
   *      `Promise<(AuditEntry & { occurredAt: Date })[]>`**;
   *   2. the block writes `action: string` inside `AuditEntry`; **D-240-03 rules `action`
   *      is typed as the `AUDIT_ACTIONS` union** — and over an open string the product's
   *      absolute constraint is unfalsifiable, which is the whole reason for the ruling;
   *   3. the block names no `AUDIT_ACTIONS` and no `AuditStoreError`; **D-240-03 and
   *      D-240-05 publish both.**
   *
   * A red against the DOCUMENT, not against the implementer, and written as a red rather
   * than a comment on purpose: a divergence recorded only in prose is one the next reader
   * inherits silently. The shape pins in `published-shape.test.ts` are bound to the
   * RULINGS, which are the later and therefore governing text — so if this is resolved the
   * other way (the rulings amended to match the block), those pins move and this cell stays.
   *
   * Delete it when the block is amended. Do not weaken it until it passes.
   */
  it("GAP-240-A: the published block carries D-240-02, D-240-03 and D-240-05", () => {
    const list = signature("listAudit");
    const entry = publishedBlock().interfaces.find((i) => i.name === "AuditEntry");
    const actionField = (entry?.fields ?? []).find((f) => f.startsWith("action"));
    const blockText = publishedBlock()
      .signatures.map((s) => s.text)
      .concat(publishedBlock().interfaces.flatMap((i) => [...i.fields]))
      .join("\n");

    const divergences: string[] = [];
    if (!list.returns.includes("occurredAt")) {
      divergences.push(
        `D-240-02: the block writes \`listAudit(...): ${list.returns}\`; the ruling says ` +
          `\`Promise<(AuditEntry & { occurredAt: Date })[]>\``,
      );
    }
    if (actionField !== undefined && /^action\s*:\s*string$/.test(actionField)) {
      divergences.push(
        `D-240-03: the block writes \`${actionField}\`; the ruling types it as the ` +
          `\`AUDIT_ACTIONS\` union`,
      );
    }
    for (const name of RULED_MEMBERS) {
      if (!blockText.includes(name)) {
        divergences.push(`the block names no \`${name}\`, which D-240-03/D-240-05 publish`);
      }
    }

    expect(
      divergences,
      `GAP-240-A — backend.md §T240's Published signatures block is behind its own rulings:\n` +
        divergences.map((d) => `  - ${d}`).join("\n") +
        `\n  A finding against the CONTRACT DOCUMENT. An implementer reading the block alone ` +
        `builds the wrong surface and is right to; the pins in published-shape.test.ts are ` +
        `bound to the rulings because they are the later text.`,
    ).toEqual([]);
  });
});
