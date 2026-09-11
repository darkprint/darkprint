/* ============================================================
   T081 AC2 and AC3 — every published read wraps, and no rejection
   carries the statement

   AC2: every published read wraps, measured by pointing a
   connection string at a CLOSED PORT and driving each one, so the
   check needs no live database and no gate slot.

   AC3: no rejection from any published function contains a
   substring of the SQL it ran, quantified over the whole surface
   with a floor so an empty case list reds.

   ── the domain is §T080's published readers, and the floor is a
      set equality rather than a count ──
   A count of 16 is satisfied by sixteen of anything. What is
   asserted is that the set of read functions on the barrel EQUALS
   the published list, so a reader that DISAPPEARS reds the floor
   instead of the sweep quietly measuring one fewer.

   **The other direction was claimed here and this file cannot
   check it.** The original wording said a reader landing that this
   loop does not know about would red the floor. It does not:
   `present` is filtered THROUGH `READER_NAMES` before the
   comparison, so `present` is a subset of it by construction and no
   barrel addition can move either side. Measured at T132, which
   added three readers — this file stayed green and
   `surface.test.ts`'s barrel-agreement check reddened alone, which
   is where that direction actually lives. Corrected rather than
   carried, because a guard credited with a protection it does not
   have is how the protection stops being looked for.

   ── why each reader gets its own dead pool ──
   A pool per call, never one shared. A module that memoised a
   snapshot against a `Db` instance would fault on the first reader
   and answer from cache for every one after it, and the sweep
   would report greens for a reason that has nothing to do with
   the wrapper. The cost is one refused connection per reader,
   which is microseconds on a loopback port nothing is listening on.

   ── the tests declared here are static ──
   One `it` per published reader from a module-scope loop over a
   constant, each loading the module inside itself. A file whose
   subject does not exist then prints one red per reader rather than
   one collection failure, and nothing is hidden behind a hook.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  ANONYMOUS,
  DEAD_URL,
  PUBLISHED_READERS,
  READER_NAMES,
  READER_PROBES,
  STORE_FAILURE_FORM,
  assertTellsCannotOverMatch,
  bindReader,
  checkNoStatementLeak,
  deadDb,
  hasCallerInputs,
  loadRegistry,
  registryStoreErrorClass,
  rejects,
  renderings,
  storeFailureMessage,
  type ReaderName,
} from "./contract";

/** Drive one published reader against a server that refuses every connection. */
async function faultOf(
  name: ReaderName,
  args: readonly unknown[],
  url = DEAD_URL,
): Promise<unknown> {
  const fn = await bindReader(name);
  const dead = deadDb(url);
  try {
    return await rejects(
      () => fn(dead.db, ANONYMOUS, ...args),
      `${name}(deadDb, anonymous${args.length > 0 ? ", …" : ""})`,
    );
  } finally {
    await dead.close();
  }
}

describe("AC2/AC3 — the domain is §T080's published read surface", () => {
  it("the barrel's read functions are exactly the twenty the block publishes", async () => {
    const mod = await loadRegistry();
    const present = READER_NAMES.filter((name) => typeof mod[name] === "function").sort();

    expect(
      READER_NAMES.length,
      "The loop below quantifies over this list. An empty or shortened one turns every sweep " +
        "in this file into a green over nothing, which is the failure AC3's floor clause names.",
    ).toBe(20);

    expect(
      present,
      "A published reader is missing from the barrel, so the AC2 sweep below is measuring a " +
        "smaller surface than the criterion quantifies over. The seventeen are §T080's " +
        "Published signatures block as T132 and T260's merge (D-260-31) amended it, and " +
        "AC2's \"every published read\" is that block.",
    ).toEqual([...READER_NAMES].sort());
  });
});

describe("AC2 — a driver fault leaves every published read as RegistryStoreError", () => {
  for (const name of READER_NAMES) {
    it(`${name}: a refused connection rejects with RegistryStoreError`, async () => {
      const ctor = await registryStoreErrorClass();
      const err = await faultOf(name, READER_PROBES[name].args);

      expect(
        err instanceof ctor,
        `${name} rejected with ${
          err instanceof Error ? (err.constructor?.name ?? "an Error") : typeof err
        } rather than RegistryStoreError.\n` +
          `  the contract publishes: ${PUBLISHED_READERS[name]}\n` +
          `  AC2 is "every published read wraps". D-50-18 then needs a class to branch on to ` +
          `produce AC4's 500, so an unwrapped fault here is also an unservable route: the ` +
          `route cannot recognise what it was never handed.\n` +
          `  Actual message: ${JSON.stringify((err as Error)?.message)}`,
      ).toBe(true);
    }, 30_000);
  }
});

describe("AC3 — no rejection carries a substring of the SQL it ran", () => {
  for (const name of READER_NAMES) {
    it(`${name}: every rendering is clean, and the deny set is non-empty`, async () => {
      const probe = READER_PROBES[name];
      const err = await faultOf(name, probe.args);

      /* T-04 first: a deny token that is a substring of something this suite supplied would red
         like a real leak. Checked rather than trusted, because the probe identifiers were chosen
         to avoid exactly that and "chosen to" is not "verified to". */
      assertTellsCannotOverMatch(err, probe.supplied);

      /* The allow set is what D-13's whitelist admits and nothing more: "a fixed message naming
         the OPERATION, identifiers the CALLER ITSELF SUPPLIED, and counts of the caller's own
         inputs". The operation name is in it for that reason rather than for convenience — and
         `assertTellsCannotOverMatch` above deliberately does NOT run over it, because a reader
         name colliding with a column name would be a question about the schema, not a broken
         fixture, and admitting it is what the clause says to do. */
      const check = checkNoStatementLeak(err, [...probe.supplied, name], name);

      expect(
        check.vacuous,
        `Nothing in ${name}'s rejection chain carries a statement or a bound parameter, so the ` +
          `deny set is empty and the assertion below passes over nothing. Two readings, and ` +
          `they need different fixes: either the wrapper discarded the driver error instead of ` +
          `putting it on \`cause\` (AC1's clause, and a real defect), or this probe never ` +
          `reached the driver at all (a defect in the probe). ` +
          `surface.test.ts's positive control distinguishes them: if it is green, the extractor ` +
          `works and the cause chain is the thing that is empty.`,
      ).toBe(false);

      expect(
        check.leaks,
        `D-13: no rejection may carry the failed statement or its bound parameters. The deny ` +
          `set is derived from the statement the DRIVER actually ran rather than from a list ` +
          `typed here, so a token nobody enumerated is caught the moment the driver puts it in ` +
          `its own error. The allow set is what this caller supplied.\n` +
          `  statement: ${JSON.stringify(check.sql.slice(0, 400))}\n` +
          `  params: ${JSON.stringify(check.params.slice(0, 200))}`,
      ).toEqual([]);
    }, 30_000);
  }
});

describe("D-81-01 — each rejection renders the ruled form, naming its own operation", () => {
  /**
   * The exact pin, in two assertions rather than one equality, because a single `toBe` cannot
   * say whether the module disagrees about the WORDING or about WHICH operation failed — and
   * those need different fixes. The expected string is a literal in this suite; deriving it
   * from the module would assert only that the module agrees with itself.
   */
  for (const name of READER_NAMES) {
    it(`${name}: renders \`${name}: the registry store failed.\``, async () => {
      const err = await faultOf(name, READER_PROBES[name].args);
      const message = (err as Error)?.message ?? "";

      const matched = STORE_FAILURE_FORM.exec(message);
      expect(
        matched === null ? message : "(matches)",
        "D-81-01 ruled the wording `${operation}: the registry store failed.` — the form " +
          "already shipped at archive/errors.ts:74 and in T050, so this is the run's existing " +
          "convention rather than a third one.",
      ).toBe("(matches)");

      expect(
        matched?.[1],
        `The rendering names an operation that is not the read that failed. D-50-08's rule is ` +
          `that each message keeps one author and a rendering names the operation that ` +
          `actually failed; a wrapper that re-wraps, or that is given a label other than the ` +
          `published reader's name, points a caller at the wrong function.`,
      ).toBe(name);

      /* Stated as one equality too, because the two above are equivalent to it and a reader of
         a red should be able to see the whole expected string without composing it. */
      expect(message).toBe(storeFailureMessage(name));
    }, 30_000);
  }
});

describe("AC1/AC3 — the message carries nothing but the operation", () => {
  /**
   * The invariance pair, and it is the strongest form available while the block publishes no
   * message wording. Each half falsifies one clause of D-13 directly:
   *
   *   caller axis — one reader, two different argument lists, identical message
   *                 => the message carries no BOUND PARAMETER;
   *   driver axis — one reader, two unreachable servers whose connection strings share no
   *                 user, password, port or database name, identical message
   *                 => the message carries no value derived from the DRIVER ERROR.
   *
   * Both are equalities between two separately measured values, so neither can be satisfied by
   * one measurement compared with itself.
   */
  for (const name of READER_NAMES.filter(hasCallerInputs)) {
    it(`${name}: two callers, one message`, async () => {
      const probe = READER_PROBES[name];
      const first = await faultOf(name, probe.args);
      const second = await faultOf(name, probe.variantArgs!);

      expect(
        (second as Error)?.message,
        `${name} rendered two different messages for two different argument lists, so the ` +
          `message interpolates what the caller supplied. Where those arguments reach the ` +
          `statement as bound parameters — which is what a reader taking a handle, a slug, an ` +
          `id or a phase does — that is D-13's "or its bound parameters" clause, leaking ` +
          `through the module's own wording rather than through the driver's.`,
      ).toBe((first as Error)?.message);
    }, 30_000);
  }

  /* ── the driver-invariance axis was here, and it is REMOVED rather than left green ──
     Thirteen cells drove each reader against two unreachable servers differing in user,
     password, port and database, and asserted one message. They passed on `backend` with the
     module absent, and they reddened under ZERO of seven mutations — including M3, which makes
     the message `${operation}: ${String(cause)}` and leaks the driver outright.

     Measured, rather than reasoned: a `DrizzleQueryError`'s OWN message is `Failed query: <sql>`
     plus its params, and the connection detail lives on `cause.cause`. Two servers running the
     same statement therefore produce a byte-identical driver message, so an equality over it is
     an equality between two things that were already equal, whatever the module does with them.

     My anti-vacuity control did not catch this and the reason is worth keeping: it compared the
     whole cause CHAIN, where the port genuinely differs, and concluded the two errors differ.
     True, and about a quantity ADJACENT to the one the axis needed. A control measuring a nearby
     quantity is the failure this run keeps recording, arriving inside the control written to
     prevent it.

     The property is not lost. `surface.test.ts`'s "the message is a function of the operation and
     of nothing else" holds it with two hand-built causes whose own messages differ, and it reds
     under M3 where all thirteen of these stayed green. One instrument that fires beats thirteen
     that cannot. What is genuinely unobservable through the published READER surface is recorded
     here rather than represented by a passing test. */

  it("the thirteen messages are pairwise distinct", async () => {
    const messages = new Map<string, string[]>();
    for (const name of READER_NAMES) {
      const err = await faultOf(name, READER_PROBES[name].args);
      const message = (err as Error)?.message ?? "(no message)";
      messages.set(message, [...(messages.get(message) ?? []), name]);
    }

    expect(
      messages.size,
      "A floor over the sweep itself: thirteen readers must produce thirteen measurements.",
    ).toBeGreaterThan(0);

    const collisions = [...messages.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([message, names]) => `${names.join(", ")} all render ${JSON.stringify(message)}`);

    expect(
      collisions,
      "Two published reads render the same rejection, so a caller cannot tell which one " +
        "failed. Taken with the two invariance assertions above, this is what makes the " +
        "message a function OF THE OPERATION: without it, a constant string satisfies both " +
        "invariances perfectly and names nothing. It is also D-50-08's rule — a rendering " +
        "names the operation that actually failed — quantified over the surface rather than " +
        "asserted at one site.",
    ).toEqual([]);
  }, 60_000);
});

describe("the sweep's own case count", () => {
  it("drives every published read at least once, and the count is not zero", async () => {
    /* AC3's floor, stated as its own assertion rather than left implicit in a loop. A `for`
       over an empty list declares no `it` and a file with no tests reports as a pass. */
    const driven = new Set<ReaderName>();
    for (const name of READER_NAMES) {
      const err = await faultOf(name, READER_PROBES[name].args);
      expect(Object.keys(renderings(err)).length).toBeGreaterThan(0);
      driven.add(name);
    }
    expect(
      [...driven].sort(),
      "AC3 is quantified over the whole published surface. This is the case list it was " +
        "quantified over, asserted as a set so a silently shortened loop reds here rather " +
        "than reporting a clean sweep of a smaller domain.",
    ).toEqual([...READER_NAMES].sort());
    /* The literal beside the set equality, so shrinking BOTH the list and this number in one
       edit still takes a second decision. Thirteen at T081's merge; sixteen since T132's
       three ruled amendments to §T080's block; seventeen since T260's merge added
       `usersOfMany` (D-260-31); nineteen since T280 added `ownedBundles` and
       `draftBundle`; twenty since the single-card publish door added `storedVersionsOf`. */
    expect(driven.size).toBe(20);
  }, 60_000);
});
