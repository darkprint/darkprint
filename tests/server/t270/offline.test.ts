/* ============================================================
   T270 AC6 — `validate` works with no network
   plus the rendering clause, which became drivable at D-270-03

   AC6 narrowed to `validate` alone: `bump` is a NETWORK verb
   (D-270-01 C8, previous fetched through provenance and the files
   routes), and the section's own prose said otherwise until
   D-270-03 narrowed the third and last statement of that set. A
   cell running `bump` with the network down would red a correct
   implementation, so this file drives `validate` and nothing else.

   ── "network unavailable, not merely unconfigured" ──
   The block's words, and they rule out the cheap version of this
   test. Leaving `DARKPRINT_URL` unset proves nothing: a CLI that
   silently defaults to the public registry and swallows the
   failure passes it. So `fetch` is REPLACED with one that throws,
   which is a machine with no network rather than a machine with
   no configuration.

   ── the rendering clause ──
   "renders only what the server sent plus the caller's own
   arguments. No credential, no endpoint, no stack, never a raw
   driver or HTTP body." Undrivable until `io` was published; now
   it has a surface. The needles are taken from state the CELL DID
   NOT PASS IN — an environment variable — because a refusal is
   entitled to quote its own arguments, and a needle drawn from
   the caller's input false-charges every honest error message.
   ============================================================ */

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateBundle } from "@/lib/server/engine";

import { bindVerb, loadCli, recordingIo, RUN_CLI } from "./contract";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ARCHIVE, cleanupFolders, EXTENSIONS, OVERLAY_SLUG, writeBundleFolder } from "./fixtures";

/** The archive's own overlay bytes — the same source the AC1 cells use. */
const VOCABULARY_TEXT = readFileSync(
  fileURLToPath(new URL("../../../content/ontology/extensions.yaml", import.meta.url)),
  "utf8",
);

afterAll(cleanupFolders);

/** Every network entry point this process exposes, replaced with a throw. */
let realFetch: typeof globalThis.fetch;
let reached = 0;

beforeEach(() => {
  realFetch = globalThis.fetch;
  reached = 0;
  globalThis.fetch = (() => {
    reached += 1;
    throw new Error("ENETDOWN: the network is unavailable in this test");
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("AC6 — `validate` reaches nothing", () => {
  it.each(ARCHIVE.map((bundle) => bundle.slug))(
    "%s — validates with `fetch` throwing, and never calls it",
    async (slug) => {
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      /* The overlay bundle needs its overlay ON DISK, or the CLI resolves against the curated
         core while the server half below is handed `extensions` — a legitimate disagreement
         about a folder the two halves were not given equally. Exactly the AC1 cells' own
         construction; omitting it here cost one false red at first contact, on
         `frontline-triage` alone, which is the 1-of-9 the overlay measurement predicted. */
      const dir = writeBundleFolder(entry.bundle, {
        manifest: "blueprint.yaml",
        ...(slug === OVERLAY_SLUG ? { vocabulary: VOCABULARY_TEXT } : {}),
      });

      const server = validateBundle({
        manifest: entry.bundle.manifest,
        dot: entry.bundle.dot,
        cardFiles: { ...entry.bundle.cardFiles },
        extensions: EXTENSIONS,
      });

      const validate = await bindVerb("validate");
      const actual = (await validate(dir as never)) as { diagnostics: unknown };

      /* Both halves of AC6, and the second is the one that matters. A CLI that CALLS the
         network, catches the failure and carries on would satisfy "it still works" while
         plainly reaching something — so the call count is asserted, not merely the result.
         `toBe(0)` excludes the bad output; a result check alone admits it. */
      expect(actual.diagnostics).toEqual(server.diagnostics);
      expect(reached, "`validate` called `fetch`").toBe(0);
    },
  );
});

describe("the rendering clause — what may reach `io`", () => {
  it("never renders a stack", async () => {
    /* Driven on a directory that does not exist, because that is the error path where a
       naive implementation prints the caught exception whole. The needle is the frame
       marker rather than the word "Error": a refusal is allowed to be an error. */
    const io = recordingIo();
    const barrel = await loadCli();
    const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;

    await runCli(["validate", "/nonexistent/t270/definitely-not-here"], io);

    const rendered = io.all();
    expect(rendered, "rendered nothing at all").not.toBe("");
    expect(rendered, "a stack frame reached the rendering").not.toMatch(/\n\s*at\s+\S+/);
    expect(rendered, "a source location reached the rendering").not.toMatch(/\.[jt]s:\d+:\d+/);
  });

  it("never renders a credential", async () => {
    /* THE NEEDLE IS FROM STORED STATE, NOT FROM THE CALL. The cell passes no key, so any
       occurrence of this string in the rendering came from the environment — which is
       exactly what "no credential" forbids. A needle taken from an argument would
       false-charge a refusal that is entitled to quote its own arguments. */
    const secret = "dp_live_T270_LEAK_CANARY_9f3a";
    const previous = process.env.DARKPRINT_API_KEY;
    process.env.DARKPRINT_API_KEY = secret;

    try {
      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;

      /* A verb that reaches the registry, with the network down: the failure path that has a
         credential in scope is the one most likely to print it. */
      await runCli(["clone", "someone/something"], io);

      expect(io.all(), "the API key reached the rendering").not.toContain(secret);
    } finally {
      if (previous === undefined) delete process.env.DARKPRINT_API_KEY;
      else process.env.DARKPRINT_API_KEY = previous;
    }
  });
});
