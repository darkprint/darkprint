import Link from "next/link";
import { notFound } from "next/navigation";
import type { JsonValue, NodeCard } from "@/lib/core";
import { shortDigest } from "@/lib/core";
import {
  allNodeCards,
  cardSource,
  getOntologyView,
  getRegistry,
  nodeCardVersions,
} from "@/lib/content";
import { commentsFor, downloadsFor } from "@/lib/data/node-community";
import { getAuthor } from "@/lib/data/users";
import { compact, cx } from "@/lib/format";
import { CARD_BLOCKS } from "@/components/panes/model";
import { termHref } from "@/lib/href";
import { Comments } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { AuthorChip } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { SourcePanel } from "@/components/ui/SourcePanel";
import { formatWeight, markerWeight } from "@/components/ontology/TermTable";
import {
  NodeInterfaces,
  type DependencyView,
  type PortView,
} from "@/components/nodes/NodeInterfaces";
import {
  Ticked,
  VersionHistory,
  type NodeVersion,
} from "@/components/nodes/VersionHistory";

/**
 * An id outside `generateStaticParams` is a 404 at build time rather than a render at
 * request time. The archive reader behind this page walks `content/` off the working
 * directory, which is a build-time fact — letting it run inside a request makes an
 * unknown id depend on where the server happens to be started from. The site is fully
 * static, so there is nothing an on-demand render could produce that the build did not.
 *
 * **Catch-all, for the same reason `/ontology/[...term]` is.** A card id may be
 * namespaced (doc 3 §7, `berti/solver-a`), and a `/` inside a single dynamic segment is
 * a separator rather than a character: the build would write `nodes/berti%2Fsolver-a`,
 * Next decodes the pathname before matching it, and the page would 404 on every route
 * into it. No card in the archive is namespaced today, so this was latent where the
 * ontology's was live — it moves in the same change because it is the same bug, and
 * finding it later would mean finding it through a contributor's broken link.
 */
export const dynamicParams = false;

/** One page per distinct card id; the newest version is what the bare id means. */
export function generateStaticParams() {
  return allNodeCards().map((record) => ({ id: record.id.split("/") }));
}

export async function generateMetadata({ params }: PageProps<"/nodes/[...id]">) {
  const { id } = await params;
  const record = nodeCardVersions(id.join("/"))[0];
  if (!record) return { title: "Node card not found" };
  return { title: record.card.name, description: record.card.action };
}

/* --------------------- small local furniture --------------------- */

/**
 * The two label steps, which used to be one.
 *
 * `LABEL` was every section heading on this page *and* every sub-group label inside
 * them: `Interfaces` and `Cannot receive` were set exactly like `Phases`, `Agent`,
 * `Tools` and `Parameters`, at 11px `text-dim`. Eleven label strings across three
 * structural levels in one style, on a page 4300–5500px long where the section heading
 * is the only wayfinding there is. Below it the H1 is 36px, so the type scale stepped
 * 36 → 11 with nothing in between and 65% of the page's characters at 12px or under.
 *
 * `SECTION` is the step that was missing: same mono and same tracking, so it still reads
 * as the same family, but 13px and `text-fg` — brighter and larger than anything nested
 * inside it. A reader scanning for a section now has one thing to look for.
 */
const SECTION = "font-mono text-[13px] uppercase tracking-[0.18em] text-fg";
const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

/**
 * Main-column panel: a hairline header bar over its body, like the schematic's.
 *
 * `lead` marks the one panel that answers the question the page exists for. Every panel
 * wore the identical `.panel` frame — one 1px `#222739` edge on `#0a0c16`, nine times —
 * so `Specification`, which says what the node does, was indistinguishable from
 * `Model, skill and servers`, which is a prerequisite checklist. With no weighting every
 * scan costs the same, which is the same as saying nothing gets scanned.
 *
 * The lead is marked by its *edge and its ground*, not by a bigger heading: the heading
 * scale is doing structural work already (36 → 20 → 13 → 11) and adding a fourth size
 * for emphasis would break the thing it just fixed. A brighter border and a lifted
 * surface say "start here" without claiming a different level.
 *
 * The treatment is `.panel-lead` in `globals.css` rather than utilities here, because
 * `.panel` is unlayered and unlayered CSS outranks Tailwind's layers: the first attempt
 * put `border-line-bright bg-surface-2/40` on this element and rendered identically to
 * every other panel. Measured, not assumed — both borders came back `rgb(34,39,57)`.
 */
/* ============================================================
   Every field a card can declare, grouped the way the skeleton
   groups them, with its detail one click away.

   ── The blocks ──
   The author: partition the table "following the division
   provided in a given blueprint related to a node", pointing at
   `SkeletonPane`. So the groups, their order, their doc
   references and their one-line purposes are `CARD_BLOCKS` from
   `components/panes/model.ts`, imported rather than restated: the
   skeleton and this table are two drawings of one document and a
   second copy of the grouping would drift.

   Three fields the card carries are not in doc 1 §3's blocks and
   are placed here, once, with the reason:

     skill   behaviour. It is literally the behaviour document.
     mcp     behaviour. What it reaches in order to do the work.
     cannot  interfaces. §3.3 is "what arrives, what leaves"; a
             prohibition is the one thing that must not arrive.

   ── Why the detail is a click and not prose ──
   The author asked the explanations off the default view ("non
   dobbiamo dire all'utente perché tanto deve essere
   autoesplicativa") and then asked for them back on demand: "on
   click of the field, it shows the details". So the resting state
   is a field and a value, and everything that was prose is behind
   a `<details>`. Native, so it needs no client component and it
   opens for a reader without script.

   A row with nothing more to say is a plain `div`. A summary that
   opens onto nothing is worse than no affordance at all.
   ============================================================ */
interface FieldValue {
  text: string;
  empty: boolean;
}

/** What the detail functions are allowed to read, resolved once by the page. */
interface FieldView {
  phases: { id: string; label: string; href: string; description?: string }[];
  tools: { id: string; label: string }[];
  params_: [string, JsonValue][];
  risks: { id: string; label: string; description?: string; weight?: number }[];
  prohibitions: ProhibitionView[];
  dependencies: DependencyView[];
  inputs: PortView[];
  outputs: PortView[];
}

interface FieldRow {
  /** A `CARD_BLOCKS` id. */
  block: string;
  name: string;
  read: (card: NodeCard, view: FieldView) => FieldValue;
  /** Everything this page used to say in prose, behind the disclosure. */
  detail?: (card: NodeCard, view: FieldView) => React.ReactNode | undefined;
  /** Where the field is drawn in full, when a panel on this page already does it. */
  seeHref?: string;
  seeLabel?: string;
}

/** `none`, or the joined list. One helper so every empty row reads the same way. */
function list(values: readonly string[], empty = "none"): FieldValue {
  return values.length === 0
    ? { text: empty, empty: true }
    : { text: values.join(", "), empty: false };
}

/** A long prose field, measured rather than reprinted in the resting row. */
function words(value: string | undefined): FieldValue {
  const text = value?.trim() ?? "";
  return text === ""
    ? { text: "none", empty: true }
    : { text: `${text.split(/\s+/).length} words`, empty: false };
}

function one(value: string | undefined, empty = "not named"): FieldValue {
  return value === undefined || value === ""
    ? { text: empty, empty: true }
    : { text: value, empty: false };
}

/** A paragraph inside a disclosure. One class, so every detail reads the same. */
function Detail({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-muted">{children}</p>;
}

/** A `name : type` pair with its description, for the two port fields. */
function Ports({ ports }: { ports: readonly PortView[] }) {
  return (
    <div className="flex flex-col gap-2">
      {ports.map((p) => (
        <div key={p.name} className="flex flex-col gap-0.5">
          <span className="font-mono text-[12px] text-fg">
            {p.name} : {p.type}
            {!p.required && <span className="text-dim"> (optional)</span>}
            {!p.known && <span className="text-dim"> (not a vocabulary term)</span>}
          </span>
          {p.description !== undefined && (
            <span className="text-[13px] leading-relaxed text-muted">{p.description}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const FIELD_ROWS: readonly FieldRow[] = [
  { block: "identity", name: "id", read: (c) => one(c.id) },
  { block: "identity", name: "name", read: (c) => one(c.name) },
  {
    block: "identity",
    name: "type",
    read: (c) => one(c.type),
  },
  {
    block: "identity",
    name: "phases",
    read: (_c, v) => list(v.phases.map((p) => p.label), "outside the five"),
    detail: (_c, v) =>
      v.phases.length === 0 ? (
        /* The author's ruling, kept: the five phases describe a blueprint's shape and not
           every node in one, so declaring none is an answer. It is the case a reader is
           most likely to click on, which is why it earns a detail where a filled row of
           labels does not. */
        <Detail>
          The phases describe a blueprint&apos;s shape, not every node in one: intake,
          retrieval and routing are real work none of the five names. Declaring none is an
          answer, not a blank.
        </Detail>
      ) : (
        <div className="flex flex-col gap-2">
          {v.phases.map((phase) => (
            <Detail key={phase.id}>
              <span className="text-fg">{phase.label}.</span>{" "}
              {phase.description ??
                "Outside the five phases the vocabulary closes on, so the card names it and nothing here interprets it."}
            </Detail>
          ))}
          <p className="text-xs leading-relaxed text-dim">
            A blueprint covers the union of its nodes&apos; phases. That is scope, not
            completeness.
          </p>
        </div>
      ),
  },

  /* A word count, not the sentence. `action` is this page's opening lead verbatim, and
     printing it again 600px below is the duplication `docs/content-reorg` already caught
     here once. It is behind the click instead, where a reader has asked for it. */
  {
    block: "behaviour",
    name: "action",
    read: (c) => words(c.action),
    detail: (c) => (c.action === undefined ? undefined : <Detail>{c.action}</Detail>),
  },
  {
    block: "behaviour",
    name: "spec",
    read: (c) => words(c.spec),
    seeHref: "#specification",
    seeLabel: "in full above",
  },
  {
    block: "behaviour",
    name: "model",
    read: (c) => one(c.model, "whatever the graph supplies"),
    detail: (c) =>
      c.model === undefined ? (
        <Detail>Whatever the graph or the runner supplies. The ordinary case.</Detail>
      ) : (
        <Detail>
          What its agent runs on.{" "}
          <span className="text-fg">A default, not a fixed fact:</span> a graph&apos;s{" "}
          <code className="font-mono text-[12px] text-muted">model_stylesheet</code> can
          override it.
        </Detail>
      ),
  },
  {
    block: "behaviour",
    name: "agent",
    read: (c) => one(c.agent),
    detail: (c) =>
      c.agent === undefined ? undefined : (
        <Detail>A label the author chose. Nothing in the engine reads it.</Detail>
      ),
  },
  {
    block: "behaviour",
    name: "skill",
    read: (c) => one(c.skill),
    detail: (c) =>
      c.skill === undefined ? (
        <Detail>
          None. The card&apos;s <code className="font-mono text-[12px] text-muted">spec</code>{" "}
          is the whole instruction.
        </Detail>
      ) : (
        <Detail>
          Where its written procedure lives, relative to the repository you run from.{" "}
          <span className="text-fg">
            A pointer only: no skill document travels in a DarkPrint bundle.
          </span>{" "}
          You write the file it names.
        </Detail>
      ),
  },
  {
    block: "behaviour",
    name: "tools",
    read: (_c, v) => list(v.tools.map((t) => t.label)),
    detail: (_c, v) =>
      v.tools.length === 0 ? undefined : (
        <div className="flex flex-wrap gap-1.5">
          {v.tools.map((tool) => (
            <TermChip
              key={tool.id}
              href={termHref(tool.id)}
              label={tool.label}
              aria={`Ontology tool: ${tool.label}`}
            />
          ))}
        </div>
      ),
  },
  {
    block: "behaviour",
    name: "mcp",
    read: (c) => list(c.mcp),
    detail: (c) =>
      c.mcp.length === 0 ? undefined : (
        <Detail>
          Servers it reaches, named as they are registered on your machine. Free text: the
          vocabulary has no term for a process somebody installed.
        </Detail>
      ),
  },
  {
    block: "behaviour",
    name: "params",
    read: (_c, v) => list(v.params_.map(([key]) => key)),
    detail: (_c, v) =>
      v.params_.length === 0 ? undefined : (
        <dl className="divide-y divide-line rounded-md border border-line bg-void/40">
          {v.params_.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4"
            >
              <dt className="font-mono text-[12px] text-dim">{key}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words font-mono text-[12px] text-fg">
                {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              </dd>
            </div>
          ))}
        </dl>
      ),
  },

  {
    block: "interfaces",
    name: "inputs",
    read: (c) => list(c.inputs.map((port) => `${port.name} : ${port.type}`)),
    detail: (_c, v) => (v.inputs.length === 0 ? undefined : <Ports ports={v.inputs} />),
  },
  {
    block: "interfaces",
    name: "outputs",
    read: (c) => list(c.outputs.map((port) => `${port.name} : ${port.type}`)),
    detail: (_c, v) => (v.outputs.length === 0 ? undefined : <Ports ports={v.outputs} />),
  },
  {
    block: "interfaces",
    name: "dependencies",
    read: (c) => list(c.dependencies),
    detail: (_c, v) =>
      v.dependencies.length === 0 ? undefined : (
        <Detail>
          Cards this one expects to hear from.{" "}
          {v.dependencies.filter((d) => !d.known).length > 0
            ? "An entry the registry does not publish names a DOT node rather than a card, so it has no page here."
            : "Every one of them is published here."}
        </Detail>
      ),
  },
  {
    block: "interfaces",
    name: "cannot",
    read: (c) => list(c.cannot),
    seeHref: "#prohibitions",
    seeLabel: "and what enforces it",
    detail: (_c, v) =>
      v.prohibitions.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {v.prohibitions.map((p) => (
            <Detail key={p.entry}>
              <code className="font-mono text-[12px] text-fg">{p.entry}</code>{" "}
              {p.term === undefined ? (
                <>
                  names no data type, so it is a sentence addressed to a reader and{" "}
                  <span className="text-fg">nothing enforces it</span>.
                </>
              ) : (
                <>
                  is a data type, so the resolver holds every incoming edge to it: a bundle
                  carrying it fails with{" "}
                  <code className="font-mono text-[12px] text-muted">
                    bundle/prohibition-violated
                  </code>
                  .
                </>
              )}
            </Detail>
          ))}
        </div>
      ),
  },

  {
    block: "evaluation",
    name: "requires_human",
    read: (c) => ({ text: String(c.requiresHuman), empty: !c.requiresHuman }),
    detail: (c) => (
      <Detail>
        {c.requiresHuman
          ? "A person acts here, so no graph containing this node is closed-loop."
          : "Nobody stands here. The node runs unattended whenever the graph reaches it."}
      </Detail>
    ),
  },
  {
    block: "evaluation",
    name: "risk_markers",
    read: (c) => list(c.riskMarkers),
    seeHref: "#evaluation",
    seeLabel: "priced, in the sidebar",
    detail: (_c, v) =>
      v.risks.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {v.risks.map((risk) => (
            <Detail key={risk.id}>
              <span className="text-fg">{risk.label}.</span>{" "}
              {risk.description ?? "Not a term the vocabulary knows, so nothing prices it."}
              {risk.weight !== undefined && (
                <>
                  {" "}
                  Costs{" "}
                  <span className="text-amber">{formatWeight(risk.weight)}</span> of the
                  blueprint&apos;s security reading.
                </>
              )}
            </Detail>
          ))}
        </div>
      ),
  },
  {
    block: "evaluation",
    name: "notes",
    read: (c) => words(c.notes),
    detail: (c) =>
      c.notes === undefined ? undefined : (
        <p className="border-l-2 border-line-bright pl-4 text-[13px] leading-relaxed text-muted">
          <Ticked text={c.notes} />
        </p>
      ),
  },

  { block: "service", name: "version", read: (c) => one(c.version) },
  { block: "service", name: "ontology_version", read: (c) => one(c.ontologyVersion) },
  { block: "service", name: "author", read: (c) => one(c.author, "unattributed") },
];

function Panel({
  id,
  label,
  meta,
  lead = false,
  children,
}: {
  id: string;
  label: string;
  meta?: string;
  /** The panel a reader should land on first. At most one per page. */
  lead?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cx("panel scroll-mt-24 overflow-hidden", lead && "panel-lead")}
      aria-labelledby={`${id}-heading`}
    >
      {/* The meta sits beside its heading, not at the far edge.
          `justify-between` held them apart across the full width of a 757px bar, so
          `Interfaces` and its `1 in · 1 out` were 543px apart and `Behaviour` and its
          agent name 540px — two things that answer each other, too far apart to be read
          as a pair, and on a phone the meta was pushed off-screen entirely. Capping the
          meta's width did nothing, because the gap was never about its width: with
          `justify-between` the position is the whole problem. Left-aligned with a fixed
          gap, the pair reads as one line and wraps together. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h2 id={`${id}-heading`} className={SECTION}>
          {label}
        </h2>
        {meta !== undefined && (
          <span className="min-w-0 font-mono text-[11px] text-dim">{meta}</span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * Sidebar panel: the flat `panel p-5` shape the blueprint page's aside uses.
 *
 * The `id` lands on the `<section>` as well as seeding the heading's. It used to seed
 * only the heading, so `id="evaluation"` existed nowhere in the rendered document and a
 * `href="#evaluation"` resolved to nothing — which `anchors.test.ts` cannot catch,
 * because it reads the JSX tag that spells `id="evaluation"` and that tag is this
 * component's *call site*, where the string is a prop rather than an attribute. The
 * guard checks the offset, not the existence of the target. Caught in the DOM instead.
 *
 * `className` is here so the same call site can carry its own `scroll-mt-`, which the
 * guard does read as source text and is right to insist on.
 */
function SidePanel({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cx("panel p-5", className)}
      aria-labelledby={`${id}-heading`}
    >
      <h2 id={`${id}-heading`} className={cx(SECTION, "mb-4 block")}>
        {label}
      </h2>
      {children}
    </section>
  );
}

/** A vocabulary term, rendered as the violet code chip the ontology pages use. */
function TermChip({ href, label, aria }: { href: string; label: string; aria: string }) {
  return (
    <Link
      href={href}
      aria-label={aria}
      className="inline-flex items-center rounded border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[12px] text-violet transition-colors hover:border-violet"
    >
      {label}
    </Link>
  );
}

/**
 * One entry of `cannot`, with the vocabulary lookup already done.
 *
 * `term` set is the whole difference the reader needs. An entry naming a `data-type` is a
 * rule the resolver holds the graph to: an incoming edge able to carry that type, meaning
 * the type or a narrower kind of it, is `bundle/prohibition-violated` at error severity.
 * An entry naming nothing in the vocabulary is a sentence addressed to a person, and the
 * schema is explicit that writing one is legitimate. Two very different promises, so they
 * are drawn as two different things.
 *
 * `entry` is what the card wrote and `term.id` is what it resolved to. A deprecated
 * spelling still names its successor, so the two can differ, and both are shown.
 */
interface ProhibitionView {
  entry: string;
  term?: { id: string; label: string; description?: string };
}

/** A `params` value as JSON: scalars inline, anything nested as an indented block. */

/* --------------------- the page --------------------- */

export default async function Page({ params }: PageProps<"/nodes/[...id]">) {
  const { id: segments } = await params;
  // The catch-all captures a namespaced id as its parts; the archive is keyed on the id.
  const id = segments.join("/");

  // `versionsOf` is newest-first, so the head is what the bare id resolves to.
  const versions = nodeCardVersions(id);
  const record = versions[0];
  if (!record) notFound();

  const card = record.card;
  const ontology = getOntologyView();
  const registry = getRegistry();

  const titleOf = (slug: string): string =>
    registry.blueprint(slug)?.manifest.title ?? slug;

  const type = ontology.resolve(card.type, "node-type");
  const typeLabel = type?.term.label ?? card.type;
  const typeHref = termHref(type?.term.id ?? card.type);

  /* Phase and type are two independent dimensions, and doc 3 §2 closes the phase list,
     so an id the vocabulary does not know is shown as written rather than guessed at.
     Neither dimension is a score: this is where in the lifecycle the node works, not
     how far along it is.

     Zero, one or several, in the order the card wrote them. The five phases describe
     the factory and not every node in it, so a card that names none has answered the
     question — nothing below may draw that as an empty field. */
  const phases = card.phases.map((id) => {
    const resolved = ontology.resolve(id, "phase");
    return {
      id,
      label: resolved?.term.label ?? id,
      href: termHref(resolved?.term.id ?? id),
      description: resolved?.term.description,
    };
  });

  const port = (declared: (typeof card.inputs)[number]): PortView => {
    const view: PortView = {
      name: declared.name,
      type: declared.type,
      known: ontology.resolve(declared.type, "data-type") !== undefined,
      // §4 defaults `required` to true, so an input is optional only when it says so.
      required: declared.required !== false,
    };
    if (declared.description !== undefined) view.description = declared.description;
    return view;
  };

  const dependencies: DependencyView[] = card.dependencies.map((dependency) => ({
    id: dependency,
    // A dependency may name a card id or the DOT node that supplies it; only the
    // first kind has a page of its own.
    known: registry.versionsOf(dependency).length > 0,
  }));

  const tools = card.tools.map((tool) => {
    const resolved = ontology.resolve(tool, "tool");
    return { id: resolved?.term.id ?? tool, label: resolved?.term.label ?? tool };
  });

  /* Only a `data-type` can be enforced, because a data type is the only thing an edge
     carries. An entry naming a phase, a node type or a tool is read as free text, which
     is why the lookup is pinned to one kind rather than asked of the vocabulary at
     large. */
  const prohibitions: ProhibitionView[] = card.cannot.map((entry) => {
    const resolved = ontology.resolve(entry, "data-type");
    if (resolved === undefined) return { entry };
    return {
      entry,
      term: {
        id: resolved.term.id,
        label: resolved.term.label,
        description: resolved.term.description,
      },
    };
  });
  const enforcedCount = prohibitions.filter((p) => p.term !== undefined).length;

  /* The weight comes from `markerWeight`, not from `term.defaultWeight`.
     ------------------------------------------------------------
     Reading `defaultWeight` off the term looked right and was dead code on every card in
     the archive. `lib/core/ontology/core.ts:171` says so outright: "No term here carries
     `defaultWeight`. Doc 3 §4 keeps the weights in the config file" — a number in two
     places would make the ontology version meaningless. So the field is `undefined` for
     all seven core markers, the weight was never rendered on any of the 53 pages, and the
     footnote below promised a figure the branch could not produce.

     `markerWeight` is the engine's own lookup order and was already exported from the
     module this file takes `formatWeight` from: configured weight first, then the term's
     own, which survives only for locally namespaced markers. `undefined` now means what
     it says — nobody has priced this marker — rather than meaning "core marker". */
  const risks = card.riskMarkers.map((marker) => {
    const resolved = ontology.resolve(marker, "risk-marker");
    return {
      id: resolved?.term.id ?? marker,
      label: resolved?.term.label ?? marker,
      description: resolved?.term.description,
      weight: resolved === undefined ? undefined : markerWeight(resolved.term),
    };
  });

  const history: NodeVersion[] = versions.map((entry) => ({
    version: entry.version,
    ref: entry.ref,
    digest: entry.digest,
    card: entry.card,
    usedIn: entry.usedIn.map((slug) => ({ slug, title: titleOf(slug) })),
  }));

  const usedIn = registry.usersOf(record.id);
  const author = card.author === undefined ? undefined : getAuthor(card.author);
  const source = cardSource(record.ref);
  const params_ = Object.entries(card.params);

  /* How many of the card's fields carry something, counted rather than written. A card
     leaving nine fields empty has said nine things, and the count is the one number that
     tells a reader whether they are looking at a full card or a sparse one. */
  const fieldView: FieldView = {
    phases,
    tools,
    params_,
    risks,
    prohibitions,
    dependencies,
    inputs: card.inputs.map(port),
    outputs: card.outputs.map(port),
  };
  const declared = FIELD_ROWS.filter((row) => !row.read(card, fieldView).empty).length;
  const downloads = downloadsFor(card.id);
  const specWords = card.spec.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/nodes" className="transition-colors hover:text-cyan">
            ← Nodes
          </Link>
          <span className="mx-2 text-faint">/</span>
          <span className="text-muted">{typeLabel}</span>
        </nav>

        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {card.name}
          </h1>

          {/* Provenance and the two actions, directly under the title rather than below
              the chips and the action sentence — the same move the blueprint page's
              header makes, for the same reason: who wrote this card, which version it
              is, and how to take it are what a reader wants before the vocabulary
              chips. The row itself is unchanged; only where it sits. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {author !== undefined ? (
              <AuthorChip author={author} />
            ) : (
              <span className="font-mono text-xs text-dim">
                {card.author ?? "unattributed"}
              </span>
            )}
            <span className="font-mono text-xs text-dim">{record.ref}</span>
            <span className="font-mono text-xs text-dim">
              used in {usedIn.length} blueprint{usedIn.length === 1 ? "" : "s"}
            </span>
            {/* Same emerald figure the blueprint page's header uses, but the "seeded"
                marker stays here rather than following that page's redesign: the
                blueprint page can drop it from its header line because the Score panel
                below still says "seeded" in the same file (doc 2 §0.4's rule is per
                file, not per line — `autonomy-surfaces.test.ts`). This page has no other
                paragraph that names it, so the marker has to live beside the figure it
                governs or the page prints a seeded number as a fact. Moving the row up
                keeps them together, which is the whole of what that rule asks. */}
            <span className="font-mono text-xs">
              <span className="text-emerald">↓ {compact(downloads)} downloads</span>{" "}
              <span className="text-amber" title="Seeded, no counter stands behind it">
                <span aria-hidden>◐ </span>seeded
              </span>
            </span>
            {/* Fork first, download second — the same grouping and the same reasoning
                the blueprint page's header row uses: `ForkAction` is the disclosure, the
                button beside it is the one real download this row promises. The group
                carries `id="download"` (with `scroll-mt-24`, matching every other
                in-page anchor target — `anchors.test.ts`) since this page has no
                separate `DownloadPanel` for `ForkAction`'s `#download` link to
                target. */}
            <div id="download" className="ml-auto flex scroll-mt-24 items-center gap-2">
              <ForkAction kind="node" />
              {source !== undefined && (
                <ButtonLink
                  href={`data:text/yaml;charset=utf-8,${encodeURIComponent(source)}`}
                  download={`${record.ref}.yaml`}
                  prefetch={false}
                >
                  Download card
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KindBadge kind="node" />
            {/* The two dimensions, side by side and each named. They are the same kind
                of thing — a term in the vocabulary — so they wear the same chip, and
                the word in front of each says which dimension it is rather than
                leaving a colour to carry it.

                One phase chip per declared phase, and no chip at all when the card
                declares none: a chip reading "phase · —" would put a blank where the
                other chips carry a value and make a complete card look half-filled.
                The Behaviour panel below says it in a sentence instead. */}
            <Link
              href={typeHref}
              aria-label={`Ontology node type: ${typeLabel}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet transition-colors hover:border-violet"
            >
              <span className="text-muted">type ·</span>
              {typeLabel}
              <span aria-hidden>→</span>
            </Link>
            {phases.map((phase) => (
              <Link
                key={phase.id}
                href={phase.href}
                aria-label={`Ontology phase: ${phase.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet transition-colors hover:border-violet"
              >
                <span className="text-muted">phase ·</span>
                {phase.label}
                <span aria-hidden>→</span>
              </Link>
            ))}
            {/* Violet, like the two chips beside it and like the explainability
                panel's own human rows, rather than the alarm pink it used to wear.
                Doc 2 §1.1: this states where a person acts, which is a third fact read
                off the card — not a warning about the card. */}
            {card.requiresHuman && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet">
                <span aria-hidden>⏸</span> human in the loop
              </span>
            )}
            {/* The negative half of the interface, named in the header so it is not
                something a reader finds only by scrolling. It wears the same chip as the
                dimensions beside it because it is the same kind of fact: something the
                card states about itself. The panel below carries the entries. */}
            {prohibitions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 font-mono text-[11px] text-violet">
                <span className="text-muted">cannot ·</span>
                {prohibitions.length} declared
              </span>
            )}
            {/* Risk, in the header, which is the one fact a reader deciding whether to
                wire this node most needs and the one the header did not carry.

                `merge-executor` is the case that makes it plain: a node whose job is
                merging pull requests, declaring `secret-access` and `unchecked-write`,
                whose header said `cannot · 2 declared` and nothing else. The count of
                prohibitions is a second-order fact; the markers are the decision. Worse,
                the markers only appeared in the aside, which on a phone is DOM-ordered
                after the whole main column — about 3000px down, below a raw YAML dump.

                Amber, matching the marker cards in the aside it links to rather than the
                violet the vocabulary chips beside it wear, because this is not another
                dimension read off the card: it is the one chip here that should make a
                reader stop. Rendered only when there are markers, so the quiet case
                stays quiet — the same ruling the phase chips follow above. */}
            {risks.length > 0 && (
              <a
                href="#evaluation"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-2.5 py-1 font-mono text-[11px] text-amber transition-colors hover:border-amber"
              >
                <span aria-hidden>△</span>
                {risks.length} risk marker{risks.length === 1 ? "" : "s"}
              </a>
            )}
            <FavoriteStar id={`node:${card.id}@${card.version}`} className="ml-auto" />
          </div>
          {/* Full width, same ask as the blueprint hero and `SectionHeading`. */}
          <p className="text-lg leading-relaxed text-muted">
            {card.action}
          </p>
        </div>

      </header>

      {/* ---------- Body ---------- */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* MAIN

            `min-w-0` is load-bearing and this is not a style choice. A grid item defaults
            to `min-width: auto`, so it refuses to shrink below its own min-content, and
            this column's min-content is 783px — set by the source panel's `<pre>` and the
            port table's `min-w-[520px]`. Inside a 367px phone container the track stayed
            at 783px, and `body { overflow-x: hidden }` in globals.css then *clipped* the
            overflow instead of letting it scroll: `scrollTo(400, 0)` left `scrollX` at 0.

            Measured before the fix, on a 378px viewport: 22 leaf elements fully
            off-screen, including all four values in the Identity panel below — which
            rendered its four labels with the numbers amputated — the whole Description
            column of both port tables, every panel's `meta`, and the copy button. No
            scrollbar, no error, nothing to tell a reader a third of the page was gone.

            With `min-w-0` the track resolves to the container and the inner scroll
            regions (the table's own `overflow-x-auto`, the source panel's) do the
            scrolling they were always meant to do. Verified: `scrollWidth` 807 → 367. */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          {/* What the node actually does, and the first thing on the page after the
              header, because it is the only field that answers the question the page
              exists for.

              It was not rendered at all. `card.spec` is, in the schema's own words, "the
              payload delivered to Claude Code, or an equivalent agent, when the graph is
              instantiated" — and it appeared exactly once in the whole app, in
              `components/panes/build.ts`, where a blueprint pane counts its *words*. The
              page drew every wire around the work and never the work.

              That absence made the page contradict its own source. `Cannot receive`
              below glosses a free-text entry as "nothing checks it", while on
              `maintainer-approval` the spec three panels down says "do not summarise the
              change for them and do not recommend an outcome" — the prohibition is
              carried, addressed to the agent, in the field that was not on the page.

              Rendered whole rather than clamped: every spec in the archive is a single
              paragraph of 71–169 words (median 117), so there is nothing here that a
              "show more" would spare a reader, and clamping the field the page was just
              reorganised to promote would be an odd thing to do. `Ticked` renders the
              backtick spans the specs use, the same way the author's notes are drawn. */}
          <Panel
            id="specification"
            label="Specification"
            meta={`${specWords} words · handed to the agent`}
            lead
          >
            {/* 16px against the 15px the other panels' prose uses. One step, not a
                display size: this is the paragraph a reader came to read, and it should
                feel like the body text of the page rather than like another field. */}
            <p className="max-w-[68ch] text-base leading-relaxed text-fg">
              <Ticked text={card.spec} />
            </p>
          </Panel>

          <Panel
            id="interfaces"
            label="Interfaces"
            meta={`${card.inputs.length} in · ${card.outputs.length} out`}
          >
            <NodeInterfaces
              inputs={card.inputs.map(port)}
              outputs={card.outputs.map(port)}
              dependencies={dependencies}
            />
          </Panel>

          {/* Directly under the interfaces, because it is the other half of the same
              statement: those rows say what arrives on this node, and these say what may
              not. It is also the field doc 2 §3's whole argument rests on — the rule that
              a Skill cannot express, because it is a property of who is wired to whom —
              so it gets a panel of its own rather than a line inside Behaviour. */}
          <Panel
            id="prohibitions"
            label="Cannot receive"
            meta={
              prohibitions.length === 0
                ? "none declared"
                : `${enforcedCount} enforced · ${prohibitions.length - enforcedCount} free text`
            }
          >
            {prohibitions.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[15px] leading-relaxed text-muted">
                  <span className="text-fg">None declared.</span> The ordinary case: a
                  node is usually isolated by the edges its graph does not draw. Writing
                  the rule down here is what makes it checkable.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* The paragraph that stood here restated the panel: the label says
                    "Cannot receive", the meta counts enforced against free text, and each
                    row below carries a badge saying which kind it is. The author asked it
                    off. The `none declared` branch above keeps its explanation, because
                    there the panel is empty and there are no rows to read it off. */}
                <ul className="flex flex-col gap-2.5">
                  {prohibitions.map((p) =>
                    p.term === undefined ? (
                      /* Free text. Drawn plainly and drawn at full size: the schema
                         calls writing one legitimate, so it is a second kind of entry
                         and not a lesser one. What separates it is the promise, which
                         the badge states in words. */
                      /* The gloss that stood here — "No data type by this name, so
                         nothing checks it. It speaks to whoever reads the card." — was
                         wrong twice over, so it is gone rather than reworded in place.

                         Wrong once because it was printed verbatim on every free-text
                         row, twice per page about 60px apart, saying one fact about the
                         panel as if it were a fact about each entry. It belongs in the
                         footnote below, which already existed to say exactly this kind
                         of thing, and now does.

                         Wrong twice because "nothing checks it" is false. On
                         `maintainer-approval` the two free-text entries are restated
                         almost word for word in the specification now rendered at the
                         top of this page, where the agent reads them. The resolver does
                         not enforce them; that is not the same as nothing acting on
                         them, and the page was asserting the stronger claim while
                         printing the evidence against it. The footnote states the
                         mechanism instead. */
                      <li
                        key={p.entry}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <span className="font-mono text-[12px] text-fg">{p.entry}</span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                          <span aria-hidden>◌</span> free text
                        </span>
                      </li>
                    ) : (
                      <li
                        key={p.entry}
                        className="flex flex-col gap-1.5 rounded-md border border-violet/40 bg-violet/5 px-3 py-2.5"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <TermChip
                            href={termHref(p.term.id)}
                            label={p.entry}
                            aria={`Ontology data type: ${p.term.label}`}
                          />
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-violet">
                            <span aria-hidden>⊘</span> enforced
                          </span>
                        </span>
                        {p.term.description !== undefined && (
                          <span className="text-xs leading-relaxed text-muted">
                            {p.term.description}
                          </span>
                        )}
                        <span className="text-xs leading-relaxed text-dim">
                          Any edge that could carry{" "}
                          <code className="font-mono text-muted">{p.term.id}</code>, or a
                          narrower type, fails the bundle with{" "}
                          <code className="font-mono text-muted">
                            bundle/prohibition-violated
                          </code>
                          .
                          {p.entry !== p.term.id && (
                            <>
                              {" "}
                              The card writes{" "}
                              <code className="font-mono text-muted">{p.entry}</code>,
                              which the vocabulary resolves to{" "}
                              <code className="font-mono text-muted">{p.term.id}</code>.
                            </>
                          )}
                        </span>
                      </li>
                    ),
                  )}
                </ul>

                {/* No em dash in here, even though `app/nodes` is outside the trees
                    `components/build/path.test.ts` guards. That exemption exists for copy
                    that predates doc 2 §2.5, not as a licence for new copy, and the guard
                    file says as much about `ForkAction.tsx`. This sentence was written in
                    this pass, so it follows the rule the guard cannot see it break. */}
                <p className="text-xs leading-relaxed text-dim">
                  Only a data type can be enforced, because only a data type travels on an
                  edge. An entry naming anything else is free text: the resolver does not
                  hold the graph to it, which is not the same as nothing acting on it. It
                  is addressed to whoever runs the node, and the agent reads the
                  specification at the top of this page.
                </p>
              </div>
            )}
          </Panel>

          {/* One panel where two stood, and no prose in it.
              ------------------------------------------------------------
              The author, reviewing this page: "non mi è chiaro affatto che cosa significhi
              la sezione model skill e servers", and on the explanations beside each field,
              "questa roba qua non serve, non dobbiamo dire all'utente perché tanto deve
              essere autoesplicativa". On the panel below it: "la parte dei behaviour box
              non ho assolutamente capito di cosa serva". And what he wants instead: the
              section should list "tutti i campi che sono presenti all'interno della
              descrizione di una card, in modo tale che un utente le possa vedere al volo".

              `Model, skill and servers` was three `ReachRow`s whose glosses explained what
              `model`, `skill` and `mcp` mean. `Behaviour` was a grab bag: phases with a
              paragraph each, the agent label, tools, params, and the author's notes, under
              a heading that named none of them.

              So: every field the card declares, in the schema's own order, name beside
              value. A reader who wants to know what `mcp` is has the word and the value,
              which is what "self-explanatory" means here; a reader who wants the argument
              has `/concepts`, which is the page built for it and is linked below.

              Two limit statements came off with the prose and are not lost. That a
              `model` is a default a graph's `model_stylesheet` can override, and that a
              `skill` is a pointer with no document in the bundle, are both said on
              `/concepts` in the `skill` and `model` rows of `WhatACardReaches`. The
              footnote under this table points there rather than restating them per card,
              53 times over. */}
          <Panel id="fields" label="Every field on this card" meta={`${declared} declared, in five blocks`}>
            <div className="flex flex-col gap-5">
              {CARD_BLOCKS.map((block) => {
                const rows = FIELD_ROWS.filter((row) => row.block === block.id);
                if (rows.length === 0) return null;
                return (
                  <section key={block.id} className="flex flex-col gap-2">
                    {/* The block header, in the skeleton's own words. Amber, which the
                        author asked to stay this page's prominent colour and which is
                        already what `SkeletonPane` draws these five headings in. */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <h3 className="font-mono text-[12px] uppercase tracking-[0.18em] text-amber">
                        {block.label}
                      </h3>
                      <span className="font-mono text-[11px] text-dim">{block.ref}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-dim">{block.purpose}</p>

                    <dl className="flex flex-col">
                      {rows.map((row) => {
                        const value = row.read(card, fieldView);
                        const detail = row.detail?.(card, fieldView);
                        const head = (
                          <>
                            <dt className="font-mono text-[12px] text-amber">{row.name}</dt>
                            <dd
                              className={cx(
                                "min-w-0 font-mono text-[12px] leading-relaxed",
                                value.empty ? "text-dim" : "text-fg",
                              )}
                            >
                              {value.text}
                              {/* Where a field has a panel of its own, the row points at
                                  it rather than reprinting it. */}
                              {row.seeHref !== undefined && !value.empty && (
                                <>
                                  {"  "}
                                  <a
                                    href={row.seeHref}
                                    className="text-[11px] text-dim underline decoration-line underline-offset-4 transition-colors hover:text-amber"
                                  >
                                    {row.seeLabel}
                                  </a>
                                </>
                              )}
                            </dd>
                          </>
                        );

                        /* A row with nothing more to say stays a plain row. A summary
                           that opens onto nothing is a worse offer than no affordance,
                           which is the same rule the vocabulary chips follow. */
                        if (detail === undefined) {
                          return (
                            <div
                              key={row.name}
                              className="grid gap-x-4 gap-y-1 border-t border-line/70 py-2 pl-[1.15rem] first:border-t-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)]"
                            >
                              {head}
                            </div>
                          );
                        }

                        return (
                          <details
                            key={row.name}
                            className="group border-t border-line/70 first:border-t-0"
                          >
                            <summary className="relative grid cursor-pointer list-none gap-x-4 gap-y-1 py-2 pl-[1.15rem] transition-colors hover:bg-surface-2/50 sm:grid-cols-[9rem_minmax(0,1fr)] [&::-webkit-details-marker]:hidden">
                              {/* The marker is drawn rather than left to the browser: a
                                  native triangle sits outside the grid and pushes the
                                  first column out of alignment with the rows that have
                                  no disclosure. `pl` on both branches keeps the two
                                  kinds of row on one left edge. */}
                              <span
                                aria-hidden
                                className="pointer-events-none absolute left-0 top-[0.6rem] font-mono text-[10px] text-dim transition-transform group-open:rotate-90"
                              >
                                &#9656;
                              </span>
                              {head}
                            </summary>
                            <div className="pb-3 pl-[1.15rem] sm:pl-[10.15rem]">{detail}</div>
                          </details>
                        );
                      })}
                    </dl>
                  </section>
                );
              })}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-dim">
              What each of these fields is for, once rather than on every card:{" "}
              <Link
                href="/concepts"
                className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
              >
                eval, harness and the rest <span aria-hidden>&rarr;</span>
              </Link>
            </p>

            {card.notes !== undefined && (
              /* Kept, and kept out of the table. Everything above is a field and a value;
                 this is a paragraph the author wrote, and folding it into a `dd` would
                 make one row twenty times the height of the others. */
              <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
                <h3 className={LABEL}>Notes from the author</h3>
                <p className="border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-muted">
                  <Ticked text={card.notes} />
                </p>
              </div>
            )}
          </Panel>

          <VersionHistory versions={history} />

          {/* Card source, closed.
              ------------------------------------------------------------
              Open, this was 40% of the page's words. On `intent-router`: 1239 words
              rendered, 496 of them inside this panel, re-printing `name`, `type`,
              `phase`, `action` verbatim, `tools`, `params`, `inputs`, `outputs`,
              `dependencies`, `cannot`, `notes`, `version` and `author` — every one of
              which the panels above already draw — plus the digest for a third time.

              It was also the direct cause of the mobile clipping fixed at the top of
              this column: the `<pre>` sets this column's min-content at 783px, which is
              what refused to shrink into a 367px phone.

              Closed by default rather than deleted, because "the raw bytes are one click
              away" is the registry's actual claim and this is where it is kept. The
              download moves inside the panel header so a reader who wants the file does
              not have to open a 1000-line window to reach it, and `headingId` makes the
              panel's own visible label the section heading — it used to be an `sr-only`
              `<h2>` stacked above a visible `<span>` title, so the words "Card source"
              were announced twice in a row and drawn at a size no other heading used.

              This is also the trade the Specification panel above pays for: the file
              still has one home on the page, and the reader now meets the node's
              instruction in prose 2000px before reaching it. */}
          <section
            id="card-source"
            className="flex scroll-mt-24 flex-col gap-2"
            aria-labelledby="card-source-heading"
          >
            {source !== undefined ? (
              <>
                <SourcePanel
                  source={source}
                  language="YAML"
                  title="Card source"
                  meta={`${record.ref}.yaml`}
                  downloadName={`${record.ref}.yaml`}
                  headingId="card-source-heading"
                  collapsible
                  defaultOpen={false}
                />
                {/* Selectable, not a tooltip. The full digest was rendered only in the
                    `title` of the Identity row, which a keyboard or touch reader cannot
                    reach and nobody can copy; this is the one place it exists as text. */}
                <p className="flex flex-wrap items-baseline gap-2 font-mono text-[11px]">
                  <span className="uppercase tracking-[0.14em] text-dim">
                    digest
                  </span>
                  <span className="break-all text-muted">{record.digest}</span>
                </p>
                <p className="text-xs leading-relaxed text-dim">
                  Hashed over the card&apos;s content, author and provenance left out:
                  the same node from two people lands on the same digest, any edit lands
                  on a different one.
                </p>
              </>
            ) : (
              /* No document, so no `SourcePanel` and therefore no heading from it — the
                 section still needs the one its `aria-labelledby` names. */
              <>
                <h2 id="card-source-heading" className={SECTION}>
                  Card source
                </h2>
                <p className="panel px-4 py-3 text-sm text-muted">
                  The archive does not carry the document behind{" "}
                  <code className="font-mono text-[12px] text-fg">{record.ref}</code>
                  , only the resolved card. Its digest is{" "}
                  <span className="break-all font-mono text-[12px] text-muted">
                    {record.digest}
                  </span>
                  .
                </p>
              </>
            )}
          </section>
        </div>

        {/* SIDEBAR
            `min-w-0` for the same reason the main column carries it: this is the other
            grid item, its risk cards hold long unbroken marker ids, and a column that
            cannot shrink clips rather than wraps. `aria-label` because a `<complementary>`
            with no accessible name is announced as an unlabelled landmark, which on a page
            that also has an unlabelled site nav gives a screen-reader user two anonymous
            regions to tell apart. */}
        <aside
          aria-label="Card metadata"
          className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:self-start"
        >
          {/* "Risk and autonomy", not "Evaluation metadata". The panel answers two
              questions a reader has — can this node do damage, and does anybody watch —
              and the old label named the schema drawer they happen to be filed in. The
              `id` is untouched, so `#evaluation` and the header chip still resolve. */}
          <SidePanel id="evaluation" label="Risk and autonomy" className="scroll-mt-24">
            {/* Risk first when there is any, autonomy first when there is none, and the
                swap is made in the **DOM**, not with `flex-col-reverse` or `order-`.
                ------------------------------------------------------------
                The autonomy line led unconditionally, so on `merge-executor` — a node
                that merges pull requests holding a repository write token, carrying
                `secret-access` and `unchecked-write` — the panel opened with cyan
                "Runs unattended. Nothing on this card asks for a person", directly above
                two amber markers. On that card "nothing stops here" is the alarming
                fact, and it was rendered in the colour this site keeps for good news.

                A CSS reorder would have fixed only what a sighted reader sees: `order`
                and `flex-*-reverse` change the painted order and leave the DOM alone, so
                a screen reader would still have been reassured before it was warned,
                which is the half of the audience the warning matters most to. Emitting
                the blocks in the right order costs one ternary and is true for everyone.

                Doc 2 §1.1 still holds and nothing here grades autonomy: the pair is the
                neutral one the blueprint page's explainability panel uses, ▸ cyan for a
                node that runs alone and ⏸ violet for a node where a person acts, glyph
                and word carrying the difference so colour never carries it alone.
                Refusing to *score* autonomy is not a reason to let it answer first on a
                card whose risk is the headline. */}
            {(() => {
              const autonomy = (
                <p
                  key="autonomy"
                  className="flex items-start gap-2 text-sm leading-relaxed text-muted"
                >
                  {card.requiresHuman ? (
                    <>
                      <span className="font-mono text-violet" aria-hidden>
                        ⏸
                      </span>
                      <span>
                        <span className="text-violet">A person acts here.</span> The run
                        holds until somebody supplies or approves what this node asks for.
                        The autonomy reading describes that; it does not charge for it.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-cyan" aria-hidden>
                        ▸
                      </span>
                      <span>
                        <span className="text-cyan">Runs unattended.</span> Nothing on
                        this card asks for a person, so a run does not stop here.
                      </span>
                    </>
                  )}
                </p>
              );

              const risk = (
                <div key="risk" className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className={LABEL}>Risk markers</h3>
                    <span className="font-mono text-[11px] text-dim">{risks.length}</span>
                  </div>
                  {risks.length > 0 ? (
                    <>
                      <ul className="flex flex-col gap-2">
                        {risks.map((risk) => (
                          <li key={risk.id}>
                            <Link
                              href={termHref(risk.id)}
                              /* The label alone is the accessible name. Without this the
                                 name was the label plus the whole description, 58 and 90
                                 characters, read out in full on every tab stop. */
                              aria-label={risk.label}
                              className="flex flex-col gap-1 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 transition-colors hover:border-amber/60"
                            >
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-amber">
                                  <span
                                    className="h-1 w-1 rounded-full bg-current"
                                    aria-hidden
                                  />
                                  {risk.label}
                                </span>
                                {risk.weight !== undefined && (
                                  <span className="font-mono text-[11px] tabular-nums text-amber">
                                    {/* Two decimals, as everywhere else: weights are
                                        quarter-points and 2 would read as an integer. */}
                                    weight {formatWeight(risk.weight)}
                                  </span>
                                )}
                              </span>
                              {risk.description !== undefined && (
                                <span className="text-xs leading-relaxed text-muted">
                                  {risk.description}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {/* "Configured", not "the vocabulary's default". Doc 3 §4 moved the
                          core weights into `DARKPRINT_CONFIG.security.weights` precisely
                          so the vocabulary would not carry them, and this line credited
                          the wrong file while the figure beside it did not render at all. */}
                      <p className="text-xs leading-relaxed text-dim">
                        The configured cost, subtracted from a clean 4 when the marker
                        appears in a graph. A deployment may recalibrate it, which is a
                        patch of the ontology version because it re-scores every blueprint.
                      </p>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <span className="font-mono text-emerald" aria-hidden>
                        ✓
                      </span>
                      None declared. Nothing here costs a blueprint security points.
                    </p>
                  )}
                </div>
              );

              const [lead, follow] =
                risks.length > 0 ? [risk, autonomy] : [autonomy, risk];
              return (
                <div className="flex flex-col gap-4">
                  {lead}
                  <div className="border-t border-line pt-4">{follow}</div>
                </div>
              );
            })()}
          </SidePanel>

          {/* "Used in" stood here, listing every blueprint pinning this card. The
              author asked it off: "very unmanageable when a given node is used in a lot
              of blueprints", and a sidebar column is the worst place for a list with no
              ceiling on it. The count survives in the header strip near the top of the
              page ("used in N blueprints"), and `VersionHistory` still names the
              blueprints pinning each *specific* version, which is the bounded and more
              useful version of the same question. */}
          <SidePanel id="identity" label="Identity">
            <dl className="flex flex-col divide-y divide-line">
              <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <dt className="text-sm text-muted">Current version</dt>
                <dd className="font-mono text-sm tabular-nums text-fg">
                  {record.version}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-muted">Published versions</dt>
                <dd className="font-mono text-sm tabular-nums text-fg">
                  {versions.length}
                </dd>
              </div>
              {/* The `title` carrying the full digest is gone: a tooltip is unreachable
                  by keyboard and touch, and it was the only place the whole string
                  existed as anything. The Card source section below now prints it as
                  selectable text, so this row can be the short form it looks like and
                  point at the long one. */}
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-muted">Digest</dt>
                <dd className="font-mono text-sm text-fg">
                  <a
                    href="#card-source"
                    className="underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan hover:decoration-cyan"
                  >
                    {shortDigest(record.digest)}
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
                <dt className="text-sm text-muted">Ontology</dt>
                <dd className="font-mono text-sm tabular-nums text-fg">
                  v{card.ontologyVersion}
                </dd>
              </div>
            </dl>
          </SidePanel>
        </aside>
      </div>

      {/* Community notes, full width under both columns, the same component and the same
          position the blueprint pages use. The author asked for it here too, and the
          asymmetry was real: a blueprint could be discussed and a card could not, though
          a card is the thing somebody lifts on its own.

          `commentsFor` returns `[]` for every card today. That is the honest state and
          `Comments` renders it as one: its empty state says notes are seeded rows, this
          card has none, and posting is not built. The section carries its own `◐ seeded`
          marker either way. */}
      {/* `subject`, because the empty state's sentence was hard-coded to "blueprint" and
          this is a node card — so all 53 of these pages closed on the wrong noun, in the
          last sentence a reader meets. */}
      <div className="mt-10">
        <Comments comments={commentsFor(card.id)} subject="node card" />
      </div>
    </div>
  );
}
