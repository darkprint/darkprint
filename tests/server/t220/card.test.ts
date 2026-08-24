/* ============================================================
   T220 — read a card

   `/mcp` publishes this operation as returning *"the YAML as
   published"*, and the block types it `Promise<string>`. So the
   claim is byte identity with the archived document, not "a
   plausible serialisation of the same card".

   ── the oracle is the authoring file, not the row ──
   `content/cards/<id>@<version>.yaml` is what a human wrote and
   what `lib/content/read.ts` hands to `publish`, which stores it
   verbatim (`addCard` keeps `source` as `text`, byte-identical on
   read-back; D-90-03). Verified before binding: that file is
   byte-identical to the copy the exporter writes into
   `public/bundles/<slug>/cards/`. Comparing against the row instead
   would ask the store whether it agrees with itself.

   ── why a re-serialisation would pass a weaker cell ──
   `CardRecord` carries both `body` (jsonb, value-identical on
   read-back) and `source` (text, byte-identical). A module that
   answered `stringify(body)` would return a document with the same
   MEANING and different bytes, and every assertion about fields
   would pass. Only byte equality separates them.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { verb } from "./contract";
import { anonymous, dropScratchDatabases, refsOf, seededWorld } from "./fixtures";

const world = seededWorld();

/** The authoring document for one ref, read off `content/cards`. */
function authored(ref: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../../content/cards/${ref}.yaml`, import.meta.url)),
    "utf8",
  );
}

afterAll(async () => {
  await dropScratchDatabases();
});

describe("T220 — read a card returns the YAML as published", () => {
  it("answers the archived document byte for byte", async () => {
    const w = await world();
    const ref = refsOf(w.twice)[0]!;
    const expected = authored(ref);
    /* Premises before the bind: the oracle is a real, non-trivial document, so a red below
       is a difference rather than two empty strings failing to be equal. */
    expect(expected.length).toBeGreaterThan(100);
    expect(expected).toContain("id:");

    const readCard = await verb("mcpReadCard");
    const yaml = (await readCard(w.scratch.db, anonymous, ref)) as string;

    expect(typeof yaml).toBe("string");
    expect(
      yaml,
      "The YAML as published means the stored bytes. A re-serialisation from `body` carries " +
        "the same meaning and different bytes, and every field-level assertion would pass.",
    ).toBe(expected);
  });

  it("answers a different document for a different version of the same id", async () => {
    const w = await world();
    /* The control that makes the cell above about the REF rather than about the id. The
       library carries four ids at two versions apiece; without this a module that resolved
       the id and ignored the version passes everything above. */
    const twoVersions = refsOf(w.twice).filter((r) => r.includes("@2."));
    const ref2 = twoVersions[0];
    expect(
      ref2,
      `\`${w.twice}\` pins no card at a 2.x version, so this cell cannot distinguish a ` +
        "reader that honours the version from one that ignores it.",
    ).toBeDefined();
    const ref1 = `${ref2!.split("@")[0]}@1.0.0`;
    const doc1 = authored(ref1);
    const doc2 = authored(ref2!);
    expect(doc1).not.toBe(doc2);

    const readCard = await verb("mcpReadCard");
    expect(await readCard(w.scratch.db, anonymous, ref2!)).toBe(doc2);
    expect(await readCard(w.scratch.db, anonymous, ref1)).toBe(doc1);
  });
});
