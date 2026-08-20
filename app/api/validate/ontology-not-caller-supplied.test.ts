/* ============================================================
   D-40-21's premise, held by two instruments that fail differently

   `submissionOf` excludes `input.ontology` from the measured set.
   That is correct only while `ontology` is not caller-supplied —
   and **an exclusion from a measured set is a bypass of the bound
   the moment the excluded field becomes caller-reachable**. A route
   that ever accepted a caller's vocabulary would let it put
   unbounded bytes in the one place `maxBytes` does not look, and
   nothing would red in between, because the excluded field is by
   construction the field no size assertion measures.

   The premise was established by reading the four route files that
   existed at one commit. Two guards replace that reading, and
   neither is complete:

   - **behavioural** — for the input a route actually builds, the
     measured number must equal the literal
     `Buffer.byteLength(JSON.stringify(input))`. That is the claim
     D-40-17 makes, stated over the thing that is measured rather
     than over a field name. It covers the routes that exist and
     says nothing about a fifth.
   - **structural** — no route may call `ontologyView` with a
     second argument, over a domain constructed by walking
     `app/api/**` rather than from a list. It covers route five on
     the day it is written and, being a name grep, finds only the
     spellings it searches for: `ontologyView(base, extensions)` is
     caught, a view arriving from a helper is not.

   Incomplete in different directions, which is the only reason
   both are worth having. Written in T040's round by its adversary,
   at the orchestrator's instruction; the structural half's proper
   home is a repo-wide guard on base, since one living here can be
   deleted with this task's tree.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/* --------------------- behavioural --------------------- */

/**
 * The four route bodies, and the engine call each one is expected to make.
 *
 * `vi.mock` wraps the barrel rather than replacing it: every function still runs, and the
 * argument each route passed is recorded on its way through. Asserting on a hand-built
 * object instead would test this file's idea of what a route sends.
 */
const seen: { fn: string; input: unknown }[] = [];

vi.mock("@/lib/server/engine", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/engine")>();
  const record =
    <A extends unknown[], R>(fn: string, real: (...a: A) => R) =>
    (...args: A): R => {
      seen.push({ fn, input: args[0] });
      return real(...args);
    };
  return {
    ...actual,
    validateBundle: record("validateBundle", actual.validateBundle),
    validateDot: record("validateDot", actual.validateDot),
    validateCardSource: record("validateCardSource", actual.validateCardSource),
    validateVocabularySource: record("validateVocabularySource", actual.validateVocabularySource),
  };
});

const post = (path: string, body: unknown): Request =>
  new Request(`https://darkprint.io${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("D-40-21 behavioural: the bound a route gets is the bound the ruling names", () => {
  it("refuses at one byte below the literal size of the input the route built", async () => {
    const { POST: bundle } = await import("./bundle/route");
    const { validateBundle, LimitExceededError } = await import("@/lib/server/engine");

    seen.length = 0;
    await bundle(
      post("/api/validate/bundle", {
        dot: "digraph g { a -> b }",
        cardFiles: { "cards/a.yaml": "id: a\n" },
        manifest: { slug: "s", title: "T", summary: "x", tags: [], ontologyVersion: "0.1.0" },
        vocabulary: "terms: []\n",
      }),
    );

    const calls = seen.filter((s) => s.fn === "validateBundle");
    expect(calls.length, "the bundle route reached the engine").toBe(1);

    for (const call of calls) {
      const input = call.input as Parameters<typeof validateBundle>[0];
      /* D-40-17 is normative as a NUMBER, and the number is about the WHOLE input. So the
         claim is driven rather than inspected: with the bound set one byte below the
         literal size of what the route handed over, the submission must be refused.

         Asserting instead that `measureSubmission(input)` equals the formula would be a
         guard that cannot fail — `measureSubmission` measures what it is given, and
         `submissionOf`'s exclusion happens inside `validateBundle`. Falsification caught
         that first version: a route made to pass an `ontology` left it green.

         This reds the day a route builds an input carrying a field the measure drops,
         because the bound then admits a submission the ruled number refuses — which is the
         hole, not the field name. */
      const literal = Buffer.byteLength(JSON.stringify(input), "utf8");
      expect(
        () => validateBundle(input, { maxBytes: literal - 1 }),
        "one byte under the ruled number refuses",
      ).toThrow(LimitExceededError);
      expect(
        () => validateBundle(input, { maxBytes: literal }),
        "exactly the ruled number is accepted",
      ).not.toThrow();
    }
  });
});

/* --------------------- structural --------------------- */

function routeFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) found.push(path);
    }
  };
  walk(root);
  return found;
}

/** Comments are stripped first, so a `ontologyView(base, extensions)` in prose is not a hit. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `ontologyView(` call in `source`, as the text between its own parentheses. */
function ontologyViewArguments(source: string): string[] {
  const calls: string[] = [];
  const pattern = /\bontologyView\s*\(/g;
  while (pattern.exec(source) !== null) {
    let depth = 1;
    let i = pattern.lastIndex;
    for (; i < source.length && depth > 0; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")") depth -= 1;
    }
    calls.push(source.slice(pattern.lastIndex, i - 1));
  }
  return calls;
}

/** A comma at nesting depth zero: a second argument rather than one inside a call. */
function hasSecondArgument(argumentText: string): boolean {
  let depth = 0;
  for (const ch of argumentText) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

describe("D-40-21 structural: no route builds an OntologyView from caller bytes", () => {
  const files = routeFiles("app/api");

  it("has a domain that could have found something", () => {
    /* A set that can only be empty is not a measurement. */
    expect(files.length, "route files walked under app/api").toBeGreaterThan(4);
    for (const required of ["bundle", "dot", "card", "ontology"]) {
      expect(
        files.some((f) => f === join("app/api/validate", required, "route.ts")),
        `app/api/validate/${required}/route.ts is in the domain`,
      ).toBe(true);
    }
  });

  it("finds no ontologyView(base, extensions) in any route file", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const args of ontologyViewArguments(withoutComments(readFileSync(file, "utf8")))) {
        if (hasSecondArgument(args)) offenders.push(`${file}: ontologyView(${args.trim()})`);
      }
    }
    /* `ontologyView(CORE_ONTOLOGY)` is O(49) once and harmless. The hazard is exactly the
       caller-supplied overlay, so the boundary is named rather than a symptom of crossing
       it: a route that cannot build a view from caller bytes cannot produce one to pass. */
    expect(offenders).toEqual([]);
  });

  it("would notice one: the detector fires on a planted call", () => {
    const planted = `
      import { ontologyView, CORE_ONTOLOGY } from "@/lib/core";
      /* ontologyView(CORE_ONTOLOGY, inAComment) must not count */
      const bare = ontologyView(CORE_ONTOLOGY);
      const overlay = ontologyView(CORE_ONTOLOGY, parseOntologyTerms(body.vocabulary, "f"));
    `;
    const calls = ontologyViewArguments(withoutComments(planted));
    expect(calls.length, "the comment is stripped, the two real calls are found").toBe(2);
    expect(calls.map(hasSecondArgument)).toEqual([false, true]);
  });
});
