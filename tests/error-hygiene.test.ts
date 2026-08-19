/* ============================================================
   D-13's hygiene clause, quantified over every published error
   class rather than over the one a module's own author remembered.

   Why it is a guard and not a convention: T090's blind test author
   measured the clause against *four* merged error classes and found
   `ArchiveConflictError` violating it — `Object.keys` gave
   `["name","kind"]` and `JSON.stringify` gave a populated object,
   because both were assigned in the constructor. Neither value was
   caller or driver data, so nothing leaked; the clause was still
   false, in a task that had merged and been tagged, and the
   adversary that reviewed that task had accepted the shape.

   Two things about how it was found are the reason this file exists.

   The clause was satisfied by three modules and violated by one, so
   nothing in any single module's own suite could see it — each was
   locally correct. It took a reader measuring *across* modules, and
   that reader is not guaranteed to exist next time.

   And the four it measured were half the set. There are eight
   published error classes, not four; the other four were never in
   the sample, and their compliance was assumed rather than
   observed. A sample that happens to contain the defect is luck.

   So the domain here is built by **construction** — every directory
   under `lib/server`, every barrel that exists, every export whose
   `prototype instanceof Error`. Nothing is listed by name, so a
   module added later is covered on the day it is added rather than
   on the day someone remembers this file.

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

const SERVER_DIR = fileURLToPath(new URL("../lib/server", import.meta.url));

/** `prototype instanceof Error` — the language's own answer, so no name pattern decides membership. */
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
}

async function publishedErrorClasses(): Promise<readonly Published[]> {
  /*
   * The domain is what has SHIPPED, not what is in this checkout, and the count below is a property
   * of the shipped tree — so reading `readdirSync` here made the two describe different sets by
   * construction.
   *
   * Measured cost of that: with the floor replaced by an equality, T040's worktree discovered 20
   * (base's 18 plus `engine/LimitExceededError` and `engine/CircularReferenceError`) and reported
   * `expected 20 to be 18`. **There is no value of that constant correct in both trees while the
   * domain is the working tree**: raising it to 20 reds on base until T040 merges. The floor it
   * replaced was too weak; the equality was not too strong, it was counting a different set from the
   * one it was measuring.
   *
   * This is the third file with this shape and I fixed the other two. `architecture-current` had a
   * working-tree domain that made it red in every implementer worktree and unfixable by the session
   * hitting it — `tests/**` is in no task's `Owns`. `store-modules-seal-their-faults` had a `backend`
   * domain read through the working filesystem. Here I made it STRICTER without checking the axis
   * both of those had already been charged on. Found by T040's implementer, one file over from where
   * it was fixed.
   *
   * The import still comes from the working tree, because a class must be CONSTRUCTED to be measured
   * and `git show` yields text. That is sound as long as every shipped barrel exists locally, which
   * is why the missing case below is an error rather than a skip: a worktree behind base gets a
   * message naming the merge, not an ENOENT.
   */
  const shipped = execFileSync("git", ["ls-tree", "-d", "--name-only", "backend", "lib/server/"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
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
  const absent = shipped.filter((name) => !present.has(name));
  if (absent.length > 0) {
    throw new Error(
      `These modules are on \`backend\` and absent from this checkout: ${absent.join(", ")}. ` +
        `This guard measures what has shipped, so it cannot run against a tree that is behind base. ` +
        `Merge \`backend\` and re-run.`,
    );
  }
  const barrels = shipped;

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
      if (isErrorClass(value)) found.push({ barrel, name, ctor: value });
    }
  }
  return found;
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

describe("every published error class satisfies D-13's four-part hygiene clause", () => {
  it("each renders as {} and keeps its stack, at every arity", async () => {
    const classes = await publishedErrorClasses();

    /* A zero here has three causes and only one of them is good news. This rules out the two bad
       ones: if the walk found nothing, the assertions below would all pass over an empty set. */
    /*
     * EXACT, not a floor, and the change is the point.
     *
     * This was `toBeGreaterThanOrEqual(8)` with a comment saying "if one was added, raise it" —
     * and nothing reds when the raise is skipped, which is the whole defect of a hand-maintained
     * number. Measured at `d7ee3ca`: the walk discovers **17**. Raised to **18** at T081's merge (`752721d`), which added `registry/RegistryStoreError` — and the raise happened because the equality RED, which is the whole reason it is an equality. So the floor sat at 8 across
     * T070's three naming classes, T030's six ontology classes and T050's four accounts classes,
     * detecting none of them, and it would no longer have detected any of those nine going
     * missing either. It was written to catch a class the walk stops reaching; after three merges
     * it could only have caught nine disappearing at once.
     *
     * An equality reds in BOTH directions, so a merge that adds a class cannot land without
     * somebody looking at this line, and a class that quietly stops being exported reds
     * immediately rather than being absorbed. The maintenance cost is identical — one number —
     * and the difference is that skipping it is now impossible instead of invisible.
     */
    expect(
      classes.length,
      "The number of published error classes changed. This is an EQUALITY rather than a floor, " +
        "deliberately: a floor absorbs additions silently and then stops detecting removals, " +
        "which is what happened here across three merges. If a class was added, raise this number " +
        "in the same commit and say which. If one was removed, lower it and say why — a class " +
        "that stopped being exported is exactly what this walk exists to notice.",
    ).toBe(18);

    const rendered: string[] = [];
    const traceless: string[] = [];
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

        /* The clause's fourth part, and the only one that is not a statement about enumerability.
           The first three are satisfiable by deleting `stack` — which is precisely how the
           *previous* wording of this clause ("own properties exactly [message, cause]") could be
           satisfied at all, at the cost of every real failure's trace. So the one shape the
           amendment exists to prevent is the one shape the other three assertions cannot see: a
           class that drops `stack` renders as `{}` and passes them all.

           Found by T070's blind author, which falsified this guard four ways against its own module
           rather than trusting its green, and reported the one mutation that survived. */
        if (typeof instance.stack !== "string" || instance.stack === "") {
          traceless.push(
            `${barrel}/${name} with ${args.length} arg(s): stack is ` +
              `${instance.stack === undefined ? "absent" : JSON.stringify(instance.stack)}, ` +
              `not a non-empty string`,
          );
        }
      }
    }

    expect(
      rendered,
      "A published error class has an enumerable own property, so anything that renders it — a " +
        "log line, a JSON body, a spread into a response — carries that property with it. Assign " +
        "on the prototype (`X.prototype.name = ...`) or with `Object.defineProperty(this, ..., " +
        "{ enumerable: false })`; a plain `this.x =` in a constructor is always enumerable. The " +
        "field stays readable and `instanceof` is unaffected: only its appearance in a rendering " +
        "changes, which is the entire point of the clause.",
    ).toEqual([]);

    /* Reported separately, and not because two lists are tidier. While these shared one assertion,
       a missing `stack` printed under a name saying "enumerable own property" and advice saying to
       use `enumerable: false` — a defect the author does not have and a remedy that does nothing
       for the one they do. The reader of a failure message is by construction someone who has just
       made a mistake, and pointing them at a different one costs more than saying nothing.

       Found by T090's implementer, falsifying the new assertion against its own class: the
       assertion was widened and the surface that reports it was not. */
    expect(
      traceless,
      "A published error class has no usable `stack`, so every real failure it names loses its " +
        "trace. This is NOT an enumerability problem and `enumerable: false` does not address it: " +
        "something is deleting or overwriting `stack`. Note why the clause names it at all — the " +
        "previous wording of D-13 (own properties exactly [message, cause]) could be satisfied " +
        "ONLY by deleting `stack`, so this is the precise shape the amendment exists to prevent, " +
        "and the other three parts of the clause cannot see it: a class with no `stack` still " +
        "renders as {}.",
    ).toEqual([]);
  });
});
