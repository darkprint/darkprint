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

import { readFileSync, mkdtempSync, readdirSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  bindVerb,
  BOTH_SELECTORS_MESSAGE,
  CLI_ERROR,
  CLONE_ARITY,
  loadCli,
  NO_RELEASE_AT_VERSION,
  recordingIo,
  RUN_CLI,
} from "./contract";
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

/* ============================================================
   D-270-06 — the held surface, written in the amendment window
   BEFORE first contact with the implementation.

   These four were deliberately not written while the surface was
   unpublished: a cell inventing `clone(owner, slug, opts)` would
   have charged an implementer who followed the contract, which is
   the mistake this suite already made once and deleted.
   ============================================================ */

describe("D-270-06 — `clone`'s published spelling", () => {
  it(`\`clone\` takes ${CLONE_ARITY} counted parameter — \`options = undefined\`, never \`?\``, async () => {
    /* D-270-06 (1), and the ruling says ENFORCED rather than preferred.

       A default-valued parameter stops `Function.length` and TypeScript's `?` erases to
       nothing, so the ruled `= undefined` gives 1 and the refused `?` gives 2. Nothing else
       in this suite can see that difference — both spellings compile, both accept the same
       calls, and every behavioural cell passes either way. This is the only cell that fails
       on the refused spelling. */
    const clone = await bindVerb("clone");
    expect(
      clone.length,
      `\`clone(target, options = undefined)\` counts ${CLONE_ARITY}. A count of 2 means ` +
        `\`options?\` — the spelling D-270-06 (1) refuses.`,
    ).toBe(CLONE_ARITY);
  });

  it("refuses --version AND --digest together, OFFLINE, with the ruled sentence", async () => {
    /* "thrown OFFLINE" is the discriminating half. A CLI that validated the pair only after
       resolving the registry would satisfy a message check while making a network call to
       reject an argument combination it can see is wrong before it starts — so `fetch` is
       replaced with a throw and the call count asserted to 0.

       The sentence is lifted from the section rather than typed here: D-270-06 ratifies it
       verbatim, so a typed copy would compare the implementation to my transcription. */
    let reached = 0;
    const real = globalThis.fetch;
    globalThis.fetch = (() => {
      reached += 1;
      throw new Error("ENETDOWN");
    }) as typeof globalThis.fetch;

    try {
      const clone = await bindVerb("clone");
      const thrown = await (clone(
        "someone/something" as never,
        { version: "1.0.0", digest: "sha256:" + "0".repeat(64) } as never,
      ) as Promise<unknown>).then(
        () => undefined,
        (err: unknown) => err,
      );

      expect(thrown, "clone accepted both selectors").toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(BOTH_SELECTORS_MESSAGE);
      expect((thrown as Error).constructor.name).toBe(CLI_ERROR);
      expect(reached, "the refusal reached the network before refusing").toBe(0);
    } finally {
      globalThis.fetch = real;
    }
  });

  it("resolves --version through provenance, and reports the version back", async () => {
    const slug = ARCHIVE[0].slug;
    /* The default stub publishes one release at `1.0.0` carrying the REAL digest. A stub
       whose provenance answer named a digest its files route does not serve would make this
       cell fail for a fixture reason wearing a CLI cause. */
    registry = stubRegistry(slug);
    const out = mkdtempSync(join(tmpdir(), "t270-clone-v-"));

    const clone = await bindVerb("clone");
    const result = (await clone("someone/" + slug as never, {
      version: "1.0.0",
      out,
      baseUrl: registry.base,
      fetch: globalThis.fetch,
    } as never)) as { root: string; files: readonly string[]; digest: string; version?: string };

    expect(
      result.version,
      "`version` is present only when the caller named one — and the caller named one",
    ).toBe("1.0.0");
    expect(result.digest).toBe(registry.digest);
    expect(folderOnDisk(result.root).map((file) => file.path)).toEqual(
      registry.files.map((file) => file.path),
    );
  });

  it("omits `version` when the caller named none", async () => {
    /* THE NEAR MISS for the cell above: same call, one option removed, and `version` must
       flip to absent. "present only when the caller named one" is a claim about BOTH
       branches, and a cell driving only the naming branch passes against a CLI that always
       reports the resolved version. */
    const slug = ARCHIVE[0].slug;
    registry = stubRegistry(slug);
    const out = mkdtempSync(join(tmpdir(), "t270-clone-latest-"));

    const clone = await bindVerb("clone");
    const result = (await clone("someone/" + slug as never, {
      out,
      baseUrl: registry.base,
      fetch: globalThis.fetch,
    } as never)) as { version?: string };

    expect(result.version, "`version` reported for a caller that named none").toBeUndefined();
  });

  it("refuses a --version naming no release, with the ruled sentence", async () => {
    const slug = ARCHIVE[0].slug;
    registry = stubRegistry(slug, { releases: [{ version: "1.0.0", digest: "sha256:" + "0".repeat(64) }] });

    const clone = await bindVerb("clone");
    const thrown = await (clone("someone/" + slug as never, {
      version: "9.9.9",
      baseUrl: registry.base,
      fetch: globalThis.fetch,
    } as never) as Promise<unknown>).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(thrown, "clone accepted a version no release carries").toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(NO_RELEASE_AT_VERSION);
  });
});

describe("D-270-06 — `--out` defaults to `./<slug>` and `root` is ABSOLUTE", () => {
  it("writes into ./<slug> relative to the working directory, and reports it absolute", async () => {
    /* The default is stated relative to the CWD, so driving it means CHANGING the CWD — and
       that is a process-wide mutation in a shared vitest worker. Restored in a `finally`, and
       the temp directory is where the folder lands so a mistake here cannot write `./<slug>`
       into the repository and show up as an untracked directory in someone's `git status`.

       `root` ABSOLUTE is asserted separately from where the bytes landed: a CLI that wrote to
       the right place and reported a relative path satisfies the folder check and breaks every
       caller that joins the result onto its own path. */
    const slug = ARCHIVE[0].slug;
    registry = stubRegistry(slug);
    const cwd = mkdtempSync(join(tmpdir(), "t270-cwd-"));
    const previousCwd = process.cwd();

    let result: { root: string; files: readonly string[] };
    try {
      process.chdir(cwd);
      const clone = await bindVerb("clone");
      result = (await clone("someone/" + slug as never, {
        baseUrl: registry.base,
        fetch: globalThis.fetch,
      } as never)) as { root: string; files: readonly string[] };
    } finally {
      process.chdir(previousCwd);
    }

    expect(isAbsolute(result.root), `\`root\` is not absolute: ${result.root}`).toBe(true);
    /* `realpathSync` on both sides: macOS reports the temp directory as `/var/...` and
       resolves it to `/private/var/...`, so a raw string equality here fails on this platform
       for a reason about neither half. */
    expect(realpathSync(result.root)).toBe(realpathSync(join(cwd, slug)));
    expect(folderOnDisk(result.root).map((file) => file.path)).toEqual(
      registry.files.map((file) => file.path),
    );
  });

  it("reports `files` bundle-relative, in the exporter's own sort", async () => {
    /* Two claims, and the second is what a naive implementation gets wrong: `files` must be
       BUNDLE-RELATIVE (not absolute, not CWD-relative) and in the exporter's order. Compared
       against `exportBundle`'s own output rather than against a sort this cell performs — a
       re-sort here would agree with any order the CLI chose. */
    const slug = OVERLAY_SLUG;
    registry = stubRegistry(slug);
    const out = mkdtempSync(join(tmpdir(), "t270-files-"));

    const clone = await bindVerb("clone");
    const result = (await clone("someone/" + slug as never, {
      out,
      baseUrl: registry.base,
      fetch: globalThis.fetch,
    } as never)) as { files: readonly string[] };

    expect(result.files).toEqual(registry.files.map((file) => file.path));
    for (const file of result.files) {
      expect(isAbsolute(file), `\`${file}\` is absolute; files are bundle-relative`).toBe(false);
    }
  });
});
