/* ============================================================
   T261 / D-261-09(2) — `/nodes/<id>` renders an accountless author
   as TEXT, from the branch the route already had.

   D-260-25 ruled end state (d) and D-261-06 assigned it. This route
   closes itself rather than needing an edit: `app/nodes/[...id]/
   page.tsx` already carries

       {author !== undefined ? <AuthorChip author={author} />
                             : <span …>{card.author ?? "unattributed"}</span>}

   and the cutover makes the SECOND arm the firing one, because the
   archive's six author handles hold no accounts (D-250-11).
   `AuthorChip` links unconditionally (`components/ui/Avatar.tsx:76`),
   so the ternary is the entire mechanism.

   The instruction that shaped this file: assert the TEXT arm fires,
   do NOT assert a deleted chip. A cell written against a removed
   component would red a correct route.

   ── driveable, and that had to be checked ──
   This page reads no session: `readSession`/`cookies()` occur ZERO
   times in it, where the blueprint redirector and the canonical
   detail page carry 3 and 2. A page that reads cookies throws
   "`cookies` was called outside a request scope" under direct
   invocation whatever its segment config says — measured this
   window, and the reason two other members of this family are not
   in it.

   Fixture through `runImport`, the production path, so the author
   handle on the card is the one the product actually stores.
   ============================================================ */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import NodePage from "@/app/nodes/[...id]/page";
import { latestCards } from "@/lib/server/registry";
import { planImport, runImport } from "@/lib/server/seed";
import { createObjectStorage } from "@/lib/db/storage";
import type { Actor } from "@/lib/server/policy";

import { createTestDb, type TestDb } from "../../support/db";

let testDb: TestDb | undefined;
let previousUrl: string | undefined;
/** A card whose stored author handle holds no account — the firing branch. */
let subject: { id: string; version: string; author: string } | undefined;

const anonymous: Actor = { kind: "anonymous" };
/** D-250-11's six, verbatim. */
const ACCOUNTLESS = ["hachi", "k0bra", "lupo", "mara-veil", "orin", "sol-antczak"];

beforeAll(async () => {
  testDb = await createTestDb();
  previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

  const db = testDb.client.db;
  await runImport(db, await planImport(), createObjectStorage());

  /* The author is on the CARD BODY, not on `CardSummary` — `CardSummary` is
     `{ref, id, version, digest, card, usedIn}` and the handle lives at `card.author`,
     which is what `app/nodes/[...id]/page.tsx:582` reads via `one(c.author, …)`. Reading
     it off the summary returned `undefined` for every card and looked exactly like
     "re-attribution rewrote the manifest author", which would have been a false charge
     against D-250-18. */
  const cards = await latestCards(db, anonymous);
  for (const card of cards) {
    const author = card.card.author;
    if (typeof author === "string" && ACCOUNTLESS.includes(author)) {
      subject = { id: card.id, version: card.version, author };
      break;
    }
  }
}, 300_000);

afterAll(async () => {
  const key = Symbol.for("darkprint.db.sharedClient");
  const shared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
  await shared[key]?.close();
  delete shared[key];
  if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  await testDb?.drop();
});

async function render(ref: string): Promise<string> {
  const page = NodePage as unknown as (props: {
    params: Promise<{ id: string[] }>;
  }) => Promise<ReactElement>;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ id: ref.split("/") }) }));
}

describe("the fixture", () => {
  /* A cell, not a hook assertion: a `beforeAll` throw produces SKIPS, which read as green
     to anyone quoting a test total. Measured twice in this window, on my own fixtures. */
  it("found a card stored under one of D-250-11's six accountless handles", () => {
    expect(
      subject,
      `no imported card carries an author in ${ACCOUNTLESS.join(", ")}. Either re-attribution ` +
        `started rewriting the manifest author — which D-250-18 forbids — or the import ` +
        `published nothing. Either way the branch this file is about never fires.`,
    ).toBeDefined();
  });
});

describe("D-261-09(2): the absent-account arm renders text, not a link", () => {
  it("prints the handle and links it nowhere", async () => {
    expect(subject).toBeDefined();
    /* The bare card id, not `id@version`: the route is a catch-all over the ID and
       `versionsOf(db, actor, id)` takes it bare — `nodeHref` builds from the id alone.
       Passing the ref made the page 404 correctly, and reading that as a defect would have
       been a false charge against a route doing exactly the right thing. */
    const html = await render(subject!.id);

    expect(
      html.length,
      "the node page rendered nothing; the absence assertion below would be vacuous",
    ).toBeGreaterThan(500);

    expect(
      html,
      `/nodes/${subject!.id} no longer prints its author's handle at all. End state (d) is ` +
        `the handle as TEXT — dropping the name with the link is not the honest end state, ` +
        `it is losing the attribution the archive carries (D-250-18).`,
    ).toContain(subject!.author);

    const profileLinks = [...html.matchAll(/href="([^"]*)"/g)]
      .map(([, href]) => href)
      .filter((href) => href === `/u/${subject!.author}`);

    expect(
      profileLinks,
      `/nodes/${subject!.id} links \`/u/${subject!.author}\`, a handle that holds no account ` +
        `(D-250-11) and 404s. The route's own \`author !== undefined\` ternary should be ` +
        `falling to its text arm — if a chip is rendering instead, the cutover is resolving ` +
        `an account for a handle that has none.`,
    ).toEqual([]);
  });
});
