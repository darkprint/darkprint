import { Fragment, useMemo } from "react";
import Link from "next/link";

import { parseCardRef } from "@/lib/core";
import {
  LIVE_PHASES,
  LIVE_PHASE_LABELS,
  type LiveDraft,
  type LiveHit,
  type LivePhase,
} from "@/lib/core/tutorial/live";
import { cx } from "@/lib/format";
import { blueprintHref, nodeHref } from "@/lib/href";
import { InstallTabs } from "@/components/mcp/InstallTabs";
import { SynchronisedPanes } from "@/components/panes/SynchronisedPanes";
import { ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { DiagnosticList } from "@/components/ui/DiagnosticList";
import { PanelHeading } from "@/components/ui/SectionHeading";
import { REF_SEGMENT, enrichPrompt, livePageUrl, pictureOf, type DraftPicture } from "./draft";
import { LiveExpired } from "./LiveExpired";
import type { BoardState } from "./poll";

/* ============================================================
   The live page, drawn from a board state.
   ------------------------------------------------------------
   Nothing here fetches. `LiveBoard` runs the poll and hands the
   state in, so every piece below renders under
   `renderToStaticMarkup` from a fixture, which is how the tests
   read it. The drawing itself is `SynchronisedPanes`, the same
   panel a published blueprint page opens on: a reader who watches
   their draft take shape here meets the same graph on their own
   page later.
   ============================================================ */

const PROSE_LINK =
  "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

/* --------------------- the header --------------------- */

/** Where `phase` stands in the sequence: done, here, or still ahead. */
function standing(phase: LivePhase, current: LivePhase): "done" | "current" | "ahead" {
  const at = LIVE_PHASES.indexOf(phase);
  const now = LIVE_PHASES.indexOf(current);
  if (at < now) return "done";
  if (at === now) return "current";
  return "ahead";
}

export function PhaseStrip({ current }: { current: LivePhase }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Where the interview is">
      {LIVE_PHASES.map((phase) => {
        const where = standing(phase, current);
        return (
          <li
            key={phase}
            aria-current={where === "current" ? "step" : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px]",
              where === "current" && "border-line-bright bg-surface-2 text-fg",
              where === "done" && "border-line text-muted",
              where === "ahead" && "border-line text-dim",
            )}
          >
            {/* Emerald is what the site spends on a figure read off the engine, and a phase
                the skill has posted past is exactly that kind of fact. */}
            <span
              aria-hidden
              className={cx(
                where === "done" && "text-emerald",
                where === "current" && "text-cyan",
                where === "ahead" && "text-faint",
              )}
            >
              {where === "done" ? "✓" : where === "current" ? "▸" : "·"}
            </span>
            {LIVE_PHASE_LABELS[phase]}
            {where === "done" && <span className="sr-only">, done</span>}
            {where === "current" && <span className="sr-only">, now</span>}
          </li>
        );
      })}
    </ol>
  );
}

function LiveHeader({ draft }: { draft: LiveDraft }) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="label">Task</span>
        <p className="text-lg leading-[1.6] text-fg sm:text-xl">
          {draft.task ?? "Your agent has not posted the task sentence yet."}
        </p>
      </div>
      <PhaseStrip current={draft.phase} />
    </header>
  );
}

/* --------------------- the graph --------------------- */

export function LiveWaiting({ liveUrl }: { liveUrl: string }) {
  return (
    <section className="panel flex flex-col gap-3 p-5" aria-label="Waiting for the first draft">
      <PanelHeading>Waiting for your agent&rsquo;s first answer</PanelHeading>
      <p className="text-sm leading-relaxed text-muted">
        This page is{" "}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-fg">
          {liveUrl}
        </code>
        . Paste it into the prompt on the tutorial page, or hand it to the blueprint-writing
        skill when it offers a live preview, and the graph appears here as the interview goes.
      </p>
    </section>
  );
}

function PartialGraph({
  picture,
}: {
  picture: Extract<DraftPicture, { kind: "partial" }>;
}) {
  const pending = picture.nodes.filter((node) => !node.carded).length;
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface"
      aria-labelledby="live-graph-so-far"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h3 id="live-graph-so-far" className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="text-cyan" aria-hidden>
            ◈
          </span>
          The graph so far
        </h3>
        <span className="font-mono text-[11px] text-dim">
          {picture.nodes.length} nodes · {picture.edges.length} edges
          {pending > 0 && ` · ${pending} card${pending === 1 ? "" : "s"} pending`}
        </span>
      </div>

      {!picture.parsed ? (
        <p className="px-4 py-5 text-sm leading-relaxed text-muted">
          The topology has not parsed into a graph yet. The notes below say which line.
        </p>
      ) : picture.nodes.length === 0 ? (
        <p className="px-4 py-5 text-sm leading-relaxed text-muted">
          The topology is open and no node is declared in it yet.
        </p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="label">Nodes</span>
            <ol className="flex flex-col divide-y divide-line">
              {picture.nodes.map((node) => (
                <li key={node.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                  <code className="font-mono text-[12px] text-fg">{node.id}</code>
                  <span className="font-mono text-[11px] text-dim">
                    {node.ref ?? "no card pinned"}
                  </span>
                  {/* `--color-warn` is the register the upload page gives a folder that is
                      not finished and not wrong; a node without its card is that state. */}
                  <span
                    className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
                    style={{ color: node.carded ? "var(--color-emerald)" : "var(--color-warn)" }}
                  >
                    {node.carded ? "card written" : "card pending"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label">Edges</span>
            {picture.edges.length === 0 ? (
              <p className="py-2 text-sm leading-relaxed text-muted">
                No edge is declared yet.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {picture.edges.map((edge, i) => (
                  <li
                    key={`${edge.source}-${edge.target}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 font-mono text-[12px]"
                  >
                    <span className="text-fg">
                      {edge.source} <span className="text-faint" aria-hidden>→</span>
                      <span className="sr-only">to</span> {edge.target}
                    </span>
                    {edge.label !== undefined && (
                      <span className="text-[11px] text-dim">{edge.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function DraftPanel({ draft, liveUrl }: { draft: LiveDraft; liveUrl: string }) {
  const picture = useMemo(() => pictureOf(draft), [draft]);

  if (picture.kind === "empty") return <LiveWaiting liveUrl={liveUrl} />;

  return (
    <div className="flex flex-col gap-5">
      {picture.kind === "resolved" ? (
        <SynchronisedPanes model={picture.model} graph={picture.graph} linkToCard={false} />
      ) : (
        <PartialGraph picture={picture} />
      )}
      {/* The engine's own findings, unedited. Under a partial graph they are what the
          reader is waiting on; under a resolved one they are the warnings a release is
          allowed to carry. An empty list draws nothing rather than a clean verdict the
          page has no standing to give. */}
      {picture.diagnostics.length > 0 && (
        <div className="panel p-5">
          <DiagnosticList diagnostics={picture.diagnostics} title="Still to settle" />
        </div>
      )}
    </div>
  );
}

/* --------------------- the registry hits --------------------- */

/**
 * `owner/slug` split and checked half by half. `blueprintHref` expects both halves already
 * in grammar, and a ref here came from whoever holds the token, so a half that fails stays
 * plain text rather than becoming a link with a query or a fragment in it.
 */
function blueprintRefHref(ref: string): string | undefined {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) return undefined;
  const owner = ref.slice(0, slash);
  const slug = ref.slice(slash + 1);
  if (!REF_SEGMENT.test(owner) || !REF_SEGMENT.test(slug)) return undefined;
  return blueprintHref(owner, slug);
}

function hitHref(hit: LiveHit): string | undefined {
  if (hit.kind === "blueprint") return blueprintRefHref(hit.ref);
  /* A card id may be namespaced (`owner/id`), so each segment is checked on its own. */
  const parsed = parseCardRef(hit.ref);
  if (parsed === undefined || !parsed.id.split("/").every((part) => REF_SEGMENT.test(part))) {
    return undefined;
  }
  return nodeHref(parsed.id);
}

export function RegistryHits({ hits }: { hits: readonly LiveHit[] }) {
  return (
    <section className="panel flex flex-col gap-3 p-5" aria-labelledby="live-hits">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelHeading>
          <span id="live-hits">Found in the registry</span>
        </PanelHeading>
        <span className="font-mono text-[11px] text-dim">
          {hits.length} hit{hits.length === 1 ? "" : "s"}
        </span>
      </div>
      {hits.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          Your agent searched and the registry returned nothing for this task.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {hits.map((hit) => {
            const href = hitHref(hit);
            return (
              <li
                key={`${hit.kind}:${hit.ref}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-4 py-2"
              >
                <span className="label">{hit.kind}</span>
                <span className="min-w-0 text-sm leading-relaxed text-fg">
                  {href === undefined ? (
                    hit.title
                  ) : (
                    <Link href={href} className={PROSE_LINK}>
                      {hit.title}
                    </Link>
                  )}
                  <span className="ml-2 font-mono text-[11px] text-dim">{hit.ref}</span>
                </span>
                <span className="font-mono text-[12px] text-emerald">{hit.score.toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* --------------------- the next step --------------------- */

function publishedHref(ref: string | undefined): string | undefined {
  return ref === undefined ? undefined : blueprintRefHref(ref);
}

export function NextStep({ draft, liveUrl }: { draft: LiveDraft; liveUrl: string }) {
  const { phase } = draft;

  if (phase === "written") {
    const prompt = enrichPrompt(draft.bundle.manifest.slug, liveUrl);
    return (
      <section className="panel flex flex-col gap-4 p-5" aria-labelledby="live-next">
        <PanelHeading>
          <span id="live-next">Next: enrich it</span>
        </PanelHeading>
        <p className="text-sm leading-relaxed text-muted">
          Connect the DarkPrint MCP to your agent, then paste the prompt under it. Your agent
          searches the registry for an observability blueprint and merges it into your folder
          with the DarkPrint skill&rsquo;s enrich mode. This page shows the hits and the grown
          graph when it posts again.
        </p>
        <InstallTabs />
        <div className="flex min-w-0 items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <pre className="min-w-0 flex-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-blueprint-line">
            <code>{prompt}</code>
          </pre>
          <CopyButton text={prompt} ariaLabel="Copy the enrich prompt" />
        </div>
      </section>
    );
  }

  if (phase === "enriched") {
    return (
      <section className="panel flex flex-col gap-4 p-5" aria-labelledby="live-next">
        <PanelHeading>
          <span id="live-next">Next: keep it</span>
        </PanelHeading>
        <p className="text-sm leading-relaxed text-muted">
          Sign in, then drop the folder on the Publish page. Visibility defaults to private
          there, so the blueprint stays yours until you choose otherwise.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/welcome">Sign in</ButtonLink>
          <ButtonLink href="/upload" variant="outline">
            Publish
          </ButtonLink>
        </div>
      </section>
    );
  }

  if (phase === "published") {
    const href = publishedHref(draft.publishedRef);
    return (
      <section className="panel flex flex-col gap-4 p-5" aria-labelledby="live-next">
        <PanelHeading>
          <span id="live-next">Published</span>
        </PanelHeading>
        <p className="text-sm leading-relaxed text-muted">
          {href === undefined
            ? "Your agent reported the blueprint published and did not say where. Your profile, in the account menu, lists it."
            : "Your blueprint has its own page now. This one stops following."}
        </p>
        {/* No button without a ref: `/welcome` bounces a finished account back to the
            landing, and the profile address needs the handle this page does not have. */}
        {href !== undefined && (
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={href}>Open your blueprint</ButtonLink>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-2 p-5" aria-labelledby="live-next">
      <PanelHeading>
        <span id="live-next">Keep going</span>
      </PanelHeading>
      <p className="text-sm leading-relaxed text-muted">
        Keep answering in your agent; this page follows.
      </p>
    </section>
  );
}

/* --------------------- the foot --------------------- */

export function HonestyLine() {
  return (
    <p className="font-mono text-[11px] leading-relaxed text-dim">
      This page shows the draft your agent posted. Nothing here runs it.
    </p>
  );
}

function Reconnecting() {
  return (
    <p role="status" className="font-mono text-[11px] text-dim">
      Reconnecting to the registry. The last draft stays on screen.
    </p>
  );
}

/* --------------------- the board --------------------- */

export function LiveBoardView({
  state,
  token,
  origin,
}: {
  state: BoardState;
  token: string;
  /**
   * The origin the reader is on. The board is told rather than reading the build-time site
   * origin, so the address it prints for this page is the one in the reader's own address
   * bar, on a preview deployment and on localhost as much as on the site.
   */
  origin: string;
}) {
  if (state.status === "expired") return <LiveExpired />;
  const liveUrl = livePageUrl(origin, token);

  return (
    <div className="flex flex-col gap-8">
      {state.reconnecting && <Reconnecting />}
      {state.status === "waiting" ? (
        <LiveWaiting liveUrl={liveUrl} />
      ) : (
        <Fragment>
          <LiveHeader draft={state.record.draft} />
          <DraftPanel draft={state.record.draft} liveUrl={liveUrl} />
          {state.record.draft.hits !== undefined && <RegistryHits hits={state.record.draft.hits} />}
          <NextStep draft={state.record.draft} liveUrl={liveUrl} />
        </Fragment>
      )}
      <HonestyLine />
    </div>
  );
}
