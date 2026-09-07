/* ============================================================
   DarkPrint backend — test environment
   Reads T000's environment contract so a scratch
   test in an implementer worktree fails with a clear reason —
   "start compose" — rather than an unrelated stack trace when the
   local infrastructure is not running.

   Originally "not for `tests/server/**`": that tree is written
   blind, in a worktree branched before this file existed, so an
   import of it would have produced a broken test rather than a
   red one. That ground went away
   when T000 merged at `ec516fa` — every branch cut from `backend`
   since carries this file, so a blind suite importing it is doing
   a real import. Blind suites from T020 onward may use it. T000's
   and T060's predate the merge and each explain, in their own
   `contract.ts`, why they read nothing from here.
   ============================================================ */

export interface TestEnv {
  databaseUrl: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
}

export function testEnv(): TestEnv {
  return {
    databaseUrl: requiredEnv("DATABASE_URL"),
    s3Endpoint: requiredEnv("S3_ENDPOINT"),
    s3Bucket: requiredEnv("S3_BUCKET"),
    s3AccessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    s3SecretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`docker compose up -d\` and export the variables in .env.example first.`,
    );
  }
  return value;
}
