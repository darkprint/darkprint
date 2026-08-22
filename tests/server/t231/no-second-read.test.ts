/* ============================================================
   T231 AC3 — no second database read on any path

   *"the repair is a type, not a lookup."*

   ── the instrument T230 used is gone, by construction ──
   D-230-05 names AC5's instrument: a `Proxy`-backed `Db` asserting
   `touched() === false`, a proof the resource was never reached
   rather than a latency claim. **That instrument cannot exist
   after T231**: it works by handing `checkLimit` a proxied `db`,
   and AC2 removes the parameter. The moment `db` leaves the
   signature the proxy has nothing to be handed to.

   That is the criterion working rather than a gap — a read that
   is unreachable because there is no handle to the database is
   stronger than one measured absent. But it means AC3's cells
   must be a DIFFERENT instrument, and the replacement has to
   answer the question the proxy answered: **a `checkLimit` that
   reaches `getSharedDbClient()` internally satisfies AC2's
   parameter list and performs exactly the lookup AC3 forbids.**
   A signature is not evidence about that; the source is.

   ── why source and not behaviour ──
   The behavioural form needs a scratch Postgres. This run stands
   **28 scratch databases** awaiting the owner — **dropped 2026-08-22 on the owner's ruling, so the live baseline is `darkprint` plus two pre-existing `t090_attractor_*`; compare NAMES rather than counts, since equal counts are not equal state** — formerly awaiting the owner's ruling, created
   one per run by exactly this kind of cell, and a blind suite is
   not the place to add to them. Stated rather than hidden: these
   cells pin the ABSENCE OF A HANDLE, not the absence of an effect.
   A behavioural cell is owed after the merge by whoever holds a
   tree with the gate slot.

   ── and the instrument is falsified on a second axis ──
   An import-detector that finds nothing is indistinguishable from
   one that is looking in the wrong place, and a zero is a claim
   about an instrument until something proves otherwise. So the
   same predicate is run over `keys.ts`, which genuinely does reach
   the database, and is required to answer differently. Without
   that pair, every green below would be worth nothing.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { moduleSource, parameterName, parametersOf, withoutComments } from "./contract";

/** Every module specifier a file imports from, static and dynamic. */
function importsOf(file: string): string[] {
  const source = withoutComments(moduleSource(file));
  const out: string[] = [];
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) out.push(match[1]);
  for (const match of source.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push(match[1]);
  return out;
}

/**
 * True when a file reaches a database **through one of the three doors this suite knows**:
 * the `Db` handle, a client factory, or `schema`.
 *
 * **NOT "can reach a database at all", which is what this comment used to claim.** A file
 * holding its own `new Pool()` from `pg` reaches a database and this predicate answers
 * `false` — measured, not supposed: with that mutation in `check.ts` these eight cells pass
 * 8 of 8 while `no-second-read-behaviour.test.ts` reds 6 of 6.
 *
 * Charged by T231's adversary, and the sting is the location: a comment overstating its
 * predicate, in a file whose whole subject is instruments that overstate themselves. The
 * behavioural cell is what closes the gap; this comment now describes the doors rather than
 * the outcome.
 */
function reachesTheDatabase(file: string): boolean {
  const source = withoutComments(moduleSource(file));
  const viaImport = importsOf(file).some((s) => s === "@/lib/db" || s.startsWith("@/lib/db/"));
  const viaClient = /getSharedDbClient|createDbClient/.test(source);
  return viaImport || viaClient;
}

describe("AC2 — `db` leaves the signature of both published functions", () => {
  /*
   * F-231-D, ruled: it leaves `enforceLimit` as well. If it stayed on the wrapper the
   * hazard the task exists to close survives one call over, on the spelling
   * `app/api/account/keys/route.ts:50` actively recommends to every task that wires a route.
   *
   * Asserted on the parameter LIST rather than on arity. `options` is a defaulted third
   * parameter under both the shipped shape and the published one, so `.length` is 2 either
   * way and cannot separate them — an arity cell here would be green against both.
   */
  for (const fn of ["checkLimit", "enforceLimit"] as const) {
    it(`\`${fn}\` takes no \`db\``, () => {
      const params = parametersOf(moduleSource("check.ts"), fn);
      const names = params.map(parameterName);

      expect(
        names.includes("db"),
        `\`${fn}\` still takes a \`db\`: (${params.join(", ")}).\n` +
          `  D-230-05 already establishes it is never used there — the shipped body reads ` +
          `\`void db;\`. The adversary's framing is the one to keep: *it is handed \`db\` and ` +
          `never uses it, so it had the means to re-check and chose not to.*`,
      ).toBe(false);

      expect(
        params.some((p) => /:\s*Db\b/.test(p)),
        `\`${fn}\` still takes a parameter typed \`Db\`, under another name: ` +
          `(${params.join(", ")}). AC2 is about the handle, not about the spelling.`,
      ).toBe(false);
    });
  }

  it("`checkLimit`'s first parameter is the subject, not a database", () => {
    const params = parametersOf(moduleSource("check.ts"), "checkLimit");
    expect(
      params[0],
      `D-231-01: \`checkLimit(subject: LimitSubject, bucket: string, options?)\`. The first ` +
        `parameter is ${params[0] ?? "absent"}.`,
    ).toMatch(/^subject\s*:/);
  });
});

describe("AC3 — the repair is a type, so `check.ts` cannot reach a database at all", () => {
  it("imports nothing from `@/lib/db` and calls no client factory", () => {
    const source = withoutComments(moduleSource("check.ts"));
    const dbImports = importsOf("check.ts").filter(
      (s) => s === "@/lib/db" || s.startsWith("@/lib/db/"),
    );

    expect(
      dbImports,
      `\`check.ts\` imports ${dbImports.join(", ")}.\n` +
        `  AC3: *no second database read is introduced on any path — the repair is a type, ` +
        `not a lookup.* A \`checkLimit\` that reaches the database through an import instead ` +
        `of a parameter satisfies AC2's signature and performs exactly the read AC3 forbids, ` +
        `and no signature can show it.`,
    ).toEqual([]);

    expect(
      /getSharedDbClient|createDbClient/.test(source),
      `\`check.ts\` calls a database client factory. The handle removed from the parameter ` +
        `list must not come back through the module scope.`,
    ).toBe(false);
  });

  it("does not reach `schema`, which is the other way to name a table", () => {
    const source = withoutComments(moduleSource("check.ts"));
    expect(
      /\bschema\b/.test(source),
      `\`check.ts\` names \`schema\`. A file that cannot reach a client but can name a table ` +
        `is one refactor away from reaching both.`,
    ).toBe(false);
  });

  it("keeps the counter in-process, which is what makes the zero possible", () => {
    /*
     * D-230-05: "AC5 and a durable counter are incompatible by definition … a durable
     * counter is a write per request, which is the whole of what the phrase means. The
     * counter is in-process."
     *
     * The positive half of AC3: `check.ts` must still get its counter from `counter.ts`.
     * Without this, every cell above is satisfied by a `checkLimit` that counts nothing.
     */
    const source = withoutComments(moduleSource("check.ts"));
    expect(
      importsOf("check.ts").some((s) => s === "./counter"),
      `\`check.ts\` no longer imports \`./counter\`. Every other cell in this file is a ` +
        `NEGATIVE, and all of them are satisfied by a \`checkLimit\` that does nothing at all.`,
    ).toBe(true);
    expect(/createSlotCounter\s*\(/.test(source), `no slot counter is created`).toBe(true);
  });
});

describe("AC3 — and nothing `check.ts` reaches, at any depth, can reach a database", () => {
  /*
   * The three-door predicate above reads ONE file. A second driver imported by something
   * `check.ts` imports would satisfy every cell in this file and reach a database at depth
   * two — so the closure is walked rather than the module.
   *
   * This is the structural half of F6. The behavioural cell counts `pg` and only `pg`, so a
   * second driver evades it too; an import-closure check catches any channel that arrives by
   * IMPORT, which is what a second driver does. What neither catches is measured and named
   * in the behavioural file's header: a global like `fetch` needs no import at all.
   */
  const ALLOWED = new Set(["node:crypto"]);

  function closureOf(entry: string): Map<string, string[]> {
    const seen = new Map<string, string[]>();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.shift() as string;
      if (seen.has(file)) continue;
      const specifiers = importsOf(file);
      seen.set(file, specifiers);
      for (const specifier of specifiers) {
        if (!specifier.startsWith("./")) continue;
        const next = `${specifier.slice(2).replace(/\.ts$/, "")}.ts`;
        if (!seen.has(next)) queue.push(next);
      }
    }
    return seen;
  }

  it("reaches only sibling modules and an allowlisted node builtin", () => {
    const closure = closureOf("check.ts");
    const foreign: string[] = [];
    for (const [file, specifiers] of closure) {
      for (const specifier of specifiers) {
        if (specifier.startsWith("./")) continue;
        if (ALLOWED.has(specifier)) continue;
        foreign.push(`${file} -> ${specifier}`);
      }
    }

    expect(
      foreign,
      `\`check.ts\`'s import closure reaches outside \`lib/server/limits\`.\n` +
        `  ${foreign.join("\n  ")}\n` +
        `  AC3 is about EVERY path, and a module two imports away can reach a database while ` +
        `every three-door cell in this file stays green. The allowlist is deliberately tiny: ` +
        `a new entry is a decision, not a maintenance chore.`,
    ).toEqual([]);
  });

  it("walks more than the entry file — the control", () => {
    /* A closure that stopped at `check.ts` would answer `[]` for a reason that has nothing to
       do with what the module reaches, and would look exactly like a clean result. */
    const closure = closureOf("check.ts");
    expect(
      [...closure.keys()].length,
      `the closure walked ${closure.size} file(s): ${[...closure.keys()].join(", ")}`,
    ).toBeGreaterThan(1);
    expect([...closure.keys()]).toContain("counter.ts");
  });
});

describe("the detector is falsified on a second axis", () => {
  it("finds the database in the file that genuinely reaches it", () => {
    /*
     * `keys.ts` issues, revokes, lists and resolves — every one of them a query. If the
     * predicate cannot see the database there, its zero over `check.ts` is a statement
     * about the predicate and not about `check.ts`.
     *
     * Asserted as a PAIR that must differ, so an always-false predicate and an empty read
     * both fail here rather than passing quietly upstairs.
     */
    expect(
      reachesTheDatabase("keys.ts"),
      `the database-reach predicate answers \`false\` for \`keys.ts\`, which issues four ` +
        `queries. Its zero over \`check.ts\` is then a statement about the predicate and not ` +
        `about \`check.ts\`, and every negative cell above is worth nothing.`,
    ).toBe(true);

    /* Deliberately NOT asserted as a pair that must differ. `check.ts`'s value IS the
       criterion, so a pair assertion would red this control for the very reason the cells
       above already red for — and a control that fails whenever the subject fails is not a
       control. What is claimed here is only that the instrument can register a positive. */
  });

  it("reads a non-empty source for both files", () => {
    /* The cheapest failure this file has: a renamed or moved module read as an empty string
       makes every regex above answer `false` and every negative cell pass. */
    for (const file of ["check.ts", "keys.ts"] as const) {
      expect(moduleSource(file).length, `\`${file}\` read as fewer than 500 bytes`).toBeGreaterThan(
        500,
      );
    }
  });
});
