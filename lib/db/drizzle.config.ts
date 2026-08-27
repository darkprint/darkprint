import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` diffs this against the last generated migration, so it
 * is only ever run by hand when `schema.ts` changes — it does not run at build,
 * dev or test time. Config lives beside the schema it reads rather than at the
 * repo root, because `lib/db/**` is this task's whole footprint outside a small,
 * explicitly-carved exception (see `backend.md`, T000's `Forbidden` line).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://darkprint:darkprint@localhost:5432/darkprint",
  },
});
