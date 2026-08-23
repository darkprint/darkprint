/* ============================================================
   T200 AC1 — "every listed query key filters, and an unknown key
   is ignored rather than erroring"

   ── why every key gets a DISAGREEING control ──
   The second half of AC1 is a negative, and a negative is
   satisfied by writing nothing: "an unknown key is ignored"
   passes against a function that ignores EVERY key, answers the
   whole shelf to every query, and filters nothing at all. So each
   key is asserted twice over — once that it NARROWS to a set that
   is neither empty nor everything, and once that an unknown key
   beside it changes nothing — and a third time in the shape
   neither of those two catches:

       {tag: T, <unknown>: "x"}  ===  {tag: T}

   That cell is the load-bearing one. A module that ignores every
   key passes "the unknown key was ignored" and passes "an unknown
   key alone equals no keys", and fails only here, because here
   the known key still has to be honoured while the unknown one is
   dropped. A module that 400s on an unknown key fails it from the
   other side.

   ── `sort` is exempt, and that is a ruling rather than a mercy ──
   D-200-19: `sort` ORDERS; it cannot filter, and no implementation
   could make it. AC1's real content for `sort` is the other half
   of the same sentence — an unrecognised VALUE is ignored rather
   than erroring — which is the shared-link protection the whole
   criterion exists for. A cell reading "every listed query key
   filters" literally would red a correct module on `sort`.

   ── the actor ──
   Anonymous throughout. D-200-07 makes `actor` an accepted-and-
   deliberately-unused parameter, and AC4's own file is where the
   three kinds are proved to agree; using one kind here keeps a
   filter red from being ambiguous with a visibility red.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FACET_KEYS,
  PARAMS,
  SORT_VALUES,
  fingerprint,
  itemKey,
  search,
  type PublishedName,
} from "./contract";
import {
  anonymous,
  dropScratchDatabases,
  mark,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";
import { buildWorld, type World } from "./world";

let s: Scratch;
let w: World;
const setup = recordedSetup("the T200 public world");

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    w = await buildWorld(s);
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

/** The keys of the hits, in the order they came back. */
async function keys(
  name: "searchBlueprints" | "searchCards",
  params: Record<string, string>,
): Promise<string[]> {
  const results = await search(name, s.db, anonymous, params);
  return results.hits.map((hit) => itemKey(hit.item));
}

function blueprintKey(handle: string, slug: string): string {
  return `blueprint:${handle}/${slug}`;
}

/* --------------------- the blueprint keys --------------------- */

describe("AC1 every key on /blueprints narrows", () => {
  it("`q` narrows to the blueprints carrying the token", async () => {
    setup.check();
    const all = await keys("searchBlueprints", {});
    const hit = await keys("searchBlueprints", { q: w.queryToken });
    const expected = [
      blueprintKey(w.alpha.handle, w.s1.bundle.slug),
      blueprintKey(w.alpha.handle, w.s2.bundle.slug),
      blueprintKey(w.alpha.handle, w.s3.bundle.slug),
    ];
    /* Both halves, and the first is what stops the second being vacuous: a module that
       answered nothing would satisfy "the fourth blueprint is absent" for free. */
    expect(
      [...hit].sort(),
      `AC1 \`q\` did not narrow. The whole shelf is ${all.length} blueprints and ` +
        `\`q=<token>\` answered ${hit.length}. The token is in s1's title, s2's title and ` +
        `s3's summary, and in nothing else that exists in this database.`,
    ).toEqual([...expected].sort());
    expect(hit.length, "the fourth blueprint carries the token nowhere").toBeLessThan(all.length);
  });

  it("`q` narrows to exactly one when the token is in exactly one", async () => {
    setup.check();
    const hit = await keys("searchBlueprints", { q: w.soloToken });
    expect(
      hit,
      `AC1 \`q=<token in s2's summary alone>\` answered ${JSON.stringify(hit)}. One blueprint ` +
        `carries this token and three do not.`,
    ).toEqual([blueprintKey(w.alpha.handle, w.s2.bundle.slug)]);
  });

  it("`tag` narrows to the blueprints carrying the tag", async () => {
    setup.check();
    const all = await keys("searchBlueprints", {});
    const hit = await keys("searchBlueprints", { tag: w.tagA });
    expect([...hit].sort(), `AC1 \`tag\` did not narrow; the shelf is ${all.length}.`).toEqual(
      [
        blueprintKey(w.alpha.handle, w.s1.bundle.slug),
        blueprintKey(w.alpha.handle, w.s3.bundle.slug),
      ].sort(),
    );
  });

  it("`cat` narrows to the blueprints in the category", async () => {
    setup.check();
    const hit = await keys("searchBlueprints", { cat: w.catB });
    expect([...hit].sort(), "AC1 `cat` did not narrow.").toEqual(
      [
        blueprintKey(w.alpha.handle, w.s2.bundle.slug),
        blueprintKey(w.beta.handle, w.s4.bundle.slug),
      ].sort(),
    );
  });

  it("`phase` narrows to the blueprints covering the phase", async () => {
    setup.check();
    const hit = await keys("searchBlueprints", { phase: "testing" });
    expect(
      hit,
      "AC1 `phase` did not narrow. One blueprint's release covers `testing` — in its stored " +
        "`phase_coverage.covered` and in its pinned card's `phases` alike, so the filter " +
        "reaches the same answer from either source.",
    ).toEqual([blueprintKey(w.alpha.handle, w.s3.bundle.slug)]);
  });

  it("`autonomy` narrows to the blueprints in the class", async () => {
    setup.check();
    const hit = await keys("searchBlueprints", { autonomy: "closed-loop" });
    expect(
      hit,
      "AC1 `autonomy` did not narrow. Autonomy is a FILTER and never a sort key (doc 2 " +
        "§1.1), and this cell is the half of that sentence which says the filter has to work.",
    ).toEqual([blueprintKey(w.alpha.handle, w.s3.bundle.slug)]);
  });

  it("`df=1` narrows to the dark factories", async () => {
    setup.check();
    const hit = await keys("searchBlueprints", { df: "1" });
    expect(hit, "AC1 `df=1` did not narrow. One release stores `isDarkFactory: true`.").toEqual([
      blueprintKey(w.alpha.handle, w.s3.bundle.slug),
    ]);
  });

  it("`forks=rolled` is the default, so it answers what no `forks` answers", async () => {
    setup.check();
    const bare = fingerprint(await search("searchBlueprints", s.db, anonymous, {}));
    const rolled = fingerprint(await search("searchBlueprints", s.db, anonymous, { forks: "rolled" }));
    expect(
      rolled,
      "`components/gallery/GalleryBrowser.tsx` reads `params.get(\"forks\") ?? \"rolled\"`, so " +
        "`rolled` and an absent `forks` are the same instruction and a shared link carrying " +
        "either must render the same shelf.\n" +
        "  Inferred from the merged UI rather than from the contract, which names the key and " +
        "not its default — the same label D-200-19 ratified for the `=1` flags.",
    ).toEqual(bare);
  });

  it("`forks=all` includes the published fork and `forks=originals` excludes it", async () => {
    setup.check();
    const all = await keys("searchBlueprints", { forks: "all" });
    const originals = await keys("searchBlueprints", { forks: "originals" });
    const fork = blueprintKey(w.beta.handle, w.s4.bundle.slug);
    expect(all, "AC1 `forks=all` must leave every tile standing.").toContain(fork);
    expect(
      originals,
      "AC1 `forks=originals` hides a blueprint that is itself a published fork of another. " +
        "s4's `bundle.lineage_owner_id`/`lineage_slug` point at s1.",
    ).not.toContain(fork);
    /* The disagreeing control: `originals` must not have emptied the shelf. */
    expect(originals.length, "`forks=originals` answered nothing at all").toBeGreaterThan(0);
  });
});

/* --------------------- the card keys --------------------- */

describe("AC1 every key on /cards narrows", () => {
  it("`q` narrows to the card carrying the token", async () => {
    setup.check();
    const all = await keys("searchCards", {});
    const hit = await keys("searchCards", { q: w.cardTest.cardId });
    expect(hit, `AC1 \`q\` did not narrow on cards; the shelf is ${all.length}.`).toEqual([
      `card:${w.cardTest.ref}`,
    ]);
    expect(all.length, "the card shelf is empty, so `q` narrowing it proves nothing").toBeGreaterThan(1);
  });

  it("`type` narrows to the cards of that node type", async () => {
    setup.check();
    const hit = await keys("searchCards", { type: "tool" });
    expect(hit, "AC1 `type` did not narrow. One of the three cards declares `type: tool`.").toEqual([
      `card:${w.cardImpl.ref}`,
    ]);
  });

  it("`phase` narrows to the cards declaring the phase", async () => {
    setup.check();
    const hit = await keys("searchCards", { phase: "implementation" });
    expect(hit, "AC1 `phase` did not narrow on cards.").toEqual([`card:${w.cardImpl.ref}`]);
  });

  it("`human=1` narrows to the cards where a person acts", async () => {
    setup.check();
    const hit = await keys("searchCards", { human: "1" });
    expect(
      hit,
      "AC1 `human=1` did not narrow. One of the three cards carries `requiresHuman: true`.",
    ).toEqual([`card:${w.cardImpl.ref}`]);
  });

  it("`risk=1` narrows to the cards carrying a risk marker", async () => {
    setup.check();
    const hit = await keys("searchCards", { risk: "1" });
    expect(
      hit,
      "AC1 `risk=1` did not narrow. One of the three cards carries a non-empty `riskMarkers`.",
    ).toEqual([`card:${w.cardTest.ref}`]);
  });
});

/* --------------------- an unknown key --------------------- */

describe("AC1 an unknown key is ignored rather than erroring", () => {
  for (const name of ["searchBlueprints", "searchCards"] as const) {
    it(`\`${name}\` answers an unknown key exactly as it answers no keys`, async () => {
      setup.check();
      const unknown = mark("zz-nobody-knows-this-key");
      const bare = fingerprint(await search(name, s.db, anonymous, {}));
      const withUnknown = fingerprint(await search(name, s.db, anonymous, { [unknown]: "x" }));
      expect(
        withUnknown,
        `AC1: an unknown key must be IGNORED. \`${name}\` answered differently with ` +
          `\`${unknown}=x\` than with no parameters at all.\n` +
          `  Compared on the hit keys IN ORDER, the facet map and \`ordered\` — order ` +
          `included on purpose, because a shelf that reorders itself on a key nobody sent ` +
          `is a shared link rendering differently, which is the breakage this criterion ` +
          `protects against.`,
      ).toEqual(bare);
    });

    it(`\`${name}\` honours a known key WHILE ignoring an unknown one`, async () => {
      setup.check();
      const unknown = mark("zz-nobody-knows-this-key");
      const known: Record<string, string> =
        name === "searchBlueprints" ? { tag: w.tagA } : { type: "tool" };
      const filtered = fingerprint(await search(name, s.db, anonymous, known));
      const both = fingerprint(
        await search(name, s.db, anonymous, { ...known, [unknown]: "x" }),
      );

      /* The disagreeing control, and the reason this cell exists. A function that ignores
         EVERY key passes both cells above: an unknown key alone equals no keys, and it
         never errors. It fails here, because here the known key still has to narrow while
         the unknown one is dropped. */
      expect(
        filtered.keys.length,
        `the control failed before the criterion could be measured: \`${JSON.stringify(known)}\` ` +
          `narrowed to nothing, so "adding an unknown key changes nothing" would be true of ` +
          `a module that answers nothing to everything.`,
      ).toBeGreaterThan(0);
      const all = fingerprint(await search(name, s.db, anonymous, {}));
      expect(
        filtered.keys.length,
        `the control failed: \`${JSON.stringify(known)}\` answered the whole shelf, so this ` +
          `cell cannot tell an ignored unknown key from a module that ignores every key.`,
      ).toBeLessThan(all.keys.length);

      expect(
        both,
        `AC1: \`${name}({...known, ${unknown}: "x"})\` must equal \`${name}(known)\`. This is ` +
          `the cell a module that ignores every key fails, and the one a module that 400s on ` +
          `an unknown key fails from the other side.`,
      ).toEqual(filtered);
    });

    it(`\`${name}\` treats a key that merely LOOKS like a published one as unknown`, async () => {
      setup.check();
      const bare = fingerprint(await search(name, s.db, anonymous, {}));
      /* Plurals and near-misses of real keys, which is what a `startsWith` or a substring
         parser would swallow. `tags` against `tag`, `sortt` against `sort`. */
      const nearMisses: Record<string, string> =
        name === "searchBlueprints"
          ? { tags: w.tagA, qq: w.queryToken, sortt: "slug" }
          : { types: "tool", qq: w.cardTest.cardId, phases: "implementation" };
      const answered = fingerprint(await search(name, s.db, anonymous, nearMisses));
      expect(
        answered,
        `AC1: ${JSON.stringify(Object.keys(nearMisses))} are not published keys — the set is ` +
          `${JSON.stringify(PARAMS[name])} — so they must be ignored, and ignoring them means ` +
          `answering the whole shelf. A parser matching on a prefix or a substring narrows ` +
          `here instead, and every value handed in IS a real value of the key it resembles, ` +
          `so a loose match cannot answer the shelf by accident.`,
      ).toEqual(bare);
    });
  }
});

/* --------------------- an unknown VALUE for a known key --------------------- */

describe("AC1 an unknown value for a known key answers empty rather than erroring", () => {
  const CASES = [
    { name: "searchBlueprints" as const, params: () => ({ tag: mark("no-such-tag") }) },
    { name: "searchBlueprints" as const, params: () => ({ cat: mark("no-such-category") }) },
    { name: "searchBlueprints" as const, params: () => ({ phase: mark("no-such-phase") }) },
    { name: "searchBlueprints" as const, params: () => ({ autonomy: mark("no-such-class") }) },
    { name: "searchCards" as const, params: () => ({ type: mark("no-such-type") }) },
    { name: "searchCards" as const, params: () => ({ phase: mark("no-such-phase") }) },
  ];

  for (const c of CASES) {
    const key = Object.keys(c.params())[0];
    it(`\`${c.name}\` answers \`${key}=<a value nothing has>\` with an empty hit set`, async () => {
      setup.check();
      const params = c.params();
      const results = await search(c.name, s.db, anonymous, params);
      expect(
        results.hits.map((h) => itemKey(h.item)),
        `AC1: \`${key}\` carries a value nothing in the database has, so the answer is an ` +
          `empty result and not an error. \`cardsByPhase\`'s docblock records the same rule ` +
          `one layer down (D-200-04): there is no branch where a known key answers \`[]\` ` +
          `and an unknown one answers something else.`,
      ).toEqual([]);
      /* AC3 rides along here rather than waiting for its own file, because this is the
         exact state the criterion names: an empty result is where the vocabularies matter
         most, and a facet map derived from the hit set is empty precisely here. */
      const facetKeys = Object.keys(results.facets).sort();
      expect(
        facetKeys,
        `AC3: an empty result still returns the facet vocabularies. D-200-18 keys them by ` +
          `the URL PARAMETER names.`,
      ).toEqual([...FACET_KEYS[c.name]].sort());
    });
  }
});

/* --------------------- an empty value, which a live URL really carries --------------------- */

describe("AC1 an empty value is the key being absent, not an error", () => {
  const CASES: readonly { name: PublishedName; params: Record<string, string> }[] = [
    { name: "searchBlueprints", params: { q: "" } },
    { name: "searchBlueprints", params: { tag: "" } },
    { name: "searchBlueprints", params: { q: "", tag: "", cat: "", phase: "" } },
    { name: "searchCards", params: { q: "" } },
    { name: "searchTerms", params: { q: "", kind: "", origin: "" } },
  ];

  for (const c of CASES) {
    it(`\`${c.name}\` answers ${JSON.stringify(c.params)} as it answers no parameters`, async () => {
      setup.check();
      const bare = fingerprint(await search(c.name, s.db, anonymous, {}));
      const blank = fingerprint(await search(c.name, s.db, anonymous, c.params));
      expect(
        blank,
        `AC1 protects shared links, and \`?q=&tag=\` is a link a filter panel produces the ` +
          `moment a reader clears a field — \`useQueryState\` writes the key before it ` +
          `removes it. An empty value is the filter being off.\n` +
          `  The merged readers spell it \`if (q)\` and \`if (category && …)\` ` +
          `(components/gallery/GalleryBrowser.tsx), and \`lib/core/archive/registry.ts\` says ` +
          `it in a comment: "an empty query is a substring of everything, so it filters ` +
          `nothing".\n` +
          `  Inferred from the merged readers rather than from the contract, and labelled as ` +
          `such so a disagreement is about a stated reading rather than a surprise.`,
      ).toEqual(bare);
    });
  }
});

/* --------------------- the flag values --------------------- */

describe("AC1 the `=1` flags are off for any other value", () => {
  const CASES = [
    { name: "searchBlueprints" as const, key: "df" },
    { name: "searchCards" as const, key: "human" },
    { name: "searchCards" as const, key: "risk" },
  ];

  for (const c of CASES) {
    it(`\`${c.name}\` treats \`${c.key}=0\` as off`, async () => {
      setup.check();
      const bare = fingerprint(await search(c.name, s.db, anonymous, {}));
      const off = fingerprint(await search(c.name, s.db, anonymous, { [c.key]: "0" }));
      expect(
        off,
        `\`${c.key}\` is published as \`${c.key}=1\`, and the live readers spell that ` +
          `\`params.get(k) === "1"\` (\`components/gallery/GalleryBrowser.tsx\`, ` +
          `\`components/nodes/NodeBrowser.tsx\`), so anything else is OFF rather than an ` +
          `error.\n` +
          `  This reading is inferred from the merged UI rather than from the contract, and ` +
          `is ratified as such by D-200-19. It is written down here so that a disagreement ` +
          `is a disagreement about a stated reading and not a surprise.`,
      ).toEqual(bare);

      /* The control: the flag must actually do something when it IS "1", or "0 is off" is
         satisfied by a key that does nothing under either value. */
      const on = fingerprint(await search(c.name, s.db, anonymous, { [c.key]: "1" }));
      expect(
        on.keys.length,
        `the control failed: \`${c.key}=1\` did not narrow, so \`${c.key}=0\` equalling no ` +
          `parameters proves nothing about the flag.`,
      ).toBeLessThan(bare.keys.length);
    });
  }
});

/* --------------------- `sort`, which is exempt from the first half --------------------- */

describe("AC1/D-200-19 an unrecognised `sort` value falls back rather than erroring", () => {
  for (const name of ["searchBlueprints", "searchCards"] as const) {
    it(`\`${name}\` answers an unrecognised \`sort\` as it answers the default`, async () => {
      setup.check();
      const bare = fingerprint(await search(name, s.db, anonymous, {}));
      const nonsense = fingerprint(
        await search(name, s.db, anonymous, { sort: mark("no-such-sort") }),
      );
      expect(
        nonsense,
        `D-200-10: an unrecognised \`sort\` VALUE falls back to the default rather than ` +
          `erroring, for the same reason AC1 gives an unknown KEY — both break a shared ` +
          `link. \`${name}\` publishes ${JSON.stringify(SORT_VALUES[name])}.\n` +
          `  D-200-19 exempts \`sort\` from "every listed query key FILTERS", because it ` +
          `orders and no implementation could make it filter. This is the half of AC1 that ` +
          `does bind to it.`,
      ).toEqual(bare);
    });

    for (const value of SORT_VALUES[name]) {
      it(`\`${name}\` accepts the published \`sort=${value}\` without erroring or emptying the shelf`, async () => {
        setup.check();
        const bare = fingerprint(await search(name, s.db, anonymous, {}));
        const sorted = fingerprint(await search(name, s.db, anonymous, { sort: value }));
        expect(
          [...sorted.keys].sort(),
          `\`sort\` may reorder a shelf and may never change what is on it. ` +
            `\`${name}({sort: "${value}"})\` answered a different SET from the unsorted call.`,
        ).toEqual([...bare.keys].sort());
      });
    }
  }
});
