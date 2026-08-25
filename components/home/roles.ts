/* ============================================================
   What `SectionRoles` draws, as data.

   The section's header comment has always claimed that "every
   node, every edge and every label below is read off
   `content/blueprints/starter-software-factory/topology.dot` and
   the five cards it names". It was not: the labels, the wires and
   the iteration cap were transcribed literals in the JSX with
   nothing holding them to the archive, so the claim was a promise
   about provenance that the next edit to the DOT would quietly
   break. The hero's equivalent figure has been checked against the
   same file since it was written (`components/hero/graph.test.ts`).

   Splitting the facts out of the drawing is what lets
   `roles.test.ts` do the same job here: the coordinates stay in
   the component, where a layout decision belongs, and everything a
   reader could check against the archive lives in this file and is
   checked against it.

   Plain TypeScript, no JSX, no React — so the node suite can
   import it (`vitest.config.ts`).
   ============================================================ */

/** One box in the drawing, joined to the card the starter blueprint pins on that node. */
export interface RoleBox {
  /** The DOT node id, which is also the `data-viz-id` on the box. */
  id: string;
  /** The role, which is the word the section is about. */
  label: string;
  /** The pinned reference, `id@version`, as the DOT writes it. */
  card: string;
  /**
   * The node's `AgentNodeKind`, which is what the gallery colours its disc by.
   *
   * Mirrored here rather than derived, exactly like `label` and `card` above and for the
   * same reason: this file is plain data the node suite can import, and reaching into
   * `lib/content` would drag the whole reader in. `roles.test.ts` resolves the real
   * blueprint and fails if any of the five disagrees, so the mirror cannot rot.
   *
   * It is here at all because the author asked the landing's blueprint to "follow the look
   * adopted in the blueprint gallery" (2026-08-07), and the gallery's most visible move is
   * that a disc is coloured by what the node is. Four of these five are `executor` and one
   * is `verifier`, which is not a decorative choice — it is what the starter blueprint's
   * cards actually declare, and it is what the same graph looks like on `/blueprints`.
   */
  kind: string;
}

/**
 * The five roles, in the order the DOT declares its nodes.
 *
 * A role is the job a node does in this graph. It is not the ontology's `phase`, which is
 * a field on a card drawn from a closed list, and the section says so on the page: the two
 * vocabularies use nearly the same five words and merging them is the two-scales confusion
 * doc 2 §1.1 warns about.
 */
export const ROLE_BOXES: readonly RoleBox[] = [
  { id: "planner", label: "Planner", card: "spec-planner@1.0.0", kind: "executor" },
  { id: "builder", label: "Builder", card: "code-builder@1.0.0", kind: "executor" },
  { id: "tester", label: "Tester", card: "acceptance-tester@1.0.0", kind: "verifier" },
  { id: "debugger", label: "Debugger", card: "targeted-debugger@1.0.0", kind: "executor" },
  { id: "deployer", label: "Deployer", card: "release-gate@1.0.0", kind: "ship" },
];

/** One wire, joined to the edge the starter blueprint writes and to what it says it carries. */
export interface RoleWire {
  source: string;
  target: string;
  /** The DOT's own `label` attribute, verbatim. */
  label: string;
  /** `data-viz-id`, so the timeline can name this wire. */
  id: string;
}

/** The five edges, in the order the DOT writes them. */
export const ROLE_WIRES: readonly RoleWire[] = [
  { source: "planner", target: "tester", label: "acceptance criteria", id: "criteria" },
  { source: "builder", target: "tester", label: "build", id: "build" },
  { source: "tester", target: "debugger", label: "failure evidence", id: "evidence" },
  { source: "debugger", target: "tester", label: "patch", id: "patch" },
  { source: "tester", target: "deployer", label: "approved build", id: "release" },
];

/**
 * Doc 2 §5.2's absence. Nothing runs from the planner to the builder, and the reason is
 * written down: `code-builder@1.0.0` lists `acceptance-criteria` under `cannot`, that entry
 * names a data type in the ontology, and the resolver refuses the bundle with
 * `bundle/prohibition-violated` if the edge is drawn.
 */
export const ROLE_ABSENCE = {
  source: "planner",
  target: "builder",
  /** The `cannot` entry, spelled as the card spells it. */
  prohibition: "acceptance-criteria",
} as const;

/**
 * The cap on the tester/debugger loop, and where it is declared.
 *
 * Quotable because a published version is archived rather than edited in place: changing
 * `params.max_iterations` on this card produces a new version and leaves 1.0.0 saying what
 * it says today.
 */
export const ROLE_LOOP_CAP = {
  card: "targeted-debugger@1.0.0",
  param: "max_iterations",
  value: 3,
} as const;

/** The blueprint every fact above is taken from. */
export const ROLE_BLUEPRINT = "content/blueprints/starter-software-factory/topology.dot";

/** The box for a DOT node id. Throws rather than rendering a hole. */
export function roleBox(id: string): RoleBox {
  const found = ROLE_BOXES.find((box) => box.id === id);
  if (found === undefined) throw new Error(`no role box for \`${id}\``);
  return found;
}

/**
 * A role's card id, version dropped.
 *
 * The two identifiers on a `RoleBox` are different vocabularies and this is the join
 * between them. `id` is what the DOT calls the node inside this one graph (`builder`);
 * `card` is the pinned reference it resolves to (`code-builder@1.0.0`); and
 * `/nodes/[...id]` is one page per card id, listing its versions. A beat that linked
 * `nodeHref(box.id)` shipped `/nodes/builder`, which typechecks, renders and 404s.
 *
 * Split here rather than through the engine's `parseCardRef`. `@/lib/core` is the
 * documented import for the engine and this file is pulled into a client component, so
 * reaching for it to drop three characters put a measured 197 kB of engine into the
 * landing's JS. `roles.test.ts` holds `card` against the DOT, so the `id@version` shape
 * is guaranteed before this runs.
 */
export function cardId(id: string): string {
  return roleBox(id).card.split("@")[0];
}

/** What `NodeBox` needs: the role, the card id without its version, and the viz id. */
export function boxProps(id: string): { id: string; label: string; sub: string } {
  const box = roleBox(id);
  return { id: box.id, label: box.label, sub: cardId(box.id) };
}

/** What `Edge` needs: the DOT's label and the viz id. */
export function wireProps(source: string, target: string): { id: string; label: string } {
  const found = ROLE_WIRES.find((wire) => wire.source === source && wire.target === target);
  if (found === undefined) throw new Error(`no role wire for \`${source} -> ${target}\``);
  return { id: found.id, label: found.label };
}
