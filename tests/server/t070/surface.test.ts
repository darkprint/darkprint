/* ============================================================
   T070 — the published surface

   No acceptance criterion names these seven exports, which is
   exactly why this file exists. Across three tasks the blind suites
   earned their keep on what no criterion states, and T000 paid two
   rounds for the interface half of a contract going unchecked.

   Nothing here touches a database. Every test is either "the name is
   exported" or "the pure function is genuinely pure", so a red in
   this file is the module absent or the module publishing a
   different interface from the one the contract states.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  PUBLISHED,
  PUBLISHED_NAMES,
  type PublishedName,
  asDiagnostics,
  bind,
  loadNaming,
} from "./contract";

describe("the barrel publishes what the contract says it publishes", () => {
  it("loads at `@/lib/server/naming`", async () => {
    await expect(loadNaming()).resolves.toBeTypeOf("object");
  });

  /* One test per name. A single test binding all seven would report the first missing export
     and hide the other six, which is the shape the per-criterion rule exists to prevent. */
  for (const name of PUBLISHED_NAMES) {
    it(`exports \`${name}\` as a function — ${PUBLISHED[name]}`, async () => {
      await expect(bind(name as PublishedName)).resolves.toBeTypeOf("function");
    });
  }

  /* `Availability` is an interface and erases at compile time, so there is nothing to bind. It
     is checked structurally at every call site instead, by `asAvailability`. */
});

describe("the three pure functions are pure", () => {
  /* "isReservedSlug(slug: string): boolean          // pure, no Db"
     "validateCardId(id: string): Diagnostic[]       // pure, grammar only"
     "validateNamespace(namespace: string): Diagnostic[]   // pure"

     Purity is asserted the only way it is observable from outside: each is called with its one
     published argument and must answer synchronously. A function that took a `Db` first would
     read a string as a database handle and fail here rather than in whichever criterion
     happened to call it first. */

  it("isReservedSlug answers a boolean synchronously, with no Db", async () => {
    const isReserved = await bind("isReservedSlug");
    const answer = isReserved("frontline-triage");
    expect(answer, "the contract publishes `boolean`, not a truthy value").toBeTypeOf("boolean");
  });

  it("validateCardId answers Diagnostic[] synchronously, with no Db", async () => {
    const validate = await bind("validateCardId");
    const answer = validate("solver-a");
    expect(answer, "a Promise here means the signature is not the published one").not.toBeInstanceOf(
      Promise,
    );
    asDiagnostics(answer, "validateCardId");
  });

  it("validateNamespace answers Diagnostic[] synchronously, with no Db", async () => {
    const validate = await bind("validateNamespace");
    const answer = validate("mara-veil");
    expect(answer, "a Promise here means the signature is not the published one").not.toBeInstanceOf(
      Promise,
    );
    asDiagnostics(answer, "validateNamespace");
  });
});
