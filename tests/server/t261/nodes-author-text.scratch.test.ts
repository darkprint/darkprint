/* ============================================================
   T261 / D-261-09(2) — `/nodes/<id>` renders an accountless author
   as TEXT, from the branch the route already had.

   `app/nodes/[...id]/page.tsx` carries

       {author !== undefined ? <AuthorChip author={author} />
                             : <span …>{card.author ?? "unattributed"}</span>}

   and the second arm fires for a card whose `author:` line names a
   handle no account holds. `AuthorChip` links unconditionally
   (`components/ui/Avatar.tsx:76`), so the ternary is the entire
   mechanism.

   The instruction that shaped this file: assert the TEXT arm fires,
   do NOT assert a deleted chip. A cell written against a removed
   component would red a correct route.

   ── the fixture supplies the accountless author ──
   The archive credits every card to the registry account, which
   exists, so no imported card reaches the text arm. The fixture
   publishes one more bundle through `publish`, the production path:
   a copy of an archive bundle with one card's id and author
   rewritten and the topology's pin moved with it. The author handle
   on that card is one the product stored and no account holds.

   ── driveable, and that had to be checked ──
   T280 gave this page a session-aware actor (`actorNow()`, the star/
   signal/note reads) — `readSession()` now runs on every render,
   where before this file's own measurement found zero calls. A page
   that reads cookies throws "`cookies` was called outside a request
   scope" under direct invocation whatever its segment config says,
   which is what `readSession`'s own `cookies()` call does the moment
   nothing has put a request store in scope for it.

   This file drives the page directly regardless, on the same
   reasoning `readSession`'s header states for `next/headers` itself:
   nothing here ever sets a session cookie, so the true answer at
   every call site below is "no session" either way. The `next/headers`
   mock below supplies that answer without the real module's request-
   scope guard, rather than asking every cell to route through an HTTP
   layer this file has never needed. A test exercising a SIGNED-IN
   reader could not take this shortcut and would need the rewrite the
   blueprint page's own docblock describes for its two members of this
   family; this file's four cells never need one.
   ============================================================ */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* The mock `readSession`'s own header names as the request-scope guard's trigger.
   `get` always answers `undefined` — no session cookie, ever — which is the true answer
   at every call site in this file regardless: nothing below signs a reader in through a
   cookie. Only `cookies` is stubbed; nothing else in this chain reaches `next/headers`. */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

/* `CardForkButton`'s live arm reads `useRouter()` at render, and the App Router context
   only exists inside a Next request, so the page throws on the way in without this. The
   card fork route landed 2026-09-06 and the page passes the control unconditionally, which
   is what put a hook in this render path where the fork explainer had held none.

   Same shape and same reasoning as the `next/headers` stub above, and the same stub
   `components/profile/owned-visibility.test.ts` uses for `DeleteBundleControl`. It answers
   the two members this tree calls and nothing else. Nothing below asserts navigation: the
   four cells read author TEXT and profile links out of the markup, and a router that never
   moves is the true answer for a render that never clicks. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import NodePage from "@/app/nodes/[...id]/page";
import { schema } from "@/lib/db";
import { readContent } from "@/lib/content/read";
import { changeHandle, upsertFromGitHub } from "@/lib/server/accounts";
import { publish } from "@/lib/server/publish";
import { planImport, runImport } from "@/lib/server/seed";
import { createObjectStorage } from "@/lib/db/storage";

import { createTestDb, type TestDb } from "../../support/db";

let testDb: TestDb | undefined;
let previousUrl: string | undefined;
/** The card whose stored author handle holds no account — the firing branch. */
let subject: { id: string; version: string; author: string } | undefined;
/** Set once the must-not-change arm has created an account for `subject`'s own author. */
let accountCreated = false;

/** A handle no account holds, written into the fixture card's own `author:` line. */
const ACCOUNTLESS = "nobody-here";

beforeAll(async () => {
  testDb = await createTestDb();
  previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

  const db = testDb.client.db;
  const storage = createObjectStorage();
  await runImport(db, await planImport(), storage);

  /* One archive bundle, republished under another account with one card renamed and
     credited to `ACCOUNTLESS`. The other cards are byte-identical to the imported ones, so
     `publish` reuses them; the renamed one is a new card version whose `author:` line the
     product stores as written. `versionsOf` reads cards pinned by releases, so the card is
     reachable at `/nodes/<id>` only because a public release pins it, which is why this goes
     through `publish` rather than `addCard`. */
  const source = readContent().find((b) => b.slug === "starter-software-factory");
  if (source === undefined) throw new Error("starter-software-factory is not in the archive");
  const [file, text] = Object.entries(source.bundle.cardFiles)[0]!;
  const ref = file.replace(/^cards\//, "").replace(/\.yaml$/, "");
  const [id, version] = ref.split("@") as [string, string];
  const renamed = `t261-${id}`;
  const cardFiles: Record<string, string> = { ...source.bundle.cardFiles };
  delete cardFiles[file];
  cardFiles[`cards/${renamed}@${version}.yaml`] = text
    .replace(/^id: .*$/m, `id: ${renamed}`)
    .replace(/^author: .*$/m, `author: ${ACCOUNTLESS}`);
  const dot = source.bundle.dot.replaceAll(`card="${ref}"`, `card="${renamed}@${version}"`);

  const owner = await upsertFromGitHub(db, { githubId: "t261-owner", githubLogin: "t261owner" });
  await changeHandle(db, { kind: "account", accountId: owner.accountId, handle: null }, owner.accountId, "t261owner");
  await publish(
    db,
    { kind: "account", accountId: owner.accountId, handle: "t261owner" },
    {
      ownerHandle: "t261owner",
      slug: "t261-orphan-author",
      version: "1.0.0",
      manifest: { ...source.bundle.manifest, slug: "t261-orphan-author" },
      dot,
      cardFiles,
      visibility: "public",
    },
    storage,
  );
  subject = { id: renamed, version, author: ACCOUNTLESS };
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
     to anyone quoting a test total. */
  it("published a card whose author handle holds no account", async () => {
    expect(subject, "the fixture published nothing, so the branch this file is about never fires").toBeDefined();
    const rows = await testDb!.client.db
      .select({ handle: schema.account.handle })
      .from(schema.account);
    expect(rows.map((r) => r.handle)).not.toContain(subject!.author);
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
        `it is losing the attribution the card carries.`,
    ).toContain(subject!.author);

    const profileLinks = [...html.matchAll(/href="([^"]*)"/g)]
      .map(([, href]) => href)
      .filter((href) => href === `/u/${subject!.author}`);

    expect(
      profileLinks,
      `/nodes/${subject!.id} links \`/u/${subject!.author}\`, a handle that holds no account ` +
        `and 404s. The route's own \`author !== undefined\` ternary should be ` +
        `falling to its text arm — if a chip is rendering instead, the cutover is resolving ` +
        `an account for a handle that has none.`,
    ).toEqual([]);
  });
});

describe("and the must-not-change arm: the SAME card links once its author has an account", () => {
  /*
   * The control the implementer's store cannot render, closed as a FLIP with one variable.
   *
   * Every other cell here is a NEGATIVE — "no `/u/<handle>` href" — and a negative alone is
   * satisfied by a reader that answers `undefined` to everybody. A regression making
   * `getPublicAuthor` refuse every handle would leave the site linking NOBODY and pass this
   * whole file.
   *
   * So this renders THE SAME CARD, on the same page, before and after inserting an account
   * row for its own author. Nothing else moves — not the card, not the route, not the
   * actor. `getPublicAuthor` looks the handle up in `account`, so the row IS the variable.
   *
   * A first attempt seeded a NEW card under a new account instead, and it could never have
   * worked: `versionsOf` reads `loadSnapshot`, whose card index is built from cards PINNED
   * BY RELEASES, so a standalone `addCard` is invisible to the route by construction and
   * the page 404s. Measured, not reasoned — and recorded because "the card is public" is
   * the wrong model of what makes a card reachable here.
   */
  it("is text with no account row, and a link with one", async () => {
    expect(subject).toBeDefined();
    const linkFor = (html: string) =>
      [...html.matchAll(/href="([^"]*)"/g)]
        .map(([, href]) => href)
        .filter((href) => href === `/u/${subject!.author}`);

    // BEFORE: the state the fix delivers, re-measured here so the flip has a real baseline
    // rather than trusting the cell above ran first.
    const before = await render(subject!.id);
    expect(
      linkFor(before),
      `/nodes/${subject!.id} links its accountless author before the flip; the baseline for ` +
        `this control is already wrong`,
    ).toEqual([]);

    // THE ONE VARIABLE.
    await testDb!.client.db
      .insert(schema.account)
      .values({
        githubId: `t261-${subject!.author}`,
        githubLogin: `t261-${subject!.author}`,
        handle: subject!.author,
      });
    accountCreated = true;

    const after = await render(subject!.id);
    expect(
      linkFor(after).length,
      `the same card still renders NO profile link after \`${subject!.author}\` was given an ` +
        `account. \`getPublicAuthor\` is answering \`undefined\` for a handle an account ` +
        `really holds, so the text arm fires for everyone and the site links nobody — which ` +
        `passes every negative cell in this file and is a different defect, not the fix.`,
    ).toBeGreaterThan(0);

    expect(after, "the handle stopped being printed once it became a link").toContain(
      subject!.author,
    );
  });

  it("recorded that the flip really inserted its variable", () => {
    // Guards the cell above against passing because the insert silently did nothing.
    expect(accountCreated, "the account row was never inserted, so nothing flipped").toBe(true);
  });
});
