/* ============================================================
   `clone <id>@<version>`: one card, through the card file route,
   written under the name a bundle folder gives a pinned card.

   The release form is covered in `network.test.ts`; this file holds
   what the card form adds. The fake registry serves the archive's
   own card bytes, so "byte for byte" is a comparison against what
   the export writes rather than against a fixture beside the
   assertion, and it records every path it was asked for, so the
   address is checked as well as the bytes.
   ============================================================ */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { NOT_FOUND_TEXT } from "../../mcp/src/refusals";
import { clone } from "./clone";
import { CliError } from "./errors";
import { collectingIo } from "./io";
import { runCli } from "./run";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-cli-clone-card-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const REF = "spec-planner@1.0.0";
/* ABSOLUTE, because one cell chdirs to test `--out`'s default. */
const CARD = resolve("content", "cards", `${REF}.yaml`);
const NAMESPACED = "berti/memory-probe@1.0.0";
const NAMESPACED_TEXT = "id: berti/memory-probe\nversion: 1.0.0\n";

/** A registry that serves two cards and nothing else, and remembers what it was asked. */
function cardRegistry(): { fetch: typeof fetch; asked: string[] } {
  const asked: string[] = [];
  const fetchStub = (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    asked.push(path);
    if (path === `/api/files/cards/${encodeURIComponent(REF)}.yaml`) {
      return new Response(readFileSync(CARD, "utf8"));
    }
    if (path === `/api/files/cards/berti/${encodeURIComponent("memory-probe@1.0.0")}.yaml`) {
      return new Response(NAMESPACED_TEXT);
    }
    return new Response(JSON.stringify({ detail: "Not found." }), { status: 404 });
  }) as unknown as typeof fetch;
  return { fetch: fetchStub, asked };
}

describe("clone <id>@<version>", () => {
  it("writes the card's YAML byte for byte as cards/<id>@<version>.yaml under --out", async () => {
    const out = join(scratch, "one");
    const registry = cardRegistry();
    const result = await clone(REF, { out, baseUrl: "https://registry.example", fetch: registry.fetch });

    expect(result.kind).toBe("card");
    expect(result.root).toBe(out);
    expect(result.files).toEqual([`cards/${REF}.yaml`]);
    expect(result.version).toBe("1.0.0");
    /* A card is pinned by its version; there is no release digest to report. */
    expect(result.digest).toBeUndefined();
    expect(readFileSync(join(out, "cards", `${REF}.yaml`), "utf8")).toBe(readFileSync(CARD, "utf8"));
    expect(registry.asked).toEqual([`/api/files/cards/${encodeURIComponent(REF)}.yaml`]);
  });

  it("keeps a namespaced id's slash as a path separator, in the address and on disk", async () => {
    const out = join(scratch, "namespaced");
    const registry = cardRegistry();
    const result = await clone(NAMESPACED, { out, fetch: registry.fetch });
    expect(result.files).toEqual([`cards/${NAMESPACED}.yaml`]);
    expect(readFileSync(join(out, "cards", "berti", "memory-probe@1.0.0.yaml"), "utf8")).toBe(NAMESPACED_TEXT);
    expect(registry.asked[0]).toBe(`/api/files/cards/berti/${encodeURIComponent("memory-probe@1.0.0")}.yaml`);
  });

  it("defaults --out to the current directory, where a bundle's cards/ already is", async () => {
    const registry = cardRegistry();
    const cwd = process.cwd();
    const here = join(scratch, "cwd");
    rmSync(here, { recursive: true, force: true });
    mkdirSync(here, { recursive: true });
    process.chdir(here);
    try {
      const result = await clone(REF, { fetch: registry.fetch });
      expect(result.root).toBe(process.cwd());
      expect(existsSync(join(process.cwd(), "cards", `${REF}.yaml`))).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  it("refuses --version and --digest beside a card, before it can reach a registry", async () => {
    const exploded = (() => {
      throw new Error("clone reached the network for a refusal it could decide alone");
    }) as unknown as typeof fetch;
    for (const flags of [{ version: "1.0.0" }, { digest: "sha256:abc" }]) {
      await expect(clone(REF, { ...flags, fetch: exploded })).rejects.toThrow(
        "clone: a card is pinned by the version in its reference; --version and --digest name a release.",
      );
    }
  });

  it("refuses a reference that is not a pinned card, offline", async () => {
    const exploded = (() => {
      throw new Error("clone reached the network for a target it could not parse");
    }) as unknown as typeof fetch;
    for (const target of ["spec-planner@latest", "@1.0.0", "Spec_Planner@1.0.0", "a/b/c@1.0.0"]) {
      await expect(clone(target, { fetch: exploded })).rejects.toBeInstanceOf(CliError);
      await expect(clone(target, { fetch: exploded })).rejects.toThrow("is not an <owner>/<slug> or a card <id>@<version>.");
    }
  });

  it("renders the registry's own refusal for a card it does not hold, and writes nothing", async () => {
    const out = join(scratch, "missing");
    await expect(clone("nobody@9.9.9", { out, fetch: cardRegistry().fetch })).rejects.toThrow(NOT_FOUND_TEXT);
    expect(existsSync(out)).toBe(false);
  });

  it("still takes the release form, so the `@` rule does not swallow <owner>/<slug>", async () => {
    const exploded = (() => {
      throw new Error("reached");
    }) as unknown as typeof fetch;
    /* Both flags on a release target is the release form's own offline refusal, and it is
       reached only when the target was read as a release. */
    await expect(clone("lupo/frontline-triage", { version: "1.0.0", digest: "sha256:x", fetch: exploded })).rejects.toThrow(
      "clone: give --version or --digest, not both.",
    );
  });
});

describe("through runCli", () => {
  /**
   * `runCli` has no seam for `fetch`, so the registry is pointed at a port nothing listens
   * on for the duration: a build whose refusal had gone missing then fails on the socket
   * and writes nothing, rather than fetching the real card from the default base.
   */
  it("refuses the release flags beside a card with the sentence, and exits 1", async () => {
    const io = collectingIo();
    const out = join(scratch, "never-written");
    const previous = process.env.DARKPRINT_URL;
    process.env.DARKPRINT_URL = "http://127.0.0.1:9";
    try {
      expect(await runCli(["clone", REF, "--version", "1.0.0", "--out", out], io)).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.DARKPRINT_URL;
      else process.env.DARKPRINT_URL = previous;
    }
    expect(io.stderr.join("")).toContain("a card is pinned by the version in its reference");
    expect(io.stdout.join("")).toBe("");
    expect(existsSync(out)).toBe(false);
  });

  it("prints the grammar for both targets in its help", async () => {
    const io = collectingIo();
    await runCli(["--help"], io);
    expect(io.stderr.join("")).toContain("<id>@<version>");
  });
});
