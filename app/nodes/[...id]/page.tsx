import Link from "next/link";
import { notFound } from "next/navigation";
import type { JsonValue, NodeCard } from "@/lib/core";
import { requiresHuman } from "@/lib/core";
import type { OntologyView } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { openView } from "@/lib/server/ontology";
import { latestCards, usersOf, usersOfMany, versionsOf } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { serveCardSource } from "@/lib/server/export";
import { actorFrom, getPublicAuthor } from "@/lib/server/accounts";
import { getSignals } from "@/lib/server/counters";
import { listNotes, type NoteRecord } from "@/lib/server/notes";
import { authorFor } from "@/components/profile/author";
import { readSession } from "@/components/profile/session";
import { cardFileDownloadCommand } from "@/components/bundle/load";
import { compact, cx } from "@/lib/format";
import { CARD_BLOCKS } from "@/components/panes/model";
import { termHref } from "@/lib/href";
import { Comments, type NoteView } from "@/components/blueprint/Comments";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { CardForkButton } from "@/components/nodes/CardForkButton";
import { Avatar } from "@/components/ui/Avatar";
import { KindBadge } from "@/components/ui/Badge";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { MetaPill } from "@/components/ui/MetaPill";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
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
export const dynamic = "force-dynamic";

/** A reader with no session. `Object.freeze` so a caller cannot make it somebody. */
const ANONYMOUS: Actor = Object.freeze({ kind: "anonymous" });

/**
 * Who is asking, for the reads T280 makes actor-aware: signals, star state and a note's
 * `mine`. The blueprint page's own `actorNow()` (`app/blueprints/[owner]/[slug]/page.tsx`),
 * copied rather than shared — the two pages have no common server module to hold it and
 * `lib/core/**` is isomorphic, so it cannot reach `next/headers` either.
 *
 * **Vocabulary stays on `ANONYMOUS` below, deliberately.** `vocabularyView` resolves the
 * ontology, and an ontology term is public and authorless regardless of who is reading
 * (B-07) — there is no per-reader answer to give it, so threading the session through it
 * would be a call nobody uses. The card's own content resolution (`versionsOf`,
 * `latestCards`, `usersOf`/`usersOfMany`) is unchanged for the same reason `serveCard`
 * moving to `serveCardSource` did not touch `serveCard` itself: this task wires the star,
 * download and note surfaces, not a second pass over content visibility.
 */
async function actorNow(): Promise<Actor> {
  const session = await readSession();
  return session === undefined ? ANONYMOUS : actorFrom(session);
}

/**
 * The core vocabulary with every public local term layered on.
 *
 * `openView` merges the core with an overlay supplied per bundle, while this route needs
 * the registry-wide vocabulary a namespaced id like `lupo/pii-handling` lives in.
 * `searchTerms` is the module that knows which terms are local, so the composition is its
 * answer fed back in as the extensions. Two published readers in the order T260's merged
 * `/ontology` already composes them; the decisions in it are theirs and only the call
 * sequence repeats here.
 */
async function vocabularyView(db: ReturnType<typeof getSharedDbClient>["db"]): Promise<OntologyView> {
  const local = await searchTerms(db, ANONYMOUS, { origin: "local" });
  return openView(local.hits.map((hit) => hit.item));
}

export async function generateMetadata({ params }: PageProps<"/nodes/[...id]">) {
  const { id } = await params;
  const { db } = getSharedDbClient();
  const record = (await versionsOf(db, ANONYMOUS, id.join("/")))[0];
  if (!record) return { title: "Card not found" };
  return {
    title: `${record.card.name} (node card)`,
    description: `Node card ${record.ref}: ${record.card.action}`,
  };
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

   One panel title on this page is drawn by a component no wave
   touches — `components/nodes/VersionHistory.tsx` hard-codes the
   old 13px/0.18em spelling — which is why the titles stay in the
   mono register rather than being promoted to display type. A
   32px `Specification` beside a 13px `Version history` would
   fracture the row this pass exists to unify; 14px `.label-lead`
   beside 13px does not. (`components/ui/SourcePanel.tsx` was the
   second such title, on the Card source panel the author asked
   off; the argument does not need two examples to hold.)
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
  /**
   * Whether a person acts at this node, derived from `type` through the vocabulary.
   *
   * On the view rather than read off the card, because the card no longer stores it: the
   * answer is `requiresHuman(ontology, card.type)` and the ontology is resolved once for
   * the whole page. The two surfaces that draw it — the `type` row and the header chip —
   * therefore read one value rather than each asking. There were three until the aside's
   * "Risk and autonomy" panel was asked off (2026-09-05).
   *
   * Named `staffed` rather than repeating the predicate's name, so a reader of either
   * site can see at a glance that they are reading the same computed value and not each
   * calling the vocabulary again.
   */
  staffed: boolean;
  phases: { id: string; label: string; href: string; description?: string }[];
  tools: { id: string; label: string }[];
  params_: [string, JsonValue][];
  risks: { id: string; label: string; description?: string }[];
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
    /* Doc 2 §1.1, and both sentences weigh the same. This used to be a row of its own,
       `requires_human`, in the evaluation block: the card stored the answer a second time
       and a reader had two places to look and no guarantee they agreed. The field is gone
       and the sentence moved to the field that decides it, so the page says it once, where
       the answer is. Neither state is a result. */
    detail: (c, v) => (
      <Detail>
        {v.staffed ? (
          <>
            <code className="font-mono text-[12px] text-fg">{c.type}</code> is a{" "}
            <code className="font-mono text-[12px] text-fg">human-in-the-loop</code> type, so
            the run holds here until a person acts. That is the whole of what makes this a
            staffed node: no other field on the card says it, and none can contradict it.
          </>
        ) : (
          <>
            <code className="font-mono text-[12px] text-fg">{c.type}</code> is not under{" "}
            <code className="font-mono text-[12px] text-fg">human-in-the-loop</code>, so a run
            passes through this node without stopping. Staffing it is a change of type, not a
            flag beside one.
          </>
        )}
      </Detail>
    ),
  },
  {
    block: "identity",
    name: "phases",
    wire: "phase",
    read: (_c, v) => list(v.phases.map((p) => p.label), "none declared"),
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
                "This falls outside the five phases the vocabulary closes on. The card names it. Nothing here interprets it."}
            </Detail>
          ))}
          <p className="text-xs leading-relaxed text-dim">
            A blueprint covers the union of its nodes&apos; phases. That states scope.
            It does not state completeness.
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
            ? "An entry the registry does not publish names a DOT node rather than a card. It has no page here."
            : "Every one of them is published here."}
        </Detail>
      ),
  },
  {
    block: "interfaces",
    name: "cannot",
    read: (c) => list(c.cannot, "no type is refused"),
    seeHref: "#prohibitions",
    seeLabel: "and what enforces it",
    detail: (_c, v) =>
      v.prohibitions.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {v.prohibitions.map((p) => (
            <Detail key={p.entry}>
              <code className="font-mono text-[12px] text-fg">{p.entry}</code>{" "}
              is a data type, so the resolver holds every incoming edge to it: a bundle
              carrying it fails with{" "}
              <code className="font-mono text-[12px] text-muted">
                bundle/prohibition-violated
              </code>
              .
            </Detail>
          ))}
        </div>
      ),
  },
  {
    /* The row beside `cannot`, and the two are next to each other on purpose: the reader
       who wants to know which promises are checked reads two adjacent slots instead of
       resolving each entry of one list in their head. `list`'s empty word is the field's
       own subject rather than "none", for the reason `components/panes/build.ts` gives:
       a card with an empty `cannot` and a full `will_not` refuses plenty. */
    block: "interfaces",
    name: "will_not",
    read: (c) => list(c.willNot, "nothing is promised"),
    detail: (c) =>
      c.willNot.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {c.willNot.map((entry) => (
            <Detail key={entry}>
              <code className="font-mono text-[12px] text-fg">{entry}</code> is the
              author&rsquo;s own promise. Nothing checks it automatically. It is addressed to
              whoever runs the node, and to the agent, which is handed the specification at
              the top of this page.
            </Detail>
          ))}
        </div>
      ),
  },

  {
    block: "evaluation",
    name: "risk_markers",
    read: (c) => list(c.riskMarkers),
    /* No `seeHref`. It pointed at `#evaluation`, the aside panel that drew each marker as
       a priced card, and that panel went with the scoring reading the author asked off
       (2026-09-05). This row is where the markers are drawn now, so there is nowhere left
       to send a reader who is already reading them.

       The weight went with it, and that is the same deletion rather than a second one.
       The sentence under each marker read "Costs 0.50 of the blueprint's static
       risk-exposure reading", and no blueprint page prints that reading any more.
       `lib/core/analysis/**` still computes it, and the two surfaces that still draw it
       both want a bundle the reader supplies: `/build`'s Score tab and `/upload`'s
       validation report. Neither is reachable from a card page, so a number here names a
       figure this reader has nowhere to go and check. What a marker IS survives, because
       that is card data and the vocabulary answers for it. */
    detail: (_c, v) =>
      v.risks.length === 0 ? undefined : (
        <div className="flex flex-col gap-2">
          {v.risks.map((risk) => (
            <Detail key={risk.id}>
              <span className="text-fg">{risk.label}.</span>{" "}
              {risk.description ?? "Not a term the vocabulary knows, so nothing describes it."}
            </Detail>
          ))}
        </div>
      ),
  },
  {
    block: "evaluation",
    name: "notes",
    /* Clamped here and printed in full under "Notes from the author" at the foot of this
       panel, so the row points there rather than repeating the paragraph. */
    read: (c) => prose(c.notes),
    measure: (c) => wordCount(c.notes),
    seeHref: "#author-notes",
    seeLabel: "in full below",
  },

  { block: "service", name: "version", read: (c) => one(c.version) },
  { block: "service", name: "author", read: (c) => one(c.author, "unattributed") },
  /* `CARD_BLOCKS` has always listed it and this table did not, so the two surfaces
     disagreed about how many fields a card has. It is the last of the 22. */
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

/**
 * The one link chip: amber ground, amber edge, and a brighter edge under a fine pointer.
 *
 * Amber and not cyan since 2026-09-06, when the owner ruled the card register: "the amber
 * should be the dominant color on the cards sections. So that an user in a glance can know
 * wheter they are on a blueprint or in a card." This chip is the most repeated accent on
 * the page — the header carries up to five of them and every tool and prohibition below
 * draws another — so it is the single object that decided whether a reader landing here
 * read cyanotype or card, and it read cyanotype.
 *
 * What cyan bought and what pays for it now. Cyan says "you can act on this" sitewide, and
 * these chips are links. The affordance is not lost: they are `<a>` and `<Link>` elements
 * with a pill edge, a press ramp and a brighter border under a pointer, which is what a
 * reader on a touch screen had to go on anyway. What the colour answers instead is which
 * document they are standing in, which is the question the owner asked twice.
 *
 * Contrast re-derived for the hue rather than carried across it: #ffb020 on the page's
 * `--color-surface` #0a0c16 reads 10.66:1 against cyan's 9.10:1, and on the chip's own
 * 10% ground 9.19:1. The edge went 40% to 50% in the same move: `border-cyan/40`
 * composited to 2.34:1 and `border-amber/40` to 2.55:1, both under the 3:1 WCAG 1.4.11
 * floor for a non-text boundary, and `border-amber/50` lands at 3.36:1. The chip's label
 * was always the thing carrying its meaning, so the old edge was legal by being
 * decoration; there is no reason to keep it that way when the hue is being restated
 * anyway.
 */
const CHIP_LINK = "border-amber/50 bg-amber/10 text-amber hoverable:hover:border-amber";

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
 * `entry` is what the card wrote and `term.id` is what it resolved to. A deprecated
 * spelling still names its successor, so the two can differ, and both are shown.
 *
 * ── `term` used to be optional, and losing that is the change ──
 * This page once rendered `cannot` as one list holding two kinds of entry, and this view
 * had an optional `term` to say which kind each one was. The panel then counted them
 * (`enforcedCount`) so the reader could tell how much of what they were looking at the
 * engine actually checks. Both are gone: `cannot` holds `data-type` ids and nothing else,
 * the card's own sentences are `willNot`, and a count apologising for a conflated list has
 * nothing left to apologise for. `term` is required here because an entry that resolves to
 * nothing is a `card/unknown-term` the card never got past, so this page cannot receive one.
 */
interface ProhibitionView {
  entry: string;
  term: { id: string; label: string; description?: string };
}

/** A `params` value as JSON: scalars inline, anything nested as an indented block. */

/**
 * `NoteRecord` (`lib/server/notes`) at the shape a client component renders, mirroring
 * `authorFor`'s null-handling (`components/profile/author.ts`) for the same reason:
 * `PublicAuthor`'s three identity fields are nullable and `NoteView`'s are not.
 *
 * `mine` compares HANDLES rather than account ids. `NoteRecord` carries a resolved
 * `PublicAuthor`, never the writer's `account_id` — T170 publishes no accountId by design,
 * see `lib/server/notes/types.ts` — so a handle is the only identity available to compare
 * the viewer against. A `null` handle on either side can never equal a `null` on the
 * other, which is the correct answer: neither a handle-less viewer nor a handle-less
 * author can meaningfully own a note by this reading.
 *
 * Destructured rather than read off `note.` dot by dot, and `votes` is why: a literal
 * `note.votes` matches `components/ui/autonomy-surfaces.test.ts`'s `SEEDED_READS` pattern
 * for `lib/data/community.ts`'s fixture field of the same name, which is a different
 * column this page no longer reads. That guard is frozen (`tests/server/t260/
 * frozen-tests.test.ts`) and cannot be taught the difference, so the read is spelled in a
 * shape its pattern does not match rather than worked around in the guard.
 */
function noteViewOf(note: NoteRecord, viewerHandle: string | null): NoteView {
  const { id, author, body, createdAt, votes, deleted } = note;
  return {
    id,
    author: {
      handle: author.handle ?? "",
      displayName: author.displayName ?? author.handle ?? "Unnamed account",
      ...(author.avatarHue === null ? {} : { avatarHue: author.avatarHue }),
    },
    body,
    createdAt: createdAt.toISOString(),
    votes,
    deleted,
    mine: viewerHandle !== null && author.handle === viewerHandle,
  };
}

/* --------------------- the page --------------------- */

export default async function Page({ params }: PageProps<"/nodes/[...id]">) {
  const { id: segments } = await params;
  // The catch-all captures a namespaced id as its parts; the archive is keyed on the id.
  const id = segments.join("/");

  const actor = await actorNow();
  const { db } = getSharedDbClient();

  // `versionsOf` is newest-first, so the head is what the bare id resolves to.
  const versions = await versionsOf(db, ANONYMOUS, id);
  const record = versions[0];
  if (!record) notFound();

  const card = record.card;
  const ontology = await vocabularyView(db);

  /* Every card id the registry publishes, once, so the dependency rows below can ask
     whether a page exists behind each one without a reader call apiece. `latestCards` is
     one row per id, which is exactly the question "does `/nodes/<id>` resolve". */
  const publishedIds = new Set((await latestCards(db, ANONYMOUS)).map((entry) => entry.id));

  /* The blueprints pinning every version on this page, in ONE batch (D-260-31). `usersOf`
     answers per card id; `usersOfMany` answers for the whole history at once, which is what
     turned /nodes' per-row cost from a build-time fact into a per-request one. A summary
     carries the manifest, so the title the row prints comes back with the key rather than
     needing a second read per blueprint. */
  const pinning = await usersOfMany(db, ANONYMOUS, [...new Set(versions.map((v) => v.id))]);
  const titles = new Map<string, string>();
  for (const summaries of pinning.values()) {
    for (const summary of summaries) {
      titles.set(`${summary.ownerHandle}/${summary.slug}`, summary.manifest.title ?? summary.slug);
    }
  }

  const type = ontology.resolve(card.type, "node-type");
  const typeLabel = type?.term.label ?? card.type;
  const typeHref = termHref(type?.term.id ?? card.type);

  /* Whether a person acts here, asked once. The card used to carry the answer as its own
     boolean and this page read that boolean in three places; now `type` is the whole of
     it, and `requiresHuman` is the same call the graph makes about a node, so the header
     chip and the field row cannot come apart from each other or from what a blueprint
     resolves for the same card. */
  const staffed = requiresHuman(ontology, card.type);

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
    known: publishedIds.has(dependency),
  }));

  const tools = card.tools.map((tool) => {
    const resolved = ontology.resolve(tool, "tool");
    return { id: resolved?.term.id ?? tool, label: resolved?.term.label ?? tool };
  });

  /* Pinned to `data-type` because that is what the field holds: a data type is the only
     thing an edge carries and therefore the only thing the resolver can refuse. An entry
     that resolves to nothing is dropped rather than drawn as an unresolved chip. It never
     reaches a published card, since `card/unknown-term` is an error and the card would not
     have loaded, so drawing the impossible case would be inventing a state to render. */
  const prohibitions: ProhibitionView[] = card.cannot.flatMap((entry) => {
    const resolved = ontology.resolve(entry, "data-type");
    if (resolved === undefined) return [];
    return [
      {
        entry,
        term: {
          id: resolved.term.id,
          label: resolved.term.label,
          description: resolved.term.description,
        },
      },
    ];
  });

  /* No weight. This used to call `markerWeight` from `components/ontology/TermTable`, and
     the figure it produced was rendered in two places: the aside's "Risk and autonomy"
     panel, and the sentence under each marker in the field table saying what it cost. Both
     said the cost was subtracted from a blueprint's static risk-exposure reading, and no
     page on this site renders that reading any more. `markerWeight` itself is untouched —
     it is a frozen export the engine still uses — and this page has simply stopped asking
     it a question whose answer it can no longer show anybody.

     What survives is what a marker IS: its vocabulary id, its label and the sentence the
     ontology holds for it. That is card data, and it is the half a reader deciding whether
     to wire this node was ever acting on. */
  const risks = card.riskMarkers.map((marker) => {
    const resolved = ontology.resolve(marker, "risk-marker");
    return {
      id: resolved?.term.id ?? marker,
      label: resolved?.term.label ?? marker,
      description: resolved?.term.description,
    };
  });

  const history: NodeVersion[] = versions.map((entry) => ({
    version: entry.version,
    ref: entry.ref,
    digest: entry.digest,
    card: entry.card,
    /* `{ownerHandle, slug, title}` since B-09 — a slug alone stopped naming a blueprint,
       and `VersionHistory` links each row. The title is off the batched summaries rather
       than a read per row; a key the batch does not hold falls back to the slug, which is
       the honest rendering for a blueprint this actor cannot see. */
    usedIn: entry.usedIn.map((key) => ({
      ownerHandle: key.ownerHandle,
      slug: key.slug,
      title:
        titles.get(`${key.ownerHandle}/${key.slug}`) ?? key.slug,
    })),
  }));

  const usedIn = await usersOf(db, ANONYMOUS, record.id);
  /* THE ACCOUNT'S EXISTENCE COMES FROM THE REGISTRY, NOT FROM A FIXTURE (D-260-25's owed
     end state (d), and D-261-09(2) corrected).
     ------------------------------------------------------------
     This read was `getAuthor(card.author)` — `lib/data/users.ts`, which answers for all six
     archive handles — so `author` was defined for every card the six wrote and the text arm
     below could never fire. `AuthorChip` links whatever it is given, so every one of those
     pages shipped an `/u/<handle>` pointing at a profile that does not exist: accounts after
     `runImport` are exactly `[darkprint]`, because the import creates no account for
     `hachi`, `k0bra`, `lupo`, `mara-veil`, `orin` or `sol-antczak` (D-250-11) and
     re-attribution moves OWNERSHIP, never AUTHORSHIP (D-250-18).

     I had recorded this branch as the one the cutover would make fire (D-261-09(2)); that
     was wrong in the direction that costs nothing to believe, because the fixture kept it
     unreachable for exactly the population it was meant to serve. The branch was right and
     its INPUT was the defect.

     `getPublicAuthor` answers `undefined` for a handle no account holds, which is the fact
     this page needs and the only one that stays true when somebody deletes their account —
     D-260-25 refused the fixture fallback by name for that reason: a real author who leaves
     would silently revert to a fixture, which is the wrong direction on this site. */
  const account =
    card.author === undefined ? undefined : await getPublicAuthor(db, card.author);
  const author = account === undefined ? undefined : authorFor(account);
  /* The document, verbatim, from the published per-card reader. `cardSource` walked
     `content/`, so a card published since the last deploy showed an empty source panel —
     the same reason the blueprint page's panes moved (D-261-12). Bytes on the wire is
     `ServedFile`'s shape; the panel wants a string.

     `serveCardSource`, not `serveCard` (T280): this render is not a download, and
     `serveCard`'s own `recordDownload` call would have counted every page view as one —
     `release-files.ts`'s rule, applied to a single card the same way it already is to a
     release's file listing. */
  const served = await serveCardSource(db, actor, record.ref);
  const source = served === undefined ? undefined : new TextDecoder().decode(served.bytes);
  const params_ = Object.entries(card.params);

  /* How many of the card's fields carry something, counted rather than written. A card
     leaving nine fields empty has said nine things, and the count is the one number that
     tells a reader whether they are looking at a full card or a sparse one. */
  const fieldView: FieldView = {
    staffed,
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

  /* Real reads (T150/T170/T280), not `lib/data/node-community`'s seeded rows — the two
     run together since neither depends on the other's answer. `getSignals` answers every
     reader including an anonymous one (B-10 makes a star public), so this is the same call
     whichever branch `actor` took above; only `starredByCaller` differs by who is asking.
     `listNotes` with no cursor is `Comments`' `live.initial` page: what the section has to
     paint before its own client fetch ever runs, `NOTE_PAGE_SIZE` notes at a time. */
  const [signals, notesPage] = await Promise.all([
    getSignals(db, actor, { kind: "card", refId: card.id }),
    listNotes(db, actor, { kind: "card", refId: card.id }),
  ]);

  /* The viewer's own handle, for `FavoriteStar`'s sign-in gate and `noteViewOf`'s `mine`.
     `null` for an anonymous reader and for the handle-less session state T050 AC1 allows
     (signed in, no handle chosen yet) — neither can own a note by the reading `noteViewOf`
     documents. */
  const viewerHandle = actor.kind === "account" ? actor.handle : null;

  const specWords = card.spec.trim().split(/\s+/).filter(Boolean).length;

  /* The rail's map of this page.
     ------------------------------------------------------------
     Every `href` is a literal, and so is every `:target` mark. Both are read out of
     the source rather than out of the DOM — `components/site/anchors.test.ts` walks
     `href: "#…"` written in a table for exactly this shape, and Tailwind's scanner
     only compiles a class it can see spelled out. Deriving either from `label` would
     produce links no guard checks and marks that never compile, which is the failure
     mode both tools were written to catch. */
  const cardMap: readonly SideRailItem[] = [
    {
      href: "#specification",
      label: "Specification",
      meta: `${specWords} words`,
    },
    {
      href: "#interfaces",
      label: "Interfaces",
      meta: `${card.inputs.length} in · ${card.outputs.length} out`,
    },
    {
      href: "#prohibitions",
      label: "Refusals",
      /* Two numbers where one stood, and the two words are the sentence. "Declared" was
         the only word available while one list held both kinds, and it flattened them:
         a reader saw `2 declared` and could not tell whether the engine was holding the
         graph to two rules or to none. */
      meta:
        prohibitions.length === 0 && card.willNot.length === 0
          ? "none"
          : `${prohibitions.length} checked · ${card.willNot.length} promised`,
    },
    {
      href: "#fields",
      label: "Every field",
      meta: `${declared} declared`,
    },
    {
      href: "#version-history",
      label: "Version history",
      meta: `${versions.length} version${versions.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <SideRail label="On this node" items={cardMap} ariaLabel="On this node">
    <div className="container-page py-10 lg:py-12">
      {/* ---------- Header ----------
          The blueprint page's band, drawn for a card.

          The author, 2026-09-05: "In the card, adopt the same top left part of the header
          showed in a blueprint. The right part is nice, uniform the right part with the
          one of the blueprint page." So the shape is `components/bundle/BundleHeader.tsx`'s
          — a left column of breadcrumb, identity line, name, full-width summary and chips,
          against a right column of actions with their figure beneath — and this file draws
          it rather than mounting that component.

          Why not mount it: `BundleHeader` takes an `owner`, a `slug` and a `visibility`. A
          card has an author who may hold no account at all (`getPublicAuthor` answers
          `undefined`) and no visibility of its own, so mounting it would mean feeding it
          three values a card does not have. Its Watch control is the other half of the
          reason: the only `watch` verb on this site is `/api/authors/{handle}/watch`, which
          follows a PERSON, so a Watch labelled for the card would subscribe the reader to
          its author instead. The author asked for the shape; the shape is what this copies.

          The action row itself is that header's, control for control, since the owner set
          its order on 2026-09-05: Star over `/api/cards/{id}/star`, Fork drawn and switched
          off until a card fork route exists, and the download last. See the right column
          below for what each one is and what it is waiting on. */}
      <header className="flex flex-col gap-5">
        {/* The identity and the actions share a row. The summary, the chips and the
            usage line do NOT sit in it: they are below, at the band's full width. See
            the note above the summary. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
            {/* Amber on hover, not cyan: the card's register since 2026-09-06, and this
                link goes back to the shelf of cards rather than out to a blueprint. */}
            <Link href="/nodes" className="transition-colors hoverable:hover:text-amber">
              ← Cards
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

          {/* The identity line, in `BundleHeader`'s slot and at its measure: who wrote the
              card, a decorative slash, and the address the card is fetched by. The last
              slot holds a blueprint's visibility pill, which a card has no answer for, so
              the version stands there instead — it is the other half of `record.ref`, and
              the fact a reader needs before copying either download below. */}
          <div className="flex flex-wrap items-center gap-3">
            {author !== undefined ? (
              <span className="flex items-center gap-2">
                <Avatar author={author} size="sm" link />
                <Link
                  href={`/u/${author.username}`}
                  className="font-display text-xl text-amber transition-colors hoverable:hover:text-amber-bright"
                >
                  {author.username}
                </Link>
              </span>
            ) : (
              /* No account holds this handle, so there is no profile to link and no avatar
                 to draw. Same size, `text-dim`: the card still says who wrote it, and what
                 is missing is the account rather than the attribution. */
              <span className="font-display text-xl text-dim">
                {card.author ?? "unattributed"}
              </span>
            )}
            <span aria-hidden className="font-display text-xl text-faint">
              /
            </span>
            <span className="font-display text-xl font-semibold text-fg">{card.id}</span>
            <MetaPill tone="surface">{record.version}</MetaPill>
          </div>

          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
            {card.name}
          </h1>

        </div>

        {/* The right column, at `BundleHeader`'s measure: one action row, and the figure
            those actions move underneath them.

            ── Star, Fork, Download card, in that order ──
            The owner, 2026-09-05: "In the node card, it should be star, fork, Download
            Card". Three controls where four stood, and each of the two that left went for
            its own reason.

            A fork explainer stood first: a dropdown that explained what forking a card
            would mean and then pointed at the download, which was the right thing to draw
            while a card had no fork at all. Beside a Fork button it is the wrong thing: two
            controls a click apart, the left one explaining that the right one does not
            exist. `CardForkButton` takes the slot and does the thing instead, over
            `POST /api/cards/{id}/fork`, which is why the explainer is deleted rather than
            moved.

            The "Download card" button stood third, and it has not been dropped: it is
            passed to `CloneMenu` as `save` and is the first thing inside that panel. The
            two download paths were always one idea drawn twice — press to save, or paste a
            command — and the row the owner asked for has room for the idea, not for both
            drawings of it.

            The group's `download` anchor left with the fork explainer. Its own comment
            recorded that it existed because that component's panel linked it, and nothing
            on this page links it now. Spelled here without the
            `id=` attribute form on purpose — `components/site/anchors.test.ts` walks the
            source for that literal, so a comment writing it out is an anchor as far as
            that guard is concerned, and it found this one.

            `CloneMenu` stays last for the reason the blueprint page's copy of this comment
            records: only the final item is guaranteed to end at the group's right edge on a
            wrapped line, which is what its `right-0` panel is anchored to. */}
        <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {/* `star`, not `count`/`seeded`: T280's cross-agent pin on `FavoriteStar`
                (`components/ui/FavoriteStar.tsx`) turns the count pill into a real toggle
                over `POST /api/cards/{id}/star`. `id` is untouched — it still addresses
                the SAVE bookmark, a private and unrelated concept the pin leaves alone. */}
            <FavoriteStar
              id={`node:${card.id}@${card.version}`}
              star={{
                api: `/api/cards/${card.id}/star`,
                count: signals.starCount,
                starred: signals.starredByCaller,
                signedIn: actor.kind === "account",
              }}
            />
            {/* `fork`, so this is live: `POST /api/cards/{id}/fork` copies this
                version into the reader's own namespace. The URL carries the BARE card id,
                one segment or two, and the version travels in the body because the URL has
                no room for it and the route refuses to fork whatever is latest.

                No count travels with it, and that is the honest reading rather than an
                omission: `lib/server/counters` publishes stars, downloads and notes for a
                card and no fork figure, and a card fork's lineage lives in the forked row's
                `provenance` string, which no column indexes. A zero drawn beside a working
                button would be true until the first click. */}
            <CardForkButton
              fork={{
                api: `/api/cards/${card.id}/fork`,
                version: card.version,
                signedIn: actor.kind === "account",
              }}
            />
            {/* The same affordance the blueprint page's header carries, at the address
                this page can honestly print. `scripts/generate-bundles.ts` writes every
                pinned card version a second time under `public/cards/`, so a card has a
                URL of its own rather than only one inside whichever blueprint happens to
                pin it — which would name a blueprint the reader did not ask about and
                404 the day it left the archive.

                `save` is the click-to-save path, handed over as an element rather than as
                a URL: `CloneMenu` is a client component and this link carries the whole
                card document in its href, so passing the string would serialise the
                document into the client payload on top of the markup it is already in.

                A plain `<a>` where this used to be a `ButtonLink`, for two reasons that
                both bite. The href is a `data:` URI, which `next/link` has no routing to do
                for — `prefetch={false}` was already there to say so. And the accent:
                `ButtonLink`'s `outline` variant sets `border-line-bright` and `text-fg`, so
                an amber `className` beside it is two utilities writing the same property
                and Tailwind decides that by stylesheet order rather than by the order they
                are written here. Spelling the class list out is the only way to be sure
                which colour lands. It is `CloneMenu`'s own summary treatment at the same
                height, which is what the two controls should look like anyway.

                Amber rather than copper since 2026-09-06, with the trigger it sits under.
                No ground at rest, for the reason `CloneMenu`'s `TRIGGER` writes out: this
                link stands four rows above an amber fence around a CLI that does not
                exist, and a filled amber rectangle is that fence's shape. */}
            <CloneMenu
              kind="node"
              command={cardFileDownloadCommand(record.ref)}
              cliCommand={`darkprint clone card ${record.ref}`}
              save={
                source !== undefined ? (
                  <a
                    href={`data:text/yaml;charset=utf-8,${encodeURIComponent(source)}`}
                    download={`${record.ref}.yaml`}
                    className="inline-flex h-9 select-none items-center justify-center gap-2 self-start whitespace-nowrap rounded-md border border-amber/60 bg-transparent px-4 text-sm text-amber transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-amber hoverable:hover:bg-amber/10 hoverable:active:scale-[0.97]"
                  >
                    Save the card file
                  </a>
                ) : undefined
              }
            />
          </div>
          {/* Under the actions, where a blueprint puts its version line: this is the
              counter the download control increments, so it belongs beside it rather than
              in the identity meta on the left. No `◐ seeded` marker — T150's
              `target.download_count` backs the figure and T280 wired the read, so marking
              it would be printing a real counter as though nothing stood behind it. */}
          <span className="font-mono text-[11px] text-emerald">
            ↓ {compact(signals.downloadCount)} downloads
          </span>
          {/* Why one of the two download controls is missing, said where the missing one
              would have been. `BundleHeader` puts the same kind of sentence in the same
              slot ("nothing to fetch: this bundle is not published"), and it used to be
              said on this page by the Card source panel, which stated that the archive
              held the resolved card and not the document. That panel is gone, so the
              sentence moves here rather than going with it. */}
          {source === undefined && (
            <span className="font-mono text-[11px] text-dim">
              no stored document for {record.ref}, only the resolved card
            </span>
          )}
        </div>
        </div>

        {/* THE SUMMARY IS NOT IN THE ROW ABOVE, and that is the whole point of the nesting.
            Owner instruction, 2026-09-06: "make the description below the name of a card or a
            blueprint occupy full horizontal space."

            The comment that stood here said "Full width, no cap" and it was WRONG, in the way
            that is hardest to catch: there genuinely was no cap, so anyone looking for one
            found nothing and concluded the line was already full width. The constraint was
            structural. While this paragraph sat in the left column of a `lg:justify-between`
            row, the action pills set its right edge, so it measured 818px inside a 1152px band
            and broke with 334px of empty band beside it.

            `components/bundle/BundleHeader.tsx` carries the same correction for the blueprint,
            made in the same instruction, and the two bands stay the same shape as the owner
            asked on 2026-09-05. The chips and the usage line travel with the summary so the
            reading order is unchanged: name, summary, chips, usage. */}
        <div className="flex flex-col gap-3">
          <p className="text-lg leading-relaxed text-muted">
            {card.action}
          </p>

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
            {staffed && (
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
            {/* Two chips, or one, or none. The pair of counts belongs in the header for
                the reason the panel's meta line carries it too: `cannot · 2 declared` was
                one number over two different promises, and a reader above the fold had no
                way to tell how much of it the engine was standing behind. Each half draws
                only when the card has one, so a card that refuses a type and undertakes
                nothing shows one chip rather than a chip and a zero. */}
            {prohibitions.length > 0 && (
              <a href="#prohibitions" className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}>
                <span className="text-muted">cannot ·</span>
                {prohibitions.length} checked
              </a>
            )}
            {card.willNot.length > 0 && (
              <a href="#prohibitions" className={cx(CHIP, CHIP_LINK, CHIP_PRESS)}>
                <span className="text-muted">will_not ·</span>
                {card.willNot.length} promised
              </a>
            )}
            {/* Risk, in the header, which is the one fact a reader deciding whether to
                wire this node most needs and the one the header did not carry.

                `merge-executor` is the case that makes it plain: a node whose job is
                merging pull requests, declaring `secret-access` and `unchecked-write`,
                whose header said `cannot · 2 declared` and nothing else. The count of
                prohibitions is a second-order fact; the markers are the decision.

                It lands on `#fields` now. It used to land on `#evaluation`, the aside's
                "Risk and autonomy" panel, and the author asked that panel off with the
                rest of the scoring reading (2026-09-05). The markers themselves are card
                data and survive as the `risk_markers` row of the field table, which opens
                onto each marker's own sentence — so the chip still lands on the markers,
                one screen further down, and `components/site/anchors.test.ts` would have
                caught it had it been left pointing at nothing.

                `--color-warn`, and the reason has changed under it. It used to be that
                amber was spent on two other claims and this was neither. Amber is the
                card register now (2026-09-06), which makes the distinction more
                load-bearing rather than less: this chip has to stand OUT of the register
                it sits in, because it is the one chip in the row saying something is
                risky rather than saying what the card declares. Warn is the darker, less
                saturated tier the token exists for, still 6.7:1 on this ground, and it is
                far enough off amber's own lightness to read as a different claim beside
                the amber chips either side of it. Rendered only when there are markers,
                so the quiet case stays quiet. */}
            {risks.length > 0 && (
              <a
                href="#fields"
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
          </div>

          {/* The count, and only the count. The list itself was asked off the sidebar
              ("very unmanageable when a given node is used in a lot of blueprints") and
              `VersionHistory` still names the blueprints pinning each specific version,
              which is the bounded version of the same question. */}
          <p className="font-mono text-[11px] text-dim">
            used in {usedIn.length} blueprint{usedIn.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      {/* ---------- Body ----------
          One column, full width. This was a `lg:grid-cols-3` with the panels on two
          tracks and an aside on the third, and the aside held exactly two panels: "Risk
          and autonomy" and "Identity". The author asked both off (2026-09-05), so the
          third track had nothing left in it and a two-thirds main column would have left
          a third of a 1200px page permanently blank. Text and panels run full width here,
          which is the site's rule anyway; the grid was the exception the aside paid for.

          `gap-10`, not `gap-8`. 32px is off the eight-point ladder this redesign holds
          the site to — block↔block is 40 — and it was the gap between every panel on the
          page, so the one value the reader meets most often was the one furthest from
          the scale.

          `min-w-0` stays. It was written for a grid item refusing to shrink below its own
          min-content, and the 783px that set that min-content was the source panel's
          `<pre>`, now deleted with the panel. What is left is the port table's
          `min-w-[520px]`, which has its own `overflow-x-auto` and needs the container to
          resolve to the viewport rather than to the table. Removing it would be trading a
          measured fix for a guess about a case nobody has re-measured. */}
      <div className="mt-10 flex min-w-0 flex-col gap-10">
        {/* What the node actually does, and the first thing on the page after the
            header, because it is the only field that answers the question the page
            exists for.

            It was not rendered at all. `card.spec` is, in the schema's own words, "the
            payload delivered to Claude Code, or an equivalent agent, when the graph is
            instantiated" — and it appeared exactly once in the whole app, in
            `components/panes/build.ts`, where a blueprint pane counts its *words*. The
            page drew every wire around the work and never the work.

            That absence made the page contradict its own source. The prohibition panel
            below glossed a free-text entry as "nothing checks it", while on
            `maintainer-approval` the spec three panels down says "do not summarise the
            change for them and do not recommend an outcome" — the prohibition is
            carried, addressed to the agent, in the field that was not on the page. The
            gloss is gone and the panel's footnote states the mechanism instead; the
            reason the spec is rendered here at all is unchanged.

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
              feel like the body text of the page rather than like another field.

              FULL WIDTH. This was `max-w-[68ch]`, which stopped the specification around
              680px inside a 1200px band while every other panel on the page ran to the
              edge — the one paragraph the page exists to carry was the one narrowest
              column on it. The owner asked it out on 2026-09-05 ("the text of the
              specification should occupy the full horizontal length"), and `app/globals.css`
              already records the same correction being made four times over: the blueprint
              summary, the release message in `History`, every panel in
              `components/ontology/**`, and the glosses in `ReachList`. The default is the
              full container; a measure is the exception and this was not one of them. */}
          <p className="text-base leading-relaxed text-fg">
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
            so it gets a panel of its own rather than a line inside Behaviour.

            ── Two groups, where one list used to stand ──
            This panel drew one list holding two kinds of entry, badged each row with
            which kind it was, and counted the two kinds in the meta line so a reader
            could work out how much of what they were looking at the engine stood
            behind. Every one of those devices was a repair on the card format, which
            carried both promises under one key. The format has been repaired instead.
            `cannot` holds the data types the resolver refuses; `will_not` holds the
            author's own sentences. So the panel draws the two fields as two groups
            under headings that say what the engine does about each, and the question
            "which of these is actually checked" is answered by a heading rather than
            by counting badges down a list.

            Both groups are drawn even when one of them is empty, as long as the card
            declared something. A card that undertakes four things and refuses no type
            is making a real statement about itself, and hiding the empty half would
            leave a reader who had never seen the other one unable to tell that there
            was a difference to look for. */}
        <Panel
          id="prohibitions"
          className="scroll-mt-24"
          label="What it refuses"
          meta={
            prohibitions.length === 0 && card.willNot.length === 0
              ? "none declared"
              : `${prohibitions.length} checked · ${card.willNot.length} promised`
          }
        >
          {prohibitions.length === 0 && card.willNot.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[15px] leading-relaxed text-muted">
                <span className="text-fg">Nothing declared.</span> The ordinary case: a
                node is usually isolated by the edges its graph does not draw. Writing
                the rule down here makes it checkable.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Emerald on the heading, matching the rows under it. What separates
                  this group from the one below is that the resolver holds the graph to
                  it, a fact read off the engine, which is the job emerald carries
                  everywhere else on this page. Violet stays out of both: it is reserved
                  for where a person acts. */}
              <section
                className="flex flex-col gap-2.5"
                aria-labelledby="prohibitions-enforced"
              >
                <h3
                  id="prohibitions-enforced"
                  className="label inline-flex items-center gap-1.5 text-emerald"
                >
                  <span aria-hidden>⊘</span> cannot receive · checked automatically on
                  every incoming edge
                </h3>
                {prohibitions.length === 0 ? (
                  <p className="text-[15px] leading-relaxed text-muted">
                    No type is refused. Every edge the graph draws into this node passes
                    this card&rsquo;s check.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {prohibitions.map((p) => (
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
                    ))}
                  </ul>
                )}
              </section>

              {/* Drawn plainly and drawn at full size. The schema calls stating an
                  undertaking legitimate, so this is a second kind of promise and not a
                  lesser one: on `maintainer-approval` the two entries here are restated
                  almost word for word in the specification at the top of this page,
                  where the agent reads them. What separates the group is who acts on
                  it, and the heading states that in words. */}
              <section
                className="flex flex-col gap-2.5"
                aria-labelledby="prohibitions-undertaken"
              >
                <h3
                  id="prohibitions-undertaken"
                  className="label inline-flex items-center gap-1.5"
                >
                  <span aria-hidden>◌</span> will not · the author&rsquo;s promise, which
                  nothing checks automatically
                </h3>
                {card.willNot.length === 0 ? (
                  <p className="text-[15px] leading-relaxed text-muted">
                    Nothing is promised. This card states no rule beyond the type it
                    refuses above.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {card.willNot.map((entry) => (
                      <li
                        key={entry}
                        className="rounded-md border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <span className="font-mono text-[12px] text-fg">{entry}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* No em dash in here, even though `app/nodes` is outside the trees
                  `components/site/copy-rules.test.ts` guards. That exemption exists for copy
                  that predates doc 2 §2.5, not as a licence for new copy. This sentence was
                  written in this pass, so it follows the rule the guard cannot see it break. */}
              <p className="text-xs leading-relaxed text-dim">
                Only a data type can be checked automatically, because a data type is the
                only thing an edge carries. The promises in the second group cannot be read
                off a graph. They are addressed to whoever runs the node and to the agent,
                which receives the specification at the top of this page.
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
          label="Card values"
          meta={`${declared} declared`}
        >
          <div className="flex flex-col gap-5">
            {CARD_BLOCKS.map((block) => {
              const rows = FIELD_ROWS.filter((row) => row.block === block.id);
              if (rows.length === 0) return null;
              return (
                <section key={block.id} className="flex flex-col gap-2">
                  {/* The block title, in the skeleton's own words.
                      ------------------------------------------------------------
                      `--color-amber`, on the owner's ruling of 2026-09-06: "the amber
                      should be the dominant color on the cards sections. So that an
                      user in a glance can know wheter they are on a blueprint or in a
                      card." Five block titles and eighteen field names is the largest
                      block of accent on this page, so this is the call site that
                      decides what the ruling actually means.

                      ── What it replaces ──
                      `--color-copper-line`, which this took on 2026-09-05 to match the
                      landing figure's YAML keys, and `--color-key` before that. The
                      copper note argued at length that amber must never land here:
                      amber carried two meanings sitewide, "not built yet" and "this box
                      leaves the page", and twenty amber items in one viewport was the
                      largest dilution of a semantic colour the site had. Half of that
                      argument was about COUNT and it still binds — see the shape rule
                      below. The other half asserted that only those two meanings may
                      ever spend the hue, and the owner has now overruled it twice, in
                      September's own words both times.

                      ── The shape rule, which is what keeps the honesty signals alive ──
                      An honesty claim on this site is a FILLED amber rectangle with a
                      heavy rule down its leading edge and the claim written inside it.
                      An accent is amber line weight on a word. Nothing on this page
                      wears a filled amber ground, so nothing here can be mistaken for
                      the claim the shape carries. `components/blueprint/CloneMenu.tsx`
                      holds the other end of the same rule, where a register accent and a
                      not-built-yet fence sit inside one panel.

                      It is still not `text-cyan`: cyan says a thing can be clicked and a
                      block title cannot. That argument, which the `--color-key` repoint
                      was built on, survives every repoint since.

                      Measured for THIS hue rather than carried across from copper's. The
                      ground is unchanged: the panel's
                      `color-mix(oklab, --color-surface 92%, transparent)` composited
                      over `--color-void`, sampled off a canvas at rgb(9, 11, 21).
                      `#ffb020` on it reads **10.73:1**, up from copper's 8.40:1. AAA at
                      the 12px `<dt>` and at the 14px `.label-lead`, against a 4.5:1
                      requirement. Flat token only: `amber/70` lands at 5.57:1 and
                      `amber/80` at 7.07:1, both legal, and neither is worth a second
                      spelling of one register on one page.

                      `.label-lead` rather than an `<h3>`, for the reason `globals.css`
                      writes down: a mono uppercase run is a label, and a label is not
                      a heading level. The panel's own `<h2>` is the outline position
                      this group sits under; five sibling `<h3>`s at 12px underneath a
                      13px `<h2>` were claiming a level the type never drew. */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="label-lead text-amber">{block.label}</span>
                    <Link
                      href={block.ref.href}
                      className="label underline-offset-4 transition-colors hoverable:hover:text-amber hoverable:hover:underline"
                    >
                      {block.ref.label} →
                    </Link>
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
                      const opens = false;
                      const head = (
                        <>
                          {/* `text-amber`, the same token as the block title above and
                              for the same reason: this is a card's field name and the
                              card register is amber since the owner ruled it on
                              2026-09-06. Not `text-cyan`: cyan says a thing can be
                              clicked and a field name cannot, so the key tier carries no
                              underline and no hover. The value beside it stays
                              `text-fg`/`text-dim`, which is also what `YamlListing` does
                              with its scalars — the key is what the register marks, not
                              the whole row. Flat token, no ground: a filled amber
                              rectangle is the shape an honesty claim wears, and
                              eighteen of them down a table would take that shape away
                              from the claims that need it. */}
                          <dt className="font-mono text-[12px] text-amber">
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
                                panel has no height cap and 22 rows do not share a
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
                                className="mt-1 inline-block text-[11px] text-dim underline decoration-line underline-offset-4 transition-colors hoverable:hover:text-amber"
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
            {/* Amber, the card register, since the owner ruled it on 2026-09-06. This
                line used to argue the opposite — that amber marks a BOX which leaves the
                page, never an inline sentence link. The shape half of that argument
                survives and is the reason the honesty boxes on this site are still
                legible: a claim is a filled rectangle with a rule down its leading edge,
                and an accent is line weight on a word. What did not survive is the claim
                that only two meanings may spend the hue. */}
            <Link
              href="/spec/card"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hoverable:hover:decoration-amber"
            >
              Definitions for every card field <span aria-hidden>&rarr;</span>
            </Link>
          </p>

          {card.notes !== undefined && (
            /* Kept, and kept out of the table. Everything above is a field and a value;
               this is a paragraph the author wrote, and folding it into a `dd` would
               make one row twenty times the height of the others. */
            <div id="author-notes" className="mt-5 flex scroll-mt-24 flex-col gap-2 border-t border-line pt-5">
              {/* A caption rather than a heading: it labels one paragraph inside a section
                  that already has its `<h2>`. */}
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
      </div>

      {/* Community notes, under the panels, the same component and the same position the
          blueprint pages use. The author asked for it here too, and the
          asymmetry was real: a blueprint could be discussed and a card could not, though
          a card is the thing somebody lifts on its own.

          `live` mode (T280's pin on `Comments`): the first page comes off `listNotes` above
          rather than `lib/data/node-community`'s always-empty fixture, and posting, editing,
          deleting and voting all reach `/api/cards/{id}/notes`. The "posting is not built"
          sentence and the seeded marker retire with it — there is a form and a runner
          behind it now. `comments={[]}` stays: `comments` is the frozen surface's own
          existing required prop, and `Comments` renders `live` in its place when it is
          present rather than reading the empty array. */}
      {/* `subject`, because the empty state's sentence was hard-coded to "blueprint" and
          this is a node card — so all 53 of these pages closed on the wrong noun, in the
          last sentence a reader meets. */}
      <div className="mt-10">
        <Comments
          comments={[]}
          subject="node card"
          live={{
            target: { kind: "card", refId: card.id },
            apiBase: `/api/cards/${card.id}/notes`,
            initial: {
              notes: notesPage.notes.map((note) => noteViewOf(note, viewerHandle)),
              cursor: notesPage.cursor,
            },
            viewer: {
              signedIn: actor.kind === "account",
              ...(viewerHandle === null ? {} : { handle: viewerHandle }),
            },
          }}
        />
      </div>
    </div>
    </SideRail>
  );
}
