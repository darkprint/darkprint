/* ============================================================
   The provenance relation, driven rather than parsed.

   **The rule.** `isDecision` lets some rejections past `withStore`
   unwrapped. Any such class that this module did NOT author has
   its message written by another module and needs a status from
   whoever serves it — so `withAccountErrors` owes it an arm. A
   class on one list and absent from the other is a contradiction
   two files should never have to agree on by hand.

   **Why the domain is a barrel walk and not an import line.** The
   first form of this guard parsed `store.ts`'s imports against
   `http.ts`'s `instanceof` identifiers. That is a guard over the
   SPELLING of a relation: it goes green on a wrapper whose arm is
   present and wrong. Provenance is read off **the module a class
   lives in**, by the same walk `tests/error-hygiene.test.ts`
   already does, so a `lib/server/policy` fault class enters the
   domain the day it exists and nobody edits this file.

   **Why the predicate is not `store-failed` 500.** That is true of
   `NamingStoreError` and **false** of the two foreign classes
   D-50-08 maps deliberately — `HandleTakenError` is 409 and
   `InvalidNameError` is 400 — so quantifying 500 over foreign
   classes reds two correct arms. What IS universal is that the
   answer is `application/problem+json` and that **`detail` is the
   instance's own `message`, byte for byte**: D-50-08's *passes
   through unaltered, so each message keeps one author*, which is
   the not-re-wrapped clause generalised from one class to all
   three. It fails a re-render, a generic substitution, and a
   foreign fault wrapped into a local class — the exact failure the
   `NamingStoreError` arm would have if someone "fixed" it by
   re-wrapping. Status stays per-class, in the arm tests.

   **What this does NOT check, stated because it reads as if it
   might.** `detail === err.message` is checkable only because
   every published message form is safe by construction. **A class
   whose own message leaked a bound parameter satisfies it
   perfectly.** It is not a hygiene assertion and does not replace
   one — `tests/error-hygiene.test.ts` and the closed-port body
   assertions cover that, separately.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withAccountErrors } from "./http";
import { withStore } from "./store";

const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));
/** This module authors its own; provenance is exactly "not from here". */
const OWN = "accounts";

function isErrorClass(value: unknown): value is new (...args: never[]) => Error {
  return typeof value === "function" && (value as { prototype?: unknown }).prototype instanceof Error;
}

interface Foreign {
  barrel: string;
  name: string;
  ctor: new (...args: never[]) => Error;
}

async function foreignErrorClasses(): Promise<readonly Foreign[]> {
  const barrels = readdirSync(SERVER_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== OWN)
    .map((entry) => entry.name)
    .sort();

  const found: Foreign[] = [];
  for (const barrel of barrels) {
    let namespace: Record<string, unknown>;
    try {
      namespace = (await import(`../${barrel}/index.ts`)) as Record<string, unknown>;
    } catch (cause) {
      /* Not a `continue`. A barrel that will not import is a module this guard silently
         stopped covering, which is the shape every defect in this file's history has. */
      throw new Error(
        `lib/server/${barrel} has no importable barrel, so its error classes are unmeasured. ` +
          `This guard's domain is then smaller than it claims.`,
        { cause },
      );
    }
    for (const [name, value] of Object.entries(namespace)) {
      if (isErrorClass(value)) found.push({ barrel, name, ctor: value });
    }
  }
  return found;
}

/** True when `isDecision` let it past — observed through `withStore`, never read off source. */
async function passesThroughUnwrapped(instance: Error): Promise<boolean> {
  return await withStore("probe", async (): Promise<never> => {
    throw instance;
  }).then(
    () => false,
    (err: unknown) => err === instance,
  );
}

describe("every foreign class this module recognises is answered in the envelope", () => {
  it("answers problem+json with the class's own message, for each one", async () => {
    const classes = await foreignErrorClasses();
    const request = new Request("https://darkprint.io/api/account/handle", { method: "PATCH" });

    expect(
      classes.length,
      "No foreign error classes were discovered, so the assertions below would pass over an " +
        "empty set. Either a barrel stopped exporting its rejections or this walk no longer " +
        "reaches them.",
    ).toBeGreaterThan(0);

    const recognised: string[] = [];
    const unenveloped: string[] = [];
    const rewritten: string[] = [];

    for (const { barrel, name, ctor } of classes) {
      const message = `probe: ${barrel}/${name} detail`;
      let instance: Error;
      try {
        instance = new ctor(message as never);
      } catch (cause) {
        /* Also not a skip: an unconstructible class is one this guard did not measure. */
        throw new Error(`${barrel}/${name} could not be constructed, so it is unmeasured.`, { cause });
      }

      if (!(await passesThroughUnwrapped(instance))) continue;
      recognised.push(`${barrel}/${name}`);

      let response: Response;
      try {
        response = await withAccountErrors(request, async (): Promise<never> => {
          throw instance;
        });
      } catch {
        /* The defect D-50-21 was: recognised by `isDecision`, unmapped by the wrapper, so
           it leaves through the arm reserved for what is NOT recognised. */
        unenveloped.push(`${barrel}/${name} left the wrapper instead of being answered`);
        continue;
      }

      if (response.headers.get("content-type") !== "application/problem+json") {
        unenveloped.push(`${barrel}/${name} answered ${response.headers.get("content-type")}`);
        continue;
      }
      const body = (await response.json()) as { detail?: unknown };
      if (body.detail !== message) {
        rewritten.push(`${barrel}/${name} detail was ${JSON.stringify(body.detail)}, not its own message`);
      }
    }

    expect(
      recognised.length,
      "No foreign class was recognised by `isDecision`, so the relation under test is vacuous — " +
        "every assertion below would pass over an empty set. `isDecision` names three classes " +
        "from `@/lib/server/naming`; if that is no longer true this guard measures nothing.",
    ).toBeGreaterThan(0);

    expect(
      unenveloped,
      "A class `isDecision` recognises, authored by another module, is not answered in the " +
        "envelope by `withAccountErrors`. It therefore leaves through the arm that exists for " +
        "what this wrapper does NOT recognise — a bug — which is D-50-21's defect exactly. Add " +
        "an arm for it: the wrapper owes an envelope for faults this module did not author.",
    ).toEqual([]);

    expect(
      rewritten,
      "An arm answered with a `detail` that is not the rejection's own message. D-50-08: a " +
        "foreign rejection passes through UNALTERED so each message keeps one author. A " +
        "re-render, a generic substitution, or wrapping a foreign fault into a local class all " +
        "fail here — the last being exactly what the `NamingStoreError` arm would do if someone " +
        "'fixed' it by re-wrapping.",
    ).toEqual([]);
  });
});

describe("the mapped classes are pairwise disjoint, so arm order is inert", () => {
  it("has no class that is a subtype of another", async () => {
    const { armsNotDisjoint } = await import("./http");
    expect(
      armsNotDisjoint(),
      "One mapped class is a subtype of another, so arm ORDER now decides which arm answers — " +
        "and the comment on the last arm says order is inert. Either restore disjointness or " +
        "make the ordering load-bearing on purpose and say so there.",
    ).toEqual([]);
  });
});
