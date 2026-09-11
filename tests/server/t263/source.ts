/* ============================================================
   T263 — the upload suite's one instrument, and why it is not a grep

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests/`, so this module is imported by the suites beside it and
   never collected as one itself.

   Every assertion in this directory reads SOURCE: the wizard is a
   stateful client component, vitest runs with `environment: "node"`
   and no DOM, and the upload route publishes no module surface to
   call. Two traps shape every cell.

   1. This repository's comments quote their own predicates, so a
      raw grep is answered by the docblock that explains the thing
      rather than by the thing. Every pattern is matched against
      `stripComments`'s output, and `instrument.test.ts` falsifies
      the stripper on both axes before any suite trusts it.

   2. A negative over source is green against a tree that does not
      contain the file: no file, no match, pass. So `premise()` runs
      first in every cell and fails OUTSIDE the negative: the files
      exist, clear a byte floor, survive stripping at a sane ratio
      and still carry the identifiers that must survive any rewrite.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** The two directories the upload route lives in. */
export const ROUTE_DIRS = ["app/upload", "components/upload"] as const;

/**
 * The two files the cells name. Enumeration below is mechanical, but a partition that no
 * longer contains these two is a RENAME, and a rename must red rather than silently shrink
 * what the negatives are asserted over.
 */
export const PAGE = "app/upload/page.tsx";
export const FLOW = "components/upload/UploadFlow.tsx";

export interface RouteFile {
  /** Repo-relative, POSIX separators. */
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
 * Every source file under the two directories, enumerated from disk. A hand-written list
 * goes stale the first time a component is added, and the negatives would then be asserted
 * over a partition smaller than the one the criterion names.
 *
 * Colocated `.test.ts`/`.test.tsx` are excluded: a test file quoting a sentence in order to
 * assert its absence would otherwise red the absence cells.
 *
 * Fails CLOSED: an empty enumeration is an error rather than an empty comparison, because
 * every negative passes vacuously over zero files.
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
      `T263: ${path} is not in the partition. A rename is a contract change rather than a ` +
        `refactor. Found: ` +
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
 * Identifiers that must still be there after any rewrite of the upload route. They are the
 * premise: a cell that asserts something is absent is only saying something if the file it
 * read still holds the code that stays. Copy is deliberately not pinned here, so a rewrite
 * of the page's sentences cannot red a suite about wiring.
 */
export const SURVIVORS = [
  {
    /* The unreadable-overlay disclosure fires only when `parts.vocabularyProblem` is set, and
       that trigger outlives any copy change. */
    what: "the unreadable-overlay disclosure's trigger",
    pattern: /vocabularyProblem/,
    file: "components/upload/BundleDropzone.tsx",
  },
] as const;

/**
 * Well under each file's size, because a rewrite legitimately deletes copy and comments and
 * a tight floor would red the author for doing so. What this catches is a file stubbed,
 * emptied or replaced by a re-export, which is the shape that makes every negative below
 * pass for the wrong reason.
 */
export const BYTE_FLOORS: Readonly<Record<string, number>> = {
  [PAGE]: 3000,
  [FLOW]: 12000,
};

/**
 * The premise every cell in this suite runs FIRST: the partition is real and still carries
 * what survives, and only then is anything asserted absent from it. Each `expect` below
 * fails OUTSIDE the negative it guards, because an absence reported over a deleted file is
 * not a finding about the route.
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
    expect(ratio, `${path}: stripComments kept ${(ratio * 100).toFixed(0)}%, desynchronised?`)
      .toBeGreaterThan(0.2);
  }

  for (const s of SURVIVORS) {
    const f = fileAt(files, s.file);
    expect(
      occurrences(f.code, s.pattern),
      `${s.what} must survive a rewrite and is missing from ${s.file}. ` +
        "Until it is there, the absence assertions in this suite prove nothing.",
    ).toBeGreaterThan(0);
  }
}

/**
 * The file, or files, that actually name the publish endpoint.
 *
 * Scoped rather than partition-wide: `version` already occurs in `BundleDropzone.tsx`, so a
 * partition-wide count of the body fields was satisfied by a file that builds no request,
 * and removing `version` from the publish body reddened nothing. Asking the question about
 * the file that builds the request is what makes the clause decide anything.
 *
 * The structural claim this makes: the body's fields are named in the same file that names
 * `/api/bundles`. An implementation that splits the two across files is correct and would
 * red here, so the message says exactly that.
 */
export function publishBodyText(files: readonly RouteFile[]): string {
  return files
    .filter((f) => occurrences(f.code, /\/api\/bundles/) > 0)
    .map((f) => f.code)
    .join("\n");
}
