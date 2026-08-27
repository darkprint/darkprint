import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENVIRONMENT_VARIABLES, requireEnv } from "./contract";

/* ============================================================
   T000 — the environment contract

   No acceptance criterion covers this, and the goal does: "the
   local infrastructure both branches run against". `backend.md`
   publishes the eight variables so the implementer and this file
   agree without seeing each other, which makes the list itself a
   thing that can drift.

   These fail loudly rather than skip. A suite that stands down when
   the infrastructure is not there reports the same green as one
   that checked something, and every criterion below AC3 needs a
   live Postgres and a live bucket to mean anything. `compose.yaml`
   is in T000's `Owns` set precisely so that "the infrastructure is
   not up" is a fixable instruction and not an excuse.
   ============================================================ */

const root = (name: string): URL => new URL(`../../${name}`, import.meta.url);

describe("T000 — the eight variables both branches read", () => {
  it("every variable in the environment contract is set", () => {
    const missing = ENVIRONMENT_VARIABLES.filter((name) => {
      const value = process.env[name];
      return value === undefined || value === "";
    });

    expect(
      missing,
      "compose.yaml brings up Postgres and MinIO; .env.example names what to export",
    ).toEqual([]);
  });

  it("DATABASE_URL points at Postgres", () => {
    /* `requireEnv` first, so an unset variable reds with the sentence that says what to
       start rather than with `TypeError: Invalid URL`. */
    const url = new URL(requireEnv("DATABASE_URL"));
    expect(["postgres:", "postgresql:"]).toContain(url.protocol);
  });

  it("S3_ENDPOINT is a URL and S3_BUCKET is a bucket name", () => {
    const endpoint = requireEnv("S3_ENDPOINT");
    const bucket = requireEnv("S3_BUCKET");

    expect(() => new URL(endpoint)).not.toThrow();
    /* S3 bucket naming: lowercase letters, digits, hyphens and dots, 3 to 63 characters.
       A bucket name MinIO accepts and S3 refuses would work locally and fail on the host
       B-01 leaves open. */
    expect(bucket).toMatch(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);
  });
});

describe("T000 — the files that describe the infrastructure", () => {
  it("compose.yaml is in the repository", () => {
    expect(existsSync(root("compose.yaml"))).toBe(true);
  });

  it(".env.example names every variable in the contract", () => {
    const example = readFileSync(root(".env.example"), "utf8");

    /* The one place a new contributor learns what to export. A variable the code reads
       and this file omits is a machine that boots into a confusing failure. */
    const absent = ENVIRONMENT_VARIABLES.filter(
      (name) => !new RegExp(`^\\s*(?:#\\s*)?${name}\\s*=`, "m").test(example),
    );
    expect(absent).toEqual([]);
  });

  it(".env.example carries no real secret", () => {
    const example = readFileSync(root(".env.example"), "utf8");

    /* GITHUB_CLIENT_SECRET and SESSION_SECRET are in the contract, so this file names
       them, and a template that ships a working value is a credential in git history. */
    expect(example).not.toMatch(/gh[pousr]_[A-Za-z0-9]{16,}/);
  });
});
