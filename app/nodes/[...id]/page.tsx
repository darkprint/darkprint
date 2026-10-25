import Link from "next/link";
import { notFound } from "next/navigation";
import type { JsonValue, NodeCard } from "@/lib/core";
import { requiresHuman } from "@/lib/core";
import type { OntologyView } from "@/lib/core";
import { getSharedDbClient } from "@/lib/db";
import type { Actor } from "@/lib/server/policy";
import { openView } from "@/lib/server/ontology";
import { latestCards, storedVersionsOf, usersOf, usersOfMany } from "@/lib/server/registry";
import { searchTerms } from "@/lib/server/search";
import { serveCardSource } from "@/lib/server/export";
import { actorFrom, getPublicAuthor } from "@/lib/server/accounts";
import { getSignals } from "@/lib/server/counters";
import { listNotes, type NoteRecord } from "@/lib/server/notes";
import { authorFor } from "@/components/profile/author";
import { readSession } from "@/components/profile/session";
import { compact, cx } from "@/lib/format";
import { CARD_BLOCKS } from "@/components/panes/model";
import { termHref } from "@/lib/href";
import { Comments, type NoteView } from "@/components/blueprint/Comments";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { CardForkButton } from "@/components/nodes/CardForkButton";
import { Avatar } from "@/components/ui/Avatar";
import { NodeOverview } from "@/components/nodes/NodeOverview";
import detailStyles from "@/components/ui/DetailPage.module.css";
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
 * would be a call nobody uses. The pin joins (`latestCards`, `usersOf`/`usersOfMany`) stay
 * anonymous too: they name blueprints, and a private blueprint's name is that blueprint
 * appearing in a response.
 *
 * **The card's own versions resolve for the reader, through `storedVersionsOf`.** That is
 * the registry reader outside the pin index, so an owner reaches a private card, and a card
 * nobody pins yet has a page: a card published on its own through `POST /api/cards` is
 * exactly that until a release pins it, and its 201 answers this page's path.
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
  const record = (await storedVersionsOf(db, await actorNow(), id.join("/")))[0];
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
   here is a real `<h2>` wearing `.label-lead`, and a sub-group
   caption is a `<span className="label">` rather than an `<h3>`
   claiming an outline position it never earned.

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
    /* Printed in full here: this row is the one place the page shows the author's notes. */
    read: (c) => prose(c.notes),
    measure: (c) => wordCount(c.notes),
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
        <h2 id={`${id}-heading`} className="font-display text-xl font-medium text-cyan">
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

  // `storedVersionsOf` is newest-first, so the head is what the bare id resolves to.
  const versions = await storedVersionsOf(db, actor, id);
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
     This read was `getAuthor(card.author)` — `lib/data/users.ts`, which answers for six
     archive handles — so `author` was defined for every card and the text arm below could
     never fire. `AuthorChip` links whatever it is given, so every one of those pages shipped
     an `/u/<handle>` pointing at a profile that does not exist: the import creates no account
     for `hachi`, `k0bra`, `lupo`, `mara-veil`, `orin` or `sol-antczak` (D-250-11).

     Those six names are gone from `content/`. The archive's cards were generated rather than
     written, and they now carry the handle that generated them, which IS an account, so the
     chip resolves and the link lands on a profile that exists. The branch below still earns
     its place: a card published by anyone else names its own author, and that author may
     hold no account or may delete one.

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
  /* The clone line is the reference and nothing else, because that is the whole address of
     a card: `<id>@<version>` is unique across the registry and `/api/files/cards` is keyed
     by it, where a blueprint needs its owner because two accounts may hold the same slug.
     Qualifying it with the publisher was tried and 404s: the id itself may carry a
     namespace, so the CLI reads a leading segment as part of the id and asks for a card
     nobody published. */
  const cloneLine = `npx -y darkprint clone ${record.ref}`;
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
    { href: "#node-overview", label: "Overview" },
    {
      href: "#specification",
      label: "Instructions",
      meta: `${specWords} words`,
    },
    {
      href: "#interfaces",
      label: "Interfaces",
      meta: `${card.inputs.length} in · ${card.outputs.length} out`,
    },
    {
      href: "#fields",
      label: "Full card",
      meta: `${declared} declared`,
    },
    {
      href: "#version-history",
      label: "Version history",
      meta: `${versions.length} version${versions.length === 1 ? "" : "s"}`,
    },
  ];

  const header = (
    <header className="border-b border-blue-rule bg-surface">
      <div className={`container-page ${detailStyles.header}`}>
        <nav className={`${detailStyles.breadcrumb} font-mono text-xs text-dim`} aria-label="Breadcrumb"><Link href="/nodes" className="text-cyan hoverable:hover:underline">← Cards</Link><span aria-hidden className="mx-2 text-faint">/</span>{typeLabel}</nav>
        <div className={detailStyles.identity}>
          {author !== undefined ? <><Avatar author={author} size="sm" link /><Link href={`/u/${author.username}`} className="text-cyan hoverable:hover:underline">{author.username}</Link></> : <span className="text-dim">{card.author ?? "unattributed"}</span>}
          <span aria-hidden className="text-faint">/</span><span className="min-w-0 break-words text-fg">{card.id}</span><MetaPill tone="surface">{record.version}</MetaPill>
        </div>
        <h1 className={detailStyles.title}>{card.name}</h1>
        <p className={detailStyles.summary}>{card.action}</p>
        <div className={detailStyles.actions}>
            <FavoriteStar
              id={`node:${card.id}@${card.version}`}
              star={{
                api: `/api/cards/${card.id}/star`,
                count: signals.starCount,
                starred: signals.starredByCaller,
                signedIn: actor.kind === "account",
              }}
            />

            <CardForkButton
              fork={{
                api: `/api/cards/${card.id}/fork`,
                version: card.version,
                signedIn: actor.kind === "account",
              }}
            />

            <CloneMenu
              kind="node"
              cloneCommand={cloneLine}
              download={
                source !== undefined ? (
                  <a
                    href={`data:text/yaml;charset=utf-8,${encodeURIComponent(source)}`}
                    download={`${record.ref}.yaml`}
                    className="inline-flex min-h-9 w-fit max-w-full select-none items-center gap-2 rounded-md border border-amber/60 bg-transparent px-3 py-1.5 font-mono text-[12px] wrap-anywhere text-amber transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-amber hoverable:hover:bg-amber/10 hoverable:active:scale-[0.97]"
                  >
                    <span aria-hidden>↓</span>
                    {record.ref}.yaml
                  </a>
                ) : undefined
              }
            />
        </div>
        <div className={detailStyles.meta}>
          <Link href={typeHref} aria-label={`Ontology node type: ${typeLabel}`} className="text-cyan hoverable:hover:underline">{typeLabel}</Link>
          {phases.map((phase) => <Link key={phase.id} href={phase.href} aria-label={`Ontology phase: ${phase.label}`} className="hoverable:hover:text-cyan hoverable:hover:underline">{phase.label}</Link>)}
          {staffed && <span className="text-violet"><span aria-hidden>⏸</span> human in the loop</span>}
          {risks.length > 0 && <a href="#fields" className="text-warn">△ {risks.length} risk marker{risks.length === 1 ? "" : "s"}</a>}
          <span>used in {usedIn.length} blueprint{usedIn.length === 1 ? "" : "s"}</span>
          <span>↓ {compact(signals.downloadCount)} downloads</span>
          {source === undefined && <span>no stored document for {record.ref}, only the resolved card</span>}
        </div>
      </div>
    </header>
  );

  return (
    <SideRail label="On this node" items={cardMap} ariaLabel="On this node" layout="tabs" header={header} compact>
    <div className="container-page py-6 lg:py-8">
      <div className="flex min-w-0 flex-col gap-8">

        <NodeOverview card={card} />

        <Panel
          id="specification"
          className="scroll-mt-32"
          label="Instructions"
          meta={`${specWords} words · handed to the agent`}
          lead
        >

          <p className={`${detailStyles.prose} text-base text-fg`}>
            <Ticked text={card.spec} />
          </p>
        </Panel>

        <Panel
          id="interfaces"
          className="scroll-mt-32"
          label="Interfaces"
          meta={`${card.inputs.length} in · ${card.outputs.length} out`}
        >
          <NodeInterfaces
            inputs={card.inputs.map(port)}
            outputs={card.outputs.map(port)}
            dependencies={dependencies}
          />
        </Panel>

        <Panel
          id="fields"
          className="scroll-mt-32"
          label="Full card"
          meta={`${declared} declared`}
        >
          <details className="group">
            <summary className="cursor-pointer py-1 text-sm text-cyan">Show all {FIELD_ROWS.length} fields</summary>
          <div className="flex flex-col gap-5">
            {CARD_BLOCKS.map((block) => {
              const rows = FIELD_ROWS.filter((row) => row.block === block.id);
              if (rows.length === 0) return null;
              return (
                <section key={block.id} className="flex flex-col gap-2">

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

                      const opens = false;
                      const head = (
                        <>

                          <dt className="font-mono text-[12px] text-amber">
                            {row.name}

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

                            <span
                              className={
                                opens ? "line-clamp-3 group-open:line-clamp-none" : "block"
                              }
                            >
                              <Ticked text={value.text} />
                            </span>

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

                      return (
                        <FieldDisclosure
                          key={row.name}
                          className="border-t border-line/70 first:border-t-0"
                          summaryClassName="grid gap-x-4 gap-y-1 py-2 pl-[1.15rem] transition-colors hoverable:hover:bg-surface-2/50 sm:grid-cols-[9rem_minmax(0,1fr)]"
                          bodyClassName="flex flex-col gap-3 pb-3 pl-[1.15rem] sm:pl-[10.15rem]"
                          summary={head}
                        >

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

            <Link
              href="/spec/card"
              className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hoverable:hover:decoration-amber"
            >
              Definitions for every card field <span aria-hidden>&rarr;</span>
            </Link>
          </p>

          </details>
        </Panel>

        <div id="version-history" className="scroll-mt-32">
          <VersionHistory versions={history} />
        </div>
      </div>

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
