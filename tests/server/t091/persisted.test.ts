/* ============================================================
   T091 — AC1, `readPersisted` on its own

   No database. These cells are about one verb and one bucket, so
   the only infrastructure they need is `S3_*`, and keeping them
   apart from the serving cells means an S3 outage reds four
   sentences about storage rather than reddening the whole
   partition with messages about releases.

   ── the artefacts here are planted through T100's WRITER ──
   Nothing below writes a byte of the container format. §T091: it
   "is T100's and is not this task's to redefine". A suite that
   hand-rolled the JSON at the write end and read it back at the
   read end would be a closed loop agreeing with itself, and would
   stay green on the day T100 changed the format underneath it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { encodeArtefacts } from "@/lib/server/publish";
import type { ObjectStorage } from "@/lib/db";
import type { ExportedFile } from "@/lib/content/bundle-export";

import { outcomeOf } from "../t090/contract";
import {
  CONTRACT_SHA,
  EXPORT,
  PUBLISHED,
  decode,
  describeValue,
  frozenBytesFor,
  loadExport,
  requiredFn,
  type UnknownFn,
} from "./contract";
import {
  clearWritten,
  expectNoObject,
  freeze,
  putRaw,
  storage,
  syntheticDigest,
} from "./fixtures";

let store: ObjectStorage;

/**
 * A file set with no shipped bundle behind it, on purpose.
 *
 * These cells are about the verb, not about a release, so the folder is synthetic — and its
 * texts carry a marker no exporter could emit, which is what lets a red distinguish "read the
 * frozen object" from "generated something that happened to look similar". There is no
 * generator on this path at all, but the habit is the one common-traps asks for: exclude the
 * bad output rather than admit the good one.
 */
const MARKER = "t091-frozen-marker";
const FOLDER: readonly ExportedFile[] = [
  { path: "README.md", text: `# ${MARKER} readme\n` },
  { path: "factory.dot", text: `digraph { /* ${MARKER} */ }\n` },
  { path: "cards/a@1.0.0.yaml", text: `id: a # ${MARKER}\n` },
];

beforeAll(() => {
  store = storage();
});

afterAll(async () => {
  /* `ObjectStorage` publishes put, get and delete and no `list`, so residue cannot be swept —
     it has to be a ledger kept at the write. See fixtures.ts. */
  if (store !== undefined) await clearWritten(store);
}, 60_000);

/**
 * `readPersisted`, bound LAST.
 *
 * Bound inside each cell rather than in the hook, and after that cell's planting. common-traps:
 * a throw in `beforeAll` produces SKIPS rather than reds — 127 merged cells went silent under
 * one broken writer today — so the per-criterion red belongs in the cell. And wave-blind: bind
 * the module last, because an early red masks every fixture write below it while being correct
 * about its own subject, and a red in 0ms where I/O was expected is a cell that never started.
 */
async function callReadPersisted(digest: string, path: string): Promise<unknown> {
  return (await readPersistedFn())(store, digest, path);
}

/**
 * Binding split out from calling, and the split is a correction rather than a style.
 *
 * The first draft wrapped `callReadPersisted` in `outcomeOf` for the does-not-throw cell. Against
 * the absent module that cell reported **"`readPersisted` threw for bytes that are not JSON at a
 * digest that has an object"** — a sentence that is plausible, specific and about the wrong thing:
 * what threw was the binding, three lines earlier, because the module publishes no such name.
 *
 * `outcomeOf` catches by construction, so anything raised inside it is reported as the behaviour
 * under test. Binding OUTSIDE it puts the absent-module red back in its own voice, and leaves
 * `outcomeOf` measuring only what the call did. The module is still bound last — after the
 * planting — which is the other half of the rule.
 */
async function readPersistedFn(): Promise<UnknownFn> {
  const mod = await loadExport();
  return requiredFn(mod, "readPersisted");
}

/* --------------------- AC1 --------------------- */

describe("AC1 — readPersisted reads back what persistArtefacts froze", () => {
  it("returns the stored bytes for every path in the folder", async () => {
    const digest = syntheticDigest();
    await expectNoObject(store, digest);
    await freeze(store, digest, FOLDER);

    for (const file of FOLDER) {
      const expected = frozenBytesFor(FOLDER, file.path);
      expect(
        expected,
        `T100's own codec finds no \`${file.path}\` in the folder it encoded.`,
      ).toBeDefined();

      const got = await callReadPersisted(digest, file.path);
      expect(
        got,
        `${EXPORT}'s \`readPersisted\` answered ${describeValue(got)} for \`${file.path}\` at a ` +
          `digest whose object was written by \`persistArtefacts\` one line earlier.\n` +
          `  backend.md §T091 (${CONTRACT_SHA}): ${PUBLISHED.readPersisted}\n` +
          `  \`undefined\` here is the pre-persistence answer, and this release is not one: the ` +
          `object is present and holds this exact path.`,
      ).toBeInstanceOf(Uint8Array);
      expect(
        decode(got as Uint8Array),
        `\`readPersisted\` returned different bytes from the ones \`selectArtefact\` selects out ` +
          `of the same folder. §T091 derives the verb as \`storage.get(digest)\` handed to ` +
          `\`decodeArtefacts\`, then \`selectArtefact\` — so the two cannot legitimately differ.`,
      ).toBe(decode(expected as Uint8Array));
      expect(
        decode(got as Uint8Array),
        `The bytes came back without the fixture's marker, so they are not this folder's.`,
      ).toContain(MARKER);
    }
  }, 60_000);

  it("answers `undefined` for a digest nothing has frozen", async () => {
    /*
     * **The half that carries the weight of this task, at the verb level.**
     *
     * Every release currently in the database predates `persistArtefacts`, so this is not an
     * edge case — it is the state of production. §T091: "the fallback is not a convenience".
     * An implementation that threw here, or that answered anything but `undefined`, would break
     * every release that exists in order to serve the ones that do not yet.
     */
    const digest = syntheticDigest();
    await expectNoObject(store, digest);

    const got = await callReadPersisted(digest, "README.md");
    expect(
      got,
      `\`readPersisted\` answered ${describeValue(got)} for a digest with no object behind it.\n` +
        `  That is the pre-freeze release, which is EVERY release in the database today, and ` +
        `\`undefined\` is what tells \`serveFile\` to generate from Postgres instead.`,
    ).toBeUndefined();
  }, 60_000);

  it("answers `undefined` — and does not throw — for an object that is not the container", async () => {
    /*
     * The arm §T091's block dropped until `743865b`, measured at the verb rather than at the type.
     *
     * `lib/server/publish/artefacts.ts`'s own header rules both the value and the reason:
     * "`undefined` rather than a throw, and it is the same value `readPersisted` already
     * publishes for a pre-persistence release. An object written before this format existed, or
     * truncated, is indistinguishable to a reader from a release that was never frozen — and both
     * have the same correct answer, which is to fall back to generating from Postgres. **A throw
     * here would turn a servable release into a 500.**"
     *
     * Three shapes rather than one, because `decodeArtefacts` has three separate ways out and
     * garbage bytes alone only exercise the first. A `readPersisted` that checked for JSON itself
     * would pass the first and fail the third.
     */
    const cases: readonly (readonly [string, Uint8Array])[] = [
      ["bytes that are not JSON", new TextEncoder().encode("  not json at all {")],
      ["JSON that is not an array", new TextEncoder().encode('{"path":"README.md","text":"x"}')],
      ["an array whose entries are not files", new TextEncoder().encode('[{"path":1,"text":2}]')],
    ];

    for (const [what, bytes] of cases) {
      const digest = syntheticDigest();
      await expectNoObject(store, digest);
      await putRaw(store, digest, bytes);

      /* Bound outside `outcomeOf`, so an absent module reds as an absent module rather than as
         "readPersisted threw for bytes that are not JSON" — see `readPersistedFn`. */
      const readPersisted = await readPersistedFn();
      const outcome = await outcomeOf(() => readPersisted(store, digest, "README.md"));
      expect(
        outcome.kind,
        `\`readPersisted\` threw for ${what} at a digest that has an object.\n` +
          `  \`artefacts.ts\` rules this: a throw here turns a servable release into a 500. The ` +
          `object is unreadable, the release is not — generating from Postgres is the correct ` +
          `answer and \`undefined\` is how this verb says so.\n` +
          `  It threw: ${outcome.kind === "throw" ? outcome.message : ""}`,
      ).not.toBe("throw");
      expect(
        outcome.kind === "value" ? outcome.value : undefined,
        `\`readPersisted\` returned content for ${what}.`,
      ).toBeUndefined();
    }
  }, 120_000);

  it("decodes T100's PUBLISHED container, not merely its own writes", async () => {
    /*
     * The second axis, and the reason the round-trip cell above is not sufficient on its own.
     *
     * That cell plants through `persistArtefacts` and reads through `readPersisted`. If
     * `readPersisted` invented a private format AND something plausible went wrong at the seam,
     * a suite whose write and read ends were both the implementation's would still be measuring
     * the implementation against itself. Here the bytes go in through `encodeArtefacts` and
     * `storage.put` directly — the published codec at one end and the module under test at the
     * other — so a `readPersisted` that re-derived the layout has nowhere to hide.
     *
     * `artefacts.ts`: "`readPersisted` is expected to call `storage.get(digest)` and hand
     * the result to `decodeArtefacts`, **never to re-derive the layout**."
     */
    const digest = syntheticDigest();
    await expectNoObject(store, digest);
    await putRaw(store, digest, encodeArtefacts(FOLDER));

    const got = await callReadPersisted(digest, "factory.dot");
    expect(
      got,
      `\`readPersisted\` answered ${describeValue(got)} for an object written by T100's own ` +
        `\`encodeArtefacts\`.\n` +
        `  If the round-trip cell above passes and this one fails, the verb is reading a format ` +
        `of its own rather than the published container — which is exactly the arrangement ` +
        `\`artefacts.ts\` exports a decoder to prevent.`,
    ).toBeInstanceOf(Uint8Array);
    expect(decode(got as Uint8Array)).toContain(MARKER);
  }, 60_000);
});

/* --------------------- this suite's own instrument, falsified --------------------- */

describe("the premise guard actually refuses", () => {
  it("expectNoObject throws when an object IS present at the digest", async () => {
    /*
     * **A guard that never fires is indistinguishable from one that cannot.**
     *
     * `expectNoObject` stands under roughly ten cells across this partition, and it is the only
     * thing separating "serves a release that predates the freeze" from "silently exercised the
     * frozen path and reported the fallback as covered". Every one of those calls passes today —
     * which is exactly the shape common-traps calls a claim about an instrument rather than a
     * measurement.
     *
     * Its inert modes are real, not hypothetical: a bucket misconfigured so that `get` always
     * answers `undefined`, or a `keyForDigest` change that moved every key, would make every
     * premise in this suite pass while the frozen cells red for a reason none of their messages
     * mention. So the guard is shown firing, on a digest this cell plants and then removes.
     *
     * Second axis, and it is the point of the two halves: the SAME digest is checked before the
     * plant and after the delete. If the guard could not see objects at all, the middle assertion
     * would fail; if it could not see their absence, the outer two would.
     */
    const digest = syntheticDigest();

    await expectNoObject(store, digest);

    await putRaw(store, digest, new TextEncoder().encode("present"));
    const outcome = await outcomeOf(() => expectNoObject(store, digest));
    expect(
      outcome.kind,
      "`expectNoObject` accepted a digest that has an object at it. Every premise in this " +
        "partition rests on that guard, so an inert one turns ten fallback cells into ten cells " +
        "measuring the frozen path under a name that says otherwise.",
    ).toBe("throw");
    expect(
      outcome.kind === "throw" ? outcome.message : "",
      "`expectNoObject` threw for some other reason than the object being there.",
    ).toContain(digest);

    await store.delete(digest);
    await expectNoObject(store, digest);
  }, 60_000);
});

/* --------------------- what this file deliberately does not assert --------------------- */

/*
 * ── AN UNTESTED REGION, NAMED RATHER THAN LEFT LOOKING COVERED ──
 *
 * There is no cell here for **an object that decodes cleanly and does not contain the requested
 * path** — case (c) of the three `readPersisted`'s `Uint8Array | undefined` collapses.
 *
 * It is unwritten on purpose. The orchestrator ruled R2 — the frozen folder is authoritative for
 * its own digest, so a path missing from a present folder REFUSES rather than falling back — and
 * R2 cannot be expressed by the published return type, which has one `undefined` for all three
 * cases. Until the mechanism is ruled, `undefined` here and a throw here are both defensible
 * readings of a contract that does not say, and a cell asserting either one becomes a defect
 * report against an implementer who followed the other.
 *
 * The criterion itself is not untested: R2 is measured where it is actually ruled, at the
 * caller, in `serve-frozen.test.ts` — `serveFile` refusing with the published `no such file`
 * literal. That cell is correct whichever mechanism `readPersisted` uses internally.
 *
 * Written down rather than omitted silently, because a region nobody names is one every later
 * reader assumes somebody covered — which is how the criterion this whole task exists for sat
 * unowned across four tasks and two merge logs.
 */
