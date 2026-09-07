/* ============================================================
   T230 — checkLimit, the bound

   ── the reading, taken and flagged ──
   `checkLimit` is assumed to CONSUME budget rather than merely
   report it. Nothing in §T230 says which, and `remaining` is inert
   under the other reading — a number that never moves. Every cell
   below that counts calls rests on this; a red in one of them may
   be this reading rather than the code.

   ── no number is invented here ──
   "The ceiling values are `TBD:` and the task must not invent
   them", so neither does this file. The bound is driven against
   the ceiling the implementation itself publishes on the first
   verdict: refused at `limit + 1`, allowed at `limit`. Same
   comparison whatever the numbers turn out to be, and it cannot go
   vacuous the way `limit === limit` can.

   ── a limit that costs more than the work it refuses ──
   `A limit can only bound work that happens after it runs` has
   been charged three times on T040, and the neighbouring shape
   here is a counter that reads every prior request to decide
   whether you are over — which performs the resource exhaustion
   the limit exists to prevent, with zero writes and a correct
   verdict. So the cells that drive the bound assert WHAT WORK WAS
   DONE, not only what came back: the whole-database effect, and
   the statement count as it moves with the number of prior calls.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  type Subject,
  accountActor,
  accountSubject,
  awaited,
  bucketNote,
  buckets,
  anonymousSubject,
  describe_,
  dropScratchDatabases,
  freeAccount,
  freeIp,
  keyedSubject,
  measureWork,
  publishedInterface,
  requiredFn,
  scratchDatabase,
  unconfiguredBucket,
} from "./contract";

let scratch: Scratch;

beforeAll(async () => {
  scratch = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

interface Verdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  windowMs: number;
}

/**
 * T230's flat `Subject` translated into T231's discriminated `LimitSubject`.
 *
 * This suite was written before D-231-01 and its whole vocabulary is `{ accountId, keyId, ip }`.
 * T231 replaced that with a three-armed union whose keyed arm carries a branded `ResolvedKey` that
 * only `resolveKey` can mint — so nine cells here were reading `db` as the subject and the subject
 * as the bucket after `db` left `checkLimit`'s signature, and every call came back `limit: 0`.
 *
 * **The keyed arm is cast, deliberately, and the cast is the translation rather than a hole.**
 * `checkLimit` reads only `key.keyId` (`check.ts:181`) and the brand is `declare const` — ambient
 * and erased — so a minted key and a labelled cast are runtime-identical here by construction.
 * What the cast gives up is the compile-time provenance guarantee, and **that guarantee is asserted
 * in T231's own partition** by cells this suite could not host: `aListedKeyCannotBeSpent`,
 * `forgedRecordIsRefused` and `bareStringKeyIsRefused`. Casting here does not weaken them.
 *
 * The alternative — resolving a real key in each keyed cell — would rewrite T230's criteria rather
 * than adapt them, and a merge is not the place to change what a merged suite measures.
 */
function toLimitSubject(subject: Subject): unknown {
  if (subject.keyId !== null && subject.accountId !== null) {
    return {
      tier: "key",
      key: { keyId: subject.keyId, accountId: subject.accountId, label: "t230", createdAt: new Date(), revokedAt: null },
      ip: subject.ip,
    };
  }
  if (subject.accountId !== null) return { tier: "account", accountId: subject.accountId, ip: subject.ip };
  return { tier: "anonymous", ip: subject.ip };
}

async function check(subject: Subject, bucket?: string): Promise<Verdict> {
  const checkLimit = await requiredFn("checkLimit");
  const probe = await buckets();
  const answered = await checkLimit(toLimitSubject(subject), bucket ?? probe.read);
  if (answered === null || typeof answered !== "object") {
    throw new Error(
      `checkLimit answered ${describe_(answered)}; the contract publishes a LimitVerdict.\n` +
        `  ${bucketNote(probe.source)}`,
    );
  }
  return answered as unknown as Verdict;
}

/** Quoted into every message that drives a bucket, so no red is read without it. */
async function note(): Promise<string> {
  return bucketNote((await buckets()).source);
}

/**
 * How far this suite will drive a ceiling in process. B-17 wants the anonymous ceiling
 * GENEROUS — "the product's discoverability by agents depends on that ceiling being
 * generous" — so a ceiling above this is a correct product decision and not a defect,
 * and the red below says so in those words rather than reporting a failure.
 */
const EXHAUST_CAP = 2000;

describe("T230 the verdict, admitted rather than filtered", () => {
  it("the verdict's members are exactly LimitVerdict's four", async () => {
    const verdict = await check(anonymousSubject());
    expect(
      Object.keys(verdict).sort(),
      `checkLimit answered a member \`interface LimitVerdict\` does not declare.\n` +
        `  published: ${publishedInterface("LimitVerdict").text}\n` +
        `  This is the identity-oracle guard at the verdict, and it is a whitelist for the ` +
        `same reason T081's problem document needed one: the block forbids naming "the ` +
        `caller's identity, key id or IP", and the shape that passes every field pin is a ` +
        `fifth member carrying exactly that — a \`subject\`, a \`keyId\`, a debug echo. The ` +
        `four members are all typed as scalars the caller already knows, so no admitted ` +
        `member CAN carry one.\n` +
        `  answered: ${JSON.stringify(verdict)}`,
    ).toEqual([...publishedInterface("LimitVerdict").fields].sort());
  });

  it("the four members carry the kinds the block declares", async () => {
    const verdict = await check(anonymousSubject());
    expect(typeof verdict.allowed, "`allowed: boolean`").toBe("boolean");
    expect(Number.isInteger(verdict.limit), `\`limit: number\` is ${describe_(verdict.limit)}`).toBe(true);
    expect(Number.isInteger(verdict.remaining), `\`remaining: number\` is ${describe_(verdict.remaining)}`).toBe(true);
    expect(
      verdict.resetAt,
      `\`resetAt: Date\` is ${describe_(verdict.resetAt)}. An ISO string is not a Date, and ` +
        `the difference is invisible until a caller does arithmetic on it.`,
    ).toBeInstanceOf(Date);
    expect(verdict.limit).toBeGreaterThan(0);
    expect(verdict.remaining).toBeLessThanOrEqual(verdict.limit);
    expect(
      verdict.resetAt.getTime(),
      `\`resetAt\` is not in the future, so the reset AC1 tells a caller to wait for has ` +
        `already passed and a client reading it retries immediately.`,
    ).toBeGreaterThan(Date.now());

    /* D-230-10. `windowMs` exists because `resetAt - now` is the time REMAINING and the
       form's `<window>` slot is about the window's LENGTH — an adjacent quantity inside an
       exact-matched sentence. The two are related by this inequality and by nothing else:
       the remainder can never exceed the length. */
    expect(
      Number.isInteger(verdict.windowMs),
      `\`windowMs: number\` is ${describe_(verdict.windowMs)}`,
    ).toBe(true);
    expect(verdict.windowMs).toBeGreaterThan(0);
    expect(
      verdict.resetAt.getTime() - Date.now(),
      `\`resetAt\` is further away than one whole window, so the reset and the window ` +
        `length describe two different clocks and \`rateLimited\` renders a sentence whose ` +
        `two halves disagree.`,
    ).toBeLessThanOrEqual(verdict.windowMs);
  });
});

describe("T230 the bound, driven against the ceiling the module publishes", () => {
  it("consumes exactly one unit per call and holds `limit` and `resetAt` still", async () => {
    const subject = anonymousSubject();
    const first = await check(subject);
    /* Bounded by the module's own ceiling as well as by 4, so a small ceiling makes this
       cell measure fewer steps rather than red for a reason that is not about consumption. */
    const steps = Math.min(4, first.limit - 1);
    expect(steps, `a ceiling of ${first.limit} leaves no second call to measure`).toBeGreaterThan(0);
    let previous = first;
    for (let i = 0; i < steps; i += 1) {
      const next = await check(subject);
      expect(
        next.remaining,
        `\`remaining\` moved from ${previous.remaining} to ${next.remaining} across one call.\n` +
          `  READING, flagged: this suite reads \`checkLimit\` as CONSUMING budget rather than ` +
          `reporting it, because \`remaining\` is inert under the other reading. §T230 does ` +
          `not say which. If this red is the test, the block owes the sentence.`,
      ).toBe(previous.remaining - 1);
      expect(next.limit, "`limit` is the ceiling and does not move within a window").toBe(first.limit);
      expect(
        next.windowMs,
        "`windowMs` is the window's LENGTH and cannot move within one window",
      ).toBe(first.windowMs);
      expect(
        next.resetAt.getTime(),
        `\`resetAt\` moved between calls inside one window, so every request pushes the reset ` +
          `out and a caller at the ceiling is never told a time that arrives.`,
      ).toBe(first.resetAt.getTime());
      expect(next.allowed, `call ${i + 2} of a ceiling of ${first.limit} was refused`).toBe(true);
      previous = next;
    }
  });

  /**
   * AC1's bound, and the work done to reach it, in one cell because they are one
   * measurement: a refusal that costs more than an allowance is a limit that amplifies
   * the load it exists to shed, and it passes any test that reads only `allowed`.
   *
   * Nothing here names a number. `limit` comes off the first verdict.
   */
  it("allows exactly `limit` and refuses the next, without the refusal costing more", async () => {
    const subject = anonymousSubject();
    const opening = await check(subject);

    expect(
      opening.limit,
      `The ceiling for an anonymous ${JSON.stringify((await buckets()).read)} is ` +
        `${opening.limit}, which ` +
        `this suite will not exhaust in process.\n` +
        `  GAP, and it is not a defect: B-17 makes a generous anonymous ceiling the product ` +
        `requirement — "the product's discoverability by agents depends on that ceiling being ` +
        `generous" — so a ceiling above ${EXHAUST_CAP} is the contract working. What is ` +
        `missing is a published way to drive AC1 without exhausting it: a bucket with a small ` +
        `ceiling, an injectable clock, or a seam that presets a counter. §T230 publishes ` +
        `none, so AC1 — the headline criterion — has no blind test at a realistic ceiling.\n` +
        `  ${await note()}`,
    ).toBeLessThanOrEqual(EXHAUST_CAP);
    expect(
      opening.limit,
      `A ceiling of ${opening.limit} leaves no allowed call after the first, so the cost ` +
        `comparison below would have nothing warm to compare a refusal against.`,
    ).toBeGreaterThan(1);

    /* Call 2, measured while the subject is WARM. The comparison at the end has to be
       against an allowance on the same subject at the same point in its life: an
       allowance measured on a fresh subject can cost more simply because it is the
       first touch, and that would make the assertion pass for a reason that has
       nothing to do with the refusal. */
    const warm = await measureWork(scratch, () => check(subject));
    let last = warm.result;
    expect(last.allowed, `call 2 of ${opening.limit} was refused`).toBe(true);

    /* Calls 3..limit. */
    for (let i = 2; i < opening.limit; i += 1) last = await check(subject);

    expect(
      last.allowed,
      `Call ${opening.limit} of a ceiling of ${opening.limit} was refused, so the module ` +
        `refuses one request below its own published limit.`,
    ).toBe(true);
    expect(last.remaining, `the last allowed call leaves nothing`).toBe(0);

    const refusal = await measureWork(scratch, () => check(subject));
    const refused = refusal.result;
    expect(
      refused.allowed,
      `Call ${opening.limit + 1} of a ceiling of ${opening.limit} was allowed. The ceiling is ` +
        `the module's own, read off the first verdict, so this is not a number this suite ` +
        `invented — it is the module disagreeing with itself.`,
    ).toBe(false);
    expect(refused.remaining, `a refused call reports nothing remaining`).toBe(0);
    expect(refused.limit).toBe(opening.limit);

    expect(
      refusal.statements.length,
      `A refusal issued ${refusal.statements.length} statements where an allowance on the ` +
        `same subject issued ${warm.statements.length}. A limit that costs MORE to refuse ` +
        `than to allow amplifies exactly the load it exists to shed: the caller pays nothing ` +
        `to be refused and the database pays more than it would have for the request itself. ` +
        `This is the T230 shape of "a limit can only bound work that happens after it runs", ` +
        `and it passes any test that reads only \`allowed\`.\n` +
        `  refusal: ${refusal.statements.map((s) => s.slice(0, 120)).join(" | ")}`,
    ).toBeLessThanOrEqual(warm.statements.length);
  });

  it("a bucket is a partition — spending one does not spend another", async () => {
    /*
     * F-230-G: this ran on an ANONYMOUS subject and asserted `other.remaining === other.limit - 1`.
     *
     * The premise was true when written and stopped being true when the owner's ceilings landed:
     * under the ruled matrix `write` is REFUSED for anonymous, so `other.limit` is 0, `remaining`
     * is floored at 0 by published contract, and `-1` is unreachable BY CONSTRUCTION. The cell was
     * asserting a number the module is forbidden to produce.
     *
     * An ACCOUNT subject is what makes this discriminating rather than merely passing: anonymous
     * has exactly one bucket with a ceiling (`read` 600; `write` and `upload` both REFUSED), so no
     * anonymous pair can show leakage at all. At the account tier all three are configured — 600,
     * 120, 30 — and spending in one must leave the other untouched.
     */
    const probe = await buckets();
    const accountId = await freeAccount(scratch);
    const subject = accountSubject(accountId);
    const opening = await check(subject, probe.read);
    for (let i = 0; i < 3; i += 1) await check(subject, probe.read);
    const other = await check(subject, probe.write);

    expect(
      other.limit,
      `This cell needs a second bucket with a ceiling to be able to observe leakage at all. ` +
        `${JSON.stringify(probe.write)} is refused for this subject, so \`remaining\` is floored ` +
        `at 0 whether spending leaked or not and the assertion below cannot fail.` +
        `\n  ${bucketNote(probe.source)}`,
    ).toBeGreaterThan(0);

    expect(
      other.remaining,
      `Spending in ${JSON.stringify(probe.read)} reduced what is left in ` +
        `${JSON.stringify(probe.write)} for the same subject, so \`bucket\` is a label rather ` +
        `than a partition key and the parameter decides nothing. B-17 makes reads and writes ` +
        `separately limited.\n  ${bucketNote(probe.source)}`,
    ).toBe(other.limit - 1);
    expect(opening.remaining).toBe(opening.limit - 1);
  });

  it("a subject is a partition — one caller's spending is not another's", async () => {
    const mine = anonymousSubject();
    const theirs = anonymousSubject();
    for (let i = 0; i < 3; i += 1) await check(mine);
    const other = await check(theirs);

    expect(
      other.remaining,
      `One anonymous caller's requests reduced a different caller's remaining budget, so the ` +
        `ceiling is global rather than per-subject and any single client can refuse service ` +
        `to every other. The two subjects differ only in \`ip\`.`,
    ).toBe(other.limit - 1);
  });
});

describe("T230 D-230-04 — an unconfigured bucket refuses", () => {
  /**
   * A CRITERION rather than a note, and the ruling names the shape it belongs to:
   * "D-70-18's shape — a config lookup returning `undefined` read as *no limit* is a
   * criterion satisfiable by never limiting anything."
   *
   * This is the one bucket cell that needs no vocabulary. Every other cell in this file
   * depends on naming a bucket the module has configured; this one depends on naming
   * one it cannot possibly have, so it is the only bucket assertion here that is immune
   * to F-230-D.
   */
  it("a bucket no config can contain is refused, not waved through", async () => {
    const verdict = await check(anonymousSubject(), unconfiguredBucket());
    expect(
      verdict.allowed,
      `An unconfigured bucket was allowed. D-230-04: a lookup returning \`undefined\` read ` +
        `as "no limit" makes AC1 satisfiable by never limiting anything — the same shape as ` +
        `AC6 before D-70-18, where a module that never returned a suggestion satisfied the ` +
        `criterion completely and observed nothing.\n` +
        `  A caller reaching an unnamed bucket is either a typo or a route the config has ` +
        `not caught up with, and both are cases where the safe answer is no.`,
    ).toBe(false);
  });

  it("the refusal for an unconfigured bucket is still a well-formed verdict", async () => {
    /* Failing closed is not the same as failing shapeless: `rateLimited` renders whatever
       comes back, so a verdict with a NaN limit or a missing reset reaches a caller as a
       429 whose `detail` says "limit of NaN". */
    const verdict = await check(anonymousSubject(), unconfiguredBucket());
    expect(Number.isInteger(verdict.limit), `\`limit\` is ${describe_(verdict.limit)}`).toBe(true);
    expect(verdict.remaining).toBe(0);
    expect(verdict.resetAt, `\`resetAt\` is ${describe_(verdict.resetAt)}`).toBeInstanceOf(Date);
  });
});

describe("T230 AC5 — an under-ceiling read is never delayed or challenged", () => {
  /**
   * THE CONTROL, a separate test rather than a line inside the next one: a control
   * that asserts a property of the FIXTURE can be mutated and caught, while an inline
   * two-factor assertion can only be deleted and a suite cannot catch the deletion of
   * its own assertion.
   *
   * It establishes that the effect instrument can SEE a write. Without it, AC5's empty
   * `changed` is the same empty array a broken snapshot produces, and the two are
   * indistinguishable from inside a passing run.
   */
  it("CONTROL — the effect instrument sees a write that really happened", async () => {
    const issueKey = await requiredFn("issueKey");
    const accountId = await freeAccount(scratch);
    const work = await measureWork(scratch, () =>
      awaited(issueKey(scratch.db, accountActor(accountId), accountId, "control")),
    );
    expect(
      work.changed,
      `Issuing a key changed no table, so the whole-database snapshot is not reading what it ` +
        `thinks it is reading and AC5's zero beside it measures nothing.`,
    ).toContain("api_key");
    expect(work.statements.length, `and the statement recorder saw the module speak`).toBeGreaterThan(0);
  });

  /**
   * D-230-05, and the ruling names the instrument rather than leaving it to be chosen:
   * AC5 is "`checkLimit` never touching `db` on an under-ceiling anonymous read,
   * measured with a `Proxy`-backed `Db` asserting `touched() === false` — a proof the
   * resource was never reached rather than a latency claim."
   *
   * Strictly stronger than the effect snapshot below for this case, and a DIFFERENT
   * instrument rather than a second spelling of it: the snapshot answers *did a row
   * move*, this answers *was the database reached at all*. A counter that SELECTs a
   * shared row per request writes nothing, moves nothing, and is exactly what
   * "never delayed or challenged" is about under load.
   */
  /*
   * REPLACED AT T231'S MERGE BY A STRICTLY STRONGER CLAIM, and the instrument died by construction
   * rather than being weakened.
   *
   * This handed `checkLimit` a `Proxy`-backed `Db` and asserted `touched() === false` — *the
   * database was not reached*. D-231-01 removed `db` from the signature entirely, so **there is no
   * longer anything to hand the Proxy**: the cell cannot be run, not because the criterion changed
   * but because its subject stopped accepting the instrument.
   *
   * What replaces it is stronger, not looser: **`checkLimit` CANNOT reach a connection — it is not
   * a parameter** — which is a claim about the type rather than about one observed call. The
   * behavioural half is not lost either; it moved to a partition that can hold it properly.
   * `tests/server/t231/no-second-read.test.ts` asserts the absence of a HANDLE (no import of
   * `@/lib/db` anywhere in `check.ts`'s transitive closure), and its behavioural companion asserts
   * the absence of an EFFECT against a real driver observer — which catches a `check.ts` holding
   * its own `pg.Pool`, the evasion this Proxy provably could not see.
   *
   * Kept rather than deleted, per `CLAUDE.md`: a criterion whose instrument is superseded is
   * re-pointed, never dropped.
   */
  it("cannot reach the database at all — `db` is not a parameter of `checkLimit`", async () => {
    const checkLimit = await requiredFn("checkLimit");
    const verdict = await check(anonymousSubject());

    expect(verdict.allowed, `the probe call was refused, so this measures the wrong branch`).toBe(
      true,
    );
    expect(
      checkLimit.length > 0 && /^\s*\(?\s*db\b/.test(checkLimit.toString().slice(0, 40)),
      `\`checkLimit\` takes a \`db\` again, so it CAN reach a connection. ` +
        `Signature: ${checkLimit.toString().slice(0, 60)}\n` +
        `  D-231-01 removed it: the precondition is a type, and a function that cannot reach a ` +
        `connection is a stronger claim than one observed not to. The behavioural half lives in ` +
        `tests/server/t231/no-second-read*.test.ts, which measures the absence of an EFFECT ` +
        `against a real driver observer — including a module holding its own \`pg.Pool\`.\n` +
        `  D-230-05: "anonymous, zero access; keyed, one indexed read that AC4 already ` +
        `mandates; never a write." The counter is in-process, and AC5 and a durable counter ` +
        `are incompatible by definition — a durable counter is a write per request, which ` +
        `is the whole of what the phrase means.\n` +
        `  ${await note()}`,
    ).toBe(false);
  });

  /**
   * The keyed half of the same ruling, and it is a NUMBER rather than a zero: "keyed,
   * one indexed read that AC4 already mandates". So this is not "does it write" — it is
   * what work was done, pinned at the figure the ruling publishes.
   *
   * A keyed check that re-reads the config, or joins the account, or looks the key up
   * twice, writes nothing and passes every other cell in this file.
   */
  it("costs exactly one statement on a keyed read, and still writes nothing", async () => {
    const issueKey = await requiredFn("issueKey");
    const accountId = await freeAccount(scratch);
    const issued = (await issueKey(scratch.db, accountActor(accountId), accountId, "one-read")) as {
      record: { keyId: string };
    };
    const subject = keyedSubject(accountId, issued.record.keyId);

    /* Warm first: a first touch may legitimately build the window that the measured call
       then finds, and measuring the cold call would report that as the module's cost. */
    await check(subject);
    const work = await measureWork(scratch, () => check(subject));

    expect((work.result as Verdict).allowed, `the measured keyed call was refused`).toBe(true);
    /*
     * F-230-H: this asserted ONE statement from `checkLimit` and the correct number is ZERO.
     *
     * D-230-05's clause reads "anonymous, zero access; keyed, one indexed read that AC4 already
     * mandates; never a write" — and it counts the db access of a keyed REQUEST, not of
     * `checkLimit`. The read it names is AC4's, which is `resolveKey`'s revocation check at the
     * route. Under the reading this cell encoded, a keyed request issues `resolveKey`'s statement
     * AND `checkLimit`'s — **two**, contradicting the same clause that licenses one. The reading
     * that makes D-230-05 self-consistent is the implementation's: `checkLimit` touches `db` on no
     * path, and the one indexed read lives in `resolveKey`.
     *
     * The wording was mine and it was ambiguous; both halves read it honestly and differently.
     * T231 carries the structural repair — `checkLimit` taking what `resolveKey` returns, so the
     * precondition is a compile error rather than caller discipline — and until it lands, the
     * measured cost of `checkLimit` itself is zero statements.
     */
    expect(
      work.statements.length,
      `A keyed check issued ${work.statements.length} statements where \`checkLimit\` must issue ` +
        `NONE.\n` +
        `  statements: ${work.statements.map((q) => q.slice(0, 140)).join(" | ")}\n` +
        `  D-230-05's "keyed, one indexed read" counts the whole REQUEST and names AC4's read, ` +
        `which is \`resolveKey\`'s at the route. A statement here would make a keyed request cost ` +
        `two, contradicting the clause that licenses one.`,
    ).toBe(0);
    expect(work.changed, `a keyed check wrote to ${work.changed.join(", ")}`).toEqual([]);
  });

  /**
   * AC5, measured as the block asks: "asserted by measuring that `checkLimit` on an
   * under-ceiling read performs no write, not by observing that a response came back.
   * A counter implementation that writes on every read passes a latency-free test on
   * an idle machine and falls over under load."
   *
   * The effect is measured rather than the statement text. Classifying by leading verb
   * would be a deny list of the spellings somebody thought of; a row that moved is a
   * row that moved however it was written — through a function, a trigger, a driver
   * copy — and the tables and columns come from `information_schema`.
   */
  it("performs no write at all below the ceiling", async () => {
    const subject = anonymousSubject();
    const work = await measureWork(scratch, () => check(subject));
    expect(
      (work.result as Verdict).allowed,
      `The probe call was refused, so this cell is measuring the wrong branch.`,
    ).toBe(true);
    expect(
      work.changed,
      `\`checkLimit\` wrote to ${work.changed.join(", ")} on a read below the ceiling.\n` +
        `  Statements issued: ${work.statements.map((s) => s.slice(0, 120)).join(" | ")}\n` +
        `  AC5 is a negative and negatives go untested. A counter that writes on every read ` +
        `answers correctly, is latency-free on an idle machine, and falls over under exactly ` +
        `the load a rate limit exists for.`,
    ).toEqual([]);
  });

  /**
   * The other half of the same criterion, and the one a write-free implementation can
   * still fail: a check whose cost grows with how much the caller has already spent.
   * Asserted as a comparison between two calls on the same subject rather than against
   * a statement budget this suite invented.
   */
  it("costs no more on the fiftieth call than on the second", async () => {
    const subject = anonymousSubject();
    await check(subject);
    const early = await measureWork(scratch, () => check(subject));
    for (let i = 0; i < 48; i += 1) await check(subject);
    const late = await measureWork(scratch, () => check(subject));

    expect(
      late.statements.length,
      `The fiftieth check issued ${late.statements.length} statements where the second issued ` +
        `${early.statements.length}. A counter that reads every prior request to decide ` +
        `whether the caller is over performs the resource exhaustion the limit exists to ` +
        `prevent, and it does so with a correct verdict and no writes at all — so neither ` +
        `AC5's zero nor AC1's bound can see it.\n` +
        `  late: ${late.statements.map((s) => s.slice(0, 120)).join(" | ")}`,
    ).toBeLessThanOrEqual(early.statements.length);
  });
});

describe("T230 AC2 and AC3 — the ceiling is the server's, and a key raises it", () => {
  /**
   * AC2, "limits are enforced server-side regardless of any client cap", asserted as a
   * DIFFERENCE rather than arranged: the same subject with an extra property naming a
   * ceiling, against one without. `subject` is published with exactly three members,
   * so anything a caller adds is a client cap by definition, and an implementation
   * spreading its input into its own state picks it up silently.
   */
  it("a ceiling a caller puts on the subject changes nothing", async () => {
    const ip = freeIp();
    const honest = await check(anonymousSubject(ip));
    const spoofed = await check({
      ...anonymousSubject(freeIp()),
      limit: 10 ** 9,
      remaining: 10 ** 9,
      ceiling: 10 ** 9,
    } as unknown as Subject);

    expect(
      spoofed.limit,
      `A caller raised its own ceiling by naming one on the subject. AC2: "limits are ` +
        `enforced server-side regardless of any client cap". The two subjects differ only in ` +
        `members \`{ accountId, keyId, ip }\` does not declare.`,
    ).toBe(honest.limit);
  });

  it("a valid key raises the ceiling above the anonymous one", async () => {
    const issueKey = await requiredFn("issueKey");
    const accountId = await freeAccount(scratch);
    const issued = (await issueKey(scratch.db, accountActor(accountId), accountId, "raiser")) as {
      record: { keyId: string };
      secret: string;
    };

    const anonymous = await check(anonymousSubject());
    const keyed = await check(keyedSubject(accountId, issued.record.keyId));

    expect(
      keyed.limit,
      `A valid API key LOWERED the ceiling: keyed ${keyed.limit}, anonymous ` +
        `${anonymous.limit}. AC3, and B-17's whole reason for reversing D-83 — "keys issued ` +
        `per account for volume". Asserted as the difference between two verdicts rather ` +
        `than against a number, because the ceiling values are TBD and this suite must not ` +
        `invent them.\n` +
        `  D-230-03 ruled the comparison and ruled AGAINST the one I first wrote: AC3's ` +
        `"raises the ceiling" is an ORDERING, so this is \`>=\` and not \`>\`. A strict pin ` +
        `would red a correct implementation whose config gave this bucket equal tiers, ` +
        `which is exactly what a pin on a guess does.\n` +
        `  ${await note()}`,
    ).toBeGreaterThanOrEqual(anonymous.limit);
  });

  /**
   * THE CONTROL IN THIS CELL WAS WRONG AND THE REFERENCE CAUGHT IT.
   *
   * It first compared a revoked-key subject against an ANONYMOUS one and asserted the
   * ceiling had not risen. But the subject a caller presents with a key also carries an
   * `accountId`, and a signed-in account is entitled to the `account` tier whether or
   * not it presents a key — so the cell reddened a correct reference for being correct,
   * `expected 120 to be less than or equal to 60`.
   *
   * That is a control measuring an ADJACENT QUANTITY: "did the ceiling rise" needs the
   * baseline to be the same subject WITHOUT the key, not a different subject entirely.
   * The two agree only when the caller is anonymous, which is the one case a revoked key
   * cannot arise in.
   */
  it("a revoked key leaves the ceiling where the same subject would have it anyway", async () => {
    const issueKey = await requiredFn("issueKey");
    const revokeKey = await requiredFn("revokeKey");
    const accountId = await freeAccount(scratch);
    const resolveKey = await requiredFn("resolveKey");
    const issued = (await issueKey(scratch.db, accountActor(accountId), accountId, "revoked")) as {
      record: { keyId: string };
      secret: string;
    };

    await revokeKey(scratch.db, accountActor(accountId), issued.record.keyId);

    /*
     * F-230-I: this built a `keyedSubject` from the revoked `keyId` and called `checkLimit`
     * directly, which drives a state the system cannot produce.
     *
     * D-230-05 ruled that a non-null `keyId` on a subject is a PRECONDITION only `resolveKey` can
     * establish — `checkLimit` touches `db` on no path, so it cannot re-verify and is not asked to.
     * Handing it a `keyId` no `resolveKey` ever returned tests a caller's discipline, not the
     * module.
     *
     * The reachable guarantee is the one a route actually takes, and it is asserted here: resolve
     * first, and a revoked secret must resolve to NOTHING, so no keyed subject exists to raise a
     * ceiling with. F-230-J measured what this rests on — deleting `isNull(revokedAt)` from
     * `resolveKey`'s WHERE reddened 0 of 164 cells while a revoked key kept 6000 against 600 — so
     * this cell is now that line's witness. **T231 carries the structural repair**: `checkLimit`
     * taking what `resolveKey` returns, which makes the precondition a compile error rather than
     * something a future caller is trusted to honour.
     */
    const resolved = await resolveKey(scratch.db, issued.secret);
    expect(
      resolved,
      `A revoked secret still resolves. AC4 says a revoked key is refused IMMEDIATELY, and ` +
        `\`resolveKey\` returning a record is what lets a caller build a keyed subject and carry ` +
        `the raised ceiling forever. This is the single line the whole design rests on: ` +
        `\`isNull(revokedAt)\` in resolveKey's WHERE. Deleting it reddened nothing across 164 ` +
        `cells before this assertion existed.\n  ${await note()}`,
    ).toBeUndefined();

    const withoutKey = await check(accountSubject(accountId));
    expect(
      withoutKey.limit,
      `With the key revoked and unresolvable, the subject falls back to its account tier and ` +
        `must carry the account ceiling.\n  ${await note()}`,
    ).toBeGreaterThan(0);
  });
});
