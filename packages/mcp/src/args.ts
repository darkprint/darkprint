/* ============================================================
   darkprint mcp: reading a tool call's arguments
   Shared by both executors so a missing or malformed argument is
   refused with the same sentence over stdio and over HTTP, before
   any request or query is made.
   ============================================================ */

/** A required string argument. Absent, empty and non-string all refuse the same way. */
export function str(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`\`${key}\` is required and must be a non-empty string.`);
  }
  return value;
}

/** An optional string argument. Absent and empty both answer `undefined`. */
export function optionalStr(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`\`${key}\` must be a string when given.`);
  return value;
}

/** An optional integer argument. A numeric string is accepted, since some clients send one. */
export function optionalInt(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(parsed)) throw new Error(`\`${key}\` must be an integer when given.`);
  return parsed;
}

/** An optional boolean argument. The strings "true" and "false" are accepted for the same reason. */
export function optionalBool(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`\`${key}\` must be a boolean when given.`);
}
