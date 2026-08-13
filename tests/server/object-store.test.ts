import { afterAll, describe, expect, it } from "vitest";

import { contentDigest } from "@/lib/core";

import {
  asBytes,
  loadDb,
  objectStoreFor,
  PUBLISHED,
  requiredFn,
  type ObjectStore,
  type UnknownFn,
} from "./contract";

/* ============================================================
   T000 acceptance criterion 5 — object storage

   (5) an object written to storage under a digest reads back
       byte-identical

   B-01 splits storage in two: "bytes live in S3-compatible object
   storage keyed by digest; the index lives in Postgres". The key is
   the integrity guarantee, which `lib/core/archive/store.ts` spells
   out — change the content and you change the key, so the old
   object survives untouched, and a downloader recomputes the hash
   to confirm the site is handing back what it claims.

   That makes "byte-identical" the whole criterion rather than a
   detail of it. A store that round-trips through a lossy encoding,
   normalises unicode, trims a trailing newline or reports a length
   in characters where the bytes disagree has broken the archive's
   only guarantee while looking like it works. So every comparison
   here is on bytes, not on strings.

   ── what the contract names, and what it still does not ──
   `createObjectStorage(config?)`, `keyForDigest(digest)` and put,
   get and delete on `ObjectStorage` are published, so they are bound
   by name and their absence is a red. The delete in particular is no
   longer optional: the test-isolation amendment has every storage
   test take back what it wrote, and the round-2 log asked whether a
   store publishing none should be a red of its own. The contract has
   since answered by publishing it.

   What is still unnamed is which of the three verbs' arguments is
   the key and who computes it, so that one shape is resolved once
   against a probe in `contract.ts` and reported as open.

   Addresses in this file are always the engine's digest. The store
   facade maps a digest to whatever physical key `keyForDigest`
   returns, which is the amendment's rule exactly: "the key *is* the
   digest the engine computes over the bytes", and no test may
   prefix or namespace one.
   ============================================================ */

let cached: Promise<ObjectStore> | undefined;

function store(): Promise<ObjectStore> {
  cached ??= loadDb().then((mod) => objectStoreFor(mod, contentDigest));
  return cached;
}

async function keyForDigest(): Promise<UnknownFn> {
  return requiredFn(await loadDb(), "keyForDigest", "@/lib/db", PUBLISHED.keyForDigest);
}

/**
 * The bucket is shared and the test-isolation amendment says a test takes back what it
 * wrote. Isolation itself does not depend on this — every fixture below carries unique
 * bytes, so it lands on a key no other test can name, which is why the amendment forbids
 * prefixing keys — but leaving a run's worth of objects behind is how the first round's
 * residue ended up deciding what a bucket listing returned.
 */
afterAll(async () => {
  const s = await store().catch(() => undefined);
  if (s !== undefined) await s.cleanup();
});

/** Fails at the first differing byte and says which one, because "not equal" is not a lead. */
function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.byteLength).toBe(expected.byteLength);
  for (let i = 0; i < expected.byteLength; i += 1) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `byte ${i} of ${expected.byteLength} differs: read 0x${actual[i]?.toString(16)}, ` +
          `wrote 0x${expected[i].toString(16)}`,
      );
    }
  }
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A distinct body per run, so a stale object from an earlier run can never answer for one. */
function unique(label: string): string {
  return `${label}\n${process.pid}\n${globalThis.performance.now()}\n`;
}

const DOT = [
  "digraph blueprint {",
  '  planner -> solver [label="plan"];',
  "  solver -> ship;",
  "}",
  "",
].join("\n");

describe("T000 AC5 — an object reads back byte-identical", () => {
  it("AC5: text written under its digest comes back with every byte intact", async () => {
    const s = await store();
    const content = DOT + unique("round-trip");

    const digest = await s.put(content);
    expect(typeof digest).toBe("string");
    expect(digest.length).toBeGreaterThan(0);

    expectSameBytes(asBytes(await s.get(digest)), encode(content));
  }, 60_000);

  it("AC5: unicode is stored as bytes, not as a normalised string", async () => {
    const s = await store();
    /* A combining sequence beside its precomposed twin, an astral character, a ZWJ
       emoji, a right-to-left mark, a zero-width joiner on its own and a NUL. NFC
       normalisation collapses the first pair, which is exactly the silent corruption a
       content-addressed archive cannot survive: the bytes change, so the digest the
       downloader recomputes stops matching the one the site published. */
    const content = `é é 𝄞 👩‍💻 ‏؟‎ \u0000 ${unique("unicode")}`;

    const digest = await s.put(content);
    expectSameBytes(asBytes(await s.get(digest)), encode(content));
  }, 60_000);

  it("AC5: an empty object is an object", async () => {
    const s = await store();
    const digest = await s.put("");
    const read = await s.get(digest);

    /* Empty is not absent. `get` returning nothing here would make a legitimately empty
       card indistinguishable from a missing one. */
    expect(read).not.toBeUndefined();
    expect(read).not.toBeNull();
    expectSameBytes(asBytes(read), new Uint8Array(0));
  }, 60_000);

  it("AC5: whitespace at the edges is content, not formatting", async () => {
    const s = await store();
    const content = `\n\n  ${unique("whitespace")}  \t\r\n\n`;

    const digest = await s.put(content);
    expectSameBytes(asBytes(await s.get(digest)), encode(content));
  }, 60_000);

  it("AC5: an oversized object round-trips whole", async () => {
    const s = await store();
    /* Two mebibytes, above every default in-memory buffer this path is likely to have and
       above the point where a client starts chunking. */
    const content = `${unique("large")}${"blueprint node ".repeat(150_000)}`;
    expect(encode(content).byteLength).toBeGreaterThan(2 * 1024 * 1024);

    const digest = await s.put(content);
    expectSameBytes(asBytes(await s.get(digest)), encode(content));
  }, 180_000);
});

describe("T000 AC5 (edges) — the digest is the address", () => {
  it("writing the same content twice is idempotent and the address does not move", async () => {
    const s = await store();
    const content = unique("idempotent");

    const first = await s.put(content);
    const second = await s.put(content);

    expect(second).toBe(first);
    expectSameBytes(asBytes(await s.get(first)), encode(content));
  }, 60_000);

  it("the object is found again by recomputing the digest from the content alone", async () => {
    const s = await store();
    const content = unique("addressing");
    await s.put(content);

    /* Nothing here remembers what `put` answered, which is the downloader's position
       exactly: doc 1 §4 has it verify an artefact by recomputing the hash, and T010 already
       commits to storing "the digest the engine computes". A server that files bytes under
       an address of its own invention breaks both at once, and nothing downstream would
       notice until a verification failed in somebody else's hands. */
    expectSameBytes(asBytes(await s.get(contentDigest(content))), encode(content));
  }, 60_000);

  it("keyForDigest is a function of the digest and nothing else", async () => {
    const key = await keyForDigest();
    const one = contentDigest(unique("key-a"));
    const other = contentDigest(unique("key-b"));

    /* The published mapping from the engine's address to the bucket's. Two properties
       carry the archive: the same digest names the same object every time, so a
       downloader can find it, and two digests never collide onto one key, so storing a
       card can never overwrite somebody else's. */
    expect(key(one)).toBe(key(one));
    expect(key(one)).not.toBe(key(other));
  }, 60_000);

  it("one byte of difference is a different object", async () => {
    const s = await store();
    const base = unique("distinct");

    const a = await s.put(`${base}a`);
    const b = await s.put(`${base}b`);
    expect(a).not.toBe(b);
    expectSameBytes(asBytes(await s.get(a)), encode(`${base}a`));
    expectSameBytes(asBytes(await s.get(b)), encode(`${base}b`));
  }, 60_000);

  it("a digest nothing was written under reads as nothing", async () => {
    const s = await store();
    /* Well-formed and absent. `ContentStore.get` is `string | undefined`, so the answer
       to "we do not have that" is an answer, not an exception a caller has to catch. */
    const missing = `sha256:${"0".repeat(64)}`;

    expect(await s.get(missing)).toBeFalsy();
  }, 60_000);

  it("a malformed digest never resolves to somebody else's object", async () => {
    const s = await store();
    const content = unique("malformed");
    await s.put(content);

    for (const key of ["", "not-a-digest", "sha256:", "../../etc/passwd", "sha256:zzzz"]) {
      const read = await s.get(key).catch(() => undefined);
      if (read !== undefined && read !== null) {
        expect(new TextDecoder().decode(asBytes(read))).not.toBe(content);
      }
    }
  }, 60_000);

  it("a deleted object is gone, and its neighbour is not", async () => {
    const s = await store();
    const doomed = unique("delete-me");
    const keeper = unique("keep-me");

    const a = await s.put(doomed);
    const b = await s.put(keeper);
    await s.delete(a);

    /* Every test in this file leans on delete for teardown, and until the contract
       published it that reliance was silent: a store with no working delete left the whole
       run's objects in the bucket and reported nothing. It is asserted here so the
       teardown rests on something the suite has checked. */
    expect(await s.get(a)).toBeFalsy();
    expectSameBytes(asBytes(await s.get(b)), encode(keeper));
  }, 60_000);
});

describe("T000 AC5 (concurrency) — writes that overlap", () => {
  it("sixteen writers storing the same bytes agree on one key", async () => {
    const s = await store();
    const content = unique("concurrent-same");

    const digests = await Promise.all(Array.from({ length: 16 }, () => s.put(content)));

    expect(new Set(digests).size).toBe(1);
    expectSameBytes(asBytes(await s.get(digests[0])), encode(content));
  }, 120_000);

  it("writers storing different bytes do not overwrite each other", async () => {
    const s = await store();
    const base = unique("concurrent-distinct");
    const contents = Array.from({ length: 12 }, (_, i) => `${base}${i}\n`);

    const digests = await Promise.all(contents.map((c) => s.put(c)));
    expect(new Set(digests).size).toBe(contents.length);

    const read = await Promise.all(digests.map((d) => s.get(d)));
    read.forEach((value, i) => expectSameBytes(asBytes(value), encode(contents[i])));
  }, 120_000);

  it("a read racing its own write returns the whole object or nothing, never half", async () => {
    const s = await store();
    const content = `${unique("read-during-write")}${"x".repeat(200_000)}`;
    /* The address has to be known before `put` resolves, which is what makes the read a
       race at all. Reading it off the engine rests on the test above; if that one is red,
       this one is telling you the same thing twice. */
    const digest = contentDigest(content);

    const [, early, late] = await Promise.all([s.put(content), s.get(digest), s.get(digest)]);

    for (const value of [early, late]) {
      if (value === undefined || value === null) continue;
      /* A truncated read is the failure mode that a length check catches and an
         equality check on a prefix would not. */
      expectSameBytes(asBytes(value), encode(content));
    }
    expectSameBytes(asBytes(await s.get(digest)), encode(content));
  }, 120_000);
});
