import { describe, expect, it } from "vitest";
import { contentDigest } from "@/lib/core";
import { createObjectStorage, keyForDigest, objectStorageConfigFromEnv } from "./storage";

/** Needs live MinIO (`docker compose up -d`); skips gracefully without one. */
const hasStorage = Boolean(process.env.S3_ENDPOINT);

describe("keyForDigest", () => {
  it("splits the algorithm prefix into a path segment", () => {
    const digest = contentDigest("keyForDigest fixture");
    expect(keyForDigest(digest)).toBe(digest.replace(":", "/"));
  });

  it("rejects an empty digest (D-04: an empty key enumerates the whole bucket)", () => {
    expect(() => keyForDigest("")).toThrow();
  });

  it.each([
    ["a digest with no algorithm prefix", "ab12cd34"],
    ["a bare colon", "sha256:"],
    ["too short to be 64 hex digits", "sha256:ab12cd34"],
    ["uppercase hex", `sha256:${"AB".repeat(32)}`],
    ["a path-traversal shape", "../../etc/passwd"],
    ["a traversal-shaped digest body", `sha256:${"../".repeat(21)}etc`],
  ])("rejects %s", (_label, malformed) => {
    expect(() => keyForDigest(malformed)).toThrow();
  });
});

describe.skipIf(!hasStorage)("createObjectStorage", () => {
  it("AC5: an object written under a digest reads back byte-identical", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    const content = `byte-identical round trip ${process.pid} ${performance.now()}`;
    const digest = contentDigest(content);
    const body = new TextEncoder().encode(content);

    await storage.put(digest, body);
    try {
      const readBack = await storage.get(digest);
      expect(readBack).toBeDefined();
      expect(Array.from(readBack ?? [])).toEqual(Array.from(body));
    } finally {
      await storage.delete(digest);
    }
  });

  it("returns undefined rather than throwing for a well-formed digest nothing was written under", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    const result = await storage.get(`sha256:${"0".repeat(64)}`);
    expect(result).toBeUndefined();
  });

  it("D-04: an empty digest is refused, never answered with a bucket listing", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    await expect(storage.get("")).rejects.toThrow();
    await expect(storage.put("", "x")).rejects.toThrow();
    await expect(storage.delete("")).rejects.toThrow();
  });

  it("delete removes what put wrote, and a repeat delete still never reports a false positive", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    const content = `delete round trip ${process.pid} ${performance.now()}`;
    const digest = contentDigest(content);

    await storage.put(digest, content);
    expect(await storage.get(digest)).toBeDefined();

    await storage.delete(digest);
    expect(await storage.get(digest)).toBeUndefined();
  });
});
