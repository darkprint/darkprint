/* ============================================================
   DarkPrint backend — object storage client
   B-01: bytes live in S3-compatible object storage keyed by
   digest. Both MinIO locally and a hosted S3-compatible bucket
   in production speak the same protocol, so only the endpoint
   changes between them.
   ============================================================ */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface ObjectStorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface ObjectStorage {
  putObject(key: string, body: Uint8Array | string): Promise<void>;
  /** `undefined` on a missing key, mirroring B-03: absence is a value, not a thrown error. */
  getObject(key: string): Promise<Uint8Array | undefined>;
}

/**
 * The one place a digest becomes a storage key, so every caller derives the same
 * key from the same digest. Splits "sha256:ab12…" into "sha256/ab12…" — a colon is
 * valid in an S3 key but sits on the "needs special handling" list, and the slash
 * gets prefix grouping in a bucket browser for free.
 */
export function keyForDigest(digest: string): string {
  const colon = digest.indexOf(":");
  return colon === -1 ? digest : `${digest.slice(0, colon)}/${digest.slice(colon + 1)}`;
}

export function objectStorageConfigFromEnv(): ObjectStorageConfig {
  return {
    endpoint: requiredEnv("S3_ENDPOINT"),
    bucket: requiredEnv("S3_BUCKET"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
  };
}

export function createObjectStorage(config: ObjectStorageConfig = objectStorageConfigFromEnv()): ObjectStorage {
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
    async putObject(key, body) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body }));
    },
    async getObject(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!result.Body) return undefined;
        return await result.Body.transformToByteArray();
      } catch (err) {
        if (isNoSuchKey(err)) return undefined;
        throw err;
      }
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
