/* ============================================================
   T091 — the published surface, and the premises the rest of
   this suite stands on

   No database and no bucket: everything here is about names,
   arities and shapes. It is the cheapest file in the partition
   and the one whose reds are least ambiguous, which is why the
   premise cells live here rather than inside a `beforeAll`
   somewhere with I/O in it.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  decodeArtefacts,
  encodeArtefacts,
  persistArtefacts,
  selectArtefact,
} from "@/lib/server/publish";

import { ADMISSIBLE } from "../t090/contract";
import {
  CONTRACT_SHA,
  EXPORT,
  NO_SUCH_FILE,
  PUBLISH,
  PUBLISHED,
  loadExport,
  requiredFn,
} from "./contract";

/* --------------------- AC1: the name exists --------------------- */

describe("T091 published surface", () => {
  it("publishes readPersisted from the barrel the contract names", async () => {
    /*
     * AC1's existence half. The barrel is `@/lib/server/export` and not `@/lib/server/publish`:
     * §T091 Forbids `lib/server/publish/**`, so a `readPersisted` that appeared there would be
     * this task writing in T100's module — and it would ALSO be the read half living beside the
     * write half, which is the arrangement that made the criterion invisible for four tasks.
     */
    const mod = await loadExport();
    const fn = requiredFn(mod, "readPersisted");
    expect(typeof fn).toBe("function");
  });

  it("takes the three parameters the Published signatures block states", async () => {
    const mod = await loadExport();
    const fn = requiredFn(mod, "readPersisted");
    expect(
      fn.length,
      `${EXPORT}'s \`readPersisted\` declares ${fn.length} parameters.\n` +
        `  backend.md §T091 (${CONTRACT_SHA}): ${PUBLISHED.readPersisted}\n` +
        `  The \`path\` argument is the whole reason the container is one object per digest: ` +
        `\`keyForDigest\` refuses anything that is not \`sha256:\` + 64 hex, so a folder cannot ` +
        `be stored file-per-key and the verb has to select WITHIN the object. A two-parameter ` +
        `\`readPersisted\` is one that has re-derived the layout somewhere else.`,
    ).toBe(3);
  });

  /**
   * T090's four names still bind after the extension.
   *
   * §T091 owns `lib/server/export/**` as an *extension*, and the failure mode of an extension is
   * subtraction. This is not a duplicate of t090/surface.test.ts: that file asserts the names
   * exist against the module T090 shipped, and this one asserts they survive the module T091
   * ships. The two are the same assertion about two different trees, and only one of them runs
   * in a worktree where T091's changes are the diff.
   */
  it("does not subtract anything T090 published", async () => {
    const mod = await loadExport();
    for (const name of ["serveFile", "exportRelease", "recordDownload"] as const) {
      expect(typeof requiredFn(mod, name)).toBe("function");
    }
  });

  /**
   * `serveFile` still declares FOUR parameters, and this cell exists to name the cause.
   *
   * `serveFile` has to reach object storage and its published signature has no storage in it, so
   * the natural extension is a trailing parameter — and **the natural SPELLING of that parameter
   * reds t090/surface.test.ts:52-70 without saying why.** TypeScript's `?` erases to nothing, so
   * `storage?: ObjectStorage` still counts in `Function.length`: arity becomes 5, t090's arity
   * cell fails, and its message talks about swapped parameter lists because it predates this
   * task by four rounds.
   *
   * This is charged and solved in this repository already. `lib/server/publish/publish.ts:114-127`
   * spells the identical parameter `storage: ObjectStorage | undefined = undefined` under a header
   * that says "**`= undefined` and NOT `?`, and the difference is observable rather than
   * stylistic** ... The `?` spelling shipped here once and was charged as F5". Only a default-value
   * expression or a rest element stops a parameter counting.
   *
   * The second half of that header applies here unchanged and is the more important one: the
   * default is `undefined` rather than `createObjectStorage()` because `objectStorageConfigFromEnv()`
   * throws for an unset `S3_*`. A default evaluated on entry would make `serveFile`'s B-03
   * `undefined` — "the release is absent, or the actor may not see it" — depend on a bucket being
   * configured, which turns a privacy answer into an infrastructure answer.
   */
  it("keeps serveFile at four declared parameters after gaining access to storage", async () => {
    const mod = await loadExport();
    const fn = requiredFn(mod, "serveFile");
    expect(
      fn.length,
      `${EXPORT}'s \`serveFile\` declares ${fn.length} parameters; the contract publishes four.\n` +
        `  ${PUBLISHED.serveFile}\n` +
        `  If this is 5, the likely cause is a storage parameter spelled \`storage?: ObjectStorage\`. ` +
        `TypeScript's \`?\` erases, so an optional parameter still counts; only \`= undefined\` or a ` +
        `rest element stops it. \`lib/server/publish/publish.ts:114-127\` spells exactly this ` +
        `parameter \`storage: ObjectStorage | undefined = undefined\` and its header records the ` +
        `\`?\` spelling shipping once and being charged as F5.\n` +
        `  Two cells fail on this, and the other one is \`tests/server/t090/surface.test.ts\`, ` +
        `whose message predates the reason and will send a reader looking for a swapped parameter ` +
        `list instead.`,
    ).toBe(4);
  });
});

/* --------------------- the refusal literal, spelled once across two partitions --------------------- */

describe("the AC7 refusal form this task inherits", () => {
  /**
   * T091 does not publish a message form of its own. It inherits AC7's.
   *
   * Under the R2 ruling — the frozen folder is authoritative for its own digest — a path absent
   * from a present frozen artefact refuses with **the same literal** a path absent from a
   * generated folder refuses with. That is the point: a caller cannot tell, and must not be able
   * to tell, whether the release it asked for happened to be frozen.
   *
   * So this suite's copy of the literal has to be the same string as t090's, and this cell is
   * the only thing stopping the two partitions growing two spellings of one form. Compared, not
   * imported-and-reused, so it fails loudly rather than agreeing by construction.
   */
  it("spells `no such file` exactly as T090 published it", () => {
    expect(
      NO_SUCH_FILE,
      "This suite's copy of the seventh admissible form and T090's have drifted apart. Two " +
        "partitions holding two spellings of one published literal is how a criterion ends up " +
        "measured by neither.",
    ).toBe(ADMISSIBLE.noSuchFile);
  });
});

/* --------------------- the premise: T100's codec, as SHIPPED --------------------- */

describe("T100's codec is present and has the shape §T091 was corrected to state", () => {
  /*
   * Premises, not criteria. Everything else in this partition plants artefacts through
   * `persistArtefacts` and reads expectations back through `decodeArtefacts`/`selectArtefact`,
   * so if these are wrong the rest of the suite is measuring itself. Cheap, and they turn "the
   * whole partition is red" into one sentence naming which premise moved.
   */

  it("exports the four verbs from the barrel §T091 names", () => {
    for (const [name, fn] of [
      ["persistArtefacts", persistArtefacts],
      ["encodeArtefacts", encodeArtefacts],
      ["decodeArtefacts", decodeArtefacts],
      ["selectArtefact", selectArtefact],
    ] as const) {
      expect(typeof fn, `${PUBLISH} exports no function \`${name}\`.`).toBe("function");
    }
  });

  it("decodeArtefacts answers `undefined` for bytes that are not the container", () => {
    /*
     * The arm §T091's block DROPPED before `743865b`, pinned so the correction cannot silently
     * come undone. `artefacts.ts`'s own header rules it: "`undefined` rather than a throw, and it
     * is the same value `readPersisted` already publishes for a pre-persistence release ... A
     * throw here would turn a servable release into a 500."
     *
     * Three shapes, because the decoder has three separate ways out and a single garbage input
     * would only exercise the first: unparseable bytes, valid JSON that is not an array, and an
     * array whose entries are not `{path, text}` strings.
     */
    const encoder = new TextEncoder();
    expect(decodeArtefacts(encoder.encode("not json at all {"))).toBeUndefined();
    expect(decodeArtefacts(encoder.encode('{"path":"README.md","text":"x"}'))).toBeUndefined();
    expect(decodeArtefacts(encoder.encode('[{"path":"README.md","text":42}]'))).toBeUndefined();
  });

  it("selectArtefact answers BYTES, not an ExportedFile", () => {
    /*
     * The line that falsified §T091's block against itself before `743865b`, pinned in the
     * direction the correction went.
     *
     * The block published `ExportedFile | undefined`. A blind author binding that writes
     * `selectArtefact(files, path)?.text` — `.text` on a `Uint8Array` is `undefined` — and gets a
     * `readPersisted` that answers `undefined` for **every path in a folder that is present**,
     * which is indistinguishable from the pre-freeze fallback and therefore green against every
     * cell that only tests the fallback.
     *
     * `not.toBeInstanceOf` is not enough on its own here and the assertion says why in both
     * directions: it pins that the result IS a `Uint8Array`, which excludes the published-but-wrong
     * shape rather than merely admitting the right one.
     */
    const files = [{ path: "README.md", text: "frozen" }];
    const picked = selectArtefact(files, "README.md");
    expect(picked, "selectArtefact found nothing for a path that is in the file set.").toBeDefined();
    expect(
      picked,
      "selectArtefact returned something that is not a Uint8Array. §T091's block published it as " +
        "`ExportedFile | undefined` until 743865b, and a reader binding that spelling reads " +
        "`.text` off a Uint8Array, gets `undefined` for every present path, and falls back " +
        "silently.",
    ).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(picked as Uint8Array)).toBe("frozen");
    expect(selectArtefact(files, "AGENTS.md")).toBeUndefined();
  });

  it("round-trips a file set through encode and decode", () => {
    /*
     * The premise every planted fixture in this partition rests on, and — measured rather than
     * assumed — the FIRST cell anywhere under `tests/` to touch these four verbs at all. A grep
     * of the whole test tree at `743865b` finds them named only in five prose comments inside
     * `tests/server/t090/serve.test.ts`. T100 shipped the write half unmeasured.
     */
    const files = [
      { path: "README.md", text: "# one\n" },
      { path: "cards/a@1.0.0.yaml", text: "id: a\n" },
    ];
    const back = decodeArtefacts(encodeArtefacts(files));
    expect(back, "T100's own codec does not round-trip its own output.").toEqual(files);
  });
});
