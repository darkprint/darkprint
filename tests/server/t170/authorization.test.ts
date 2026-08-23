/* ============================================================
   T170 AC3 and AC7, and D-WAVE-04's parent-read clause

   AC3  an anonymous post is refused
   AC7  an author cannot edit another author's note, and the
        operator can remove one, audited
   D-WAVE-04  `postNote` resolves the parent and checks
        `can(actor, "read", …)` before accepting

   ── AC3 IS ABOUT AN ABSENT IDENTITY, NOT ONE DISCRIMINANT STRING ──
   A module checking `actor.kind !== "anonymous"` passes the
   literal reading and grants an actor carrying an empty id, a bare
   `{}`, or an identity it INHERITS. T060 ruled all three: `can`
   fails closed, possession of a discriminant is not authority, and
   authority is never inherited — every field is read through
   `Object.hasOwn`. So AC3 is driven over the enumeration in
   `ANONYMOUS_SHAPES`, and each red says which ruling it is about.

   ── THE OPERATOR IS THE DISCRIMINATOR AC7 NEEDS ──
   "An author cannot edit another author's note" and "the operator
   can remove one" are two halves of one criterion, and a cell
   testing only the refusal is satisfiable by a module that refuses
   everybody. Both directions are here, against the same note.

   ── AND THE AUDIT IS READ AS A ROW ──
   AC7's audit is satisfied by the row EXISTING (§T170), so the row
   is read out of `audit` by raw SQL rather than inferred from a
   spy. `note.remove` is `AUDIT_ACTIONS`' thirteenth member
   (D-240-16) and is NOT an `operator.*` member: an operator
   removing a note writes `note.remove` with `actorKind:
   "operator"`, because the distinction is the COLUMN. A cell
   expecting `operator.note.remove` would red a correct
   implementation, so the wrong spellings are asserted ABSENT
   rather than left to be remembered — and `actor_kind` defaults to
   `owner` and `decision` to `allowed` in the schema, so both are
   pinned to EXCLUDE the default rather than to admit it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotAccountOwnerError } from "@/lib/server/accounts";

import {
  type Scratch,
  ANONYMOUS_SHAPES,
  AUDIT_ACTION_NOTE_REMOVE,
  FORBIDDEN_AUDIT_SPELLINGS,
  accountActor,
  auditRows,
  bind,
  noteRow,
  noteRows,
  operatorActor,
  rejection,
  targetRow,
} from "./contract";
import {
  blueprintTarget,
  closeDatabase,
  openDatabase,
  postOne,
  premise,
  seedAccount,
  seedBundle,
} from "./fixtures";

let s: Scratch;

beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("T170 AC3 — an anonymous post is refused", () => {
  it.each(ANONYMOUS_SHAPES.map((a) => [a.label, a] as const))(
    "%s cannot post, and leaves no row",
    async (_label, shape) => {
      const author = await seedAccount(s, "ac3");
      const bundle = await seedBundle(s, { ownerId: author.id });
      const target = blueprintTarget(bundle);

      const postNote = await bind("postNote");
      await rejection(
        () => postNote(s.db, shape.actor, target, "posted by nobody"),
        `postNote as ${shape.label}`,
      );

      expect(
        await noteRows(s, target),
        `AC3: ${shape.label} wrote a note.\n  ${shape.because}\n` +
          `  Asserted against the ROWS: a module that inserts and then refuses satisfies ` +
          `the rejection above while leaving the note in the database.`,
      ).toEqual([]);
      expect((await targetRow(s, target))?.noteCount ?? 0).toBe(0);
    },
  );

  it("a signed-in account CAN post — the refusal above is not a module that refuses everyone", async () => {
    const author = await seedAccount(s, "ac3-positive");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);

    const posted = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      target,
      "a real account posting",
    );

    expect(
      (await noteRows(s, target)).map((r) => r.id),
      `Every AC3 cell above is a refusal, and a module that refuses EVERY post satisfies ` +
        `all of them. This is the cell that makes those refusals mean something.`,
    ).toEqual([posted.id]);
  });
});

describe("T170 D-WAVE-04 — `postNote` checks READ on the parent, which `can` does not", () => {
  /**
   * The hole this suite charged and the orchestrator ruled a criterion.
   *
   * `canOnNote(actor, "write", …)` returns `author` alone and never reads `parent`
   * (`lib/server/policy/can.ts`), so policy AS SHIPPED grants any signed-in account a note
   * on a private blueprint it cannot read. The check has to be at the call site, and this
   * is the cell that says so.
   */
  it("a stranger cannot post on a PRIVATE blueprint it cannot read", async () => {
    const owner = await seedAccount(s, "priv-owner");
    const stranger = await seedAccount(s, "priv-stranger");
    const bundle = await seedBundle(s, { ownerId: owner.id, visibility: "private" });
    const target = blueprintTarget(bundle);

    const postNote = await bind("postNote");
    await rejection(
      () => postNote(s.db, accountActor(stranger.id, stranger.handle), target, "trespass"),
      "postNote by a stranger on a private blueprint",
    );

    expect(
      await noteRows(s, target),
      `D-WAVE-04: \`postNote\` resolves the parent and checks \`can(actor, "read", …)\` ` +
        `before accepting.\n` +
        `  \`canOnNote\` returns \`author\` for "write" and never reads \`parent\`, so a ` +
        `module that delegates the whole decision to \`can\` GRANTS here — the actor is ` +
        `the author of its own note. The check is the call site's.`,
    ).toEqual([]);
  });

  it("the owner CAN still post on its own private blueprint", async () => {
    const owner = await seedAccount(s, "priv-owner-2");
    const bundle = await seedBundle(s, { ownerId: owner.id, visibility: "private" });
    const target = blueprintTarget(bundle);

    const posted = await postOne(
      s.db,
      accountActor(owner.id, owner.handle),
      target,
      "my own private blueprint",
    );
    expect(
      (await noteRows(s, target)).map((r) => r.id),
      `The parent-read check must not become "no notes on private blueprints". ` +
        `\`can(owner, "read", privateBundle)\` is TRUE, so the owner's own note lands — and ` +
        `without this cell the refusal above is satisfied by refusing everybody.`,
    ).toEqual([posted.id]);
  });
});

describe("T170 AC7 — an author cannot edit another author's note", () => {
  it("a stranger's `editNote` is refused and the body is unchanged", async () => {
    const author = await seedAccount(s, "ac7-author");
    const stranger = await seedAccount(s, "ac7-stranger");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const target = blueprintTarget(bundle);
    const original = "the author's own words";
    const note = await postOne(s.db, accountActor(author.id, author.handle), target, original);

    const editNote = await bind("editNote");
    const err = await rejection(
      () => editNote(s.db, accountActor(stranger.id, stranger.handle), note.id, "vandalised"),
      "editNote by a stranger",
    );

    expect(
      err,
      `D-WAVE-04: AC3 and AC7 CONSUME \`NotAccountOwnerError\` from ` +
        `\`@/lib/server/accounts\` — D-140-02's precedent, no synonym minted. This is an ` +
        `identity comparison against T050's own export, so a class of the same name minted ` +
        `inside \`lib/server/notes\` fails it.`,
    ).toBeInstanceOf(NotAccountOwnerError);

    expect(
      (await noteRow(s, note.id))?.body,
      `AC7: the refusal arrived and the body changed anyway. A writer that updates and then ` +
        `checks satisfies every \`rejects.toThrow()\` a reviewer would write.`,
    ).toBe(original);
  });

  it("the author CAN edit its own note", async () => {
    const author = await seedAccount(s, "ac7-self");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const note = await postOne(s.db, actor, blueprintTarget(bundle), "first draft");

    const editNote = await bind("editNote");
    await editNote(s.db, actor, note.id, "second draft");

    expect(
      (await noteRow(s, note.id))?.body,
      `B-18: "an author may edit and delete their own note". Without this the refusal above ` +
        `is satisfied by an \`editNote\` that refuses everyone.`,
    ).toBe("second draft");
  });

  it("a stranger's `deleteNote` is refused and leaves no tombstone", async () => {
    const author = await seedAccount(s, "ac7-del");
    const stranger = await seedAccount(s, "ac7-del-stranger");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "not yours to remove",
    );

    const deleteNote = await bind("deleteNote");
    await rejection(
      () => deleteNote(s.db, accountActor(stranger.id, stranger.handle), note.id),
      "deleteNote by a stranger",
    );

    expect(
      (await noteRow(s, note.id))?.deletedAt,
      `D-WAVE-04: \`deleteNote\` stays \`Promise<void>\` and REJECTS on denial, because ` +
        `\`void\` cannot express DENIED — a silent no-op tells a stranger their delete ` +
        `worked. The store is what separates the two, and this is it: a tombstone here ` +
        `means the refusal was decorative.`,
    ).toBeNull();
  });
});

describe("T170 AC7 — the operator can remove one, audited", () => {
  it("an operator's `deleteNote` tombstones a note it did not author", async () => {
    const author = await seedAccount(s, "op-author");
    const operator = await seedAccount(s, "op-actor");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "removed by an operator",
    );
    premise(operator.id !== author.id, `the operator must not be the note's author`);

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, operatorActor(operator.id), note.id);

    const row = await noteRow(s, note.id);
    expect(row, `B-18: "the operator may remove any". The row survives — it is a tombstone.`)
      .toBeDefined();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.body, `an operator removal empties the body in storage like any other`).toBe("");
  });

  it("the removal writes ONE `note.remove` audit row with `actorKind: \"operator\"`", async () => {
    const author = await seedAccount(s, "audit-author");
    const operator = await seedAccount(s, "audit-op");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "audited removal",
    );

    const before = await auditRows(s);
    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, operatorActor(operator.id), note.id);
    const written = (await auditRows(s)).slice(before.length);

    expect(
      written.map((r) => r.action),
      `AC7: "the operator can remove one, AUDITED", and §T170 says the criterion is ` +
        `satisfied by the ROW EXISTING. \`note.remove\` is \`AUDIT_ACTIONS\`' thirteenth ` +
        `member (D-240-16).\n` +
        `  Read off the \`audit\` table rather than a spy, and as a STRING rather than ` +
        `through \`AuditAction\`: a type pin cannot see a row that was never written, and ` +
        `it goes on compiling if the writer is deleted.`,
    ).toEqual([AUDIT_ACTION_NOTE_REMOVE]);

    const row = written[0];
    expect(
      row?.actorKind,
      `D-240-08: NO member encodes the operator. An operator removing a note writes the ` +
        `note's action with \`actorKind: "operator"\` — the distinction is the COLUMN, and ` +
        `a second spelling of it is two sources for one quantity.\n` +
        `  \`audit.actor_kind\` DEFAULTS TO \`owner\` in the schema, so a module that drops ` +
        `this on the floor writes a plausible row rather than failing. That is why this ` +
        `EXCLUDES the default instead of admitting the good value.`,
    ).toBe("operator");
    expect(
      row?.decision,
      `\`audit.decision\` DEFAULTS TO \`allowed\`, the same hazard. The removal succeeded, ` +
        `so \`allowed\` is right — and it is asserted so a later denial-path row cannot ` +
        `quietly reuse this cell.`,
    ).toBe("allowed");
    expect(row?.actorId, `the row must name WHICH operator acted`).toBe(operator.id);
    expect(row?.targetId, `and WHICH note was removed`).toBe(note.id);
  });

  it.each(FORBIDDEN_AUDIT_SPELLINGS)("no audit row is written under `%s`", async (spelling) => {
    const author = await seedAccount(s, `spell-${spelling}`);
    const operator = await seedAccount(s, `spell-op-${spelling}`);
    const bundle = await seedBundle(s, { ownerId: author.id });
    const note = await postOne(
      s.db,
      accountActor(author.id, author.handle),
      blueprintTarget(bundle),
      "spelling check",
    );

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, operatorActor(operator.id), note.id);

    expect(
      (await auditRows(s)).map((r) => r.action),
      `D-240-08 and D-240-16: \`${spelling}\` is not a member of \`AUDIT_ACTIONS\` and must ` +
        `never appear in the log. \`operator.note.remove\` is the one worth spelling out — ` +
        `the dispatch warned that a cell EXPECTING it would red a correct implementation, ` +
        `so it is asserted ABSENT here instead of being left to memory.`,
    ).not.toContain(spelling);
  });

  it("an author deleting its OWN note is not audited as an operator", async () => {
    const author = await seedAccount(s, "self-del");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);
    const note = await postOne(s.db, actor, blueprintTarget(bundle), "my own note");

    const deleteNote = await bind("deleteNote");
    await deleteNote(s.db, actor, note.id);

    expect(
      (await auditRows(s)).map((r) => `${r.action}/${r.actorKind}`),
      `The criterion is about an OPERATOR removal. An author deleting its own note through ` +
        `the same door must not be recorded as a break-glass action — \`actorKind\` is the ` +
        `column that carries the distinction, and a module hard-coding "operator" beside a ` +
        `hard-coded action satisfies the audit cell above and mislabels every self-delete.`,
    ).not.toContain(`${AUDIT_ACTION_NOTE_REMOVE}/operator`);
  });
});
