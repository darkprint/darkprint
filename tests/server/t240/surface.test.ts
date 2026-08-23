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

   `GAP-240-A` used to live here and is DELETED: the divergence
   it reported was real, was amended at `43ceb9a`, and F-240-A is
   recorded resolved. What replaced it is the property it was
   protecting — and the note on why my own parser could not see
   two of the four fixes when they landed.
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

/**
 * Every VALUE the barrel must export, after `43ceb9a` amended the block to carry its own
 * rulings (F-240-A, resolved).
 *
 * `NotPermittedError` was NOT in the list this suite was written against and is added here
 * as an adversary repair: D-240-04 put the permission in this module, and a refusal a
 * caller cannot NAME is a refusal a caller cannot branch on — the whole reason the class
 * exists. My blind half asserted the refusal's SENTENCE and never its class, so an
 * implementation throwing a bare `Error` with the right words would have passed every cell
 * I wrote. That gap is mine, and it is closed here and in `adversary.test.ts`.
 */
const PUBLISHED_VALUES = [
  "writeAudit",
  "listAudit",
  "AUDIT_ACTIONS",
  "AuditStoreError",
  "NotPermittedError",
] as const;

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

    const missing = PUBLISHED_VALUES.filter((name) => !barrel.keys.includes(name));

    expect(
      missing,
      `${BARREL} resolved but does not export: ${missing.join(", ")}.\n` +
        `  The block names \`writeAudit\` and \`listAudit\`; D-240-03 publishes ` +
        `\`AUDIT_ACTIONS\` as a closed set, D-240-05 \`AuditStoreError\` and D-240-04 ` +
        `\`NotPermittedError\`.\n` +
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
   * **GAP-240-A is DELETED, not weakened — and this cell is what replaces it.**
   *
   * The finding held: the Published signatures block was behind its own rulings on four
   * counts, measured at `fe143a7`. It was amended at `43ceb9a` on all four, F-240-A is
   * recorded resolved in §T240, and the ruling says to delete the cell at the merge. Deleted.
   *
   * **What is kept is the property the GAP cell was protecting**, because a resolved
   * divergence can recur: the block must NAME everything the barrel publishes. Written as a
   * floor — the block may add — so it reds on a removal or a rename and not on growth.
   *
   * **My parser was blind to two of the four when they landed, and that is the adversary
   * finding underneath this one.** After `43ceb9a` the GAP cell still reported
   * `AUDIT_ACTIONS` and `AuditStoreError` absent, because it read only two declaration
   * forms — a signature line and an `interface` — and the amendment published them as a
   * `const` and a `class`. A derivation is only a derivation over the forms it can read, and
   * mine would have filed a red against an orchestrator who had already done the work. The
   * parser now reads `const`, `type` and `class` too, which is what makes this cell able to
   * observe its own subject at all.
   */
  it("names every published value, in a declaration form the parse can actually read", () => {
    const block = publishedBlock();
    const named = new Set([
      ...block.signatures.map((sig) => sig.name),
      ...block.declarations.map((d) => d.name),
      ...block.interfaces.map((i) => i.name),
    ]);

    const missing = PUBLISHED_VALUES.filter((name) => !named.has(name));
    expect(
      missing,
      `backend.md §T240's published block names no ${missing.join(", ")}.\n` +
        `  parsed signatures:   ${block.signatures.map((sig) => sig.name).join(", ") || "(none)"}\n` +
        `  parsed declarations: ${block.declarations.map((d) => `${d.kind} ${d.name}`).join(", ") || "(none)"}\n` +
        `  parsed interfaces:   ${block.interfaces.map((i) => i.name).join(", ") || "(none)"}\n` +
        `  An implementer reads the block first. A member the barrel publishes and the block ` +
        `omits is a surface built from a document that does not describe it.`,
    ).toEqual([]);

    /* The parse must SEE all three forms, not merely fail to complain. A parser that read
       nothing would satisfy the clause above only because `named` came out empty — which is
       exactly how the original GAP cell reported a false divergence. */
    expect(
      block.declarations.length,
      `the block parsed to ZERO const/type/class declarations. It publishes AUDIT_ACTIONS, ` +
        `AuditAction and both error classes in those forms, so a zero here is the parser ` +
        `blind again rather than the document empty.`,
    ).toBeGreaterThan(0);
  });
});
