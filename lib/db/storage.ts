/* ============================================================
   DarkPrint backend — object storage client
   B-01: bytes live in S3-compatible object storage keyed by
   digest. Both MinIO locally and a hosted S3-compatible bucket
   in production speak the same protocol, so only the endpoint
   changes between them.
   ============================================================ */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface ObjectStorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface ObjectStorage {
  putObject(digest: string, body: Uint8Array | string): Promise<void>;
  /** `undefined` on a missing key, mirroring B-03: absence is a value, not a thrown error. */
  getObject(digest: string): Promise<Uint8Array | undefined>;
  /**
   * S3 answers a DELETE on a key it never held with the same success as one it did —
   * safe here only because `digest` is validated below, so there is no key this can
   * silently no-op on that a caller could mistake for one it just removed.
   */
  deleteObject(digest: string): Promise<void>;
}

/** "sha256:" plus exactly 64 lowercase hex digits — `lib/core/archive/store.ts`'s own shape. */
const DIGEST_SHAPE = /^sha256:[0-9a-f]{64}$/;

/**
 * The one place a digest becomes a storage key, so every verb — put, get, delete —
 * inherits the same validation instead of guarding itself. An empty, malformed or
 * traversal-shaped digest never reaches S3: unvalidated, an empty key answers a GET
 * with a bucket listing, a PUT with MalformedXML, and a DELETE with silent success
 * (D-04) — the last one the worst, because it reports removing something it never
 * touched. Splits "sha256:ab12…" into "sha256/ab12…": a colon is valid in an S3 key
 * but sits on the "needs special handling" list, and the slash gets prefix grouping
 * in a bucket browser for free.
 */
export function keyForDigest(digest: string): string {
  if (!DIGEST_SHAPE.test(digest)) {
    throw new Error(
      `"${digest}" is not a digest — expected "sha256:" followed by 64 lowercase hex digits.`,
    );
  }
  const colon = digest.indexOf(":");
  return `${digest.slice(0, colon)}/${digest.slice(colon + 1)}`;
}

export function objectStorageConfigFromEnv(): ObjectStorageConfig {
  return {
    endpoint: requiredEnv("S3_ENDPOINT"),
    bucket: requiredEnv("S3_BUCKET"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
  };
}

export function createObjectStore(config: ObjectStorageConfig = objectStorageConfigFromEnv()): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region ?? "auto",
    // MinIO, and most non-AWS S3-compatible hosts, serve only path-style requests.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async putObject(digest, body) {
      const key = keyForDigest(digest);
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body }));
    },
    async getObject(digest) {
      const key = keyForDigest(digest);
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!result.Body) return undefined;
        return await result.Body.transformToByteArray();
      } catch (err) {
        if (isNoSuchKey(err)) return undefined;
        throw err;
      }
    },
    async deleteObject(digest) {
      const key = keyForDigest(digest);
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}

function isNoSuchKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "NoSuchKey";
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
