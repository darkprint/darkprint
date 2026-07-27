/* ============================================================
   DarkPrint core — semantic versions
   Design doc §4: a published card is never edited in place, so
   every card carries a semver and every DOT reference pins one
   exactly. This is the parse/compare half. Engine spec §6.
   ============================================================ */

/**
 * The official semver.org grammar: no "v" prefix, no leading zeros, no surrounding
 * whitespace. Build metadata is captured only so that a version carrying it still
 * parses — it is then dropped, because semver precedence ignores it.
 */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** A prerelease identifier made only of digits compares numerically, not as text. */
const NUMERIC_IDENTIFIER = /^\d+$/;

/** A parsed version. Build metadata is deliberately absent: it never affects precedence. */
export interface Semver {
  major: number;
  minor: number;
  patch: number;
  /** Everything after the "-", without the dash: "rc.1". Absent when there is none. */
  prerelease?: string;
}

/** Code-unit order — never `localeCompare`, which would make sorting host dependent. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Strict parse. Returns `undefined` for anything that is not a plain "1.2.3" —
 * "v1.0.0", "1.0", "latest", "01.0.0" and " 1.0.0 " all fail, which is what makes
 * `card/bad-version` and §4's "pin the exact version" checkable.
 *
 * Lossy by design: "1.0.0+build.5" parses, but the build metadata is discarded, so
 * `formatSemver(parseSemver(s))` is not always `s`.
 */
export function parseSemver(s: string): Semver | undefined {
  const m = SEMVER.exec(s);
  if (m === null) return undefined;
  const version: Semver = {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
  // Omitted rather than set to undefined, so two equal versions compare equal
  // structurally as well as through compareSemver.
  if (m[4] !== undefined) version.prerelease = m[4];
  return version;
}

/** Render a version back to text. A plain join: it does not validate its input. */
export function formatSemver(v: Semver): string {
  const core = `${v.major}.${v.minor}.${v.patch}`;
  return v.prerelease ? `${core}-${v.prerelease}` : core;
}

/** Compare two all-digit identifiers exactly, without going through Number (they can be long). */
function compareNumericIdentifier(a: string, b: string): number {
  const x = a.replace(/^0+(?=\d)/, "");
  const y = b.replace(/^0+(?=\d)/, "");
  if (x.length !== y.length) return x.length < y.length ? -1 : 1;
  return byCodeUnit(x, y);
}

/**
 * Semver §11: a version with a prerelease is lower than the same version without
 * one; identifiers compare left to right; all-numeric identifiers compare
 * numerically and rank below alphanumeric ones; a shorter run of identifiers is
 * lower when everything before it is equal.
 */
function comparePrerelease(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;

  const left = a.split(".");
  const right = b.split(".");
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const x = left[i];
    const y = right[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNumeric = NUMERIC_IDENTIFIER.test(x);
    const yNumeric = NUMERIC_IDENTIFIER.test(y);
    if (xNumeric && yNumeric) {
      const c = compareNumericIdentifier(x, y);
      if (c !== 0) return c;
    } else if (xNumeric) {
      return -1;
    } else if (yNumeric) {
      return 1;
    } else {
      const c = byCodeUnit(x, y);
      if (c !== 0) return c;
    }
  }
  return 0;
}

/** -1 when `a` is older, 0 when equal, 1 when `a` is newer. */
export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease ?? "", b.prerelease ?? "");
}

/**
 * Same ordering over raw strings. Unparseable versions sort below every valid one
 * and among themselves by code unit, so `sort` stays a total order and a malformed
 * version in the registry can never crash a listing.
 */
export function compareVersionStrings(a: string, b: string): number {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (va !== undefined && vb !== undefined) return compareSemver(va, vb);
  if (va !== undefined) return 1;
  if (vb !== undefined) return -1;
  return byCodeUnit(a, b);
}

/**
 * The newest valid version in the list, or `undefined` when there is none.
 * Unparseable entries are ignored rather than returned; ties keep the first
 * occurrence, so a duplicated version does not shuffle.
 */
export function latestVersion(versions: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestParsed: Semver | undefined;
  for (const candidate of versions) {
    const parsed = parseSemver(candidate);
    if (parsed === undefined) continue;
    if (bestParsed === undefined || compareSemver(parsed, bestParsed) > 0) {
      best = candidate;
      bestParsed = parsed;
    }
  }
  return best;
}
