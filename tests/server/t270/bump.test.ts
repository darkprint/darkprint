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

import { bindVerb, bumpEnough, BUMP_ARITY, loadCli, recordingIo, RUN_CLI } from "./contract";
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
        releases: [{ version: pair.previousVersion, digest: "0".repeat(64) }],
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
      await runCli(["bump", dir, "--declare", pair.previousVersion], io);

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
        releases: [{ version: pair.previousVersion, digest: "0".repeat(64) }],
      });
      previousUrl = process.env.DARKPRINT_URL;
      process.env.DARKPRINT_URL = registry.base;

      expect(serverBumpDiagnostics(pair, pair.previousVersion).length).toBeGreaterThan(0);

      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
      const code = await runCli(["bump", dir, "--declare", pair.previousVersion], io);

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
      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
      });

      const satisfying = { major: "2.0.0", minor: "1.1.0", patch: "1.0.1", none: "1.0.1" }[
        pair.inferred.level
      ];
      /* The premise: the server half must ACCEPT this one, or the cell is asserting that a
         refusal is empty rather than that an acceptance is. */
      expect(serverBumpDiagnostics(pair, satisfying)).toEqual([]);

      const bump = await bindVerb("bump");
      const actual = await bump(dir as never, satisfying as never, {
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
      registry = stubRegistry(slug, {
        releases: [{ version: pair.previousVersion, digest: "sha256:" + "0".repeat(64) }],
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
      const code = await runCli(["bump", dir, "--declare", satisfying], io);

      expect(code, `bump exited ${code} on a satisfying declaration`).toBe(0);
      expect(io.out_.join("\n")).toContain(bumpEnough(satisfying));
      expect(io.err_.join("\n"), "success reached io.err").toBe("");
    },
  );
});
