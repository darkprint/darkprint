/* ============================================================
   T270 AC2 — `bump` refuses a declared version below the inferred
   one, naming the reasons

   The SUBJECT IS THE BUNDLE (D-270-05 (1)): `inferBlueprintBump`
   over two `BlueprintSnapshot`s, then
   `checkDeclaredBump("bundle", …)`. It is NOT `inferBump` over card
   pairs — a different function over different inputs producing
   different reasons. This suite's own reference was built on card
   pairs while the section named no subject at all, and has been
   retargeted; the old one was deleted rather than repointed.

   Driven through `runCli(argv, io)` and the published usage line,
   because `bump`'s argument list is the implementer's beyond
   `validate(dir)`. `bump` is a NETWORK verb, so the registry is
   stubbed at `globalThis.fetch` — the seam `optionsFromEnv` reads.

   ── what these cells are actually for ──
   D-270-04 (2): the engine SPLITS the refusal. `message` is the
   reasons-free "too small" sentence the block says "satisfies the
   verb and fails the user"; the reasons are in `hint`. A CLI
   rendering `diagnostic.message` and dropping `hint` fails AC2
   while looking entirely correct, and `.message` is the obvious
   field to render. So these read what reached `io`, not what the
   verb returned: a `bump` returning the right diagnostics behind a
   `runCli` that prints only their messages passes a return-value
   check and still fails the user.
   ============================================================ */

import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  bindVerb,
  bumpEnough,
  BUMP_ARITY,
  CLI_ERROR,
  loadCli,
  NO_TARGET_MESSAGE,
  recordingIo,
  RUN_CLI,
} from "./contract";
import { cleanupFolders, writeBundleFolder, ARCHIVE } from "./fixtures";
import { serverBumpDiagnostics, SNAPSHOT_PAIRS, SNAPSHOT_PAIRS_ERROR } from "./references";
import { stubRegistry, type StubRegistry } from "./registry";

afterAll(cleanupFolders);

let registry: StubRegistry | undefined;
let previousUrl: string | undefined;

afterEach(() => {
  registry?.restore();
  registry = undefined;
  if (previousUrl === undefined) delete process.env.DARKPRINT_URL;
  else process.env.DARKPRINT_URL = previousUrl;
});

describe("AC2 — the rendered refusal keeps the engine's reasons", () => {
  it("has pairs to drive", () => {
    /* The captured module-scope premise. `[]` would make every `it.each` below expand to
       nothing and report a clean run over cells that never existed. */
    expect(SNAPSHOT_PAIRS_ERROR).toBeUndefined();
    expect(SNAPSHOT_PAIRS.length).toBeGreaterThan(0);
  });

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — renders the reasons, not only the verdict",
    async (slug, pair) => {
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });

      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
        /* The rewritten previous, same as the success cells. Two of the five stub calls in
           this file were missed by the first repair because it matched on a digest spelling
           rather than enumerating the call sites — and the two it missed were exactly the
           cells that then charged the CLI with losing reasons it had never been given a
           difference to report. Repair by enumeration, never by pattern. */
        files: pair.previousFiles,
      });
      previousUrl = process.env.DARKPRINT_URL;
      process.env.DARKPRINT_URL = registry.base;

      /* The premise that makes this cell mean anything, asserted before the bind: the reasons
         must be in `hint` and NOT in `message` on the server side, or a CLI printing `message`
         alone would pass for the wrong reason and this cell would be measuring nothing. */
      const expected = serverBumpDiagnostics(pair, pair.previousVersion);
      expect(expected.length, "the server half refused nothing").toBeGreaterThan(0);
      for (const reason of pair.inferred.reasons) {
        expect(expected[0].message).not.toContain(reason);
        expect(expected[0].hint ?? "").toContain(reason);
      }

      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
      await runCli(["bump", dir, "--target", "someone/" + slug, "--declare", pair.previousVersion], io);

      const rendered = io.all();
      expect(rendered, "bump rendered nothing at all").not.toBe("");
      for (const reason of pair.inferred.reasons) {
        expect(
          rendered,
          `the rendering dropped \`hint\`, losing the engine's reasons. rendered: ${rendered}`,
        ).toContain(reason);
      }
    },
  );

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — refuses with a non-zero exit code",
    async (slug, pair) => {
      /* A refusal that renders the right sentence and exits 0 is a refusal no script can act
         on. Separate from the rendering cell so a CLI that gets one right and the other wrong
         is told which. */
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });

      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
        /* The rewritten previous, same as the success cells. Two of the five stub calls in
           this file were missed by the first repair because it matched on a digest spelling
           rather than enumerating the call sites — and the two it missed were exactly the
           cells that then charged the CLI with losing reasons it had never been given a
           difference to report. Repair by enumeration, never by pattern. */
        files: pair.previousFiles,
      });
      previousUrl = process.env.DARKPRINT_URL;
      process.env.DARKPRINT_URL = registry.base;

      expect(serverBumpDiagnostics(pair, pair.previousVersion).length).toBeGreaterThan(0);

      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
      const code = await runCli(["bump", dir, "--target", "someone/" + slug, "--declare", pair.previousVersion], io);

      expect(code, `bump exited 0 on a refused declaration. rendered: ${io.all()}`).not.toBe(0);
    },
  );
});

describe("D-270-06 — `bump`'s published spelling and its SUCCESS path", () => {
  it(`\`bump\` takes ${BUMP_ARITY} counted parameters — \`options = undefined\`, never \`?\``, async () => {
    /* D-270-06 (1), enforced rather than preferred. `bump(dir, declare, options = undefined)`
       counts 2; the refused `options?` spelling counts 3. Every behavioural cell in this file
       passes under either, so this is the only one that can see the difference. */
    const bump = await bindVerb("bump");
    expect(
      bump.length,
      `\`bump(dir, declare, options = undefined)\` counts ${BUMP_ARITY}. A count of 3 means ` +
        `\`options?\` — the spelling D-270-06 (1) refuses.`,
    ).toBe(BUMP_ARITY);
  });

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — returns the EMPTY ARRAY for a declaration that satisfies",
    async (slug, pair) => {
      /* THE SUCCESS PATH, held until D-270-06 published `bump`'s spelling and ruled success as
         the empty array. Until now this file drove only the refusal, which meant a `bump` that
         refused EVERYTHING passed every cell here.

         The satisfying version is computed from the inferred level rather than typed, so this
         stays correct whether the engine prices the moved ref `minor` or `major`. */
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });
      /* Serve the REWRITTEN previous — the archive's files with one card pin moved to the
         other published version. Without this the served release equals the local folder, the
         engine infers `none`, and the CLI correctly answers "is enough" while this cell charges
         it with losing reasons that were never there. That is what first contact measured. */
      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
        files: pair.previousFiles,
      });

      const satisfying = { major: "2.0.0", minor: "1.1.0", patch: "1.0.1", none: "1.0.1" }[
        pair.inferred.level
      ];
      /* The premise: the server half must ACCEPT this one, or the cell is asserting that a
         refusal is empty rather than that an acceptance is. */
      expect(serverBumpDiagnostics(pair, satisfying)).toEqual([]);

      const bump = await bindVerb("bump");
      const actual = await bump(dir as never, satisfying as never, {
        /* D-270-07 (1). Nothing in a bundle directory can supply the owner — no manifest in an
           export folder, no `author` on D3's stub, no owner in the README — and both registry
           routes are keyed `{owner}/{slug}`, so the CALLER supplies it. */
        target: "someone/" + slug,
        baseUrl: registry.base,
        fetch: globalThis.fetch,
      } as never);

      expect(actual, "a satisfying declaration did not return the empty array").toEqual([]);
    },
  );

  it.each(SNAPSHOT_PAIRS.map((pair) => [pair.slug, pair] as const))(
    "%s — `runCli` renders success to io.out and exits 0",
    async (slug, pair) => {
      /* The rendered half, and the two channels are asserted SEPARATELY. D-270-06 puts success
         on `io.out` and refusals on `io.err`; a CLI writing everything to one stream satisfies
         a combined check and breaks every caller that pipes them apart. `err` empty is the
         exclusion — asserting only that `out` carries the sentence admits a CLI that writes it
         to both. */
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });
      /* Serve the REWRITTEN previous — the archive's files with one card pin moved to the
         other published version. Without this the served release equals the local folder, the
         engine infers `none`, and the CLI correctly answers "is enough" while this cell charges
         it with losing reasons that were never there. That is what first contact measured. */
      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
        files: pair.previousFiles,
      });
      previousUrl = process.env.DARKPRINT_URL;
      process.env.DARKPRINT_URL = registry.base;

      const satisfying = { major: "2.0.0", minor: "1.1.0", patch: "1.0.1", none: "1.0.1" }[
        pair.inferred.level
      ];
      expect(serverBumpDiagnostics(pair, satisfying)).toEqual([]);

      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
      const code = await runCli(["bump", dir, "--target", "someone/" + slug, "--declare", satisfying], io);

      expect(code, `bump exited ${code} on a satisfying declaration`).toBe(0);
      expect(io.out_.join("\n")).toContain(bumpEnough(satisfying));
      expect(io.err_.join("\n"), "success reached io.err").toBe("");
    },
  );
});

describe("D-270-07 — an absent `--target` refuses OFFLINE", () => {
  it("refuses with the ruled sentence and makes NO network call", async () => {
    /* D-270-07 (1). The owner cannot be recovered from the folder — an export folder carries
       no manifest, D-270-02 D3's stub has no `author`, `README.md` names no owner, and a
       hand-written `author` is D-250-18's stale claim — while both registry routes are keyed
       `{owner}/{slug}`. So the CLI can know this request is unanswerable before it asks
       anyone, and "before any network call" is the ruled half.

       Same shape as `clone`'s mutual exclusion: `fetch` replaced with a throw and the call
       count asserted to ZERO. A CLI that resolved provenance and then discovered it had no
       owner to resolve it FOR would satisfy a message check while making a request it could
       have known was pointless. The message assertion alone admits that; the count excludes it. */
    const entry = ARCHIVE[0];
    const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });

    let reached = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (() => {
      reached += 1;
      throw new Error("ENETDOWN");
    }) as typeof globalThis.fetch;

    try {
      const bump = await bindVerb("bump");
      const thrown = await (bump(dir as never, "2.0.0" as never) as Promise<unknown>).then(
        () => undefined,
        (err: unknown) => err,
      );

      expect(thrown, "bump accepted a call with no target").toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(NO_TARGET_MESSAGE);
      expect((thrown as Error).constructor.name).toBe(CLI_ERROR);
      expect(reached, "bump reached the network before refusing for a missing target").toBe(0);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("does not refuse when a target IS given", async () => {
    /* THE NEAR MISS. One option different and the answer must flip. Without it, a `bump` that
       threw `bump: give --target …` unconditionally would pass the cell above and fail every
       real caller — and every other bump cell here reds on the absent module today, so nothing
       else would catch it at first contact either. */
    const pair = SNAPSHOT_PAIRS[0];
    const entry = ARCHIVE.find((bundle) => bundle.slug === pair.slug)!;
    const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });
    registry = stubRegistry(pair.slug, {
      releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
    });

    const bump = await bindVerb("bump");
    const thrown = await (bump(dir as never, pair.previousVersion as never, {
      target: "someone/" + pair.slug,
      baseUrl: registry.base,
      fetch: globalThis.fetch,
    } as never) as Promise<unknown>).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(
      thrown instanceof Error && thrown.message === NO_TARGET_MESSAGE,
      "bump refused for a missing target while a target was given",
    ).toBe(false);
  });
});
