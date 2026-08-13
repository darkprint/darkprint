/* ============================================================
   DarkPrint backend — shared object-storage test harness
   ============================================================ */

import { createObjectStorage, type ObjectStorage } from "@/lib/db";
import { testEnv } from "./env";

export function createTestObjectStorage(): ObjectStorage {
  const env = testEnv();
  return createObjectStorage({
    endpoint: env.s3Endpoint,
    bucket: env.s3Bucket,
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  });
}
