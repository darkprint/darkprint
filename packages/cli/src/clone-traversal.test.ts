/* ============================================================
   `clone` refuses a registry-supplied file name that escapes the
   target directory (CWE-22 / zip-slip). The file LIST is the
   server's word, not the caller's — a compromised, MITM'd or
   self-hosted registry answering `../…` must not be able to write
   outside the folder the user asked for. Found by the ultracode
   audit; no per-verb round owned `packages/cli` for this.
   ============================================================ */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { clone } from "./clone";
import { CliError } from "./errors";

const OWNER = "lupo";
const SLUG = "frontline-triage";
const DIGEST = "sha256:a4c9d09c6acdb62d082cd870546eb2dc4d9564435e0a91b0f1d9467f81a108d1";

const scratch = mkdtempSync(join(tmpdir(), "darkprint-cli-traversal-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** A hostile registry whose file list carries one entry that walks out of the folder. */
function hostileRegistry(escapePath: string): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/provenance")) {
      return new Response(JSON.stringify({ publishedBy: OWNER, releases: [{ version: "1.0.0", digest: DIGEST }] }));
    }
    if (path.includes("/api/mcp/releases/")) {
      return new Response(JSON.stringify({ files: ["README.md", escapePath] }));
    }
    if (path.includes("/api/files/blueprints/")) {
      return new Response("owned");
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("clone refuses a file name that escapes the target directory", () => {
  it("throws CliError and writes nothing outside root for a `../` name", async () => {
    const out = join(scratch, "target");
    /* The witness sits BESIDE the target, where `../` would land it. Named per run so a
       leftover from another cell cannot make the absence assertion pass for free. */
    const witness = resolve(out, "..", "pwned-relative.txt");
    expect(existsSync(witness)).toBe(false);

    await expect(
      clone(`${OWNER}/${SLUG}`, {
        digest: DIGEST,
        out,
        baseUrl: "https://registry.example",
        fetch: hostileRegistry("../pwned-relative.txt"),
      }),
    ).rejects.toBeInstanceOf(CliError);

    expect(existsSync(witness), "clone wrote a file outside its target directory").toBe(false);
  });

  it("throws for an absolute path too", async () => {
    const out = join(scratch, "target-abs");
    const witness = join(scratch, "pwned-absolute.txt");
    expect(existsSync(witness)).toBe(false);

    await expect(
      clone(`${OWNER}/${SLUG}`, {
        digest: DIGEST,
        out,
        baseUrl: "https://registry.example",
        fetch: hostileRegistry(witness),
      }),
    ).rejects.toBeInstanceOf(CliError);

    expect(existsSync(witness), "clone honoured an absolute registry-supplied path").toBe(false);
    expect(dirname(witness)).toBe(scratch); // the witness really is outside `out`
  });
});
