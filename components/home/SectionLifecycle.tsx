/* ============================================================
   The landing's fourth beat — what you can do with one.

   Lifecycle-scoring pass, §2. This used to be a heavier, six-hundred-word section that
   lived on `/blueprints` (redesign spec §3 put it there, below the shelf). The author
   asked for its three panels back — download, fork, update, in the GitHub mental model —
   and to have them read at the landing's own length rather than the shelf's:

     "delete from the blueprints page the sections update, fork, and download."

   So this is a rewrite, not a move, and two of the three panels are not what stood here
   before. **Fork is gone from this page entirely.** The blueprint detail page now carries
   its own `ForkAction`, a disclosure sitting beside the download button on the graph it
   applies to — a better place for it than a landing three clicks away from any one
   blueprint. (`ForkScene`, the drawing that panel opened with, has since been asked out
   of it and deleted; this file never imported it.) **Update
   is gone for a different reason**: it demonstrated `inferBump` on a synthetic edit
   (`lifecycle/bump-demo.ts`, deleted with it), and that narrative already has a home with
   real content — `components/nodes/VersionHistory.tsx` computes the same bump, off real
   published versions, on every multi-version node card page. A synthetic demo beside a
   real one is the second telling redesign spec §5 keeps cutting.

   What replaced fork's seat is **compose**: a DOT file is text, so wiring one graph's
   exit into another's entry, or lifting a card whole into a pipeline already being
   written, is a property of the format today, the same register `ForkAction` uses for
   editing a copy. What replaced update's seat is **upload**, because §1
   of the pass locks in exactly what that claim may say: `/upload` parses and scores a
   bundle in the reader's own tab, and publishing it so someone else can find it is not
   built. Neither of the two honesty risks in this rewrite gets a backend; both get a real
   interaction that already exists.

   Three panels, each a sentence or two and a mark, not the old paragraphs-and-`Split`
   register — this is the landing, and `architecture/website.md` records the ~216-word
   measurement the redesign fought to hold. `components/home/beats.test.ts` renders this
   section the way the server does and checks the same four properties every other beat is
   held to: no YAML, no table, no code block, full opacity with no script, and every link
   resolving.

   ── What each panel shows, and why it stopped being a drawing ──
   Two rounds of illustration came off this section, both by the author's own verdict.
   First: three `FlowScene` drawings — files wired to a runner, a small graph wired into a
   bigger one — drew a topology to illustrate ideas that were never about topology. Second,
   after those became a single glowing point apiece: "you still used too fancy for the
   download and compose and upload yours; I'd lean toward a solution without the use of
   blueprint as images." The luminous-flow register — the halo, the glow, the graticule
   `Sheet` draws every one of its scenes on — is the site's blueprint register full stop,
   whatever sits inside it; a lone point still arrives inside a technical drawing sheet.

   So there is no `Sheet` here and no scene. `Glyph` is a plain bordered box in the site's
   ordinary tokens (`border-line`, `bg-surface-2`), the same register `DownloadPanel`'s
   file rows already use elsewhere on this page's neighbours, holding one large, static
   monospace character and nothing else — no glow, no motion, no client component. `↓` and
   `↑` are not invented for this panel: `ContentCard`'s download count and every "seeded"
   row already use them, so the panel borrows a mark the reader has seen mean the same
   thing rather than teaching a new one. `⋈`, the relational-algebra join, is the one
   glyph chosen for what it names rather than reused from elsewhere on the site, because
   nothing else here already means "two things becoming one".

   `aria-hidden`, all three: the glyph adds no information a screen reader needs beyond
   what `PanelHeading` already gives it, and a lone Unicode character with no context is a
   worse announcement than the heading beside it.
   ============================================================ */

import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";

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

/**
 * One static character, in a plain box. No `Sheet`, no glow, no animation — see this
 * file's header for why the previous two rounds of illustration both came off.
 */
function Glyph({ mark }: { mark: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-32 items-center justify-center rounded-lg border border-line bg-surface-2 sm:h-36"
    >
      <span className="font-mono text-5xl text-cyan">{mark}</span>
    </div>
  );
}

const linkCls =
  "mt-auto font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

export function SectionLifecycle() {
  // `scroll-mt-24` because `SiteFooter` links `/#lifecycle` from every page and the
  // header is `sticky top-0` over a 4rem row. It was missing: the anchor guard walks the
  // source for `href="…"` literals and the footer builds its links from a table, so this
  // one was never checked. Widening that walk found it.
  return (
    <section
      id="lifecycle"
      className="scroll-mt-24 border-t border-line bg-void py-20 sm:py-28"
    >
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

            <Glyph mark="↓" />

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

            <Glyph mark="⋈" />

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

            <Glyph mark="↑" />

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
