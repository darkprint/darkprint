import { describe, expect, it } from "vitest";

import { contentDigest, memoryContentStore, type StoredObject } from "./store";

/** "sha256:" plus exactly 64 lowercase hex digits. */
const DIGEST_SHAPE = /^sha256:[0-9a-f]{64}$/;

describe("contentDigest", () => {
  it("tags the algorithm and emits 64 hex digits", () => {
    expect(contentDigest("anything")).toMatch(DIGEST_SHAPE);
  });

  it.each([
    ["empty string", "", "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "abc", "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ])("matches the published vector for %s", (_name, content, digest) => {
    expect(contentDigest(content)).toBe(digest);
  });

  it("separates content that differs only in whitespace", () => {
    expect(contentDigest("a")).not.toBe(contentDigest("a\n"));
    expect(contentDigest("a b")).not.toBe(contentDigest("a  b"));
  });

  it("hashes multibyte text by its UTF-8 bytes, not its code units", () => {
    const digest = contentDigest("id: solvér-à\nnotes: 🧪 prova");
    expect(digest).toMatch(DIGEST_SHAPE);
    expect(digest).not.toBe(contentDigest("id: solver-a\nnotes: prova"));
  });
});

describe("memoryContentStore — writing", () => {
  it("returns the content address and files the content under it", () => {
    const store = memoryContentStore();
    const digest = store.put("id: solver-a\n");

    expect(digest).toBe(contentDigest("id: solver-a\n"));
    expect(store.get(digest)).toBe("id: solver-a\n");
    expect(store.has(digest)).toBe(true);
  });

  it("is idempotent: the same content twice is one entry", () => {
    const store = memoryContentStore();
    const first = store.put("same");
    const second = store.put("same");

    expect(second).toBe(first);
    expect(store.list()).toEqual([first]);
  });

  it("keeps distinct content at distinct addresses", () => {
    const store = memoryContentStore();
    const a = store.put("card a");
    const b = store.put("card b");

    expect(a).not.toBe(b);
    expect(store.list()).toHaveLength(2);
    expect(store.get(a)).toBe("card a");
    expect(store.get(b)).toBe("card b");
  });

  it("stores the empty string like any other object", () => {
    const store = memoryContentStore();
    const digest = store.put("");

    expect(store.has(digest)).toBe(true);
    expect(store.get(digest)).toBe("");
  });

  it("does not share state between two stores", () => {
    const one = memoryContentStore();
    const two = memoryContentStore();
    const digest = one.put("only in one");

    expect(two.has(digest)).toBe(false);
    expect(two.list()).toEqual([]);
  });
});

describe("memoryContentStore — reading", () => {
  it("reports nothing for a digest it never stored", () => {
    const store = memoryContentStore();
    store.put("present");

    expect(store.get("sha256:" + "0".repeat(64))).toBeUndefined();
    expect(store.has("sha256:" + "0".repeat(64))).toBe(false);
  });

  it.each([
    ["empty digest", ""],
    ["untagged hex", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["the content itself", "present"],
    ["a truncated digest", contentDigest("present").slice(0, 20)],
    ["an uppercased digest", contentDigest("present").toUpperCase()],
  ])("does not resolve %s", (_name, digest) => {
    const store = memoryContentStore();
    store.put("present");

    expect(store.has(digest)).toBe(false);
    expect(store.get(digest)).toBeUndefined();
  });

  it("is empty before anything is written", () => {
    const store = memoryContentStore();

    expect(store.list()).toEqual([]);
    expect(store.get(contentDigest("x"))).toBeUndefined();
    expect(store.has(contentDigest("x"))).toBe(false);
  });
});

describe("memoryContentStore — listing", () => {
  const contents = ["gamma", "alpha", "beta", "delta"];

  it("sorts digests, so insertion order cannot leak into the archive", () => {
    const forwards = memoryContentStore();
    for (const c of contents) forwards.put(c);

    const backwards = memoryContentStore();
    for (const c of [...contents].reverse()) backwards.put(c);

    const expected = contents.map(contentDigest).sort();
    expect(forwards.list()).toEqual(expected);
    expect(backwards.list()).toEqual(forwards.list());
  });

  it("hands out a fresh snapshot each call", () => {
    const store = memoryContentStore();
    store.put("first");
    const snapshot = store.list();

    store.put("second");

    expect(snapshot).toHaveLength(1);
    expect(store.list()).toHaveLength(2);
  });
});

describe("memoryContentStore — seeding", () => {
  const seed: StoredObject[] = [
    { digest: contentDigest("one"), content: "one" },
    { digest: contentDigest("two"), content: "two" },
  ];

  it("rehydrates every object at its address", () => {
    const store = memoryContentStore(seed);

    expect(store.list()).toEqual([contentDigest("one"), contentDigest("two")].sort());
    expect(store.get(contentDigest("two"))).toBe("two");
  });

  it("accepts an empty seed", () => {
    expect(memoryContentStore([]).list()).toEqual([]);
  });

  it("accepts any iterable, not just an array", () => {
    function* generate(): Generator<StoredObject> {
      yield { digest: contentDigest("gen"), content: "gen" };
    }
    expect(memoryContentStore(generate()).list()).toEqual([contentDigest("gen")]);
    expect(memoryContentStore(new Set(seed)).list()).toHaveLength(2);
  });

  it("collapses duplicate content in the seed onto one entry", () => {
    const store = memoryContentStore([
      { digest: contentDigest("dup"), content: "dup" },
      { digest: contentDigest("dup"), content: "dup" },
    ]);

    expect(store.list()).toEqual([contentDigest("dup")]);
  });

  it("re-keys an object whose recorded digest lies about its content", () => {
    // §4: the address is derived, never asserted. A tampered entry does not become
    // readable just because the archive it came from claimed a digest for it.
    const lie = "sha256:" + "f".repeat(64);
    const store = memoryContentStore([{ digest: lie, content: "honest content" }]);

    expect(store.has(lie)).toBe(false);
    expect(store.get(lie)).toBeUndefined();
    expect(store.get(contentDigest("honest content"))).toBe("honest content");
    expect(store.list()).toEqual([contentDigest("honest content")]);
  });

  it("lets a later put find the seeded object instead of duplicating it", () => {
    const store = memoryContentStore(seed);

    expect(store.put("one")).toBe(contentDigest("one"));
    expect(store.list()).toHaveLength(2);
  });
});
