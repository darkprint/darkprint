import { describe, expect, it } from "vitest";

import { sha256Hex } from "./sha256";

/**
 * Every expectation here is a known-answer vector produced by an independent
 * SHA-256 (the FIPS 180-4 examples, plus digests taken from a reference
 * implementation). Nothing is compared against this module's own output.
 */

describe("sha256Hex — standard vectors", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      // FIPS 180-4 two-block example — 56 bytes, so the length field forces a second block.
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
    ],
  ])("hashes %j", (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });

  it("is 64 lowercase hex characters", () => {
    expect(sha256Hex("anything")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across calls (no shared mutable state between invocations)", () => {
    const first = sha256Hex("abc");
    sha256Hex("a".repeat(200));
    expect(sha256Hex("abc")).toBe(first);
  });
});

describe("sha256Hex — padding boundaries", () => {
  // 55 is the last length that fits in one block; 56–63 spill into a second one;
  // 64 and 128 land exactly on a block boundary and still need a whole extra block.
  it.each([
    [55, "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318"],
    [56, "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"],
    [57, "f13b2d724659eb3bf47f2dd6af1accc87b81f09f59f2b75e5c0bed6589dfe8c6"],
    [63, "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34"],
    [64, "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"],
    [65, "635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0"],
    [119, "31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb"],
    [127, "c57e9278af78fa3cab38667bef4ce29d783787a2f731d4e12200270f0c32320a"],
    [128, "6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e"],
  ])("hashes %i repeated 'a'", (n, expected) => {
    expect(sha256Hex("a".repeat(n))).toBe(expected);
  });

  it("hashes a long input", () => {
    expect(sha256Hex("a".repeat(1000))).toBe(
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });
});

describe("sha256Hex — UTF-8 encoding", () => {
  it.each([
    ["naïve", "f86fd89de87a848a45bfe77708d91a5d2ff48b8e4a4b98af5165af82692f8928"],
    ["😀", "f0443a342c5ef54783a111b51ba56c938e474c32324d90c3a60c9c8e3a37e2d9"],
    ["a😀b", "6fba5b2ea783ded096fc2444d540ffbdf49168df30993b155b7efb683313f110"],
    ["café ☕ 😀 naïve åäö", "eefe2c3bb36e414bfd28b69e266a17543e5db508dba93b59b26c7c7a439ddb65"],
  ])("hashes %s as UTF-8", (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });

  it("agrees with the explicit UTF-8 bytes of a 4-byte code point", () => {
    // U+1F600 is F0 9F 98 80.
    expect(sha256Hex("😀")).toBe(sha256Hex(new Uint8Array([0xf0, 0x9f, 0x98, 0x80])));
  });

  it("agrees with the explicit UTF-8 bytes of a 2-byte code point", () => {
    // "é" is C3 A9.
    expect(sha256Hex("é")).toBe(sha256Hex(new Uint8Array([0xc3, 0xa9])));
  });

  it("does not truncate to Latin-1: a multibyte string differs from its ASCII skeleton", () => {
    expect(sha256Hex("naïve")).not.toBe(sha256Hex("naive"));
  });

  it.each([
    ["lone high surrogate", "\ud800"],
    ["lone low surrogate", "\udfff"],
    ["the replacement character itself", "�"],
  ])("encodes %s as U+FFFD", (_name, input) => {
    expect(sha256Hex(input)).toBe(
      "83d544ccc223c057d2bf80d3f2a32982c32c3c0db8e2674820da5064783fb097",
    );
  });

  it("keeps a valid surrogate pair distinct from two replacement characters", () => {
    expect(sha256Hex("😀")).not.toBe(sha256Hex("��"));
  });
});

describe("sha256Hex — byte input", () => {
  it("hashes bytes that are not valid UTF-8", () => {
    expect(sha256Hex(new Uint8Array([0xff, 0x00, 0x80]))).toBe(
      "ef192b7af54e943f206ab27075ec1805384c972c9959fc5820f1fa7d5268fcef",
    );
  });

  it("hashes every byte value", () => {
    const all = Uint8Array.from({ length: 256 }, (_v, i) => i);
    expect(sha256Hex(all)).toBe(
      "40aff2e9d2d8922e47afd4648e6967497158785fbd1da870e7110266bf944880",
    );
  });

  it("treats an empty byte array like an empty string", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(sha256Hex(""));
  });

  it("does not mutate its input", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    sha256Hex(bytes);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("hashes a subarray view by its own contents, not the backing buffer", () => {
    const backing = new Uint8Array([9, 9, 1, 2, 3, 9, 9]);
    expect(sha256Hex(backing.subarray(2, 5))).toBe(sha256Hex(new Uint8Array([1, 2, 3])));
  });
});

describe("sha256Hex — avalanche", () => {
  it("changes completely for a one-bit difference", () => {
    const a = sha256Hex("darkprint");
    const b = sha256Hex("darkprinu");
    expect(a).not.toBe(b);
    const shared = [...a].filter((ch, i) => ch === b[i]).length;
    expect(shared).toBeLessThan(32);
  });

  it("is order sensitive", () => {
    expect(sha256Hex("ab")).not.toBe(sha256Hex("ba"));
  });
});
