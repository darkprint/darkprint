/* ============================================================
   The two readers that stand between a published release and a
   reader of it: `graphsOf` and `resolvedGraph`.

   ── the state this file exists for ──
   `gate.ts` splits the question in two. `isStorable` decides
   whether the bytes may be held; `isReleasable` adds exactly the
   reference failures, because a scorecard travels with a release
   and a score computed over a graph with a hole in it describes a
   blueprint nobody can rebuild. What deliberately did NOT move is
   everything DarkPrint infers: a port that does not fit, a type
   that cannot flow, a term nobody has minted are all the engine
   comparing two things the author wrote, and a release is entitled
   to publish a bad reading of itself.

   `publish.ts` implements that. Two readers did not, and both used
   the plain error count instead: the blueprint page answered 404
   and the shelf drew nothing for a release the registry had
   deliberately accepted, and search left the same release out of
   the index without saying so. Neither failure is visible from
   inside either module, because both answer with a VALUE — an
   absent map entry, an `undefined` document — and a value cannot
   be told from a refusal.

   ── which bundle is discriminating, and why it had to be this one ──
   Not every error-severity diagnostic makes a releasable bundle.
   `validateCard` withholds the card when its own diagnostics carry
   an error, so a card naming an unminted term reaches the resolver
   as no card at all and the node instantiating it reports
   `bundle/missing-card` — an unresolved reference, refused at both
   bars. The disagreement between the two predicates therefore has
   to be built at the EDGE, where the cards are sound and the graph
   wiring them is not, and the first `describe` below asserts that
   the fixture really is in that state rather than assuming it.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  hasErrors,
  isReleasable,
  resolveBundle,
  type Bundle,
  type Diagnostic,
} from "@/lib/core";
import { cardFilePath } from "@/lib/content/bundle-export";
import type { ReleaseRecord } from "@/lib/server/archive";
import { openView } from "@/lib/server/ontology";
import { graphsOf } from "@/lib/server/registry";
import { resolvedGraph } from "@/lib/server/search/reembed";

import {
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedRelease,
  type Scratch,
  type SeededAccount,
} from "./t090/fixtures";

/* --------------------- the two bundles --------------------- */

/**
 * `guarded-merge-bot`, which carries no `ontology/extensions.yaml`, so the bare core view
 * is the whole vocabulary and no overlay question enters any cell below.
 */
const CORPUS_SLUG = "guarded-merge-bot";
const archived = bundleBySlug(CORPUS_SLUG);

/** A port name no card can declare, so the mismatch does not depend on the corpus's ports. */
const ABSENT_PORT = "not-a-port-any-card-declares";

/**
 * The corpus topology with one edge pinning an output port that does not exist.
 *
 * `resolve.ts` answers a pin naming nothing with `bundle/port-mismatch` at error severity
 * and stops there, so the edge survives, every node still resolves, and the only thing
 * wrong with the bundle is a reading of the author's own wiring. Derived from the shipped
 * DOT rather than typed out, so the fixture cannot drift from the corpus, and the
 * substitution is asserted to have landed: a regex that matched nothing would hand every
 * cell below an unmodified bundle and read as a pass.
 */
function withAbsentPortPin(dot: string): string {
  const broken = dot.replace(/(tests\s*->\s*gate\s*\[)/, `$1out="${ABSENT_PORT}", `);
  if (broken === dot) {
    throw new Error(
      `content/blueprints/${CORPUS_SLUG}/topology.dot no longer carries a \`tests -> gate [\` ` +
        `edge, so this file's mutation pinned nothing and every cell below would be measuring ` +
        `the corpus unchanged. Re-point it at an edge the bundle still has.`,
    );
  }
  return broken;
}

const brokenPinDot = withAbsentPortPin(archived.bundle.dot);

/** The bundle a release gate accepts and a plain error count does not. */
const withFinding: Bundle = { ...archived.bundle, dot: brokenPinDot };

/** Every card the corpus DOT pins, in the order it declares them. */
const pins = (() => {
  const seen = new Set<string>();
  const refs: { ref: string; digest: string }[] = [];
  for (const node of archived.blueprint.nodes) {
    if (seen.has(node.ref)) continue;
    seen.add(node.ref);
    refs.push({ ref: node.ref, digest: node.digest });
  }
  return refs;
})();

/**
 * The same bundle with the last pinned card withheld, which is what a release whose
 * `card_refs` are short one entry looks like by the time it reaches either reader.
 */
const withUnresolvedNode: Bundle = (() => {
  const cardFiles = { ...archived.bundle.cardFiles };
  const dropped = pins[pins.length - 1];
  delete cardFiles[cardFilePath(dropped.ref)];
  return { ...archived.bundle, cardFiles };
})();

function errorCodes(ds: readonly Diagnostic[]): string[] {
  return ds.filter((d) => d.severity === "error").map((d) => d.code);
}

/* --------------------- the fixture, asserted rather than assumed --------------------- */

describe("the two bundles this file's cells rest on", () => {
  it("wires an edge to a port no card declares, and the two predicates disagree about it", () => {
    const resolved = resolveBundle(withFinding, openView());
    expect(
      errorCodes(resolved.diagnostics),
      `The mutation has to reach \`bundle/port-mismatch\` at ERROR severity: \`blocksRelease\` ` +
        `narrows by severity as well as by code, so a warning-severity finding would make this ` +
        `bundle releasable for a reason the fix has nothing to do with.`,
    ).toContain("bundle/port-mismatch");
    expect(
      {
        blueprint: resolved.blueprint !== undefined,
        errors: hasErrors(resolved.diagnostics),
        releasable: isReleasable(resolved.diagnostics),
      },
      `This is the whole premise. The bundle must resolve to a blueprint, carry an error, and ` +
        `still clear the release gate — that is the state \`publish.ts\` accepts and the state ` +
        `both readers used to answer absent for. If any of the three moves, every cell below ` +
        `is measuring something else.`,
    ).toEqual({ blueprint: true, errors: true, releasable: true });
  });

  it("withholds one pinned card in the other bundle, which the release gate does refuse", () => {
    const resolved = resolveBundle(withUnresolvedNode, openView());
    expect(
      errorCodes(resolved.diagnostics),
      `\`bundle/missing-card\` is \`gate.ts\`'s one \`unresolved-reference\` class alongside ` +
        `\`bundle/unpinned-card\`, and \`RELEASE_ONLY_CLASSES\` is exactly that class. A ` +
        `withheld card that reported some other code would leave the refusal below resting on ` +
        `nothing.`,
    ).toContain("bundle/missing-card");
    expect(
      isReleasable(resolved.diagnostics),
      `The other side of the fix: loosening the readers to the release gate must not loosen ` +
        `them past it. A drawing short a node is a different factory.`,
    ).toBe(false);
  });
});

/* --------------------- the blueprint page and the shelf --------------------- */

let s: Scratch;
let owner: SeededAccount;
let published: { ownerHandle: string; slug: string };
let unresolved: { ownerHandle: string; slug: string };

beforeAll(async () => {
  s = await scratchDatabase("release-gate");
  owner = await seedAccount(s, "release-gate");
  const a = await seedRelease(s, owner, archived, {
    slug: "release-gate-with-finding",
    dot: brokenPinDot,
  });
  const b = await seedRelease(s, owner, archived, {
    slug: "release-gate-unresolved-node",
    dropOneCardRef: true,
  });
  published = { ownerHandle: a.ownerHandle, slug: a.slug };
  unresolved = { ownerHandle: b.ownerHandle, slug: b.slug };
}, 120000);

afterAll(async () => {
  await s?.drop();
});

describe("`graphsOf` draws a release the registry published with a finding on it", () => {
  it("answers with a schematic rather than the absent entry a 404 is built on", async () => {
    const map = await graphsOf(s.db, { kind: "anonymous" }, [published]);
    expect(
      map.has(`${published.ownerHandle}/${published.slug}`),
      `This release cleared the publish gate: its only error is DarkPrint's reading of an edge ` +
        `the author wrote. An absent entry here is the blueprint page answering 404 and the ` +
        `shelf tile drawing nothing for a blueprint the registry holds and shows a scorecard ` +
        `for, which is two answers about one release.`,
    ).toBe(true);
  });

  it("draws the whole factory, not a drawing short a node", async () => {
    const map = await graphsOf(s.db, { kind: "anonymous" }, [published]);
    const entry = map.get(`${published.ownerHandle}/${published.slug}`);
    expect(entry, "the cell above says why this must be defined").toBeDefined();
    expect(
      { nodes: entry?.graph.nodes.length, edges: entry?.graph.edges.length },
      `Presence alone would pass for a reader that let the release through and then lost a ` +
        `node on the way, which is the wrong-drawing hazard rather than the missing-drawing ` +
        `one. The corpus bundle is six nodes and six edges and the pinned port changes ` +
        `neither.`,
    ).toEqual({ nodes: 6, edges: 6 });
  });

  it("carries the finding to the page rather than swallowing it", async () => {
    const map = await graphsOf(s.db, { kind: "anonymous" }, [published]);
    const entry = map.get(`${published.ownerHandle}/${published.slug}`);
    expect(
      errorCodes(entry?.diagnostics ?? []),
      `A release published with a bad reading is drawn WITH that reading beside it. A ` +
        `schematic that arrived with the error filtered out of \`diagnostics\` would show the ` +
        `reader a clean blueprint, which is worse than the 404 it replaces.`,
    ).toContain("bundle/port-mismatch");
  });

  it("still answers absent for a release whose nodes do not all resolve", async () => {
    const map = await graphsOf(s.db, { kind: "anonymous" }, [unresolved]);
    expect(
      map.has(`${unresolved.ownerHandle}/${unresolved.slug}`),
      `The guard moved from the plain error count to the release gate, and the release gate ` +
        `keeps refusing an unresolved card reference. A reader that dropped the second half of ` +
        `the condition altogether passes every cell above and fails this one.`,
    ).toBe(false);
  });
});

/* --------------------- the search index --------------------- */

/**
 * A `release` row as `getRelease` hands one to `resolvedGraph`, with no vocabulary: the
 * corpus bundle ships none, so `parseStoredVocabulary` answers `undefined` and the view is
 * the bare core. `analysis` is left off so the fresh scorecard is what comes back, which is
 * the half of the return value these cells can speak about.
 */
function releaseRow(dot: string, refs: readonly { ref: string; digest: string }[]): ReleaseRecord {
  return {
    id: "00000000-0000-0000-0000-00000000f1f0",
    bundleId: "00000000-0000-0000-0000-00000000b0d1",
    version: "1.0.0",
    digest: `sha256:${"0".repeat(64)}`,
    createdAt: new Date(0),
    dot,
    manifest: archived.bundle.manifest,
    cardRefs: refs.map((p) => p.ref),
    cardDigests: refs.map((p) => p.digest),
  };
}

/** The pinned cards as `card_version` rows: `resolvedGraph` reads the YAML off `source`. */
function cardRows(refs: readonly { ref: string; digest: string }[]) {
  return refs.map((pin, i) => {
    const at = pin.ref.lastIndexOf("@");
    const source = archived.bundle.cardFiles[cardFilePath(pin.ref)];
    if (source === undefined) throw new Error(`No card text in the archive for ${pin.ref}.`);
    return {
      id: `row-${i}`,
      cardId: pin.ref.slice(0, at),
      version: pin.ref.slice(at + 1),
      body: {},
      source,
      input: null,
    };
  });
}

describe("`resolvedGraph` indexes a release the registry published with a finding on it", () => {
  it("builds the graph document instead of falling back to the manifest alone", () => {
    const resolved = resolvedGraph(releaseRow(brokenPinDot, pins), cardRows(pins));
    expect(
      resolved?.blueprint.nodes.length,
      `\`undefined\` here sends \`blueprintText\` down its manifest-only path, so a blueprint ` +
        `the registry published is searchable by its title and summary and by nothing about ` +
        `its structure. Nothing anywhere reports that: the vector is written, it is just ` +
        `written over a shorter document.`,
    ).toBe(6);
  });

  it("still answers `undefined` for a release whose nodes do not all resolve", () => {
    const short = pins.slice(0, -1);
    const resolved = resolvedGraph(releaseRow(archived.bundle.dot, short), cardRows(short));
    expect(
      resolved,
      `The same bar as the registry's, held from the other side: a document describing a graph ` +
        `with a hole in it would put a blueprint in the index under a structure it does not ` +
        `have.`,
    ).toBeUndefined();
  });
});
