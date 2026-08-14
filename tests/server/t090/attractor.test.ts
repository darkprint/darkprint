/* ============================================================
   T090 — AC4, the last check on emitted Attractor input

   ── read this before trusting the first test in this file ──
   AC4 says "every served `factory.dot` passes `parseDot` and
   `lintAttractor`". Asserting that outcome does NOT discriminate a
   module that checks from one that does not, and that is a
   measurement rather than a suspicion. `emitAttractorDot` is total:
   `toAttractorIdentifier` rewrites every node id onto
   `[A-Za-z_][A-Za-z0-9_]*` and is documented as never throwing and
   always passing `isAttractorIdentifier`, and
   `quoteAttractorString` escapes `\`, `"`, newline and tab and
   turns every other control character into a space. So no
   `ResolvedBlueprint` emits Attractor-invalid DOT.

   Measured rather than reasoned: all nine shipped bundles emit with
   0 parse diagnostics and 0 lint diagnostics, and four hostile
   source DOTs — a `type=` handler-override attribute, a `#`
   comment, an HTML-like `<b>` attribute value, and `strict digraph`
   — each resolve and then emit 0 and 0, because none of those
   survives the emitter. That is T-03's species: a test asserting an
   outcome something upstream already guarantees.

   So the first test is kept and LABELLED, per backend.md's rule
   that "a weak test known to be weak is worth having; the failure
   is the unlabelled one" — and the discriminating half of AC4 is
   the reachable one below it: a stored release whose DOT no longer
   resolves must be refused rather than served.

   `exportRelease: the emitted factory.dot is not valid Attractor
   input.` is therefore a published refusal that no input reachable
   through the published surface can produce. Reported in the Log as
   a measured result, not written as a test that cannot fire.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { lintAttractor, parseDot } from "@/lib/core";
import type { Actor } from "@/lib/server/policy";

import { ADMISSIBLE, expectThrewExactly, loadExport, outcomeOf, requiredFn } from "./contract";
import {
  archive,
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedOntology,
  seedRelease,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const ANONYMOUS: Actor = { kind: "anonymous" };
const FACTORY_DOT = "factory.dot";

let scratch: Scratch;
let owner: SeededAccount;
const seeded = new Map<string, SeededRelease>();

beforeAll(async () => {
  scratch = await scratchDatabase("attractor");
  await seedOntology(scratch.db);
  owner = await seedAccount(scratch, "attractor");
  for (const entry of archive()) {
    seeded.set(entry.slug, await seedRelease(scratch, owner, entry));
  }
}, 300_000);

/*
 * The explicit timeout is not decoration. `vitest.config.ts` raises `testTimeout` to 20s and
 * says why; it does not raise `hookTimeout`, which stays at vitest's 10s default — and dropping
 * a scratch database (close the pool, open an admin pool, `drop database … with (force)`) crosses
 * that under the parallel worktree load this repository runs at. When it does, the run reports
 * `Tests 75 passed (75)` with two FAILED FILES and exit 1, because a hook that fails runs no
 * test and adds nothing to the failed column. That is backend.md's "read the exit code and the
 * failed-file count, never the test total", arriving in this suite's own teardown; it was found
 * by the falsification harness refusing to measure against an unclean baseline.
 */
afterAll(async () => {
  if (scratch !== undefined) await scratch.drop();
}, 120_000);

async function factoryDotOf(release: SeededRelease): Promise<string> {
  const mod = await loadExport();
  const files = (await requiredFn(mod, "exportRelease")(
    scratch.db,
    ANONYMOUS,
    release.bundleId,
    release.digest,
  )) as readonly { path: string; text: string }[];
  const found = files.find((file) => file.path === FACTORY_DOT);
  if (found === undefined) {
    throw new Error(
      `The export of \`${release.slug}\` carries no \`${FACTORY_DOT}\`. It is one of the four ` +
        `files every bundle has (\`lib/content/bundle-export.ts\`), so its absence is AC1's ` +
        `failure arriving here.`,
    );
  }
  return found.text;
}

describe("AC4 — every served factory.dot passes parseDot and lintAttractor", () => {
  /*
   * WEAK BY MEASUREMENT — see the file header. This passes against an implementation with no
   * check at all, because `emitAttractorDot` cannot produce invalid Attractor DOT. It is kept
   * because AC4's *outcome* is worth pinning: if the emitter ever regresses, or if this layer
   * ever post-processes the emitted DOT, the nine bundles are where it shows.
   */
  for (const slug of archive().map((entry) => entry.slug)) {
    it(`serves a factory.dot for ${slug} that lexes, parses and lints (does not discriminate)`, async () => {
      const text = await factoryDotOf(seeded.get(slug) as SeededRelease);
      const parsed = parseDot(text, FACTORY_DOT);
      expect(
        parsed.diagnostics.filter((d) => d.code === "dot/parse-error"),
        `The served \`${FACTORY_DOT}\` for \`${slug}\` does not parse.`,
      ).toEqual([]);
      expect(parsed.graph, `\`${FACTORY_DOT}\` for \`${slug}\` produced no graph`).toBeDefined();
      expect(
        lintAttractor(parsed.graph as never, text, FACTORY_DOT),
        `The served \`${FACTORY_DOT}\` for \`${slug}\` carries Attractor lint warnings. The ` +
          `contract says an emitted \`${FACTORY_DOT}\` "must lex, parse and lint as Attractor ` +
          `input before it is served".`,
      ).toEqual([]);
    }, 60_000);
  }

  it("serves a factory.dot whose node ids are all Attractor identifiers (does not discriminate)", async () => {
    /*
     * Same class as the tests above and stated separately because it is the rule most likely to
     * be broken by a layer that rewrote the emitted DOT: DarkPrint's own parser accepts hyphens
     * and quoted ids, Attractor's grammar does not, and `toAttractorIdentifier` is the only thing
     * standing between the two.
     */
    const text = await factoryDotOf(seeded.get("adversarial-consensus-line") as SeededRelease);
    const parsed = parseDot(text, FACTORY_DOT);
    for (const node of (parsed.graph as never as { nodes: { id: string }[] }).nodes) {
      expect(
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(node.id),
        `Node id \`${node.id}\` in the served \`${FACTORY_DOT}\` is not an Attractor Identifier ` +
          `(\`[A-Za-z_][A-Za-z0-9_]*\`).`,
      ).toBe(true);
    }
  }, 60_000);

  it("refuses a release whose stored DOT no longer resolves, rather than serving it", async () => {
    /*
     * THE DISCRIMINATING HALF, and the one the criterion's rationale is actually about: "not at
     * publish, here, because a release stored before a lint rule changed would otherwise be
     * served unchecked forever."
     *
     * A release whose DOT does not resolve is reachable and is not contrived — T010 stores the
     * DOT verbatim and validates only that its content survives storage and that `cardRefs` and
     * `cardDigests` are pairwise aligned, so a release written by a publisher that has since been
     * fixed, or by an import, can hold DOT this engine will not read. The naive composition
     * hands `undefined` to `exportBundle` and dies with a TypeError, which reaches a route as a
     * 500; the ruled answer is the published literal.
     *
     * The cards are seeded public and available and the ontology version is published, so the
     * only thing wrong with this release is its DOT — which keeps the refusal from being
     * attributable to one of the other four `exportRelease` forms.
     */
    const own = await scratchDatabase("attractor_broken");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "broken");
      const release = await seedRelease(own, account, bundleBySlug("starter-software-factory"), {
        dot: "this is not DOT at all {{{ -> ->",
      });

      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, release.bundleId, release.digest),
      );
      expectThrewExactly(
        outcome,
        ADMISSIBLE.doesNotResolve,
        "`exportRelease` on a release whose stored DOT does not parse",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("refuses a release that PARSES but resolves with errors, rather than serving a degraded folder", async () => {
    /*
     * Added because a falsification found the suite blind to it, and it is the more dangerous of
     * the two halves. The test above exhibits DOT that does not parse, so the blueprint is
     * `undefined` and any implementation has to handle it — an unparseable release cannot be
     * served by accident. This one exhibits a release that parses, resolves, and carries an
     * **error** diagnostic: `cardRefs` omits a card the DOT pins, which T010 stores happily
     * because both arrays lose the same entry and its parity check is satisfied.
     *
     * Resolution degrades rather than failing — "a node whose card is missing drops out of
     * `nodes` but stays in `graph`" — so `exportBundle` does not throw, and the naive composition
     * serves a folder with one card file missing and a `factory.dot` one node short. That folder
     * looks complete: it has a README quoting a digest, it parses, it lints, and it will not run
     * the pattern it claims to be. `hasErrors(diagnostics)` is what separates the two, and
     * removing that one line reddened nothing before this test existed.
     *
     * The form was left unasserted when this test was written, because two of the seven were
     * defensible readings and inventing a choice between them is a candidate list in a new hat.
     * The contract has since settled it — "`exportRelease` refuses when the resolved blueprint
     * carries error diagnostics, with the published form `exportRelease: this release does not
     * resolve.`; deleting `hasErrors(diagnostics)` must red" — so the tolerance is gone and this
     * pins the literal exactly. A tolerance kept after the thing it was tolerating got decided is
     * an assertion quietly switched off.
     */
    const own = await scratchDatabase("attractor_degraded");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "degraded");
      const release = await seedRelease(own, account, bundleBySlug("grounded-research-desk"), {
        dropOneCardRef: true,
      });

      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, release.bundleId, release.digest),
      );
      if (outcome.kind === "value") {
        const files = outcome.value as readonly { path: string }[];
        throw new Error(
          `\`exportRelease\` served a release that resolves with errors: ` +
            `${files.map((f) => f.path).join(", ")}. One card the DOT pins is not in the ` +
            `release's refs, so that node dropped out of resolution and this folder is a ` +
            `blueprint missing a step — complete-looking and wrong.`,
        );
      }
      expectThrewExactly(
        outcome,
        ADMISSIBLE.doesNotResolve,
        "`exportRelease` on a release whose DOT pins a card its own refs omit",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("refuses the same release through serveFile too, rather than serving factory.dot from it", async () => {
    /*
     * Reachable through the published surface, not only through the component. backend.md's
     * contract checklist: "Each criterion reachable through the published surface, not only
     * through a component. AC6 was satisfied by testing `inferOntologyBump` directly while the
     * store's refusal path was unobserved."
     *
     * So the same broken release is asked for `factory.dot` by name. Whether that arrives as the
     * resolve refusal or as `undefined` is not the point and is not asserted; what is asserted is
     * that no bytes come back, because a `factory.dot` served off a release the engine cannot
     * read is the exact thing AC4 exists to prevent.
     */
    const own = await scratchDatabase("attractor_broken_serve");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "brokenserve");
      const release = await seedRelease(own, account, bundleBySlug("starter-software-factory"), {
        dot: "this is not DOT at all {{{ -> ->",
      });

      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "serveFile")(
          own.db,
          ANONYMOUS,
          { ownerHandle: account.handle, slug: release.slug, digest: release.digest },
          FACTORY_DOT,
        ),
      );
      expect(
        outcome.kind,
        outcome.kind === "value"
          ? `\`serveFile\` served \`${FACTORY_DOT}\` from a release whose DOT does not parse. ` +
            `AC4 makes this task the last check on emitted Attractor input, so a release the ` +
            `engine cannot read has no \`${FACTORY_DOT}\` to serve.`
          : "",
      ).not.toBe("value");
    } finally {
      await own.drop();
    }
  }, 300_000);
});
