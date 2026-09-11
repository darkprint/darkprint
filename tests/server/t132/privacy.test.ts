/* ============================================================
   T132 AC6 — "no private bundle or private card appears in any
   response", for the three readers T080's sweep cannot reach

   D-132-02 C-8, corrected in place by D-132-04 C-B: "the AC6
   sweep gap for the two new readers is REAL and is the BLIND
   ROUND's" — three readers, not two, since D-132-03 added
   `cardsOwnedBy`. `privacy.test.ts` over in `tests/server/t080`
   keeps its hand-written `CALLS` table at thirteen by ruling, and
   these are the other three. `surface.test.ts` beside this file
   holds the arithmetic that says the two tables partition the
   sixteen.

   The construction is T080's, deliberately: two sides, each with a
   public half and a private half, a tell set DERIVED from the
   fixture rather than curated, and both directions asserted —
   cross-account blind AND the widened actors seeing their own.
   Without the second half a module that filters unconditionally
   passes every sweep and looks SAFER than the correct one, while
   making `counts.cards` unimplementable (D-132-04 C-C).

   ── the instrument had to be rebuilt for this task, and that is
      a finding in its own right ──
   `collectStrings` walks `Object.entries`. A `Map`'s entries are
   not own enumerable properties, so `findTokens(map, tells)`
   answers `[]` against a map whose KEYS are the private slugs —
   and both readers T132 adds return a Map. The sweep would have
   been green while measuring nothing. Every batch answer is
   expanded through `leakSurface` before it is scanned, and the
   first block below plants a tell in a key and a tell in a value
   and requires the expanded instrument to find both while the bare
   one finds neither. Recorded as a standing note by D-132-04.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FixtureGate,
  account,
  anonymous,
  bind,
  bindStoredVersionsOf,
  bindUsersOfMany,
  dropScratchDatabases,
  keyOf,
  leakSurface,
  mark,
  operator,
  query,
  scratchDatabase,
  stampScorecard,
} from "./contract";
import { assertTellsCannotOverMatch, collectStrings, findTokens } from "../t080/contract";
import { bundleBySlug, seedAccount, seedRelease, type SeededAccount } from "../t090/fixtures";

const gate = new FixtureGate();
let s: ReturnType<FixtureGate["get"]>;

interface Side {
  label: string;
  owner: SeededAccount;
  publicSlug: string;
  privateSlug: string;
  /** Refs pinned by the private bundle and by nothing else in this database. */
  sealedRefs: string[];
  secret: string;
  /** Everything a response must never carry about this side. Derived, never curated. */
  tells: string[];
}

const sides: Record<"A" | "B", Side> = {} as Record<"A" | "B", Side>;

/**
 * One side: a public blueprint anyone may see, and a private one whose cards are private too.
 *
 * Two different content bundles rather than one seeded twice, so the private half's card ids
 * are not also the public half's — a tell that is a substring of admissible content reds an
 * implementation that leaked nothing (T-04), and here it would do so silently.
 *
 * The scorecards are STAMPED BY HAND, so the sealed side carries a chosen secret in its
 * `autonomy` and `security` payloads rather than whatever the seeded corpus happens to
 * score. `stampScorecard` writes the same three columns a publish writes; a leak sweep needs
 * a tell it planted, not a plausible one.
 */
async function buildSide(prefix: string, label: string, openEntry: string, sealedEntry: string): Promise<Side> {
  const owner = await seedAccount(s as never, mark(`t132-priv-${prefix}`));
  const secret = `SENTINEL-${prefix}-${process.pid}-do-not-echo`;
  const publicSlug = `${prefix}-open-bundle`;
  const privateSlug = `${prefix}-sealed-bundle`;

  const open = await seedRelease(s as never, owner, bundleBySlug(openEntry), { slug: publicSlug });
  const sealed = await seedRelease(s as never, owner, bundleBySlug(sealedEntry), {
    slug: privateSlug,
    visibility: "private",
    cardVisibility: "private",
  });

  const [openRelease] = await query(s, "select id from release where bundle_id = $1", [open.bundleId]);
  const [sealedRelease] = await query(s, "select id, card_refs from release where bundle_id = $1", [
    sealed.bundleId,
  ]);
  await stampScorecard(s, openRelease?.id as string);
  await stampScorecard(s, sealedRelease?.id as string, {
    autonomy: { autonomyClass: secret, level: 4 },
    security: { level: 1, raw: 1, penalties: [], findings: [], rationale: secret },
  });

  /* The card tells are MEASURED, not chosen: a ref the private release pins that no other
     release in this database pins. A ref shared with a public bundle is legitimately in a
     public answer, and using one as a tell would red a correct reader. */
  const sealedRefs: string[] = [];
  for (const ref of (sealedRelease?.card_refs as string[]) ?? []) {
    const [row] = await query(
      s,
      "select count(*)::int as n from release where $1 = any(card_refs) and id <> $2",
      [ref, sealedRelease?.id],
    );
    if (row?.n === 0) sealedRefs.push(ref);
  }
  if (sealedRefs.length === 0) {
    throw new Error(
      `Every card \`${privateSlug}\` pins is also pinned elsewhere in this database, so this ` +
        `side has no private-card tell and the sweep could not discriminate. Seed the private ` +
        `half from a bundle whose cards no public bundle shares.`,
    );
  }

  return {
    label,
    owner,
    publicSlug,
    privateSlug,
    sealedRefs,
    secret,
    tells: [
      privateSlug,
      secret,
      sealed.bundleId,
      ...sealedRefs,
      ...sealedRefs.map((ref) => ref.slice(0, ref.lastIndexOf("@"))),
    ],
  };
}

beforeAll(async () => {
  await gate.build(async () => {
    s = await scratchDatabase("privacy");
    sides.A = await buildSide("a", "A", "guarded-merge-bot", "starter-software-factory");
    sides.B = await buildSide("b", "B", "grounded-research-desk", "nightly-data-janitor");

    /* T-04, proved rather than assumed: no tell may be a substring of anything a response may
       legitimately carry, or the sweep reds an implementation that leaked nothing. */
    const admissible: unknown[] = [];
    for (const side of [sides.A, sides.B]) {
      const [row] = await query(
        s,
        "select r.card_refs, r.dot, r.manifest from release r join bundle b on b.id = r.bundle_id " +
          "join account a on a.id = b.owner_id where a.handle = $1 and b.slug = $2",
        [side.owner.handle, side.publicSlug],
      );
      /* The stored DOT is in the admissible set, and T080's own privacy fixture deliberately
         left it OUT — "deliberately NOT the stored `dot`, which names the private card refs
         and which no published reader returns". THAT SENTENCE STOPS BEING TRUE WITH THIS
         TASK: `BlueprintGraph.dot` is served from that column, so those bytes are now
         something a response may legitimately carry and a tell colliding with them would red
         a reader that leaked nothing. */
      admissible.push(
        side.owner.handle,
        side.publicSlug,
        `${side.owner.handle}/${side.publicSlug}`,
        row?.card_refs,
        row?.manifest,
        row?.dot,
      );
    }
    assertTellsCannotOverMatch([...sides.A.tells, ...sides.B.tells], admissible);
    return s;
  });
}, 180000);

afterAll(async () => {
  await dropScratchDatabases();
});

function publicKey(side: Side) {
  return { ownerHandle: side.owner.handle, slug: side.publicSlug };
}
function privateKey(side: Side) {
  return { ownerHandle: side.owner.handle, slug: side.privateSlug };
}

/* --------------------- the instrument, falsified before it is used --------------------- */

describe("the leak instrument can see inside a Map", () => {
  /**
   * A guard on THIS SUITE, green with nothing built, and the reason it exists is that the
   * merged instrument is BLIND here — `findTokens` on a `Map` answers `[]` whatever the map
   * holds. Both halves are asserted, which is what makes this a falsification rather than a
   * demonstration: the expanded reader finds the planted tells and the bare one finds none.
   */
  it("finds a planted tell in a key and in a value, where the bare walker finds neither", () => {
    const tell = "SENTINEL-instrument-check";
    const planted = new Map<string, unknown>([
      [`${tell}-in-a-key/slug`, { harmless: 1 }],
      ["visible/slug", { autonomy: { autonomyClass: `${tell}-in-a-value` } }],
    ]);
    expect(
      findTokens(planted, [tell]),
      `If this is NOT empty, \`collectStrings\` has learned to walk a Map and \`leakSurface\` ` +
        `may be retired. Until then the bare instrument answers "nothing leaked" about a map ` +
        `whose keys are the private slugs.`,
    ).toEqual([]);
    expect(
      findTokens(leakSurface(planted), [tell]),
      `The expanded surface has to see BOTH: a batch reader leaks a private blueprint through ` +
        `its key as readily as through its value, since the key is ` + "`${ownerHandle}/${slug}`" +
        ` and the slug is the thing being hidden.`,
    ).toEqual([tell]);
    const strings = collectStrings(leakSurface(planted));
    expect(strings.some((value) => value.includes(`${tell}-in-a-key`))).toBe(true);
    expect(strings.some((value) => value.includes(`${tell}-in-a-value`))).toBe(true);
  });

  it("keeps the tells free of any admissible content", async () => {
    /* The T-04 check runs in the hook, where a collision is a broken fixture rather than a
       red. This cell says the hook ran it: without it a fixture whose seeding silently skipped
       the check would look identical from the report. */
    const s = gate.get();
    const [row] = await query(s, "select count(*)::int as n from bundle");
    expect(row?.n, "four bundles, two per side").toBe(4);
    expect(sides.A.sealedRefs.length).toBeGreaterThan(0);
    expect(sides.B.sealedRefs.length).toBeGreaterThan(0);
  });
});

/* --------------------- the three calls --------------------- */

/**
 * One entry per reader T132 adds, with arguments chosen to give that reader a way to leak.
 * Bound LAST inside `run`, after the fixture gate has answered.
 */
const CALLS: readonly {
  name: "graphsOf" | "scoresFor" | "cardsOwnedBy" | "usersOfMany" | "storedVersionsOf";
  reach: string;
  run: (actor: unknown, victim: Side) => Promise<unknown>;
}[] = [
  {
    name: "graphsOf",
    reach: "the private blueprint's key, asked for beside a public one",
    run: async (actor, victim) => {
      const db = gate.get().db;
      const fn = await bind("graphsOf");
      return fn(db, actor, [privateKey(victim), publicKey(victim)]);
    },
  },
  {
    name: "scoresFor",
    reach: "the private blueprint's stamped scorecard, whose rationale is the tell",
    run: async (actor, victim) => {
      const db = gate.get().db;
      const fn = await bind("scoresFor");
      return fn(db, actor, [privateKey(victim), publicKey(victim)]);
    },
  },
  {
    name: "cardsOwnedBy",
    reach: "the victim's own handle, whose private cards are the tell",
    run: async (actor, victim) => {
      const db = gate.get().db;
      const fn = await bind("cardsOwnedBy");
      return fn(db, actor, victim.owner.handle);
    },
  },
  /* The seventeenth reader, D-260-31 (T260's merge). Probed with a card id ONLY the victim's
     private bundle pins, so the leak arrives as that bundle in the value list. The scanned
     surface is the VALUES ALONE: `usersOfMany` echoes every asked id as a Map key whether or
     not anything answers, so the keys are the CALLER'S OWN PROBE coming back — and the probe
     id is itself one of the tells. Scanning the echo would red a reader that leaked nothing,
     which is T-04's rule applied to an input echoed as a key. */
  {
    name: "usersOfMany",
    reach: "a card id only the victim's private bundle pins, values scanned, keys are the caller's own echo",
    run: async (actor, victim) => {
      const db = gate.get().db;
      const fn = await bindUsersOfMany();
      const ref = victim.sealedRefs[0] as string;
      const answered = (await fn(db, actor, [ref.slice(0, ref.lastIndexOf("@"))])) as Map<string, unknown>;
      return [...answered.values()];
    },
  },
  /* The reader outside the pin index, asked for the sealed card's id by name. The sealed
     rows are private, so the whole answer is the leak surface: a row coming back to anybody
     but the owner is the card appearing in a response. */
  {
    name: "storedVersionsOf",
    reach: "the id of a private card only the victim's sealed bundle pins, outside the pin index",
    run: async (actor, victim) => {
      const db = gate.get().db;
      const fn = await bindStoredVersionsOf();
      const ref = victim.sealedRefs[0] as string;
      return fn(db, actor, ref.slice(0, ref.lastIndexOf("@")));
    },
  },
];

/** Who is looking, and whose private content they must not be shown. */
const SWEEPS: readonly { who: string; victim: "A" | "B"; actor: () => unknown }[] = [
  { who: "an anonymous caller", victim: "A", actor: () => anonymous },
  { who: "an anonymous caller", victim: "B", actor: () => anonymous },
  { who: "signed-in owner B", victim: "A", actor: () => account(sides.B.owner.accountId, sides.B.owner.handle) },
  { who: "signed-in owner A", victim: "B", actor: () => account(sides.A.owner.accountId, sides.A.owner.handle) },
];

for (const sweep of SWEEPS) {
  describe(`AC6 ${sweep.who} sees nothing of ${sweep.victim}'s private content`, () => {
    for (const call of CALLS) {
      it(`AC6 via \`${call.name}\` (${call.reach})`, async () => {
        const victim = sides[sweep.victim];
        const answered = await call.run(sweep.actor(), victim);
        const leaked = findTokens(leakSurface(answered), victim.tells);
        expect(
          leaked,
          `AC6: "no private bundle or private card appears in any response". \`${call.name}\` ` +
            `leaked ${JSON.stringify(leaked)} to ${sweep.who}. The reach here is: ` +
            `${call.reach}. Every tell was proved at fixture time not to be a substring of any ` +
            `admissible content (T-04), and a Map's keys are inside the scanned surface — so a ` +
            `hit is a leak, not an over-match and not an artefact of the walker.`,
        ).toEqual([]);
      });
    }
  });
}

/* --------------------- the other half: the widened actors --------------------- */

/**
 * D-132-04 C-C: cross-account BLIND, owner and operator WIDENED. Ruled on this suite's own
 * derivation — `readable()` is the shared predicate, and an owner blind to their own private
 * cards makes `counts.cards` unimplementable, which is this task's reason to exist.
 *
 * "At least one tell" rather than "all", for T080's reason: the calls are scoped and a
 * per-reader list of which tells each ought to show would be a curated set, which is the thing
 * this file avoids everywhere else.
 */
const WIDENED: readonly { who: string; victim: "A" | "B"; actor: () => unknown }[] = [
  { who: "the owner", victim: "A", actor: () => account(sides.A.owner.accountId, sides.A.owner.handle) },
  { who: "the owner", victim: "B", actor: () => account(sides.B.owner.accountId, sides.B.owner.handle) },
  { who: "a break-glass operator", victim: "A", actor: () => operator(sides.A.owner.accountId) },
  { who: "a break-glass operator", victim: "B", actor: () => operator(sides.A.owner.accountId) },
];

for (const sweep of WIDENED) {
  describe(`AC6 the widened actors — ${sweep.who} sees ${sweep.victim}'s own private content`, () => {
    for (const call of CALLS) {
      it(`AC6 via \`${call.name}\` (${call.reach})`, async () => {
        const victim = sides[sweep.victim];
        const answered = await call.run(sweep.actor(), victim);
        const found = findTokens(leakSurface(answered), victim.tells);
        expect(
          found,
          `\`visibleTo\` answers "all" for the resource owner and for a genuine operator, and ` +
            `D-132-04 C-C ruled these three readers consume that predicate rather than being ` +
            `public-only. \`${call.name}\` showed ${sweep.who} nothing of ${sweep.victim}'s ` +
            `own private content, which is a filter applied to an actor the policy widens. ` +
            `Without this direction a reader that filters unconditionally passes every sweep ` +
            `above and looks safer than the correct one.`,
        ).not.toEqual([]);
      });
    }
  });
}

/* --------------------- the control: the sweep is not vacuous --------------------- */

/**
 * A sweep for absence passes against a reader that answers nothing to everything. Each of the
 * three therefore has a control asserting it returns the PUBLIC fixture, and a red here means
 * the sweep beside it was vacuous rather than clean.
 */
describe("AC6 control — each reader does return the public fixture", () => {
  it("graphsOf() answers for the public blueprint", async () => {
    const answered = (await CALLS[0].run(anonymous, sides.A)) as Map<string, unknown>;
    expect(answered.has(keyOf(publicKey(sides.A)))).toBe(true);
  });

  it("scoresFor() answers for the public blueprint (stand-in stamp)", async () => {
    const answered = (await CALLS[1].run(anonymous, sides.A)) as Map<string, unknown>;
    expect(
      answered.has(keyOf(publicKey(sides.A))),
      `This control depends on \`stampScorecard\`. Without the planted scorecard there is ` +
        `no chosen tell for \`scoresFor\` to return about ANY blueprint and the sweep over it ` +
        `measures nothing in either direction.`,
    ).toBe(true);
  });

  it("cardsOwnedBy() answers with the public cards", async () => {
    const answered = (await CALLS[2].run(anonymous, sides.A)) as unknown[];
    expect(Array.isArray(answered)).toBe(true);
    expect(answered.length).toBeGreaterThan(0);
  });

  /**
   * The sweep entry probes a SEALED id, whose correct anonymous answer is an empty list — so
   * without this cell the whole usersOfMany sweep is satisfiable by a reader that answers
   * nothing to everything. Probed here with a card the PUBLIC bundle pins, which must come
   * back naming that bundle.
   */
  it("usersOfMany() answers the public blueprint for a card its public bundle pins", async () => {
    const scratch = gate.get();
    const [row] = await query(
      scratch,
      "select r.card_refs from release r join bundle b on b.id = r.bundle_id " +
        "join account a on a.id = b.owner_id where a.handle = $1 and b.slug = $2",
      [sides.A.owner.handle, sides.A.publicSlug],
    );
    const ref = ((row?.card_refs as string[]) ?? [])[0];
    expect(ref, "the public bundle must pin at least one card").toBeDefined();
    const id = ref.slice(0, ref.lastIndexOf("@"));
    const fn = await bindUsersOfMany();
    const answered = (await fn(scratch.db, anonymous, [id])) as Map<string, readonly unknown[]>;
    const users = answered.get(id) ?? [];
    const keys = users.map((user) => keyOf(user as { ownerHandle: string; slug: string }));
    expect(keys).toContain(keyOf(publicKey(sides.A)));
  });

  /**
   * Same shape as the `usersOfMany` control above and for the same reason: the sweep entry
   * probes a sealed id whose correct anonymous answer is `[]`, so a reader answering nothing
   * to everything would pass it. A card the public bundle pins must come back here.
   */
  it("storedVersionsOf() answers the public bundle's card to an anonymous reader", async () => {
    const scratch = gate.get();
    const [row] = await query(
      scratch,
      "select r.card_refs from release r join bundle b on b.id = r.bundle_id " +
        "join account a on a.id = b.owner_id where a.handle = $1 and b.slug = $2",
      [sides.A.owner.handle, sides.A.publicSlug],
    );
    const ref = ((row?.card_refs as string[]) ?? [])[0];
    expect(ref, "the public bundle must pin at least one card").toBeDefined();
    const id = ref.slice(0, ref.lastIndexOf("@"));
    const fn = await bindStoredVersionsOf();
    const answered = (await fn(scratch.db, anonymous, id)) as readonly { ref: string }[];
    expect(answered.map((entry) => entry.ref)).toContain(ref);
  });
});

/* --------------------- the named case the sweep would report as one line --------------------- */

describe("AC6 named cases", () => {
  /**
   * A private card pinned by a PUBLIC bundle. The bundle-side filter does not exclude it and
   * the card-side one is all that does — which under D-132-04 C-D makes the whole blueprint
   * absent rather than half-drawn, because a drawing missing a node is a topology that does
   * not match the digest the same row publishes.
   *
   * The card is sealed with direct SQL after seeding: the fixture option one module over seals
   * EVERY card, and what this needs is one sealed card inside an otherwise public bundle.
   */
  it("a public blueprint pinning one private card is absent, not half-drawn", async () => {
    const s = gate.get();
    const owner = await seedAccount(s as never, mark("t132-priv-mixed"));
    const seeded = await seedRelease(s as never, owner, bundleBySlug("incident-commander"), {
      slug: "mixed-visibility-bundle",
    });
    const [release] = await query(s, "select id, card_refs from release where bundle_id = $1", [
      seeded.bundleId,
    ]);
    const refs = (release?.card_refs as string[]) ?? [];
    expect(refs.length, "the fixture bundle must pin more than one card").toBeGreaterThan(1);
    const sealed = refs[0];
    const at = sealed.lastIndexOf("@");
    const updated = await query(
      s,
      "update card_version set visibility = 'private' where card_id = $1 and version = $2 returning id",
      [sealed.slice(0, at), sealed.slice(at + 1)],
    );
    expect(updated.length, `the fixture must actually seal \`${sealed}\``).toBe(1);

    const key = { ownerHandle: owner.handle, slug: "mixed-visibility-bundle" };
    const db = gate.get().db;
    const fn = await bind("graphsOf");
    const asAnon = (await fn(db, anonymous, [key])) as Map<string, unknown>;
    expect(
      asAnon.has(keyOf(key)),
      `D-132-04 C-D, reached independently by both halves of this task: the honest answer is ` +
        `absence. Drawing the other nodes would put a topology on the page that the digest ` +
        `beside it does not describe, and D-260-14 refused the option where the row lies ` +
        `about its own shape. The empty tile is T260's to render.`,
    ).toBe(false);
    expect(
      findTokens(leakSurface(asAnon), [sealed]),
      `And whatever it answers, the sealed ref must not be in it.`,
    ).toEqual([]);

    const asOwner = (await fn(
      db,
      account(owner.accountId, owner.handle),
      [key],
    )) as Map<string, unknown>;
    expect(
      asOwner.has(keyOf(key)),
      `The other half of the same ruling, and the half that stops "never draw a bundle with a ` +
        `private pin" from passing: the owner may see the card, so the topology is complete ` +
        `for them and the blueprint resolves.`,
    ).toBe(true);
  });

  /**
   * The DOT is the one field on `BlueprintGraph` that is served verbatim from the row, and
   * `release.dot` names every pinned card including the ones the caller may not see. T080's
   * own fixture notes the same thing about the stored DOT: no published reader returns it,
   * which stopped being true the moment `BlueprintGraph.dot` was published through this task.
   */
  it("the DOT panel of a visible blueprint carries no private card this suite planted", async () => {
    const db = gate.get().db;
    const fn = await bind("graphsOf");
    const answered = (await fn(db, anonymous, [publicKey(sides.A), publicKey(sides.B)])) as Map<
      string,
      unknown
    >;
    const tells = [...sides.A.tells, ...sides.B.tells];
    expect(
      findTokens(leakSurface(answered), tells),
      `\`BlueprintGraph.dot\` is "Authentic DOT source shown in the DOT source panel" and it ` +
        `is stored bytes. A public blueprint whose DOT named a private card would publish the ` +
        `ref through a field nothing else on the page reads — the same shape as \`cardRefs\`, ` +
        `which D-80-01 had to filter for exactly this reason.`,
    ).toEqual([]);
  });
});
