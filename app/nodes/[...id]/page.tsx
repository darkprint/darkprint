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
import { cardDownloadCommand } from "@/lib/content/bundle-export";
import { commentsFor, downloadsFor } from "@/lib/data/node-community";
import { getAuthor } from "@/lib/data/users";
import { compact, cx } from "@/lib/format";
import { CARD_BLOCKS } from "@/components/panes/model";
import { termHref } from "@/lib/href";
import { Comments } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
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
import { VersionHistory, type NodeVersion } from "@/components/nodes/VersionHistory";
import { Ticked } from "@/components/ui/Ticked";
import { FieldDisclosure } from "@/components/ui/FieldDisclosure";
import { FIELD_NOTE } from "@/components/panes/field-notes";

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

/* ============================================================
   The mono tiers on this page, and there are only the two.
   ------------------------------------------------------------
   This file used to declare its own pair, `SECTION` (13px/0.18em
   `text-fg`) and `LABEL` (11px/0.18em `text-dim`), and around them
   four more spellings grew: 12px/0.18em amber for a block title,
   11px/0.14em dim and 11px/0.14em violet for the two prohibition
   badges, 11px/0.14em dim for the digest caption, and the field
   table's own 12px amber keys. Measured live: six mono uppercase
   tiers between 11px and 13px, on the site's longest page.

   Both constants are gone in favour of `.label-lead` and `.label`
   from `globals.css`, which are the same two steps drawn once for
   the whole site — 14px/0.14em `text-fg` for the thing a reader
   starts at, 11px/0.18em `text-dim` for a column header or a meta
   label. The tracking runs backwards against the size on purpose;
   the rule is written out beside the classes.

   The rule that comes with them: **a mono uppercase run is a
   LABEL, and a label is not a heading level.** Every panel title
   here is a real `<h2>` wearing `.label-lead`, and the two `<h3>`s
   that were only sub-group captions (`Notes from the author`,
   `Risk markers`) are `<span className="label">` now and stop
   claiming an outline position they never earned.

   Two panel titles on this page are drawn by components no wave
   touches — `components/nodes/VersionHistory.tsx` and
   `components/ui/SourcePanel.tsx` both hard-code the old
   13px/0.18em spelling — which is why the six titles stay in the
   mono register rather than being promoted to display type. A
   32px `Specification` beside a 13px `Card source` would fracture
   the row this pass exists to unify; 14px `.label-lead` beside
   13px does not.
   ============================================================ */

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

   `skill`, `mcp` and `cannot` used to be hard-coded here, under a
   paragraph explaining which block each belongs to, because doc 1
   §3 files them under none. That decision now lives in
   `CARD_BLOCKS` beside the keys, where it settles this table and
   the blueprint page's card skeleton at once instead of only
   this one — the skeleton was drawing neither the behaviour
   document, nor the servers, nor the prohibition.

   ── Why the detail is a click and not prose ──
   The author asked the explanations off the default view ("non
   dobbiamo dire all'utente perché tanto deve essere
   autoesplicativa") and then asked for them back on demand: "on
   click of the field, it shows the details". So the resting state
   is a field and a value, and everything that was prose is behind
   a `<details>`. Native, so it needs no client component and it
   opens for a reader without script.

   ── One set of sentences, two surfaces ──
   What each field is *for* is `FIELD_NOTE` in
   `components/panes/field-notes.ts`, and the row that opens onto
   it is `components/ui/FieldDisclosure.tsx`. Both are shared with
   the blueprint page's card skeleton, which the author asked to
   behave "like in the node webpage card". The `detail` below is
   what is left after that split, and it is the half that could
   not be shared: **this card's values**, resolved against the
   ontology once per page — term chips, a params `<dl>`, the
   priced risk markers — none of which survives a trip through the
   skeleton's serializable model.

   Every field has a note, so every row opens. A row whose key has
   neither a note nor a detail is still a plain `div`: a summary
   that opens onto nothing is worse than no affordance at all.

   ── The resting row is the value, and the clamp is the cut ──
   Three rows answered with a measurement of themselves — `action`,
   `spec` and `notes` each printed "N words" — and `params` printed
   its keys with every value dropped. The author: "I expected the
   content of the spec there and if this does not fit within the
   available space, on click it shows the details. This behaviour
   has to be applied to every subfield."

   So the value is what the row prints, and what does not fit is
   folded by `line-clamp-3`, undone by `group-open:line-clamp-none`
   when the row is opened. The clamp decides nothing and hides
   nothing from anything but the eye: no measurement runs, no
   second copy of the text exists, and the value is in the
   prerendered HTML, in the accessible tree and findable by
   find-in-page whether the row is open or shut. Lines rather than
   characters, because this `dd` is 534px wide on a desktop and
   290px on a phone.

   The word counts are real figures this page prints in two other
   places, so they moved into a meta slot under the field's name
   rather than being deleted with the sentences they replaced: under
   a clamp, the count is the only thing that says how much is folded.
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
  /**
   * Wire key, when this row is not labelled with it. Only `phases` is: the document
   * writes the singular `phase` and accepts a scalar or a sequence, and the plural is
   * what a reader of a *resolved* card sees. `FIELD_NOTE` is keyed by the wire key on
   * both surfaces, so the row has to say which one it is.
   */
  wire?: string;
  read: (card: NodeCard, view: FieldView) => FieldValue;
  /**
   * How big a long value is, drawn under the field's name where the clamp cannot reach it.
   *
   * The three prose fields answered with this figure and nothing else until the author
   * asked for the content ("I expected the content of the spec there"). The figure is
   * real and the site prints it in two other places on this page, so it moved into a meta
   * slot rather than being deleted: under a clamp it is what says how much is folded away.
   */
  measure?: (card: NodeCard) => string | undefined;
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

/**
 * How long a prose field is, for the meta slot under its name.
 *
 * This used to *be* the row: `read: (c) => words(c.spec)` printed "123 words" where the
 * value belonged, on all three of `action`, `spec` and `notes`. The rows print the prose
 * now and clamp it; the figure is what a reader would otherwise lose, so it moved rather
 * than went. `undefined` for a field the card left empty, where "0 words" would be noise
 * beside a row already saying `none`.
 */
function wordCount(value: string | undefined): string | undefined {
  const text = value?.trim() ?? "";
  if (text === "") return undefined;
  return `${text.split(/\s+/).length} words`;
}

/**
 * A folded scalar as one run of text.
 *
 * A card's long fields are written as YAML folded scalars, so the newlines in the file are
 * the author's right margin and not the author's paragraphs. Flattening means the clamp
 * below counts the lines the reader sees rather than the lines the file wrapped at.
 */
function prose(value: string | undefined, empty = "none"): FieldValue {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text === "" ? { text: empty, empty: true } : { text, empty: false };
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
    wire: "phase",
    read: (_c, v) => list(v.phases.map((p) => p.label), "outside the five"),
    /* The empty case used to be spelled out here — "the phases describe a blueprint's
       shape, not every node in one" — and it is now the shared note, which says it for
       the skeleton pane too. What is left is the half that is about *these* phases. */
    detail: (_c, v) =>
      v.phases.length === 0 ? (
        undefined
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

  /* The sentence, not a word count.
     ------------------------------------------------------------
     These two rows and `notes` below said "23 words" / "123 words" / "129 words" where the
     value belongs, and the author asked for the other thing: "I expected the content of the
     spec there and if this does not fit within the available space, on click it shows the
     details." So the value is on the row, clamped to three lines, and the row unclamps
     itself when it is opened.

     `action` was held back on a duplication argument — it is this page's opening lead
     verbatim, and `docs/content-reorg` cut exactly that repeat once before. The argument
     does not survive the request. A table titled "every field on this card" that answers
     one of its rows with an integer is not a table of the card, and a clamped line at 12px
     three panels down is not the same object as the lead paragraph; the repeat
     `content-reorg` cut was two full-size paragraphs of prose.

     `spec` keeps its pointer at the panel that prints it whole, because the panel is a
     better place to read 665 characters than a mono `dd` is. It is a second way in now
     rather than the only one. */
  {
    block: "behaviour",
    name: "action",
    read: (c) => prose(c.action),
    measure: (c) => wordCount(c.action),
  },
  {
    block: "behaviour",
    name: "spec",
    read: (c) => prose(c.spec),
    measure: (c) => wordCount(c.spec),
    seeHref: "#specification",
    seeLabel: "in full above",
  },
  {
    block: "behaviour",
    name: "model",
    read: (c) => one(c.model, "whatever the graph supplies"),
  },
  {
    block: "behaviour",
    name: "agent",
    read: (c) => one(c.agent),
  },
  {
    block: "behaviour",
    name: "skill",
    read: (c) => one(c.skill),
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
  },
  {
    block: "behaviour",
    name: "params",
    /* Keys and values. The keys alone were the same omission the blueprint page's skeleton
       had: a row that names the settings and withholds every setting. The `<dl>` below
       stays, because it is not a repeat of this line — it prints a nested value across
       several indented lines, which a joined line cannot do, and it is the shape a reader
       copies out of. */
    read: (_c, v) =>
      list(
        v.params_.map(
          ([key, value]) =>
            `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
        ),
      ),
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
    /* Only the half that is about *these* dependencies. What the field is for is the
       shared note above it. */
    detail: (_c, v) =>
      v.dependencies.length === 0 ? undefined : (
        <Detail>
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
    /* Doc 2 §1.1, and both sentences weigh the same. This row printed `false` and drew it
       dim, in the same grey the page uses for a field the card left blank — so a card that
       had answered the question read as a card that had not, and `false` read as the
       lesser of the two answers. `empty` is false either way: a declared `false` is a
       design decision, and it is also what `${declared} declared` counts. The wording is
       the skeleton pane's, so the two surfaces say one thing once. */
    read: (c) => ({
      text: c.requiresHuman
        ? "true. The run holds here until a person acts."
        : "false. A run passes through without stopping.",
      empty: false,
    }),
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
                  <span className="text-warn">{formatWeight(risk.weight)}</span> of the
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
    /* The commentary, clamped. No `detail`: it used to reprint the notes inside the open
       row, and the same paragraph is already set at 15px under "Notes from the author" at
       the foot of this very panel. Three copies of one paragraph in one panel is one more
       than the two the clamp already justifies. */
    read: (c) => prose(c.notes),
    measure: (c) => wordCount(c.notes),
  },

  { block: "service", name: "version", read: (c) => one(c.version) },
  { block: "service", name: "ontology_version", read: (c) => one(c.ontologyVersion) },
  { block: "service", name: "author", read: (c) => one(c.author, "unattributed") },
  /* `CARD_BLOCKS` has always listed it and this table did not, so the two surfaces
     disagreed about how many fields a card has. It is the last of the 23. */
  { block: "service", name: "provenance", read: (c) => one(c.provenance, "not stated") },
];

function Panel({
  id,
  label,
  meta,
  lead = false,
  className,
  children,
}: {
  id: string;
  label: string;
  meta?: string;
  /** The panel a reader should land on first. At most one per page. */
  lead?: boolean;
  /**
   * The call site's own classes, and in practice its own `scroll-mt-`.
   *
   * The offset below is already unconditional, so nothing here needs one to work.
   * `components/site/anchors.test.ts` reads the *source*, though, and the tag it
   * finds for `id="specification"` is this component's call site, where the id is a
   * prop rather than an attribute — so the guard cannot see the offset that the
   * component supplies. `SidePanel` below already carries this prop for exactly that
   * reason. Passing `scroll-mt-24` beside the id keeps the guard honest about the
   * five anchors the card map now links, rather than teaching it to look away.
   */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cx("panel scroll-mt-24 overflow-hidden", lead && "panel-lead", className)}
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
        <h2 id={`${id}-heading`} className="label-lead">
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
      <h2 id={`${id}-heading`} className="label-lead mb-4 block">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** One row of the card map: where a section is, and how much is in it. */
interface MapEntry {
  /** Written as a literal at the call site, never derived. See `CardMap`. */
  href: string;
  /** The section's own label, so the rail and the panel cannot drift apart. */
  label: string;
  /** One figure, so a reader can tell a 20-word section from a 1500px one. */
  meta: string;
  /**
   * The `:target` mark, spelled out per row because Tailwind scans source text.
   *
   * `body:has(#fields:target) &` is the whole mechanism: the page is static and there
   * is no scroll spy, so "the current section" means the one the reader jumped to,
   * which is exactly what `:target` is. No JavaScript, nothing to hydrate, and the
   * unmarked state — every rule `--color-line` — is already the finished drawing.
   */
  mark: string;
}

/**
 * The rail, and it leads the aside.
 *
 * This page is nine panels and roughly 4,000px of card. The field table alone is 1460px
 * of it, 36%, and there is no scroll spy and nothing to hydrate, so the only way a reader
 * learns what is down there is a list that says so. That makes this the first thing in
 * the sticky column rather than the last: the two panels beneath it — risk and identity —
 * are answers you look up once you know the question, and this is where the questions
 * are. It sat third for a while on the argument that the aside had empty space below the
 * answers and this was a use for it; that reasoned from where there was ROOM, which is
 * not the same as reasoning from what a reader needs first.
 *
 * Six rows, one per section, each with the one figure that says how much is behind it.
 * It is a `<nav>` rather than a `<section>` because that is what it is, and it is not
 * hidden below `lg`: on a phone the aside stacks under the main column, where the same
 * six links read as a way back up rather than a way in. A list of six anchors is worth
 * having in both places; hiding content by viewport is not.
 *
 * Measured at 1440x900 after the move: the three panels stack to 761px under a sticky
 * `top-20`, so the aside is still shorter than one viewport and nothing it holds is
 * pushed off-screen by going first.
 */
function CardMap({ entries }: { entries: readonly MapEntry[] }) {
  return (
    <nav aria-labelledby="card-map-heading" className="panel p-5">
      <span id="card-map-heading" className="label-lead mb-4 block">
        On this card
      </span>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li key={entry.href}>
            <a
              href={entry.href}
              className={cx(
                "group flex items-baseline justify-between gap-3 border-l-2 border-l-line py-2 pl-3",
                "transition-[transform,scale,color,background-color,border-color] duration-[var(--dur-base)] ease-out",
                "hoverable:hover:border-l-line-bright hoverable:hover:bg-surface-2/60",
                "active:scale-[0.99] active:duration-[var(--dur-press)]",
                entry.mark,
              )}
            >
              <span className="min-w-0 text-sm leading-snug text-fg hoverable:group-hover:text-cyan">
                {entry.label}
              </span>
              <span className="label shrink-0">{entry.meta}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The chip geometry every pill on this page shares, and the press it answers with.
 *
 * `leading-none` so an 11px pill is 11 + 8 + 2 tall rather than whatever the inherited
 * line-height happens to make it, which is what let two chips at the same font size sit
 * at two different heights in the same row.
 *
 * `CHIP_PRESS` is written out rather than folded into `CHIP` because two chips on this
 * page are statements rather than controls, and a press on something that cannot be
 * pressed is a lie. The property list names `scale` explicitly: Tailwind v4 emits
 * `scale:` as its own CSS property, so a hand-written `transition-[transform,…]` list
 * does not cover it and the press would snap instead of ramping.
 */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] leading-none";
const CHIP_PRESS =
  "transition-[transform,scale,color,background-color,border-color] duration-[var(--dur-base)] ease-out active:scale-[0.97] active:duration-[var(--dur-press)]";

/** The one link chip: cyan ground, cyan edge, and a brighter edge under a fine pointer. */
const CHIP_LINK = "border-cyan/40 bg-cyan/10 text-cyan hoverable:hover:border-cyan";

/**
 * A link into the vocabulary, drawn once.
 *
 * ── One shape ──
 * This page drew the same meaning — "a reference into the ontology" — in two chips at
 * once: this one at `rounded` / `px-2 py-0.5` / 12px, and the header's type and phase
 * chips at `rounded-full` / `px-2.5 py-1` / 11px. Two radii and two sizes, on screen
 * together on every card that declares a tool or an enforced prohibition. The pill wins
 * because the header's row is where a reader meets the shape first.
 *
 * ── One colour ──
 * Cyan, not violet. These are links, and cyan is this site's interactive colour;
 * violet is reserved for where a person acts, which `lib/format.ts`'s
 * `HUMAN_PRESENCE_MARK` names and `components/ui/autonomy-surfaces.test.ts` guards. A
 * vocabulary chip in violet spends the human-presence colour on a word nobody stands
 * behind, which is exactly what made the `⏸ human in the loop` chip beside it — the one
 * chip here that really is about a person — indistinguishable from its neighbours.
 */
function TermChip({ href, label, aria }: { href: string; label: string; aria: string }) {
  return (
    <Link
      href={href}
      aria-label={aria}
      className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}
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

  /* The rail's map of this page.
     ------------------------------------------------------------
     Every `href` is a literal, and so is every `:target` mark. Both are read out of
     the source rather than out of the DOM — `components/site/anchors.test.ts` walks
     `href: "#…"` written in a table for exactly this shape, and Tailwind's scanner
     only compiles a class it can see spelled out. Deriving either from `label` would
     produce links no guard checks and marks that never compile, which is the failure
     mode both tools were written to catch. */
  const cardMap: readonly MapEntry[] = [
    {
      href: "#specification",
      label: "Specification",
      meta: `${specWords} words`,
      mark: "[body:has(#specification:target)_&]:border-l-cyan",
    },
    {
      href: "#interfaces",
      label: "Interfaces",
      meta: `${card.inputs.length} in · ${card.outputs.length} out`,
      mark: "[body:has(#interfaces:target)_&]:border-l-cyan",
    },
    {
      href: "#prohibitions",
      label: "Cannot receive",
      meta: prohibitions.length === 0 ? "none" : `${prohibitions.length} declared`,
      mark: "[body:has(#prohibitions:target)_&]:border-l-cyan",
    },
    {
      href: "#fields",
      label: "Every field",
      meta: `${declared} declared`,
      mark: "[body:has(#fields:target)_&]:border-l-cyan",
    },
    {
      href: "#version-history",
      label: "Version history",
      meta: `${versions.length} version${versions.length === 1 ? "" : "s"}`,
      mark: "[body:has(#version-history:target)_&]:border-l-cyan",
    },
    {
      href: "#card-source",
      label: "Card source",
      meta: source === undefined ? "digest only" : "yaml",
      mark: "[body:has(#card-source:target)_&]:border-l-cyan",
    },
  ];

  return (
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ---------- */}
      <header className="flex flex-col gap-5">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/nodes" className="transition-colors hoverable:hover:text-cyan">
            ← Nodes
          </Link>
          {/* `--color-faint` is 1.83:1 and `globals.css` allows it on decorative
              separators only, always `aria-hidden`. The `<nav>` and its two entries
              already carry the hierarchy, so the slash is decoration and is marked as
              such rather than being lifted to `--color-dim` — a 5.4:1 slash would read
              as the third item in a two-item trail. */}
          <span aria-hidden className="mx-2 text-faint">
            /
          </span>
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
            <div
              id="download"
              className="ml-auto flex scroll-mt-24 flex-wrap items-center justify-end gap-2"
            >
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
              {/* The same affordance the blueprint page's header carries, at the address
                  this page can honestly print. `scripts/generate-bundles.ts` writes every
                  pinned card version a second time under `public/cards/`, so a card has a
                  URL of its own rather than only one inside whichever blueprint happens to
                  pin it — which would name a blueprint the reader did not ask about and
                  404 the day it left the archive. The `data:` button beside this stays: it
                  is the click-to-save path, and this is the paste-into-a-terminal one.

                  Last in the group for the layout reason the blueprint page's copy of this
                  comment records: only the final item is guaranteed to end at the group's
                  right edge on a wrapped line, which is what its `right-0` panel is
                  anchored to. */}
              <CloneMenu
                kind="node"
                command={cardDownloadCommand(record.ref)}
                cliCommand={`darkprint clone card ${record.ref}`}
              />
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
              className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}
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
                className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}
              >
                <span className="text-muted">phase ·</span>
                {phase.label}
                <span aria-hidden>→</span>
              </Link>
            ))}
            {/* The one violet chip in the row, and now the only violet on the page.
                Doc 2 §1.1: this states where a person acts, which is a third fact read
                off the card — not a warning about the card, so not the alarm pink it
                used to wear either.

                It used to be one of five violet chips, which meant the colour said
                nothing: a reader could not tell the chip about a person from the chip
                about a node type. The vocabulary links beside it are cyan now, because
                they are links, and violet is left doing the one job
                `lib/format.ts`'s `HUMAN_PRESENCE_MARK` reserves it for. */}
            {card.requiresHuman && (
              <span className={cx(CHIP, "border-violet/40 bg-violet/10 text-violet")}>
                <span aria-hidden>⏸</span> human in the loop
              </span>
            )}
            {/* The negative half of the interface, named in the header so it is not
                something a reader finds only by scrolling.

                A link now, not a statement: the panel carrying the entries is 1500px
                down and this was the only mention of them above the fold. That also
                settles its colour — it goes somewhere, so it is cyan like the two
                vocabulary chips, and the row's remaining violet is the human one. */}
            {prohibitions.length > 0 && (
              <a href="#prohibitions" className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}>
                <span className="text-muted">cannot ·</span>
                {prohibitions.length} declared
              </a>
            )}
            {/* Risk, in the header, which is the one fact a reader deciding whether to
                wire this node most needs and the one the header did not carry.

                `merge-executor` is the case that makes it plain: a node whose job is
                merging pull requests, declaring `secret-access` and `unchecked-write`,
                whose header said `cannot · 2 declared` and nothing else. The count of
                prohibitions is a second-order fact; the markers are the decision. Worse,
                the markers only appeared in the aside, which on a phone is DOM-ordered
                after the whole main column — about 3000px down, below a raw YAML dump.

                `--color-warn`, matching the marker cards in the aside it links to, and
                no longer `--color-amber`. Amber is spent on two things and this is
                neither: `ComingSoonBadge` ("not built yet") and `.route-box` ("this box
                leaves the page"). The collision was live in this very row — the `◐
                seeded` honesty marker three chips to the left is amber because nothing
                stands behind that number, and a risk marker in the same hue said the
                risk was equally notional. Warn is the darker, less saturated tier the
                token exists for, still 6.7:1 on this ground. Rendered only when there
                are markers, so the quiet case stays quiet. */}
            {risks.length > 0 && (
              <a
                href="#evaluation"
                className={cx(
                  CHIP,
                  "border-warn/50 bg-warn/10 text-warn hoverable:hover:border-warn",
                  CHIP_PRESS,
                )}
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

      {/* ---------- Body ----------
          `gap-10`, not `gap-8`. 32px is off the eight-point ladder this redesign holds
          the site to — block↔block is 40 — and it was the gap between every panel on the
          page, so the one value the reader meets most often was the one furthest from
          the scale. */}
      <div className="mt-10 grid gap-10 lg:grid-cols-3">
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
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-2">
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
            className="scroll-mt-24"
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
            className="scroll-mt-24"
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
            className="scroll-mt-24"
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
                        <span className="label inline-flex items-center gap-1">
                          <span aria-hidden>◌</span> free text
                        </span>
                      </li>
                    ) : (
                      /* Emerald, not violet. What separates this row from the one above
                         it is that the resolver holds the graph to it — a fact read off
                         the engine, which is the job emerald carries everywhere else on
                         this page (the download figure, the `✓ none declared` line in
                         the aside). Violet had to go regardless: it is reserved for
                         where a person acts, and the chip inside this row is a cyan link
                         now, so a violet frame around it named nothing at all. */
                      <li
                        key={p.entry}
                        className="flex flex-col gap-1.5 rounded-md border border-emerald/30 bg-emerald/5 px-3 py-2.5"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <TermChip
                            href={termHref(p.term.id)}
                            label={p.entry}
                            aria={`Ontology data type: ${p.term.label}`}
                          />
                          <span className="label inline-flex items-center gap-1 text-emerald">
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
                    `components/build/workspace.test.ts` guards. That exemption exists for copy
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
              has `/what-a-blueprint-is#the-words`, which carries what `/concepts`
              used to and is linked below.

              Two limit statements came off with the prose and are not lost. That a
              `model` is a default a graph's `model_stylesheet` can override, and that a
              `skill` is a pointer with no document in the bundle, are both said on
              `/what-a-blueprint-is#the-words` in the `skill` and `model` rows of
              `WhatACardReaches`. The
              footnote under this table points there rather than restating them per card,
              53 times over. */}
          <Panel
            id="fields"
            className="scroll-mt-24"
            label="Every field on this card"
            meta={`${declared} declared, in five blocks`}
          >
            <div className="flex flex-col gap-5">
              {CARD_BLOCKS.map((block) => {
                const rows = FIELD_ROWS.filter((row) => row.block === block.id);
                if (rows.length === 0) return null;
                return (
                  <section key={block.id} className="flex flex-col gap-2">
                    {/* The block title, in the skeleton's own words.
                        ------------------------------------------------------------
                        `--color-copper-line`, the token the landing's node figure paints
                        its YAML keys in (`components/home/nodecard/YamlListing.tsx`,
                        `key: "text-copper-line"`). The home page presents a node card in
                        the copper register and this page IS a node card presented at
                        full size, so the two surfaces now name the same object in the
                        same colour. Before this they disagreed: the landing said copper,
                        here the five block titles and eighteen field names said
                        `--color-key` (= `--color-cyan-bright`).

                        This is NOT `--color-amber`, and it must never become it. Amber
                        carries two meanings sitewide and neither is this one: "not built
                        yet" and "this box leaves the page". These field names were amber
                        once — about twenty amber items in a single viewport, none of them
                        coming soon and none of them an exit, the largest single dilution
                        of a semantic colour the site had. Copper is the pole that exists
                        precisely so a card can read orange without borrowing that lie:
                        oklch hue 46 against amber's 75, see the token's docblock in
                        `globals.css`.

                        It is also not `text-cyan`: cyan says a thing can be clicked and a
                        block title cannot. That argument, which the previous `--color-key`
                        repoint was built on, is satisfied by copper too — copper is spent
                        on exactly one claim, "this is a node card", and a name in a card
                        is the most literal instance of it.

                        Measured in the browser on this page, not assumed: the panel's
                        `color-mix(oklab, --color-surface 92%, transparent)` composited
                        over `--color-void` was sampled off a canvas at rgb(9, 11, 21),
                        and `#ff8a4d` on it reads **8.40:1**. AAA at the 12px `<dt>` and
                        at the 14px `.label-lead`, against a 4.5:1 requirement. Flat
                        token only — the
                        copper docblock's floor is explicit that `line/70` lands at 4.3:1,
                        so no `/80` and no `/70` on these two call sites.

                        `.label-lead` rather than an `<h3>`, for the reason `globals.css`
                        writes down: a mono uppercase run is a label, and a label is not
                        a heading level. The panel's own `<h2>` is the outline position
                        this group sits under; five sibling `<h3>`s at 12px underneath a
                        13px `<h2>` were claiming a level the type never drew. */}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="label-lead text-copper-line">{block.label}</span>
                      <span className="label">{block.ref}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-dim">{block.purpose}</p>

                    <dl className="flex flex-col">
                      {rows.map((row) => {
                        const value = row.read(card, fieldView);
                        const note = FIELD_NOTE[row.wire ?? row.name];
                        const detail = row.detail?.(card, fieldView);
                        const measure = row.measure?.(card);
                        /* Whether this row is a `<details>` at all, which is what decides
                           whether a clamp on it can ever be undone. Every key of doc 1 §3
                           has a note, so in practice it is always true; a row that somehow
                           opened onto nothing must not also be a row that hides half its
                           value behind a fold nobody can lift. */
                        const opens = detail !== undefined || note !== undefined;
                        const head = (
                          <>
                            {/* `text-copper-line`, the same token as the block title
                                above and for the same reason: this is a YAML key, and the
                                landing figure paints a YAML key copper. Not `text-cyan`:
                                cyan says a thing can be clicked and a field name cannot,
                                so the key tier carries no underline and no hover. The
                                value beside it stays `text-fg`/`text-dim`, which is also
                                what `YamlListing` does with its scalars — the key is what
                                the register marks, not the whole row. */}
                            <dt className="font-mono text-[12px] text-copper-line">
                              {row.name}
                              {/* The meta slot: how long a prose field is, under its name
                                  where the clamp cannot reach it. Beside the name on a
                                  phone, where the grid is one column and the `dt` is its
                                  own row. */}
                              {measure !== undefined && (
                                <span className="label ml-2 sm:ml-0 sm:mt-1 sm:block">
                                  {measure}
                                </span>
                              )}
                            </dt>
                            <dd
                              className={cx(
                                "min-w-0 font-mono text-[12px] leading-relaxed",
                                value.empty ? "text-dim" : "text-fg",
                              )}
                            >
                              {/* The value, clamped to three lines and unclamped by the
                                  row's own open state. `group` is on the `<details>`
                                  inside `FieldDisclosure`, so this is CSS and nothing
                                  else: the whole value is in the prerendered HTML, in the
                                  accessible tree, and findable by find-in-page whether the
                                  row is open or shut.

                                  Three rather than the skeleton pane's two, because this
                                  panel has no height cap and 23 rows do not share a
                                  `max-h-[26rem]` box here. Lines rather than characters
                                  because this column measures 534px on a desktop and 290px
                                  on a phone, and one character budget cannot be right at
                                  both widths.

                                  `Ticked` because a card's `spec` and `notes` are written
                                  with `backticked` port and parameter names, and the note
                                  this row opens onto renders its own ticks as chips. */}
                              {/* `line-clamp-3` alone, never beside a `block`: the clamp
                                  works by setting `display:-webkit-box`, and Tailwind
                                  emits the two display declarations in an order that let
                                  `block` win. Measured, not assumed — the first version of
                                  this row carried both and rendered a `spec` at its full
                                  196px with the clamp inert. */}
                              <span
                                className={
                                  opens ? "line-clamp-3 group-open:line-clamp-none" : "block"
                                }
                              >
                                <Ticked text={value.text} />
                              </span>
                              {/* Where a field has a panel of its own, the row points at
                                  it as well. Outside the clamp, so the pointer is never
                                  the thing that gets folded away. */}
                              {row.seeHref !== undefined && !value.empty && (
                                <a
                                  href={row.seeHref}
                                  className="mt-1 inline-block text-[11px] text-dim underline decoration-line underline-offset-4 transition-colors hoverable:hover:text-cyan"
                                >
                                  {row.seeLabel}
                                </a>
                              )}
                            </dd>
                          </>
                        );

                        /* A row with nothing more to say stays a plain row. A summary
                           that opens onto nothing is a worse offer than no affordance,
                           which is the same rule the vocabulary chips follow. Every key
                           of doc 1 §3 has a note, so in practice this branch is the
                           guard for a row added here before its note was written. */
                        if (!opens) {
                          return (
                            <div
                              key={row.name}
                              className="grid gap-x-4 gap-y-1 border-t border-line/70 py-2 pl-[1.15rem] first:border-t-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)]"
                            >
                              {head}
                            </div>
                          );
                        }

                        /* The marker's placement, its 11px size and the `pl` that
                           reserves its gutter all moved into `FieldDisclosure`, which
                           the blueprint page's card skeleton now draws its own rows
                           with. The reasoning went with them; the short of it is that a
                           browser's native triangle sits outside this grid and pushes
                           the first column out of line with the rows that have none. */
                        return (
                          <FieldDisclosure
                            key={row.name}
                            className="border-t border-line/70 first:border-t-0"
                            summaryClassName="grid gap-x-4 gap-y-1 py-2 pl-[1.15rem] transition-colors hover:bg-surface-2/50 sm:grid-cols-[9rem_minmax(0,1fr)]"
                            bodyClassName="flex flex-col gap-3 pb-3 pl-[1.15rem] sm:pl-[10.15rem]"
                            summary={head}
                          >
                            {/* What the field is for, first and the same on every card,
                                then what this card in particular put in it. */}
                            {note !== undefined && (
                              <Detail>
                                <Ticked text={note} />
                              </Detail>
                            )}
                            {detail}
                          </FieldDisclosure>
                        );
                      })}
                    </dl>
                  </section>
                );
              })}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-dim">
              What each of these fields is for, once rather than on every card:{" "}
              {/* Cyan, because it is a link. Amber marks a *box* that leaves the page —
                  `.route-box`, which is a rectangle with a rule down its leading edge —
                  and an inline sentence link wearing the same hue was a third meaning
                  for the colour on a page that already had two too many. */}
              <Link
                href="/what-a-blueprint-is#the-words"
                className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
              >
                eval, harness and the rest <span aria-hidden>&rarr;</span>
              </Link>
            </p>

            {card.notes !== undefined && (
              /* Kept, and kept out of the table. Everything above is a field and a value;
                 this is a paragraph the author wrote, and folding it into a `dd` would
                 make one row twenty times the height of the others. */
              <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5">
                {/* A caption, not a heading. It labels one paragraph inside a section
                    that already has its `<h2>`, and an `<h3>` here put a third outline
                    level on the page that the type never drew. */}
                <span className="label">Notes from the author</span>
                <p className="border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-muted">
                  <Ticked text={card.notes} />
                </p>
              </div>
            )}
          </Panel>

          {/* Wrapped only to give the card map something to land on. `VersionHistory`
              renders its own `<section>` and its own `<h2>` and takes no `id`, so the
              scroll target and its offset have to live on a box around it. */}
          <div id="version-history" className="scroll-mt-24">
            <VersionHistory versions={history} />
          </div>

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
                  /* Open by default since 2026-08-08, on the author's instruction: "in each
                     node page, keep the Card source uncollapsed as we did for the
                     blueprint.dot in the panel present of each blueprint page."

                     The note above argues the other way and it argued it well, so this is a
                     reversal rather than an oversight. What it weighed was WORD COUNT — 496
                     of 1239 words on `intent-router`, re-printing fields the panels above
                     already draw. What it did not weigh is that a blueprint page ships its
                     `.dot` open on the same argument and always has, so the registry said
                     "the bytes are one click away" for a card and "here are the bytes" for
                     a graph, which is one claim in two voices.

                     The mobile clipping the note names is not back with it: the `<pre>`
                     that set this column's min-content at 783px was fixed at the top of the
                     column, in the wrapper, not by keeping the panel shut.

                     `collapsible` stays, so a reader who has read the file can put it away. */
                  defaultOpen
                />
                {/* Selectable, not a tooltip. The full digest was rendered only in the
                    `title` of the Identity row, which a keyboard or touch reader cannot
                    reach and nobody can copy; this is the one place it exists as text. */}
                <p className="flex flex-wrap items-baseline gap-2 font-mono text-[11px]">
                  <span className="label">digest</span>
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
                <h2 id="card-source-heading" className="label-lead">
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
          className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-20 lg:self-start"
        >
          {/* The rail leads, because the rail is the way in.
              ------------------------------------------------------------
              "On this card" used to sit third, under the two answer panels, on the
              argument that the sticky aside had visible empty space beneath them and
              this was a use for it. That argument was about where there was ROOM, not
              about what a reader meets first, and it put the page's only table of
              contents below the fold of the aside's own stack.

              The two panels below are answers you look up — can this node do damage, and
              which version am I reading. You go to them with a question already formed.
              The rail is the opposite: it is how you find out what questions this page
              can answer at all, on a document that runs past four thousand pixels and
              nine panels. First position is the one thing a rail wants, so it takes it.

              Nothing else moves. Both panels keep their `id` and their `scroll-mt-24` on
              the same JSX tags, so `#evaluation` (the header's risk chip) and
              `#identity` still resolve; the six rail rows are the same six anchors in
              the same order, `cardMap` is not order-coupled to this stack, and no test
              reads this file's source order. Measured at 1440x900: the aside's three
              panels total 761px against a sticky `top-20`, so the whole stack still
              fits one viewport and promoting the rail pushes nothing out of view. */}
          <CardMap entries={cardMap} />

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
                  {/* A caption over a list, not a heading. The panel's own `<h2>` is the
                      outline position; this names the half of it below the rule. */}
                  <div className="flex items-center gap-2">
                    <span className="label">Risk markers</span>
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
                              /* `--color-warn`, the severity tier, rather than
                                 `--color-amber`. These cards and the `◐ seeded` marker in
                                 the header are the two amber surfaces a reader meets on
                                 the same card, and one of them means "nothing stands
                                 behind this number" while the other means "this node can
                                 do damage". The token exists so those two can never be
                                 the same signal again. */
                              className="flex flex-col gap-1 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 transition-[transform,scale,color,background-color,border-color] duration-[var(--dur-base)] ease-out hoverable:hover:border-warn active:scale-[0.99] active:duration-[var(--dur-press)]"
                            >
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-warn">
                                  <span
                                    className="h-1 w-1 rounded-full bg-current"
                                    aria-hidden
                                  />
                                  {risk.label}
                                </span>
                                {risk.weight !== undefined && (
                                  <span className="font-mono text-[11px] tabular-nums text-warn">
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
                    className="underline decoration-line-bright underline-offset-4 transition-colors hoverable:hover:text-cyan hoverable:hover:decoration-cyan"
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
