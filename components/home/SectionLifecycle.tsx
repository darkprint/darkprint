/* ============================================================
   Spec §3.5 — what you can do with a blueprint.

   The author asked for the GitHub mental model: download, fork,
   update. It is the right model for the *artefact* and it is one
   sentence away from being a lie about this site, which is why
   every panel below ends with the same two rows. There is no
   backend here: no accounts, no publishing, nowhere your fork
   lives, no push to accept. Constraint 0.4 of the spec is enforced
   by tests, and the register the site uses for this is the one on
   `/what-it-isnt` and on the download step of `/build`, where the
   sentence about what is missing sits next to the thing that works
   rather than in a disclaimer underneath.

   So the three panels are honest in different ways, and the "Built
   / On your machine" pair is what makes the difference visible at a
   glance:

     download  built, and the files are on disk before the page is;
     fork      a property of the format, and nothing this site does;
     update    the arithmetic is built and runs here, and there is
               nowhere to publish the result.

   The update panel's numbers are computed rather than typed.
   `tightenProhibition` takes the published `code-builder@1.0.0`,
   adds one entry to `cannot`, and asks the engine's own `inferBump`
   what that costs. The answer is major, the reason quoted is the
   engine's own sentence, and `bump-demo.test.ts` holds the rest of
   the paragraph to the archive: that the entry names a core data
   type, that the tester really does emit that type, and that no
   `code-builder@2.0.0` exists.

   A server component. The archive read and the bump inference both
   happen at build time; only the three drawings are client
   components, and each of them renders its finished state without
   JS (see `lifecycle/scene-reveal.ts`).
   ============================================================ */

import Link from "next/link";

import { getNodeCard } from "@/lib/content";
import { nodeHref } from "@/lib/href";
import { Sheet } from "@/components/viz";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Ticked } from "@/components/nodes/VersionHistory";
import { DownloadScene } from "./lifecycle/DownloadScene";
import { ForkScene } from "./lifecycle/ForkScene";
import { UpdateScene } from "./lifecycle/UpdateScene";
import {
  DEMO_CARD_ID,
  DEMO_CARD_VERSION,
  DEMO_PROHIBITION,
  tightenProhibition,
} from "./lifecycle/bump-demo";

const STARTER = "/blueprints/starter-software-factory";

/** The node whose output the demonstrated prohibition would refuse. */
const EVIDENCE_SOURCE = "tester";

function PanelHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] tracking-[0.18em] text-dim">{index}</span>
      <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
    </div>
  );
}

/**
 * The two rows every panel ends on.
 *
 * A `dl` rather than two sentences, because the distinction is the same one every time and
 * a reader who has read it once should be able to skip to the second row on the next
 * panel. `Built` is what exists on this site today; `On your machine` is the half DarkPrint
 * has no part in.
 */
function Split({ built, yours }: { built: React.ReactNode; yours: React.ReactNode }) {
  return (
    <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-line pt-4 text-[13px] leading-relaxed">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan">Built</dt>
      <dd className="text-muted">{built}</dd>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">Yours</dt>
      <dd className="text-muted">{yours}</dd>
    </dl>
  );
}

function Mono({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

export function SectionLifecycle() {
  const record = getNodeCard(DEMO_CARD_ID, DEMO_CARD_VERSION);
  const demo =
    record === undefined ? undefined : tightenProhibition(record.card, DEMO_PROHIBITION);

  return (
    <section id="lifecycle" className="border-t border-line bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="What you can do with one"
          title="A blueprint is a folder you can take away"
          lead="The registry publishes files. Everything after the download happens in your own repository, with your own tools, the way any other directory of text does."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {/* ---------- 01 · download ---------- */}
          <article className="panel flex flex-col gap-4 p-6">
            <PanelHeading index="01" title="Download" />

            <Sheet
              register="blueprint"
              label="bundles/starter-software-factory"
              title="factory.dot runs as it stands"
              note="written at build time"
            >
              <DownloadScene />
            </Sheet>

            {/* One paragraph where there were two. Every blueprint page prints the same
                inventory beside the files themselves (`components/blueprint/DownloadPanel`
                names each one and what it is for), so the long version here was the second
                printing redesign spec §5 allows removing. The clauses kept are the two that
                panel does not carry: the cards are the published bytes, and the vocabulary
                file is what makes the README's scores recomputable. */}
            <p className="text-sm leading-relaxed text-muted">
              A blueprint is published as its files, and <Mono>factory.dot</Mono> is the one
              that runs. <Mono>cards/</Mono> holds the published cards byte for byte, and a
              bundle reaching for a term from the archive&rsquo;s vocabulary carries{" "}
              <Mono>ontology/extensions.yaml</Mono> as well, without which the scores its
              README quotes cannot be recomputed from the folder.
            </p>

            <Split
              built={
                <>
                  The folder is generated into <Mono>public/bundles/</Mono> before the site
                  builds, and the blueprint page links each file. They come down one at a
                  time, since there is no server here to assemble an archive on request.
                </>
              }
              yours={
                <>
                  You keep the directory and run <Mono>attractor run factory.dot</Mono>.
                  Execution happens on your side with your provider keys, and DarkPrint
                  watches no run.
                </>
              }
            />

            <Link
              href={`${STARTER}#download`}
              className="font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              Take the starter folder
            </Link>
          </article>

          {/* ---------- 02 · fork ---------- */}
          <article className="panel flex flex-col gap-4 p-6">
            <PanelHeading index="02" title="Fork" />

            <Sheet
              register="blueprint"
              label="cp -r · git init"
              title="the same folder, edited"
              note="a property of the format"
            >
              <ForkScene />
            </Sheet>

            {/* Two paragraphs folded into one. What went is the sentence describing the
                drawing, which the drawing now says for itself: the edited card is the lit
                disc and the person is the violet mark. Doc 2 §1.1's sentence stays, and it
                is the last one, because a reader who stops early has to have read it. */}
            <p className="text-sm leading-relaxed text-muted">
              Forking a blueprint is copying a directory. The whole thing is text under
              version control, so an edit shows up in a diff like any other: pin a card at a
              different version, rewrite a <Mono>spec</Mono>, add a node, delete an edge.
              The autonomy class the analyzer reads follows from where the people are in the
              graph, so a copy that puts somebody at the release boundary reads differently
              from the one it came from. Both are complete factories, and either one runs on
              your machine.
            </p>

            <Split
              built={
                <>
                  Nothing. DarkPrint hosts no copy of your work, has no accounts and accepts
                  no push. What it publishes is the folder, and that is the whole of the
                  handover.
                </>
              }
              yours={
                <>
                  You copy the directory into a repository of your own and edit it in the
                  editor you already use. This site never learns that you did.
                </>
              }
            />

            <Link
              href="/build"
              className="font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              Make those choices on the starter
            </Link>
          </article>

          {/* ---------- 03 · update ---------- */}
          <article className="panel flex flex-col gap-4 p-6">
            <PanelHeading index="03" title="Update" />

            {demo !== undefined && (
              <Sheet
                register="blueprint"
                label={`${demo.ref} → @${demo.nextVersion}`}
                title="one entry added to cannot"
                note={`inferBump: ${demo.level}`}
              >
                <UpdateScene
                  cardId={DEMO_CARD_ID}
                  from={DEMO_CARD_VERSION}
                  to={demo.nextVersion}
                  added={demo.added}
                  source={EVIDENCE_SOURCE}
                />
              </Sheet>
            )}

            <p className="text-sm leading-relaxed text-muted">
              A published version is never edited in place. Every change is a new version,
              and how large that bump has to be follows from what changed.
            </p>

            {demo !== undefined && (
              <>
                {/* Shortened to the two sentences the demonstration needs. What the starter
                    does about that evidence today is drawn in the panel's own figure and
                    stated at length on `/spec/topology`, which is where the absence lives. */}
                <p className="text-sm leading-relaxed text-muted">
                  Add one entry to <Mono>{demo.ref}</Mono>&rsquo;s prohibitions:{" "}
                  <Mono>{demo.added}</Mono>, the data type the tester emits its failure
                  evidence on. From then on an edge carrying one fails the bundle with{" "}
                  <Mono>bundle/prohibition-violated</Mono>.
                </p>

                {/* The list as the file carries it, with the one added line marked. Real
                    text rather than a picture of text: it is short, it is the substance of
                    the paragraph above, and a reader should be able to select it. */}
                <ul className="flex flex-col gap-1 rounded-md border border-line bg-surface-2 p-3 font-mono text-[12px] leading-relaxed">
                  <li className="text-dim">cannot:</li>
                  {demo.after.map((entry) => {
                    const isNew = entry === demo.added;
                    return (
                      <li
                        key={entry}
                        className={isNew ? "flex gap-2 pl-2 text-cyan" : "flex gap-2 pl-2 text-muted"}
                      >
                        <span aria-hidden className={isNew ? "text-cyan" : "text-faint"}>
                          -
                        </span>
                        <span className="min-w-0">{entry}</span>
                        {isNew && (
                          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.14em] text-cyan">
                            added
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="text-sm leading-relaxed text-muted">
                  <Mono>inferBump</Mono> reads that diff as <Mono>{demo.level}</Mono>:{" "}
                  <Ticked text={demo.reason} />, so the next version is{" "}
                  <Mono>{demo.nextVersion}</Mono>. The published starter stays pinned to{" "}
                  <Mono>{demo.ref}</Mono> and scores exactly as it did, because a pin names
                  one exact version.
                </p>
              </>
            )}

            <Split
              built={
                <>
                  The inference. The level and the reason above came out of{" "}
                  <Mono>inferBump</Mono> during this build, and every node page runs the
                  same comparison over each pair of versions the archive has published.
                </>
              }
              yours={
                <>
                  You make the edit, give the file its new version number and keep both
                  files. There is nowhere on this site to publish the result, so the history
                  lives in your repository.
                </>
              }
            />

            <Link
              href={nodeHref(DEMO_CARD_ID)}
              className="font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
            >
              Read the card this edits
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
