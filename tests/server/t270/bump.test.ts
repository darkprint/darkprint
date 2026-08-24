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

import { loadCli, recordingIo, RUN_CLI } from "./contract";
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
