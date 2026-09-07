/* ============================================================
   Every published error class renders as {} and keeps its stack.

   A rejection may carry neither the failed statement nor its bound
   parameters, and the way one leaks is through an enumerable
   property on the error object: `Object.keys`, `JSON.stringify` and
   a spread all read them. The clause was once satisfied by three
   modules and violated by a fourth, and no single module's own
   suite could see it, so the domain here is built by construction
   rather than by name: every directory under `lib/server` in the
   committed tree, every barrel, every export whose `prototype
   instanceof Error`. A module added later is covered on the day it
   lands.

   Fails CLOSED in three places, because each is a way the check
   could pass while measuring nothing: a barrel that will not import
   is an error rather than a skipped module, a class that cannot be
   constructed is an error rather than an untested class, and a run
   that discovers no classes at all is an error rather than a
   vacuous green.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER_DIR = fileURLToPath(new URL("../lib/server", import.meta.url));

/** `prototype instanceof Error`: the language's own answer, so no name pattern decides membership. */
function isErrorClass(value: unknown): value is new (...args: never[]) => Error {
  return (
    typeof value === "function" &&
    (value as { prototype?: unknown }).prototype instanceof Error
  );
}

interface Published {
  barrel: string;
  name: string;
  ctor: new (...args: never[]) => Error;
  /** In the committed tree, so it counts. False means present in the working tree only: hygiene only. */
  committed: boolean;
}

async function publishedErrorClasses(): Promise<{ classes: readonly Published[]; domainSha: string }> {
  /*
   * The COUNT is a claim about the committed tree, resolved once to a sha so one run is
   * internally consistent and two runs that disagree can be told apart by the sha. The
   * HYGIENE runs over committed and uncommitted directories both, so a module being written
   * is checked before it is committed and cannot move the number until it is.
   *
   * The import comes from the working tree, because a class must be CONSTRUCTED to be
   * measured and `git show` yields text. That is sound as long as every committed barrel
   * exists locally, which is why the missing case is an error rather than a skip.
   */
  const domainSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();

  const committed = execFileSync("git", ["ls-tree", "-d", "--name-only", domainSha, "lib/server/"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .flatMap((line) => {
      const m = /^lib\/server\/([^/]+)\/?$/.exec(line.trim());
      return m ? [m[1]!] : [];
    })
    .sort();

  const present = new Set(
    readdirSync(SERVER_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const absent = committed.filter((name) => !present.has(name));
  if (absent.length > 0) {
    throw new Error(
      `These modules are committed at ${domainSha} and absent from the working tree: ` +
        `${absent.join(", ")}. This guard measures the committed tree, so a deleted module ` +
        `has to be committed before it can run.`,
    );
  }
  const uncommitted = [...present].filter((name) => !committed.includes(name)).sort();
  const barrels = [...committed, ...uncommitted];

  const found: Published[] = [];
  for (const barrel of barrels) {
    let namespace: Record<string, unknown>;
    try {
      namespace = (await import(`../lib/server/${barrel}/index.ts`)) as Record<string, unknown>;
    } catch (cause) {
      /* Not `continue`. A module whose barrel does not import is a module this check silently
         stopped covering, which is the shape of every defect in this file's history. */
      throw new Error(
        `lib/server/${barrel} has no importable barrel, so its error classes are unmeasured. ` +
          `Give it an index.ts, or this guard's domain is smaller than it claims.`,
        { cause },
      );
    }
    for (const [name, value] of Object.entries(namespace)) {
      if (isErrorClass(value))
        found.push({ barrel, name, ctor: value, committed: committed.includes(barrel) });
    }
  }
  return { classes: found, domainSha };
}

/**
 * Two call shapes, because the own-property set can differ between them: an `Error` `cause` is
 * only installed when the option is passed, and a constructor that assigns a field conditionally
 * would satisfy the clause under one shape and violate it under the other.
 */
const SHAPES: readonly (readonly unknown[])[] = [
  ["probe detail"],
  ["probe detail", { code: "23505", constraint: "probe_constraint" }],
];

describe("every published error class satisfies the hygiene clause", () => {
  it("each renders as {} and keeps its stack, at every arity", async () => {
    const { classes, domainSha } = await publishedErrorClasses();

    /* An EQUALITY rather than a floor: a floor absorbs additions silently and then stops
       detecting removals. Only committed barrels count, so an unmerged class in a worktree is
       checked for hygiene below and cannot demand a number only the commit may set. */
    const committedClasses = classes.filter((c) => c.committed);

    expect(
      committedClasses.length,
      "The number of published error classes changed. This is an EQUALITY rather than a floor, " +
        "deliberately: a floor absorbs additions silently and then stops detecting removals. " +
        "If a class was added, raise this number in the same commit and say which. If one was " +
        "removed, lower it and say why; a class that stopped being exported is exactly what " +
        "this walk exists to notice. Only barrels in the committed tree count: a directory in " +
        "the working tree that is not committed yet is checked for HYGIENE below and does not " +
        `move this number. Domain resolved from HEAD at ${domainSha}.`,
    ).toBe(46);

    const rendered: string[] = [];
    const traceless: string[] = [];
    const chained: string[] = [];
    for (const { barrel, name, ctor } of classes) {
      for (const args of SHAPES) {
        let instance: Error;
        try {
          instance = new ctor(...(args as never[]));
        } catch (cause) {
          /* Also not a skip: an unconstructible class is one this guard did not measure. */
          throw new Error(
            `${barrel}/${name} could not be constructed with ${args.length} argument(s), so its ` +
              `hygiene is unmeasured. Give the probe a shape it accepts.`,
            { cause },
          );
        }

        const keys = Object.keys(instance);
        const json = JSON.stringify(instance);
        if (keys.length > 0 || json !== "{}") {
          rendered.push(
            `${barrel}/${name} with ${args.length} arg(s): Object.keys=${JSON.stringify(keys)}, ` +
              `JSON.stringify=${json}`,
          );
        }

        /* `Object.keys` and `JSON.stringify` read OWN properties. `for...in` walks the prototype
           chain, so a plain `X.prototype.foo = ...` is visible to it and to anything that copies
           an object by iterating it, while invisible to the two readings above. `name` is
           excluded: many classes set it by plain assignment, and a class name is public API. */
        const inherited: string[] = [];
        for (const key in instance) if (key !== "name") inherited.push(key);
        if (inherited.length > 0) {
          chained.push(
            `${barrel}/${name} with ${args.length} arg(s): for-in=${JSON.stringify(inherited)} ` +
              `(inherited and enumerable, invisible to Object.keys and JSON.stringify)`,
          );
        }

        /* The one part of the clause that is not about enumerability. The other three are
           satisfiable by deleting `stack`, at the cost of every real failure's trace, and that
           shape renders as {} and passes them all. */
        if (typeof instance.stack !== "string" || instance.stack === "") {
          traceless.push(
            `${barrel}/${name} with ${args.length} arg(s): stack is ` +
              `${instance.stack === undefined ? "absent" : JSON.stringify(instance.stack)}, ` +
              `not a non-empty string`,
          );
        }
      }
    }

    /* Named in every message below, because a reader has to know which classes were covered,
       and an uncommitted barrel appearing here is a class nobody else's gate can see yet. */
    const covered =
      `Domain from HEAD at ${domainSha}. ` +
      `Checked ${classes.length} class(es) across ${new Set(classes.map((c) => c.barrel)).size} ` +
      `barrel(s); uncommitted barrels covered for hygiene only: ` +
      `${classes.filter((c) => !c.committed).map((c) => `${c.barrel}/${c.name}`).join(", ") || "(none)"}. `;

    expect(
      rendered,
      covered +
        "A published error class has an enumerable own property, so anything that renders it " +
        "(a log line, a JSON body, a spread into a response) carries that property with it. " +
        "Assign on the prototype (`X.prototype.name = ...`) or with `Object.defineProperty(this, " +
        "..., { enumerable: false })`; a plain `this.x =` in a constructor is always enumerable. " +
        "The field stays readable and `instanceof` is unaffected: only its appearance in a " +
        "rendering changes, which is the entire point of the clause.",
    ).toEqual([]);

    /* Reported separately from `rendered`, because the remedies are opposites: an OWN property
       is fixed by moving it to the prototype, an INHERITED one by making the prototype write
       non-enumerable, and one message cannot carry both without pointing half its readers the
       wrong way. */
    expect(
      chained,
      "A published error class has an enumerable property on its PROTOTYPE CHAIN, so " +
        "`Object.keys` and `JSON.stringify` cannot see it and the assertion above passes, " +
        "while `for...in` and anything that copies an object by iterating it can. Do NOT " +
        "'assign on the prototype' to fix this: a plain `X.prototype.foo = ...` IS enumerable " +
        "and is how this red is usually produced. Use `Object.defineProperty(X.prototype, " +
        "'foo', { value })`, which defaults to `enumerable: false`. `name` is excluded from " +
        "this walk deliberately: a class name is public API, which is what `err.name` is for.",
    ).toEqual([]);

    /* Separate again, because a missing `stack` is not an enumerability problem and the
       remedy above does nothing for it. */
    expect(
      traceless,
      "A published error class has no usable `stack`, so every real failure it names loses its " +
        "trace. This is NOT an enumerability problem and `enumerable: false` does not address it: " +
        "something is deleting or overwriting `stack`. The other three parts of the clause " +
        "cannot see this, since a class with no `stack` still renders as {}.",
    ).toEqual([]);
  });
});
