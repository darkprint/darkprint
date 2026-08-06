/* ============================================================
   The bundle-equivalence harness
   ------------------------------------------------------------
   `/build` lost its eight-step guided path in favour of a single
   workspace, which deleted the presentation code that used to walk
   the reader to a download. Nothing in that presentation code was
   allowed to change what the download contains: the graph, the
   cards and every byte of prose in them.

   This file is the proof. It hashes every file in the bundle each
   of the 80 combinations produces — `output` x `approval` x
   `iterations`, per `components/build/choices.ts` — and pins those
   80 digests in a snapshot. `buildStarterBundle` is pure (see
   `lib/starter/variants.ts`), so as long as the restructuring
   calls the same function with the same choices, the digests
   cannot move. If a later task's refactor changes a single
   character anywhere in a card, the DOT or the manifest, this
   snapshot fails, which is the whole point: the test that cannot
   fail is not a safety net.

   This is deliberately a guard on the *artefact*, not on how the
   page gets there. It asserts nothing about steps, panes or state
   machines, so it survived the restructuring while everything
   around it was rewritten, and the snapshot has not moved since it
   was first written.

   All three `Bundle` fields (`lib/core/bundle/types.ts`) are hashed
   — `manifest`, `dot` and `cardFiles` — not just the latter two. A
   first version of this file hashed only `dot` and `cardFiles`, and
   an edit to a manifest-only field (`summaryTail`, which feeds
   `BundleManifest.summary` — the title, summary and tags a reader
   sees before ever opening the download) passed straight through
   it undetected. That is exactly the hole a later task could widen
   by accident, so the fix is load-bearing: do not narrow this back
   to two fields for tidiness. `manifest` is serialised through
   `stableStringify` rather than `JSON.stringify` because
   `BundleManifest` is a plain object produced fresh on every call —
   nothing here should depend on the property order the producer
   happens to write it in.
   ============================================================ */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildStarterBundle } from "@/lib/starter/variants";

import { ALL_COMBINATIONS, type StarterChoices } from "./choices";

/**
 * `JSON.stringify` with object keys sorted at every level, so two values that differ only
 * in the order their producer wrote their fields serialise identically. Arrays keep their
 * order — order is meaningful there — and every other JSON-safe value falls through to
 * `JSON.stringify` unchanged.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Every field of a bundle — manifest, DOT and every card file — hashed in a stable order. */
function bundleDigest(choices: StarterChoices): string {
  const bundle = buildStarterBundle(choices);
  const parts: string[] = [`manifest:${stableStringify(bundle.manifest)}`, `dot:${bundle.dot}`];
  for (const name of Object.keys(bundle.cardFiles).sort()) {
    parts.push(`card:${name}:${bundle.cardFiles[name]}`);
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

/** `python-script/tester/cap-3` — unique per combination, stable across runs. */
function label(choices: StarterChoices): string {
  return `${choices.output}/${choices.approval}/cap-${choices.maxIterations}`;
}

describe("bundle equivalence", () => {
  it("produces a stable digest for every combination", () => {
    const digests = ALL_COMBINATIONS.map((c) => `${label(c)} ${bundleDigest(c)}`);
    expect(digests).toMatchSnapshot();
  });

  it("covers all eighty combinations", () => {
    expect(ALL_COMBINATIONS).toHaveLength(80);
  });
});
