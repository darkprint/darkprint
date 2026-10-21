/* ============================================================
   AC1, driven rather than argued.
   "`validate` on the nine archive bundles produces byte-identical
   diagnostics to the server."

   The server side is assembled HERE, from `content/`, the way
   `/api/validate/bundle` receives a submission — a real manifest,
   the DOT, and the cards the DOT pins pulled out of the shared
   library. It deliberately does NOT go through `readBundleDirectory`:
   comparing my reader against itself would be a consistency check
   and never a second axis, and this criterion is the one that is
   supposed to catch a CLI composing the engine its own way.
   ============================================================ */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { cardRef, parseCardRef, parseDot, type BundleManifest, type CardRef } from "../../../lib/core";
import { validateBundle, validateVocabularySource } from "../../../lib/server/engine";
import { collectingIo } from "./io";
import { readBundleDirectory } from "./layout";
import { runCli } from "./run";
import { validate } from "./validate";

const SLUGS = readdirSync("content/blueprints").sort();

/** The refs a DOT pins, in declaration order — `lib/content/read.ts`'s `pinnedRefs`. */
function pinnedRefs(dot: string): CardRef[] {
  const parsed = parseDot(dot, "topology.dot");
  if (parsed.graph === undefined) return [];
  const refs: CardRef[] = [];
  const seen = new Set<CardRef>();
  for (const node of parsed.graph.nodes) {
    const explicit = Object.prototype.hasOwnProperty.call(node.attrs, "card")
      ? node.attrs.card
      : undefined;
    const version = Object.prototype.hasOwnProperty.call(node.attrs, "version")
      ? node.attrs.version
      : undefined;
    const raw = explicit ?? (version === undefined ? undefined : cardRef(node.id, version.trim()));
    if (raw === undefined) continue;
    const parsedRef = parseCardRef(raw);
    if (parsedRef === undefined) continue;
    const ref = cardRef(parsedRef.id, parsedRef.version);
    if (seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

/**
 * The archive's local overlay, layered for every bundle exactly as the build layers it.
 *
 * Composed through `validateVocabularySource` because that is what `/api/validate/bundle`'s
 * own `extensionsFrom` does with a submitted `vocabulary` string — the route is what this
 * side is standing in for, so reproducing it is the point rather than a shortcut.
 */
const ARCHIVE_EXTENSIONS = validateVocabularySource(
  readFileSync("content/ontology/extensions.yaml", "utf8"),
).terms;

/** One bundle as the SERVER receives it. */
function serverSubmission(slug: string) {
  const dot = readFileSync(`content/blueprints/${slug}/topology.dot`, "utf8");
  const manifest = parseYaml(
    readFileSync(`content/blueprints/${slug}/blueprint.yaml`, "utf8"),
  ) as BundleManifest;
  const cardFiles: Record<string, string> = {};
  for (const ref of pinnedRefs(dot)) {
    try {
      cardFiles[`cards/${ref}.yaml`] = readFileSync(`content/cards/${ref}.yaml`, "utf8");
    } catch {
      continue;
    }
  }
  return {
    manifest,
    dot,
    cardFiles,
    ...(ARCHIVE_EXTENSIONS === undefined ? {} : { extensions: ARCHIVE_EXTENSIONS }),
  };
}

describe("AC1 — the CLI and the server disagree about nothing", () => {
  it("reads every bundle the archive holds", () => {
    expect(SLUGS).toHaveLength(16);
  });

  it.each(SLUGS)("%s produces byte-identical diagnostics", (slug) => {
    const server = validateBundle(serverSubmission(slug));
    const cli = validate(`public/bundles/${slug}`);

    /* Byte-identical, so the comparison is over the serialised document and not over a
       shape a matcher might call equal. `toEqual` on two arrays of objects would pass for
       two orders of the same diagnostics, and the order is the half of this criterion a
       reimplementation gets wrong. */
    expect(JSON.stringify(cli.diagnostics)).toBe(JSON.stringify(server.diagnostics));

    /* The premise, asserted rather than assumed: a bundle whose diagnostics are empty on
       both sides would satisfy the line above while measuring nothing. */
    expect(server.diagnostics.length).toBeGreaterThan(0);
  });

  it("reads the exported folder with no manifest in it, which is what makes D3's stub load-bearing", () => {
    const read = readBundleDirectory(`public/bundles/${SLUGS[0]}`);
    expect(read.manifestFile).toBeUndefined();
    /* The stub stands in for the whole document. It asserted the stub's `ontologyVersion`
       until a manifest stopped carrying one; `slug` is derived from the directory name and
       is the member a reader would notice missing. */
    expect(read.manifest.slug).toBe(SLUGS[0]);
  });
});

/* --------------------- what `darkprint validate` prints --------------------- */

/** What the verb wrote to stdout for `dir`, and its exit code. */
async function validateOutput(dir: string): Promise<{ code: number; out: string }> {
  const io = collectingIo();
  const code = await runCli(["validate", dir], io);
  return { code, out: io.stdout.join("") };
}

describe("`darkprint validate` prints the scorecard a release of the folder would carry", () => {
  /* The expected lines are the scorecards production stored when it published these two
     releases, typed in rather than recomputed, so the engine is not checked against itself. */
  it.each([
    [
      "starter-software-factory",
      "scorecard:\n" +
        "  autonomy closed-loop\n" +
        "  security level 4\n" +
        "  human gates none\n" +
        "  phases covered planning, implementation, testing, debugging, deployment\n",
    ],
    [
      "frontline-triage",
      "scorecard:\n" +
        "  autonomy supervised\n" +
        "  security level 2\n" +
        "  human gates escalate\n" +
        "  phases covered implementation, testing, deployment; missing planning, debugging\n",
    ],
  ])("%s", async (slug, scorecard) => {
    const { code, out } = await validateOutput(`public/bundles/${slug}`);
    expect(code).toBe(0);
    expect(out.endsWith(scorecard), out).toBe(true);
  });

  it("prints none for a folder an error finding keeps from being published", async () => {
    const dir = mkdtempSync(join(tmpdir(), "darkprint-validate-"));
    try {
      writeFileSync(join(dir, "topology.dot"), 'digraph g { a [card="absent@1.0.0"]; }\n');
      const { code, out } = await validateOutput(dir);
      expect(code, out).toBe(1);
      expect(out).not.toContain("scorecard");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
