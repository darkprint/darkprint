/* ============================================================
   T210 — the fixture layer, built out of the product's own writers

   Not a test file (the vitest glob reaches `.test.ts` only).

   ── why every row goes in through `publish` ──
   T200's blind suite wrote its rows with SQL this file's ancestor
   owned, and stamped a column NOTHING IN THE PRODUCT WRITES. That
   is not a fixture being wrong; it is a fixture being MORE COMPLETE
   than any writer in the system, and no assertion inside such a
   suite can detect it — 240 cells were green about a state that
   cannot occur. So nothing here writes a row directly. Every card,
   every release and every account arrives through the doors the
   wizard, the CLI and the seed import all go through:

       upsertFromGitHub  ->  changeHandle  ->  addOntologyVersion
                                            ->  publish

   The cost is real and is paid deliberately: `publish` runs the
   whole engine, so a fixture that would not validate cannot be
   built at all. That is the point. A count this suite asserts is a
   count over content the product would actually accept.

   ── what that cost bought, measured before a cell was written ──
   Three facts came out of driving this chain rather than reasoning
   about it, and each one changed a cell:

     1. The AC2 fixture the contract PRESCRIBES does not validate.
        `type: agent` with `outputs[0].type: agent` raises
        `card/wrong-term-kind` — "Term `agent` is a `node-type`, but
        `outputs[0].type` needs a `data-type`" — and `publish`
        refuses any bundle carrying an error. The five reference
        sites take five DISJOINT term kinds, so no term can appear
        at two different sites at all. AC2 is reachable through
        exactly two shapes and both are built below: the same term
        at BOTH PORT SITES (`portPair`), and the same term TWICE IN
        ONE LIST (`toolTwice`). See `ac2-once.test.ts` for why both
        are needed rather than either.

     2. `cards(db, actor)` really does widen for the owner.
        Measured on `privateWorld()`: the shared card reports two
        blueprints to `{kind:"anonymous"}` and THREE to the account
        that owns the private bundle. So D-210-03's discriminator
        has something to catch, and the naive actor-passthrough fold
        is a live implementation rather than a hypothetical one.

     3. A local namespaced term reaches `card.riskMarkers` only
        through `publish`'s `vocabulary` parameter. `ontology_term`
        holds CORE terms; the overlay travels per release on
        `release.local_vocabulary`. That is why `localVocabulary`
        below is handed to every bundle that names a local term, and
        why AC5 cannot be tested from the seeded archive at all
        (D-210-08: with D-210-05's filter the seed's candidate list
        is EMPTY).

   ── why the specs are long ──
   `card/spec-too-thin` fires below 120-odd characters. It is only a
   warning and would publish, but a fixture that emits diagnostics
   makes every future `publish` refusal harder to read. One shared
   constant, well over the line.
   ============================================================ */

import { changeHandle, upsertFromGitHub } from "@/lib/server/accounts";
import { publish } from "@/lib/server/publish";

import { ONTOLOGY_VERSION, recorded, scratchDatabase, type Scratch } from "./contract";

export type { Scratch };
export { dropScratchDatabases, recorded } from "./contract";

/** Long enough that `card/spec-too-thin` does not fire. Content is irrelevant to every count. */
const SPEC =
  "Take the record the caller handed you, perform exactly the one operation this card names " +
  "and nothing else, and emit the result on the declared output port. Do not read anything " +
  "outside the payload you were given, and treat yourself as done when one record has left.";

/* --------------------- actors --------------------- */

export interface Owner {
  accountId: string;
  handle: string;
  actor: { kind: "account"; accountId: string; handle: string };
}

/**
 * One account holding one handle, through the only door that creates an account.
 *
 * `upsertFromGitHub` is idempotent by `githubId` and `changeHandle` is what sets
 * `account.handle` — the same two-step `lib/server/seed/run.ts` takes, for the same reason:
 * `publish` calls `resolveOwner`, which reads the account column rather than the reservation.
 */
export async function makeOwner(db: unknown, handle: string): Promise<Owner> {
  const account = await upsertFromGitHub(db as never, {
    githubId: `t210-${handle}`,
    githubLogin: handle,
  });
  if (account.handle !== handle) {
    await changeHandle(
      db as never,
      { kind: "account", accountId: account.accountId, handle: account.handle },
      account.accountId,
      handle,
    );
  }
  return {
    accountId: account.accountId,
    handle,
    actor: { kind: "account", accountId: account.accountId, handle },
  };
}

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

/* --------------------- card documents --------------------- */

export interface Port {
  name: string;
  type: string;
}

export interface CardSpec {
  id: string;
  version?: string;
  /** `node-type` term. Exactly one, and it is one of the six reference sites. */
  type?: string;
  /** `phase` terms. Any number of the closed five. */
  phases?: readonly string[];
  /** `tool` terms. Repeats are legal and carry no diagnostic — AC2's within-a-list shape. */
  tools?: readonly string[];
  /** `risk-marker` terms, core or namespaced. */
  markers?: readonly string[];
  /** Ports take `data-type` terms. Inputs and outputs are the ONLY two sites that share a kind. */
  inputs?: readonly Port[];
  outputs?: readonly Port[];
  /**
   * The card document's `author` CLAIM. D-210-04: this is what "authors" counts, and it is a
   * claim rather than an account — nothing in this repository verifies that `ada` is anybody.
   */
  author?: string;
  /* There is no `requiresHuman` member here any more, and the paragraph that argued for one
     is gone with it. The field it wrote was withdrawn from the card schema: whether a person
     acts at a node is the `type`, so a card can no longer carry an answer that disagrees with
     the one every surface reads. What stood here recorded a real trap, worth keeping as
     history — a `human-gate` card WITHOUT the flag was refused by `publish` with a cascaded
     `bundle/missing-card` naming the DOT node rather than the field that was actually wrong,
     found by driving the fixture rather than by reading it. That refusal cannot happen now,
     which is why `AC3` and `AC6` below declare a `type` and stop. */
}

/**
 * The wire form of a card: snake_case, which is what `validate.ts` maps onto `NodeCard`.
 *
 * Hand-emitted rather than serialised from a `NodeCard` object, and that is deliberate. The
 * thing under test counts what the STORE holds, and what the store holds is what `addCard`
 * parsed out of these bytes. A fixture that built the object and stringified it would be
 * asserting against its own idea of the wire format rather than against the parser's.
 */
export function cardDocument(spec: CardSpec): string {
  const ports = (key: "inputs" | "outputs", list?: readonly Port[]): string[] =>
    list && list.length > 0
      ? [
          `${key}:`,
          ...list.flatMap((p) => [
            `  - name: ${p.name}`,
            `    type: ${p.type}`,
            `    description: The ${p.name} port.`,
          ]),
        ]
      : [`${key}: []`];

  return [
    `id: ${spec.id}`,
    `name: ${spec.id}`,
    `type: ${spec.type ?? "agent"}`,
    ...(spec.phases && spec.phases.length > 0
      ? ["phase:", ...spec.phases.map((p) => `  - ${p}`)]
      : []),
    "action: Perform the single operation this fixture card exists to perform.",
    "spec: >-",
    `  ${SPEC}`,
    `tools: [${(spec.tools ?? []).join(", ")}]`,
    "mcp: []",
    "params: {}",
    ...ports("inputs", spec.inputs),
    ...ports("outputs", spec.outputs),
    "dependencies: []",
    "cannot: []",
    "will_not: []",
    `risk_markers: [${(spec.markers ?? []).join(", ")}]`,
    `version: ${spec.version ?? "1.0.0"}`,
    ...(spec.author === undefined ? [] : [`author: ${spec.author}`]),
    `ontology_version: ${ONTOLOGY_VERSION}`,
    "",
  ].join("\n");
}

export function refOf(spec: CardSpec): string {
  return `${spec.id}@${spec.version ?? "1.0.0"}`;
}

/* --------------------- local vocabulary --------------------- */

export interface LocalTerm {
  id: string;
  kind: string;
  label: string;
  description: string;
  broader: string;
  defaultWeight?: number;
}

/**
 * A `StoredVocabulary` — `{ text, terms }` — carrying namespaced terms.
 *
 * Both halves are supplied because `publish` refuses the bare array (T133's one-column-one-shape
 * rule, enforced at the write by `addRelease`) and because `text` is what an export re-emits
 * byte for byte. The `text` here is a real YAML rendering of the same terms rather than a
 * placeholder: a `text` that disagreed with `terms` would be a fixture asserting a state the
 * product's own loader cannot produce, which is the T200 failure this file exists to avoid.
 */
export function localVocabulary(terms: readonly LocalTerm[]): {
  text: string;
  terms: readonly LocalTerm[];
} {
  const text = [
    `version: "${ONTOLOGY_VERSION}"`,
    "terms:",
    ...terms.flatMap((t) => [
      `  - id: ${t.id}`,
      `    kind: ${t.kind}`,
      `    label: ${t.label}`,
      `    description: ${t.description}`,
      `    broader: ${t.broader}`,
      ...(t.defaultWeight === undefined ? [] : [`    defaultWeight: ${t.defaultWeight}`]),
      `    since: "${ONTOLOGY_VERSION}"`,
    ]),
    "",
  ].join("\n");
  return { text, terms: terms.map((t) => ({ ...t, since: ONTOLOGY_VERSION }) as LocalTerm) };
}

/** A namespaced risk-marker rooted in the core, which is what doc 3 §7 requires of an overlay. */
export function localMarker(id: string): LocalTerm {
  return {
    id,
    kind: "risk-marker",
    label: `Marker ${id}`,
    description: `A local risk marker declared by a fixture bundle, rooted at isolation-breach.`,
    broader: "isolation-breach",
    defaultWeight: 0.5,
  };
}

/* --------------------- publishing --------------------- */

export interface BundleSpec {
  owner: Owner;
  slug: string;
  version?: string;
  cards: readonly CardSpec[];
  visibility?: "public" | "private";
  vocabulary?: { text: string; terms: readonly LocalTerm[] };
}

/**
 * One bundle, through `publish`, with a DOT graph generated from the cards it carries.
 *
 * The graph is nodes and no edges. An edge would make the bundle's analysis interesting and
 * would buy nothing: every count under test is over card DOCUMENTS, and `bundle/missing-card`
 * — the one error a generated graph can plausibly raise — is a function of whether each `card=`
 * attribute names a file that is present, which this builds from one list.
 */
export async function publishBundle(db: unknown, spec: BundleSpec): Promise<{ digest: string }> {
  const cardFiles: Record<string, string> = {};
  for (const card of spec.cards) cardFiles[`cards/${refOf(card)}.yaml`] = cardDocument(card);
  const nodes = spec.cards.map((card, i) => `  n${i} [card="${refOf(card)}"];`).join("\n");

  const result = await publish(db as never, spec.owner.actor as never, {
    ownerHandle: spec.owner.handle,
    slug: spec.slug,
    version: spec.version ?? "1.0.0",
    manifest: {
      slug: spec.slug,
      title: `Fixture ${spec.slug}`,
      summary: `A fixture blueprint named ${spec.slug}.`,
      tags: [],
    },
    dot: `digraph fixture {\n${nodes}\n}\n`,
    cardFiles,
    ...(spec.vocabulary === undefined
      ? {}
      : { vocabulary: spec.vocabulary as unknown as never }),
    visibility: spec.visibility ?? "public",
  });
  return { digest: result.digest };
}

/**
 * A scratch database with nothing in it.
 *
 * Every world below starts here. It used to publish the ontology version first, because
 * `publish` called `openView` and that refused a version nobody had published — the same
 * ordering `runImport` took. `openView` merges over `CORE_ONTOLOGY` and reaches no store, so
 * there is no longer anything to do before the first bundle.
 */
export async function emptyWorld(): Promise<Scratch> {
  return await scratchDatabase();
}

/* ============================================================
   The worlds

   Each is `recorded()`, so a writer that refuses reds every cell
   that needed it with the stage named, instead of skipping them.

   Every count a cell asserts is DERIVED from the constants below
   rather than typed in beside the assertion. Mental arithmetic over
   a fixture's driving array is the one prediction this run has
   measured going wrong, and a count computed by a command is not
   subject to it.
   ============================================================ */

/* --------------------- AC1: one card, two blueprints --------------------- */

/**
 * `SHARED_TYPE` is named by one card that two PUBLIC blueprints pin, and by nothing else.
 *
 * A `node-type` rather than a phase or a tool because `type` is the one site that is exactly
 * one term per card, so the card count cannot be inflated by a repeat inside the fixture and
 * the AC1 reading is unambiguous: one card, two blueprints.
 */
export const AC1 = {
  term: "validation",
  card: { id: "t210-ac1-card", type: "validation", author: "ada" } satisfies CardSpec,
  slugs: ["ac1-alpha", "ac1-beta"] as const,
  expectedCards: 1,
  expectedBlueprints: 2,
  expectedAuthors: 1,
};

export const ac1World = recorded("the AC1 world (one card, two blueprints)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "ada");
  for (const slug of AC1.slugs) {
    await publishBundle(scratch.db, { owner, slug, cards: [AC1.card] });
  }
  return { scratch, owner };
});

/**
 * Two accounts publishing the SAME slug — `alice/collide` and `bob/collide`.
 *
 * This is the cell that separates D-210-08's two readings, and it is the reason the two-part
 * key is testable at all. The shipped component counts blueprint SLUGS
 * (`TermTable.tsx:209`), so under its reading these two blueprints are ONE and the term
 * reports 1; under the ruled two-part key they are two and it reports 2. Invisible on the
 * one-account seed, which is exactly why a suite that only ever read the archive would miss it.
 */
export const COLLIDE = {
  term: "decision",
  /**
   * FIVE two-part keys over FOUR distinct slugs, which is what makes the two readings differ
   * by a number rather than by an argument.
   *
   * `alice/collide` and `bob/collide` share a slug. Under D-210-08's ruled two-part key this
   * world holds five blueprints; under the shipped component's slug set (`TermTable.tsx:209`)
   * it holds four. The implementer's own second axis — the build-time index over the seeded
   * archive — CANNOT see this distinction at all, because the seed publishes everything under
   * one account and slug and key are 1:1 there. So this fixture is the only place in either
   * half where the key question is decided, and it is deliberately built so a wrong answer is
   * off by exactly one rather than absent.
   */
  bundles: [
    { handle: "alice", slug: "collide" },
    { handle: "bob", slug: "collide" },
    { handle: "alice", slug: "second" },
    { handle: "bob", slug: "third" },
    { handle: "carol", slug: "fourth" },
  ] as const,
  card: { id: "t210-collide-card", type: "decision", author: "ada" } satisfies CardSpec,
  expectedBlueprints: 5,
  /** Distinct SLUGS, which is the wrong answer, named so the cell can exclude it explicitly. */
  distinctSlugs: 4,
  expectedCards: 1,
  expectedAuthors: 1,
};

export const collideWorld = recorded("the two-part-key world (5 keys over 4 slugs)", async () => {
  const scratch = await emptyWorld();
  const owners = new Map<string, Owner>();
  for (const entry of COLLIDE.bundles) {
    let owner = owners.get(entry.handle);
    if (owner === undefined) {
      owner = await makeOwner(scratch.db, entry.handle);
      owners.set(entry.handle, owner);
    }
    /* One card DOCUMENT pinned by all five bundles, byte for byte. `addCard` stores the first
       and the rest resolve to the same row, so the card count stays 1 and the only thing that
       varies across the five is which blueprint pins it — which is exactly the quantity under
       test. */
    await publishBundle(scratch.db, { owner, slug: entry.slug, cards: [COLLIDE.card] });
  }
  return { scratch, owners: [...owners.values()] };
});

/* --------------------- AC2: a card naming a term twice --------------------- */

/**
 * The two LEGAL shapes of "a card naming a term twice", and the two are not interchangeable.
 *
 * `portPair` names `json` on an input AND an output of one card — dedupe ACROSS two source
 * arrays. `toolTwice` names `sql` twice inside `tools` — dedupe WITHIN one array. A fold that
 * builds a set per array and then unions the sets passes the second and fails the first; one
 * that dedupes only the final list passes both. Asserting one shape would have left the other
 * unmeasured, and the ACROSS case is the one the contract was reaching for when it prescribed
 * a fixture the engine refuses.
 *
 * Both terms are `data-type`/`tool` and appear on exactly one card in exactly one bundle, so
 * the correct answer for each is 1 / 1 / 1 and a double count shows up as a 2 in the `cards`
 * column specifically.
 */
export const AC2 = {
  portTerm: "json",
  toolTerm: "sql",
  portCard: {
    id: "t210-ac2-ports",
    type: "agent",
    inputs: [{ name: "incoming", type: "json" }],
    outputs: [{ name: "outgoing", type: "json" }],
    author: "ada",
  } satisfies CardSpec,
  toolCard: {
    id: "t210-ac2-tools",
    type: "agent",
    tools: ["sql", "sql"],
    author: "ada",
  } satisfies CardSpec,
  slug: "ac2-once",
  expected: { cards: 1, blueprints: 1, authors: 1 },
};

export const ac2World = recorded("the AC2 world (a term named twice on one card)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "ada");
  await publishBundle(scratch.db, {
    owner,
    slug: AC2.slug,
    cards: [AC2.portCard, AC2.toolCard],
  });
  return { scratch, owner };
});

/* --------------------- the sort order, made observable --------------------- */

/**
 * Two local terms whose CODE-UNIT order and whose LOCALE order disagree.
 *
 * ── this world exists because a pre-registered mutation scored zero ──
 * The sweep replaced the module's comparator with `localeCompare`. It reddened NOTHING.
 * D-210-10 pins the order as ascending by code unit and the module's own comment cites
 * `lib/core/ontology/resolve.ts` for why — "a list that reorders between hosts is a list two
 * readers disagree about" — so the order is load-bearing and my sort cell was not guarding it.
 *
 * The reason is measurable rather than mysterious: the two comparators agree on every
 * all-lowercase corpus, which is every id in the seeded archive and every id in the other
 * fixture worlds. `/` sorts before every letter under both, so a namespaced id alone does not
 * separate them. **CASE does.** Code unit puts `Z` (0x5A) before `a` (0x61); a locale
 * comparator sorts case-insensitively at the primary level and puts `alpha` first.
 *
 * Verified publishable before the cell was written: the engine accepts a namespaced term id
 * carrying an upper-case letter, and both survive to `card.riskMarkers` unaltered.
 *
 *   code unit : Zeta/marker, alpha/marker
 *   locale    : alpha/marker, Zeta/marker
 *
 * Only the first is correct under D-210-10, and the two are adjacent in the same list, so a
 * comparator swap moves them past each other and nothing else.
 */
export const ORDER = {
  slug: "order-case",
  /** Deliberately NOT in code-unit order here, so the constant cannot be mistaken for the answer. */
  terms: ["alpha/marker", "Zeta/marker"] as const,
  /** What D-210-10 requires. Upper case first, because `Z` is 0x5A and `a` is 0x61. */
  codeUnitOrder: ["Zeta/marker", "alpha/marker"] as const,
};

export const orderWorld = recorded("the sort-order world (case-disagreeing local terms)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "casey");
  await publishBundle(scratch.db, {
    owner,
    slug: ORDER.slug,
    cards: [
      {
        id: "t210-order-card",
        type: "agent",
        markers: [...ORDER.terms],
        author: "casey",
      },
    ],
    vocabulary: localVocabulary(ORDER.terms.map(localMarker)),
  });
  return { scratch, owner };
});

/* --------------------- the six reference sites, one at a time --------------------- */

/**
 * Six cards, each naming a DISTINCT term at exactly ONE of the six reference sites.
 *
 * ── this world exists because the mutation sweep found the hole ──
 * The pre-registered sweep dropped each site from `termIdsOf` in turn. Three of the six
 * reddened NOTHING in my criterion cells:
 *
 *   `phases`  — no cell of mine ever asserted a phase term's usage at all.
 *   `inputs`  — masked. AC2's port card names `json` at BOTH port sites, so dropping one
 *   `outputs`   leaves the term reachable through the other and the count does not move.
 *               One fixture violating both clauses at once is exactly how paired clauses
 *               mask each other, and the AC2 card was built to test dedupe rather than
 *               coverage.
 *
 * In all three the ONLY thing that caught the loss was the component oracle over the seeded
 * archive — which is a real result for a file whose header says it is not a second axis, and
 * a real gap in the fixture half.
 *
 * So: one term, one site, six cards, and nothing shared between them. Each term appears at
 * its own site and NOWHERE else in this world, which is what makes dropping that one site
 * move exactly one number. The terms are chosen from kinds the site accepts — a `phase` at
 * `phases`, a `node-type` at `type`, a `risk-marker` at `riskMarkers`, a `tool` at `tools`,
 * and `data-type`s at the two port sites — because the five kinds are disjoint and the engine
 * refuses a term at a site of the wrong kind.
 */
export const SITES = {
  slug: "sites-one-each",
  /** term -> the site it is planted at, for a message that names the site rather than the id. */
  plan: [
    { site: "phases", term: "testing" },
    { site: "type", term: "evaluative" },
    { site: "riskMarkers", term: "unbounded-loop" },
    { site: "tools", term: "vector-store" },
    { site: "inputs[].type", term: "acceptance-criteria" },
    { site: "outputs[].type", term: "artifact" },
  ] as const,
  cards: [
    /* `type` is required on every card, so the five cards that are not testing `type` all
       carry the SAME filler node-type — `agent` — and `agent` is deliberately NOT one of the
       six terms under test. If the filler were also a term a cell asserted on, dropping the
       `type` site would move that cell for a reason belonging to another card. */
    { id: "t210-site-phases", type: "agent", phases: ["testing"], author: "sites" },
    { id: "t210-site-type", type: "evaluative", author: "sites" },
    { id: "t210-site-markers", type: "agent", markers: ["unbounded-loop"], author: "sites" },
    { id: "t210-site-tools", type: "agent", tools: ["vector-store"], author: "sites" },
    {
      id: "t210-site-inputs",
      type: "agent",
      inputs: [{ name: "criteria", type: "acceptance-criteria" }],
      author: "sites",
    },
    {
      id: "t210-site-outputs",
      type: "agent",
      outputs: [{ name: "built", type: "artifact" }],
      author: "sites",
    },
  ] satisfies CardSpec[],
  /** One card, one bundle, one author claim — so every term's correct record is 1 / 1 / 1. */
  expected: { cards: 1, blueprints: 1, authors: 1 },
};

export const sitesWorld = recorded("the six-sites world (one term per site)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "sites-owner");
  await publishBundle(scratch.db, { owner, slug: SITES.slug, cards: SITES.cards });
  return { scratch, owner };
});

/* --------------------- AC3: private content contributes nothing --------------------- */

/**
 * One card, two public blueprints and one PRIVATE blueprint owned by a third account.
 *
 * The card document is byte-identical in all three, so the store holds ONE `card_version` row
 * and the only thing that differs is which bundles pin it. That is what makes the private
 * contribution a pure delta: the correct answer is two blueprints for every caller, and the
 * naive fold answers three for `mallory` and two for everyone else.
 *
 * Measured before any cell was written, through `cards(db, actor)` directly:
 *   anonymous -> usedIn [alice/ac3-open-one, alice/ac3-open-two]
 *   mallory   -> usedIn [alice/ac3-open-one, alice/ac3-open-two, mallory/ac3-secret]
 * So the defect this criterion names is reachable, and D-210-03's discriminator is not
 * asserting the absence of something that could not have happened.
 */
export const AC3 = {
  term: "human-gate",
  card: {
    id: "t210-ac3-card",
    type: "human-gate",
    author: "ada",
  } satisfies CardSpec,
  publicSlugs: ["ac3-open-one", "ac3-open-two"] as const,
  privateSlug: "ac3-secret",
  expectedBlueprints: 2,
  expectedCards: 1,
  expectedAuthors: 1,

  /**
   * A term named ONLY by content inside the private bundle, and a local one beside it.
   *
   * D-210-03's amendment is why these exist. The ratified identity discriminator — the private
   * bundle's owner and an anonymous caller get IDENTICAL records — separates a PER-ACTOR fold
   * and nothing else. An index built once for an operator lets private content into every
   * count for everybody, which moves both sides of that equality together and leaves it GREEN.
   *
   * So the absolute half is needed beside the relative half: a term that exists only in private
   * content must count ZERO, and a local term that exists only in private content must not be
   * a promotion candidate. Those two cells red against a global break; the identity cell
   * cannot.
   *
   * `privateOnlyLocal` is namespaced so it reaches `candidates()`'s domain at all — under
   * D-210-05 a core-only id would be filtered out for the wrong reason and the cell would be
   * green about the filter rather than about the privacy.
   */
  privateOnlyTerm: "irreversible-action",
  privateOnlyLocal: "mallory/private-marker",
  privateOnlyCard: {
    id: "t210-ac3-private-only",
    type: "agent",
    markers: ["irreversible-action", "mallory/private-marker"],
    author: "mallory-claims-this",
  } satisfies CardSpec,
};

export const ac3World = recorded("the AC3 world (a private bundle naming a public term)", async () => {
  const scratch = await emptyWorld();
  const ada = await makeOwner(scratch.db, "ada");
  const mallory = await makeOwner(scratch.db, "mallory");
  for (const slug of AC3.publicSlugs) {
    await publishBundle(scratch.db, { owner: ada, slug, cards: [AC3.card] });
  }
  /* The private bundle carries BOTH cards: the shared one, whose contribution the relative
     cells watch, and the private-only one, whose contribution the absolute cells watch. One
     bundle rather than two so a single visibility decision governs both, which is what makes a
     global break show up in both places at once. */
  await publishBundle(scratch.db, {
    owner: mallory,
    slug: AC3.privateSlug,
    cards: [AC3.card, AC3.privateOnlyCard],
    visibility: "private",
    vocabulary: localVocabulary([localMarker(AC3.privateOnlyLocal)]),
  });
  return { scratch, ada, mallory };
});

/* --------------------- AC5: a local term past both thresholds --------------------- */

/**
 * A namespaced term carried past BOTH thresholds, and three near-misses that fail one each.
 *
 * D-210-08 measured that the seeded archive cannot test AC5 at all: without D-210-05's local
 * filter `candidates()` returns ten terms and all ten are core, and with it the list is EMPTY.
 * So every number here is synthetic and every bundle goes in through `publish`.
 *
 * The four terms are built to make each boolean independently observable:
 *   `ada/qualified`   — enough blueprints AND enough authors: both booleans true.
 *   `ada/thin-authors`— enough blueprints, one author short: meetsBlueprints true, other false.
 *   `ada/thin-blueprints` — enough authors, one blueprint short: the mirror image.
 *   `ada/lonely`      — one of each: both false, and it is still IN the list (D-210-02).
 * A candidate list that is only the qualifying set drops three of the four and reds the length
 * cell; one that is every counted term including CORE ones reds the core-exclusion cell.
 *
 * The counts are derived from the thresholds at build time rather than typed in, so a change to
 * `DARKPRINT_CONFIG.promotion` moves the fixture with the contract instead of silently making
 * every "near miss" a qualifier.
 */
export const AC5_TERMS = {
  qualified: "ada/qualified",
  thinAuthors: "ada/thin-authors",
  thinBlueprints: "ada/thin-blueprints",
  lonely: "ada/lonely",
} as const;

/** A core term the fixture also names, so the core-exclusion cell has a positive control. */
export const AC5_CORE_TERM = "secret-access";

export interface Ac5Plan {
  /** How many blueprints and authors each term is planted across. */
  plan: { term: string; blueprints: number; authors: number }[];
  thresholds: { distinctAuthors: number; distinctBlueprints: number };
}

/**
 * Derived from the live thresholds. `+ 1` on the qualifying side rather than exactly the
 * threshold, so an implementation using `>` where the contract means `>=` is caught by the
 * near-miss cells rather than by the qualifier — the qualifier would pass either way and a
 * fixture sitting exactly on the boundary cannot tell the two comparisons apart at all.
 */
export function ac5Plan(thresholds: {
  distinctAuthors: number;
  distinctBlueprints: number;
}): Ac5Plan {
  const { distinctAuthors: A, distinctBlueprints: B } = thresholds;
  return {
    thresholds,
    plan: [
      { term: AC5_TERMS.qualified, blueprints: B, authors: A },
      { term: AC5_TERMS.thinAuthors, blueprints: B, authors: A - 1 },
      { term: AC5_TERMS.thinBlueprints, blueprints: B - 1, authors: A },
      { term: AC5_TERMS.lonely, blueprints: 1, authors: 1 },
    ],
  };
}

/**
 * Plants each term across `blueprints` bundles and `authors` distinct card-document authors.
 *
 * One bundle per blueprint and one card per bundle, with the card's `author` cycling through
 * `authors` names — so `blueprints >= authors` produces exactly `authors` distinct claims and
 * exactly `blueprints` distinct two-part keys. Asserted in the cell rather than trusted: the
 * whole point of a derived fixture is that its own arithmetic is checkable, and `ac5-plan` is
 * verified against `usageOf` before the candidate list is read.
 *
 * Every bundle is PUBLIC. AC3's exclusion is tested in its own file; mixing it in here would
 * make an AC5 red ambiguous between two criteria.
 */
export const ac5World = recorded("the AC5 world (local terms across both thresholds)", async () => {
  const { promotionThresholds } = await import("./contract");
  const thresholds = await promotionThresholds();
  const { plan } = ac5Plan(thresholds);

  const scratch = await emptyWorld();
  const widest = Math.max(...plan.map((p) => p.blueprints));
  const owners: Owner[] = [];
  for (let i = 0; i < widest; i += 1) {
    owners.push(await makeOwner(scratch.db, `ac5-owner-${i}`));
  }
  const authorNames = Array.from(
    { length: Math.max(...plan.map((p) => p.authors)) },
    (_, i) => `claimant-${i}`,
  );

  const vocabulary = localVocabulary(plan.map((p) => localMarker(p.term)));

  /* One bundle per (term, index) pair rather than one bundle carrying every term: a shared
     bundle would make every term's blueprint count equal, and the near-misses depend on the
     counts DIFFERING. The slug carries the term's local half so a failure names its subject. */
  for (const entry of plan) {
    for (let i = 0; i < entry.blueprints; i += 1) {
      const author = authorNames[i % entry.authors];
      const local = entry.term.split("/")[1];
      await publishBundle(scratch.db, {
        owner: owners[i],
        slug: `ac5-${local}-${i}`,
        cards: [
          {
            id: `t210-ac5-${local}-${i}`,
            type: "agent",
            markers: [entry.term, AC5_CORE_TERM],
            author,
          },
        ],
        vocabulary,
      });
    }
  }
  return { scratch, plan, thresholds, owners };
});

/* --------------------- AC6: read-time, no refresh verb --------------------- */

/**
 * A world that is DELIBERATELY read once before a second bundle is published into it.
 *
 * D-210-01 rewrote AC6 as the discriminator: publish, call NO refresh verb, and `usageOf` MUST
 * have moved. A stored projection would not move; the ruled read-time index must. So the world
 * is returned mid-flight with a `publishSecond()` the cell calls itself, because the whole
 * criterion is about the ORDER of the read and the write and a world that had already done both
 * would have nothing left to observe.
 */
export const AC6 = {
  term: "human-input",
  card: {
    id: "t210-ac6-card",
    type: "human-input",
    author: "ada",
  } satisfies CardSpec,
  firstSlug: "ac6-first",
  secondSlug: "ac6-second",
  blueprintsBefore: 1,
  blueprintsAfter: 2,
};

/**
 * A FRESH AC6 world on every call, deliberately NOT memoised.
 *
 * Every other world here is `recorded()`, which memoises per file so an expensive publish
 * happens once. AC6 cannot be: its cells MUTATE the world by design — that is the criterion —
 * so a shared world hands the second cell a store the first has already advanced, and its
 * "before" read comes back as the "after" value. Written wrong that way first and caught by
 * reasoning through the sharing rather than by a red, because the red it would have produced
 * (`2` is not less than `2`) names the assertion and not the cause.
 *
 * The per-cell failure conversion `recorded()` also provides is kept: a throw here would land
 * in the cell that called it, which is where it belongs, because every caller invokes this
 * inside its own cell rather than in a hook.
 */
export async function newAc6World(): Promise<{
  scratch: Scratch;
  owner: Owner;
  publishSecond: () => Promise<{ digest: string }>;
}> {
  try {
    const scratch = await emptyWorld();
    const owner = await makeOwner(scratch.db, "ada");
    await publishBundle(scratch.db, { owner, slug: AC6.firstSlug, cards: [AC6.card] });
    return {
      scratch,
      owner,
      publishSecond: () =>
        publishBundle(scratch.db, { owner, slug: AC6.secondSlug, cards: [AC6.card] }),
    };
  } catch (cause) {
    throw new Error(
      "the AC6 world (one bundle, a second held back) did not build, so this cell measured " +
        "nothing. This is a broken fixture, NOT a failed acceptance criterion.",
      { cause },
    );
  }
}

/**
 * The read-only half, memoised, for the premise cell that must not advance anything.
 *
 * `world-premises.test.ts` asserts the store holds exactly one pin before the second publish.
 * It uses this rather than `newAc6World` so the premise file does not pay for a world it only
 * reads — and it never calls `publishSecond`, which is what keeps the two safe to coexist.
 */
export const ac6World = recorded("the AC6 world (read-only, for the premise)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "ada");
  await publishBundle(scratch.db, { owner, slug: AC6.firstSlug, cards: [AC6.card] });
  return { scratch, owner };
});

/* --------------------- AC4: a store with content that names OTHER terms --------------------- */

/**
 * A populated store in which the terms AC4 asks about are named by nothing.
 *
 * An EMPTY store would make AC4 vacuous in the way that matters: a module that answers zeros
 * by returning a constant is indistinguishable from one that counts, if there is nothing to
 * count. So this world publishes real content naming real terms, and AC4 then asks about
 * three ids that content demonstrably does not name.
 *
 * `abstractRoot` is the criterion's own example — a term the vocabulary declares and no card
 * names — and it is asserted to be a REAL term of the core so the cell is about a root
 * counting zero rather than about an unknown id.
 */
export const AC4 = {
  namedTerm: "evaluative",
  card: { id: "t210-ac4-card", type: "evaluative", author: "ada" } satisfies CardSpec,
  slug: "ac4-populated",
  /** In the core vocabulary, named by no card in this world. The "abstract root counts 0" case. */
  abstractRoot: "tool-capability",
  /** Not in any vocabulary at all. The "a term nothing names" case, at its strongest. */
  unknownId: "t210/nothing-names-this",
  /** A local namespace nobody declared, so `splitTermId` reads it as local. */
  unknownLocalId: "nobody/nothing-names-this",
};

export const ac4World = recorded("the AC4 world (a populated store, three unnamed ids)", async () => {
  const scratch = await emptyWorld();
  const owner = await makeOwner(scratch.db, "ada");
  await publishBundle(scratch.db, { owner, slug: AC4.slug, cards: [AC4.card] });
  return { scratch, owner };
});

/* --------------------- the seeded archive, for the oracle --------------------- */

/**
 * The real 9 / 57 / 49 archive, imported through T250's own door.
 *
 * `runImport` is the product's importer and `planImport` reads `content/**`, so this is the
 * store the site actually has rather than a reconstruction of it. Used only by
 * `oracle.test.ts`, and only there because it is the one corpus the shipped component can also
 * be pointed at.
 */
export const seededWorld = recorded("the seeded archive (runImport over content/**)", async () => {
  const scratch = await scratchDatabase();
  const seed = (await import("@/lib/server/seed")) as unknown as Record<string, unknown>;
  const planImport = seed.planImport as () => Promise<unknown>;
  const runImport = seed.runImport as (db: unknown, plan: unknown) => Promise<unknown>;
  const plan = await planImport();
  const result = await runImport(scratch.db, plan);
  return { scratch, plan, result };
});
