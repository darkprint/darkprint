"use client";

/* ------------------------------------------------------------------ */
/*  The offer, and the receipt                                         */
/*                                                                     */
/*  Two panels for one decision. `AttractorOffer` is what a reader     */
/*  sees while the choice is theirs, and `AttractorImported` is what   */
/*  stays on screen after they took it.                                */
/*                                                                     */
/*  The second one exists because of what it holds. An import loses    */
/*  things the file in front of the reader was carrying, and the       */
/*  moment those are lost is the moment the button is pressed. A panel */
/*  that vanished on the press would have shown the cost only to a     */
/*  reader who read it before deciding, which is the wrong half of the */
/*  audience: the one who pressed first is the one who needs to find   */
/*  out what happened. So the list survives the press, and the same    */
/*  facts also go into `result.diagnostics` so they reach the report.  */
/* ------------------------------------------------------------------ */

import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SIGN_IN_HREF, type UploadSession } from "./session";
import {
  draftAttributionLine,
  type AttractorCandidate,
  type AttractorImportRecord,
  type AttractorLoss,
} from "./attractor";

/**
 * The handle this import will be attributed to, or `undefined` when there is none.
 *
 * `author` has no default in `importAttractorDot` and the refusal is the feature: a
 * compiled card with no name on it launders somebody else's prompts into an archive, and a
 * name nobody chose is worse than none. So four of the five session states get a sentence
 * instead of a button, and only `ready` gets the handle.
 *
 * One predicate, read three times inside this panel: it disables the button, it chooses
 * between the attribution line and the refusal, and it is the value handed back to the
 * parent on the press. Whoever is named on the button is who ends up in the cards.
 */
function importAuthor(session: UploadSession): string | undefined {
  return session.state === "ready" ? session.handle : undefined;
}

/** The four sentences that stand where the handle would have been. */
function AttributionRefusal({ session }: { session: UploadSession }) {
  /* `text-warn` and never `text-amber`. Amber carries two jobs on this site, "not built
     yet" and "this box leaves the page", and neither is what a missing handle is. */
  const token = "font-mono text-warn";
  if (session.state === "loading") {
    return <>Checking whether you are signed in&hellip;</>;
  }
  if (session.state === "anonymous") {
    return (
      <>
        <span className={token}>sign in to import</span>: every card an import writes
        carries the handle of whoever ran it, and there is no default for that field.{" "}
        <a
          href={SIGN_IN_HREF}
          className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
        >
          Sign in with GitHub
        </a>{" "}
        and come back. Your selection stays where it is.
      </>
    );
  }
  if (session.state === "no-handle") {
    return (
      <>
        <span className={token}>no handle yet</span>: your account has not chosen the name
        it publishes under, and that name is what an import would write into every card.
        Nothing on this page can set one.
      </>
    );
  }
  return (
    <>
      <span className={token}>cannot tell</span>:{" "}
      {session.state === "unreachable" ? session.detail : "the session could not be read."}{" "}
      Reload the page. An import that guessed a name would put it on somebody else&rsquo;s
      writing.
    </>
  );
}

/* --------------------- what does not survive --------------------- */

const LOSS_HEADING: Record<AttractorLoss["kind"], string> = {
  "runner-reads": "Attractor reads these and no card field holds them",
  "handler-override": "the handler override, which the shape decides here instead",
  unreserved: "your own attributes, which Attractor never read either",
};

/** The three grounds, in the order a reader is hurt by them. */
const LOSS_ORDER: readonly AttractorLoss["kind"][] = [
  "runner-reads",
  "handler-override",
  "unreserved",
];

function lossLabel(loss: AttractorLoss): string {
  if (loss.scope === "graph") return `${loss.attribute} (graph)`;
  if (loss.count > 1) return `${loss.attribute} (${loss.count} ${loss.scope}s)`;
  if (loss.scope === "node" && loss.firstNodeId !== undefined) {
    return `${loss.attribute} (${loss.firstNodeId})`;
  }
  return `${loss.attribute} (${loss.scope})`;
}

/**
 * The attributes of THIS file that the import drops, grouped by why.
 *
 * Named attributes and counts rather than a paragraph about format asymmetry. A reader who
 * wrote `goal_gate=true` on the one node that must succeed needs to read the words
 * `goal_gate` here, and a general sentence about reserved attributes would let them assume
 * it was one of the ones that came through.
 *
 * Renders nothing when the list is empty, which is the ordinary case for a pipeline that
 * only uses `prompt`, `shape` and `label`. A heading over an empty list would tell that
 * reader something was taken from them.
 */
function LossList({ losses }: { losses: readonly AttractorLoss[] }) {
  if (losses.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="label">Not carried across</span>
      <ul className="flex flex-col gap-2">
        {LOSS_ORDER.map((kind) => {
          const group = losses.filter((loss) => loss.kind === kind);
          if (group.length === 0) return null;
          return (
            <li key={kind} className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <ul className="flex flex-wrap gap-1.5">
                {group.map((loss) => (
                  <li
                    key={`${loss.scope}.${loss.attribute}`}
                    className="rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg"
                  >
                    {lossLabel(loss)}
                  </li>
                ))}
              </ul>
              <span className="min-w-0 flex-1 text-xs leading-relaxed text-dim">
                {LOSS_HEADING[kind]}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-relaxed text-dim">
        Keep the file you dropped. It is the only copy of these, and the import does not
        write to it.
      </p>
    </div>
  );
}

/* --------------------- the offer --------------------- */

const SHELL = "flex flex-col gap-4 rounded-lg border p-5";

/**
 * The panel that says a dropped `.dot` is an Attractor pipeline, and offers to read it.
 *
 * It never converts on its own. The reader dropped one file and would get a folder of
 * nine, at a version they did not choose, attributed to them, so the gesture that produces
 * it has to be a gesture they made.
 */
export function AttractorOffer({
  candidate,
  session,
  onImport,
}: {
  candidate: AttractorCandidate;
  session: UploadSession;
  /** Runs the import under `author`. The parent owns the selection, so it owns the write. */
  onImport: (author: string) => void;
}) {
  const author = importAuthor(session);
  const { file, nodes, prompted, unprompted } = candidate;

  return (
    <div className={cx(SHELL, "border-cyan/40 bg-cyan/5")}>
      <div className="flex flex-col gap-2">
        <span className="label-lead text-cyan">Attractor pipeline</span>
        <p className="text-sm leading-relaxed text-fg">
          <span className="font-mono text-cyan">{file.name}</span> reads as an Attractor
          pipeline. Its nodes carry{" "}
          <span className="font-mono">prompt</span> and <span className="font-mono">shape</span>{" "}
          and pin no cards, so the validator has nothing to resolve and reports one missing
          card for every node. DarkPrint can read it here instead, into a draft bundle you
          can correct and publish.
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-line-bright pt-4">
        <span className="label">What the import writes</span>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <li>
            <span className="font-mono text-fg">{nodes}</span> cards, one for each node
            outside the pipeline boundary, plus a{" "}
            <span className="font-mono">topology.dot</span> that pins them and a manifest.
            The boundary nodes go: Attractor resolves those by shape or by id (§3.2, §4.4)
            and DarkPrint synthesises them again on the way out.
          </li>
          <li>
            {author === undefined ? (
              <>
                A version, a handle and a provenance line on every card. The handle is the
                one the import cannot supply for you.
              </>
            ) : (
              draftAttributionLine(file.name, author)
            )}
          </li>
          <li>
            A draft, and never a release. The cards do not resolve until you have read them,
            and the version is the one an author is expected to edit.
          </li>
        </ul>
      </div>

      {/* ── What DarkPrint requires that no pipeline can answer ──
          The other half of the asymmetry, and the half a reader meets as errors thirty
          seconds after pressing the button. Saying it here rather than letting the
          validator say it first is the difference between a known cost and a surprise. */}
      <div className="flex items-start gap-2 border-t border-line-bright pt-4">
        <span className="font-mono text-warn" aria-hidden>
          ▲
        </span>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
          <span className="label text-warn">no ports </span>A DOT edge says one node follows
          another and nothing about what travels along it, so every imported card arrives
          with empty <span className="font-mono">inputs</span> and{" "}
          <span className="font-mono">outputs</span> and no declared dependencies. The
          validator reports <span className="font-mono">bundle/port-mismatch</span> on each
          edge until you write them. That finding is a reading DarkPrint drew about your
          graph, so a release is allowed to carry it.
        </p>
      </div>

      {unprompted > 0 && (
        <div className="flex items-start gap-2 border-t border-line-bright pt-4">
          <span className="font-mono text-warn" aria-hidden>
            ▲
          </span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            <span className="label text-warn">empty specs </span>
            <span className="font-mono text-fg">{unprompted}</span> of the{" "}
            <span className="font-mono text-fg">{nodes}</span> nodes carry no{" "}
            <span className="font-mono">prompt</span>. §2.6 gives that attribute the default{" "}
            <span className="font-mono">&quot;&quot;</span>, and a §4.10 tool node runs its{" "}
            <span className="font-mono">tool_command</span> while a §4.6 human gate waits,
            so a pipeline is entitled to leave it out. A DarkPrint card is not: those{" "}
            {unprompted === 1 ? "card arrives" : "cards arrive"} with an empty{" "}
            <span className="font-mono">spec</span>, {unprompted === 1 ? "does" : "do"} not
            load, and the bundle stays unfinished until you write what the{" "}
            {unprompted === 1 ? "node is" : "nodes are"} for. The report names each of them.
            {prompted > 0 && (
              <>
                {" "}
                The other <span className="font-mono text-fg">{prompted}</span>{" "}
                {prompted === 1 ? "arrives" : "arrive"} with the prompt as the spec.
              </>
            )}
          </p>
        </div>
      )}

      <div className="border-t border-line-bright pt-4">
        <LossList losses={candidate.losses} />
      </div>

      <div className="flex flex-col gap-2 border-t border-line-bright pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={author === undefined}
            onClick={() => {
              // Guarded here as well as by `disabled`, because this is the call that
              // throws rather than refuses: `importAttractorDot` treats a blank author as
              // a programming error, and a disabled attribute is a UI state.
              if (author !== undefined) onImport(author);
            }}
            {...(author === undefined
              ? { title: "An import needs a handle to attribute the cards it writes." }
              : {})}
          >
            Read it into a draft bundle
          </Button>
          <span className="font-mono text-[11px] text-dim">
            replaces the selection above
          </span>
        </div>
        <p className="text-xs leading-relaxed text-dim">
          {author === undefined ? (
            <AttributionRefusal session={session} />
          ) : (
            <>
              The file you dropped is not modified and not sent anywhere. What changes is
              the selection on this page, which becomes the folder the import wrote.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* --------------------- the receipt --------------------- */

/**
 * What stands in the offer's place once the import has run.
 *
 * The counts and the loss list again, because this is the only surface that still names
 * the file the cards came from. Every card carries `derived:attractor <origin>` in its
 * `provenance`, so the fact is in the folder too, and this is where a reader who has not
 * opened a card yet reads it.
 */
export function AttractorImported({
  record,
  onUndo,
}: {
  record: AttractorImportRecord;
  /** Puts the dropped file back and clears the import. */
  onUndo: () => void;
}) {
  return (
    <div className={cx(SHELL, "border-line-bright bg-surface-2/40")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span className="label-lead">Imported from Attractor</span>
        <button
          type="button"
          onClick={onUndo}
          className="font-mono text-xs text-dim underline-offset-4 transition-colors hoverable:hover:text-signal hoverable:hover:underline"
        >
          undo, put the pipeline back
        </button>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        <span className="font-mono text-cyan">{record.origin}</span> was read into{" "}
        <span className="font-mono text-fg">{record.cards}</span>{" "}
        {record.cards === 1 ? "card" : "cards"} and a topology that pins them.{" "}
        {draftAttributionLine(record.origin, record.author)} Everything below this point is
        the ordinary bundle path, reading the folder the import just wrote.
      </p>

      <p className="text-xs leading-relaxed text-muted">
        <span className="label text-warn">no ports </span>Every card arrived with empty{" "}
        <span className="font-mono">inputs</span> and{" "}
        <span className="font-mono">outputs</span>, because a DOT edge carries no data type.
        The <span className="font-mono">bundle/port-mismatch</span> findings below are that,
        and they do not refuse a release.
      </p>

      {record.unprompted > 0 && (
        <p className="text-xs leading-relaxed text-muted">
          <span className="label text-warn">empty specs </span>
          <span className="font-mono text-fg">{record.unprompted}</span> of those cards have
          an empty <span className="font-mono">spec</span>, because the node carried no{" "}
          <span className="font-mono">prompt</span>. The report names them one by one, and
          the bundle reads as unfinished until they are written.
        </p>
      )}

      <LossList losses={record.losses} />
    </div>
  );
}
