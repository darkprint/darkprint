/* ============================================================
   T263 — the blind suite's one instrument, and why it is not a grep

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/`, so this module is imported by the suites beside it and
   never collected as one itself. `tests/server/contract.ts` does
   the same thing for the same reason.

   ── why every assertion here reads SOURCE ──
   T263 publishes no module surface (`backend.md`, its Published
   signatures block). Its deliverable is route and component files,
   and D-263-03 ruled AC3 to be "a SOURCE-LEVEL assertion over
   `components/upload/UploadFlow.tsx`, in T262-AC6's own idiom —
   greppable, not rendered", after finding that the success screen
   is step 4 of a stateful client component, that `vitest.config.ts`
   sets `environment: "node"` with no jsdom, and that
   `components/site/honesty.test.ts:139-140` refuses lifting the
   sentence out "for a test's convenience". So there is no DOM to
   drive the wizard with and no export to call. Source is what is
   left.

   ── ── ── the trap this file exists to disarm ── ── ──
   **This repository's comments quote their own predicates**, so a
   raw grep is answered by the docblock that explains the thing
   rather than by the thing. That is not a hypothesis here, it is a
   measurement at `32274eb`, before any cutover work:

       /api/bundles   raw 2   comment-stripped 0
       SEAM-\d+       raw 15  comment-stripped 0

   A cell asserting "the route reaches `POST /api/bundles`" over raw
   bytes is therefore **already green on the shipped tree**, where
   nothing is wired and `fetch(` appears zero times in the whole
   partition. It would have proved nothing and no mutation could
   have reddened it. Every pattern below is matched against
   `stripComments`'s output for that reason, and
   `instrument.test.ts` falsifies the stripper itself on both axes
   before any suite trusts it.

   ── the second trap, and the shape of every cell in this suite ──
   A negative over source is **green against a tree that does not
   contain the file**: no file, no match, pass. That is the
   `rejects`-wrapper launderer in grep form. So `premise()` runs
   first in every cell and fails OUTSIDE the negative — the file
   exists, clears a byte floor, survives stripping at a sane ratio,
   and still carries the sentences that are supposed to SURVIVE the
   cutover. The survivors are what make the absences discriminating
   rather than vacuous, and they are listed in `SURVIVORS` with the
   ruling that keeps each one.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** The two grants in T263's `Owns` line, read off `backend.md` rather than recalled. */
export const ROUTE_DIRS = ["app/upload", "components/upload"] as const;

/**
 * The two files every ruling cites by name. Enumeration below is mechanical, but a
 * partition that no longer contains these two is a RENAME, and a rename must red rather
 * than silently shrink what the negatives are asserted over.
 */
export const PAGE = "app/upload/page.tsx";
export const FLOW = "components/upload/UploadFlow.tsx";

export interface RouteFile {
  /** Repo-relative, POSIX separators — the form `backend.md` and the rulings cite. */
  path: string;
  raw: string;
  /** `raw` with comments removed. Every pattern in this suite is matched against this. */
  code: string;
}

/* --------------------- the stripper --------------------- */

/**
 * Remove line comments, block comments and JSX comments, leaving string and
 * template literals — and JSX text — intact.
 *
 * **A single-quoted or double-quoted literal must close on its own line, or the quote is
 * not a string opener.** That rule is not stylistic. `.tsx` text nodes contain apostrophes,
 * and a scanner that treats the `'` in a rendered word as a string start desynchronises for
 * the rest of the file and silently swallows real code. Requiring the close on the same
 * line is exactly the language's own rule for these two quote forms — a raw newline in
 * either is a syntax error — so it costs nothing and it cannot desynchronise. Template
 * literals really do span lines and are handled separately.
 *
 * Regex literals are NOT tracked. A `//` inside one would have to survive escaping to
 * appear at all, and the failure mode is a comment that fails to strip: a FALSE RED, seen
 * immediately, rather than a false green. `instrument.test.ts` pins the ratio and the
 * survivor tokens so a desync of either kind is caught rather than assumed absent.
 */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        /* Newlines are kept so a line number quoted in a failure still means something. */
        if (src[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === "`") {
      out += c;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === "`") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const close = closeOnSameLine(src, i, c);
      if (close === -1) {
        out += c;
        i += 1;
        continue;
      }
      out += src.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function closeOnSameLine(src: string, open: number, quote: string): number {
  let i = open + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "\n") return -1;
    if (c === quote) return i;
    i += 1;
  }
  return -1;
}

/* --------------------- reading the partition --------------------- */

/**
 * Every source file under T263's two grants, enumerated from disk.
 *
 * `common-traps.md`: "Enumerate mechanically and transitively, never from recall." A
 * hand-written list goes stale the first time the implementer adds a component, and the
 * negatives would then be asserted over a partition smaller than the one the criterion
 * names.
 *
 * Colocated `.test.ts`/`.test.tsx` are excluded: they are the implementer's own regression
 * tests, `components/upload/progress.test.ts` is frozen by D-263-05, and a test file
 * QUOTING a retired sentence in order to assert its absence would otherwise red AC5.
 *
 * Fails CLOSED, the way `tests/route-partition.test.ts` does: an empty enumeration is an
 * error rather than an empty comparison, because every AC5 negative passes vacuously over
 * zero files.
 */
export function routeFiles(): RouteFile[] {
  const found: RouteFile[] = [];
  for (const dir of ROUTE_DIRS) walk(join(REPO_ROOT, dir), dir, found);
  if (found.length === 0) {
    throw new Error(
      `T263: no source files found under ${ROUTE_DIRS.join(", ")}. ` +
        "Every negative in this suite passes vacuously over an empty partition, so this " +
        "is a broken instrument rather than a clean tree.",
    );
  }
  return found;
}

function walk(abs: string, rel: string, into: RouteFile[]): void {
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return;
  }
  for (const name of entries.sort()) {
    const child = join(abs, name);
    const childRel = `${rel}/${name}`;
    if (statSync(child).isDirectory()) {
      walk(child, childRel, into);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    if (/\.test\.tsx?$/.test(name)) continue;
    const raw = readFileSync(child, "utf8");
    into.push({ path: childRel, raw, code: stripComments(raw) });
  }
}

export function fileAt(files: readonly RouteFile[], path: string): RouteFile {
  const hit = files.find((f) => f.path === path);
  if (hit === undefined) {
    throw new Error(
      `T263: ${path} is not in the partition. Every ruling in this task cites it by name, ` +
        `so a rename is a contract change rather than a refactor. Found: ` +
        `${files.map((f) => f.path).join(", ")}`,
    );
  }
  return hit;
}

export function occurrences(haystack: string, pattern: RegExp): number {
  return (haystack.match(new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`)) ?? [])
    .length;
}

/* --------------------- the survivors, and the premise they carry --------------------- */

/**
 * Sentences and identifiers that must still be there AFTER the cutover, each with the
 * ruling that keeps it. These are the premise: a cell that asserts a retired sentence is
 * gone is only saying something if the file it read still holds the copy that stays.
 *
 * Every count here is a MEASUREMENT at `32274eb`, not an expectation — recorded so a
 * later reader can tell a survivor that was deleted from one that was never there.
 */
export const SURVIVORS = [
  {
    /* D-263-02: "STAYS. T270 is `todo` and removing it would be a false claim."

       **The pattern is the CLAIM, not the sentence, and that correction cost 20 false reds.**
       It first read `/nor is there a live push…/`. "Nor is there" was a coordinating
       conjunction that only parsed while the two sentences AC5 retires stood in front of it;
       with those gone the implementer rewrote the survivor to stand alone — "Not built yet: a
       live push from the editor the skill runs in" — and moved the ledger pin with it in the
       same commit, which is exactly what D-78 asks for. Pinning the grammar reddened a
       correct page, and because this is the premise every other cell runs first, it reddened
       31 of 44 cells for one cause. A survivor pattern must match every wording the claim can
       honestly take. */
    what: "the skill's live-push refusal",
    pattern: /live push from the editor the skill runs in/i,
    file: PAGE,
    ruling: "D-263-02",
  },
  {
    /* The Contract line: `still being written` and `blocked` with an error count survive;
       only `not wired up` goes. */
    what: "the `still being written` disabled reason",
    pattern: /still being written/i,
    file: FLOW,
    ruling: "T263 Contract",
  },
  {
    /* D-263-01: "`BundleDropzone.tsx:436-439` is NOT the same sentence and is UNTOUCHED":
       it fires only when `parts.vocabularyProblem` is set and stays true after any cutover. */
    what: "the unreadable-overlay disclosure's trigger",
    pattern: /vocabularyProblem/,
    file: "components/upload/BundleDropzone.tsx",
    ruling: "D-263-01",
  },
] as const;

/**
 * The floors are half of each file's size at `32274eb` (`page.tsx` 13528,
 * `UploadFlow.tsx` 55005). Half, because the cutover legitimately DELETES copy — the
 * `not wired up` reason, two ledger sentences — and a tight floor would red the
 * implementer for doing what the contract asks. What this catches is a file stubbed,
 * emptied or replaced by a re-export, which is the shape that makes every negative below
 * pass for the wrong reason. `honesty.test.ts:521-527` uses the same device and says why:
 * "A ledger held over an empty string passes every case in it."
 */
export const BYTE_FLOORS: Readonly<Record<string, number>> = {
  [PAGE]: 6700,
  [FLOW]: 27500,
};

/**
 * The premise every cell in this suite runs FIRST.
 *
 * `wave-blind.md`: "Bind the module LAST in a cell — after the premises and the planting.
 * An early red masks every write below it while being correct about its own subject." The
 * source analogue is this: assert the partition is real and still carries what survives,
 * and only then assert that something is absent from it. Each `expect` below fails
 * OUTSIDE the negative it guards, which is the whole point — an absence reported over a
 * deleted file is not a finding about copy.
 */
export function premise(files: readonly RouteFile[]): void {
  expect(files.length, "T263 partition is empty; every negative below would pass vacuously")
    .toBeGreaterThan(0);

  for (const [path, floor] of Object.entries(BYTE_FLOORS)) {
    const f = fileAt(files, path);
    expect(f.raw.length, `${path} is below its byte floor — stubbed or emptied?`)
      .toBeGreaterThan(floor);
    /* The stripper is an instrument, so its output is checked for sanity wherever it is
       used. A desync swallows code and would silently satisfy every absence assertion. */
    const ratio = f.code.length / f.raw.length;
    expect(ratio, `${path}: stripComments kept ${(ratio * 100).toFixed(0)}% — desynchronised?`)
      .toBeGreaterThan(0.2);
    expect(ratio, `${path}: stripComments removed nothing — did it run?`).toBeLessThan(0.98);
  }

  for (const s of SURVIVORS) {
    const f = fileAt(files, s.file);
    expect(
      occurrences(f.code, s.pattern),
      `${s.ruling}: ${s.what} must SURVIVE the cutover and is missing from ${s.file}. ` +
        "Until it is there, the absence assertions in this suite prove nothing.",
    ).toBeGreaterThan(0);
  }
}

/* --------------------- D-263-05, the frozen pair --------------------- */

/**
 * `components/upload/progress.ts` and its test, pinned by content digest at `32274eb`.
 *
 * D-263-05 carved both OUT of T263's `Owns`: `lib/server/publish/publish.ts:48` imports
 * `bundleProgress` from this file and `publish.ts:163-176` consumes `progress.state`,
 * `placed` and `total` directly, so a merged and verified module's AC1/AC2 distinction is
 * decided here. The implementer owns its own regression tests and the blind author may not
 * read them, so nothing else in the tree enforces the freeze.
 *
 * A digest rather than a mtime or a line count: `sha256` is stable across processes where
 * a hashed object identity is not, and "equal size" has passed for a different file here
 * before. **A red is the intended signal even when the change is legitimate** — the ruling
 * says a change here "is a T100 change and comes back to me", so this cell's job is to
 * make it arrive rather than to judge it.
 */
export const FROZEN: Readonly<Record<string, string>> = {
  "components/upload/progress.ts":
    "04b7cc4d71ad4f96c682ae6add3e0d6613cf0a2ff89b0425774861299d6f1235",
  "components/upload/progress.test.ts":
    "548c52cf4fdb78c8c9f8476c474dd486eefda105dc153f8e575a7852540a30a5",
};

export function sha256Of(relPath: string): string {
  return createHash("sha256").update(readFileSync(join(REPO_ROOT, relPath))).digest("hex");
}

/**
 * The file, or files, that actually name the publish endpoint.
 *
 * **Scoped rather than partition-wide, and the mutation table is why.** The body-field cells
 * first asserted their tokens across the whole partition, where `version` already occurs in
 * `components/upload/BundleDropzone.tsx` at `32274eb`. Paired with `ownerHandle` — which
 * measures 0 — the cell reddened for its partner's reason and the `version` clause never
 * decided anything. Mutation C removed `version` from the publish body and reddened **0 of
 * 44 cells**. That is `paired clauses mask each other`, and the fix is to ask the question
 * about the file that builds the request rather than about the folder.
 *
 * The structural claim this makes: the body's fields are named in the same file that names
 * `/api/bundles`. An implementation that splits the two across files is correct and would
 * red here — so the message says exactly that, and the split is worth hearing about rather
 * than passing silently.
 */
export function publishBodyText(files: readonly RouteFile[]): string {
  return files
    .filter((f) => occurrences(f.code, /\/api\/bundles/) > 0)
    .map((f) => f.code)
    .join("\n");
}
