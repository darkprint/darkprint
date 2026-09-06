#!/usr/bin/env node
// Catches docs/ARCHITECTURE.md drifting away from the code it documents: the route
// table in section 4 against the actual app/**/page.tsx files, and the SEAM ids in
// section 8 against the TODO(SEAM-nn) comments that anchor them in the code. Both
// directions, so a removed route or a removed comment is caught as loudly as an added
// one.
//
// ── use versus mention, and why this file is written the way it is ──
// The anchor scan is a text search for a token, and a text search cannot tell a live
// anchor from prose ABOUT a dead one. That is not hypothetical: `lib/content/view.ts:30`
// carries a comment saying no seam is anchored in the file any more, and the comment
// names the token it is retiring. The old needle read that sentence as the anchor it
// announces the removal of, so SEAM-74 stayed off the drift list for the one reason
// that guarantees it should have been on it (§11.0 Q33). The same shape hit
// `tests/task-state-agreement.test.ts` the same day from a quoted State word.
//
// So this file draws the line the codebase already draws in prose: **a token inside
// backticks is a mention, everywhere else it is a use.** Every comment in this tree
// quotes identifiers, paths and routes in Markdown backticks, and no real anchor is
// written that way — measured over app/, components/, lib/, packages/ and scripts/
// before this landed, the rule excludes exactly one occurrence in the whole tree, the
// one in `view.ts`, and moves no other id in either direction.
//
// A consequence worth stating, because it constrains how the correction has to be
// WRITTEN and not only where: prose retiring an anchor must quote the token. A comment
// that opens with a bare token is indistinguishable from an anchor by any reader,
// including a human one, so this script does not try to guess.

import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const ROUTES_DOC = join(ROOT, "docs/architecture/routes.md");
const SEAMS_DOC = join(ROOT, "docs/architecture/seams.md");
const APP_DIR = join(ROOT, "app");
// `packages/` is here because it was not here originally, and the omission was never a
// decision: the list was written when the repository had no `packages/` tree at all, and
// nobody widened it when the CLI and the MCP server moved in. A checker that walks four
// of five source trees still prints "in sync" for the fifth, so it reports a clean bill it
// has not earned, and it reports the opposite too: SEAM-117's anchor lives at
// `packages/mcp/src/tools.ts:41` and was read as missing for as long as the walk could not
// reach it. Measured before landing (D-111): widening moves exactly one id, SEAM-117, off
// the drift list and adds nothing in either direction.
const CODE_DIRS = ["app", "components", "lib", "packages", "scripts"];

// Split so this script's own source does not contain the token it searches for. It walks
// `scripts/`, so a literal here would anchor a seam in the checker itself.
const SEAM_TOKEN = new RegExp("TODO" + "\\(SEAM-(\\d+)\\)", "g");

function walk(dir, onFile) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // `dist` joins the skip list with `packages/`, not before it: `packages/mcp/dist` is
      // gitignored build output, and a declaration file emitted with comments preserved
      // carries a copy of every anchor in its source. That copy would satisfy a doc row on
      // a developer machine and vanish in a bare CI checkout, which makes the checker
      // answer differently depending on whether anyone ran a build.
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      walk(full, onFile);
    } else {
      onFile(full);
    }
  }
}

// --- Use versus mention ---

/**
 * The backtick-delimited spans of `text`, as `[start, end)` byte offsets.
 *
 * Pairing follows CommonMark's code-span rule — a run of N backticks closes against the
 * next unconsumed run of exactly N — for two reasons. It is what the comments in this
 * tree are already written to, so ``a mention in double backticks`` and `a whole
 * // TODO(SEAM-nn) line quoted inside one` are both caught, where a lookaround for a
 * single adjacent backtick would miss the second. And an UNPAIRED run stays literal text
 * rather than opening a span that runs to end of file, which is what keeps a stray
 * backtick in one comment from silently swallowing every anchor below it.
 *
 * A JavaScript template literal is a one-backtick span by this rule, which is deliberate:
 * a token inside one is fixture data or generated output, never an anchor.
 */
export function quotedSpans(text) {
  const runs = [];
  for (const m of text.matchAll(/`+/g)) runs.push({ at: m.index, len: m[0].length });

  const spans = [];
  const consumed = new Set();
  for (let i = 0; i < runs.length; i++) {
    if (consumed.has(i)) continue;
    for (let j = i + 1; j < runs.length; j++) {
      if (consumed.has(j) || runs[j].len !== runs[i].len) continue;
      spans.push([runs[i].at, runs[j].at + runs[j].len]);
      consumed.add(i);
      consumed.add(j);
      break;
    }
  }
  return spans;
}

/**
 * Every seam id `text` ANCHORS, and every seam id it only MENTIONS, kept apart.
 *
 * Mentions are returned rather than discarded because a discarded one is how the defect
 * hid: a seam documented in section 8 whose only occurrence in the code is a mention is a
 * seam with no anchor, and the report is far more useful when it can say so instead of
 * naming the id and leaving the reader to grep.
 */
export function seamIdsIn(text) {
  const spans = quotedSpans(text);
  const quoted = (at) => spans.some(([from, to]) => at >= from && at < to);

  const anchored = new Set();
  const mentioned = new Set();
  for (const m of text.matchAll(SEAM_TOKEN)) {
    (quoted(m.index) ? mentioned : anchored).add(`SEAM-${m[1]}`);
  }
  return { anchored, mentioned };
}

// --- Routes: filesystem side ---

export function routeFromPageFile(file) {
  const rel = relative(APP_DIR, file).split(sep).slice(0, -1); // drop "page.tsx"
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

function filesystemRoutes() {
  const routes = new Set();
  walk(APP_DIR, (file) => {
    if (file.endsWith(`${sep}page.tsx`) || file === join(APP_DIR, "page.tsx")) {
      routes.add(routeFromPageFile(file) === "/" ? "/" : routeFromPageFile(file));
    }
  });
  // root page.tsx: rel segments is [], join gives "" -> normalize to "/"
  if (routes.has("")) {
    routes.delete("");
    routes.add("/");
  }
  return routes;
}

// --- Routes: doc side ---

export function docRoutes(text) {
  const routes = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]*page\.tsx[^`]*)`\s*\|/);
    if (m) routes.add(m[1]);
  }
  return routes;
}

// --- SEAM ids: code side ---

function codeSeamIds() {
  const anchored = new Set();
  const mentionedAt = new Map();
  for (const dir of CODE_DIRS) {
    walk(join(ROOT, dir), (file) => {
      if (!/\.(ts|tsx)$/.test(file)) return;
      const found = seamIdsIn(readFileSync(file, "utf8"));
      for (const id of found.anchored) anchored.add(id);
      for (const id of found.mentioned) {
        if (!mentionedAt.has(id)) mentionedAt.set(id, []);
        mentionedAt.get(id).push(relative(ROOT, file));
      }
    });
  }
  return { anchored, mentionedAt };
}

// --- SEAM ids: doc side ---

export function docSeamIds(text) {
  const ids = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*(SEAM-\d+)\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

// --- Compare ---

export function symmetricDifference(a, b) {
  const onlyA = [...a].filter((x) => !b.has(x)).sort();
  const onlyB = [...b].filter((x) => !a.has(x)).sort();
  return { onlyA, onlyB };
}

/**
 * The whole report, as lines and an exit code, given everything already gathered.
 *
 * Separated from `main` so the interesting half can be driven without a filesystem. The
 * annotation on a documented-but-unanchored id is the part that has to be exercised: it
 * is the sentence that would have made SEAM-74's absence readable, and a report only ever
 * printed by a run over the live tree can only be asserted against whatever that tree
 * happens to drift by today.
 */
export function reportDrift({
  fsRoutes,
  documentedRoutes,
  anchored,
  documentedSeamIds,
  mentionedAt = new Map(),
}) {
  const lines = [];
  let failed = false;

  const routeDiff = symmetricDifference(fsRoutes, documentedRoutes);
  if (routeDiff.onlyA.length || routeDiff.onlyB.length) {
    failed = true;
    lines.push("Route drift between app/**/page.tsx and docs/architecture/routes.md:");
    if (routeDiff.onlyA.length) {
      lines.push("  In the filesystem, missing from the doc:");
      for (const r of routeDiff.onlyA) lines.push(`    ${r}`);
    }
    if (routeDiff.onlyB.length) {
      lines.push("  In the doc, missing from the filesystem:");
      for (const r of routeDiff.onlyB) lines.push(`    ${r}`);
    }
  }

  const seamDiff = symmetricDifference(anchored, documentedSeamIds);
  if (seamDiff.onlyA.length || seamDiff.onlyB.length) {
    failed = true;
    lines.push("SEAM drift between anchor comments and docs/architecture/seams.md:");
    if (seamDiff.onlyA.length) {
      lines.push("  In the code, missing from the doc:");
      for (const s of seamDiff.onlyA) lines.push(`    ${s}`);
    }
    if (seamDiff.onlyB.length) {
      lines.push("  In the doc, missing from the code:");
      for (const s of seamDiff.onlyB) {
        // Naming the file turns "why is this listed, I can see the token right there" into
        // a one-line answer. It is the case that hid SEAM-74, so the report says it aloud.
        const where = mentionedAt.get(s);
        const note = where ? ` (mentioned, not anchored, in ${where.join(", ")})` : "";
        lines.push(`    ${s}${note}`);
      }
    }
  }

  if (!failed) {
    lines.push(
      `docs/ARCHITECTURE.md in sync: ${fsRoutes.size} routes, ${anchored.size} seams.`,
    );
  }
  return { lines, code: failed ? 1 : 0 };
}

function main() {
  const { anchored, mentionedAt } = codeSeamIds();
  const { lines, code } = reportDrift({
    fsRoutes: filesystemRoutes(),
    documentedRoutes: docRoutes(readFileSync(ROUTES_DOC, "utf8")),
    anchored,
    documentedSeamIds: docSeamIds(readFileSync(SEAMS_DOC, "utf8")),
    mentionedAt,
  });

  for (const line of lines) console.log(line);
  return code;
}

function isEntryPoint() {
  const argv = process.argv[1];
  if (!argv) return false;
  try {
    return realpathSync(argv) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = main();
