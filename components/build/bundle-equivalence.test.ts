/* ============================================================
   The bundle-equivalence harness
   ------------------------------------------------------------
   `/build` is about to lose its eight-step guided path in favour
   of a single workspace, which deletes the presentation code that
   currently walks the reader to a download. Nothing in that
   presentation code is allowed to change what the download
   contains: the graph, the cards and every byte of prose in them.

   This file is the proof. It hashes every file in the bundle each
   of the 80 combinations produces — `output` x `approval` x
   `iterations`, per `components/build/choices.ts` — and pins those
   80 digests in a snapshot. `buildStarterBundle` is pure (see
   `lib/starter/variants.ts`), so as long as the restructuring
   calls the same function with the same choices, the digests
   cannot move. If a later task's refactor changes a single
   character anywhere in a card or the DOT, this snapshot fails,
   which is the whole point: the test that cannot fail is not a
   safety net.

   This is deliberately a guard on the *artefact*, not on how the
   page gets there. It asserts nothing about steps, panes or state
   machines, so it survives the restructuring even as everything
   around it is rewritten.
   ============================================================ */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildStarterBundle } from "@/lib/starter/variants";

import { ALL_COMBINATIONS, type StarterChoices } from "./choices";

/** Every file in a bundle, hashed in a stable order. */
function bundleDigest(choices: StarterChoices): string {
  const bundle = buildStarterBundle(choices);
  const parts: string[] = [`dot:${bundle.dot}`];
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
