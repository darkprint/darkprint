/* ============================================================
   T100 — POST /api/bundles

   The one route §T100's Owns names, and the half the barrel cannot
   express: which HTTP status each refusal kind becomes, and that
   the wire shape is not the barrel shape.

   ── the statuses are D-100-01's, quoted rather than inferred ──
       conflict            409
       not-owner           404   (B-03: existence does not leak)
       unfinished          422
       in-error            422
       version-not-higher  422
   and the three foreign typed rejections that reach a caller of
   `publish()` with their messages unaltered, each keeping one
   author:
       MalformedVocabularyError      (T010)  400
       UnknownOntologyVersionError   (T030)  422
       CardStoreError                (T020)  422
   with `ArchiveConflictError` (T010) added by D-100-03 as a fourth,
   mapped to 409 — reachable only under a race, because the read
   that AC8 refuses on happens before the transaction opens.

   **404 for `not-owner` is the one worth stating twice.** It is not
   403. A 403 tells a stranger that `alice/secret-project` exists,
   which is exactly the leak B-03 closes, so the refusal a non-owner
   sees is indistinguishable from the one they would see for a
   namespace nobody has taken.

   ── how a route test gets off the shared database ──
   A route handler takes no `Db`; it reaches for
   `getSharedDbClient()`, which `lib/db/client.ts` caches on
   `globalThis` behind `Symbol.for("darkprint.db.sharedClient")`, a
   slot documented as existing so the pool survives Next's hot
   reload. A scratch client is installed there before the first
   request and removed after the last, so nothing here opens the
   shared `darkprint` database. The substitution is CHECKED rather
   than assumed — see the first cell.

   ── what is inferred here, and is flagged rather than hidden ──
   D-100-01 published the route, the method and the statuses, and
   ruled that `vocabulary` crosses the wire as a plain YAML STRING
   joined at the route "as `/api/validate/bundle` does". It did not
   spell out the remaining field names, so this file sends the
   `PublishInput` members under their own names, which is what
   `/api/validate/bundle` does with the three it shares. If the
   implementer chose otherwise, these cells red on a naming choice
   rather than on a criterion — reported to the orchestrator as an
   open question rather than settled here.

   Unauthenticated and operator callers are NOT asserted: no ruling
   covers either, and guessing 401 against an implementation that
   answers 404 would be this author's reading reaching a status
   code. Charged to the orchestrator instead.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DbClient } from "@/lib/db";
import { SESSION_COOKIE_NAME, encodeSession } from "@/lib/server/auth";
import { isProblemContentType, readProblem } from "../contract";

import {
  RecordedSetup,
  inErrorVariant,
  resolvingCorpus,
  revisionOf,
  scratchDatabase,
  seedOwner,
  unfinishedVariant,
  type Corpus,
  type Owner,
  type Scratch,
} from "./fixtures";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");
type GlobalWithSharedClient = typeof globalThis & { [SHARED_CLIENT_KEY]?: DbClient };

const ROUTE = "@/app/api/bundles/route";
const ORIGIN = "http://localhost";

type Handler = (request: Request) => Promise<Response>;

interface Env {
  scratch: Scratch;
  alice: Owner;
  bob: Owner;
  base: Corpus;
  revision: Corpus;
  previousClient: DbClient | undefined;
}

const setup = new RecordedSetup<Env>("The routes scratch database and shared-client slot");

/**
 * `POST /api/bundles`, or a red naming the clause that published it.
 *
 * Loaded inside each cell for the same reason `contract.ts` loads the barrel dynamically: a
 * static import of an absent route file fails the whole FILE at collection and hides every
 * status behind one red.
 */
async function post(body: unknown, cookie?: string): Promise<Response> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import("@/app/api/bundles/route")) as unknown as Record<string, unknown>;
  } catch (cause) {
    throw new Error(
      `${ROUTE} does not load.\n` +
        `  backend.md §T100 Owns \`app/api/bundles/**\`, and D-100-01 published the route as ` +
        `POST /api/bundles.\n` +
        `  This is a failed acceptance criterion — the publish endpoint is absent — and not a ` +
        `broken test.`,
      { cause },
    );
  }
  const handler = mod["POST"];
  if (typeof handler !== "function") {
    throw new Error(
      `${ROUTE} exports no \`POST\`. It exports: ${Object.keys(mod).sort().join(", ") || "(nothing)"}`,
    );
  }
  return await (handler as Handler)(
    new Request(`${ORIGIN}/api/bundles`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie === undefined ? {} : { cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
}

function sessionFor(owner: Owner): string {
  return `${SESSION_COOKIE_NAME}=${encodeSession({
    accountId: owner.accountId,
    handle: owner.handle,
  })}`;
}

function submission(owner: Owner, slug: string, version: string, corpus: Corpus): unknown {
  return {
    ownerHandle: owner.handle,
    slug,
    version,
    manifest: corpus.manifest,
    dot: corpus.dot,
    cardFiles: corpus.cardFiles,
  };
}

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("routes");
    const base = resolvingCorpus();
    const previousClient = (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = scratch.client;
    return {
      scratch,
      alice: await seedOwner(scratch, "route-alice"),
      bob: await seedOwner(scratch, "route-bob"),
      base,
      revision: revisionOf(base),
      previousClient,
    };
  });
});

afterAll(async () => {
  const env = setup.optional();
  if (env === undefined) return;
  /* Restored rather than deleted: another suite in this worker may have installed one. */
  if (env.previousClient === undefined) {
    delete (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY];
  } else {
    (globalThis as GlobalWithSharedClient)[SHARED_CLIENT_KEY] = env.previousClient;
  }
  await env.scratch.drop();
});

describe("T100 POST /api/bundles", () => {
  it("uses the installed scratch client — the premise of every cell below", async () => {
    const env = setup.require();

    /* alice exists ONLY in the scratch database. A 2xx here is proof the route resolved her
       through the installed client; a 404 would mean it built its own pool against the shared
       `darkprint`, and every status cell below would have been measuring an empty database. */
    const response = await post(
      submission(env.alice, "route-premise", "1.0.0", env.base),
      sessionFor(env.alice),
    );

    expect(
      response.status,
      `The route answered ${response.status} for a publish by an account that exists only in ` +
        `${env.scratch.name}. Either publishing is broken, or the route is not reading through ` +
        `\`Symbol.for("darkprint.db.sharedClient")\` and this file has been testing the shared ` +
        `database.\n  Body: ${await response.clone().text()}`,
    ).toBeLessThan(300);
  });

  it("answers a conflict 409", async () => {
    const env = setup.require();
    await post(submission(env.alice, "route-conflict", "1.0.0", env.base), sessionFor(env.alice));

    const response = await post(
      submission(env.alice, "route-conflict", "2.0.0", env.base),
      sessionFor(env.alice),
    );

    expect(
      response.status,
      `Republishing identical bytes answered ${response.status}; D-100-01 maps \`conflict\` to ` +
        `409.\n  Body: ${await response.clone().text()}`,
    ).toBe(409);
  });

  it("answers a non-owner 404, not 403 — existence must not leak", async () => {
    const env = setup.require();
    await post(submission(env.alice, "route-private", "1.0.0", env.base), sessionFor(env.alice));

    const existing = await post(
      submission(env.alice, "route-private", "2.0.0", env.revision),
      sessionFor(env.bob),
    );
    const absent = await post(
      submission(env.alice, "route-never-taken", "1.0.0", env.base),
      sessionFor(env.bob),
    );

    expect(
      existing.status,
      `bob publishing onto alice's existing bundle answered ${existing.status}; D-100-01 maps ` +
        `\`not-owner\` to 404 per B-03, because 403 tells a stranger the bundle exists.\n` +
        `  Body: ${await existing.clone().text()}`,
    ).toBe(404);

    /* The two must be INDISTINGUISHABLE. A 404 for the existing bundle and a different status
       for a namespace nobody has taken re-opens by difference the leak the 404 was chosen to
       close: a prober learns which slugs alice holds by watching the status change. */
    expect(
      absent.status,
      `A slug alice never took answered ${absent.status} while her existing one answered ` +
        `${existing.status}. The two must be indistinguishable or the status itself is the leak.`,
    ).toBe(existing.status);
  });

  it("answers unfinished, in-error and version-not-higher 422", async () => {
    const env = setup.require();
    await post(submission(env.alice, "route-422", "2.0.0", env.base), sessionFor(env.alice));

    const unfinished = await post(
      submission(env.alice, "route-422-unfinished", "1.0.0", unfinishedVariant(env.base, 2)),
      sessionFor(env.alice),
    );
    const inError = await post(
      submission(env.alice, "route-422-in-error", "1.0.0", inErrorVariant(env.base)),
      sessionFor(env.alice),
    );
    const notHigher = await post(
      submission(env.alice, "route-422", "1.0.0", env.revision),
      sessionFor(env.alice),
    );

    expect(
      {
        unfinished: unfinished.status,
        inError: inError.status,
        versionNotHigher: notHigher.status,
      },
      "D-100-01 maps `unfinished`, `in-error` and `version-not-higher` to 422.",
    ).toEqual({ unfinished: 422, inError: 422, versionNotHigher: 422 });
  });

  it("answers refusals as RFC 9457 problem documents", async () => {
    const env = setup.require();
    const response = await post(
      submission(env.alice, "route-problem", "1.0.0", inErrorVariant(env.base)),
      sessionFor(env.alice),
    );

    expect(
      isProblemContentType(response.headers.get("content-type")),
      `A refusal came back as \`${response.headers.get("content-type")}\` rather than ` +
        `\`application/problem+json\`.`,
    ).toBe(true);

    const problem = await readProblem(response);
    expect(problem.status, "The problem document's `status` disagrees with the HTTP status.").toBe(
      response.status,
    );

    /* The whitelist, at the transport boundary. "No diagnostic text from the engine appears in
       the message" applies to what a caller receives, not only to what the class carries —
       diagnostics travel in the 200-with-diagnostics envelope (B-03), and a route that inlined
       them here would be the second rendering the rule forbids. */
    const serialized = JSON.stringify(problem);
    const leaked = ["port-mismatch", "no-such-port", "also-missing", "bundle/"].filter((token) =>
      serialized.includes(token),
    );
    expect(
      leaked,
      `Engine diagnostic text reached the problem document: ${leaked.join(", ")}.\n  ${serialized}`,
    ).toEqual([]);
  });

  it("takes `vocabulary` as a YAML string on the wire, not as `StoredVocabulary`", async () => {
    const env = setup.require();
    const { contentVocabulary } = await import("@/lib/content/read");
    const overlay = contentVocabulary();
    if (overlay === undefined) throw new Error("content/ontology/extensions.yaml did not load.");

    /* D-100-01: the wire carries YAML source and the route joins it, "as `/api/validate/bundle`
       does" (`app/api/validate/bundle/route.ts:56-70`). `StoredVocabulary` is what crosses the
       BARREL, not what crosses the wire — so a route typed on the barrel's shape would reject
       the body a client is told to send. */
    const response = await post(
      {
        ...(submission(env.alice, "route-vocabulary", "1.0.0", env.base) as object),
        vocabulary: overlay.text,
      },
      sessionFor(env.alice),
    );

    expect(
      response.status,
      `A submission carrying \`vocabulary\` as a YAML string answered ${response.status}.\n` +
        `  Body: ${await response.clone().text()}`,
    ).toBeLessThan(300);

    /* And the bytes survive the join: the route parses the YAML into terms and pairs them with
       the source, which is what D-90-03 requires the column to hold. */
    const { getBundle, listReleases } = await import("@/lib/server/archive");
    const bundle = await getBundle(env.scratch.db, env.alice.accountId, "route-vocabulary");
    const releases = bundle === undefined ? [] : await listReleases(env.scratch.db, bundle.id);

    expect(
      releases[0]?.vocabulary?.text,
      "The route stored no vocabulary bytes for a submission that sent them. The YAML string " +
        "is joined into `{ text, terms }` at the route, and `text` is the file byte for byte.",
    ).toBe(overlay.text);
  });
});
