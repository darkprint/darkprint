import Link from "next/link";
import { notFound } from "next/navigation";
import type { JsonValue } from "@/lib/core";
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
import { termHref } from "@/lib/href";
import { Comments } from "@/components/blueprint/Comments";
import { ForkAction } from "@/components/blueprint/ForkAction";
import { AuthorChip } from "@/components/ui/Avatar";
import { ReachList, ReachRow } from "@/components/ui/ReachList";
import { KindBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { SourcePanel } from "@/components/ui/SourcePanel";
import { formatWeight } from "@/components/ontology/TermTable";
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

const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

/** Main-column panel: a hairline header bar over its body, like the schematic's. */
function Panel({
  id,
  label,
  meta,
  children,
}: {
  id: string;
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id={`${id}-heading`} className={LABEL}>
          {label}
        </h2>
        {meta !== undefined && (
          <span className="font-mono text-[11px] text-dim">{meta}</span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Sidebar panel: the flat `panel p-5` shape the blueprint page's aside uses. */
function SidePanel({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={cx(LABEL, "mb-4 block")}>
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
function ParamValue({ value }: { value: JsonValue }) {
  const nested = value !== null && typeof value === "object";
  const text = JSON.stringify(value, null, nested ? 2 : 0) ?? "null";
  return nested ? (
    <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-fg">
      {text}
    </pre>
  ) : (
    <code className="break-all font-mono text-[12px] text-fg">{text}</code>
  );
}

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

  const risks = card.riskMarkers.map((marker) => {
    const resolved = ontology.resolve(marker, "risk-marker");
    return {
      id: resolved?.term.id ?? marker,
      label: resolved?.term.label ?? marker,
      description: resolved?.term.description,
      weight: resolved?.term.defaultWeight,
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
  const downloads = downloadsFor(card.id);

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
              className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 font-mono text-[11px] text-violet transition-colors hover:border-violet"
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
                className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 font-mono text-[11px] text-violet transition-colors hover:border-violet"
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
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 font-mono text-[11px] text-violet">
                <span aria-hidden>⏸</span> human in the loop
              </span>
            )}
            {/* The negative half of the interface, named in the header so it is not
                something a reader finds only by scrolling. It wears the same chip as the
                dimensions beside it because it is the same kind of fact: something the
                card states about itself. The panel below carries the entries. */}
            {prohibitions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-0.5 font-mono text-[11px] text-violet">
                <span className="text-muted">cannot ·</span>
                {prohibitions.length} declared
              </span>
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
        {/* MAIN */}
        <div className="flex flex-col gap-8 lg:col-span-2">
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
                      <li
                        key={p.entry}
                        className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[12px] text-fg">{p.entry}</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
                            <span aria-hidden>◌</span> free text
                          </span>
                        </span>
                        <span className="text-xs leading-relaxed text-dim">
                          No data type by this name, so nothing checks it. It speaks to
                          whoever reads the card.
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
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-violet">
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

                <p className="text-xs leading-relaxed text-dim">
                  Only a data type can be enforced, because only a data type travels on an
                  edge. Anything else here is free text.
                </p>
              </div>
            )}
          </Panel>

          {/* The three fields that say what has to exist before this node can run: the
              model it is instantiated with, the document that defines its behaviour, and
              the servers it reaches. They sit above Behaviour rather than inside it
              because the card's `tools` are in there and the pair is easy to conflate:
              `tools` is what the node is permitted to do, `mcp` is which server supplies
              it, and merging them loses the question each one answers.

              `model` used to sit inside Behaviour beside `agent`, which put the one field
              the exported `factory.dot` carries as a reserved Attractor attribute next to
              a free-text label the engine never reads. It leads here now, beside the other
              two fields a reader has to satisfy before the node runs. */}
          <Panel
            id="runtime"
            label="Model, skill and servers"
            meta={card.model ?? "no model named"}
          >
            {/* Three stacked blocks of two and three paragraphs each stood here, every
                one of them opening by naming its own field again. The author asked for
                the `/concepts` figure wherever it helps reorganise a page, and this is
                the shape it was built for: named things that point outward. The limit
                statements the paragraphs carried are all still here and still open, in
                the glosses and the footnote. */}
            <ReachList
              label="Before it can run"
              caption="What has to exist on the machine that runs this node."
            >
              <ReachRow field="model" value={card.model ?? "not named"}>
                {card.model === undefined ? (
                  <>Whatever the graph or the runner supplies. The ordinary case.</>
                ) : (
                  <>
                    What its agent runs on.{" "}
                    <span className="text-fg">A default, not a fixed fact:</span> a
                    graph&apos;s{" "}
                    <code className="font-mono text-[12px] text-muted">
                      model_stylesheet
                    </code>{" "}
                    can override it.
                  </>
                )}
              </ReachRow>

              <ReachRow field="skill" value={card.skill ?? "not named"}>
                {card.skill === undefined ? (
                  <>
                    None. The card&apos;s{" "}
                    <code className="font-mono text-[12px] text-muted">spec</code> is the
                    whole instruction.
                  </>
                ) : (
                  <>
                    Where its written procedure lives, relative to the repository you run
                    from.{" "}
                    <span className="text-fg">
                      A pointer only: no skill document travels in a DarkPrint bundle.
                    </span>{" "}
                    You write the file it names.
                  </>
                )}
              </ReachRow>

              <ReachRow
                field="mcp"
                value={card.mcp.length === 0 ? "none" : card.mcp.join(", ")}
              >
                {card.mcp.length === 0 ? (
                  <>None. It reaches no server.</>
                ) : (
                  <>
                    Servers it reaches, named as they are registered on your machine. Free
                    text: the vocabulary has no term for a process somebody installed.
                  </>
                )}
              </ReachRow>
            </ReachList>

          </Panel>

          <Panel
            id="behaviour"
            label="Behaviour"
            meta={card.agent ?? "no named agent"}
          >
            <div className="flex flex-col gap-5">
              {/* `card.action` stood here and is gone: the identical string is this page's
                  header lead, 280 words above, and `metadata.description` is built from the
                  same field, so it is also what a search result and a shared link show.
                  Scanning the rendered page for repeated blocks of six words or more
                  returned this and nothing else, on every one of the 53 instances.
                  See docs/content-reorg/2026-08-04/nodes-id.md. */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className={LABEL}>
                    {phases.length === 1 ? "Phase" : "Phases"}
                  </span>
                  {/* Three renderings of one field, and the empty one is the one that
                      had to be designed: it is a sentence stating where the node
                      stands, not a dash, not a placeholder, and not styled to differ
                      from the other two. The author's ruling — the five phases
                      describe the factory, not every node in it — is stated in full
                      here because this is the page an author lands on when they are
                      about to invent a phase for their intake node. */}
                  {phases.length === 0 ? (
                    <p className="text-[15px] leading-relaxed text-muted">
                      <span className="text-fg">Outside the five.</span> The phases
                      describe a blueprint&apos;s shape, not every node in one: intake,
                      retrieval and routing are real work none of the five names.
                      Declaring none is an answer, not a blank.
                    </p>
                  ) : (
                    phases.map((phase) => (
                      <p
                        key={phase.id}
                        className="text-[15px] leading-relaxed text-muted"
                      >
                        <span className="text-fg">{phase.label}.</span>{" "}
                        {phase.description ??
                          "Outside the five phases the vocabulary closes on, so the card names it and nothing here interprets it."}
                      </p>
                    ))
                  )}
                  <p className="text-xs leading-relaxed text-dim">
                    A blueprint covers the union of its nodes&apos; phases. That is scope,
                    not completeness.
                  </p>
                </div>

                {/* `agent` on its own now that `model` leads the panel above. The two
                    answer different questions and only one of them reaches the runner:
                    `model` becomes `llm_model` in the exported factory, while this is a
                    label the author chose and nothing downstream reads. */}
                <div className="flex flex-col gap-2">
                  <span className={LABEL}>Agent</span>
                  {card.agent === undefined ? (
                    <p className="text-xs leading-relaxed text-dim">
                      None named. The card&apos;s <code className="font-mono text-muted">type</code>{" "}
                      and <code className="font-mono text-muted">spec</code> are the whole
                      of what this node is.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg">
                          <span
                            className="h-1 w-1 rounded-full"
                            style={{ background: "var(--color-cyan)" }}
                            aria-hidden
                          />
                          {card.agent}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-dim">
                        A label the author chose. Nothing in the engine reads it.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className={LABEL}>Tools</span>
                  {tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((tool) => (
                        <TermChip
                          key={tool.id}
                          href={termHref(tool.id)}
                          label={tool.label}
                          aria={`Ontology tool: ${tool.label}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-dim">
                      None. The node asks for no external capability.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <span className={LABEL}>Parameters</span>
                  {params_.length > 0 ? (
                    <dl className="divide-y divide-line rounded-md border border-line bg-void/40">
                      {params_.map(([key, value]) => (
                        <div
                          key={key}
                          className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4"
                        >
                          <dt className="font-mono text-[12px] text-dim">{key}</dt>
                          <dd className="min-w-0">
                            <ParamValue value={value} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-xs leading-relaxed text-dim">
                      None. The node is configured entirely by what arrives on its
                      inputs.
                    </p>
                  )}
                </div>
              </div>

              {card.notes !== undefined && (
                <div className="flex flex-col gap-2 border-t border-line pt-5">
                  <span className={LABEL}>Notes from the author</span>
                  <p className="border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-muted">
                    <Ticked text={card.notes} />
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <VersionHistory versions={history} />

          {/* Card source */}
          <section
            id="card-source"
            className="flex scroll-mt-24 flex-col gap-2"
            aria-labelledby="card-source-heading"
          >
            <h2 id="card-source-heading" className="sr-only">
              Card source
            </h2>
            {source !== undefined ? (
              <>
                <SourcePanel
                  source={source}
                  language="YAML"
                  title="Card source"
                  meta={`${record.ref}.yaml`}
                />
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
              <p className="panel px-4 py-3 text-sm text-muted">
                The archive does not carry the document behind{" "}
                <code className="font-mono text-[12px] text-fg">{record.ref}</code>
                , only the resolved card. Its digest is{" "}
                <span className="break-all font-mono text-[12px] text-muted">
                  {record.digest}
                </span>
                .
              </p>
            )}
          </section>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <SidePanel id="evaluation" label="Evaluation metadata">
            <div className="flex flex-col gap-4">
              {/* Doc 2 §1.1 — the two states are two designs, not a pass and a fail.
                  The pair used to read as a checklist: an emerald ✓ on the node with
                  nobody in it, the alarm pink ⏸ on the node with somebody in it, and
                  the sentence "counts this node against the score" underneath. That is
                  the budget grammar the principle rules out, and the explainability
                  panel on the blueprint page already states the rule it broke ("no
                  green tick rewarding a graph with nobody in it, and no red alarm on a
                  node where somebody is").

                  So both branches now use the neutral pair that panel uses: ▸ cyan for
                  a node that runs on its own, ⏸ violet for a node where a person acts.
                  Glyph and word carry the difference; colour never carries it alone. */}
              <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
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
                      <span className="text-cyan">Runs unattended.</span> Nothing on this
                      card asks for a person, so a run does not stop here.
                    </span>
                  </>
                )}
              </p>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <div className="flex items-center gap-2">
                  <span className={LABEL}>Risk markers</span>
                  <span className="font-mono text-[11px] text-dim">
                    {risks.length}
                  </span>
                </div>
                {risks.length > 0 ? (
                  <>
                    <ul className="flex flex-col gap-2">
                      {risks.map((risk) => (
                        <li key={risk.id}>
                          <Link
                            href={termHref(risk.id)}
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
                    <p className="text-xs leading-relaxed text-dim">
                      The vocabulary&apos;s default, subtracted from a clean 4 when the
                      marker appears in a graph. A deployment may recalibrate it.
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
            </div>
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
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-muted">Digest</dt>
                <dd
                  className="font-mono text-sm text-fg"
                  title={record.digest}
                >
                  {shortDigest(record.digest)}
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
      <div className="mt-10">
        <Comments comments={commentsFor(card.id)} />
      </div>
    </div>
  );
}
