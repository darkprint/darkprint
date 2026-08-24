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

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { cardRef, parseCardRef, parseDot, type BundleManifest, type CardRef } from "@/lib/core";
import { validateBundle, validateVocabularySource } from "@/lib/server/engine";
import { readBundleDirectory } from "./layout";
import { validate } from "./validate";

const SLUGS = readdirSync("content/blueprints").sort();

/** The refs a DOT pins, in declaration order — `lib/content/read.ts`'s `pinnedRefs`. */
function pinnedRefs(dot: string): CardRef[] {
  const parsed = parseDot(dot, "blueprint.dot");
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
  const dot = readFileSync(`content/blueprints/${slug}/blueprint.dot`, "utf8");
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
  it("reads nine bundles, which is the number the criterion names", () => {
    expect(SLUGS).toHaveLength(9);
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
    expect(read.manifest.ontologyVersion).toBe("0.1.0");
  });
});
