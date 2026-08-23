/* ============================================================
   T170 AC1 — "a note posted on a blueprint never appears on a card"

   ── the cell that discriminates uses ONE refId for both kinds ──
   Two targets with two different refIds cannot see the defect this
   criterion is about. An implementation that ignores `target.kind`
   entirely and keys on `refId` alone passes such a cell, because
   the two refIds already differ and the rows already separate. The
   only fixture that can tell a kind-aware implementation from a
   kind-blind one is ONE string naming a blueprint and a card at
   once — `seedSharedRef` builds it, and asserts it really is
   shared rather than assuming the seed worked.

   ── and the leak is checked in BOTH directions ──
   A module that filters `target_kind` on read but writes the wrong
   one, and a module that writes the right one but filters on
   `target_id` alone, fail in opposite directions. One cell per
   direction, plus the storage read that says which of the two
   happened, so a red names the defect rather than the symptom.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accountActor, bind, noteRows, walk } from "./contract";
import {
  type Scratch,
  blueprintTarget,
  cardTarget,
  closeDatabase,
  openDatabase,
  postOne,
  premise,
  seedAccount,
  seedBundle,
  seedCard,
  seedSharedRef,
} from "./fixtures";

let s: Scratch;

/* The database is opened in a hook and NOTHING is measured in one. A hook that throws runs
   no cell and moves the SKIPPED count rather than the failed one, which is how a run prints
   green while measuring less than it claims — so the hook does the one thing that cannot be
   done per-cell (a scratch database is expensive) and every premise and every binding stays
   inside the cells. */
beforeAll(async () => {
  s = await openDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("T170 AC1 — a note is keyed by (kind, refId) and never by refId alone", () => {
  it("a note posted on a blueprint does not appear on the card sharing its refId", async () => {
    const author = await seedAccount(s, "ac1-author");
    const shared = await seedSharedRef(s, author.id);
    premise(
      shared.asBlueprint.refId === shared.asCard.refId,
      `the AC1 fixture must name one string as both kinds; it named ` +
        `${shared.asBlueprint.refId} and ${shared.asCard.refId}`,
    );

    const actor = accountActor(author.id, author.handle);
    const posted = await postOne(s.db, actor, shared.asBlueprint, "on the blueprint");

    const listNotes = await bind("listNotes");
    const onCard = await walk(listNotes, s.db, actor, shared.asCard, "listNotes(card)");
    const onBlueprint = await walk(
      listNotes,
      s.db,
      actor,
      shared.asBlueprint,
      "listNotes(blueprint)",
    );

    expect(
      onCard.ids,
      `AC1: a note posted on the BLUEPRINT \`${shared.refId}\` came back from the CARD of ` +
        `the same refId.\n` +
        `  This fixture uses one string for both kinds on purpose: two different refIds ` +
        `cannot tell a kind-aware implementation from one that keys on \`target_id\` alone, ` +
        `because the rows already separate. Here they do not.`,
    ).toEqual([]);

    expect(onBlueprint.ids, `the note must still be on the target it was posted to`).toEqual([
      posted.id,
    ]);
  });

  it("a note posted on a card does not appear on the blueprint sharing its refId", async () => {
    const author = await seedAccount(s, "ac1-rev");
    const shared = await seedSharedRef(s, author.id);
    const actor = accountActor(author.id, author.handle);
    const posted = await postOne(s.db, actor, shared.asCard, "on the card");

    const listNotes = await bind("listNotes");
    const onBlueprint = await walk(
      listNotes,
      s.db,
      actor,
      shared.asBlueprint,
      "listNotes(blueprint)",
    );
    const onCard = await walk(listNotes, s.db, actor, shared.asCard, "listNotes(card)");

    expect(
      onBlueprint.ids,
      `AC1, the other direction: a note posted on the CARD \`${shared.refId}\` came back ` +
        `from the BLUEPRINT of the same refId. A module that filters on \`target_id\` alone ` +
        `fails both cells; one that writes the wrong \`target_kind\` fails only this one.`,
    ).toEqual([]);
    expect(onCard.ids).toEqual([posted.id]);
  });

  /**
   * The storage read that says WHICH defect happened.
   *
   * The two cells above are about what a reader sees. This one is about what the writer
   * left behind, and the difference matters at the hand-off: a wrong `target_kind` in the
   * column and a right one filtered wrongly on read produce the same red above and
   * different rows here, so a single measurement separates "the write is wrong" from "the
   * read is wrong" without anybody opening the implementation.
   */
  it("the stored row carries the kind it was posted under", async () => {
    const author = await seedAccount(s, "ac1-store");
    const shared = await seedSharedRef(s, author.id);
    const actor = accountActor(author.id, author.handle);
    await postOne(s.db, actor, shared.asBlueprint, "stored under blueprint");

    const asBlueprint = await noteRows(s, shared.asBlueprint);
    const asCard = await noteRows(s, shared.asCard);

    expect(
      asBlueprint.map((r) => r.targetKind),
      `the note was posted with kind "blueprint" and \`note.target_kind\` says otherwise. ` +
        `Read this beside the two cells above: if they are green and this is red, the READ ` +
        `is compensating for a wrong WRITE, and the row is wrong for every later query ` +
        `nobody has written yet.`,
    ).toEqual(["blueprint"]);
    expect(asCard, `no \`note\` row should exist for the card`).toEqual([]);
  });

  it("two genuinely different targets keep their own notes", async () => {
    const author = await seedAccount(s, "ac1-two");
    const bundle = await seedBundle(s, { ownerId: author.id });
    const card = await seedCard(s, { ownerId: author.id });
    const actor = accountActor(author.id, author.handle);

    const onBundle = await postOne(s.db, actor, blueprintTarget(bundle), "bundle note");
    const onCard = await postOne(s.db, actor, cardTarget(card), "card note");
    premise(onBundle.id !== onCard.id, "two posts must produce two distinct note ids");

    const listNotes = await bind("listNotes");
    const bundlePage = await walk(
      listNotes,
      s.db,
      actor,
      blueprintTarget(bundle),
      "listNotes(bundle)",
    );
    const cardPage = await walk(listNotes, s.db, actor, cardTarget(card), "listNotes(card)");

    expect(bundlePage.ids).toEqual([onBundle.id]);
    expect(cardPage.ids).toEqual([onCard.id]);
  });
});
