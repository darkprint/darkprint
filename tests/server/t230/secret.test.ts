/* ============================================================
   T230 — the secret

   "`issueKey` returns the secret exactly once and `ApiKeyRecord`
   does not carry it. The secret is stored hashed and is
   unrecoverable; the record shape makes that structural rather
   than a rule someone remembers ... A test asserts
   `ApiKeyRecord`'s key set excludes any secret-bearing field."

   Every cell here is a WHITELIST or a PROVENANCE scan, and the two
   are different instruments doing different jobs:

   **Key-set equality** admits only what the contract names, and
   the admitted set is parsed out of `backend.md` rather than typed
   here. It fails closed on a member nobody published — which is
   the shape that passes every field pin, the way an RFC 9457
   extension member passed all five of T081's.

   **Provenance** catches a PUBLISHED member carrying the secret:
   a `label` echoed with it appended, a `keyId` minted from it. A
   key-set pin is blind to that by construction, so neither
   instrument is redundant with the other.

   What is deliberately NOT here is `not.toContain("sk_")`. A deny
   list over renderings only excludes the leaks somebody thought
   of, and the secret is a value this suite holds — so it can be
   looked for by what it IS rather than by what it is thought to
   look like.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Scratch,
  accountActor,
  describe_,
  dropScratchDatabases,
  dumpDatabase,
  freeAccount,
  occurrencesOf,
  publishedInterface,
  requiredFn,
  scratchDatabase,
} from "./contract";

let scratch: Scratch;

beforeAll(async () => {
  scratch = await scratchDatabase();
});

afterAll(async () => {
  await dropScratchDatabases();
});

interface Issued {
  record: Record<string, unknown>;
  secret: string;
  accountId: string;
  label: string;
  raw: unknown;
}

/** A label nothing else in the run can produce, so an occurrence of it is by provenance. */
function freeLabel(): string {
  return `t230-label-${Math.random().toString(36).slice(2)}-${process.pid}`;
}

async function issue(label = freeLabel()): Promise<Issued> {
  const issueKey = await requiredFn("issueKey");
  const accountId = await freeAccount(scratch);
  const raw = await issueKey(scratch.db, accountActor(accountId), accountId, label);
  if (raw === null || typeof raw !== "object") {
    throw new Error(`issueKey answered ${describe_(raw)}; the contract publishes an object.`);
  }
  const { record, secret } = raw as { record?: unknown; secret?: unknown };
  if (typeof secret !== "string" || secret === "") {
    throw new Error(`issueKey's \`secret\` is ${describe_(secret)}; the contract publishes a string.`);
  }
  if (record === null || typeof record !== "object") {
    throw new Error(`issueKey's \`record\` is ${describe_(record)}.`);
  }
  return { record: record as Record<string, unknown>, secret, accountId, label, raw };
}

describe("T230 issueKey's return, admitted rather than filtered", () => {
  it("the envelope's members are exactly `record` and `secret`", async () => {
    const issued = await issue();
    expect(
      Object.keys(issued.raw as object).sort(),
      `issueKey answered a member the contract does not publish. Its return is ` +
        `\`Promise<{ record: ApiKeyRecord; secret: string }>\` and nothing else, and the one ` +
        `shape that passes every field pin in this file is an extra member beside the two — ` +
        `a \`tokenHash\`, a \`plaintext\`, a debug echo. If a third member is wanted it goes ` +
        `in the block first.\n` +
        `  answered: ${JSON.stringify(issued.raw)}`,
    ).toEqual(["record", "secret"]);
  });

  /* Five until 2026-09-05. The sixth is `scope`, added to the block and to `TRANSCRIBED` by the
     owner's ruling on §11.0 Q3 — the reason is at `contract.ts`'s entry. The count in the title
     is the only thing that moved: this stays an equality, because the member it exists to refuse
     is one nobody published and a superset check would let that member straight through. */
  it("the record's members are exactly ApiKeyRecord's six", async () => {
    const issued = await issue();
    const published = [...publishedInterface("ApiKeyRecord").fields].sort();
    expect(
      Object.keys(issued.record).sort(),
      `The record carries a member \`interface ApiKeyRecord\` does not declare, or is missing ` +
        `one it does.\n` +
        `  backend.md §T230: ${publishedInterface("ApiKeyRecord").text}\n` +
        `  The block makes the secret's absence STRUCTURAL — "in the same way PublicAuthor has ` +
        `no email" — and a structural guarantee is an equality on the key set, not a check ` +
        `that one named field is missing.\n` +
        `  carried: ${JSON.stringify(issued.record)}`,
    ).toEqual(published);
  });

  it("no member of the record carries the secret, at any depth", async () => {
    const issued = await issue();
    expect(
      occurrencesOf(issued.secret, issued.record),
      `The secret this call returned occurs inside the record. The key-set pin above cannot ` +
        `see this: every member is one the contract publishes, and one of them is holding the ` +
        `credential — a \`label\` echoed with it, a \`keyId\` minted from it.\n` +
        `  record: ${JSON.stringify(issued.record)}`,
    ).toEqual([]);
  });

  it("the secret does not carry the key id, so a listed record does not narrow it", async () => {
    const issued = await issue();
    const keyId = issued.record.keyId;
    expect(
      typeof keyId === "string" && keyId !== "" && issued.secret.includes(keyId),
      `The secret contains \`keyId\` (${describe_(keyId)}). \`keyId\` is on every record a key ` +
        `listing returns, so a secret built around it is a secret partly published by the ` +
        `surface that is meant to be safe to show.`,
    ).toBe(false);
  });

  it("two keys for one account and one label get different secrets", async () => {
    const issueKey = await requiredFn("issueKey");
    const accountId = await freeAccount(scratch);
    const label = freeLabel();
    const first = (await issueKey(scratch.db, accountActor(accountId), accountId, label)) as {
      secret: string;
      record: { keyId: string };
    };
    const second = (await issueKey(scratch.db, accountActor(accountId), accountId, label)) as {
      secret: string;
      record: { keyId: string };
    };
    expect(
      second.secret,
      `Two issues for the same account and label produced the same secret, so the secret is a ` +
        `function of inputs a caller already holds rather than of anything unguessable. ` +
        `Asserted as a difference rather than by inspecting an entropy the contract does not ` +
        `publish.`,
    ).not.toBe(first.secret);
    expect(second.record.keyId).not.toBe(first.record.keyId);
  });
});

describe("T230 resolveKey's return carries the same shape and no more", () => {
  it("the resolved record's members are exactly ApiKeyRecord's six", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const issued = await issue();
    const resolved = await resolveKey(scratch.db, issued.secret);
    expect(
      resolved,
      `resolveKey answered ${describe_(resolved)} for a secret issueKey had just returned.`,
    ).not.toBeUndefined();
    expect(Object.keys(resolved as object).sort()).toEqual(
      [...publishedInterface("ApiKeyRecord").fields].sort(),
    );
  });

  it("the resolved record does not carry the secret it was resolved from", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const issued = await issue();
    const resolved = await resolveKey(scratch.db, issued.secret);
    expect(
      occurrencesOf(issued.secret, resolved),
      `resolveKey echoed the presented secret back inside the record it answered.`,
    ).toEqual([]);
  });

  it("an unissued secret resolves to undefined", async () => {
    const resolveKey = await requiredFn("resolveKey");
    const issued = await issue();
    const forged = `${issued.secret}x`;
    expect(
      await resolveKey(scratch.db, forged),
      `resolveKey answered a record for a secret nothing issued. Driven as the issued secret ` +
        `plus one character, so a prefix comparison is what this reds on rather than a value ` +
        `unrelated to any key.`,
    ).toBeUndefined();
  });
});

describe("T230 the secret is unrecoverable from storage", () => {
  /**
   * THE CONTROL, and it is a separate test rather than a line inside the next one on
   * purpose: a control that asserts a property of the FIXTURE can be mutated and
   * caught, while an inline two-factor assertion can only be deleted and a suite
   * cannot catch the deletion of its own assertion.
   *
   * What it establishes is that the scan below can SEE a caller-supplied value that
   * reached the database. Without it, the next test's `[]` is the same `[]` a scan
   * over an empty dump produces, and the two are indistinguishable from inside a
   * passing run.
   */
  it("CONTROL — the whole-database scan finds a caller value that was stored", async () => {
    const issued = await issue();
    const found = occurrencesOf(issued.label, await dumpDatabase(scratch));
    expect(
      found.length,
      `The scan found no occurrence of the \`label\` this test supplied, which the contract ` +
        `stores (\`api_key.label text NOT NULL\`) and \`ApiKeyRecord\` returns. So the ` +
        `instrument is not reading what it thinks it is reading, and the secret scan beside ` +
        `this one is measuring nothing.\n` +
        `  label: ${issued.label}`,
    ).toBeGreaterThan(0);
  });

  /**
   * One surface further out than the record, which is where T081's F1 lived: every
   * leak instrument there was scoped to the problem document and nothing read the
   * response, so a driver value on a header reddened nothing blind or colocated.
   *
   * Quantified over every row of every table in `public`, columns discovered from
   * `information_schema`, so this covers a column added after this file was written.
   * It subsumes an `api_key`-only scan, which is why there is no second cell for that
   * — a property that catches the same set as another is not a second axis.
   */
  it("no column of any row in any table carries the secret", async () => {
    const issued = await issue();
    const found = occurrencesOf(issued.secret, await dumpDatabase(scratch));
    expect(
      found,
      `The secret is stored recoverably. The block: "The secret is stored hashed and is ` +
        `unrecoverable." A value equal to what issueKey returned is in the database, so ` +
        `anyone who can read a row can authenticate as this key.\n` +
        `  Found at: ${found.join(", ")}\n` +
        `  Scanned every table in \`public\` with columns taken from information_schema, so ` +
        `this is not a list of places somebody thought to look.`,
    ).toEqual([]);
  });
});
