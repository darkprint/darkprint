/* ============================================================
   T270 AC4 — `clone` by digest yields bytes identical to the
   server's export

   Driven through `runCli(argv, io)` and the PUBLISHED argv
   grammar, not through `clone(...)` directly. D-270-03 leaves the
   per-verb argument lists to the implementer beyond
   `validate(dir)`, and a cell calling `clone(owner, slug, opts)`
   would be inventing one — the same mistake as the deleted
   `bump(pair, version)`. `runCli`'s two parameters and the usage
   line are both published, so this drives only what the section
   says.

   The registry is stubbed at `globalThis.fetch`, which is the seam
   `optionsFromEnv` itself reads (D-270-05 (2)). `DARKPRINT_URL`
   keeps `packages/mcp/src/registry.ts:56-64`'s meaning; there is no
   second env contract and this cell does not invent one.
   ============================================================ */

import { readFileSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadCli, recordingIo, RUN_CLI } from "./contract";
import { ARCHIVE, OVERLAY_SLUG } from "./fixtures";
import { stubRegistry, type StubRegistry } from "./registry";

let registry: StubRegistry | undefined;
let previousUrl: string | undefined;

afterEach(() => {
  registry?.restore();
  registry = undefined;
  if (previousUrl === undefined) delete process.env.DARKPRINT_URL;
  else process.env.DARKPRINT_URL = previousUrl;
});

/** Every file under `dir`, as `{path, text}` with forward slashes — the `ExportedFile` shape. */
function folderOnDisk(dir: string): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  const walk = (at: string): void => {
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      files.push({ path: relative(dir, path).split(sep).join("/"), text: readFileSync(path, "utf8") });
    }
  };
  walk(dir);
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

describe("AC4 — clone by digest writes the server's bytes", () => {
  it.each([ARCHIVE[0].slug, OVERLAY_SLUG])(
    "%s — the written folder is byte-identical to the server's export",
    async (slug) => {
      /* Build the world, plant the premise, ASSERT the premise, bind LAST. */
      registry = stubRegistry(slug);
      previousUrl = process.env.DARKPRINT_URL;
      process.env.DARKPRINT_URL = registry.base;
      const out = mkdtempSync(join(tmpdir(), "t270-clone-"));

      expect(registry.files.length, "the server export is empty").toBeGreaterThan(4);
      /* The engine's own digest form, `sha256:<64 hex>` — pinned as it actually is rather
         than as bare hex, which is what this premise asserted on its first run and got wrong.
         A premise that cannot hold is a cell that never reaches its subject. */
      expect(registry.digest, "no digest to clone by").toMatch(/^sha256:[0-9a-f]{64}$/);

      const io = recordingIo();
      const barrel = await loadCli();
      const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;

      const code = await runCli(
        ["clone", "someone/" + slug, "--digest", registry.digest, "--out", out],
        io,
      );

      /* The exit code first, because a non-zero one makes every byte comparison below a
         statement about a folder the CLI never claimed to have finished writing — and the
         unmatched-URL list is what turns "it failed" into "it asked for something the server
         does not serve", which is a contract finding rather than a mystery. */
      expect(
        code,
        `clone exited ${code}. unmatched requests: ${JSON.stringify(registry.unmatched)}; ` +
          `rendered: ${io.all()}`,
      ).toBe(0);

      expect(folderOnDisk(out)).toEqual(
        registry.files.map((file) => ({ path: file.path, text: file.text })),
      );
    },
  );

  it("fetches the bytes through the files route rather than inventing them", async () => {
    /* AC4 says "identical to the SERVER's export". A CLI that rebuilt the folder locally from
       the cards it already had could produce identical bytes for an archive bundle and would
       satisfy a pure byte comparison — so this asserts the bytes were actually asked for.
       Excludes the bad output the equality above admits. */
    const slug = ARCHIVE[0].slug;
    registry = stubRegistry(slug);
    previousUrl = process.env.DARKPRINT_URL;
    process.env.DARKPRINT_URL = registry.base;
    const out = mkdtempSync(join(tmpdir(), "t270-clone-"));

    const io = recordingIo();
    const barrel = await loadCli();
    const runCli = barrel[RUN_CLI] as (argv: readonly string[], io: unknown) => Promise<number>;
    await runCli(["clone", "someone/" + slug, "--digest", registry.digest, "--out", out], io);

    expect(registry.calls.length, "clone made no request at all").toBeGreaterThan(0);
    expect(
      registry.calls.some((url) => url.includes("/files/")),
      `clone never called the files route. It called: ${JSON.stringify(registry.calls)}`,
    ).toBe(true);
  });
});
