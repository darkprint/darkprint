/* ============================================================
   Visibility through the MCP verbs

   Every verb takes an `Actor` and the four addressed verbs decide
   visibility with the policy module's `can`, so a private bundle is
   unreachable to anonymous callers and to other accounts, and
   reachable to its owner. The two find verbs compose the search
   module, which is public-only for every caller by its own rule,
   so they list nothing private even to the owner. Both halves are
   asserted, because the page copy claims both.

   Three actors: anonymous, a stranger account, and the owner. No
   operator arm: the policy grants an operator every read, and no
   MCP credential can mint one, so an operator here would measure
   the policy rather than this surface.

   Every cell carries a disagreeing control, the identically built
   public row, so "the private one is absent" cannot be satisfied by
   a verb that answers nothing to anybody. The needle is never
   something the caller supplied: a refusal may quote its own input.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { outcome, reveals, verb } from "./contract";
import { account, anonymous, dropScratchDatabases, privateWorld, refsOf } from "./fixtures";

const world = privateWorld();

afterAll(async () => {
  await dropScratchDatabases();
});

interface Who {
  label: string;
  actor: unknown;
  /** Whether the private bundle is visible to this actor through an addressed verb. */
  sees: boolean;
}

async function actors(): Promise<Who[]> {
  const w = await world();
  return [
    { label: "anonymous", actor: anonymous, sees: false },
    { label: "a stranger", actor: account(w.beta.accountId, w.beta.handle), sees: false },
    { label: "the owner", actor: account(w.alpha.accountId, w.alpha.handle), sees: true },
  ];
}

/** Runs one addressed verb for every actor and sorts the actors by what they got. */
async function sweep(
  who: readonly Who[],
  call: (actor: unknown) => Promise<unknown>,
  privateNeedle: string,
  control: (actor: unknown) => Promise<unknown>,
  controlNeedle: string,
): Promise<{ leaked: string[]; withheld: string[]; missed: string[] }> {
  const leaked: string[] = [];
  const withheld: string[] = [];
  const missed: string[] = [];
  for (const { label, actor, sees } of who) {
    const got = await outcome(() => call(actor));
    const revealed = reveals(got, privateNeedle);
    if (revealed && !sees) leaked.push(label);
    if (!revealed && sees) withheld.push(label);
    if (!reveals(await outcome(() => control(actor)), controlNeedle)) missed.push(label);
  }
  return { leaked, withheld, missed };
}

describe("the find verbs are public-only for every caller", () => {
  it("never list the private bundle, and always list the public one", async () => {
    const w = await world();
    /* The needle must identify exactly one row and that row must be the private one: a
       digest is content-addressed and the public fork carries the private bundle's bytes. */
    const carriers = await w.scratch.query(
      `select b.slug, b.visibility from "bundle" b where b.slug = $1`,
      [w.secret.slug],
    );
    expect(carriers.map((r) => `${r.slug}:${r.visibility}`)).toEqual([`${w.secret.slug}:private`]);
    const who = await actors();

    const find = await verb("mcpFindBlueprints");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const got = await outcome(() => find(w.scratch.db, actor, "", { limit: 20 }) as Promise<unknown>);
      if (reveals(got, w.secret.slug)) leaked.push(label);
      if (!reveals(got, w.shown.slug)) missed.push(label);
    }
    expect(leaked, "the private bundle's slug reached these actors; search is public-only").toEqual([]);
    expect(
      missed,
      "these actors could not list the PUBLIC bundle either, so the cell above proves nothing.",
    ).toEqual([]);
  });

  it("never list a private card version, and always list a public one", async () => {
    const w = await world();
    const secretRef = refsOf(w.secret.slug)[0]!;
    const shownRef = refsOf(w.shown.slug)[0]!;
    /* The private bundle's cards were written with its visibility, so their versions are
       private rows; the public fork pins them too, which is what makes this cell bite. */
    const rows = await w.scratch.query(
      `select visibility from "card_version" where card_id = $1`,
      [secretRef.split("@")[0]],
    );
    expect(rows.map((r) => r.visibility)).toEqual(["private"]);
    const who = await actors();

    const find = await verb("mcpFindCards");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const got = await outcome(() => find(w.scratch.db, actor, "", { limit: 20 }) as Promise<unknown>);
      if (reveals(got, secretRef)) leaked.push(label);
      if (!reveals(got, shownRef)) missed.push(label);
    }
    expect(leaked, "a private card version reached these actors; search is public-only").toEqual([]);
    expect(missed, "these actors could not list the PUBLIC card either").toEqual([]);
  });
});

describe("the addressed verbs answer the owner and refuse everyone else", () => {
  it("read a card: the private body reaches the owner only, the public body reaches all", async () => {
    const w = await world();
    expect(w.privateCard.source).toContain(w.privateCard.nonce);
    expect(w.privateCard.ref).not.toContain(w.privateCard.nonce);
    const who = await actors();
    const readCard = await verb("mcpReadCard");

    const result = await sweep(
      who,
      (actor) => readCard(w.scratch.db, actor, w.privateCard.ref) as Promise<unknown>,
      w.privateCard.nonce,
      (actor) => readCard(w.scratch.db, actor, w.publicCard.ref) as Promise<unknown>,
      w.publicCard.nonce,
    );
    expect(result.leaked, "the private card's body reached these actors").toEqual([]);
    expect(result.withheld, "the owner could not read their own private card").toEqual([]);
    expect(result.missed, "these actors could not read the PUBLIC card either").toEqual([]);
  });

  it("inspect provenance: the private digest reaches the owner only", async () => {
    const w = await world();
    expect(w.secret.digest).not.toBe(w.shown.digest);
    const who = await actors();
    const provenance = await verb("mcpProvenance");

    const result = await sweep(
      who,
      (actor) => provenance(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug) as Promise<unknown>,
      w.secret.digest,
      (actor) => provenance(w.scratch.db, actor, w.shown.ownerHandle, w.shown.slug) as Promise<unknown>,
      w.shown.digest,
    );
    expect(result.leaked, "a private release digest reached these actors").toEqual([]);
    expect(result.withheld, "the owner could not inspect their own private bundle").toEqual([]);
    expect(result.missed, "these actors could not inspect the PUBLIC bundle either").toEqual([]);
  });

  it("fetch a release: the private files reach the owner only", async () => {
    const w = await world();
    const secretRef = refsOf(w.secret.slug)[0]!;
    const shownRef = refsOf(w.shown.slug)[0]!;
    expect(refsOf(w.shown.slug)).not.toContain(secretRef);
    const who = await actors();
    const fetchRelease = await verb("mcpFetchRelease");

    const result = await sweep(
      who,
      (actor) =>
        fetchRelease(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug, w.secret.digest) as Promise<unknown>,
      secretRef,
      (actor) =>
        fetchRelease(w.scratch.db, actor, w.shown.ownerHandle, w.shown.slug, w.shown.digest) as Promise<unknown>,
      shownRef,
    );
    expect(result.leaked, "a private release's contents reached these actors").toEqual([]);
    expect(result.withheld, "the owner could not fetch their own private release").toEqual([]);
    expect(result.missed, "these actors could not fetch the PUBLIC release either").toEqual([]);
  });

  it("get a blueprint: the private bundle reaches the owner only", async () => {
    const w = await world();
    const secretRef = refsOf(w.secret.slug)[0]!;
    const shownRef = refsOf(w.shown.slug)[0]!;
    const who = await actors();
    const getBlueprint = await verb("mcpGetBlueprint");

    const result = await sweep(
      who,
      (actor) => getBlueprint(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug) as Promise<unknown>,
      secretRef,
      (actor) => getBlueprint(w.scratch.db, actor, w.shown.ownerHandle, w.shown.slug) as Promise<unknown>,
      shownRef,
    );
    expect(result.leaked, "the private bundle's files reached these actors").toEqual([]);
    expect(result.withheld, "the owner could not get their own private bundle").toEqual([]);
    expect(result.missed, "these actors could not get the PUBLIC bundle either").toEqual([]);
  });

  it("the two strangers agree with each other and differ from the owner", async () => {
    const w = await world();
    const who = await actors();
    const provenance = await verb("mcpProvenance");
    const shapes = new Map<string, string>();
    for (const { label, actor } of who) {
      const got = await outcome(
        () => provenance(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug) as Promise<unknown>,
      );
      /* By shape rather than identity: a throw carries a stack that differs between calls. */
      shapes.set(label, got.ok ? `answered ${JSON.stringify(got.value)}` : "refused");
    }
    expect(shapes.get("anonymous")).toBe("refused");
    expect(shapes.get("a stranger")).toBe("refused");
    expect(shapes.get("the owner")?.startsWith("answered")).toBe(true);
  });
});

describe("the lineage channel", () => {
  it("omits `forkedFrom` for strangers when the upstream is private, and names it for the owner", async () => {
    const w = await world();
    const rows = await w.scratch.query(
      `select slug, visibility, lineage_slug from "bundle" where slug in ($1, $2) order by slug`,
      [w.forkOfSecret.slug, w.secret.slug],
    );
    const fork = rows.find((r) => r.slug === w.forkOfSecret.slug);
    const upstream = rows.find((r) => r.slug === w.secret.slug);
    expect(fork?.visibility, "the fork must be public, or this measures ordinary privacy").toBe("public");
    expect(upstream?.visibility).toBe("private");
    expect(fork?.lineage_slug, "the fork carries no lineage, so there is nothing to omit").toBe(w.secret.slug);

    const who = await actors();
    const provenance = await verb("mcpProvenance");

    const leaked: string[] = [];
    const withheld: string[] = [];
    for (const { label, actor, sees } of who) {
      const got = await outcome(
        () => provenance(w.scratch.db, actor, w.forkOfSecret.ownerHandle, w.forkOfSecret.slug) as Promise<unknown>,
      );
      /* The needle is the upstream's slug, which the caller did not supply: the call names
         the fork, and the private slug can only appear by being read out of the lineage. */
      const named = reveals(got, w.secret.slug);
      const present = got.ok && (got.value as { forkedFrom?: unknown }).forkedFrom !== undefined;
      if ((named || present) && !sees) leaked.push(label);
      if (!(named && present) && sees) withheld.push(label);
    }
    expect(
      leaked,
      "the private upstream reached these actors through `forkedFrom`; a fork of an " +
        "upstream the caller may not read presents as an original.",
    ).toEqual([]);
    expect(withheld, "the owner may read the upstream, so their fork names it").toEqual([]);
  });
});
