/* ============================================================
   T200 — `/ontology`'s three keys, and the vocabulary they filter

   D-200-17 settled what `searchTerms` quantifies over, and it is
   the answer that makes AC1 satisfiable at all: BOTH corpora. The
   registry's terms live in `ontology_term`, and a bundle's local
   overlay "travels with the release that declares it
   (`release.localVocabulary`)" — `lib/db/schema.ts`'s own words.
   Reading `ontology_term` alone leaves `origin=local` filtering
   NOTHING, EVER, for a key the contract says may not change, so
   AC1 would be dead on a live URL parameter.

   The other half of that ruling is AC4's, and it is in
   `privacy.test.ts`: a local term is not a row with a visibility
   column. It inherits its bundle's, which is why a private
   release's local term is private content that carries no mark of
   being any.

   ── `origin` ships THREE values ──
   `core`, `local` AND `deprecated`
   (`components/ontology/VocabularyBrowser.tsx`, D-200-14). A
   two-value reading silently drops a shipped filter, so the
   fixture carries a deprecated term as well as a local one — and
   a deprecated CORE term, so `origin=deprecated` and
   `origin=local` are not the same set wearing two names.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { FACET_KEYS, PARAMS, fingerprint, itemKey, sameSet, search } from "./contract";
import {
  anonymous,
  dropScratchDatabases,
  insertAccount,
  insertBundle,
  insertOntologyTerm,
  insertOntologyVersion,
  insertRelease,
  manifest,
  mark,
  recordedSetup,
  scratchDatabase,
  type Scratch,
} from "./fixtures";

interface Vocabulary {
  /** A local `tool` term on a PUBLIC release, so `origin=local` has something to find. */
  localTermId: string;
  /** The token in that term's label and in nothing else. */
  localToken: string;
  /** A deprecated CORE term, so `origin=deprecated` is not `origin=local` under another name. */
  deprecatedTermId: string;
  /** A term id in nothing at all. */
  missToken: string;
}

let s: Scratch;
let t: Vocabulary;
const setup = recordedSetup("the T200 vocabulary");

/** The five `TermKind`s the contract's own type publishes. */
const TERM_KINDS = ["phase", "node-type", "risk-marker", "data-type", "tool"] as const;
const ORIGINS = ["core", "local", "deprecated"] as const;

beforeAll(async () => {
  await setup.run(async () => {
    s = await scratchDatabase();
    const ontology = await insertOntologyVersion(s, CORE_ONTOLOGY.version);
    for (const term of CORE_ONTOLOGY.terms) {
      await insertOntologyTerm(s, {
        versionId: ontology.id,
        term: term as unknown as Record<string, unknown>,
      });
    }

    const owner = await insertAccount(s, mark("t200v"));

    /* Doc 3 §6.2: nothing is ever deleted, it is deprecated and pointed at its successor.
       A registry term rather than a local one, so the three `origin` values partition into
       three genuinely different sets. */
    const deprecatedTermId = mark("retired-tool");
    await insertOntologyTerm(s, {
      versionId: ontology.id,
      term: {
        id: deprecatedTermId,
        kind: "tool",
        label: "A retired tool",
        description: "Superseded, and still valid.",
        since: CORE_ONTOLOGY.version,
        deprecated: { since: CORE_ONTOLOGY.version, replacedBy: "shell" },
      },
    });

    const localToken = mark("localtok");
    const localTermId = `${owner.handle}/${mark("local-tool")}`;
    const bundle = await insertBundle(s, { owner, slug: mark("vocab-open") });
    await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: [],
      manifest: manifest({ slug: bundle.slug, title: "A blueprint with a local vocabulary" }),
      localVocabulary: {
        text: `terms:\n  - id: ${localTermId}\n`,
        terms: [
          {
            id: localTermId,
            kind: "tool",
            label: `A local tool ${localToken}`,
            description: "Declared by this release and by nothing else.",
            since: CORE_ONTOLOGY.version,
          },
        ],
      },
      scoredOntologyVersionId: ontology.id,
    });

    t = { localTermId, localToken, deprecatedTermId, missToken: mark("no-such-term") };
  });
});

afterAll(async () => {
  await dropScratchDatabases();
});

async function termIds(params: Record<string, string>): Promise<string[]> {
  const results = await search("searchTerms", s.db, anonymous, params);
  return results.hits.map((hit) => itemKey(hit.item).replace(/^term:/, ""));
}

/* --------------------- the corpus --------------------- */

describe("D-200-17 `searchTerms` reads both corpora", () => {
  it("an unfiltered call returns the registry's terms and the local one together", async () => {
    setup.check();
    const ids = await termIds({});
    expect(
      ids.length,
      "the fixture seeds 49 core terms plus one deprecated registry term plus one local term",
    ).toBeGreaterThanOrEqual(50);
    expect(ids, "a core term").toContain("agent");
    expect(
      ids,
      `the local term, which lives on \`release.localVocabulary\` and in no \`ontology_term\` ` +
        `row. D-200-17 refused the registry-only reading because it leaves \`origin=local\` ` +
        `filtering nothing, ever, for a key the contract says may not change.`,
    ).toContain(t.localTermId);
  });
});

/* --------------------- the three keys --------------------- */

describe("AC1 every key on /ontology narrows", () => {
  it("`q` narrows to the term carrying the token", async () => {
    setup.check();
    const all = await termIds({});
    const ids = await termIds({ q: t.localToken });
    expect(
      ids,
      `AC1 \`q\` did not narrow; the vocabulary is ${all.length} terms and this token is in ` +
        `one label.`,
    ).toEqual([t.localTermId]);
  });

  it("`kind` narrows to the terms of that kind", async () => {
    setup.check();
    const ids = await termIds({ kind: "risk-marker" });
    expect(ids.length, "the control: the vocabulary has risk markers in it").toBeGreaterThan(0);
    expect(ids, "a risk marker the core vocabulary publishes").toContain("irreversible-action");
    expect(
      ids,
      "AC1 `kind` did not narrow: `agent` is a `node-type` and must not survive a " +
        "`kind=risk-marker` filter.",
    ).not.toContain("agent");
  });

  it("`origin=core` keeps the registry's terms and drops the local one", async () => {
    setup.check();
    const ids = await termIds({ origin: "core" });
    expect(ids, "a registry term").toContain("agent");
    expect(
      ids,
      "AC1 `origin=core` must exclude a term that travels on a release rather than living " +
        "in `ontology_term`.",
    ).not.toContain(t.localTermId);
  });

  it("`origin=local` keeps the release's own term and drops the registry's", async () => {
    setup.check();
    const ids = await termIds({ origin: "local" });
    expect(
      ids,
      "AC1 `origin=local`. This is the value D-200-17 says is unsatisfiable under the " +
        "registry-only reading of the corpus.",
    ).toEqual([t.localTermId]);
  });

  it("`origin=deprecated` keeps the deprecated term and drops the rest", async () => {
    setup.check();
    const ids = await termIds({ origin: "deprecated" });
    expect(
      ids,
      `AC1 \`origin\` ships THREE values — \`core\`, \`local\` and \`deprecated\` ` +
        `(components/ontology/VocabularyBrowser.tsx, D-200-14) — and a two-value reading ` +
        `silently drops a shipped filter. The deprecated term here is a REGISTRY term, so ` +
        `this set is not \`origin=local\` wearing another name.`,
    ).toEqual([t.deprecatedTermId]);
  });
});

/* --------------------- an unknown key, the same three cells --------------------- */

describe("AC1 an unknown key is ignored on /ontology too", () => {
  it("an unknown key alone answers exactly what no keys answer", async () => {
    setup.check();
    const unknown = mark("zz-nobody-knows-this-key");
    const bare = fingerprint(await search("searchTerms", s.db, anonymous, {}));
    const withUnknown = fingerprint(
      await search("searchTerms", s.db, anonymous, { [unknown]: "x" }),
    );
    expect(
      withUnknown,
      `AC1: the published set for this surface is ${JSON.stringify(PARAMS.searchTerms)}, and ` +
        `anything outside it is ignored rather than refused.`,
    ).toEqual(bare);
  });

  it("a known key is honoured WHILE an unknown one is ignored", async () => {
    setup.check();
    const unknown = mark("zz-nobody-knows-this-key");
    const filtered = fingerprint(await search("searchTerms", s.db, anonymous, { kind: "phase" }));
    const both = fingerprint(
      await search("searchTerms", s.db, anonymous, { kind: "phase", [unknown]: "x" }),
    );
    const all = fingerprint(await search("searchTerms", s.db, anonymous, {}));

    expect(filtered.keys.length, "the control: `kind=phase` matches something").toBeGreaterThan(0);
    expect(
      filtered.keys.length,
      "the control: `kind=phase` matches less than everything, so this cell can tell an " +
        "ignored unknown key from a module that ignores every key",
    ).toBeLessThan(all.keys.length);
    expect(
      both,
      "AC1: the load-bearing cell. A module that ignores every key passes the one above and " +
        "fails this one; a module that refuses an unknown key fails it from the other side.",
    ).toEqual(filtered);
  });

  it("`sort` is not a key on this surface and is therefore ignored", async () => {
    setup.check();
    const bare = fingerprint(await search("searchTerms", s.db, anonymous, {}));
    const sorted = fingerprint(await search("searchTerms", s.db, anonymous, { sort: "name" }));
    expect(
      sorted,
      `\`/ontology\` publishes ${JSON.stringify(PARAMS.searchTerms)} and no \`sort\`. A key ` +
        `that is published on ANOTHER surface is still an unknown key here, and the whole ` +
        `point of AC1's second half is that an unknown key costs a caller nothing.`,
    ).toEqual(bare);
  });
});

/* --------------------- AC3 on this surface --------------------- */

describe("AC3 /ontology returns its vocabularies on an empty result", () => {
  it("the facet map is keyed `kind` and `origin`", async () => {
    setup.check();
    const results = await search("searchTerms", s.db, anonymous, {});
    expect(Object.keys(results.facets).sort(), "D-200-18").toEqual([
      ...FACET_KEYS.searchTerms,
    ].sort());
  });

  it("`kind` offers the five TermKinds and `origin` offers the three values", async () => {
    setup.check();
    const results = await search("searchTerms", s.db, anonymous, {});
    expect(
      sameSet(results.facets.kind ?? [], TERM_KINDS),
      `D-200-14: \`kind\` comes from the five \`TermKind\`s — a vocabulary, not a projection ` +
        `of the hit set. It answered ${JSON.stringify([...(results.facets.kind ?? [])].sort())}.`,
    ).toBe(true);
    expect(
      sameSet(results.facets.origin ?? [], ORIGINS),
      `D-200-14: \`origin\` ships \`core\`, \`local\` AND \`deprecated\`. It answered ` +
        `${JSON.stringify([...(results.facets.origin ?? [])].sort())}, and a two-value ` +
        `answer is a shipped filter silently dropped.`,
    ).toBe(true);
  });

  it("a query matching nothing still returns both vocabularies", async () => {
    setup.check();
    const populated = await search("searchTerms", s.db, anonymous, {});
    expect(populated.hits.length, "the control: the vocabulary is not empty").toBeGreaterThan(0);

    const empty = await search("searchTerms", s.db, anonymous, { q: t.missToken });
    expect(empty.hits.map((h) => itemKey(h.item)), "the premise: nothing matches").toEqual([]);
    for (const key of FACET_KEYS.searchTerms) {
      expect(
        [...(empty.facets[key] ?? [])].sort(),
        `AC3: \`facets.${key}\` moved when the hit set emptied. "A facet map derived from ` +
          `the result set is empty exactly when the user most needs it."`,
      ).toEqual([...(populated.facets[key] ?? [])].sort());
    }
  });

  it("filtering to one kind still offers the other four", async () => {
    setup.check();
    const results = await search("searchTerms", s.db, anonymous, { kind: "phase" });
    expect(
      results.hits.length,
      "the premise: `kind=phase` narrows to the five lifecycle phases rather than to nothing",
    ).toBeGreaterThan(0);
    expect(
      sameSet(results.facets.kind ?? [], TERM_KINDS),
      `AC3: every surviving hit is now a \`phase\`, and a facet map projected from the hit ` +
        `set answers \`["phase"]\` — a filter panel that has just deleted the reader's way ` +
        `back. It answered ${JSON.stringify([...(results.facets.kind ?? [])].sort())}.`,
    ).toBe(true);
  });
});
