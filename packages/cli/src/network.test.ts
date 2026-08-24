/* ============================================================
   AC4 and AC2, driven in-process through the injected `fetch`.

   The registry is served out of `public/bundles/frontline-triage`,
   which IS the exporter's output — so "identical to the server's
   export" is a comparison against the bytes the exporter wrote
   rather than against a fixture written beside the assertion.
   ============================================================ */

import { readFileSync, readdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { bundleFilePaths } from "../../../lib/content/bundle-export";
import { parseCardRef } from "../../../lib/core";
import { bump } from "./bump";
import { clone } from "./clone";
import { collectingIo } from "./io";
import { runCli } from "./run";

/* ABSOLUTE, because one cell chdirs to test `--out`'s default and every relative read in
   this file would then resolve somewhere else. */
const SOURCE = resolve("public/bundles/frontline-triage");
const OWNER = "lupo";
const SLUG = "frontline-triage";
const DIGEST = "sha256:a4c9d09c6acdb62d082cd870546eb2dc4d9564435e0a91b0f1d9467f81a108d1";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-cli-net-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** Every file of the exported folder, bundle-relative, in the exporter's own sort. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(SOURCE, full).split("\\").join("/"));
    }
  };
  walk(SOURCE);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * A registry that answers the three routes the CLI reads, out of the archive on disk.
 *
 * `releases` carries the OLDEST first, deliberately. The provenance block publishes no
 * order for the array, so a CLI reading row 0 instead of asking `latestVersion` would be
 * resting on an unpublished fact — and with the newest first that mistake passes. Ordered
 * this way, it fetches `sha256:older` and reds.
 */
function fakeRegistry(files: Record<string, string> = {}): typeof fetch {
  const list = sourceFiles();
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const path = url.pathname;

    if (path.endsWith("/provenance")) {
      return new Response(
        JSON.stringify({
          publishedBy: OWNER,
          releases: [
            { version: "1.0.0", digest: "sha256:older" },
            { version: "1.2.0", digest: DIGEST },
          ],
        }),
      );
    }
    if (path.includes("/api/mcp/releases/")) {
      return new Response(JSON.stringify({ files: list }));
    }
    if (path.includes("/api/files/blueprints/")) {
      const after = decodeURIComponent(path.split(`/d/${encodeURIComponent(DIGEST)}/`)[1] ?? "");
      const relPath = after
        .split("/")
        .map((s) => decodeURIComponent(s))
        .join("/");
      const override = files[relPath];
      if (override !== undefined) return new Response(override);
      return new Response(readFileSync(join(SOURCE, relPath), "utf8"));
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("AC4 — clone by digest writes the server's export", () => {
  it("writes every file byte for byte, and nothing else", async () => {
    const out = join(scratch, "ac4");
    const result = await clone(`${OWNER}/${SLUG}`, {
      digest: DIGEST,
      out,
      baseUrl: "https://registry.example",
      fetch: fakeRegistry(),
    });

    expect(result.digest).toBe(DIGEST);
    /* `version` is absent because the caller named a digest, not a version. */
    expect(result.version).toBeUndefined();
    expect(result.root).toBe(out);

    for (const file of result.files) {
      expect(readFileSync(join(out, file), "utf8")).toBe(readFileSync(join(SOURCE, file), "utf8"));
    }
    /* The written set is the whole export and not a subset that happens to match: the
       exporter's own oracle decides what the folder should contain. */
    const refs = readdirSync(join(SOURCE, "cards")).map((n) => parseCardRef(n.replace(/\.yaml$/, "")));
    expect([...result.files].sort()).toEqual(
      bundleFilePaths({
        cardRefs: refs.filter((r) => r !== undefined).map((r) => `${r.id}@${r.version}` as const),
        vocabulary: true,
      }).slice().sort(),
    );
  });

  it("resolves a version through provenance and lands the same bytes as the digest clone", async () => {
    const byVersion = join(scratch, "by-version");
    const result = await clone(`${OWNER}/${SLUG}`, {
      version: "1.2.0",
      out: byVersion,
      fetch: fakeRegistry(),
    });
    expect(result.digest).toBe(DIGEST);
    expect(result.version).toBe("1.2.0");
    expect(readFileSync(join(byVersion, "blueprint.dot"), "utf8")).toBe(
      readFileSync(join(SOURCE, "blueprint.dot"), "utf8"),
    );
  });

  it("with neither flag, clones the LATEST release rather than the first row listed", async () => {
    const out = join(scratch, "latest");
    const result = await clone(`${OWNER}/${SLUG}`, { out, fetch: fakeRegistry() });
    /* The fixture lists the oldest first, so a CLI reading row 0 lands `sha256:older`. */
    expect(result.digest).toBe(DIGEST);
    /* Absent: the caller named no version, and `version` reports what the CALLER asked for
       rather than what the registry resolved. */
    expect(result.version).toBeUndefined();
  });

  it("refuses --version with --digest offline, before it can reach a registry", async () => {
    const exploded = (() => {
      throw new Error("clone reached the network for a refusal it could decide alone");
    }) as unknown as typeof fetch;
    await expect(
      clone(`${OWNER}/${SLUG}`, { version: "1.2.0", digest: DIGEST, fetch: exploded }),
    ).rejects.toThrow("clone: give --version or --digest, not both.");
  });

  it("refuses a version nothing holds, with the published sentence", async () => {
    await expect(
      clone(`${OWNER}/${SLUG}`, { version: "9.9.9", fetch: fakeRegistry() }),
    ).rejects.toThrow("clone: no release at that version.");
  });

  it("defaults --out to ./<slug>", async () => {
    /* Built BEFORE the chdir: it reads the archive by a repo-relative path, and moving the
       cwd out from under it is what made this cell fail the first time it ran. */
    const registry = fakeRegistry();
    const cwd = process.cwd();
    process.chdir(scratch);
    try {
      const result = await clone(`${OWNER}/${SLUG}`, { digest: DIGEST, fetch: registry });
      /* `realpathSync`, because macOS resolves the temp dir through a `/var -> /private/var`
         symlink the moment `chdir` runs: the cell compared two spellings of one directory
         and the mismatch was the fixture's, not `clone`'s. Still pins that `root` is
         absolute and is `<cwd>/<slug>`. */
      expect(result.root).toBe(join(realpathSync(scratch), SLUG));
    } finally {
      process.chdir(cwd);
    }
  });
});

describe("AC2 — bump refuses a declaration below the inferred one, naming the reasons", () => {
  /** The local folder, repinned to a card version the published release does not carry. */
  function repinned(): string {
    const dir = join(scratch, "next");
    const out = clone; // referenced so the helper reads as deliberate rather than dead
    void out;
    rmSync(dir, { recursive: true, force: true });
    const files = sourceFiles();
    for (const file of files) {
      const text = readFileSync(join(SOURCE, file), "utf8");
      const dest = join(dir, file);
      mkdirp(dest);
      writeFileSync(dest, text);
    }
    const dot = join(dir, "blueprint.dot");
    writeFileSync(
      dot,
      readFileSync(dot, "utf8").replace("intent-router@1.0.0", "intent-router@2.0.0"),
    );
    unlinkSync(join(dir, "cards", "intent-router@1.0.0.yaml"));
    writeFileSync(
      join(dir, "cards", "intent-router@2.0.0.yaml"),
      readFileSync("content/cards/intent-router@2.0.0.yaml", "utf8"),
    );
    return dir;
  }

  it("names the reasons, and they are in `hint` rather than in `message`", async () => {
    const diagnostics = await bump(repinned(), "1.2.1", {
      target: `${OWNER}/${SLUG}`,
      fetch: fakeRegistry(),
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    const [first] = diagnostics;
    expect(first.code).toBe("bundle/version-bump-too-small");
    /* D-270-04(2): the split is the point. A CLI rendering `message` alone loses every
       reason, and this pins WHERE they are so a renderer cannot pass by printing the
       sentence that has none. */
    expect(first.message).not.toContain("intent-router");
    expect(first.hint ?? "").toContain("intent-router");
  });

  it("answers the empty array when the declaration is big enough", async () => {
    expect(
      await bump(repinned(), "2.0.0", { target: `${OWNER}/${SLUG}`, fetch: fakeRegistry() }),
    ).toEqual([]);
  });

  it("refuses an absent target offline, before it can reach a registry", async () => {
    const exploded = (() => {
      throw new Error("bump reached the network without a target");
    }) as unknown as typeof fetch;
    await expect(bump(SOURCE, "2.0.0", { fetch: exploded })).rejects.toThrow(
      "bump: give --target <owner>/<slug>.",
    );
  });
});

describe("runCli", () => {
  /**
   * Through `validate`, not `bump`, and the reason is a real limit rather than a
   * preference: `runCli(argv, io)` has no channel for an injected `fetch`, so the two
   * NETWORK verbs cannot be driven through it without opening a socket. `validate` is
   * offline by construction and its diagnostics carry hints, so it pins the same renderer.
   */
  it("prints message AND hint on separate lines", async () => {
    const io = collectingIo();
    const code = await runCli(["validate", SOURCE], io);

    const printed = io.stdout.join("");
    expect(printed).toContain("warning: The `criteria-leak` check was not evaluated");
    /* The hint, which is the half D-270-04(2) says a renderer loses. Asserted as its own
       line rather than as a substring of the whole output, so a renderer concatenating the
       two into one sentence does not pass. */
    expect(printed).toContain("\n  Type the port that carries the acceptance criteria");
    /* A warning is a finding and not a failure — the same split the publish gate makes. */
    expect(code).toBe(0);
  });

  it("sends findings to stdout and refusals to stderr, and exits 2 on an unknown command", async () => {
    const io = collectingIo();
    expect(await runCli(["frobnicate"], io)).toBe(2);
    expect(io.stderr.join("")).toContain("unknown command");
    expect(io.stdout.join("")).toBe("");
  });

  it("renders a CliError's message and nothing else — no stack, no endpoint", async () => {
    const io = collectingIo();
    const code = await runCli(["validate", join(scratch, "not-a-bundle")], io);
    expect(code).toBe(1);
    const printed = io.stderr.join("");
    expect(printed).toContain("blueprint.dot");
    expect(printed).not.toContain("at Object.");
    expect(printed).not.toContain("http");
  });
});

function mkdirp(file: string): void {
  const dir = file.slice(0, file.lastIndexOf("/"));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("node:fs").mkdirSync(dir, { recursive: true });
}
