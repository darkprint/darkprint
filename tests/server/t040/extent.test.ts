/* ============================================================
   T040 D-40-I — snapshot the EXTENT, read the CONTENT live

   `SerializeJSONArray` does `len = LengthOfArrayLike(value)` ONCE
   and loops `0..len-1`, calling `Get(value, index)` per iteration.
   `SerializeJSONObject` snapshots via `EnumerableOwnPropertyNames`
   and reads its content live too.

   So the rule is not "snapshot the length". It is: **snapshot
   exactly what the serialiser snapshots, and read live exactly
   what it reads live.** A walk that re-reads `.length` per
   iteration diverges — and so does a walk that fixes that by also
   freezing the elements, which would be a new defect in the other
   direction. The content cells below are the control against it,
   the way `[[BooleanData]]` controls D-40-H.

   ── why these cells cannot live in a corpus ──
   A corpus that builds a value once and reads it three times —
   to partition it, to compute the expected number, and to measure
   it — cannot represent a self-mutating value at all: **each read
   runs the caller's code again and answers differently.** So every
   reading here builds a FRESH value, and the helper below exists
   to make that impossible to forget. This is recorded because the
   obvious response to "the corpus cannot see it" is to add a
   corpus class, and that would produce nonsense rather than a gap.

   ── how "the mutation fired" is checked ──
   Not by re-serialising and comparing. That proxy holds only for a
   mutation both visible on a second pass AND non-idempotent, and
   the shrink fixture here is neither: measured, it renders
   `{"a":1}` twice. What is checked instead is the quantity the
   axis is actually about — **the extent the serialiser emitted
   against the extent the value reaches after the caller's code has
   run** — because a control asserting only that the ruled number
   is under the bound stays true of a fixture that grows by nothing.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { asLoadBundleResult, bind, bindLimitError, returning } from "./contract";
import { EIGHT_NODE_BUNDLE, caseFor, manifestCarrying, type EngineInput } from "./fixtures";

const GENEROUS = { maxBytes: 50_000_000, maxCards: 1_000, maxNodes: 1_000 };

function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (err) {
    return err;
  }
  return undefined;
}

/**
 * Drive the `maxBytes` boundary over a value that answers differently every time it is read.
 *
 * **Four readings, four freshly built submissions.** Reusing one would hand the second reader a
 * value whose caller code had already run, and two readings that ran different amounts of caller
 * code are not two readings of one value.
 */
async function expectMeasuredFresh(build: () => unknown, where: string) {
  const validateBundle = await bind("validateBundle");
  const LimitExceededError = await bindLimitError();
  const submission = (): EngineInput => manifestCarrying(caseFor(EIGHT_NODE_BUNDLE).input, build());

  const expected = Buffer.byteLength(JSON.stringify(submission()), "utf8");

  asLoadBundleResult(
    returning(
      () => validateBundle(submission(), { ...GENEROUS, maxBytes: expected }),
      `${where} at maxBytes ${expected}`,
    ),
    `${where} at maxBytes ${expected}`,
  );

  const err = thrownBy(() => validateBundle(submission(), { ...GENEROUS, maxBytes: expected - 1 }));
  expect(
    err,
    `${where} measures ${expected} bytes under D-40-17's formula. Accepting at ${expected - 1} ` +
      `means the walk measured less than the serialiser would; refusing at ${expected} means it ` +
      `measured more — and an OVER-count refuses a conforming submission, which no test that only ` +
      `checks a refusal would ever notice.`,
  ).toBeInstanceOf(LimitExceededError);

  return expected;
}

/**
 * The anti-vacuity control, measuring the quantity the axis rests on rather than a proxy for it.
 *
 * `emitted` is how many slots the serialiser actually produced; `reached` is what the value's
 * extent becomes once the caller's code has run. For an extent cell these must DIFFER — if they
 * agreed, the fixture would be growing or shrinking by nothing and every assertion above it would
 * hold of a value that never moved.
 */
function extentOf(build: () => unknown[]): { emitted: number; reached: number } {
  const arr = build();
  const emitted = (JSON.parse(JSON.stringify(arr)) as unknown[]).length;
  return { emitted, reached: arr.length };
}

function keysOf(build: () => Record<string, unknown>): { emitted: string[]; reached: string[] } {
  const obj = build();
  const emitted = Object.keys(JSON.parse(JSON.stringify(obj)) as Record<string, unknown>);
  return { emitted, reached: Object.keys(obj) };
}

/* ============================================================
   Extent — the array branch, both directions
   ============================================================ */

describe("D-40-I: an array's extent is read once, at entry", () => {
  /* GROWTH, and it is the direction that matters most: a walk re-reading `.length` measures the
     appended elements, which the serialiser never visited — so it OVER-counts and refuses a
     submission the ruled number accepts. The `maxBytes: expected` half of the pair is what sees
     that, and a suite testing only that oversized things are refused never would. */
  const growingArray = (): unknown[] => {
    const arr: unknown[] = [];
    arr.push({
      toJSON() {
        arr.push("XXXXXXXXXXXXXXXX", "YYYYYYYYYYYYYYYY");
        return 1;
      },
    });
    return arr;
  };

  it("does not measure elements appended while it is being serialised", async () => {
    const { emitted, reached } = extentOf(growingArray);
    expect(emitted, "the serialiser emits the extent it read at entry").toBe(1);
    expect(
      reached,
      "and the array really does grow — a fixture growing by nothing satisfies every assertion " +
        "below while measuring none of them",
    ).toBeGreaterThan(emitted);

    await expectMeasuredFresh(growingArray, "an array that grows during the walk");
  });

  /* SHRINKAGE. The extent stays at what entry read, so the vacated slots are `Get`s that answer
     `undefined` and serialise as `null`. A walk re-reading `.length` stops early and UNDER-counts,
     which is a `maxBytes` bypass. */
  const shrinkingArray = (): unknown[] => {
    const arr: unknown[] = [
      {
        toJSON() {
          arr.length = 1;
          return 1;
        },
      },
      "AAAAAAAAAAAAAAAA",
      "BBBBBBBBBBBBBBBB",
    ];
    return arr;
  };

  it("still measures the slots a shrink vacated, as the nulls they serialise to", async () => {
    const { emitted, reached } = extentOf(shrinkingArray);
    expect(emitted, "three slots emitted, because entry read three").toBe(3);
    expect(reached, "and the array really does shrink").toBeLessThan(emitted);
    expect(
      JSON.stringify(shrinkingArray()),
      "the vacated slots are `null`, not omissions — an array has no holes in JSON",
    ).toBe('[1,null,null]');

    await expectMeasuredFresh(shrinkingArray, "an array that shrinks during the walk");
  });

  /* **A plain GETTER, so this axis is not downstream of D-40-H.** No boxed primitive, no `toJSON`,
     no coercion — just a property that runs caller code when it is read. D-40-H multiplied the
     ways to reach this; it is not the reason it exists. */
  const growingViaGetter = (): unknown[] => {
    const arr: unknown[] = [1];
    Object.defineProperty(arr, 0, {
      configurable: true,
      enumerable: true,
      get() {
        arr.push("XXXXXXXXXXXXXXXX", "YYYYYYYYYYYYYYYY");
        return 1;
      },
    });
    return arr;
  };

  it("holds when the growth comes from a plain getter rather than a coercion", async () => {
    const { emitted, reached } = extentOf(growingViaGetter);
    expect(emitted).toBe(1);
    expect(reached).toBeGreaterThan(emitted);

    await expectMeasuredFresh(growingViaGetter, "an array that grows from a getter");
  });
});

/* ============================================================
   Extent — the object branch, which was already right and is
   therefore the control
   ============================================================ */

describe("D-40-I: an object's key set is snapshotted, which the walk already did", () => {
  /* These two are the control under the three above. If an object's extent moved, "the object
     branch was already correct" would not be the fact the ruling rests on, and the array cells
     would be measuring something other than the array branch. */
  const growingObject = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      a: {
        toJSON() {
          obj.zzz = "NEWNEWNEWNEWNEW";
          return 1;
        },
      },
      b: "keep",
    };
    return obj;
  };

  it("does not measure a key added while it is being serialised", async () => {
    const { emitted, reached } = keysOf(growingObject);
    expect(emitted, "the snapshot's keys, and only those").toEqual(["a", "b"]);
    expect(reached, "and the object really does gain one").toContain("zzz");

    await expectMeasuredFresh(growingObject, "an object that gains a key during the walk");
  });

  const shrinkingObject = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      a: {
        toJSON() {
          delete obj.b;
          return 1;
        },
      },
      b: "gone",
    };
    return obj;
  };

  it("omits a key deleted while it is being serialised, rather than emitting null", async () => {
    const { emitted, reached } = keysOf(shrinkingObject);
    expect(emitted, "`b` is in the snapshot, but Get answers undefined and a key is omitted").toEqual(
      ["a"],
    );
    expect(reached).toEqual(["a"]);

    /* **The proxy this fixture is here to discredit.** "It re-serialises differently" would report
       this mutation as not having fired: it renders identically twice, because the deletion is
       idempotent and its effect is already in the first rendering. Measured, not argued. */
    const once = shrinkingObject();
    expect(JSON.stringify(once)).toBe(JSON.stringify(once));

    await expectMeasuredFresh(shrinkingObject, "an object that loses a key during the walk");
  });

  /* **The KEY SET is snapshotted, not merely its size** — and the two cells above cannot tell
     those apart. Found by a mutation, not by reading: re-reading `Object.keys` per index while
     keeping the snapshotted length reddened nothing against either of them, because a key added
     at the end lands past the loop bound and a key deleted from a two-key object leaves index 1
     answering `undefined` either way. Both are equivalent for those fixtures.

     Three keys, with the MIDDLE one deleted and a new one added, is what separates them.
     Measured: the serialiser emits `{"a":1,"c":"CCCC"}`, while a walk re-reading the key set
     emits `{"a":1,"c":"CCCC","zzz":"ZZZZZZZZZZZZ"}` — the indices shift under it and it reaches a
     key the serialiser never had in hand. */
  const reorderingObject = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {
      a: {
        toJSON() {
          delete obj.b;
          obj.zzz = "ZZZZZZZZZZZZ";
          return 1;
        },
      },
      b: "BBBB",
      c: "CCCC",
    };
    return obj;
  };

  it("uses the keys it snapshotted, not the keys at each index as it goes", async () => {
    const { emitted, reached } = keysOf(reorderingObject);
    expect(emitted, "the snapshot's keys, minus the one whose Get now answers undefined").toEqual([
      "a",
      "c",
    ]);
    expect(reached, "and the key set really does move under it").toEqual(["a", "c", "zzz"]);

    /* The number a walk re-reading the key set would arrive at, computed rather than asserted to
       exist — it reaches `zzz`, which the serialiser never had in hand. */
    const reReading = (() => {
      const obj = reorderingObject();
      const len = Object.keys(obj).length;
      const parts: string[] = [];
      for (let i = 0; i < len; i += 1) {
        const key = Object.keys(obj)[i];
        if (key === undefined) continue;
        const rendered = JSON.stringify(obj[key]);
        if (rendered !== undefined) parts.push(`${JSON.stringify(key)}:${rendered}`);
      }
      return `{${parts.join(",")}}`;
    })();
    expect(reReading).not.toBe(JSON.stringify(reorderingObject()));

    await expectMeasuredFresh(reorderingObject, "an object whose key set moves during the walk");
  });
});

/* ============================================================
   Content — read LIVE, and the control against freezing it
   ============================================================ */

describe("D-40-I: content is read live, which a fix for the extent must not change", () => {
  /* A walk that fixed the extent by snapshotting the elements at entry would pass every cell
     above and fail all five of these. That is the whole reason they are here: the ruling is a
     boundary, and a boundary needs both sides held or the fix drifts across it. */
  const cells: [string, () => unknown][] = [
    [
      "an array element replaced with something longer",
      () => {
        const arr: unknown[] = [
          {
            toJSON() {
              arr[1] = "LONGER-REPLACEMENT-VALUE";
              return 1;
            },
          },
          "short",
        ];
        return arr;
      },
    ],
    [
      "an array element replaced with something shorter",
      () => {
        const arr: unknown[] = [
          {
            toJSON() {
              arr[1] = "s";
              return 1;
            },
          },
          "MUCH-LONGER-ORIGINAL-VALUE",
        ];
        return arr;
      },
    ],
    [
      "an object property replaced during the walk",
      () => {
        const obj: Record<string, unknown> = {
          a: {
            toJSON() {
              obj.b = "REPLACED-WITH-SOMETHING-LONGER";
              return 1;
            },
          },
          b: "x",
        };
        return obj;
      },
    ],
    [
      "an array element replaced with a nested object",
      () => {
        const arr: unknown[] = [
          {
            toJSON() {
              arr[1] = { deep: { deeper: "value" } };
              return 1;
            },
          },
          "x",
        ];
        return arr;
      },
    ],
    /* Extent and content at once: the key stays in the snapshot, so it is still emitted — and its
       value is read live, so what is emitted is the replacement. A walk that froze either half
       gets this one wrong, and it is the only cell that fails under both mistakes. */
    [
      "an object key deleted and re-added with a different value",
      () => {
        const obj: Record<string, unknown> = {
          a: {
            toJSON() {
              delete obj.b;
              obj.b = "READDED-WITH-A-LONGER-VALUE";
              return 1;
            },
          },
          b: "x",
        };
        return obj;
      },
    ],
  ];

  for (const [label, build] of cells) {
    it(`measures ${label} as the serialiser does`, async () => {
      /* The control for a content cell is the mirror of the extent one, and it is COMPUTED: the
         live rendering must differ from what a walk that snapshotted its children at enter would
         produce. `frozenRendering` builds that second number rather than assuming one exists. */
      const live = JSON.stringify(build());
      const frozen = frozenRendering(build());
      expect(
        live,
        "the fixture must actually change its own content, or a walk that froze the elements " +
          "would measure the same number and this cell could not fail",
      ).not.toBe(frozen);

      await expectMeasuredFresh(build, label);
    });
  }
});

/**
 * The rendering a walk that snapshotted its children at enter would produce.
 *
 * Not a guess and not a clone: the elements — or the property values — are captured into a
 * separate container BEFORE anything reads them, and that container is serialised. The caller's
 * code still runs, because it hangs off the same element objects; what it mutates is the original
 * container, which the snapshot no longer refers to. That is exactly the defect this control
 * exists to be able to see, computed rather than described.
 */
function frozenRendering(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...(value as unknown[])]);
  if (value !== null && typeof value === "object") {
    const snapshot: Record<string, unknown> = {};
    const o = value as Record<string, unknown>;
    for (const key of Object.keys(o)) snapshot[key] = o[key];
    return JSON.stringify(snapshot);
  }
  return JSON.stringify(value);
}
