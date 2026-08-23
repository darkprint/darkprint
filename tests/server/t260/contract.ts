/* ============================================================
   T260 — the readings this suite asserts, and where each came from

   THE BLIND POSITION IS DIFFERENT IN KIND HERE, AND IT CHANGES
   WHAT A GREEN MEANS.

   A blind suite for a `lib/server/**` task reds against an absent
   module and that red is the position, not a defect. T260 publishes
   no module: every subject already exists on `backend` at `3daa325`
   and every cell below is GREEN THE MOMENT IT IS WRITTEN. So the
   usual evidence that a cell is alive — it went red, then green —
   is unavailable, and the only thing separating a real freeze from
   a cell that cannot fail is a mutation. Every constant in this
   file is therefore recorded with the command that produced it, so
   the adversary round can re-derive it rather than trust it.

   ── the one thing this author did NOT read ──
   `components/ontology/TermTable.tsx` and everything else in T260's
   `Owns`. The three frozen contracts below were derived two ways,
   neither of which is reading it:

     1. From the TWO FORBIDDEN CONSUMERS, which this author may read
        and the implementer may not touch (D-250-09, and the brief
        restates it for this task). `app/nodes/[...id]/page.tsx` and
        `app/ontology/[...term]/page.tsx` are a separately authored
        reader of the same contract, which is the best oracle
        available and is not written by the author of these
        assertions.
     2. By EXECUTION. `formatWeight`'s output cannot be derived from
        a consumer — the consumers interpolate it and never inspect
        it — so it is pinned as a GOLDEN captured by calling it,
        against `components/ontology/TermTable.tsx` at blob
        `fa977a6` (`git ls-tree 3daa325 components/ontology/`). A
        golden is admissible here and nowhere else in this suite,
        because D-260-01's criterion is literally "unchanged": the
        shipped behaviour IS the specification, and inventing an
        expected format would red a correct module.

   `markerWeight` is NOT pinned as a golden. Its rule is written
   down in a file neither half owns — `lib/core/config.ts`'s
   `DARKPRINT_CONFIG.security.weights` — and stated in prose by a
   Forbidden consumer (`app/nodes/[...id]/page.tsx:817-829`:
   "configured weight first, then the term's own, which survives
   only for locally namespaced markers"). So it is asserted against
   an ORACLE COMPUTED FROM THE CONFIG, and a cell fails when the
   two disagree rather than when a recorded number moves.
   ============================================================ */

import { existsSync, readFileSync } from "node:fs";

import { DARKPRINT_CONFIG, type OntologyTerm } from "@/lib/core";

/* ============================================================
   THE POSITIVE PREMISE

   Every cell here is a FREEZE, and a freeze is a negative wearing
   a positive's clothes: "this still behaves as it did". A negative
   is green against an absent subject, so the subject's presence is
   raised as its own failure with its own repair, never folded into
   an assertion that would report it as a semantic change.
   ============================================================ */

export class PartitionError extends Error {
  override readonly name = "PartitionError";
}

/** Below this a source file cannot be carrying the declarations any cell here is about. */
export const BYTE_FLOOR = 200;

export interface Source {
  path: string;
  raw: string;
}

export function sources(paths: readonly string[], atLeast: number): Source[] {
  if (paths.length < atLeast) {
    throw new PartitionError(
      `expected at least ${atLeast} files, the list names ${paths.length}. A shrunken list is ` +
        `how a freeze goes vacuous without anything redding.`,
    );
  }
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new PartitionError(
      `these files do not exist: ${missing.join(", ")}. A freeze over a missing file passes.`,
    );
  }
  const read = paths.map((path) => ({ path, raw: readFileSync(path, "utf8") }));
  const thin = read.filter((source) => source.raw.length < BYTE_FLOOR);
  if (thin.length > 0) {
    throw new PartitionError(
      `below the ${BYTE_FLOOR}-byte floor: ${thin
        .map((source) => `${source.path} (${source.raw.length}B)`)
        .join(", ")}. An emptied file satisfies "exists" and every absence assertion at once.`,
    );
  }
  return read;
}

/* ============================================================
   THE MODULE UNDER FREEZE, BOUND PER CELL AND NEVER AT FILE SCOPE

   A static `import { markerWeight } from …` of a member the cutover
   REMOVED throws while the module graph is being built, which
   vitest reports as `Test Files 1 failed` beside `Tests 0` — every
   cell in the file simply absent, loud in the exit code and silent
   in the number a reader quotes. That is the exact masking shape
   `tests/server/t262/partition.ts` recorded (37 passed, 68 cells
   gone) and it is worth avoiding here specifically, because
   REMOVING AN EXPORT IS THE PRINCIPAL THING D-260-01 FORBIDS: the
   suite must be loudest, not quietest, on the violation it exists
   for.

   So the module is bound inside each cell, through here.
   ============================================================ */

export type TermTableModule = typeof import("@/components/ontology/TermTable");

/* ============================================================
   THE FALSIFICATION HOOK, AND WHY IT IS IN THE SUITE RATHER THAN
   IN A SCRATCH COPY OF THE TREE

   Every cell in this suite is GREEN THE MOMENT IT IS WRITTEN, so
   the usual evidence that it is alive does not exist. The only
   remaining evidence is a mutation, and this author may not open
   `TermTable.tsx` to make one — the ordinary `sed` on a source
   line is unavailable, because writing a mutation requires knowing
   what the line says.

   So a mutation is applied to the module's OWN EXPORTS, after it
   loads, and the whole real suite runs against the mutant with no
   second code path: same cells, same assertions, same messages.
   `tests/server/t262/partition.ts` established the shape with
   `T262_SCAN_ROOT` for exactly this reason.

   ── the harness refuses to report a zero it cannot justify ──
   A mutation harness that applies nothing produces confident
   zeros; four of them were reported in one earlier round before
   anyone noticed no mutation had landed. So an unknown name
   THROWS, and every mutation below asserts its own effect on a
   probe input before returning — a mutant that answers what the
   original answered raises rather than being silently counted as
   inert.
   ============================================================ */

type Mutation = (module: TermTableModule) => TermTableModule;

function landed(name: string, before: unknown, after: unknown): void {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    throw new Error(
      `mutation \`${name}\` did not land: the probe answers ${JSON.stringify(before)} ` +
        `either way. A harness that applies nothing reports zeros that are facts about the ` +
        `harness, not about the suite.`,
    );
  }
}

const MUTATIONS: Readonly<Record<string, Mutation>> = {
  /* `markerWeight`'s two lookup steps swapped. Invisible on every term that ships; the
     constructed both-priced term is the only cell that can see it. */
  "weight-order": (module) => {
    const probe: OntologyTerm = { ...riskTerm({ id: "unbounded-loop", defaultWeight: 99 }) };
    const markerWeight = (term: OntologyTerm): number | undefined =>
      term.kind !== "risk-marker" ? undefined : (term.defaultWeight ?? CONFIGURED_WEIGHTS[term.id]);
    landed("weight-order", module.markerWeight(probe), markerWeight(probe));
    return { ...module, markerWeight };
  },
  /* `??` become `||`. Collapses a marker priced at zero into one nobody priced. */
  "weight-nullish": (module) => {
    const probe = riskTerm({ id: "lupo/priced-at-zero", defaultWeight: 0 });
    const markerWeight = (term: OntologyTerm): number | undefined =>
      term.kind !== "risk-marker"
        ? undefined
        : CONFIGURED_WEIGHTS[term.id] || term.defaultWeight || undefined;
    landed("weight-nullish", module.markerWeight(probe), markerWeight(probe));
    return { ...module, markerWeight };
  },
  /* The kind gate deleted. Prices a tool, a phase and a node type. */
  "weight-kind-gate": (module) => {
    const probe = riskTerm({ id: "unbounded-loop", kind: "tool", defaultWeight: 7 });
    const markerWeight = (term: OntologyTerm): number | undefined =>
      CONFIGURED_WEIGHTS[term.id] ?? term.defaultWeight;
    landed("weight-kind-gate", module.markerWeight(probe), markerWeight(probe));
    return { ...module, markerWeight };
  },
  /* `toFixed(2)` becomes `toFixed(0)`. Passes the whole numbers and collapses 1.5 onto 2. */
  "format-precision": (module) => {
    const formatWeight = (weight: number): string => weight.toFixed(0);
    landed("format-precision", module.formatWeight(1.5), formatWeight(1.5));
    return { ...module, formatWeight };
  },
  /* A ReactNode instead of a string. Renders correctly at the three JSX call sites and puts
     `[object Object]` into the one sentence that interpolates it. */
  "format-node": (module) => {
    const formatWeight = (weight: number): string =>
      ({ type: "span", props: { children: weight.toFixed(2) } }) as unknown as string;
    landed("format-node", module.formatWeight(1.5), formatWeight(1.5));
    return { ...module, formatWeight };
  },
  /* `.cards` and `.blueprints` swapped. Typechecks — both are `string[]` — and renders an
     empty list on every term page. */
  "usage-fields-swapped": (module) => {
    const termUsageIndex = ((registry: never) => {
      const real = module.termUsageIndex(registry);
      return new Map(
        [...real].map(([id, usage]) => [id, { ...usage, cards: usage.blueprints, blueprints: usage.cards }]),
      );
    }) as unknown as TermTableModule["termUsageIndex"];
    return { ...module, termUsageIndex };
  },
  /* `NO_USAGE` loses a field, so `get(id) ?? NO_USAGE` is two shapes. */
  "no-usage-short": (module) => {
    const NO_USAGE = { cards: [], blueprints: [] } as unknown as TermTableModule["NO_USAGE"];
    landed("no-usage-short", Object.keys(module.NO_USAGE), Object.keys(NO_USAGE));
    return { ...module, NO_USAGE };
  },
  /* An export removed outright — the principal D-260-01 violation. */
  "remove-no-usage": (module) => {
    const mutant = { ...module } as Record<string, unknown>;
    delete mutant.NO_USAGE;
    return mutant as unknown as TermTableModule;
  },
  /* A second required parameter. The signature half of D-260-01. */
  "arity-two": (module) => {
    const markerWeight = ((term: OntologyTerm, _scale: number) =>
      module.markerWeight(term)) as unknown as TermTableModule["markerWeight"];
    landed("arity-two", module.markerWeight.length, markerWeight.length);
    return { ...module, markerWeight };
  },
  /* THE INERT CONTROL. A real change to a member no cell claims to hold, so a non-zero here
     is a cell reaching further than its own criterion. */
  "inert-term-kind-meta-colour": (module) => {
    const TERM_KIND_META = {
      ...module.TERM_KIND_META,
      "risk-marker": { ...module.TERM_KIND_META["risk-marker"], color: "var(--color-nothing)" },
    };
    landed(
      "inert-term-kind-meta-colour",
      module.TERM_KIND_META["risk-marker"].color,
      TERM_KIND_META["risk-marker"].color,
    );
    return { ...module, TERM_KIND_META };
  },
};

export const MUTATION_NAMES = Object.keys(MUTATIONS);

export async function termTable(): Promise<TermTableModule> {
  const real = await import("@/components/ontology/TermTable");
  const name = process.env.T260_MUTATE;
  if (name === undefined || name === "") return real;
  const mutation = MUTATIONS[name];
  if (mutation === undefined) {
    throw new Error(
      `T260_MUTATE=${name} names no mutation. Known: ${MUTATION_NAMES.join(", ")}. Refusing ` +
        `to run a sweep whose mutation cannot be shown to have landed.`,
    );
  }
  return mutation(real);
}

/** The one path D-260-01 freezes. Named, because it is a module specifier two routes hard-code. */
export const TERM_TABLE = "components/ontology/TermTable.tsx";

/**
 * The two routes that import from it, both in T260's `Forbidden`.
 *
 * Enumerated mechanically over the whole tree, not from the ruling's own list:
 *
 *     grep -rn 'from "@/components/\(gallery\|ontology\)\|from "@/components/nodes/NodeBrowser' \
 *       app components lib scripts tests --include="*.ts" --include="*.tsx"
 *
 * returns exactly these two lines and nothing else, which is also the evidence that the
 * frozen surface has no third consumer this suite is failing to protect.
 */
export const FORBIDDEN_CONSUMERS = [
  "app/nodes/[...id]/page.tsx",
  "app/ontology/[...term]/page.tsx",
] as const;

/* ============================================================
   `markerWeight`'s ORACLE

   Two steps, and the ORDER between them is the whole rule.

     1. `term.kind === "risk-marker"`, or nothing is priced.
     2. `DARKPRINT_CONFIG.security.weights[term.id]`, and only if
        that is absent, `term.defaultWeight`.

   Step 2's order is UNOBSERVABLE ON SHIPPED DATA. Doc 3 §4 keeps
   the seven core weights in the config and
   `lib/core/ontology/core.ts:171` says no core term carries
   `defaultWeight`; `content/ontology/extensions.yaml` ships one
   local marker, `lupo/pii-handling`, which carries `defaultWeight`
   and is not in the config. So on every term that exists, the two
   readings AGREE, and a suite built only from the archive would
   red 0 against a module that had swapped them.

   That is the T200 lesson applied before it costs anything: a
   group has to be SPLITTABLE before "it was not split" is a
   finding. The discriminating term is CONSTRUCTED below and it is
   the only cell in this file that separates the two orders.
   ============================================================ */

export const CONFIGURED_WEIGHTS: Readonly<Record<string, number>> =
  DARKPRINT_CONFIG.security.weights;

/**
 * The reading, computed rather than recorded.
 *
 * `??` and not `||`: `defaultWeight: 0` is a marker an author priced AT ZERO, which doc 3
 * §7 distinguishes from one nobody priced — and `||` collapses the two. The distinction is
 * live on the page, which prints "not priced" for `undefined` and a figure for `0`
 * (`app/ontology/[...term]/page.tsx:663-668`).
 */
export function expectedWeight(term: OntologyTerm): number | undefined {
  if (term.kind !== "risk-marker") return undefined;
  return CONFIGURED_WEIGHTS[term.id] ?? term.defaultWeight;
}

/** A term with only the fields the rule reads, so a cell cannot accidentally depend on another. */
export function riskTerm(over: Partial<OntologyTerm> & { id: string }): OntologyTerm {
  return {
    kind: "risk-marker",
    label: "a marker",
    description: "a marker used only to drive the pricing rule",
    since: "0.1.0",
    ...over,
  };
}
