import { describe, expect, it } from "vitest";
import { createObjectStorage, keyForDigest, objectStorageConfigFromEnv } from "./storage";

/** Needs live MinIO (`docker compose up -d`); skips gracefully without one. */
const hasStorage = Boolean(process.env.S3_ENDPOINT);

describe("keyForDigest", () => {
  it("splits the algorithm prefix into a path segment", () => {
    expect(keyForDigest("sha256:ab12cd34")).toBe("sha256/ab12cd34");
  });

  it("passes through a digest with no algorithm prefix unchanged", () => {
    expect(keyForDigest("ab12cd34")).toBe("ab12cd34");
  });
});

describe.skipIf(!hasStorage)("createObjectStorage", () => {
  it("AC5: an object written under a digest reads back byte-identical", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    const key = keyForDigest(`sha256:test-${Date.now()}`);
    const body = new TextEncoder().encode("byte-identical round trip");

    await storage.putObject(key, body);
    const readBack = await storage.getObject(key);

    expect(readBack).toBeDefined();
    expect(Array.from(readBack ?? [])).toEqual(Array.from(body));
  });

  it("returns undefined rather than throwing for a missing key", async () => {
    const storage = createObjectStorage(objectStorageConfigFromEnv());
    const result = await storage.getObject(`sha256/does-not-exist-${Date.now()}`);
    expect(result).toBeUndefined();
  });
});
