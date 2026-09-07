/* ============================================================
   T091 — the blind contract surface

   Not a test file. `vitest.config.ts` collects `.test.ts` under
   `tests/` and nothing else, so this module is imported by the
   suites beside it and is never collected as one itself.

   ── the partition, and what this author has not read ──
   This suite is written blind against `lib/server/export/**`,
   which is T091's to extend and this author's to leave unopened.
   Everything below is bound from T091's Published
   signatures block and from code that already SHIPS on `backend`.
   The barrel under test is loaded dynamically, for the reason
   t090/contract.ts states: a static top-level import of an absent
   module fails the whole FILE at collection and hides every
   criterion behind the first missing module, which turns a
   per-criterion hand-off into one red.

   ── one barrel under test, one merged one consumed ──
   `@/lib/server/export` is the subject and is dynamic.
   `@/lib/server/publish` is T100's, merged, shipped, and imported
   STATICALLY, because it is a real import of a real module. It is
   how a frozen artefact gets INTO the bucket, not the thing under
   test — the same relationship t090/fixtures.ts has with T010,
   T020 and T030.

   ── the codec is consumed, never restated ──
   Nothing in this suite writes a byte of the container format.
   Every planted artefact goes in through `persistArtefacts` and
   every expectation about what a reader should find comes back
   out through `decodeArtefacts`/`selectArtefact`. T091's
   contract: the format "is T100's and is NOT this task's to
   redefine". A suite that hand-rolled the JSON would be a second
   author of a format that is supposed to have one, and would keep
   passing on the day T100 changed it.

   ── why the D-90-01 helpers are imported and not copied ──
   `outcomeOf`, `expectThrewExactly` and the seven admissible
   message forms live in `../t090/contract.ts`. They encode a
   RULING — that `undefined` and a throw mean two different things
   on the serving path — and a second copy of a ruling is a second
   place for it to drift. They are imported from a sibling TEST
   partition, never from the module under test, so this is not the
   "asks whether the module agrees with itself" shape.
   ============================================================ */

import { decodeArtefacts, selectArtefact } from "@/lib/server/publish";
import type { ExportedFile } from "@/lib/content/bundle-export";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const EXPORT = "@/lib/server/export";
export const PUBLISH = "@/lib/server/publish";

let exportModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for the
 * whole run, and every test that awaits it gets its own copy of the same red rather than one
 * test's failure cascading into an unhandled rejection in the next.
 */
export function loadExport(): Promise<Namespace> {
  exportModule ??= import("@/lib/server/export").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${EXPORT} does not load.\n` +
          `  T091 owns \`lib/server/export/**\` as an EXTENSION — the barrel already ` +
          `ships \`exportRelease\`, \`serveFile\`, \`serveCard\` and \`recordDownload\` from T090, ` +
          `so a module that does not load at all is a regression in the merge rather than an ` +
          `unbuilt criterion.\n` +
          `  The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return exportModule;
}

/* --------------------- what the contract publishes --------------------- */

/**
 * T091's Published signatures block, quoted verbatim, at `743865b`.
 *
 * **`743865b` and not `e5ca6f6`, and the difference is this suite's own first finding.** The
 * block as first published had two wrong codec lines: `decodeArtefacts` dropped `| undefined`,
 * and `selectArtefact` was published as returning an `ExportedFile` when it returns a
 * `Uint8Array`. The second falsified the block against itself — its own derivation composes
 * `storage.get` -> `decodeArtefacts` -> `selectArtefact` into `Promise<Uint8Array | undefined>`,
 * which only type-checks against the shipped return — and a blind author binding the published
 * line writes `selectArtefact(files, path)?.text`, reads `undefined` for every path in a folder
 * that is PRESENT, and lands silently in the pre-freeze fallback. Green against every cell that
 * only ever tests the fallback. Both lines are corrected in the block now; the versions below
 * are the corrected ones, and the sha is written down so a later reader can tell which.
 */
export const PUBLISHED = {
  readPersisted:
    "readPersisted(storage: ObjectStorage, digest: string, path: string): " +
    "Promise<Uint8Array | undefined>",
  serveFile:
    "serveFile(db: Db, actor: Actor, ref: { ownerHandle: string; slug: string; version?: string; " +
    "digest?: string }, path: string): Promise<ServedFile | undefined>",
  exportRelease:
    "exportRelease(db: Db, actor: Actor, bundleId: string, digest: string): " +
    "Promise<readonly ExportedFile[]>",
  recordDownload:
    'recordDownload(db: Db, target: { kind: "blueprint" | "card"; refId: string }): Promise<void>',
} as const;

/** The block's sha, so a red can say which version of the contract it was written against. */
export const CONTRACT_SHA = "743865b";

/**
 * The one refusal literal this suite pins, written out rather than imported from the module.
 *
 * It is T090's seventh admissible form and it is re-declared here as a literal for the reason
 * t090/contract.ts gives for all seven: a test that rebuilds its expectation from the module
 * under test asks whether the module agrees with itself. It is checked against t090's copy in
 * `surface.test.ts`, so the two partitions cannot drift into two spellings of one form without
 * a cell saying so.
 */
export const NO_SUCH_FILE = "serveFile: no such file in this release.";

/**
 * Bind one published name, or throw naming the clause that published it.
 *
 * No fallback and no synonym: the rule is that "where a signature is left open,
 * the test author reports it rather than resolving it — a candidate list papers over the gap
 * and then resolves to whichever name happens to exist first". T000 paid two rounds for the
 * alternative.
 */
export function requiredFn(mod: Namespace, name: keyof typeof PUBLISHED): UnknownFn {
  const value = mod[name];
  if (typeof value !== "function") {
    const exported = Object.keys(mod).sort().join(", ");
    throw new Error(
      `${EXPORT} exports no function \`${name}\`.\n` +
        `  T091 (${CONTRACT_SHA}) Published signatures: ${PUBLISHED[name]}\n` +
        `  It exports: ${exported === "" ? "(nothing)" : exported}\n` +
        `  Bind this name rather than adding a synonym: the contract is what two agents who ` +
        `cannot see each other converge on.`,
    );
  }
  return value as UnknownFn;
}

/* --------------------- reading a frozen artefact without restating its format --------------------- */

/**
 * What T100's codec finds in a raw object, as `path -> text`, or `undefined` if it does not decode.
 *
 * The oracle for every "the frozen bytes are what came back" assertion, and it is deliberately
 * the SHIPPED decoder rather than a reimplementation. Two reasons, and the second is the one
 * that matters: a hand-rolled reader here would be a second author of a format the contract says
 * has one, and — since this suite plants its artefacts through `persistArtefacts` — a private
 * codec at both ends would be a closed loop that agreed with itself and with nothing else.
 */
export function decodeToMap(bytes: Uint8Array): Map<string, string> | undefined {
  const files = decodeArtefacts(bytes);
  if (files === undefined) return undefined;
  return new Map(files.map((file) => [file.path, file.text]));
}

/**
 * The bytes T100's codec says are stored for one path in one file set.
 *
 * Used to state what a correct `readPersisted` must return, without this suite having any
 * opinion about how the bytes are laid out. `selectArtefact` returns a `Uint8Array` — the
 * shipped shape, not the one the block first published.
 */
export function frozenBytesFor(
  files: readonly ExportedFile[],
  path: string,
): Uint8Array | undefined {
  return selectArtefact(files, path);
}

export const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/* --------------------- the served file, checked rather than assumed --------------------- */

export interface Served {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Check the three published `ServedFile` fields on a really-served file, and hand back a view.
 *
 * The `bytes instanceof Uint8Array` half is not ceremony: D-90-04 says a route writes these to
 * a response body as the file's own bytes rather than as a JSON envelope, and a frozen artefact
 * stores `text` — so an implementation that forwarded the codec's string straight out would be
 * type-wrong at exactly the seam this task adds, and wrong in a way every string comparison in
 * this suite would otherwise still pass.
 */
export function asServedFile(value: unknown, what: string): Served {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${what} answered ${describeValue(value)}.\n` +
        `  T090's contract: interface ServedFile { path: string; bytes: Uint8Array; ` +
        `contentType: string }`,
    );
  }
  const file = value as Record<string, unknown>;
  const keys = Object.keys(file).sort();
  if (typeof file.path !== "string") {
    throw new Error(`${what} carries no string \`path\`; it has [${keys.join(", ")}].`);
  }
  if (!(file.bytes instanceof Uint8Array)) {
    throw new Error(
      `${what} carries \`bytes\` as ${describeValue(file.bytes)}.\n` +
        `  T090's contract publishes \`bytes: Uint8Array\`, and D-90-04 has a route write them ` +
        `to a response body as the file's own bytes. The frozen container stores \`text\` as a ` +
        `string, so forwarding the codec's string unconverted is the specific way this task can ` +
        `get the type wrong — and every text comparison in this suite would still pass.`,
    );
  }
  if (typeof file.contentType !== "string" || file.contentType === "") {
    throw new Error(`${what} carries \`contentType\` as ${describeValue(file.contentType)}.`);
  }
  return { path: file.path, bytes: file.bytes, contentType: file.contentType };
}

/** One value, described for a failure message without spilling a whole payload into it. */
export function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `a string ${JSON.stringify(value.slice(0, 60))}`;
  if (value instanceof Uint8Array) return `a Uint8Array of ${value.length} bytes`;
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "object") {
    return `an object with keys [${Object.keys(value as object).sort().join(", ")}]`;
  }
  return `a ${typeof value}`;
}
