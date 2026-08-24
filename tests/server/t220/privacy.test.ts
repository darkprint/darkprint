/* ============================================================
   T220 AC3 — private content is unreachable through every operation

   AC3 spans four verbs, so it is ONE filter through readers that
   already take an `Actor`, never four checks — T080's twelve, same
   rule. D-220-03 makes the filter stronger than "the caller may not
   see it": **every reader is called with `{ kind: "anonymous" }`**,
   so the MCP surface is public-only for EVERY caller. The owner of a
   private bundle gets nothing through MCP for their own bundle, and
   so does an operator.

   That is the shape these cells are built on and it is what makes
   them worth running: three actors who disagree everywhere else in
   this codebase must AGREE here, and agreeing on "nothing" is
   satisfiable by a broken module that answers nothing to anybody.
   So each cell carries a disagreeing control — the identically
   constructed PUBLIC row, which all three must reach.

   ── the needle is never something the caller supplied ──
   A refusal is entitled to quote its own input: "no such bundle:
   alpha/secret" is B-03-correct, not a leak. So every needle below
   is a string the caller did not send — a stored digest, a card ref
   the private bundle pins, a nonce inside a document body. A needle
   taken from the caller's own arguments would charge a correct
   module.

   ── and the outcome is read, not the exception ──
   The block publishes no error class (charge 6 in the T220 log) and
   `mcpReadCard: Promise<string>` is a total type that must refuse
   somehow. `rejects.toThrow()` cannot express AC3 here: this suite's
   OWN absent-module rejection satisfies it, so the cell would pass
   against a module that does not exist. `reveals()` asks the
   question the criterion actually asks — did the private bytes come
   back — and answers it for a throw, an `undefined` and an empty
   list alike.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { outcome, reveals, verb } from "./contract";
import { account, anonymous, dropScratchDatabases, operator, privateWorld, refsOf } from "./fixtures";

const world = privateWorld();

afterAll(async () => {
  await dropScratchDatabases();
});

/** The three actors AC3 is quantified over, built per world because two carry ids. */
async function actors(): Promise<{ label: string; actor: unknown }[]> {
  const w = await world();
  return [
    { label: "anonymous", actor: anonymous },
    /* The private bundle's OWN OWNER. Under D-220-03 they see nothing through MCP either,
       which is the surprising half of the rule and the one worth a cell. */
    { label: "the owner", actor: account(w.alpha.accountId, w.alpha.handle) },
    { label: "an operator", actor: operator(w.beta.accountId) },
  ];
}

describe("T220 AC3 — search", () => {
  it("never carries the private bundle's identity, to any of the three actors", async () => {
    const w = await world();

    /* ── THE NEEDLE IS THE SLUG, NOT THE DIGEST, AND THE REASON IS A DEFECT THIS CELL HAD ──
       A digest is CONTENT-ADDRESSED, so it is unique to bytes and not to a row. When the
       lineage fixture added `t220-fork-of-secret` — a PUBLIC bundle built from the private
       one's bytes, which is what a fork is — the two rows came to carry the same digest
       (measured: both `sha256:69bcfb1e…`, because the manifest sits outside `bundleDigest`).
       The public fork then appeared in search carrying it, and this cell charged an AC3 leak
       against a correct module, for all three actors at once.

       A fixture added in one file invalidated a needle in another, and nothing asserted the
       property the needle rested on. So the property is now a PREMISE rather than an
       assumption: whatever is used as the needle must belong to exactly one row, and that
       row must be the private one. */
    const carriers = await w.scratch.query(
      `select b.slug, b.visibility from "bundle" b where b.slug = $1`,
      [w.secret.slug],
    );
    expect(
      carriers.map((r) => `${r.slug}:${r.visibility}`),
      "the needle must identify exactly one row, and that row must be the private one",
    ).toEqual([`${w.secret.slug}:private`]);
    /* And it must not be something the caller sends: `mcpSearch` takes only a task string,
       so a slug can only appear in an answer by being read out of the store. */
    const needle = w.secret.slug;

    /* The control needle, checked for the same property. */
    const shownCarriers = await w.scratch.query(
      `select b.slug from "bundle" b where b.slug = $1`,
      [w.shown.slug],
    );
    expect(shownCarriers).toHaveLength(1);
    const control = w.shown.slug;

    const who = await actors();

    const mcpSearch = await verb("mcpSearch");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const got = await outcome(() => mcpSearch(w.scratch.db, actor, "") as Promise<unknown>);
      if (reveals(got, needle)) leaked.push(label);
      /* The disagreeing control, in the same cell so the two cannot drift apart: the PUBLIC
         bundle must be reachable by the same call. Without it "the private one is absent"
         is satisfied by a search that returns nothing at all. */
      if (!reveals(got, control)) missed.push(label);
    }
    expect(leaked, "the private bundle's slug reached these actors").toEqual([]);
    expect(
      missed,
      "these actors could not reach the PUBLIC bundle either, so the cell above proves " +
        "nothing: a search that answers nobody passes it.",
    ).toEqual([]);
  });
});

describe("T220 AC3 — read a card", () => {
  it("never returns the private card's body, and always returns the public one", async () => {
    const w = await world();
    expect(w.privateCard.nonce).not.toBe(w.publicCard.nonce);
    /* The nonce really is in the stored document and really is not in the ref, which is what
       makes it a leak needle rather than an echo of the caller's own argument. */
    expect(w.privateCard.source).toContain(w.privateCard.nonce);
    expect(w.privateCard.ref).not.toContain(w.privateCard.nonce);
    const who = await actors();

    const readCard = await verb("mcpReadCard");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const priv = await outcome(
        () => readCard(w.scratch.db, actor, w.privateCard.ref) as Promise<unknown>,
      );
      if (reveals(priv, w.privateCard.nonce)) leaked.push(label);
      const pub = await outcome(
        () => readCard(w.scratch.db, actor, w.publicCard.ref) as Promise<unknown>,
      );
      if (!reveals(pub, w.publicCard.nonce)) missed.push(label);
    }
    expect(leaked, "the private card's body reached these actors").toEqual([]);
    expect(
      missed,
      "these actors could not read the PUBLIC card either. Both cards are pinned by no " +
        "bundle and differ only in `visibility`, so a reader that cannot reach an unpinned " +
        "card satisfies the privacy assertion while reading nothing.",
    ).toEqual([]);
  });
});

describe("T220 AC3 — inspect provenance", () => {
  it("never discloses the private bundle's releases, and does disclose the public one's", async () => {
    const w = await world();
    /* The needle is the stored digest and the caller sends only owner and slug — but a
       digest is CONTENT-addressed, and the lineage fixture's public fork carries the
       private bundle's bytes and therefore its digest (measured: both `sha256:69bcfb1e…`).
       That non-uniqueness cost the search cell above a false AC3 charge, so the premise is
       asserted here rather than reasoned about: the digest must be reachable on a PRIVATE
       row and the leak must be read from a call that names that row. */
    expect(w.secret.digest).not.toBe(w.shown.digest);
    const sharers = await w.scratch.query(
      `select b.slug, b.visibility from "bundle" b join "release" r on r.bundle_id = b.id
        where r.digest = $1 order by b.slug`,
      [w.secret.digest],
    );
    expect(
      sharers.some((r) => r.slug === w.secret.slug && r.visibility === "private"),
      `no private row carries the needle digest: ${JSON.stringify(sharers)}`,
    ).toBe(true);
    const who = await actors();

    const provenance = await verb("mcpProvenance");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const priv = await outcome(
        () => provenance(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug) as Promise<unknown>,
      );
      if (reveals(priv, w.secret.digest)) leaked.push(label);
      const pub = await outcome(
        () => provenance(w.scratch.db, actor, w.shown.ownerHandle, w.shown.slug) as Promise<unknown>,
      );
      if (!reveals(pub, w.shown.digest)) missed.push(label);
    }
    expect(leaked, "a private release digest reached these actors").toEqual([]);
    expect(
      missed,
      "these actors could not inspect the PUBLIC bundle either, so the refusal above is not " +
        "about visibility.",
    ).toEqual([]);
  });
});

describe("T220 AC3 — fetch a release", () => {
  it("never returns the private release's files, and does return the public one's", async () => {
    const w = await world();
    /* The needle is a card ref the private bundle PINS — inside the folder, never in the
       argument list — and the control needle is the public bundle's own. The fixture's
       `disjointPair` guarantees they cannot be the same string. */
    const secretRef = refsOf(w.secret.slug)[0]!;
    const shownRef = refsOf(w.shown.slug)[0]!;
    expect(secretRef).not.toBe(shownRef);
    expect(refsOf(w.shown.slug)).not.toContain(secretRef);
    /* `secretRef` is pinned by the public fork as well — a fork pins its upstream's cards by
       definition — so it is NOT unique to the private bundle. It is still a sound needle
       here because the leak is read from a call that names the PRIVATE bundle and no other
       fetch happens in the same outcome; recorded rather than left implicit, because the
       search cell one describe-block up charged a false AC3 leak on exactly this property
       going unasserted. The control needle IS disjoint, which `disjointPair` guarantees. */
    expect(refsOf(w.secret.slug)).not.toContain(shownRef);
    const who = await actors();

    const fetchRelease = await verb("mcpFetchRelease");
    const leaked: string[] = [];
    const missed: string[] = [];
    for (const { label, actor } of who) {
      const priv = await outcome(
        () =>
          fetchRelease(
            w.scratch.db,
            actor,
            w.secret.ownerHandle,
            w.secret.slug,
            w.secret.digest,
          ) as Promise<unknown>,
      );
      if (reveals(priv, secretRef)) leaked.push(label);
      const pub = await outcome(
        () =>
          fetchRelease(
            w.scratch.db,
            actor,
            w.shown.ownerHandle,
            w.shown.slug,
            w.shown.digest,
          ) as Promise<unknown>,
      );
      if (!reveals(pub, shownRef)) missed.push(label);
    }
    expect(leaked, "a private release's contents reached these actors").toEqual([]);
    expect(
      missed,
      "these actors could not fetch the PUBLIC release either, so nothing above is about " +
        "visibility.",
    ).toEqual([]);
  });
});

describe("T220 AC3 — the three actors agree", () => {
  /* AC3 is ONE filter, not four checks, and this is the cell that says so. If the three
     actors ever disagree, some reader is being handed the caller's identity instead of
     `{ kind: "anonymous" }` — which is D-220-03's rule and the thing a per-verb assertion
     cannot see, because each verb would still be internally consistent. */
  it("answer the same thing about the private bundle, whoever asks", async () => {
    const w = await world();
    const who = await actors();
    expect(who).toHaveLength(3);

    const provenance = await verb("mcpProvenance");
    const shapes: string[] = [];
    for (const { actor } of who) {
      const got = await outcome(
        () => provenance(w.scratch.db, actor, w.secret.ownerHandle, w.secret.slug) as Promise<unknown>,
      );
      /* Compared by SHAPE rather than by identity: a throw carries a stack that differs
         between calls, so two correct refusals would never be `toEqual`. What must agree is
         whether it refused and, when it answered, what it answered. */
      shapes.push(got.ok ? `answered ${JSON.stringify(got.value)}` : "refused");
    }
    expect(new Set(shapes).size, `answers: ${JSON.stringify(shapes)}`).toBe(1);
  });
});

describe("T220 AC3 — the lineage channel", () => {
  /* D-220-05 names this one explicitly: `forkedFrom` is OMITTED WHOLE when the upstream is
     unreadable, *"or AC3 leaks by lineage"*. It is the AC3 violation that hides in a field
     nobody thinks of as content — the fork itself is public and its own provenance is a
     legitimate read, and the disclosure is three words inside the answer. */
  it("omits `forkedFrom` entirely when the upstream is private", async () => {
    const w = await world();
    /* Premises before the bind: the fork really is public and really does carry a lineage
       pointing at the private bundle. Without both, an absent `forkedFrom` below is a fork
       that was never forked. */
    /* `lineage` is THREE columns in the schema — `lineage_owner_id`, `lineage_slug`,
       `lineage_version` — not one. The single-column spelling threw `column "lineage" does
       not exist`, and in the blind runs I read that red as the module bind because every
       other cell in the file was redding there. A red naming a plausible wrong cause,
       inside my own premise. */
    const rows = await w.scratch.query(
      `select slug, visibility, lineage_slug, lineage_owner_id from "bundle"
        where slug in ($1, $2) order by slug`,
      [w.forkOfSecret.slug, w.secret.slug],
    );
    const fork = rows.find((r) => r.slug === w.forkOfSecret.slug);
    const upstream = rows.find((r) => r.slug === w.secret.slug);
    expect(fork?.visibility, "the fork must be public, or this measures ordinary privacy").toBe(
      "public",
    );
    expect(upstream?.visibility).toBe("private");
    expect(
      fork?.lineage_slug,
      "the fork carries no lineage, so there is nothing to omit",
    ).toBe(w.secret.slug);

    const who = await actors();
    const provenance = await verb("mcpProvenance");

    /* All THREE actors, not just anonymous. Under D-220-03 the upstream is unreadable to
       every caller because every reader is called anonymously — so the owner, who can read
       that bundle everywhere else in the product, must not see its slug here either. An
       anonymous-only cell is blind to a module that forwards the caller's identity, which
       is the single most likely way this rule gets broken. */
    const leaked: string[] = [];
    const present: string[] = [];
    for (const { label, actor } of who) {
      const got = await outcome(
        () =>
          provenance(
            w.scratch.db,
            actor,
            w.forkOfSecret.ownerHandle,
            w.forkOfSecret.slug,
          ) as Promise<unknown>,
      );
      /* The needle is the upstream's SLUG here rather than a digest, and that is sound in
         this one place precisely because the caller did NOT supply it: the call names the
         FORK, and the private slug can only appear by being read out of `lineage`. */
      if (reveals(got, w.secret.slug)) leaked.push(label);
      if (got.ok && (got.value as { forkedFrom?: unknown }).forkedFrom !== undefined) {
        present.push(label);
      }
    }
    expect(
      leaked,
      "the private upstream's slug reached these actors through `forkedFrom`. D-220-05: a " +
        "fork of a non-public upstream presents as an original.",
    ).toEqual([]);
    expect(
      present,
      "`forkedFrom` is present for a fork whose upstream is unreadable. It is omitted " +
        "WHOLE — a partial one still says the fork is a fork of something hidden.",
    ).toEqual([]);
  });
});
