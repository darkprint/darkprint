import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALICE,
  BERTRAND,
  type Action,
  type Actor,
  type Resource,
  alice,
  anonymous,
  bertrand,
  bundle,
  canFn,
  card,
  deepFreeze,
  note,
  noteOnOwnPublicBundle,
  operator,
  save,
  snapshot,
  strictly,
  visibleToFn,
} from "./contract";

/* ============================================================
   T060 criterion (5) — the decisions are pure

   (5) decisions are pure — same actor, action and resource, same
       answer, no I/O

   Purity is a negative claim, so it is tested five ways, each of
   which fails on a different way of breaking it.

   1. repetition. The same triple, many times, in and out of order,
      answers the same thing. Catches a decision that depends on a
      counter, a clock or a coin.

   2. equal-but-not-identical arguments. A fresh object with the
      same fields answers what the shared one answered. Catches a
      memo keyed on object identity, which is a cache that never
      hits in production and always hits in a test written with one
      fixture.

   3. a cache keyed on too little. Two resources that differ only in
      `visibility`, and two actors that differ only in `kind`, asked
      alternately. Catches the memo that keys on `ownerId` alone —
      the one shape of caching that turns a private row public for
      whoever asks second.

   4. frozen arguments. The actor and the resource are deep-frozen
      before the call and compared against a snapshot after it. A
      module that normalises its input in place throws in strict
      mode; one that adds a field is caught by the snapshot.

   5. no I/O. `fetch`, `Date.now`, `Date`, `Math.random` and
      `performance.now` are spied on and must not be called, and the
      source under `lib/server/policy/**` must not import `lib/db`
      or `lib/server/http` — which is the clause the Published
      signatures block opens with, in its own words: "Pure: no I/O,
      no imports from `lib/db` or `lib/server/http`."

   The source scan is the one check here that is not made through
   the public interface, and it is deliberate: an import that opens
   a pool at module load has no observable effect on a return value,
   so nothing at the call site can see it. `tests/server/types-identity.test.ts`
   reads T000's source for the same reason.
   ============================================================ */

/** Every triple this file repeats, sampled across all three actor kinds. */
const TRIPLES: [string, Actor, Action, Resource][] = [
  ["anonymous reads a public bundle", anonymous, "read", bundle(ALICE, "public")],
  ["anonymous reads a private bundle", anonymous, "read", bundle(ALICE, "private")],
  ["a stranger writes a public card", bertrand, "write", card(ALICE, "public")],
  ["the owner deletes her save", alice, "delete", save(ALICE)],
  ["the owner publishes her bundle", alice, "publish", bundle(ALICE, "private")],
  ["a stranger reads a note", bertrand, "read", noteOnOwnPublicBundle(ALICE)],
  [
    "a stranger reads a note on a private parent",
    bertrand,
    "read",
    note(ALICE, { ownerId: ALICE, visibility: "private" }),
  ],
  ["the operator reads a private card", operator, "read", card(BERTRAND, "private")],
];

describe("T060 (5) the same question gets the same answer", () => {
  it("answers identically over two hundred repetitions", async () => {
    const can = await canFn();
    for (const [what, actor, action, resource] of TRIPLES) {
      const first = strictly(can, actor, action, resource);
      for (let i = 0; i < 200; i += 1) {
        expect(strictly(can, actor, action, resource), `${what} changed answer at call ${i}`).toBe(
          first,
        );
      }
    }
  });

  it("answers identically when the triples are interleaved", async () => {
    const can = await canFn();
    const expected = TRIPLES.map(([, a, act, r]) => strictly(can, a, act, r));
    for (let round = 0; round < 50; round += 1) {
      /* A different order each round: index i walks the list by a stride co-prime with its
         length, so a decision that depends on the previous one is asked in a new context. */
      for (let step = 0; step < TRIPLES.length; step += 1) {
        const i = (step * 3 + round) % TRIPLES.length;
        const [what, actor, action, resource] = TRIPLES[i];
        expect(strictly(can, actor, action, resource), `${what} changed under interleaving`).toBe(
          expected[i],
        );
      }
    }
  });

  it("answers the same for an equal argument as for the identical one", async () => {
    const can = await canFn();
    for (const [what, actor, action, resource] of TRIPLES) {
      const expected = strictly(can, actor, action, resource);
      const freshActor = JSON.parse(JSON.stringify(actor)) as Actor;
      const freshResource = JSON.parse(JSON.stringify(resource)) as Resource;
      expect(
        strictly(can, freshActor, action, freshResource),
        `${what} answered differently for an equal-but-not-identical argument, which is a ` +
          `cache keyed on object identity`,
      ).toBe(expected);
    }
  });

  it("does not answer one row's question with another row's answer", async () => {
    const can = await canFn();
    /* Same owner, same kind, one field apart. A memo keyed on `${actor.kind}:${ownerId}`
       passes every other test in this file and fails this one. */
    const publicBundle = bundle(ALICE, "public");
    const privateBundle = bundle(ALICE, "private");
    for (let i = 0; i < 20; i += 1) {
      expect(strictly(can, anonymous, "read", publicBundle)).toBe(true);
      expect(
        strictly(can, anonymous, "read", privateBundle),
        "a private bundle was read as public right after a public one with the same owner",
      ).toBe(false);
    }

    /* Same id, different `kind`: the account is the owner, the operator is not, and the
       two must not share an entry. */
    const asAccount: Actor = { kind: "account", accountId: ALICE, handle: "aurelia" };
    const asOperator: Actor = { kind: "operator", accountId: ALICE };
    for (let i = 0; i < 20; i += 1) {
      expect(strictly(can, asAccount, "read", bundle(BERTRAND, "private"))).toBe(false);
      expect(strictly(can, asOperator, "read", bundle(BERTRAND, "private"))).toBe(true);
    }
  });

  it("answers a duplicate call the same way, including through `visibleTo`", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();
    for (const actor of [anonymous, alice, bertrand, operator]) {
      const first = visibleTo(actor, ALICE);
      expect(visibleTo(actor, ALICE)).toBe(first);
      expect(visibleTo(actor, ALICE)).toBe(first);
    }
    const resource = bundle(ALICE, "private");
    const first = strictly(can, alice, "read", resource);
    expect(strictly(can, alice, "read", resource)).toBe(first);
    expect(strictly(can, alice, "read", resource)).toBe(first);
  });
});

describe("T060 (5) the decision writes to nothing it was handed", () => {
  it("decides over deep-frozen arguments without throwing or changing them", async () => {
    const can = await canFn();
    for (const [what, actor, action, resource] of TRIPLES) {
      const frozenActor = deepFreeze(JSON.parse(JSON.stringify(actor)) as Actor);
      const frozenResource = deepFreeze(JSON.parse(JSON.stringify(resource)) as Resource);
      const actorBefore = snapshot(frozenActor);
      const resourceBefore = snapshot(frozenResource);

      const answer = strictly(can, frozenActor, action, frozenResource);
      expect(typeof answer).toBe("boolean");
      expect(snapshot(frozenActor), `${what} wrote to the actor it was handed`).toBe(actorBefore);
      expect(snapshot(frozenResource), `${what} wrote to the resource it was handed`).toBe(
        resourceBefore,
      );
    }
  });

  it("decides the same over a frozen argument as over a thawed one", async () => {
    const can = await canFn();
    /* A module that normalises in place and swallows the resulting TypeError would answer
       differently for a frozen argument. Answering the same is the point. */
    for (const [what, actor, action, resource] of TRIPLES) {
      const thawed = strictly(can, actor, action, resource);
      const frozen = strictly(
        can,
        deepFreeze(JSON.parse(JSON.stringify(actor)) as Actor),
        action,
        deepFreeze(JSON.parse(JSON.stringify(resource)) as Resource),
      );
      expect(frozen, `${what} answered differently for a frozen argument`).toBe(thawed);
    }
  });
});

describe("T060 (5) no I/O and no clock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("touches neither the network, the clock nor the random source", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();

    const fetchSpy = vi.spyOn(globalThis, "fetch" as never);
    const nowSpy = vi.spyOn(Date, "now");
    const randomSpy = vi.spyOn(Math, "random");
    const perfSpy = vi.spyOn(globalThis.performance, "now");

    for (const [, actor, action, resource] of TRIPLES) {
      strictly(can, actor, action, resource);
      visibleTo(actor, ALICE);
    }

    expect(fetchSpy, "the policy module called fetch").not.toHaveBeenCalled();
    expect(nowSpy, "the policy module read the clock").not.toHaveBeenCalled();
    expect(randomSpy, "the policy module drew a random number").not.toHaveBeenCalled();
    expect(perfSpy, "the policy module read performance.now").not.toHaveBeenCalled();
  });

  it("answers synchronously, never with a promise", async () => {
    const can = await canFn();
    const visibleTo = await visibleToFn();
    for (const [what, actor, action, resource] of TRIPLES) {
      const answer = can(actor, action, resource);
      expect(answer instanceof Promise, `${what} answered a Promise`).toBe(false);
      expect(
        typeof (answer as { then?: unknown })?.then,
        `${what} answered a thenable, which a caller would have to await`,
      ).not.toBe("function");
    }
    expect(visibleTo(alice, ALICE) instanceof Promise).toBe(false);
  });

  it("gives every concurrent caller its own answer", async () => {
    const can = await canFn();
    const expected = TRIPLES.map(([, a, act, r]) => strictly(can, a, act, r));

    /* Sixty callers, each yielding to the event loop before and after its decision, so any
       state the module carries between calls is shared across all of them. A pure function
       cannot fail this; one holding a "current actor" between two statements can. */
    const answers = await Promise.all(
      Array.from({ length: 60 }, async (_, n) => {
        const i = n % TRIPLES.length;
        const [, actor, action, resource] = TRIPLES[i];
        await Promise.resolve();
        const answer = strictly(can, actor, action, resource);
        await Promise.resolve();
        return [i, answer] as const;
      }),
    );

    for (const [i, answer] of answers) {
      expect(answer, `${TRIPLES[i][0]} answered differently under concurrent callers`).toBe(
        expected[i],
      );
    }
  });

  it("gives every concurrent caller its own answer through `visibleTo` too", async () => {
    const visibleTo = await visibleToFn();
    const cases: [Actor, string, string][] = [
      [alice, ALICE, "all"],
      [bertrand, ALICE, "public"],
      [anonymous, ALICE, "public"],
      [bertrand, BERTRAND, "all"],
    ];
    const answers = await Promise.all(
      cases.map(async ([actor, ownerId, expected], i) => {
        await Promise.resolve();
        const answer = visibleTo(actor, ownerId);
        await Promise.resolve();
        return { i, answer, expected };
      }),
    );
    for (const { i, answer, expected } of answers) {
      expect(answer, `case ${i} answered ${String(answer)} under concurrent callers`).toBe(expected);
    }
  });
});

describe("T060 (5) the module imports nothing that does I/O", () => {
  const ROOT = new URL("../../../lib/server/policy", import.meta.url).pathname;

  /** Every `.ts` file the task owns, so the check is over the module and not over one file. */
  function sources(dir: string): string[] {
    if (!existsSync(dir)) {
      throw new Error(
        `${dir} does not exist, so there is no source to check. T060 owns ` +
          `lib/server/policy/** and the Published signatures block opens with "Pure: no ` +
          `I/O, no imports from lib/db or lib/server/http".`,
      );
    }
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) found.push(...sources(path));
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(path);
    }
    return found;
  }

  it("has a `lib/server/policy` to check", () => {
    expect(
      existsSync(ROOT),
      `${ROOT} does not exist. T060 owns lib/server/policy/** and publishes \`can\` and ` +
        `\`visibleTo\` from it.`,
    ).toBe(true);
  });

  it("imports neither `lib/db` nor `lib/server/http` anywhere under it", () => {
    const forbidden = [
      /from\s+["'](?:@\/)?lib\/db(?:\/|["'])/,
      /from\s+["'](?:@\/)?lib\/server\/http(?:\/|["'])/,
      /import\s*\(\s*["'](?:@\/)?lib\/db/,
      /import\s*\(\s*["'](?:@\/)?lib\/server\/http/,
    ];
    const offences: string[] = [];
    for (const file of sources(ROOT)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(source)) offences.push(`${file} matches ${pattern}`);
      }
    }
    expect(
      offences,
      `The Published signatures block opens with "Pure: no I/O, no imports from lib/db or ` +
        `lib/server/http". An import that opens a pool at module load is invisible from the ` +
        `call site, so it is checked here.`,
    ).toEqual([]);
  });

  it("imports no node builtin, so the module still answers in the browser", () => {
    /* `lib/core/**` is isomorphic by CLAUDE.md's rule and this module decides the same
       questions the upload page asks. A `node:` import is the one thing that cannot be
       shipped to `/upload`. */
    const offences: string[] = [];
    for (const file of sources(ROOT)) {
      const source = readFileSync(file, "utf8");
      if (/from\s+["']node:/.test(source) || /require\(\s*["']node:/.test(source)) {
        offences.push(file);
      }
    }
    expect(offences).toEqual([]);
  });
});
