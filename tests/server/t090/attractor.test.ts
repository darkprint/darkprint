/* ============================================================
   T090 — AC4, the last check on emitted Attractor input

   ── this file's own header used to say the opposite, and the
      correction is the point ──
   It claimed the ten outcome tests below did not discriminate,
   because `emitAttractorDot` was "total" and no `ResolvedBlueprint`
   could emit invalid Attractor DOT. **That was wrong, and both
   premises it rested on were true.** `toAttractorIdentifier` does
   close the node ids; `quoteAttractorString` does close the string
   values. The emitter writes exactly one attribute UNQUOTED —
   `max_retries=${String(cap)}` at `emit.ts:461` — and its value
   comes from `card.params`, not from the DOT.

   The region searched was source-DOT hostility (a `type=` handler
   override, a `#` comment, an HTML-like value, `strict digraph`),
   and the value that breaks it enters from the card. Four probes,
   all clean, all in the wrong place. The boundary was the claim.

   Measured here rather than taken on report:

       Number.isInteger(1e23)                     true
       String(1e23)                               "1e+23"
       readIterationCap({max_iterations: 1e23})   1e+23
       bundle resolves with errors?               false
       emitted                                    max_retries=1e+23
       parseDot                                   dot/parse-error:
         "Expected `=` after the attribute `e`, found `+`."
       graph produced?                            false

   So a single card carrying a large integer cap resolves clean,
   scores, and produces a complete-looking nine-file folder whose
   `factory.dot` will not parse. That is exactly the failure AC4
   exists to prevent, it is reachable through the published surface,
   and `exportRelease: the emitted factory.dot is not valid
   Attractor input.` is a live refusal path rather than a dead one.

   ── but the reversal is only half, and the halves were measured
      separately ──
   Removing the PARSE check now reds 1. Removing the LINT check
   still reds 0. The `1e+23` input never produces a graph, so
   `lintAttractor` is never reached by it, and every cap that does
   parse is a plain integer and so an admissible value. The lint
   half remains unobserved through the published surface and no
   input for it has been found — stated as "not observed", not as
   "unreachable", because claiming unreachability from a search is
   the exact error this header is correcting.

   ── and the ten outcome tests below still do not discriminate ──
   Measured, not assumed: removing the parse check reds exactly one
   test, the new one. The nine shipped bundles carry no such card,
   so their served `factory.dot` parses and lints whether or not
   this layer checks. What changed is the REASON they are weak, and
   the difference matters: it is no longer "the emitter cannot
   produce invalid output" (false), it is "these nine inputs do not
   happen to" (true, and contingent — the day a shipped bundle
   carries a large integer cap, they fire). A weak test whose
   weakness is contingent is worth more than one whose weakness is
   structural, and both are worth more than an unlabelled one.

   ── what this file does not do ──
   It does not pin `1e+23`, or any rendering of the cap. The
   `String(cap)` defect is `lib/core/attractor/emit.ts`'s, Forbidden
   to this task and owing an owner; a test that asserted the buggy
   output would make the defect permanent and would red the day it
   is fixed. What is asserted is that a release whose `factory.dot`
   does not parse is REFUSED — which stays true whichever way the
   emitter is repaired.
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
   * WEAK BUT CONTINGENTLY SO, and measured rather than argued: removing the parse check reds
   * exactly one test in this file and it is not one of these. The nine shipped bundles carry no
   * card whose iteration cap renders in exponential form, so their `factory.dot` parses and lints
   * whether or not this layer checks.
   *
   * Kept, and the label is no longer the one an earlier version of this file carried. These are
   * not weak because the emitter cannot produce invalid output — it can (see the header) — they
   * are weak because these nine inputs do not happen to. That is a property of the archive, not
   * of the engine, and it stops being true the day a bundle ships such a card.
   */
  for (const slug of archive().map((entry) => entry.slug)) {
    it(`serves a factory.dot for ${slug} that lexes, parses and lints`, async () => {
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

  it("serves a factory.dot whose node ids are all Attractor identifiers", async () => {
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

  it("refuses a release whose factory.dot does not parse, though the release itself resolves clean", async () => {
    /*
     * THE CRITERION'S OWN CASE, and the one the earlier version of this file wrongly reported as
     * unreachable. One pinned card declares an iteration cap large enough that `String(cap)`
     * renders in exponential form; `readIterationCap` admits it because `Number.isInteger(1e23)`
     * is true, and `emit.ts` writes `max_retries=` **unquoted**. The DOT parses, the bundle
     * resolves with **no** error diagnostics, both scores compute, and the folder that comes out
     * has nine files and a `factory.dot` that will not lex.
     *
     * That is the whole of AC4 in one input: nothing before this layer refuses it. T010 stores it,
     * `resolveBundle` is happy with it, `hasErrors` is false, and the degraded-resolve check added
     * for the other half of AC4 does not fire. Only `parseDot` on the emitted bytes catches it.
     *
     * The cap is planted in the card's stored YAML *and* its stored body, because nothing
     * published says which of the two an export resolves from.
     *
     * Nothing here asserts the rendering. `1e+23` is a defect in `lib/core/attractor/emit.ts` —
     * Forbidden to this task and owing an owner — and pinning the broken output would make it
     * permanent and red the day it is fixed. What is asserted is the refusal, which survives any
     * repair to the emitter.
     */
    const own = await scratchDatabase("attractor_exponential");
    try {
      await seedOntology(own.db);
      const account = await seedAccount(own, "exponential");
      const HUGE = 100000000000000000000000; // 1e23; `String()` gives "1e+23"
      const release = await seedRelease(own, account, bundleBySlug("checkpoint-resume-runner"), {
        patchCard: {
          refMatch: "bounded-retry",
          source: (text) =>
            /^params:\s*$/m.test(text)
              ? text.replace(/^params:\s*$/m, `params:\n  max_iterations: ${HUGE}`)
              : `${text}\nparams:\n  max_iterations: ${HUGE}\n`,
          body: (body) => ({
            ...body,
            params: { ...((body.params as Record<string, unknown>) ?? {}), max_iterations: HUGE },
          }),
        },
      });

      const mod = await loadExport();
      const outcome = await outcomeOf(() =>
        requiredFn(mod, "exportRelease")(own.db, ANONYMOUS, release.bundleId, release.digest),
      );
      if (outcome.kind === "value") {
        const files = outcome.value as readonly { path: string; text: string }[];
        const factory = files.find((f) => f.path === FACTORY_DOT);
        const parsed = factory === undefined ? undefined : parseDot(factory.text, FACTORY_DOT);
        throw new Error(
          `\`exportRelease\` served a ${files.length}-file folder whose \`${FACTORY_DOT}\` ` +
            `${parsed?.graph === undefined ? "does not parse" : "parses"}: ` +
            `${parsed?.diagnostics.map((d) => d.message).join("; ") ?? "(no factory.dot at all)"}. ` +
            `The release resolves clean, so this layer is the last thing standing between a ` +
            `complete-looking folder and a runner that cannot read it.`,
        );
      }
      expectThrewExactly(
        outcome,
        ADMISSIBLE.badFactoryDot,
        "`exportRelease` on a release whose emitted factory.dot does not parse",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

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
