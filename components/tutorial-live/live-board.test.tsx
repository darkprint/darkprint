/* ============================================================
   The live page, rendered from fixtures.

   Two drafts drive everything: the starter blueprint read off
   `content/`, which resolves, and a three-node topology with one
   card, which does not. The renderer takes a state and never
   fetches, so every cell below is `renderToStaticMarkup` over a
   plain object, and the poll's decisions are checked over the
   state machine beside it with fake responses.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { loadBundle, type BundleManifest } from "@/lib/core";
import {
  LIVE_PHASES,
  LIVE_PHASE_LABELS,
  type LiveDraft,
  type LivePhase,
  type LiveRecord,
} from "@/lib/core/tutorial/live";
import LivePage, { metadata as pageMetadata } from "@/app/tutorial/live/[token]/page";
import { MCP_CLIENTS } from "@/components/mcp/clients";
import { pinnedRefs } from "@/components/panes/build";
import { plainText } from "@/components/ui/visible-text";

import { enrichPrompt, livePageUrl, pictureOf } from "./draft";

/** The address the board prints for its own page; any origin the reader is on works. */
const LIVE_URL = livePageUrl("https://www.darkprint.io", "b".repeat(32));
import { LiveExpired } from "./LiveExpired";
import {
  DraftPanel,
  HonestyLine,
  LiveBoardView,
  NextStep,
  PhaseStrip,
  RegistryHits,
} from "./LiveBoardView";
import {
  INITIAL,
  POLL_MS,
  RETRY_MS,
  advance,
  conditionalHeaders,
  readOutcome,
  type BoardState,
  type PollResponse,
} from "./poll";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";

/* --------------------- fixtures --------------------- */

function card(ref: string): string {
  return readFileSync(join(ROOT, "content/cards", `${ref}.yaml`), "utf8");
}

/** The starter blueprint, exactly as `content/` holds it: five nodes, five cards. */
function starterDraft(phase: LivePhase): LiveDraft {
  const dir = join(ROOT, "content/blueprints/starter-software-factory");
  const manifest = parse(readFileSync(join(dir, "blueprint.yaml"), "utf8")) as BundleManifest;
  const dot = readFileSync(join(dir, "topology.dot"), "utf8");
  const cardFiles: Record<string, string> = {};
  for (const ref of pinnedRefs(dot).values()) cardFiles[`cards/${ref}.yaml`] = card(ref);
  return {
    phase,
    task: "Watch the listed prices of a few trading cards every morning.",
    bundle: { manifest, dot, cardFiles },
  };
}

const PARTIAL_DOT = `digraph price_watch {
  planner [card="spec-planner@1.0.0"];
  builder [card="code-builder@1.0.0"];
  tester  [card="acceptance-tester@1.0.0"];
  planner -> tester [label="acceptance criteria"];
  builder -> tester [label="build"];
}
`;

/** Three nodes pinned, one card written: the shape of an interview in its nodes phase. */
function partialDraft(phase: LivePhase = "nodes"): LiveDraft {
  return {
    phase,
    task: "Watch the listed prices of a few trading cards every morning.",
    bundle: {
      manifest: { slug: "price-watch", title: "Price watch", summary: "Prices, daily.", tags: [] },
      dot: PARTIAL_DOT,
      cardFiles: { "cards/spec-planner@1.0.0.yaml": card("spec-planner@1.0.0") },
    },
  };
}

function record(draft: LiveDraft, revision = 3): LiveRecord {
  return {
    token: TOKEN,
    revision,
    updatedAt: "2026-09-07T10:00:00.000Z",
    expiresAt: "2026-09-08T10:00:00.000Z",
    draft,
  };
}

function live(draft: LiveDraft): BoardState {
  return { status: "live", record: record(draft), etag: '"3"', reconnecting: false };
}

function html(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

/**
 * The rendered text with the typographic apostrophe folded to the keyboard one, so a
 * sentence written with `&rsquo;` can be asserted without an invisible character in the
 * test file.
 */
function text(markup: string): string {
  return plainText(markup).replace(/[‘’]/g, "'");
}

/* --------------------- the pictures --------------------- */

describe("what the engine resolves from each draft", () => {
  it("does not pass vacuously: the partial draft is a blueprint with fewer nodes than ids", () => {
    const result = loadBundle(partialDraft().bundle);
    expect(result.blueprint).toBeDefined();
    expect(result.blueprint?.graph.ids).toEqual(["planner", "builder", "tester"]);
    expect(result.blueprint?.nodes.map((node) => node.nodeId)).toEqual(["planner"]);
  });

  it("resolves the starter into the pane model and the graph", () => {
    const picture = pictureOf(starterDraft("written"));
    expect(picture.kind).toBe("resolved");
    if (picture.kind !== "resolved") return;
    expect(picture.graph.nodes.map((node) => node.id)).toEqual([
      "planner",
      "builder",
      "tester",
      "debugger",
      "deployer",
    ]);
    // The skeleton's line ranges come from the card documents, keyed by the ref each
    // document spells, so every node's card carries its YAML.
    for (const node of picture.model.nodes) {
      expect(node.card?.yaml, `${node.nodeId} has no document`).toBeTruthy();
    }
  });

  it("lists the partial draft's nodes with the cards still pending", () => {
    const picture = pictureOf(partialDraft());
    expect(picture.kind).toBe("partial");
    if (picture.kind !== "partial") return;
    expect(picture.parsed).toBe(true);
    expect(picture.nodes).toEqual([
      { id: "planner", ref: "spec-planner@1.0.0", carded: true },
      { id: "builder", ref: "code-builder@1.0.0", carded: false },
      { id: "tester", ref: "acceptance-tester@1.0.0", carded: false },
    ]);
    expect(picture.edges).toEqual([
      { source: "planner", target: "tester", label: "acceptance criteria" },
      { source: "builder", target: "tester", label: "build" },
    ]);
    expect(picture.diagnostics.map((d) => d.code)).toContain("bundle/missing-card");
  });

  it("lists a node the DOT only names inside an edge, with no card pinned", () => {
    const draft = partialDraft();
    draft.bundle.dot = PARTIAL_DOT.replace("builder -> tester", "builder -> tester;\n  tester -> writer");
    const picture = pictureOf(draft);
    expect(picture.kind).toBe("partial");
    if (picture.kind !== "partial") return;
    expect(picture.nodes.map((node) => node.id)).toEqual(["planner", "builder", "tester", "writer"]);
    expect(picture.nodes.at(-1)).toEqual({ id: "writer", carded: false });
    const shown = plainText(html(createElement(DraftPanel, { draft, liveUrl: livePageUrl("https://www.darkprint.io", TOKEN) })));
    expect(shown).toContain("writer no card pinned card pending");
  });

  it("reads an empty topology as nothing to draw yet, and a broken one as unparsed", () => {
    const empty = partialDraft();
    empty.bundle.dot = "   ";
    expect(pictureOf(empty).kind).toBe("empty");

    const broken = partialDraft();
    broken.bundle.dot = "digraph { planner -> ";
    const picture = pictureOf(broken);
    expect(picture.kind).toBe("partial");
    if (picture.kind !== "partial") return;
    expect(picture.parsed).toBe(false);
    expect(picture.diagnostics.length).toBeGreaterThan(0);
  });
});

/* --------------------- the header --------------------- */

describe("the phase strip", () => {
  it("names every phase, marks the current one and ticks the ones before it", () => {
    const markup = html(createElement(PhaseStrip, { current: "ports" }));
    const text = plainText(markup);
    for (const phase of LIVE_PHASES) {
      expect(text, `${phase} is not named`).toContain(LIVE_PHASE_LABELS[phase]);
    }
    expect(markup.match(/aria-current="step"/g)?.length).toBe(1);
    // `ports` is the fourth phase, so three are done.
    expect(markup.match(/, done<\/span>/g)?.length).toBe(LIVE_PHASES.indexOf("ports"));
    const current = /<li[^>]*aria-current="step"[^>]*>[\s\S]*?<\/li>/.exec(markup)?.[0] ?? "";
    expect(plainText(current)).toContain(LIVE_PHASE_LABELS.ports);
  });

  it("ticks nothing at the first phase and everything before the last", () => {
    expect(html(createElement(PhaseStrip, { current: "need" }))).not.toContain(", done<");
    expect(
      html(createElement(PhaseStrip, { current: "published" })).match(/, done<\/span>/g)?.length,
    ).toBe(LIVE_PHASES.length - 1);
  });
});

/* --------------------- the graph --------------------- */

describe("the graph panel", () => {
  it("draws a resolving draft with the blueprint page's own panel", () => {
    const markup = html(createElement(DraftPanel, { draft: starterDraft("written"), liveUrl: livePageUrl("https://www.darkprint.io", TOKEN) }));
    expect(markup).toContain('aria-label="The graph and the card skeleton"');
    expect(plainText(markup)).toContain("Jump to a node");
    expect(plainText(markup)).not.toContain("card pending");
  });

  it("lists a partial draft's pending nodes and what is still to settle", () => {
    const markup = html(createElement(DraftPanel, { draft: partialDraft(), liveUrl: livePageUrl("https://www.darkprint.io", TOKEN) }));
    const text = plainText(markup);
    expect(text).toContain("The graph so far");
    expect(text).toContain("3 nodes · 2 edges · 2 cards pending");
    // One mark per node, and each says which.
    const rows = [...markup.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => plainText(m[1]));
    expect(rows.find((row) => row.startsWith("planner"))).toContain("card written");
    expect(rows.find((row) => row.startsWith("builder"))).toContain("card pending");
    expect(rows.find((row) => row.startsWith("tester"))).toContain("card pending");
    expect(text).toContain("planner → to tester");
    expect(text).toContain("Still to settle");
    expect(text).toContain("bundle/missing-card");
    expect(markup).not.toContain('aria-label="The graph and the card skeleton"');
  });

  it("never shows an empty panel: an empty topology waits, with the page address", () => {
    const empty = partialDraft("need");
    empty.bundle.dot = "";
    const shown = text(html(createElement(DraftPanel, { draft: empty, liveUrl: livePageUrl("https://www.darkprint.io", TOKEN) })));
    expect(shown).toContain("Waiting for your agent's first answer");
    expect(shown).toContain(livePageUrl("https://www.darkprint.io", TOKEN));
    expect(shown).toContain(TOKEN);
  });
});

/* --------------------- the registry hits --------------------- */

describe("the registry hits", () => {
  it("links blueprints and cards to their pages, with the score to two decimals", () => {
    const markup = html(
      createElement(RegistryHits, {
        hits: [
          { kind: "blueprint", ref: "autogen/pipeline-observability", title: "Pipeline observability", score: 0.8312 },
          { kind: "card", ref: "berti/trace-emitter@1.2.0", title: "Trace emitter", score: 0.5 },
        ],
      }),
    );
    expect(markup).toContain('href="/blueprints/autogen/pipeline-observability"');
    expect(markup).toContain('href="/nodes/berti/trace-emitter"');
    const text = plainText(markup);
    expect(text).toContain("Found in the registry");
    expect(text).toContain("0.83");
    expect(text).toContain("0.50");
    expect(text).toContain("2 hits");
  });

  it("says so when the search came back empty", () => {
    const text = plainText(html(createElement(RegistryHits, { hits: [] })));
    expect(text).toContain("returned nothing");
  });
});

/* --------------------- the next step --------------------- */

describe("the next step, per phase", () => {
  it("prints the MCP install command from the clients table at the written phase", () => {
    const markup = html(createElement(NextStep, { draft: starterDraft("written"), liveUrl: LIVE_URL }));
    const text = plainText(markup);
    expect(text).toContain("Next: enrich it");
    // The constant itself, never a retyped copy of it.
    expect(markup).toContain(MCP_CLIENTS[0].snippet);
    for (const client of MCP_CLIENTS) expect(text).toContain(client.label);
    expect(text).toContain(enrichPrompt("starter-software-factory", LIVE_URL));
    expect(text).toContain("./starter-software-factory/");
    expect(text).toContain("the DarkPrint skill's enrich mode");
  });

  it("points at sign-in and the publish page at the enriched phase", () => {
    const markup = html(createElement(NextStep, { draft: starterDraft("enriched"), liveUrl: LIVE_URL }));
    expect(plainText(markup)).toContain("Next: keep it");
    expect(markup).toContain('href="/welcome"');
    expect(markup).toContain('href="/upload"');
    expect(plainText(markup)).toContain("defaults to private");
  });

  it("links the published blueprint when the agent said where it went", () => {
    const draft = { ...starterDraft("published"), publishedRef: "berti/price-watch" };
    const markup = html(createElement(NextStep, { draft, liveUrl: LIVE_URL }));
    expect(markup).toContain('href="/blueprints/berti/price-watch"');
    expect(markup).not.toContain('href="/welcome"');
  });

  it("offers no link when the published draft carries no ref, and says where to look", () => {
    const markup = html(createElement(NextStep, { draft: starterDraft("published"), liveUrl: LIVE_URL }));
    expect(markup).not.toContain('href="/blueprints/');
    // `/welcome` bounces a finished account to the landing, so it is not a door here.
    expect(markup).not.toContain('href="/welcome"');
    expect(markup).not.toContain("<a ");
    expect(plainText(markup)).toContain("did not say where");
  });

  it("tells the reader to keep answering before the folder is written", () => {
    for (const phase of ["need", "reuse", "nodes", "ports", "guards", "risk"] as const) {
      const text = plainText(html(createElement(NextStep, { draft: partialDraft(phase), liveUrl: LIVE_URL })));
      expect(text, phase).toContain("Keep answering in your agent; this page follows.");
      expect(text, phase).not.toContain("Next:");
    }
  });
});

/* --------------------- the whole board --------------------- */

describe("the board", () => {
  it("carries the honesty line at every phase, and while waiting", () => {
    const sentence = "This page shows the draft your agent posted. Nothing here runs it.";
    expect(plainText(html(createElement(HonestyLine)))).toContain(sentence);
    for (const phase of LIVE_PHASES) {
      const draft = phase === "written" || phase === "enriched" || phase === "published"
        ? starterDraft(phase)
        : partialDraft(phase);
      const text = plainText(html(createElement(LiveBoardView, { state: live(draft), token: TOKEN, origin: "https://www.darkprint.io" })));
      expect(text, phase).toContain(sentence);
      expect(text, phase).toContain(draft.task ?? "");
    }
    expect(plainText(html(createElement(LiveBoardView, { state: INITIAL, token: TOKEN, origin: "https://www.darkprint.io" })))).toContain(
      sentence,
    );
  });

  it("waits with the page address before the first record arrives", () => {
    const shown = text(html(createElement(LiveBoardView, { state: INITIAL, token: TOKEN, origin: "https://www.darkprint.io" })));
    expect(shown).toContain("Waiting for your agent's first answer");
    expect(shown).toContain(TOKEN);
  });

  it("shows the expired state on its own, with the way to a new page", () => {
    const markup = html(createElement(LiveBoardView, { state: { status: "expired" }, token: TOKEN, origin: "https://www.darkprint.io" }));
    expect(plainText(markup)).toContain("This live page has expired");
    expect(markup).toContain('href="/tutorial"');
    expect(plainText(markup)).not.toContain("Waiting for your agent");
    expect(html(createElement(LiveExpired))).toContain('href="/tutorial"');
  });

  it("says it is reconnecting without dropping the last draft", () => {
    const state: BoardState = { ...live(partialDraft()), reconnecting: true } as BoardState;
    const text = plainText(html(createElement(LiveBoardView, { state, token: TOKEN, origin: "https://www.darkprint.io" })));
    expect(text).toContain("Reconnecting");
    expect(text).toContain("The graph so far");
  });

  it("lists the hits only when the draft carries them", () => {
    const without = plainText(html(createElement(LiveBoardView, { state: live(partialDraft()), token: TOKEN, origin: "https://www.darkprint.io" })));
    expect(without).not.toContain("Found in the registry");
    const draft = { ...partialDraft("reuse"), hits: [] };
    const withHits = plainText(html(createElement(LiveBoardView, { state: live(draft), token: TOKEN, origin: "https://www.darkprint.io" })));
    expect(withHits).toContain("Found in the registry");
  });
});

/* --------------------- the route --------------------- */

/** The props Next hands the page: both promises, since the route type requires the pair. */
function pageProps(token: string): PageProps<"/tutorial/live/[token]"> {
  return { params: Promise.resolve({ token }), searchParams: Promise.resolve({}) };
}

describe("the page shell", () => {
  it("refuses a malformed token before anything renders, and stays out of the index", async () => {
    await expect(LivePage(pageProps("not-a-token"))).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
    expect(pageMetadata.title).toBe("Your blueprint, live");
    expect(pageMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders the board under a plain link back to the tutorial", async () => {
    const markup = html(await LivePage(pageProps(TOKEN)));
    expect(markup).toContain('href="/tutorial"');
    const shown = text(markup);
    expect(shown).toContain("Back to the tutorial");
    expect(shown).toContain("Your blueprint, live");
    // The server render is the board's waiting state; the poll only starts in the browser.
    expect(shown).toContain("Waiting for your agent's first answer");
    expect(markup).not.toMatch(/max-w-|prose-lane/);
  });
});

/* --------------------- the poll --------------------- */

function response(status: number, body?: unknown, etag?: string): PollResponse {
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "etag" ? (etag ?? null) : null) },
    json: () => (body === undefined ? Promise.reject(new Error("no body")) : Promise.resolve(body)),
  };
}

describe("the poll's decisions", () => {
  it("reads 200, 304, 404 and everything else into the four outcomes", async () => {
    const draft = partialDraft();
    expect(await readOutcome(response(200, record(draft), '"3"'))).toEqual({
      kind: "updated",
      record: record(draft),
      etag: '"3"',
    });
    expect(await readOutcome(response(304))).toEqual({ kind: "unchanged" });
    expect(await readOutcome(response(404))).toEqual({ kind: "expired" });
    expect(await readOutcome(response(500))).toEqual({ kind: "failed" });
    // A 200 with a body the contract refuses is a failure, never a state the board shows.
    expect(await readOutcome(response(200, { token: TOKEN, revision: 1 }))).toEqual({ kind: "failed" });
    expect(await readOutcome(response(200))).toEqual({ kind: "failed" });
  });

  it("polls every two seconds while the interview runs and stops at published", () => {
    const first = advance(INITIAL, { kind: "updated", record: record(partialDraft()), etag: '"1"' });
    expect(first.next.status).toBe("live");
    expect(first.delayMs).toBe(POLL_MS);
    expect(conditionalHeaders(first.next)).toEqual({ "If-None-Match": '"1"' });
    expect(conditionalHeaders(INITIAL)).toEqual({});

    const same = advance(first.next, { kind: "unchanged" });
    expect(same.next).toEqual(first.next);
    expect(same.delayMs).toBe(POLL_MS);

    const done = advance(first.next, {
      kind: "updated",
      record: record(starterDraft("published"), 9),
      etag: '"9"',
    });
    expect(done.next.status).toBe("live");
    expect(done.delayMs).toBeUndefined();
    expect(advance(done.next, { kind: "unchanged" }).delayMs).toBeUndefined();
  });

  it("backs off to ten seconds on a failure and keeps the last record", () => {
    const held = advance(INITIAL, { kind: "updated", record: record(partialDraft()), etag: '"1"' }).next;
    const failed = advance(held, { kind: "failed" });
    expect(failed.delayMs).toBe(RETRY_MS);
    expect(failed.next.status).toBe("live");
    expect(failed.next.status === "live" && failed.next.reconnecting).toBe(true);
    expect(failed.next.status === "live" && failed.next.record.revision).toBe(3);
    // Still reconnecting before anything arrived, and the conditional header stays off.
    const early = advance(INITIAL, { kind: "failed" });
    expect(early.next).toEqual({ status: "waiting", reconnecting: true });
    expect(conditionalHeaders(early.next)).toEqual({});
    // The next good answer clears the flag.
    const back = advance(failed.next, { kind: "unchanged" });
    expect(back.next.status === "live" && back.next.reconnecting).toBe(false);
  });

  it("expires on 404 and never polls again", () => {
    const gone = advance(live(partialDraft()), { kind: "expired" });
    expect(gone.next).toEqual({ status: "expired" });
    expect(gone.delayMs).toBeUndefined();
    const after = advance(gone.next, { kind: "updated", record: record(partialDraft()), etag: null });
    expect(after.next).toEqual({ status: "expired" });
    expect(after.delayMs).toBeUndefined();
  });
});

/* --------------------- the copy --------------------- */

/**
 * The rules `components/site/copy-rules.test.ts` holds the guarded trees to, applied to
 * this directory and its route file. That test lists its trees by hand and this directory
 * is not in the list; until it is, the same scan runs here so the copy is not unguarded in
 * the meantime. Comments come out first, the way that file does it, so a comment naming
 * the character is not a breach.
 */
function visibleCopy(source: string): string {
  return source
    .replace(/(^|[\s{(=,])\/\*[\s\S]*?\*\//g, "$1")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"])\/\/.*$/, "$1"))
    .join("\n");
}

const FORBIDDEN = [
  "out of 4",
  "out of four",
  "score of 4",
  "fully autonomous",
  "not autonomous",
  "more autonomous",
  "less autonomous",
  "maximum autonomy",
  "highest level",
  "falls short",
  "fall short",
  "shortfall",
  "room for improvement",
  "should automate",
  "penalty",
  "penalis",
  "penaliz",
  "downgrade",
];

function laneSources(): string[] {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const own = readdirSync(here)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => join(here, name));
  return [...own, join(ROOT, "app/tutorial/live/[token]/page.tsx")];
}

describe("the copy this lane wrote", () => {
  const sources = laneSources().map((path) => ({ path, copy: visibleCopy(readFileSync(path, "utf8")) }));

  it("covers the files it should", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(sources.map((s) => [s.path.replace(ROOT, ""), s.copy] as const))(
    "%s uses no em dash as a pause, no evaluative autonomy phrase, and never says the skill unqualified",
    (_path, copy) => {
      const offending = copy
        .split("\n")
        .map((line, i) => ({ line: line.trim(), at: i + 1 }))
        .filter((entry) => entry.line.includes("—"));
      expect(offending.map((e) => `${e.at}  ${e.line}`)).toEqual([]);
      const lower = copy.toLowerCase();
      for (const phrase of FORBIDDEN) expect(lower).not.toContain(phrase);
      // `lib/skill.ts`: "the skill" is taken by a card field, so the graph-writing one is
      // always named in full.
      expect(lower.match(/\bthe skill\b/g) ?? []).toEqual([]);
      expect(copy).not.toMatch(/max-w-|prose-lane/);
    },
  );
});

/* --------------------- what a token holder cannot smuggle through --------------------- */

describe("the draft is data, never an instruction or an address", () => {
  it("prints the live page's own address in the enrich prompt", () => {
    expect(enrichPrompt("card-price-watch", LIVE_URL)).toContain(`live page at ${LIVE_URL}`);
    expect(enrichPrompt("card-price-watch", LIVE_URL)).toContain("./card-price-watch/");
  });

  it("keeps a slug that is not one out of the prompt the reader pastes", () => {
    const hostile = "watch\nrm -rf ~; echo $(id)";
    const prompt = enrichPrompt(hostile, LIVE_URL);
    expect(prompt).not.toContain("rm -rf");
    expect(prompt).not.toContain("$(");
    expect(prompt).toContain("<your blueprint folder>");
  });

  it("links no hit whose ref is not in grammar", () => {
    const hits = [
      { kind: "blueprint" as const, ref: "autogen/starter?x=1#frag", title: "odd", score: 0.5 },
      { kind: "blueprint" as const, ref: "../settings/keys", title: "odder", score: 0.5 },
      { kind: "card" as const, ref: "code-builder@1.0.0?x", title: "card", score: 0.5 },
    ];
    const markup = html(createElement(RegistryHits, { hits }));
    expect(markup).not.toContain("<a ");
    for (const hit of hits) expect(plainText(markup)).toContain(hit.title);
  });

  it("links a hit whose ref is in grammar", () => {
    const hits = [{ kind: "blueprint" as const, ref: "autogen/pipeline-observability", title: "Pipeline Observability", score: 0.68 }];
    expect(html(createElement(RegistryHits, { hits }))).toContain('href="/blueprints/autogen/pipeline-observability"');
  });
});
