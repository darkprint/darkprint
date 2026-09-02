#!/usr/bin/env node
// Catches docs/ARCHITECTURE.md drifting away from the code it documents: the route
// table in section 4 against the actual app/**/page.tsx files, and the SEAM ids in
// section 8 against the TODO(SEAM-xx) comments that anchor them in the code. Both
// directions, so a removed route or a removed comment is caught as loudly as an added
// one.

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

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

function walk(dir, onFile) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // `dist` joins the skip list with `packages/`, not before it: `packages/mcp/dist` is
      // gitignored build output, and a declaration file emitted with comments preserved
      // carries a copy of every `TODO(SEAM-xx)` in its source. That copy would satisfy a
      // doc row on a developer machine and vanish in a bare CI checkout, which makes the
      // checker answer differently depending on whether anyone ran a build.
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      walk(full, onFile);
    } else {
      onFile(full);
    }
  }
}

// --- Routes: filesystem side ---

function routeFromPageFile(file) {
  const rel = relative(APP_DIR, file).split(sep).slice(0, -1); // drop "page.tsx"
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

const fsRoutes = new Set();
walk(APP_DIR, (file) => {
  if (file.endsWith(`${sep}page.tsx`) || file === join(APP_DIR, "page.tsx")) {
    fsRoutes.add(routeFromPageFile(file) === "/" ? "/" : routeFromPageFile(file));
  }
});
// root page.tsx: rel segments is [], join gives "" -> normalize to "/"
if (fsRoutes.has("")) {
  fsRoutes.delete("");
  fsRoutes.add("/");
}

// --- Routes: doc side ---

function docRoutes() {
  const text = readFileSync(ROUTES_DOC, "utf8");
  const routes = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]*page\.tsx[^`]*)`\s*\|/);
    if (m) routes.add(m[1]);
  }
  return routes;
}

const documentedRoutes = docRoutes();

// --- SEAM ids: code side ---

const codeSeamIds = new Set();
for (const dir of CODE_DIRS) {
  walk(join(ROOT, dir), (file) => {
    if (!/\.(ts|tsx)$/.test(file)) return;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/TODO\(SEAM-(\d+)\)/g)) {
      codeSeamIds.add(`SEAM-${m[1]}`);
    }
  });
}

// --- SEAM ids: doc side ---

function docSeamIds() {
  const text = readFileSync(SEAMS_DOC, "utf8");
  const ids = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*(SEAM-\d+)\s*\|/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

const documentedSeamIds = docSeamIds();

// --- Compare ---

function symmetricDifference(a, b) {
  const onlyA = [...a].filter((x) => !b.has(x)).sort();
  const onlyB = [...b].filter((x) => !a.has(x)).sort();
  return { onlyA, onlyB };
}

let failed = false;

const routeDiff = symmetricDifference(fsRoutes, documentedRoutes);
if (routeDiff.onlyA.length || routeDiff.onlyB.length) {
  failed = true;
  console.log("Route drift between app/**/page.tsx and docs/architecture/routes.md:");
  if (routeDiff.onlyA.length) {
    console.log("  In the filesystem, missing from the doc:");
    for (const r of routeDiff.onlyA) console.log(`    ${r}`);
  }
  if (routeDiff.onlyB.length) {
    console.log("  In the doc, missing from the filesystem:");
    for (const r of routeDiff.onlyB) console.log(`    ${r}`);
  }
}

const seamDiff = symmetricDifference(codeSeamIds, documentedSeamIds);
if (seamDiff.onlyA.length || seamDiff.onlyB.length) {
  failed = true;
  console.log(
    "SEAM drift between TODO(SEAM-xx) comments and docs/architecture/seams.md:",
  );
  if (seamDiff.onlyA.length) {
    console.log("  In the code, missing from the doc:");
    for (const s of seamDiff.onlyA) console.log(`    ${s}`);
  }
  if (seamDiff.onlyB.length) {
    console.log("  In the doc, missing from the code:");
    for (const s of seamDiff.onlyB) console.log(`    ${s}`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(
    `docs/ARCHITECTURE.md in sync: ${fsRoutes.size} routes, ${codeSeamIds.size} seams.`,
  );
}
