import { describe, expect, it } from "vitest";

import {
  compareSemver,
  compareVersionStrings,
  formatSemver,
  latestVersion,
  parseSemver,
  type Semver,
} from "./semver";

describe("parseSemver — accepts", () => {
  it.each<[string, Semver]>([
    ["0.0.0", { major: 0, minor: 0, patch: 0 }],
    ["1.2.3", { major: 1, minor: 2, patch: 3 }],
    ["10.20.30", { major: 10, minor: 20, patch: 30 }],
    ["1.0.0-rc.1", { major: 1, minor: 0, patch: 0, prerelease: "rc.1" }],
    ["1.0.0-alpha", { major: 1, minor: 0, patch: 0, prerelease: "alpha" }],
    ["1.0.0-0.3.7", { major: 1, minor: 0, patch: 0, prerelease: "0.3.7" }],
    ["1.0.0-x-y-z.--", { major: 1, minor: 0, patch: 0, prerelease: "x-y-z.--" }],
    ["999999.0.0", { major: 999999, minor: 0, patch: 0 }],
  ])("parses %s", (input, expected) => {
    expect(parseSemver(input)).toEqual(expected);
  });

  it("omits the prerelease key entirely when there is none", () => {
    expect(Object.keys(parseSemver("1.2.3") ?? {})).toEqual(["major", "minor", "patch"]);
  });

  it("parses build metadata but drops it — precedence ignores it", () => {
    expect(parseSemver("1.0.0+build.5")).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(parseSemver("1.0.0-rc.1+build.5")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: "rc.1",
    });
  });
});

describe("parseSemver — rejects", () => {
  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["leading space", " 1.0.0"],
    ["trailing space", "1.0.0 "],
    ["newline", "1.0.0\n"],
    ["two components", "1.0"],
    ["one component", "1"],
    ["four components", "1.0.0.0"],
    ["v prefix", "v1.0.0"],
    ["range", "^1.0.0"],
    ["floating", "latest"],
    ["leading zero major", "01.0.0"],
    ["leading zero minor", "1.01.0"],
    ["leading zero patch", "1.0.01"],
    ["negative", "-1.0.0"],
    ["empty prerelease", "1.0.0-"],
    ["leading-zero numeric prerelease identifier", "1.0.0-01"],
    ["empty prerelease identifier", "1.0.0-rc..1"],
    ["illegal prerelease character", "1.0.0-rc_1"],
    ["empty build", "1.0.0+"],
    ["illegal build character", "1.0.0+build_5"],
    ["wildcard", "1.x.0"],
    ["not a version at all", "solver-a"],
  ])("rejects %s", (_name, input) => {
    expect(parseSemver(input)).toBeUndefined();
  });
});

describe("formatSemver", () => {
  it.each(["0.0.0", "1.2.3", "1.0.0-rc.1", "10.20.30-alpha.beta.1"])("round-trips %s", (s) => {
    const parsed = parseSemver(s);
    expect(parsed).toBeDefined();
    expect(formatSemver(parsed ?? { major: 0, minor: 0, patch: 0 })).toBe(s);
  });

  it("drops build metadata on the round trip, as documented", () => {
    expect(formatSemver(parseSemver("1.0.0+build.5") ?? { major: 0, minor: 0, patch: 0 })).toBe(
      "1.0.0",
    );
  });

  it("treats an empty prerelease as absent rather than emitting a trailing dash", () => {
    expect(formatSemver({ major: 1, minor: 0, patch: 0, prerelease: "" })).toBe("1.0.0");
  });
});

/** Ordered oldest → newest; every adjacent pair must compare as "less than". */
const ASCENDING = [
  "0.0.0",
  "0.0.1",
  "0.1.0",
  "0.9.9",
  "1.0.0-alpha",
  "1.0.0-alpha.1",
  "1.0.0-alpha.beta",
  "1.0.0-beta",
  "1.0.0-beta.2",
  "1.0.0-beta.11",
  "1.0.0-rc.1",
  "1.0.0",
  "1.0.1",
  "1.1.0",
  "2.0.0",
  "10.0.0",
];

describe("compareSemver", () => {
  it.each(ASCENDING.slice(0, -1).map((v, i) => [v, ASCENDING[i + 1]]))(
    "orders %s before %s",
    (older, newer) => {
      const a = parseSemver(older);
      const b = parseSemver(newer);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (a === undefined || b === undefined) return;
      expect(compareSemver(a, b)).toBe(-1);
      expect(compareSemver(b, a)).toBe(1);
    },
  );

  it("returns 0 for equal versions", () => {
    const a = parseSemver("1.2.3-rc.1");
    const b = parseSemver("1.2.3-rc.1");
    expect(a && b && compareSemver(a, b)).toBe(0);
  });

  it("returns exactly -1, 0 or 1", () => {
    const a = { major: 1, minor: 0, patch: 0 };
    const b = { major: 9, minor: 0, patch: 0 };
    expect([compareSemver(a, b), compareSemver(b, a), compareSemver(a, a)]).toEqual([-1, 1, 0]);
  });

  it("compares numeric prerelease identifiers numerically, not as text", () => {
    const a = { major: 1, minor: 0, patch: 0, prerelease: "2" };
    const b = { major: 1, minor: 0, patch: 0, prerelease: "11" };
    expect(compareSemver(a, b)).toBe(-1);
  });

  it("compares very long numeric identifiers exactly", () => {
    const big = "9".repeat(30);
    const bigger = `1${"0".repeat(30)}`;
    const a = { major: 1, minor: 0, patch: 0, prerelease: big };
    const b = { major: 1, minor: 0, patch: 0, prerelease: bigger };
    expect(compareSemver(a, b)).toBe(-1);
  });

  it("ranks a numeric identifier below an alphanumeric one", () => {
    const a = { major: 1, minor: 0, patch: 0, prerelease: "1" };
    const b = { major: 1, minor: 0, patch: 0, prerelease: "alpha" };
    expect(compareSemver(a, b)).toBe(-1);
  });

  it("ranks a shorter run of identifiers below a longer one with the same prefix", () => {
    const a = { major: 1, minor: 0, patch: 0, prerelease: "alpha" };
    const b = { major: 1, minor: 0, patch: 0, prerelease: "alpha.1" };
    expect(compareSemver(a, b)).toBe(-1);
  });

  it("lets the major component win over a newer-looking minor", () => {
    const a = { major: 1, minor: 99, patch: 99 };
    const b = { major: 2, minor: 0, patch: 0 };
    expect(compareSemver(a, b)).toBe(-1);
  });

  it("sorts a shuffled list back into order", () => {
    const shuffled = [...ASCENDING].reverse();
    const sorted = shuffled.sort((x, y) => {
      const a = parseSemver(x);
      const b = parseSemver(y);
      return a && b ? compareSemver(a, b) : 0;
    });
    expect(sorted).toEqual(ASCENDING);
  });
});

describe("compareVersionStrings", () => {
  it("orders valid versions", () => {
    expect(compareVersionStrings("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersionStrings("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersionStrings("1.0.0", "1.0.0")).toBe(0);
  });

  it("ignores build metadata, which does not affect precedence", () => {
    expect(compareVersionStrings("1.0.0+a", "1.0.0+b")).toBe(0);
  });

  it("sorts an unparseable version below every valid one", () => {
    expect(compareVersionStrings("latest", "0.0.0")).toBe(-1);
    expect(compareVersionStrings("0.0.0", "latest")).toBe(1);
  });

  it("still totally orders two unparseable versions, so sorting cannot break", () => {
    expect(compareVersionStrings("alpha", "beta")).toBe(-1);
    expect(compareVersionStrings("beta", "alpha")).toBe(1);
    expect(compareVersionStrings("junk", "junk")).toBe(0);
  });

  it("is antisymmetric across a mixed list", () => {
    const list = ["1.0.0", "latest", "0.9.0", "", "2.0.0-rc.1"];
    for (const a of list) {
      for (const b of list) {
        expect(compareVersionStrings(a, b) + compareVersionStrings(b, a)).toBe(0);
      }
    }
  });
});

describe("latestVersion", () => {
  it("returns the highest version", () => {
    expect(latestVersion(["1.0.0", "1.2.0", "1.1.9"])).toBe("1.2.0");
  });

  it("prefers a release over its prereleases", () => {
    expect(latestVersion(["2.0.0-rc.1", "2.0.0", "2.0.0-rc.2"])).toBe("2.0.0");
  });

  it("returns the only version when there is one", () => {
    expect(latestVersion(["0.0.1"])).toBe("0.0.1");
  });

  it("returns undefined for an empty list", () => {
    expect(latestVersion([])).toBeUndefined();
  });

  it("ignores unparseable entries", () => {
    expect(latestVersion(["latest", "1.0.0", "v2.0.0"])).toBe("1.0.0");
  });

  it("returns undefined when nothing in the list is a version", () => {
    expect(latestVersion(["latest", "", "v2.0.0"])).toBeUndefined();
  });

  it("keeps the first occurrence of a duplicated highest version", () => {
    const versions = ["1.0.0", "1.0.0+build.1"];
    expect(latestVersion(versions)).toBe("1.0.0");
  });

  it("does not depend on input order", () => {
    expect(latestVersion(["1.0.0", "10.0.0", "2.0.0"])).toBe("10.0.0");
    expect(latestVersion(["10.0.0", "2.0.0", "1.0.0"])).toBe("10.0.0");
  });

  it("does not mutate its input", () => {
    const versions = ["2.0.0", "1.0.0"];
    latestVersion(versions);
    expect(versions).toEqual(["2.0.0", "1.0.0"]);
  });
});
