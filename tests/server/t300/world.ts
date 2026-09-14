/* ============================================================
   T300 — the paraphrase corpus

   Not a test file.

   ── why this world exists at all, beside T200's ──
   T200's world plants MINTED tokens: `word("qtok")` answers
   something like `qtokdlqf`. That is exactly right for a lexical
   suite and it is unusable here, because AC1's subject is "a query
   sharing NO literal token with a stored purpose still retrieves
   the blueprint whose purpose it PARAPHRASES", and nothing
   paraphrases `qtokdlqf`. A separating input needs real prose on
   both sides.

   So this world is four blueprints in four domains, written as
   English a person would write, and one query per claim built to
   be SEPARATING: it shares no word with the purpose it targets and
   it cannot reach it through the merged lexical channel either —
   all four of `text.ts`'s passes have to answer nothing, the stem
   pass included, and `recall.test.ts` asks the real `findWord`
   rather than taking this file's word for it.

   ── the shape the mixed cells need ──
   Two of the four are NEAR each other and two are FAR from
   everything:

     service    a restaurant expediting orders; the paraphrase
                target, and the only title carrying `kitchen`
     household  a person cooking supper at home; near `service` in
                meaning and sharing no word with any query here
     glacier    ice-core drilling
     bonds      municipal yield curves

   `q=kitchen` therefore has a LEXICAL hit (`service`, whose title
   carries the word) and a candidate the lexical pass cannot reach
   but the vector channel can (`household`). That is the mixed
   result set AC3 and AC6 are about, and it is why two of the four
   are deliberately close rather than four disjoint topics.

   ── the far pair is a control, not padding ──
   Without `glacier` and `bonds` a cell asserting "the paraphrase
   retrieved the right blueprint" would be satisfied by a channel
   that returns EVERYTHING, which is what a cutoff set too low
   does. They are what makes "it found this one" different from
   "it found all of them".
   ============================================================ */

import {
  insertAccount,
  insertBundle,
  insertCard,
  insertRelease,
  manifest,
  mark,
  type AccountFixture,
  type BundleFixture,
  type CardFixture,
  type ReleaseFixture,
  type Scratch,
} from "../t200/fixtures";

export interface Prose {
  title: string;
  summary: string;
  description: string;
}

export interface Shelf {
  bundle: BundleFixture;
  release: ReleaseFixture;
  slug: string;
  prose: Prose;
  card: CardFixture;
}

export interface World {
  owner: AccountFixture;

  /** The paraphrase target, and the only blueprint whose title carries `kitchen`. */
  service: Shelf;
  /** Near `service` in meaning and sharing no word with any query below. */
  household: Shelf;
  glacier: Shelf;
  bonds: Shelf;

  shelves: readonly Shelf[];

  /**
   * AC1's separating input for `searchBlueprints`: it paraphrases `service` and shares no
   * word with `service`'s purpose. Verified against the merged matcher rather than asserted
   * — see `recall.test.ts`'s premise cell.
   */
  paraphrase: string;

  /**
   * AC1's separating input for `searchCards`, against `service`'s card.
   *
   * Cards are embedded SEPARATELY (D-300-01, "so a harness can ask for a NODE rather than a
   * whole blueprint — the owner named both"), so the criterion has two subjects and one
   * query cannot stand for both.
   */
  cardParaphrase: string;

  /**
   * A word in `service`'s TITLE and in nothing else this world plants.
   *
   * The mixed-set probe: it is a lexical hit on `service` and the vector channel's only way
   * to reach `household`, so one query produces both channels.
   */
  lexicalWord: string;

  /** In none of the four purposes, and far from all of them in meaning. The empty control. */
  farQuery: string;
}

const PROSE = {
  service: {
    title: "Restaurant kitchen ticket flow",
    summary:
      "Waiters relay what diners ordered to the line, which fires each course and returns " +
      "finished plates to the floor.",
    description:
      "Covers the pass, the rail where tickets queue, and how a finished course reaches " +
      "its table without going cold.",
  },
  household: {
    title: "Weeknight supper planning at home",
    summary:
      "A cook decides what to feed the family, shops for groceries, and gets a hot meal on " +
      "the table before everyone is too tired to eat.",
    description:
      "Covers the weekly menu, the shopping list it produces, and the evening routine that " +
      "turns raw ingredients into supper.",
  },
  glacier: {
    title: "Ice core drilling and isotope dating",
    summary:
      "A borehole is cut through the sheet, cylinders are recovered in sequence, and their " +
      "oxygen ratios are measured to date each layer.",
    description:
      "Covers the drill string, the cold chain that keeps a recovered cylinder intact, and " +
      "the mass spectrometry that follows.",
  },
  bonds: {
    title: "Municipal bond yield curve calibration",
    summary:
      "Traded prices are bootstrapped into zero rates, smoothed across maturities, and " +
      "checked against the coupons the issuer actually pays.",
    description:
      "Covers the par curve, the discount factors it implies, and the credit spread applied " +
      "to each issuer tier.",
  },
} as const satisfies Record<string, Prose>;

/**
 * The card specs, one per blueprint, in the same four domains.
 *
 * `name`, `action` and `spec` are the three fields D-300-01 pins as a card's purpose, so
 * they carry the meaning and nothing else here does.
 */
const CARDS = {
  service: {
    name: "Fire the course",
    action: "fire-course",
    spec:
      "Call the ticket to the line, hold it until every component is ready, and send the " +
      "whole course out together so nothing sits under the lamp.",
  },
  household: {
    name: "Build the shopping list",
    action: "build-shopping-list",
    spec:
      "Take the week's menu, subtract whatever is already in the cupboard, and write down " +
      "what still has to be bought.",
  },
  glacier: {
    name: "Recover the cylinder",
    action: "recover-cylinder",
    spec:
      "Lower the barrel down the borehole, cut a length of the sheet, and bring it up " +
      "without letting the section warm on the way.",
  },
  bonds: {
    name: "Bootstrap the zero rates",
    action: "bootstrap-zero-rates",
    spec:
      "Walk the traded maturities in order, strip each coupon against the rates already " +
      "solved, and solve the next one.",
  },
} as const satisfies Record<string, { name: string; action: string; spec: string }>;

/**
 * AC1's queries.
 *
 * Every word here is a CONTENT word and none of them is a stopword, which is not style: the
 * merged matcher asks whether a document word STARTS with the query, so a two- or
 * three-letter word starts a large share of the archive and would make "shares no literal
 * token" a claim about a word nobody meant to test. Keeping them long also keeps the 3-gram
 * near-match pass meaningful, since it declines to run below five characters.
 *
 * The stem pass is why `meals` is not among them. It reaches `meal`, which `household`'s
 * summary carries, and the fixture's own rule for that is to re-word the query rather than
 * relax the cell.
 */
const QUERIES = {
  /** Paraphrases `service`. Not one of these words appears in `service`'s purpose. */
  paraphrase: "chef prepares dishes guests dining",
  /** Paraphrases `service`'s card. */
  cardParaphrase: "deliver cooked dishes promptly",
  /** In `service`'s title and nowhere else. */
  lexicalWord: "kitchen",
  /** In nothing, and about nothing this world holds. */
  farQuery: "tectonic subduction earthquake",
} as const;

export async function buildWorld(s: Scratch): Promise<World> {
  /* The core vocabulary used to be seeded as rows here. `phases()`, `categories()` and the
     card facets read `ontology_term` through merged T030, and a version row with no term
     rows would have left them legitimately empty — redding an AC2 facet cell for a hole in
     this fixture. 0009 dropped both tables; the one vocabulary is `CORE_ONTOLOGY` in the
     process, merged per bundle with `release.local_vocabulary`, so there is nothing to seed.
     T200's world lost the same block for the same reason. */
  const owner = await insertAccount(s, mark("t300o"));

  const build = async (key: keyof typeof PROSE, phase: string): Promise<Shelf> => {
    const prose = PROSE[key];
    const spec = CARDS[key];
    const card = await insertCard(s, {
      ownerId: owner.id,
      id: mark(`t300-${key}`),
      phases: [phase],
      type: "agent",
      riskMarkers: [],
      name: spec.name,
      action: spec.action,
      spec: spec.spec,
    });
    const slug = mark(`t300-${key}`);
    const bundle = await insertBundle(s, { owner, slug, visibility: "public" });
    const release = await insertRelease(s, {
      bundle,
      version: "1.0.0",
      cards: [card],
      manifest: manifest({
        slug,
        title: prose.title,
        summary: prose.summary,
        description: prose.description,
        /* No tags and no category. D-300-01 pins the blueprint purpose to title, summary
           and description; leaving the other two EMPTY here keeps this world silent about
           the question `reembed.test.ts` asks directly, so one fixture cannot answer it by
           accident. */
        tags: [],
      }),
    });
    return { bundle, release, slug, prose, card };
  };

  const service = await build("service", "planning");
  const household = await build("household", "planning");
  const glacier = await build("glacier", "implementation");
  const bonds = await build("bonds", "testing");

  return {
    owner,
    service,
    household,
    glacier,
    bonds,
    shelves: [service, household, glacier, bonds],
    paraphrase: QUERIES.paraphrase,
    cardParaphrase: QUERIES.cardParaphrase,
    lexicalWord: QUERIES.lexicalWord,
    farQuery: QUERIES.farQuery,
  };
}

/** A shelf's purpose as D-300-01 pins it: title, summary and description, and nothing else. */
export function purposeOf(shelf: Shelf): string {
  return [shelf.prose.title, shelf.prose.summary, shelf.prose.description].join("\n");
}

/**
 * Every field the merged blueprint matcher looks in, for the premise that checks separation.
 *
 * `category`, `tag` and `card` are absent because this world plants none of the first two
 * and the card ref is a minted identifier; the premise cell states that and checks the ref
 * separately, so the list is not silently narrower than `blueprints.ts:FIELDS`.
 */
export function haystackOf(shelf: Shelf, ownerHandle: string): { key: string; text: string }[] {
  return [
    { key: "slug", text: shelf.slug },
    { key: "owner", text: ownerHandle },
    { key: "title", text: shelf.prose.title },
    { key: "summary", text: shelf.prose.summary },
    { key: "description", text: shelf.prose.description },
    { key: "card", text: shelf.card.ref },
  ];
}
