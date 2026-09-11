/**
 * `docs/ARCHITECTURE.md` has to name every server subsystem and every API route, because the
 * part of a document that goes stale invisibly is the module or the route that exists and is
 * written down nowhere. Only the first cell of a table row counts: a route quoted in a
 * paragraph elsewhere must not satisfy the routes table. Prose accuracy is not mechanisable
 * and is not attempted. The last cell keeps the retired ruling vocabulary out of the four
 * files an agent reads first.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ARCHITECTURE = readFileSync(join(ROOT, "docs/ARCHITECTURE.md"), "utf8");

/** Every backticked token in the first cell of a table row. */
const TABLED = new Set(
  ARCHITECTURE.split("\n")
    .filter((line) => line.startsWith("| "))
    .map((line) => line.slice(2).split(" | ")[0] ?? "")
    .flatMap((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]!)),
);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** `app/api/x/[owner]/route.ts` becomes `/api/x/[owner]`, the spelling the routes table uses. */
const apiRoutes = walk(join(ROOT, "app/api"))
  .filter((file) => file.endsWith("/route.ts"))
  .map((file) => "/" + relative(join(ROOT, "app"), file).replace(/\/route\.ts$/, ""));

const serverModules = readdirSync(join(ROOT, "lib/server"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `lib/server/${entry.name}`);

/* Built by concatenation so this file does not itself carry the tokens it forbids. */
const FORBIDDEN = [/\bD-\d+\b/, new RegExp("SEAM" + "-"), /§11\.0/, new RegExp("backend" + "\\.md")];
const READ_FIRST = ["CLAUDE.md", "AGENTS.md", "README.md", "docs/ARCHITECTURE.md"];

describe("docs/ARCHITECTURE.md names what exists", () => {
  it("every lib/server directory heads a table row", () => {
    expect(serverModules.length).toBeGreaterThan(0);
    expect(serverModules.filter((name) => !TABLED.has(name))).toEqual([]);
  });

  it("every app/api route path heads a table row", () => {
    expect(apiRoutes.length).toBeGreaterThan(0);
    expect(apiRoutes.filter((path) => !TABLED.has(path))).toEqual([]);
  });

  it.each(READ_FIRST)("%s carries no retired ruling vocabulary", (file) => {
    const text = readFileSync(join(ROOT, file), "utf8");
    expect(FORBIDDEN.filter((pattern) => pattern.test(text)).map(String)).toEqual([]);
  });
});
