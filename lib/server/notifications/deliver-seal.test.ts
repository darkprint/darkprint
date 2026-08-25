/* ============================================================
   D-13 seal, the one statement that escaped it: a driver fault
   taking `deliverPending`'s advisory lock must surface as
   NotificationStoreError, not as a raw pg error naming the
   internals. Found by the ultracode audit's error-contract lens.

   Driven with a hand-built `Db` whose transaction hands back a
   `tx` that throws on `.execute` — the lock statement is the first
   thing the drain runs, so this reaches exactly it, no database
   required.
   ============================================================ */

import { describe, expect, it } from "vitest";

import type { Db } from "@/lib/db";
import { NotificationStoreError } from "./errors";
import { deliverPending } from "./deliver";
import type { NotificationDelivery } from "./types";

/** A driver fault of the shape `pg` raises, with the internals a seal exists to hide. */
class FakeDriverError extends Error {
  readonly code = "57P01";
  constructor() {
    super('terminating connection due to administrator command\n at pg_advisory_xact_lock');
  }
}

/** A `Db` whose transaction runs the drain's callback against a `tx` that faults on execute. */
function faultingDb(): Db {
  const tx = {
    execute: async () => {
      throw new FakeDriverError();
    },
  };
  return {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  } as unknown as Db;
}

const neverSends: NotificationDelivery = {
  send: async () => {
    throw new Error("the drain must fault on the lock before any send");
  },
};

describe("deliverPending seals a driver fault on the advisory-lock statement", () => {
  it("surfaces NotificationStoreError, not the raw pg error", async () => {
    await expect(deliverPending(faultingDb(), neverSends)).rejects.toBeInstanceOf(NotificationStoreError);
  });

  it("the sealed message names the operation and does not leak the driver text", async () => {
    const error = await deliverPending(faultingDb(), neverSends).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotificationStoreError);
    const message = (error as NotificationStoreError).message;
    expect(message).toBe("deliverPending: the notification store failed.");
    /* The raw driver text travels on `cause` (the sanctioned carrier), never in `message`. */
    expect(message).not.toContain("pg_advisory_xact_lock");
    expect(message).not.toContain("administrator command");
  });
});
