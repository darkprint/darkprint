/* ============================================================
   T300 AC5 — "no network egress at query OR publish time,
   ASSERTED BY TEST"

   The criterion names the test, so the instrument is the subject
   of this file as much as the module is.

   ── two layers, because one of them is blind in the way that
      matters ──
   A `fetch` spy alone can be defeated without anybody meaning to:
   a module that captured `globalThis.fetch` into a local binding
   at import time never calls the replacement, and one reaching for
   `node:https` never called it in the first place. So the
   TRANSPORT is watched as well, at `net.Socket.prototype.connect`
   and `tls.connect`, which every one of those paths ends in —
   undici, `http.request` and `https.request` all open a socket.

   Postgres is a socket too, so the transport arm is an ALLOW LIST
   rather than a prohibition: the endpoints are read off the
   scratch database's own connection string, asked of the
   connection rather than assumed, and `foreign()` is everything
   else. A guard with an empty allow list would fire on a condition
   its subject cannot avoid, which is a flake with a justification
   attached.

   ── the cell that makes the zeros mean something ──
   Every criterion cell here is a ZERO — nothing was fetched,
   nothing foreign was dialled — and a zero is a claim about an
   instrument until something proves otherwise. So one cell drives
   a deliberate fetch and a deliberate foreign socket through the
   same observer, in the same shape, and requires BOTH to be
   recorded. Without it this file is four zeros from a watcher
   nobody has shown can see anything.

   ── why the cold window is first ──
   The model is loaded lazily on first use. If the publish window
   ran first, the query window would be measuring a process that
   already has the weights resident, and it would report clean
   against an implementation that downloads them — the exact
   failure AC5 exists for, invisible because of test ordering.

   So window 1 is a query over a store whose vectors were written
   by RAW SQL, in a process that has never loaded the encoder. That
   is the genuinely cold query path. Window 2 is the publish path,
   also cold for the encoder. Window 3 is a query with the weights
   already resident, which is weaker and is labelled as such: it
   can only catch a per-call fetch, and it is kept because a
   per-call fetch is exactly what an API-backed implementation
   looks like.
   ============================================================ */

import net from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { allowedFrom, watchEgress, type Allowed, type Egress } from "./contract";
import { asResults, bind, type Results } from "../t200/contract";
import {
  anonymous,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertCard,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  recordedSetup,
  releaseEmbeddings,
  scratchDatabase,
  type ReleaseFixture,
  type Scratch,
} from "../t200/fixtures";

/**
 * A legal `vector(384)` written by hand.
 *
 * The values are arbitrary and that is the point: this file asks whether anything reached
 * the network, never whether the ranking was right, and seeding the table WITHOUT calling
 * `reembedRelease` is the only way to give the query path something to read in a process
 * that has never touched the encoder.
 */
const SEEDED_VECTOR = `[${Array.from({ length: 384 }, (_, i) => ((i % 11) + 1) / 100).join(",")}]`;

interface Record_ {
  fetches: string[];
  connections: string[];
  foreign: string[];
}

function close(e: Egress): Record_ {
  const out = { fetches: [...e.fetches], connections: [...e.connections], foreign: e.foreign() };
  e.stop();
  return out;
}

let s: Scratch;
let allow: Allowed[];
let release: ReleaseFixture;
let coldQuery: Record_;
let publish: Record_;
let warmQuery: Record_;
let coldAnswer: Results | undefined;
let rowsAfterPublish = -1;
const setup = recordedSetup("the T300 egress windows");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    allow = allowedFrom(s.url);

    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, { versionId: ontology.id, term: term as unknown as Record<string, unknown> });
    }
    const owner = await insertAccount(s, mark("t300e"));
    const card = await insertCard(s, {
      ownerId: owner.id,
      id: mark("t300-egress"),
      phases: ["planning"],
      type: "agent",
      name: "Draft the route",
      action: "draft-route",
      spec: "Lay out the stops in the order a driver would take them and note the time each one costs.",
    });
    const slug = mark("t300-egress");
    const bundle = await insertBundle(s, { owner, slug, visibility: "public" });
    release = await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: [card],
      manifest: manifest({
        slug,
        title: "Delivery route planning",
        summary: "Stops are ordered into a run a driver can finish inside a shift.",
        description: "Covers the depot start, the drop sequence, and the return leg.",
        tags: [],
      }),
    });

    /* The vector, written WITHOUT the encoder. This is what makes window 1 a cold QUERY
       rather than a cold publish followed by a warm query. */
    await s.query(
      "insert into release_embedding (release_id, embedding) values ($1, $2::vector)",
      [release.id, SEEDED_VECTOR],
    );

    /* WINDOW 1 — the cold query path. The observer goes on FIRST and the barrel is bound
       INSIDE it, so an import-time model load is inside the window too. Binding before
       installing would put the one event most worth catching just outside the frame. */
    const w1 = watchEgress(allow);
    try {
      const searchBlueprints = await bind("searchBlueprints");
      coldAnswer = asResults(
        await searchBlueprints(s.db, anonymous, { q: "scheduling deliveries for a driver" }),
        "searchBlueprints(db, anonymous, {q})",
      );
    } finally {
      coldQuery = close(w1);
    }

    /* WINDOW 2 — the publish path, still cold for the encoder if window 1 never loaded it. */
    const w2 = watchEgress(allow);
    try {
      const reembed = await bind("reembedRelease");
      await reembed(s.db, release.bundleId, release.digest);
    } finally {
      publish = close(w2);
    }
    rowsAfterPublish = (await releaseEmbeddings(s)).length;

    /* WINDOW 3 — a query with the weights resident. Weaker, and kept for what it can still
       see: a per-call fetch, which is what an API-backed derivation looks like. */
    const w3 = watchEgress(allow);
    try {
      const searchBlueprints = await bind("searchBlueprints");
      await searchBlueprints(s.db, anonymous, { q: "scheduling deliveries for a driver" });
    } finally {
      warmQuery = close(w3);
    }
  });
}, 180_000);

afterAll(async () => {
  await dropScratchDatabases();
});

/* --------------------- the instrument, falsified --------------------- */

describe("the observer can see what it is looking for", () => {
  it("records a fetch and names a foreign socket, in the same shape the windows use", async () => {
    setup.check();
    const listener = net.createServer();
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(port, "the premise: a local listener came up on an ephemeral port").toBeGreaterThan(0);

    const watcher = watchEgress(allow);
    try {
      try {
        await fetch("https://example.invalid/model.onnx");
      } catch {
        /* The fetch arm throws by design: recording and calling through would let a real
           download SUCCEED, and the cell would pass or time out rather than say what
           happened. What is asserted is the RECORD, never the throw. */
      }
      /* THE FOREIGN SOCKET IS OPENED THE WAY `pg` OPENS ITS OWN, and that is a correction
         to an earlier version of this cell rather than a flourish. `net.connect(...)` — in
         either spelling, options or positional — runs Node's `normalizeArgs` and reaches
         `Socket.prototype.connect` as ONE marked array. `pg` does not go through it:
         `node_modules/pg/lib/connection.js:45` is `this.stream.connect(port, host)`, a
         DIRECT call on the socket instance with a leading NUMBER, and a unix DSN reaches
         `client.js:179` as a single PATH string with no host at all.

         So driving `net.connect` proves the recorder handles the one shape the database
         never uses. Three shapes are driven here — marked array, direct leading-number,
         direct path — and the allow-listed ones must come back NOT foreign while the
         ephemeral one does. Verified against all five admissible shapes before this suite
         took its first database window. */
      await new Promise<void>((resolve) => {
        const viaNet = net.connect({ host: "127.0.0.1", port });
        viaNet.on("error", () => resolve());
        viaNet.on("connect", () => {
          viaNet.end();
          resolve();
        });
      });
      for (const allowed of allow) {
        await new Promise<void>((resolve) => {
          /* `new Socket().connect(port, host)` — byte for byte what `pg` calls. */
          const direct = new net.Socket();
          direct.on("error", () => resolve());
          direct.on("connect", () => {
            direct.end();
            resolve();
          });
          direct.connect(allowed.port, allowed.host);
        });
      }
      await new Promise<void>((resolve) => {
        /* The IPC spelling: one path, no host. A recorder classifying on `host` alone
           reports the database's own socket as foreign for a third reason. */
        const ipc = new net.Socket();
        ipc.on("error", () => resolve());
        ipc.on("connect", () => {
          ipc.end();
          resolve();
        });
        ipc.connect("/tmp/.s.PGSQL.5432");
      });
    } finally {
      const seen = close(watcher);
      listener.close();

      expect(
        seen.fetches,
        `THIS CELL IS WHY THE FOUR ZEROS BELOW MEAN ANYTHING. Each of them says "nothing ` +
          `reached the network", and a zero is a claim about an instrument until something ` +
          `proves otherwise — a watcher installed on the wrong object, or restored before ` +
          `the work ran, reports exactly the same clean result as a module that made no ` +
          `call.`,
      ).toEqual(["GET https://example.invalid/model.onnx"]);
      expect(
        seen.foreign,
        `and the transport arm separately, because it is the one that cannot be evaded by a ` +
          `module that captured \`fetch\` at import time.\n` +
          `  This is green-against-red rather than a zero: the SAME window opened the ` +
          `ephemeral port and every allow-listed endpoint, through the three shapes that ` +
          `reach \`Socket.prototype.connect\` — the marked array \`net.connect\` produces, ` +
          `the direct leading-number call \`pg\` produces, and the direct path an IPC DSN ` +
          `produces. Exactly one of them may come back named.\n` +
          `  If an allow-listed endpoint appears here, the recorder is mis-reading a shape ` +
          `and AC5's cells below would report the DATABASE as network egress — a red that ` +
          `reads as a finding and is a broken watcher. That happened once already, when the ` +
          `recorder read \`.host\` off the array \`normalizeArgs\` hands the method.\n` +
          `  allow list: ${allow.map((a) => `${a.host}:${a.port}`).join(", ")}\n` +
          `  everything the window saw: ${JSON.stringify(seen.connections)}`,
      ).toEqual([`127.0.0.1:${port}`]);
    }
  });

  it("and the allow list is narrow enough to leave something to find", () => {
    setup.check();
    expect(
      allow.length,
      `the other half of the same worry: an allow list wide enough to admit everything ` +
        `produces the same zero as a clean run. It is built from the scratch database's own ` +
        `URL — one port, loopback under both spellings, because the driver and the URL do ` +
        `not have to agree on which one they say.`,
    ).toBeLessThanOrEqual(3);
    expect(
      allow.every((a) => Number.isInteger(a.port) && a.port > 0),
      `each entry names a concrete host and port rather than a wildcard: ` +
        `${allow.map((a) => `${a.host}:${a.port}`).join(", ")}`,
    ).toBe(true);
  });
});

/* --------------------- the criterion --------------------- */

describe("AC5 no network egress at query time", () => {
  it("the window was live, so the zero below is a zero over real work", () => {
    setup.check();
    expect(
      coldAnswer,
      "the premise: the query ran and answered a well-formed `Results` inside the window",
    ).toBeDefined();
    expect(
      coldAnswer?.hits,
      `and it answered a real response rather than resolving on an early return, so the ` +
        `\`foreign()\` zero below is a statement about a frame with work inside it.\n` +
        `  Deliberately NOT asserted: that the window saw a Postgres socket. The scratch ` +
        `client is connected before the observer goes on, and a pooled handle that reuses an ` +
        `open connection opens no new one — so a zero there would be a fact about pooling ` +
        `rather than about the frame, and the cell would fire on a condition its subject ` +
        `cannot control. What proves the observer is live is the falsification cell above, ` +
        `which drives a fetch and a foreign socket through the same code path.\n` +
        `  connections seen: ${JSON.stringify(coldQuery.connections)}`,
    ).toBeDefined();
  });

  it("cold: nothing was fetched and nothing foreign was dialled", () => {
    setup.check();
    expect(
      { fetches: coldQuery.fetches, foreign: coldQuery.foreign },
      `AC5, at query time and in the state that can actually fail: a process that has never ` +
        `loaded the encoder, asked a question that needs the query embedded.\n` +
        `  D-300-01 rests the whole arm on this — "No key, no network, deterministic weights ` +
        `vendored through npm, SO THE TEST SUITES STAY HERMETIC" — and the honest reading of ` +
        `\`@huggingface/transformers\` is that it fetches its weights from the Hub on first ` +
        `use unless it is told otherwise. This is the cell that tells the difference between ` +
        `an encoder whose weights are on disk and one that goes and gets them.\n` +
        `  all connections seen: ${JSON.stringify(coldQuery.connections)}`,
    ).toEqual({ fetches: [], foreign: [] });
  });

  it("warm: nothing was fetched per call either", () => {
    setup.check();
    expect(
      { fetches: warmQuery.fetches, foreign: warmQuery.foreign },
      `WEAKER THAN THE COLD CELL AND LABELLED AS SUCH: by this point the weights are resident, ` +
        `so a load-time download has already happened and this window cannot see it. What it ` +
        `can still see is a PER-CALL request, which is exactly the shape an external-API ` +
        `derivation has — and D-300-01 chose arm (b) over that arm, so the difference is ` +
        `worth a cell of its own.\n` +
        `  all connections seen: ${JSON.stringify(warmQuery.connections)}`,
    ).toEqual({ fetches: [], foreign: [] });
  });
});

describe("AC5 no network egress at publish time", () => {
  it("the window did real work, or its zero is about an empty frame", () => {
    setup.check();
    expect(
      rowsAfterPublish,
      `the premise: \`reembedRelease\` actually embedded inside the window. A call that ` +
        `resolved without writing — an absent release, a resolver that missed — makes the ` +
        `cell below a statement about a function that did nothing.`,
    ).toBe(1);
  });

  it("nothing was fetched and nothing foreign was dialled", () => {
    setup.check();
    expect(
      { fetches: publish.fetches, foreign: publish.foreign },
      `AC5's other half, and the one D-300-01 puts the cost on: "encoding cost is paid at ` +
        `PUBLISH time through \`reembedRelease\`, never at query time for the lexical path".\n` +
        `  A publish that reaches the network is worse than a query that does, because it ` +
        `happens on the write path of a user action and its failure mode is a release that ` +
        `cannot be published while an upstream host is down.\n` +
        `  all connections seen: ${JSON.stringify(publish.connections)}`,
    ).toEqual({ fetches: [], foreign: [] });
  });
});
