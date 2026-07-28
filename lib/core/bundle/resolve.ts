/* ============================================================
   DarkPrint core — bundle resolution
   The join between the two halves of the data model (doc 1 §2):
   the DOT carries the topology, the cards carry the detail,
   and this is the only place the two are held against each other.
   Every referential-integrity rule of §2 lives here.
   Spec PART 5.

   Two things arrive here from Fase 1 and both are additive:

   1. **Attractor compatibility** (doc 1 §0.1.1, doc 2 §11 item 0).
      `lintAttractor` runs over the same parsed DOT and its
      `attractor/*` warnings are merged in. They are warnings, and
      they are a separate namespace from `dot/*` on purpose: a
      bundle that trips one is a valid DarkPrint bundle that will
      not run under Attractor, and the author has to be able to
      tell which of the two is complaining.
   2. **Phase coverage** (doc 2 §8, doc 3 §2). A property of the
      cards the graph pins, so it is established here with the
      rest of the join rather than by a metric — and it is
      descriptive, never a score (doc 2 §1.1).

   A third rule arrived with the card's `cannot` field:
   **declared prohibitions** (doc 2 §3). A `cannot` entry naming an
   ontology `data-type` is a statement that the node must not
   receive it, and that statement is about edges, so this file is
   the only place it can be held against anything. See
   `checkProhibitions`.
   ============================================================ */

import {
  error,
  sortDiagnostics,
  warning,
  type Diagnostic,
  type DiagnosticLocation,
} from "../diagnostics";
import { computePhaseCoverage } from "../analysis/phase-coverage";
import { lintAttractor } from "../attractor/lint";
import { cardRef, parseCardRef, type CardRef, type NodeCard, type Port } from "../card/schema";
import { checkVersionChain, loadCard } from "../card/validate";
import { buildGraph } from "../dot/graph";
import { parseDot, type DotAttrs, type DotEdgeStmt, type DotNodeStmt } from "../dot/parser";
import { bundleDigest, cardDigest } from "../hash/digest";
import type { OntologyView } from "../ontology/resolve";
import type {
  Bundle,
  ResolvedBlueprint,
  ResolvedEdge,
  ResolvedNode,
  ResolveResult,
} from "./types";

/** The bundle-relative name the DOT source is reported under. */
const DOT_FILE = "blueprint.dot";

/** The top of the data-type lattice: it accepts anything and anything accepts it. */
const ANY_TYPE = "any";

/**
 * A version known to satisfy the reference grammar, used to ask `parseCardRef`
 * about an id on its own. Cheaper — and safer — than keeping a third copy of the
 * §5 id regex in sync with `schema.ts` and `validate.ts`.
 */
const PROBE_VERSION = "1.0.0";

/** One card file that loaded, with everything the resolver needs to talk about it. */
interface CardEntry {
  card: NodeCard;
  digest: string;
  /** Bundle-relative filename, for diagnostic locations. */
  file: string;
}

/** The ports an edge ended up wiring together. Either side may stay unresolved. */
interface WiredPorts {
  fromPort?: Port;
  toPort?: Port;
}

/* --------------------- small pure helpers --------------------- */

/** Code-unit comparison, not `localeCompare` — resolution must not depend on the host locale. */
function cmpString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * DOT attributes are declared with an index signature, so TypeScript believes every
 * key is present. This is the honest lookup.
 */
function attr(attrs: DotAttrs, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : undefined;
}

function nodeLocation(stmt: DotNodeStmt): DiagnosticLocation {
  return { file: DOT_FILE, nodeId: stmt.id, line: stmt.line, column: stmt.column };
}

function edgeLocation(stmt: DotEdgeStmt): DiagnosticLocation {
  return {
    file: DOT_FILE,
    edge: { source: stmt.source, target: stmt.target },
    line: stmt.line,
    column: stmt.column,
  };
}

function describeEdge(edge: { source: string; target: string }): string {
  return `\`${edge.source} -> ${edge.target}\``;
}

/** "`draft` (`json`), `log` (`text`)" — ports as the author declared them. */
function portList(ports: readonly Port[]): string {
  return ports.map((p) => `\`${p.name}\` (\`${p.type}\`)`).join(", ");
}

/** The distinct types of a port list, in declaration order. */
function typeList(ports: readonly Port[]): string {
  const seen: string[] = [];
  for (const port of ports) {
    if (!seen.includes(port.type)) seen.push(port.type);
  }
  return seen.map((t) => `\`${t}\``).join(", ");
}

/** The hex half of "sha256:<hex>", so a pin may be written with or without the prefix. */
function digestHex(digest: string): string {
  const colon = digest.indexOf(":");
  return colon === -1 ? digest : digest.slice(colon + 1);
}

/**
 * §8: an input accepts an output when the types are equal, when the output is a
 * *narrower* kind of what the input asks for, or when either side is `any`. The
 * `any` clauses are not redundant with `isA`: a local or unknown type id is not in
 * the core lattice, so nothing subsumes it.
 */
function compatible(source: Port, target: Port, ontology: OntologyView): boolean {
  if (source.type === target.type) return true;
  if (source.type === ANY_TYPE || target.type === ANY_TYPE) return true;
  return ontology.isA(source.type, target.type);
}

/* --------------------- the resolver --------------------- */

/**
 * Join a raw bundle into a blueprint whose every reference has been checked.
 * Never throws: every problem with the upload comes back as a `Diagnostic`.
 *
 * Resolution degrades: a node whose card is missing drops out of `nodes` but stays
 * in `graph`, so the topology the author wrote is the topology the analyzers see.
 * `blueprint` is withheld only when there is no graph to hang it on — the DOT did
 * not parse, or it is not directed. Callers that need a clean bundle should test
 * `hasErrors(diagnostics)` rather than the presence of `blueprint`.
 *
 * The returned diagnostics also carry the Attractor linter's `attractor/*` warnings,
 * which never block a result, and the returned blueprint carries its `phaseCoverage`.
 */
export function resolveBundle(bundle: Bundle, ontology: OntologyView): ResolveResult {
  const ds: Diagnostic[] = [];

  /* ---------- 1. topology ---------- */
  const parsed = parseDot(bundle.dot, DOT_FILE);
  ds.push(...parsed.diagnostics);
  const dot = parsed.graph;
  if (dot === undefined || !dot.directed) {
    // An undirected graph parses, but every check below reads direction: which node
    // is upstream, what flows into what, where a run enters. Resolving it would mean
    // reporting mismatches against a direction the author never wrote, so we stop.
    // `parseDot` has already reported why.
    //
    // The Attractor linter is not run on this path either. Its first rule would report
    // `attractor/undirected-graph`, which is the same fact `dot/not-directed` has just
    // stated as an error; saying it twice in two namespaces would suggest two problems.
    return { diagnostics: sortDiagnostics(ds) };
  }

  // Doc 1 §0.1.1: the DOT DarkPrint reads must stay runnable by Attractor. Warnings
  // only, and merged here rather than left to a separate call so that an author who
  // uploads a bundle learns it once, at the moment the bundle is checked.
  ds.push(...lintAttractor(dot, bundle.dot, DOT_FILE));

  /* ---------- 2. the card files ---------- */
  const entries = new Map<CardRef, CardEntry>();
  /** Card id -> the versions the bundle carries, in filename order. Drives the hints. */
  const versionsById = new Map<string, string[]>();

  // Sorted, so "the first file wins" is a property of the bundle rather than of the
  // order the caller happened to build the record in.
  for (const file of Object.keys(bundle.cardFiles).sort(cmpString)) {
    const loaded = loadCard(bundle.cardFiles[file], { ontology, file });
    ds.push(...loaded.diagnostics);
    const card = loaded.card;
    if (card === undefined) continue;

    const ref = cardRef(card.id, card.version);
    const digest = cardDigest(card);
    const existing = entries.get(ref);
    if (existing !== undefined) {
      // §4: a published version is immutable. Two files claiming the same version
      // with different content leave the reference undecidable; identical content is
      // mere duplication and deduplicates for free.
      if (existing.digest !== digest) {
        ds.push(
          error(
            "bundle/digest-mismatch",
            `Card \`${ref}\` is declared twice with different content, in \`${existing.file}\` and \`${file}\`.`,
            {
              hint: "A published version is never edited in place — give the second one a new version.",
              location: { file, cardRef: ref },
            },
          ),
        );
      }
      continue;
    }

    entries.set(ref, { card, digest, file });
    const versions = versionsById.get(card.id);
    if (versions === undefined) versionsById.set(card.id, [card.version]);
    else versions.push(card.version);
  }

  /*
   * §4's bump rule, applied where a bundle gives it two versions to compare.
   *
   * `validateCard` has always known how to check this and has always needed the caller
   * to hand it the predecessor, and no caller did — so the rule shipped as an error code
   * nothing could raise while `/spec` described it as one that refuses a bundle. A bundle
   * carrying two versions of one card id is the case where the predecessor is right here,
   * so this is where the check belongs. `checkVersionChain` orders them and holds every
   * consecutive pair to the rule; a bundle with one version of each card is untouched.
   */
  const byCardId = new Map<string, { card: NodeCard; file?: string }[]>();
  for (const entry of entries.values()) {
    const chain = byCardId.get(entry.card.id);
    if (chain === undefined) byCardId.set(entry.card.id, [{ card: entry.card, file: entry.file }]);
    else chain.push({ card: entry.card, file: entry.file });
  }
  for (const chain of byCardId.values()) {
    if (chain.length > 1) ds.push(...checkVersionChain(chain));
  }

  /* ---------- 3. nodes: the card pointer (§2, §4) ---------- */
  const nodes: ResolvedNode[] = [];
  const byNodeId = new Map<string, ResolvedNode>();
  const usedRefs = new Set<CardRef>();

  /** How the bundle would help the author pick a version of `id`. */
  const availability = (id: string): string | undefined => {
    const versions = versionsById.get(id);
    if (versions === undefined || versions.length === 0) return undefined;
    return `The bundle carries ${versions.map((v) => `\`${cardRef(id, v)}\``).join(", ")}.`;
  };

  /** The ref a node points at, or `undefined` once the reason has been reported. */
  const referenceFor = (stmt: DotNodeStmt): CardRef | undefined => {
    const location = nodeLocation(stmt);

    // Canonical form. It wins over `version` when both are present: it is the one
    // that can name a card whose id differs from the node id.
    const explicit = attr(stmt.attrs, "card");
    if (explicit !== undefined) {
      const ref = parseCardRef(explicit);
      if (ref !== undefined) return cardRef(ref.id, ref.version);
      ds.push(
        error(
          "bundle/unpinned-card",
          explicit.includes("@")
            ? `Node \`${stmt.id}\` references \`${explicit}\`, which is not a pinned \`id@version\` reference.`
            : `Node \`${stmt.id}\` references card \`${explicit}\` without a version.`,
          {
            hint: '§4 pins the exact version so two evaluations describe the same node: write `card="solver-a@1.2.0"`.',
            location,
          },
        ),
      );
      return undefined;
    }

    // Fallback form: the node id doubles as the card id, `version` pins it.
    const version = attr(stmt.attrs, "version");
    if (version !== undefined) {
      const ref = parseCardRef(cardRef(stmt.id, version.trim()));
      if (ref !== undefined) return cardRef(ref.id, ref.version);
      // Two ways to get here; asking the parser about the id alone tells them apart.
      if (parseCardRef(cardRef(stmt.id, PROBE_VERSION)) === undefined) {
        ds.push(
          error(
            "bundle/missing-card",
            `Node \`${stmt.id}\` has no \`card\` attribute and its id is not a legal card id, so it names no card.`,
            {
              hint: 'Point at the card explicitly: `card="solver-a@1.0.0"`.',
              location,
            },
          ),
        );
      } else {
        ds.push(
          error(
            "bundle/unpinned-card",
            `Node \`${stmt.id}\` pins version \`${version}\`, which is not an exact version.`,
            {
              hint: '§4 pins the exact version so two evaluations describe the same node: write `version="1.2.0"`.',
              location,
            },
          ),
        );
      }
      return undefined;
    }

    // No pointer at all. When the bundle carries a card under this id the author
    // plainly meant it and only forgot to pin; otherwise there is nothing to point at.
    const available = availability(stmt.id);
    if (available !== undefined) {
      ds.push(
        error(
          "bundle/unpinned-card",
          `Node \`${stmt.id}\` does not say which version of card \`${stmt.id}\` it instantiates.`,
          { hint: `Add \`version="…"\` or \`card="…"\`. ${available}`, location },
        ),
      );
    } else {
      ds.push(
        error("bundle/missing-card", `Node \`${stmt.id}\` does not point at a card.`, {
          hint: 'Add `card="solver-a@1.0.0"`, or `version="1.0.0"` when the node id is the card id.',
          location,
        }),
      );
    }
    return undefined;
  };

  for (const stmt of dot.nodes) {
    const ref = referenceFor(stmt);
    if (ref === undefined) continue;

    // Rule 1: every identifier in the DOT has its card.
    const entry = entries.get(ref);
    if (entry === undefined) {
      const parsedRef = parseCardRef(ref);
      const available = parsedRef === undefined ? undefined : availability(parsedRef.id);
      ds.push(
        error(
          "bundle/missing-card",
          `Node \`${stmt.id}\` instantiates card \`${ref}\`, which is not in the bundle.`,
          {
            hint: available ?? `Add the card file for \`${ref}\` to the bundle.`,
            location: { ...nodeLocation(stmt), cardRef: ref },
          },
        ),
      );
      continue;
    }

    // Optional integrity pin: a prefix of the real digest, with or without the
    // algorithm prefix, so a short display digest can be pasted straight in.
    const pin = attr(stmt.attrs, "digest");
    if (pin !== undefined) {
      const wanted = pin.trim().toLowerCase();
      const matches =
        wanted.length > 0 &&
        (entry.digest.startsWith(wanted) ||
          (!wanted.includes(":") && digestHex(entry.digest).startsWith(wanted)));
      if (!matches) {
        ds.push(
          error(
            "bundle/digest-mismatch",
            `Node \`${stmt.id}\` pins digest \`${pin}\`, but card \`${ref}\` hashes to something else.`,
            {
              hint: `The card hashes to \`${entry.digest}\` — pin that, or drop the \`digest\` attribute.`,
              location: { ...nodeLocation(stmt), cardRef: ref },
            },
          ),
        );
      }
    }

    const node: ResolvedNode = {
      nodeId: stmt.id,
      ref,
      card: entry.card,
      digest: entry.digest,
      attrs: stmt.attrs,
    };
    nodes.push(node);
    byNodeId.set(stmt.id, node);
    usedRefs.add(ref);
  }

  // Rule 2: no card in the bundle goes unreferenced.
  for (const [ref, entry] of entries) {
    if (usedRefs.has(ref)) continue;
    ds.push(
      warning("bundle/orphan-card", `Card \`${ref}\` is in the bundle but no node instantiates it.`, {
        hint: `Add a node with \`card="${ref}"\`, or drop \`${entry.file}\` from the bundle.`,
        location: { file: entry.file, cardRef: ref },
      }),
    );
  }

  /* ---------- 4. edges: the interfaces (§2 "ruolo degli archi") ---------- */

  /**
   * Rule 3. Explicit `out=`/`in=` win; otherwise the unique type-compatible pairing
   * is inferred. Several pairings are a warning and the first is taken, so analysis
   * still runs; none at all is an error.
   */
  const wirePorts = (stmt: DotEdgeStmt, from: ResolvedNode, to: ResolvedNode): WiredPorts => {
    const location = edgeLocation(stmt);
    const named = describeEdge(stmt);
    const outputs = from.card.outputs;
    const inputs = to.card.inputs;

    const pinnedOut = attr(stmt.attrs, "out");
    const pinnedIn = attr(stmt.attrs, "in");
    const wired: WiredPorts = {};
    let brokenPin = false;

    if (pinnedOut !== undefined) {
      const found = outputs.find((p) => p.name === pinnedOut.trim());
      if (found === undefined) {
        brokenPin = true;
        ds.push(
          error(
            "bundle/port-mismatch",
            `Edge ${named} pins the output port \`${pinnedOut}\`, which card \`${from.ref}\` does not declare.`,
            {
              hint:
                outputs.length === 0
                  ? "It declares no outputs at all."
                  : `It declares ${portList(outputs)}.`,
              location,
            },
          ),
        );
      } else {
        wired.fromPort = found;
      }
    }
    if (pinnedIn !== undefined) {
      const found = inputs.find((p) => p.name === pinnedIn.trim());
      if (found === undefined) {
        brokenPin = true;
        ds.push(
          error(
            "bundle/port-mismatch",
            `Edge ${named} pins the input port \`${pinnedIn}\`, which card \`${to.ref}\` does not declare.`,
            {
              hint:
                inputs.length === 0
                  ? "It declares no inputs at all."
                  : `It declares ${portList(inputs)}.`,
              location,
            },
          ),
        );
      } else {
        wired.toPort = found;
      }
    }
    // A pin that names nothing is a typo, and guessing what it meant to say would
    // bury it under a second, invented diagnostic.
    if (brokenPin) return wired;

    if (wired.fromPort !== undefined && wired.toPort !== undefined) {
      if (!compatible(wired.fromPort, wired.toPort, ontology)) {
        ds.push(typeMismatch(named, from.nodeId, to.nodeId, [wired.fromPort], [wired.toPort], location));
      }
      return wired;
    }

    // The candidates on each side: the pinned port alone, or everything declared.
    const fromCandidates = wired.fromPort === undefined ? outputs : [wired.fromPort];
    const toCandidates = wired.toPort === undefined ? inputs : [wired.toPort];

    if (fromCandidates.length === 0 || toCandidates.length === 0) {
      const missing =
        fromCandidates.length === 0 && toCandidates.length === 0
          ? `\`${from.nodeId}\` declares no output ports and \`${to.nodeId}\` declares no input ports`
          : fromCandidates.length === 0
            ? `\`${from.nodeId}\` declares no output ports`
            : `\`${to.nodeId}\` declares no input ports`;
      ds.push(
        error("bundle/port-mismatch", `Edge ${named} carries no data: ${missing}.`, {
          hint: "An edge is an interface (§2): declare the port it carries on both cards, or remove the edge.",
          location,
        }),
      );
      return wired;
    }

    const pairs: [Port, Port][] = [];
    for (const output of fromCandidates) {
      for (const input of toCandidates) {
        if (compatible(output, input, ontology)) pairs.push([output, input]);
      }
    }

    if (pairs.length === 0) {
      ds.push(typeMismatch(named, from.nodeId, to.nodeId, fromCandidates, toCandidates, location));
      return wired;
    }

    // Declaration order decides, so the same bundle always resolves the same way.
    const [output, input] = pairs[0];
    if (pairs.length > 1) {
      ds.push(
        warning(
          "bundle/port-ambiguous",
          `Edge ${named} has ${pairs.length} type-compatible pairings, so which data it carries is ambiguous.`,
          {
            hint: `\`${output.name}\` → \`${input.name}\` was assumed; pin it with \`out="${output.name}", in="${input.name}"\`.`,
            location,
          },
        ),
      );
    }
    wired.fromPort = output;
    wired.toPort = input;
    return wired;
  };

  /**
   * Doc 2 §3, made checkable. A `cannot` entry that names a `data-type` is a declared
   * prohibition on receiving it, so an edge into this node that can carry the type puts
   * the card and the graph in contradiction.
   *
   * **Which types the edge can carry.** When the author pinned the output with `out=`,
   * that port alone: they have said what this edge is for, and the whole engine already
   * treats a pin as authoritative. With no pin, every output the source card declares,
   * because the pairing chosen a few lines above is this resolver's reading of an
   * under-specified edge and not a statement by the author. The same edge would otherwise
   * be a leak to doc 3 §4.1, which reads `criteria-leak` at node level, and clean to this
   * check, and two isolation checks disagreeing about one edge is worse than either
   * answer.
   *
   * **What counts as carrying it.** `isA(carried, prohibited)`, which is reflexive, so an
   * exact match holds and a narrower type does too: a node refusing `structured` is
   * refusing the `acceptance-criteria` that specialise it. The subsumption runs one way
   * only. An output typed `any` asserts nothing about its contents and is not read as a
   * violation of a narrower prohibition, since inventing one would fire on every
   * permissive card in the archive.
   *
   * Entries naming no `data-type` are skipped in silence. They are free text addressed to
   * a reader (`NodeCard.cannot`), and `card/unknown-term` deliberately does not fire on
   * them either.
   */
  const checkProhibitions = (stmt: DotEdgeStmt, from: ResolvedNode, to: ResolvedNode): void => {
    const prohibitions = to.card.cannot;
    if (prohibitions.length === 0) return;

    const pinnedOut = attr(stmt.attrs, "out");
    // A pin that names nothing has already been reported as `bundle/port-mismatch`; it
    // leaves no carrier here rather than falling back to every output, which would answer
    // a question about a typo with a second, unrelated error.
    const carriers =
      pinnedOut === undefined
        ? from.card.outputs
        : from.card.outputs.filter((p) => p.name === pinnedOut.trim());
    if (carriers.length === 0) return;

    const seen = new Set<string>();
    for (const entry of prohibitions) {
      // Deprecated spellings resolve to their successor (§6.2), so an old id still names
      // the prohibition it always named.
      const term = ontology.resolve(entry, "data-type");
      if (term === undefined) continue;
      if (seen.has(term.term.id)) continue;
      const carried = carriers.find((p) => ontology.isA(p.type, term.term.id));
      if (carried === undefined) continue;
      seen.add(term.term.id);
      ds.push(
        error(
          "bundle/prohibition-violated",
          `Card \`${to.ref}\` declares that \`${to.nodeId}\` cannot receive \`${entry}\`, and edge ${describeEdge(stmt)} carries that type.`,
          {
            hint: `\`${from.nodeId}\` declares the output \`${carried.name}\` (\`${carried.type}\`). Remove the edge, or take \`${entry}\` out of \`cannot\` on \`${to.card.id}\`.`,
            location: { ...edgeLocation(stmt), nodeId: to.nodeId, cardRef: to.ref },
          },
        ),
      );
    }
  };

  const edges: ResolvedEdge[] = [];
  for (const stmt of dot.edges) {
    const edge: ResolvedEdge = { source: stmt.source, target: stmt.target, attrs: stmt.attrs };
    const label = attr(stmt.attrs, "label");
    if (label !== undefined) edge.label = label;

    const from = byNodeId.get(stmt.source);
    const to = byNodeId.get(stmt.target);
    // An endpoint with no card has already been reported; port diagnostics on top of
    // that would only be a cascade of the same fact.
    if (from !== undefined && to !== undefined) {
      const wired = wirePorts(stmt, from, to);
      if (wired.fromPort !== undefined) edge.fromPort = wired.fromPort;
      if (wired.toPort !== undefined) edge.toPort = wired.toPort;
      checkProhibitions(stmt, from, to);
    }
    edges.push(edge);
  }

  /* ---------- 5. structure ---------- */
  const graph = buildGraph(
    dot.nodes.map((n) => n.id),
    dot.edges.map((e) => ({ source: e.source, target: e.target })),
  );

  /**
   * §8 states the two halves of the rule unconditionally: a declared dependency needs a
   * matching edge (error), and an edge needs a matching declaration (warning). The
   * second half is exactly the case a card that declares nothing falls into — §3.3 has
   * `dependencies` make the link explicit, so leaving it empty under an incoming edge is
   * the omission the warning exists to point at.
   */
  for (const node of nodes) {
    const declared = node.card.dependencies;

    // A predecessor with no card is skipped on both counts below: it is already a
    // `bundle/missing-card`, and naming it again would report one broken pointer twice.
    const incoming: { nodeId: string; cardId: string }[] = [];
    for (const predecessor of graph.predecessors(node.nodeId)) {
      const supplier = byNodeId.get(predecessor);
      if (supplier !== undefined) {
        incoming.push({ nodeId: predecessor, cardId: supplier.card.id });
      }
    }
    // Both spellings are accepted: the card id is what §4 pins, and the DOT node id is
    // the same string whenever the fallback pointer convention is in use.
    const supplied = new Set(incoming.flatMap((i) => [i.cardId, i.nodeId]));

    // The offending text is in the card, so the location points there, not at the DOT.
    const cardFile = entries.get(node.ref)?.file;
    declared.forEach((dependency, index) => {
      if (supplied.has(dependency)) return;
      const location: DiagnosticLocation = {
        cardRef: node.ref,
        nodeId: node.nodeId,
        path: `dependencies[${index}]`,
      };
      if (cardFile !== undefined) location.file = cardFile;
      ds.push(
        error(
          "bundle/missing-dependency",
          `Card \`${node.ref}\` declares a dependency on \`${dependency}\`, but no edge into \`${node.nodeId}\` comes from it.`,
          {
            hint: `Add \`${dependency} -> ${node.nodeId}\` to the DOT, or drop the dependency.`,
            location,
          },
        ),
      );
    });

    const declaredSet = new Set(declared);
    for (const supplier of incoming) {
      if (declaredSet.has(supplier.cardId) || declaredSet.has(supplier.nodeId)) continue;
      ds.push(
        warning(
          "bundle/undeclared-dependency",
          `Node \`${node.nodeId}\` receives data from \`${supplier.nodeId}\`, which card \`${node.ref}\` does not list as a dependency.`,
          {
            hint: `Add \`${supplier.cardId}\` to \`dependencies\`, or remove the edge.`,
            location: {
              file: DOT_FILE,
              nodeId: node.nodeId,
              cardRef: node.ref,
              edge: { source: supplier.nodeId, target: node.nodeId },
            },
          },
        ),
      );
    }
  }

  // An empty graph has exactly one problem and it is not "no entry"; the analyzers
  // report it as `analysis/empty-graph` (§10, §11).
  if (graph.ids.length > 0) {
    if (graph.sources().length === 0) {
      ds.push(
        warning("bundle/no-entry", "Every node has an incoming edge, so the blueprint has no entry point.", {
          hint: "A run has to start somewhere: give one node — a trigger — no incoming edges.",
          location: { file: DOT_FILE },
        }),
      );
    } else {
      // Only meaningful when there *is* a source: with none, `reachable()` is empty
      // and every node would be flagged on top of `bundle/no-entry`.
      const reachable = graph.reachable();
      for (const stmt of dot.nodes) {
        if (reachable.has(stmt.id)) continue;
        ds.push(
          warning("bundle/unreachable-node", `Node \`${stmt.id}\` cannot be reached from any entry point.`, {
            hint: `Add an edge into \`${stmt.id}\` from the reachable part of the graph, or remove it.`,
            location: nodeLocation(stmt),
          }),
        );
      }
    }
    if (graph.sinks().length === 0) {
      ds.push(
        warning("bundle/no-exit", "Every node has an outgoing edge, so the blueprint has no exit point.", {
          hint: "A run has to end somewhere: give one node — a sink — no outgoing edges.",
          location: { file: DOT_FILE },
        }),
      );
    }
  }

  /* ---------- 6. the declared vocabulary (§6.2) ---------- */
  if (bundle.manifest.ontologyVersion !== ontology.ontology.version) {
    ds.push(
      warning(
        "bundle/ontology-mismatch",
        `The bundle is written against ontology \`${bundle.manifest.ontologyVersion}\`, but it is being read against \`${ontology.ontology.version}\`.`,
        {
          hint: "Terms may have been added, deprecated or re-parented since; check the migration notes before trusting the analysis.",
        },
      ),
    );
  }
  for (const [ref, entry] of entries) {
    if (entry.card.ontologyVersion === bundle.manifest.ontologyVersion) continue;
    ds.push(
      warning(
        "bundle/ontology-mismatch",
        `Card \`${ref}\` is written against ontology \`${entry.card.ontologyVersion}\`, but the bundle declares \`${bundle.manifest.ontologyVersion}\`.`,
        {
          hint: `Set \`ontology_version: ${bundle.manifest.ontologyVersion}\` once the card has been checked against that vocabulary.`,
          location: { file: entry.file, cardRef: ref },
        },
      ),
    );
  }

  /* ---------- 7. the blueprint ---------- */
  const cards = new Map<CardRef, NodeCard>();
  for (const [ref, entry] of entries) cards.set(ref, entry.card);

  const blueprint: ResolvedBlueprint = {
    manifest: bundle.manifest,
    dot: bundle.dot,
    // The digests of the cards the graph *pins*, one per node: an orphan card is not
    // part of what the blueprint runs, and pinning one card twice is not the same
    // bundle as pinning it once (§4).
    digest: bundleDigest({ dot: bundle.dot, cardDigests: nodes.map((n) => n.digest) }),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    graph,
    ontology,
    cards,
    // Seeded, then filled on the next line. `computePhaseCoverage` is declared over a
    // whole `ResolvedBlueprint` (spec PART 4.5), so the object has to exist before its
    // own coverage can be computed. The two statements are adjacent and nothing observes
    // the object between them; re-implementing the grouping here to avoid the seed would
    // give the engine two answers to one question, which is worse.
    phaseCoverage: { covered: [], missing: [], byPhase: {}, unphased: [] },
  };
  blueprint.phaseCoverage = computePhaseCoverage(blueprint);

  return { blueprint, diagnostics: sortDiagnostics(ds) };
}

/** The rule-3 failure, phrased so both sides' types appear whatever their arity. */
function typeMismatch(
  named: string,
  sourceId: string,
  targetId: string,
  outputs: readonly Port[],
  inputs: readonly Port[],
  location: DiagnosticLocation,
): Diagnostic {
  return error(
    "bundle/type-mismatch",
    `Edge ${named} has no compatible ports: \`${sourceId}\` produces ${typeList(outputs)}, \`${targetId}\` accepts ${typeList(inputs)}.`,
    {
      hint: `Change one of the declared types, or put an adapter node between \`${sourceId}\` and \`${targetId}\`.`,
      location,
    },
  );
}
