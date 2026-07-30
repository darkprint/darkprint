/* ============================================================
   The landing's fourth beat — what you can do with one.

   Lifecycle-scoring pass, §2. This used to be a heavier, six-hundred-word section that
   lived on `/blueprints` (redesign spec §3 put it there, below the shelf). The author
   asked for its three panels back — download, fork, update, in the GitHub mental model —
   and to have them read at the landing's own length rather than the shelf's:

     "delete from the blueprints page the sections update, fork, and download."

   So this is a rewrite, not a move, and two of the three panels are not what stood here
   before. **Fork is gone from this page entirely.** The blueprint detail page now carries
   its own `ForkAction`, a disclosure that draws the same `ForkScene` beside the download
   button on the graph it applies to — a better place for it than a landing three clicks
   away from any one blueprint, and this file no longer imports that scene at all. **Update
   is gone for a different reason**: it demonstrated `inferBump` on a synthetic edit
   (`lifecycle/bump-demo.ts`, deleted with it), and that narrative already has a home with
   real content — `components/nodes/VersionHistory.tsx` computes the same bump, off real
   published versions, on every multi-version node card page. A synthetic demo beside a
   real one is the second telling redesign spec §5 keeps cutting.

   What replaced fork's seat is **compose** (`lifecycle/ComposeScene.tsx`, new): a DOT file
   is text, so wiring one graph's exit into another's entry, or lifting a card whole into a
   pipeline already being written, is a property of the format today, the same register
   `ForkScene`'s own caption uses for editing a copy. What replaced update's seat is
   **upload**, because §1 of the pass locks in exactly what that claim may say: `/upload`
   parses and scores a bundle in the reader's own tab, and publishing it so someone else
   can find it is not built. Neither of the two honesty risks in this rewrite gets a
   backend; both get a real interaction that already exists.

   Three panels, each a sentence or two and a graphic, not the old paragraphs-and-`Split`
   register — this is the landing, and `architecture/website.md` records the ~216-word
   measurement the redesign fought to hold. `components/home/beats.test.ts` renders this
   section the way the server does and checks the same four properties every other beat is
   held to: no YAML, no table, no code block, full opacity with no script, and every link
   resolving.
   ============================================================ */

import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { Sheet } from "@/components/viz";
import { DownloadScene } from "./lifecycle/DownloadScene";
import { ComposeScene } from "./lifecycle/ComposeScene";

const STARTER = "/blueprints/starter-software-factory";

/** Inline code, for the one file name and the one route each panel names. */
function Mono({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

function PanelHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] tracking-[0.18em] text-dim">{index}</span>
      <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
    </div>
  );
}

const linkCls =
  "mt-auto font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

export function SectionLifecycle() {
  return (
    <section id="lifecycle" className="border-t border-line bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="What you can do with one"
          title="A blueprint is a folder you can take away"
          lead="The registry publishes files. Everything after the download runs on your machine, with your own tools."
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

            <p className="text-sm leading-relaxed text-muted">
              The folder is real, and <Mono>factory.dot</Mono> runs. Nothing here executes
              it for you.
            </p>

            <Link href={`${STARTER}#download`} className={linkCls}>
              Take the starter folder
            </Link>
          </article>

          {/* ---------- 02 · compose ---------- */}
          <article className="panel flex flex-col gap-4 p-6">
            <PanelHeading index="02" title="Compose" />

            <Sheet
              register="blueprint"
              label="one graph, wired into another"
              title="one edge, crossing into a bigger pipeline"
              note="a property of the format"
            >
              <ComposeScene />
            </Sheet>

            <p className="text-sm leading-relaxed text-muted">
              A DOT file is text. Wire one graph&rsquo;s exit into another&rsquo;s entry, or
              drop a card into a pipeline you&rsquo;re already writing.
            </p>

            <Link href="/build" className={linkCls}>
              Start building one
            </Link>
          </article>

          {/* ---------- 03 · upload ---------- */}
          <article className="panel flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PanelHeading index="03" title="Upload yours" />
              <ComingSoonBadge />
            </div>

            {/* Doc 2 §0.4, and §1 of this pass's own spec: this is the landing's one
                highest-honesty-risk sentence, so it says what `/upload` does and stops
                where `/upload` stops, in the open rather than behind a disclosure. A
                bundle, not a lone card — `UploadFlow`'s own content-type selector marks a
                node card `not ready` today, and a sentence that implied otherwise here
                would be wrong about the one flow this panel links to. */}
            <p className="text-sm leading-relaxed text-muted">
              <Mono>/upload</Mono> reads a whole bundle, the topology and the cards it pins,
              not a single card alone, inside your browser tab. It names the autonomy class
              and scores the security. Nothing leaves the tab, and publishing so other
              people can find it is not built yet.
            </p>

            <Link href="/upload" className={linkCls}>
              Try it on your own bundle
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}
