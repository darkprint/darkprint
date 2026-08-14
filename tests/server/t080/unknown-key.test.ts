/* ============================================================
   T080 AC5 — "an unknown owner/slug pair returns 404"

   The criterion has two halves and only one of them is in the
   read model. The reader answers `undefined`; the route maps that
   to `problem+json`. What makes AC5 a *security* criterion rather
   than a status-code criterion is the second sentence of the
   admissible-message clause: the refusal is "**identical in
   wording** to the answer for a private bundle the caller may not
   see, since B-03 requires 404 over 403 and a different message
   reinstates the leak the status code closed."

   So the assertion is a string equality between two responses,
   and it is checked over the whole problem document rather than
   over `detail` alone — an extension member (`"reason": "private"`,
   a `WWW-Authenticate`, a different `type`) reinstates the oracle
   just as effectively as a different sentence would.

   ── how the routes reach this database ──
   A route handler gets its `Db` from `getSharedDbClient()`, which
   reads `DATABASE_URL`. So the variable is repointed at this
   file's scratch database before any route module is loaded, and
   restored at teardown. vitest gives each file its own worker, so
   the repoint is scoped to this file.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSharedDbClient } from "@/lib/db";

import {
  type Scratch,
  anonymous,
  bind,
  callRoute,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyVersion,
  insertRelease,
  mark,
  scratchDatabase,
} from "./contract";

/** The two literals D-80-02 publishes. Written out, never imported from the module. */
const BLUEPRINT_DETAIL = "blueprint: no such bundle.";
const CARD_DETAIL = "card: no such card.";

const OPEN_SLUG = "open-bundle";
const CLOSED_SLUG = "closed-bundle";
const OPEN_CARD = "open-card";
const CLOSED_CARD = "closed-card";

let s: Scratch;
let handle: string;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  s = await scratchDatabase();
  const owner = await insertAccount(s, mark("t080-unknown"));
  handle = owner.handle;

  const open = await insertCard(s, { ownerId: owner.id, id: OPEN_CARD });
  const closed = await insertCard(s, {
    ownerId: owner.id,
    id: CLOSED_CARD,
    visibility: "private",
  });

  const ontology = await insertOntologyVersion(s, "0.1.0", "sha256:ontology-fixture");
  const openBundle = await insertBundle(s, { owner, slug: OPEN_SLUG });
  /* Scored, so the 200 control below can assert the published body shape without the
     `scores` half being ambiguous between "absent" and "the columns are null". */
  await insertRelease(s, {
    bundle: openBundle,
    version: "1.0.0",
    cards: [open, closed],
    autonomy: { autonomyClass: "supervised", level: 2, ontologyVersion: "0.1.0" },
    security: { level: 3, raw: 3, penalties: [], findings: [], rationale: "4 − 1.00 → 3", ontologyVersion: "0.1.0" },
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
    scoredOntologyVersionId: ontology.id,
  });

  const closedBundle = await insertBundle(s, { owner, slug: CLOSED_SLUG, visibility: "private" });
  await insertRelease(s, { bundle: closedBundle, version: "1.0.0", cards: [open] });

  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = s.url;
});

afterAll(async () => {
  /* Closed before the variable is restored, so the pool that gets shut is the scratch one
     and not a fresh handle on the shared development database. */
  try {
    await getSharedDbClient().close();
  } catch {
    /* Teardown is not under test: a route module that never loaded left no pool to close. */
  }
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  await dropScratchDatabases();
});

interface Problem {
  [member: string]: unknown;
}

async function problemOf(response: Response): Promise<Problem> {
  const type = response.headers.get("content-type");
  expect(
    type === null ? null : type.split(";")[0].trim(),
    `B-03: "Transport and auth failures use RFC 9457 \`problem+json\`."`,
  ).toBe("application/problem+json");
  return (await response.json()) as Problem;
}

/** RFC 9457 §3.1 makes `instance` the request path, so two different URLs differ there. */
function withoutInstance(problem: Problem): Problem {
  const copy = { ...problem };
  delete copy.instance;
  return copy;
}

describe("AC5 the reader half", () => {
  it("blueprint() answers undefined for an unknown slug under a known owner", async () => {
    const blueprint = await bind("blueprint");
    expect(await blueprint(s.db, anonymous, handle, "no-such-slug")).toBeUndefined();
  });

  it("blueprint() answers undefined for an unknown owner", async () => {
    const blueprint = await bind("blueprint");
    expect(await blueprint(s.db, anonymous, "no-such-owner-handle", OPEN_SLUG)).toBeUndefined();
  });

  it("blueprint() answers the same undefined for a private bundle as for an unknown one", async () => {
    const blueprint = await bind("blueprint");
    const unknown = await blueprint(s.db, anonymous, handle, "no-such-slug");
    const priv = await blueprint(s.db, anonymous, handle, CLOSED_SLUG);
    expect(
      priv,
      `Admissible message forms: the refusal for an unknown \`(owner, slug)\` is "identical ` +
        `in wording to the answer for a private bundle the caller may not see". At the ` +
        `reader that means the same value, since the reader carries no wording.`,
    ).toStrictEqual(unknown);
  });

  it("scoresOf() answers undefined for both, so the score is no oracle either", async () => {
    const scoresOf = await bind("scoresOf");
    expect(await scoresOf(s.db, anonymous, handle, "no-such-slug")).toBeUndefined();
    expect(
      await scoresOf(s.db, anonymous, handle, CLOSED_SLUG),
      `\`scoresOf\` takes the same \`(ownerHandle, slug)\` key as \`blueprint\`, so it is a ` +
        `second existence oracle unless it refuses identically.`,
    ).toBeUndefined();
  });
});

describe("AC5 the route half", () => {
  it("answers 404 problem+json for an unknown owner/slug pair", async () => {
    const response = await callRoute("blueprint", `/api/blueprints/${handle}/no-such-slug`);
    expect(response.status).toBe(404);
    const problem = await problemOf(response);
    expect(
      problem.detail,
      `D-80-02: "every 404 is \`problem+json\` with \`detail\` exactly ` +
        `${JSON.stringify(BLUEPRINT_DETAIL)}". The expected string is written out here ` +
        `rather than imported, because a test that builds its expectation from the module ` +
        `asserts only that the module agrees with itself.`,
    ).toBe(BLUEPRINT_DETAIL);
    expect(problem.status).toBe(404);
  });

  it("answers 404 for a private bundle rather than 403", async () => {
    const response = await callRoute("blueprint", `/api/blueprints/${handle}/${CLOSED_SLUG}`);
    expect(
      response.status,
      `B-03: "A private resource the caller may not see returns 404, never 403, so existence ` +
        `does not leak."`,
    ).toBe(404);
  });

  it("words the private refusal identically to the unknown one", async () => {
    const unknown = await problemOf(
      await callRoute("blueprint", `/api/blueprints/${handle}/no-such-slug`),
    );
    const priv = await problemOf(
      await callRoute("blueprint", `/api/blueprints/${handle}/${CLOSED_SLUG}`),
    );
    expect(
      withoutInstance(priv),
      `A different message reinstates the existence oracle the 404 closed, and it is ` +
        `testable from outside. Compared over the whole problem document minus \`instance\` ` +
        `(RFC 9457 §3.1 makes that the request path, which legitimately differs): an ` +
        `extension member such as \`"reason": "private"\` leaks exactly as much as a ` +
        `different sentence would.`,
    ).toStrictEqual(withoutInstance(unknown));
    expect(priv.detail).toBe(BLUEPRINT_DETAIL);
  });

  it("words a private card's refusal identically to an unknown card's", async () => {
    const unknown = await problemOf(
      await callRoute("card", "/api/cards/no-such-card@1.0.0"),
    );
    const priv = await problemOf(
      await callRoute("card", `/api/cards/${CLOSED_CARD}@1.0.0`),
    );
    expect(unknown.detail, `D-80-02 publishes ${JSON.stringify(CARD_DETAIL)}.`).toBe(CARD_DETAIL);
    expect(withoutInstance(priv)).toStrictEqual(withoutInstance(unknown));
  });

  it("answers 200 for a bundle that does exist, so the 404s above are not the only answer", async () => {
    const response = await callRoute("blueprint", `/api/blueprints/${handle}/${OPEN_SLUG}`);
    expect(
      response.status,
      `The control for the four assertions above: a route that answered 404 to everything ` +
        `would satisfy every one of them and serve nothing.`,
    ).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(
      Object.keys(body).sort(),
      `D-80-02: \`GET /api/blueprints/[owner]/[slug] -> { blueprint: BlueprintSummary, ` +
        `scores: Scores }\`.`,
    ).toEqual(["blueprint", "scores"]);
  });
});
