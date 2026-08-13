/* ============================================================
   DarkPrint backend — test environment
   Reads T000's environment contract (backend.md) so a scratch
   test in an implementer worktree fails with a clear reason —
   "start compose" — rather than an unrelated stack trace when the
   local infrastructure is not running.

   Not for `tests/server/**`: that tree is written blind, in a
   worktree branched before this file exists, and its own tests
   must read these variables directly rather than import this
   module (docs/ORCHESTRATION.md, Agent B). This is for the
   implementer worktrees that come after T000.
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
