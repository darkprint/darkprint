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

   ── The order of the four panels, and why it is not the order they were written in ──
   Connect used to be 01, on the grounds that MCP "is the way in that needs no download at
   all, so it is first". That reasoning was about the capability. What it ignored is what
   the reader's eye does with the resulting composition: the sequence opened on COMING SOON
   and closed on COMING SOON, with the two things that actually ship sandwiched between two
   absences, and on a void ground with an otherwise entirely cyan palette those two amber
   pills were the highest-chroma objects in the viewport. The eye landed on "not built yet"
   before it landed on "Download".

   **What ships leads; what does not is grouped once and labelled once.** Download and
   Compose are first because a reader can do both today. Connect and Upload follow, under a
   single rule reading "Next, and not built yet", and inside that pair the per-panel marker
   drops from an amber `ComingSoonBadge` to a dim inline note — the rule above them is now
   carrying the fact, so the pill would be saying it twice in the loudest colour on the
   page. Not one word of either disclosure moved: both sentences are verbatim where they
   were, in the open beside the thing they qualify, which is what doc 2 §0.4 asks for and
   what `honesty.test.ts` holds `/install`'s copy of to character-for-character.

   Do not revert this to capability order. The honesty was never the problem; the
   composition was.
   ============================================================ */

import Link from "next/link";

import { SectionHeading } from "@/components/ui/SectionHeading";

const STARTER = "/blueprints/starter-software-factory";

/** Inline code, for the one file name and the one route each panel names. */
function Mono({ children }: { children: string }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

function PanelHeading({
  index,
  title,
  mark,
}: {
  index: string;
  title: string;
  mark: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Mark mark={mark} />
      {/* `.label` rather than a fourth hand-typed copy of the same five utilities: 11px
          mono, 0.18em, `--color-dim`. Identical to what stood here, now spelled once. */}
      <span className="label">{index}</span>
      <h3 className="font-display text-xl font-semibold text-fg">{title}</h3>
    </div>
  );
}

/**
 * The mark, beside the heading rather than alone in a box.
 *
 * It was a 5xl character centred in a 144px-tall bordered box, which is a lot of panel
 * spent on one glyph. The mark still earns its place, for the reason this file's header
 * gives, and it is small now and sits on the heading's own line. `aria-hidden` for the
 * same reason as before: `PanelHeading` names the step in real text beside it.
 */
function Mark({ mark }: { mark: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-surface-2 font-mono text-base text-cyan"
    >
      {mark}
    </span>
  );
}

/**
 * What the step actually hands you, in the space the glyph box used to take.
 *
 * The author on these three panels: they "si possono rendere più carini come passaggi che
 * indicano che cosa si possa fare". The empty box was the weak part, and the fix is not a
 * fourth attempt at an illustration — this file's header records two of those coming off,
 * ending at "I'd lean toward a solution without the use of blueprint as images". So the
 * space carries the artefact instead: the command you run, the files you get, the line you
 * write, the reading you get back. Information rather than decoration, in the register the
 * rest of the page already uses for a file listing.
 */
function Artefact({ lines }: { lines: readonly (readonly [string, string])[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
      {lines.map(([key, value]) => (
        <div key={key + value} className="flex items-baseline gap-2 font-mono text-[11px] leading-[1.9]">
          <span className="shrink-0 text-dim">{key}</span>
          <span className="min-w-0 truncate text-fg" title={value}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

const linkCls =
  "mt-auto font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

/**
 * The per-panel "not built yet" marker, inside the labelled pair only.
 *
 * It was `ComingSoonBadge` — an amber pill, and `ComingSoonBadge` is still exactly right
 * everywhere else on the site, where it is the only thing on its surface saying so. Here
 * the rule above these two panels already says "Next, and not built yet" in the reader's
 * scan path, so the pill was the same fact a second time, in the highest-chroma colour on
 * a page that is otherwise void and cyan — loud enough that it landed before "Download"
 * did. Dim mono, at the 11px floor, states it once more where a reader who jumped
 * straight into a panel needs it, without competing with the panel's own heading.
 * Lowercase on purpose: the caps are the section label's job, one tier up.
 */
function NotBuiltYet() {
  return <span className="shrink-0 font-mono text-[11px] text-dim">not built yet</span>;
}

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
          /* The author did not like the old line as a motto and named what the section has
             to land instead: DarkPrint is a registry, it publishes files, and everything
             after the download runs on your machine with your own tools. That was in the
             lead and the title said "A blueprint is a folder you can take away", which is
             a smaller claim about the same thing. The title carries it now, and the lead
             says what the four panels are. */
          title="The registry publishes files, your machine runs them"
          lead="Point an agent at it over MCP, or take the folder yourself and wire it into what you already have. Nothing here executes a blueprint, and nothing you build has to come back."
        />

        {/* Four, not three, and two across rather than four.
            ------------------------------------------------------------
            Four narrow columns would put each artefact box under 250px and the file names
            in them would truncate; two across gives every panel the width its listing
            needs. The order — what ships, then what does not, under one rule — is argued
            in this file's header; the short version is that two amber pills were reading
            before the two capabilities that work.

            `min-w-0` on every article is load-bearing and not cosmetic. An `<article>` is
            a grid item, a grid item's default `min-width: auto` is its min-content width,
            and the widest monospace row in `Artefact` (panel 03's `claude mcp add …`, 331px
            on its own) therefore set a floor of 407px — the string, plus the padding this
            panel carried at the time (`p-6`) and its border — on a 342px track at 390×844.
            Padding is `p-5` now, which subtracts 8 from that floor and fixes nothing: the
            floor is the string, and no padding value on the eight-point scale is small
            enough to get 331px of monospace into a 342px column. Only `min-w-0` does. The
            `min-w-0 truncate` span inside `Artefact` was written to ellipsis exactly that
            string and could never fire while its own grid-item ancestor refused to shrink:
            `document.documentElement.scrollWidth` measured 431 against a 390 client width,
            and `body { overflow-x: hidden }` in `app/globals.css` propagates to the
            viewport, so those 41px were unreachable rather than scrollable — the Connect
            panel's right border, the end of "executes it for you." and part of both
            honesty disclosures were simply off the phone. `components/home/beats.test.ts`
            holds the floor now. */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {/* ---------- 01 · download ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <PanelHeading index="01" title="Download" mark="↓" />

            {/* The bundle's own file names, from `lib/content/bundle-export.ts`, so a
                reader who takes the folder finds what this box promised. */}
            <Artefact
              lines={[
                ["", "blueprint.dot"],
                ["", "factory.dot"],
                ["", "cards/code-builder@1.0.0.yaml"],
                ["", "README.md · AGENTS.md"],
              ]}
            />

            <p className="text-sm leading-relaxed text-muted">
              The folder is real, and <Mono>factory.dot</Mono> runs. Nothing here executes
              it for you.
            </p>

            <Link href={`${STARTER}#download`} className={linkCls}>
              Take the starter folder
            </Link>
          </article>

          {/* ---------- 02 · compose ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <PanelHeading index="02" title="Compose" mark="⋈" />

            <Artefact
              lines={[
                ["", "// yours.dot"],
                ["", "build   -> qa_gate;"],
                ["", "qa_gate -> release;"],
                ["→", "one graph's exit, another's entry"],
              ]}
            />

            <p className="text-sm leading-relaxed text-muted">
              A DOT file is text. Wire one graph&rsquo;s exit into another&rsquo;s entry, or
              drop a card into a pipeline you&rsquo;re already writing.
            </p>

            <Link href="/build" className={linkCls}>
              Start building one
            </Link>
          </article>

          {/* ---------- the line the two working capabilities end at ----------
              One rule, one label, spanning both columns, so the pair below it is read as a
              group with a shared state rather than as two panels each carrying a warning.
              It is a `.label` and not a heading: `app/globals.css` records that a mono
              uppercase run is a label, and a label is not a heading level — this names a
              condition the next two panels share, it does not open a sub-section of the
              document outline. Spacing: the grid's own `gap-5` plus `mt-5` puts a block
              tier (40px) above the rule, and `pt-3` keeps the label tight under it so it
              reads as the rule's caption rather than as the next panel's own eyebrow. */}
          <div className="mt-5 border-t border-line pt-3 md:col-span-2">
            <span className="label">Next, and not built yet</span>
          </div>

          {/* ---------- 03 · connect ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PanelHeading index="03" title="Connect" mark="⇄" />
              <NotBuiltYet />
            </div>

            <Artefact
              lines={[
                ["$", "claude mcp add darkprint -- npx -y darkprint mcp"],
                ["→", "every blueprint and node card, as resources"],
              ]}
            />

            {/* Doc 2 §0.4: the panel that describes an unbuilt thing says so beside the
                thing, not in a footnote. `/install` carries the same sentence and
                `honesty.test.ts` holds it there. Verbatim, and it stays verbatim through
                any reordering of these panels. */}
            <p className="text-sm leading-relaxed text-muted">
              Point <Mono>Claude Code</Mono>, Gemini or any MCP client at the registry and
              let it pull the blueprint or the card that fits the work in front of it. The
              server is not built yet, so this is what the setup will look like.
            </p>

            <Link href="/install" className={linkCls}>
              See the setup
            </Link>
          </article>

          {/* ---------- 04 · upload ---------- */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PanelHeading index="04" title="Upload yours" mark="↑" />
              <NotBuiltYet />
            </div>

            <Artefact
              lines={[
                ["in", "your bundle, in the browser tab"],
                ["out", "autonomy class · security reading"],
              ]}
            />

            {/* Doc 2 §0.4, and §1 of this pass's own spec: this is the landing's one
                highest-honesty-risk sentence, so it says what `/upload` does and stops
                where `/upload` stops, in the open rather than behind a disclosure. A
                bundle, not a lone card — `UploadFlow`'s own content-type selector marks a
                node card `not ready` today, and a sentence that implied otherwise here
                would be wrong about the one flow this panel links to. */}
            <p className="text-sm leading-relaxed text-muted">
              <Mono>/upload</Mono> reads a whole bundle, the topology and the cards it pins,
              not a single card alone, inside your browser tab. Nothing leaves the tab, and
              publishing so other people can find it is not built yet.
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
