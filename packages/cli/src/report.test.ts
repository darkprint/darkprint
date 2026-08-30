/* ============================================================
   `darkprint report`, driven in-process.

   The verb writes, so the cells here are about two things and not
   about happy paths.

   ── one: what the run directory can and cannot say ──
   Attractor's §5.6 layout records no token usage anywhere.
   `status.json`'s five fields (Appendix C) are routing and prose,
   and nothing in §5 counts a token or a price. `costUnits` is the
   figure that lands in a PUBLISHED median, so a zero standing in
   for "we did not measure it" is not a gap in that median — it is a
   cheap run, and it moves the number every reader of the bundle
   page sees. The refusal is asserted, and so is the thing the
   refusal is protecting: the body sent carries the cost the caller
   typed and nothing scales it.

   ── two: the offline order ──
   Every refusal has to happen BEFORE the socket opens. A verb that
   posts and then finds out `--cost` was missing has already told
   the registry something. So the fetch stub COUNTS its calls and
   the refusal cells assert zero, which is a claim a `rejects.toThrow`
   on its own cannot make.

   No real network: the `fetch` is injected, the way T270's own
   suite does it (D-270-05(2)).
   ============================================================ */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { collectingIo } from "./io";
import { readRunDirectory, report, RUN_CHECKPOINT, RUN_MANIFEST, RUN_STATUS } from "./report";
import { runCli } from "./run";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-cli-report-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const OWNER = "lupo";
const SLUG = "frontline-triage";
const STARTED = "2026-08-30T09:00:00.000Z";
/** Ninety seconds after the start, so the derived duration is a number worth asserting. */
const CHECKPOINT = "2026-08-30T09:01:30.000Z";
const NINETY_SECONDS = 90_000;

/** A session cookie value. Never a real one, and never printed by anything under test. */
const SESSION = "test-session-value";

interface RunShape {
  manifest?: Record<string, unknown> | null;
  checkpoint?: Record<string, unknown> | null;
  nodes?: Record<string, Record<string, unknown> | null>;
  artifacts?: string[];
}

/** One run directory in §5.6's layout, written to a fresh scratch folder. */
let made = 0;
function makeRun(shape: RunShape = {}): string {
  const dir = join(scratch, `run-${made++}`);
  mkdirSync(dir, { recursive: true });

  const manifest =
    shape.manifest === undefined
      ? { name: "frontline triage", goal: "answer the ticket", started_at: STARTED }
      : shape.manifest;
  if (manifest !== null) writeFileSync(join(dir, RUN_MANIFEST), JSON.stringify(manifest));

  const checkpoint =
    shape.checkpoint === undefined
      ? { timestamp: CHECKPOINT, current_node: "reply", completed_nodes: ["intake", "reply"] }
      : shape.checkpoint;
  if (checkpoint !== null) writeFileSync(join(dir, RUN_CHECKPOINT), JSON.stringify(checkpoint));

  const nodes = shape.nodes ?? {
    intake: { outcome: "success", notes: "read the ticket" },
    reply: { outcome: "success" },
  };
  for (const [id, status] of Object.entries(nodes)) {
    mkdirSync(join(dir, id), { recursive: true });
    if (status !== null) writeFileSync(join(dir, id, RUN_STATUS), JSON.stringify(status));
  }

  mkdirSync(join(dir, "artifacts"), { recursive: true });
  for (const name of shape.artifacts ?? ["a1.json"]) {
    writeFileSync(join(dir, "artifacts", name), "{}");
  }
  return dir;
}

/** The route, recorded. `calls` is what makes "refused offline" a checkable claim. */
function fakeRegistry() {
  const calls: { url: string; method: string; body: unknown; cookie: string | null }[] = [];
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      cookie: headers.get("cookie"),
    });
    return new Response(
      JSON.stringify({
        reported: {
          runs: 4,
          median: 0.42,
          spread: { p10: 0.3, p90: 0.6 },
          model: "claude-opus-4-6",
          excluded: 1,
          isSample: false,
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { calls, fetch: fetchStub };
}

/** Everything the verb needs beyond the run directory, so a cell can drop exactly one. */
function complete(fetchStub: typeof fetch) {
  return {
    target: `${OWNER}/${SLUG}`,
    cost: 1.25,
    model: "claude-opus-4-6",
    provider: "anthropic",
    hardware: "m4-max-64gb",
    harnessVersion: "attractor-0.4.1",
    inputSize: 3,
    session: SESSION,
    baseUrl: "https://registry.test",
    fetch: fetchStub,
  };
}

describe("reading a run directory", () => {
  it("reads §5.6's layout: the manifest, the checkpoint, the node statuses and the artifacts", () => {
    const run = readRunDirectory(makeRun());
    expect(run.startedAt?.toISOString()).toBe(STARTED);
    expect(run.startedFrom).toBe("started_at");
    expect(run.checkpointAt?.toISOString()).toBe(CHECKPOINT);
    expect(run.nodes.map((n) => n.id)).toEqual(["intake", "reply"]);
    expect(run.nodes[0].outcome).toBe("success");
    expect(run.artifacts).toBe(1);
  });

  /* The spec describes `manifest.json` in five words and names no field, so the reader is
     deliberately tolerant. The key it BELIEVED is carried back, and the verb prints it —
     a guess stated is different from a guess made. */
  it.each([
    ["started_at", "started_at"],
    ["startedAt", "startedAt"],
    ["start_time", "start_time"],
    ["createdAt", "createdAt"],
  ])("reads the start time from `%s`", (key, expected) => {
    const run = readRunDirectory(makeRun({ manifest: { name: "x", [key]: STARTED } }));
    expect(run.startedAt?.toISOString()).toBe(STARTED);
    expect(run.startedFrom).toBe(expected);
  });

  /* §5.3 NAMES `timestamp`, so exactly one spelling is read there. The tolerance above is
     for the file whose fields the spec never names, and a checkpoint reader that guessed
     would make the two indistinguishable to a reader of the module. */
  it("reads only `timestamp` from the checkpoint, because the spec names that field", () => {
    const run = readRunDirectory(makeRun({ checkpoint: { checkpointed_at: CHECKPOINT } }));
    expect(run.checkpointAt).toBeUndefined();
  });

  it("accepts a unix instant in seconds or in milliseconds", () => {
    const seconds = readRunDirectory(makeRun({ manifest: { started_at: 1_788_166_800 } }));
    const millis = readRunDirectory(makeRun({ manifest: { started_at: 1_788_166_800_000 } }));
    expect(seconds.startedAt?.toISOString()).toBe(millis.startedAt?.toISOString());
  });

  it("treats a node with no status.json as a node that has not run, not as an error", () => {
    const run = readRunDirectory(makeRun({ nodes: { intake: { outcome: "success" }, reply: null } }));
    expect(run.nodes.map((n) => n.id)).toEqual(["intake", "reply"]);
    expect(run.nodes[1].outcome).toBeUndefined();
  });

  it("refuses a directory with no manifest, and a manifest that is not JSON", () => {
    expect(() => readRunDirectory(makeRun({ manifest: null }))).toThrow(/manifest\.json/);
    const dir = makeRun();
    writeFileSync(join(dir, RUN_MANIFEST), "{ not json");
    expect(() => readRunDirectory(dir)).toThrow(/not readable JSON/);
  });
});

describe("the cost, which the run directory cannot supply", () => {
  it("refuses to send anything when no cost was given, and says why", async () => {
    const registry = fakeRegistry();
    const options = complete(registry.fetch);
    delete (options as { cost?: number }).cost;

    await expect(report(makeRun(), options)).rejects.toThrow(/--cost/);
    /* The claim a `rejects.toThrow` cannot make on its own: nothing was sent. A verb that
       posted and then threw has already put a report in the aggregate. */
    expect(registry.calls, "the verb reached the network before refusing").toHaveLength(0);
  });

  it("names the median as the reason, so nobody replaces the flag with a zero", async () => {
    const options = complete(fakeRegistry().fetch);
    delete (options as { cost?: number }).cost;
    await expect(report(makeRun(), options)).rejects.toThrow(/MEDIAN/);
  });

  /* And the value is carried through unscaled. D-180-01 refuses the normalisation these
     figures would need, so a client that helpfully converted anything would be inventing a
     reference this product does not have. */
  it("sends the cost exactly as it was given", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), { ...complete(registry.fetch), cost: 0.0000001 });
    expect((registry.calls[0].body as { costUnits: number }).costUnits).toBe(0.0000001);
  });

  it("accepts a zero a caller actually typed", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), { ...complete(registry.fetch), cost: 0 });
    expect((registry.calls[0].body as { costUnits: number }).costUnits).toBe(0);
  });

  it("refuses a negative cost", async () => {
    const registry = fakeRegistry();
    await expect(report(makeRun(), { ...complete(registry.fetch), cost: -1 })).rejects.toThrow(
      /not negative/,
    );
    expect(registry.calls).toHaveLength(0);
  });
});

describe("what IS mapped from the directory", () => {
  it("derives the duration from the manifest's start and the last checkpoint", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), complete(registry.fetch));
    const body = registry.calls[0].body as { durationMs: number; occurredAt: string };
    expect(body.durationMs).toBe(NINETY_SECONDS);
    expect(body.occurredAt).toBe(STARTED);
  });

  /* `occurredAt` goes as an ISO STRING, because the route does `new Date(body.occurredAt)`
     and a number would arrive there as an `Invalid Date` and be refused as malformed with
     no clue which field was wrong. */
  it("sends occurredAt as an ISO string the route can convert back", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), complete(registry.fetch));
    const sent = (registry.calls[0].body as { occurredAt: string }).occurredAt;
    expect(typeof sent).toBe("string");
    expect(new Date(sent).getTime()).toBe(new Date(STARTED).getTime());
  });

  it("takes the model from the manifest when the runner wrote one", async () => {
    const registry = fakeRegistry();
    const options = complete(registry.fetch);
    delete (options as { model?: string }).model;
    await report(
      makeRun({ manifest: { started_at: STARTED, llm_model: "gpt-5.2" } }),
      options,
    );
    expect((registry.calls[0].body as { model: string }).model).toBe("gpt-5.2");
  });

  it("lets an explicit --model win over the manifest", async () => {
    const registry = fakeRegistry();
    await report(
      makeRun({ manifest: { started_at: STARTED, model: "gpt-5.2" } }),
      { ...complete(registry.fetch), model: "claude-opus-4-6" },
    );
    expect((registry.calls[0].body as { model: string }).model).toBe("claude-opus-4-6");
  });

  it("refuses when the manifest has no start time, naming the spellings it looked for", async () => {
    const registry = fakeRegistry();
    await expect(
      report(makeRun({ manifest: { name: "x" } }), complete(registry.fetch)),
    ).rejects.toThrow(/started_at/);
    expect(registry.calls).toHaveLength(0);
  });

  it("refuses when there is no checkpoint to end the run at", async () => {
    const registry = fakeRegistry();
    await expect(report(makeRun({ checkpoint: null }), complete(registry.fetch))).rejects.toThrow(
      /timestamp/,
    );
    expect(registry.calls).toHaveLength(0);
  });

  it("refuses a checkpoint that precedes the start rather than sending a negative duration", async () => {
    const registry = fakeRegistry();
    await expect(
      report(
        makeRun({ checkpoint: { timestamp: "2026-08-30T08:00:00.000Z" } }),
        complete(registry.fetch),
      ),
    ).rejects.toThrow(/BEFORE the start time/);
    expect(registry.calls).toHaveLength(0);
  });
});

describe("the fields the layout records nowhere", () => {
  /* Named TOGETHER, in one refusal. Four required flags discovered four commands apart is
     the experience this block exists to prevent, and it is what the server's own
     `runs: the report is malformed.` would have given. */
  it.each(["model", "provider", "hardware", "harnessVersion", "inputSize"])(
    "refuses when `%s` cannot be supplied",
    async (field) => {
      const registry = fakeRegistry();
      const options = complete(registry.fetch);
      delete (options as Record<string, unknown>)[field];
      await expect(report(makeRun(), options)).rejects.toThrow(/A run report carries these/);
      expect(registry.calls).toHaveLength(0);
    },
  );

  it("names every missing one at once", async () => {
    const registry = fakeRegistry();
    const options = complete(registry.fetch) as Record<string, unknown>;
    for (const field of ["provider", "hardware", "harnessVersion"]) delete options[field];
    await expect(report(makeRun(), options)).rejects.toThrow(
      /--provider <name>, --hardware <description>, --harness <version>/,
    );
  });

  /* `parseFlags` gives `--model` written with no value after it the empty string, so a
     verb that treated "" as a value would send it and be refused by the server with a
     sentence naming no field. Read as absent instead, which produces the refusal that
     names the flag. */
  it.each(["model", "provider", "hardware", "harnessVersion"])(
    "reads an empty `%s` as absent rather than as a value",
    async (field) => {
      const registry = fakeRegistry();
      const options = complete(registry.fetch) as Record<string, unknown>;
      options[field] = "";
      await expect(report(makeRun(), options)).rejects.toThrow(/A run report carries these/);
      expect(registry.calls).toHaveLength(0);
    },
  );

  /* And the same check a programmatic caller reaches without going through `run.ts`'s flag
     parsing. `wellFormed` wants a non-negative integer and answers "malformed" naming
     nothing, so the refusal happens here where the field can be named. */
  it.each([2.5, -1])("refuses an --input-size of %s before the network", async (inputSize) => {
    const registry = fakeRegistry();
    await expect(
      report(makeRun(), { ...complete(registry.fetch), inputSize }),
    ).rejects.toThrow(/whole number/);
    expect(registry.calls).toHaveLength(0);
  });

  /* The one that would be easy and wrong. `os.cpus()` is right there, and the machine
     running this command need not be the machine that ran the pipeline — the registry never
     observes a run, so a hardware label read off the reporter is a claim about the wrong
     computer. Asserted as a refusal rather than as a comment. */
  it("does not read `hardware` off the machine reporting the run", async () => {
    const registry = fakeRegistry();
    const options = complete(registry.fetch);
    delete (options as { hardware?: string }).hardware;
    await expect(report(makeRun(), options)).rejects.toThrow(/not read off this machine/);
  });
});

describe("the credential and the address", () => {
  it("sends the session as a cookie, because no write route accepts an API key", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), complete(registry.fetch));
    expect(registry.calls[0].cookie).toBe(`darkprint_session=${SESSION}`);
  });

  it("refuses offline when there is no session", async () => {
    const registry = fakeRegistry();
    const options = complete(registry.fetch);
    delete (options as { session?: string }).session;
    const saved = process.env.DARKPRINT_SESSION;
    delete process.env.DARKPRINT_SESSION;
    try {
      await expect(report(makeRun(), options)).rejects.toThrow(/DARKPRINT_SESSION/);
      expect(registry.calls).toHaveLength(0);
    } finally {
      if (saved !== undefined) process.env.DARKPRINT_SESSION = saved;
    }
  });

  it("posts to the addressed bundle's runs route, with every segment encoded", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), { ...complete(registry.fetch), target: "lu po/front slug" });
    expect(registry.calls[0].method).toBe("POST");
    expect(registry.calls[0].url).toBe(
      "https://registry.test/api/blueprints/lu%20po/front%20slug/runs",
    );
  });

  it("refuses a target that is not <owner>/<slug>, before the network", async () => {
    const registry = fakeRegistry();
    for (const target of ["frontline-triage", "a/b/c", "/b", "a/"]) {
      await expect(report(makeRun(), { ...complete(registry.fetch), target })).rejects.toThrow(
        /--target/,
      );
    }
    expect(registry.calls).toHaveLength(0);
  });

  /* Omitted means the bundle's CURRENT release, resolved server-side (D-180-01). A client
     default here would be a second answer to a question the route already answers. */
  it("omits releaseDigest unless the caller named one", async () => {
    const registry = fakeRegistry();
    await report(makeRun(), complete(registry.fetch));
    expect(Object.hasOwn(registry.calls[0].body as object, "releaseDigest")).toBe(false);

    await report(makeRun(), { ...complete(registry.fetch), digest: "sha256:abc" });
    expect((registry.calls[1].body as { releaseDigest: string }).releaseDigest).toBe("sha256:abc");
  });
});

describe("what the verb prints", () => {
  it("puts what was claimed on stdout and what was believed on stderr", async () => {
    const registry = fakeRegistry();
    const result = await report(makeRun(), complete(registry.fetch));
    expect(result.sent.costUnits).toBe(1.25);
    expect(result.startedFrom).toBe("started_at");
    expect(result.outcomes).toEqual({ success: 2 });
    expect(result.reported?.median).toBe(0.42);
  });

  it("counts a node that never wrote a status, so a half-finished run is visible", async () => {
    const registry = fakeRegistry();
    const result = await report(
      makeRun({ nodes: { intake: { outcome: "success" }, reply: null, gate: { outcome: "fail" } } }),
      complete(registry.fetch),
    );
    expect(result.outcomes).toEqual({ success: 1, fail: 1, "no status.json": 1 });
  });
});

describe("through `runCli`", () => {
  /* The dispatcher's own refusals, which happen before the verb is called at all. Driven
     through `runCli` because a wrong exit code is invisible from the verb. */
  it("refuses with 1 and no output on stdout when the run directory is not named", async () => {
    const io = collectingIo();
    expect(await runCli(["report"], io)).toBe(1);
    expect(io.stdout.join("")).toBe("");
    expect(io.stderr.join("")).toContain("name the run directory");
  });

  it("refuses a --cost that is not a number, distinctly from an absent one", async () => {
    const io = collectingIo();
    expect(await runCli(["report", makeRun(), "--target", "a/b", "--cost", "cheap"], io)).toBe(1);
    expect(io.stderr.join("")).toContain("--cost must be a number");
  });

  it("refuses a fractional --input-size", async () => {
    const io = collectingIo();
    const argv = ["report", makeRun(), "--target", "a/b", "--cost", "1", "--input-size", "2.5"];
    expect(await runCli(argv, io)).toBe(1);
    expect(io.stderr.join("")).toContain("--input-size must be a whole number");
  });

  it("renders a CliError's message and returns 1 without a stack", async () => {
    const io = collectingIo();
    expect(await runCli(["report", makeRun(), "--target", "a/b", "--cost", "1"], io)).toBe(1);
    const err = io.stderr.join("");
    expect(err).toContain("A run report carries these");
    expect(err).not.toContain("at Object");
  });

  it("lists the report in the usage block, so a reader can find it", async () => {
    const io = collectingIo();
    expect(await runCli(["--help"], io)).toBe(0);
    expect(io.stderr.join("")).toContain("darkprint report <run-dir>");
    expect(io.stderr.join("")).toContain("DARKPRINT_SESSION");
  });
});
