/* ============================================================
   T110 AC6 — the caller may fork exactly what they may read

   ── why every cell here asserts AGREEMENT and not an outcome ──
   T100's round established the failure this file is built against:
   an implementation that never called `can` and just compared ids
   passed all 48 cells until an agreement cell was added. A criterion
   written as "a stranger is refused" is satisfied by
   `bundle.visibility === "public"`, which is today's answer to an
   open product question rather than the policy — and it has to be
   rewritten by whoever amends the policy, in a file that is not the
   policy's.

   So each cell below computes `can(actor, "read", { kind: "bundle",
   ownerId, visibility })` for its own case and asserts that
   `forkBundle` agrees with THAT. The expected verdict is never
   written as a literal. Two of the four cases — the author reading
   their own private bundle, and B-13's break-glass operator — are
   where an id comparison and the policy diverge, and they are the
   whole reason the matrix exists.

   ── B-03, one layer down ──
   `publish` already does this and says so: "A handle nobody holds
   and a handle you do not own answer identically" (`publish.ts:
   137-139`). T110 publishes one sentence — "forkBundle: no such
   bundle." — for an unreadable upstream, so an upstream that does
   not exist and one the caller may not read must be
   INDISTINGUISHABLE. A distinct sentence for "no such author" is a
   confirmation oracle for which handles exist, and it is the kind of
   thing an implementer adds while being helpful.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBundle } from "@/lib/server/archive";
import { can } from "@/lib/server/policy";
import type { Actor } from "@/lib/server/policy";

import {
  MESSAGE_FORMS,
  RULINGS,
  RecordedSetup,
  boundForkBundle,
  bundleRecordOf,
  refusalFrom,
  warmLineage,
} from "./contract";
import {
  ANONYMOUS,
  type Account,
  type Published,
  type Scratch,
  describeAdded,
  operatorActor,
  publishBundle,
  resolvingCorpus,
  revisionOf,
  rowsAdded,
  scratchDatabase,
  seedAccount,
  snapshotRows,
} from "./fixtures";

interface Env {
  scratch: Scratch;
  author: Account;
  stranger: Account;
  operator: Account;
  publicUpstream: Published;
  privateUpstream: Published;
}

const setup = new RecordedSetup<Env>("the T110 authorization fixture");

/* Before the fixture hook, so the transform cost is paid where there is headroom for it. */
beforeAll(warmLineage);

beforeAll(async () => {
  await setup.run(async () => {
    const scratch = await scratchDatabase("authz");
    const author = await seedAccount(scratch, "t110-owner");
    const stranger = await seedAccount(scratch, "t110-stranger");
    const operator = await seedAccount(scratch, "t110-operator");
    const corpus = resolvingCorpus();

    const publicUpstream = await publishBundle(
      scratch,
      author,
      corpus,
      "authz-public",
      "1.0.0",
      "public",
    );
    const privateUpstream = await publishBundle(
      scratch,
      author,
      revisionOf(corpus, "a private upstream, so its bytes differ from the public one"),
      "authz-private",
      "1.0.0",
      "private",
    );

    return { scratch, author, stranger, operator, publicUpstream, privateUpstream };
  });
});

afterAll(async () => {
  await setup.optional()?.scratch.drop();
});

/**
 * The four cases, as data. Each names the actor it uses and the upstream it reaches for; the
 * VERDICT is never in this table — it is computed from `can` inside the cell.
 */
const CASES = [
  {
    name: "a stranger over a public upstream",
    slug: "authz-fork-a",
    upstream: "public" as const,
    actorOf: (env: Env): Actor => env.stranger.actor,
    /** What separates this case from the others, for the failure message. */
    why: "the ordinary case: a public bundle is readable by anyone, so it is forkable by anyone with an account",
  },
  {
    name: "a stranger over a private upstream",
    slug: "authz-fork-b",
    upstream: "private" as const,
    actorOf: (env: Env): Actor => env.stranger.actor,
    why: "AC6 itself: an upstream the caller cannot read is not forkable, and the refusal is a 404 rather than a 403",
  },
  {
    name: "the author over their OWN private upstream",
    slug: "authz-fork-c",
    upstream: "private" as const,
    actorOf: (env: Env): Actor => env.author.actor,
    why:
      "the first case where an id comparison and the policy diverge. `can` grants the owner a read " +
      "of their own private bundle; an implementation that checks `visibility === \"public\"` " +
      "refuses it, and nothing in AC6's wording would catch that",
  },
  {
    name: "B-13's break-glass operator over a private upstream",
    slug: "authz-fork-d",
    upstream: "private" as const,
    actorOf: (env: Env): Actor => operatorActor(env.operator.accountId),
    why:
      "the second divergence. `can` grants an operator every action on any recognised resource " +
      "(`lib/server/policy/can.ts` — `isOperatorGrant`), so a module that delegates lets an " +
      "operator fork and a module that compares ids does not",
  },
] as const;

describe("T110 AC6: forkBundle agrees with `can`, it does not re-decide", () => {
  for (const testCase of CASES) {
    it(`${testCase.name}`, async () => {
      const env = setup.require();
      const upstream =
        testCase.upstream === "public" ? env.publicUpstream : env.privateUpstream;
      const actor = testCase.actorOf(env);

      /* The oracle, and it is T060's own function rather than a reading of it written here. Asked
         about the resource as it actually stands in the row this fixture planted. */
      const permitted = can(actor, "read", {
        kind: "bundle",
        ownerId: upstream.owner.accountId,
        visibility: testCase.upstream,
      });

      const forkBundle = await boundForkBundle();
      const call = forkBundle(
        env.scratch.db,
        actor,
        { ownerHandle: upstream.owner.handle, slug: upstream.slug, version: upstream.version },
        { slug: testCase.slug, visibility: "private" },
      );

      if (permitted) {
        const record = bundleRecordOf(
          await call.catch((thrown: unknown) => {
            throw new Error(
              `AC6 agreement, ${testCase.name}: \`can\` grants this read and \`forkBundle\` ` +
                `refused it.\n  ${testCase.why}\n` +
                `  It threw: ${thrown instanceof Error ? thrown.message : String(thrown)}\n` +
                `  The criterion is DELEGATION, not outcome: an implementation that decides ` +
                `readability for itself is one that has to be edited whenever T060's policy ` +
                `changes, in a file that is not T060's.`,
            );
          }),
          `AC6 agreement, ${testCase.name}`,
        );
        expect(record.slug).toBe(testCase.slug);
        return;
      }

      const refusal = await refusalFrom(call, `AC6 agreement, ${testCase.name}`);
      expect(
        MESSAGE_FORMS["no-such-bundle"].test(refusal.message),
        `AC6 agreement, ${testCase.name}: \`can\` denies this read, \`forkBundle\` refused — ` +
          `and its message is ${JSON.stringify(refusal.message)}.\n  ${testCase.why}\n` +
          `  The contract publishes exactly one sentence here: "forkBundle: no such bundle." ` +
          `(AC6, 404 not 403). The pattern is anchored at both ends, because anything appended ` +
          `after that full stop — a handle, a slug, a reason — is the disclosure the sentence ` +
          `exists to prevent.`,
      ).toBe(true);
    });
  }
});

describe("T110 AC6: an unreadable upstream and an absent one are one sentence", () => {
  /**
   * B-03 one layer down, asserted as an IDENTITY between three messages rather than as three
   * separate pattern matches. Three matches against the same anchored pattern would already be
   * strong; comparing the strings to each other is what survives a future amendment to the
   * sentence, since it goes on holding whatever the sentence becomes.
   */
  it("a private upstream, an unknown handle and an unknown slug all answer identically", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();

    const unreadable = await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.stranger.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.privateUpstream.slug,
          version: env.privateUpstream.version,
        },
        { slug: "authz-b03-a" },
      ),
      "B-03, an upstream the caller may not read",
    );

    const noSuchHandle = await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.stranger.actor,
        { ownerHandle: "t110-nobody", slug: env.privateUpstream.slug, version: "1.0.0" },
        { slug: "authz-b03-b" },
      ),
      "B-03, a handle nobody holds",
    );

    const noSuchSlug = await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.stranger.actor,
        { ownerHandle: env.author.handle, slug: "no-bundle-at-this-slug", version: "1.0.0" },
        { slug: "authz-b03-c" },
      ),
      "B-03, a slug that author does not hold",
    );

    expect(
      [unreadable.message, noSuchHandle.message, noSuchSlug.message],
      `The three refusals read:\n  unreadable: ${JSON.stringify(unreadable.message)}\n` +
        `  no such handle: ${JSON.stringify(noSuchHandle.message)}\n` +
        `  no such slug: ${JSON.stringify(noSuchSlug.message)}\n` +
        `  They must be the SAME sentence. A distinct message for "no such author" confirms which ` +
        `handles exist to anyone who asks, and a distinct one for "no such slug" confirms which ` +
        `private bundles a known author holds. \`publish\` already makes this exact choice and ` +
        `writes down why (\`lib/server/publish/publish.ts:137-139\`).`,
    ).toEqual([unreadable.message, unreadable.message, unreadable.message]);

    expect(
      MESSAGE_FORMS["no-such-bundle"].test(unreadable.message),
      `And the sentence they agree on is the one the contract publishes. It is ` +
        `${JSON.stringify(unreadable.message)}.`,
    ).toBe(true);
  });

  /**
   * The refusal left nothing behind.
   *
   * Placed here rather than only in `fork.test.ts` because the two refusals reach different code:
   * the collision check runs after the upstream has been read, and this one runs instead of that
   * read. A write that happens on one path is not evidence about the other.
   */
  it("writes nothing at all when it refuses an unreadable upstream", async () => {
    const env = setup.require();

    const before = await snapshotRows(env.scratch);

    const forkBundle = await boundForkBundle();
    await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.stranger.actor,
        {
          ownerHandle: env.author.handle,
          slug: env.privateUpstream.slug,
          version: env.privateUpstream.version,
        },
        { slug: "authz-noeffect" },
      ),
      "AC6 non-effect",
    );

    const added = rowsAdded(before, await snapshotRows(env.scratch));
    const total = [...added.values()].reduce((sum, rows) => sum + rows.length, 0);
    expect(
      total,
      `A fork refused under AC6 added ${total} row(s): ${describeAdded(added)}.\n` +
        `  ${[...added.entries()].map(([t, rows]) => `${t}: ${rows.join(" | ")}`).join("\n  ")}\n` +
        `  A refusal that has already created the fork's row hands the caller a bundle the ` +
        `criterion says they may not have, and every \`rejects.toThrow()\` a reviewer would ` +
        `write passes over it.`,
    ).toBe(0);
  });
});

describe("T110: two refusals the contract does not give a sentence for", () => {
  /**
   * An anonymous caller over a PUBLIC upstream.
   *
   * **This is deliberately not an agreement cell, and the reason is the interesting part.** `can`
   * grants an anonymous actor a read of a public bundle, so agreement with `can` would predict
   * SUCCESS — and a fork is an ownership change, so success would mean writing a `bundle` row
   * whose `owner_id` is nobody's. The read half and the ownership half disagree here and the
   * contract settles neither: it names no sentence for this case.
   *
   * So this cell asserts only what is reading-independent — that the call is REFUSED — and
   * deliberately does not pin the message. Charged to the orchestrator as an open question. What
   * it excludes is the one outcome no reading admits: an anonymous fork that resolves.
   */
  it("an anonymous caller cannot fork a public upstream", async () => {
    const env = setup.require();

    const readable = can(ANONYMOUS, "read", {
      kind: "bundle",
      ownerId: env.publicUpstream.owner.accountId,
      visibility: "public",
    });
    expect(
      readable,
      "The premise of this cell: `can` really does grant an anonymous read of a public bundle, " +
        "so the refusal below cannot be a read decision and must be an ownership one.",
    ).toBe(true);

    const forkBundle = await boundForkBundle();
    const refusal = await refusalFrom(
      forkBundle(
        env.scratch.db,
        ANONYMOUS,
        {
          ownerHandle: env.publicUpstream.owner.handle,
          slug: env.publicUpstream.slug,
          version: env.publicUpstream.version,
        },
        { slug: "authz-anon" },
      ),
      "an anonymous fork",
    );
    expect(
      MESSAGE_FORMS["not-signed-in"].test(refusal.message),
      `D-110-10: the refusal reads ${JSON.stringify(refusal.message)} and the contract publishes ` +
        `"forkBundle: not signed in." for this arm.\n  ${RULINGS.D110_10_anonymous}.\n` +
        `  Anchored at both ends, and here the anchor does more than usual: the READ half of this ` +
        `operation allowed the call, so anything appended naming the upstream would disclose ` +
        `something the refusal is not even about.`,
    ).toBe(true);
  });

  /**
   * And the anonymous refusal names nothing about the target.
   *
   * Its own cell because it is its own claim: the anchored pattern above already forbids appended
   * text, but this one states WHY in terms a reader of a failure can act on, and it goes on
   * holding if the sentence is ever amended.
   */
  it("the anonymous refusal discloses nothing about the upstream", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const refusal = await refusalFrom(
      forkBundle(
        env.scratch.db,
        ANONYMOUS,
        {
          ownerHandle: env.publicUpstream.owner.handle,
          slug: env.publicUpstream.slug,
          version: env.publicUpstream.version,
        },
        { slug: "authz-anon-quiet" },
      ),
      "D-110-10 disclosure",
    );

    for (const secret of [
      env.publicUpstream.owner.handle,
      env.publicUpstream.slug,
      env.publicUpstream.owner.accountId,
    ]) {
      expect(
        refusal.message.includes(secret),
        `D-110-10: the refusal names \`${secret}\`.\n` +
          `  It reads: ${JSON.stringify(refusal.message)}\n` +
          `  "It carries nothing about the target." This arm is not a read denial — \`can\` ` +
          `granted the read — so the sentence has no business describing what was being read.`,
      ).toBe(false);
    }
  });

  /**
   * A version the upstream never released.
   *
   * Also unruled. AC1 makes lineage name "the release taken", so a fork at a release that does not
   * exist has nothing to name — but the block gives no sentence for it, and `"forkBundle: no such
   * bundle."` is about the bundle rather than the release. The bad output this excludes is the one
   * that matters: a fork that silently falls back to the latest release and records a lineage the
   * caller never asked for.
   */
  it("forking at a release the upstream never published is refused", async () => {
    const env = setup.require();

    const forkBundle = await boundForkBundle();
    const refusal = await refusalFrom(
      forkBundle(
        env.scratch.db,
        env.stranger.actor,
        {
          ownerHandle: env.publicUpstream.owner.handle,
          slug: env.publicUpstream.slug,
          version: "99.99.99",
        },
        { slug: "authz-noversion" },
      ),
      "a release that does not exist",
    );
    expect(
      MESSAGE_FORMS["no-such-release"].test(refusal.message),
      `D-110-11: the refusal reads ${JSON.stringify(refusal.message)} and the contract publishes ` +
        `"forkBundle: no such release." for this arm.\n  ${RULINGS.D110_11_noSuchRelease}.\n` +
        `  Not "no such bundle.": \`${env.publicUpstream.slug}\` exists and this caller can read ` +
        `it, so that sentence would be false.`,
    ).toBe(true);

    /* The bad output, excluded explicitly rather than left to the refusal to imply. A fallback to
       the latest release would have RESOLVED here, and `refusalFrom` is what forbids that — a
       fork that fell back would satisfy AC1 by recording a true statement about a release the
       caller never asked for, which is a wrong provenance where a refusal would have been loud. */
    const fallback = await getBundle(env.scratch.db, env.stranger.accountId, "authz-noversion");
    expect(
      fallback,
      "D-110-11: the refused fork left a bundle row behind at `authz-noversion`. A refusal that " +
        "has already written the copy is the fallback with an error message in front of it.",
    ).toBeUndefined();
  });
});
