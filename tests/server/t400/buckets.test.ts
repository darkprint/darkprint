/* ============================================================
   T400: which buckets an anonymous caller may write to

   The live tutorial channel is the first anonymous write path in
   the product, and it opens exactly one door: the `live` bucket.
   The two write buckets that existed before it keep refusing an
   anonymous subject, and that has to be measured rather than
   assumed, because the change that added a bucket is the change
   most likely to have loosened a neighbour.

   No database: `checkLimit` never touches one, and a fresh counter
   keeps these cells off the process-wide slots the route suite
   spends.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { checkLimit, createSlotCounter, type LimitSubject } from "@/lib/server/limits";

const ANON: LimitSubject = { tier: "anonymous", ip: "198.51.100.40" };

describe("anonymous callers against the shipped ceilings", () => {
  it.each(["write", "upload"])("are still refused in the %s bucket", async (bucket) => {
    const verdict = await checkLimit(ANON, bucket, { counter: createSlotCounter() });
    expect(verdict.allowed).toBe(false);
    expect(verdict.limit).toBe(0);
  });

  it("are admitted in the live bucket, sixty an hour", async () => {
    const counter = createSlotCounter();
    const first = await checkLimit(ANON, "live", { counter });
    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(60);
    expect(first.windowMs).toBe(60 * 60 * 1000);
    for (let i = 1; i < 60; i += 1) await checkLimit(ANON, "live", { counter });
    const past = await checkLimit(ANON, "live", { counter });
    expect(past.allowed).toBe(false);
  });

  it("are admitted in the poll bucket at one tab's rate, 3 600 an hour", async () => {
    const verdict = await checkLimit(ANON, "poll", { counter: createSlotCounter() });
    expect(verdict.allowed).toBe(true);
    expect(verdict.limit).toBe(3_600);
    expect(verdict.windowMs).toBe(60 * 60 * 1000);
  });
});
