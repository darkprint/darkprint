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

   ── Compose is a hint, not a panel (2026-08-06) ──
   The author: compose "should be a hint not a per se box". It was a numbered peer of
   Download, Connect and Upload, which claimed for it a rank it does not have: the other
   three are things you go and do — a file to fetch, a client to point, a tab to drop a
   bundle into — and composing is a *property of the bytes you were just handed*. A DOT
   file is text; that is a fact about the download, not a fourth destination, and it is the
   only one of the four with no interaction of its own to describe.

   So it lives inside the Download panel now, under the prose, as a dim `.label`-tagged
   line rather than a bordered box of its own. Under and not beside, because it reads in
   the order it is true in: here is the folder, here is what is in it, and here is what you
   can do with the file you now have. The claim itself is unchanged and still stated in the
   open — a DOT file is text, wire one graph's exit into another's entry, drop a card into
   a pipeline already being written, all true today with a text editor and nothing else.
   `beats.test.ts` holds that sentence, and holds it *inside* the Download panel and ahead
   of the "not built yet" rule, so a demotion cannot quietly turn a working capability into
   one a reader files under the unbuilt pair. The `/build` link compose used to carry is
   inline in the hint; the section would otherwise stop reaching the workspace at all.

   Losing a panel makes the count odd against a two-column grid, and the empty half-track
   that leaves is not a cost — it is what pays for the composition. Download spans both
   columns: the one thing on this section that ships in full today is the widest object in
   it, its file listing gets a column of its own instead of a 342px track, and the two
   unbuilt panels sit narrow underneath the rule. Rank by width, which the reader reads
   before any word of it.

   ── What the Download panel lists, and why `factory.dot` stopped leading it ──
   The author: "`factory.dot` is meaningless. A generic folder should be composed by a
   blueprint.dot and a list of yaml node cards and the README.md and AGENTS.md". The panel
   opened on `factory.dot` — the Attractor-runnable emission, which is a name only somebody
   who already runs Attractor can read, and the *derived* file at that. What DarkPrint
   publishes is the graph and the cards it pins; `factory.dot` is what that gets compiled
   to on the way out (`lib/content/bundle-export.ts`).

   The listing is the generic shape, checked against `public/bundles/` rather than written
   from memory, because a folder drawn here that does not match the folder that downloads
   is the same class of error as a missing disclaimer. All nine bundles on disk today hold
   `blueprint.dot`, `factory.dot`, `cards/`, `README.md` and `AGENTS.md`, and in all nine
   the card count equals the number of nodes carrying a `card=` pin — 5/5 on the starter,
   9/9 on `checkpoint-resume-runner` — which is what licences "one YAML per node the graph
   pins" as a general statement rather than a description of one bundle. One bundle
   (`frontline-triage`) also carries `ontology/extensions.yaml`; it is not in the listing
   because it is not in the generic folder, and the prose does not imply an exhaustive
   listing. `factory.dot` stays named in the prose — it is genuinely in the folder and it
   is the file that runs, so dropping it entirely would trade one inaccuracy for another.

   ── Upload says what uploading is for (2026-08-06) ──
   The author: "the Upload box should stress that if uploaded, you can get feedback for the
   blueprint you proposed by other users." That is the motive, and the panel had only the
   mechanism: what `/upload` reads, where it reads it, and what it stops at. But there is
   no backend and no publishing, so *no part of the feedback claim is true today* — it is
   strictly the reason the unbuilt half is worth building.

   It therefore wears `ComingSoonBadge`, in the `<badge> + "Not built yet: …"` form
   `AgentHandoff` and `DownloadStep` already use, and it is the one place in this section
   where the amber pill comes back. That is not a reversal of the decision recorded below.
   That decision was about the two *panel-level* markers, in the scan path of the headings,
   restating a fact the rule above them had just stated; this badge is attached to a
   sentence lower in one panel's body making a claim the rule does not cover at all. The
   rule says the panel is not built. It says nothing about other people existing, which is
   the larger promise and the one a reader could most easily take as live. A second,
   different claim gets a marker; the same claim twice does not.

   The pinned sentence beside it is untouched, to the character — `beats.test.ts` holds
   "Nothing leaves the tab, and publishing so other people can find it is not built yet."
   and this pass added words around it without editing a word of it. The new claim is in
   `components/site/honesty.test.ts`'s ledger, `open`, which is the file that exists
   because a limit statement has twice left this site during a pass that was adding or
   cutting copy around one.

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
   thing rather than teaching a new one. Compose used to hold a fourth, `⋈`, the
   relational-algebra join — the one glyph chosen for what it names rather than reused from
   elsewhere on the site, because nothing else here already meant "two things becoming
   one". It went out with the panel: a mark is how this section ranks a step, and the whole
   point of the demotion is that composing is not one. The hint carries a `.label` instead,
   which is what the site uses to tag a claim rather than to number a destination.

   `aria-hidden`, all three: the glyph adds no information a screen reader needs beyond
   what `PanelHeading` already gives it, and a lone Unicode character with no context is a
   worse announcement than the heading beside it.

   ── The order of the panels, and why it is not the order they were written in ──
   Connect used to be 01, on the grounds that MCP "is the way in that needs no download at
   all, so it is first". That reasoning was about the capability. What it ignored is what
   the reader's eye does with the resulting composition: the sequence opened on COMING SOON
   and closed on COMING SOON, with the two things that actually ship sandwiched between two
   absences, and on a void ground with an otherwise entirely cyan palette those two amber
   pills were the highest-chroma objects in the viewport. The eye landed on "not built yet"
   before it landed on "Download".

   **What ships leads; what does not is grouped once and labelled once.** Download is
   first, carrying compose with it, because a reader can do both today — that is one panel
   rather than two since the demotion above, and the rule it is separated from has not
   moved. Connect and Upload follow, under a
   single rule reading "Next, and not built yet", and inside that pair the per-panel marker
   drops from an amber `ComingSoonBadge` to a dim inline note — the rule above them is now
   carrying the fact, so the pill would be saying it twice in the loudest colour on the
   page. Not one word of either disclosure moved: both sentences are verbatim where they
   were, in the open beside the thing they qualify, which is what doc 2 §0.4 asks for and
   what `honesty.test.ts` holds `/mcp`'s copy of to character-for-character.

   Do not revert this to capability order. The honesty was never the problem; the
   composition was.
   ============================================================ */

import Link from "next/link";

import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { MCP_ROUTE } from "@/lib/mcp";
import { SKILL_ROUTE } from "@/lib/skill";

import { Folder } from "./lifecycle/Folder";
import { TeacherFigure } from "./lifecycle/TeacherFigure";

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

/**
 * Compose, demoted from a panel to a line under the folder it is a property of.
 *
 * The header argues the placement; this is what makes it read as a hint rather than as a
 * fourth thing to go and do. No border and no ground — a box is exactly what the author
 * said it should stop being — so the only structure is a `.label` tag at the 11px mono
 * floor and a 13px line beside it, one tier under the panel's own `text-sm` prose. The tag
 * is `.label` and not a heading for the reason `app/globals.css` records: a mono uppercase
 * run names a thing, it does not open a level of the document outline, and this claim is
 * part of Download's argument rather than a section of its own.
 *
 * The claim is the one that survived the demotion intact, and it is true today with a text
 * editor and nothing else — which is why it sits above the "not built yet" rule and inside
 * the panel a reader has already been told works. `beats.test.ts` holds both facts.
 */
function ComposeHint() {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-relaxed text-dim">
      <span className="label shrink-0">Compose</span>
      <span className="min-w-0">
        A DOT file is text. Wire one graph&rsquo;s exit into another&rsquo;s entry, or drop
        a card into a pipeline you&rsquo;re already writing.{" "}
        <Link
          href="/build"
          className="text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
        >
          Start one in the workspace
        </Link>
        .
      </span>
    </p>
  );
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
             says what the panels are.

             ── The second sentence, removed 2026-08-07 ──
             It read "Nothing here executes a blueprint, and nothing you build has to come
             back." Two claims, and both survive where a reader can act on them rather than
             where they are merely announced:

               execution — `components/blueprint/DownloadPanel.tsx`, beside the download
               button on every blueprint page and on `/build`: "Execution happens on your
               machine. DarkPrint distributes these files and analyses them. It runs
               nothing and holds none of your provider keys." That is the same claim at the
               moment it matters, in more detail, and `/build`'s own copy repeats it.

               nothing comes back — the Upload panel below states the stronger version of
               it in the open, and `components/site/honesty.test.ts` pins that one.

             No ledger row covered the sentence and no test held it, which is exactly the
             condition under which a limit statement normally goes missing by accident. It
             is going deliberately, and this note is the record.

             What it leaves behind is worth watching: the first sentence is an imperative
             about a server that does not exist ("Point an agent at it over MCP"), and it no
             longer has a second sentence softening it. The Connect panel four elements down
             carries the correction verbatim — "The server is not built yet, so this is what
             the setup will look like" — and `beats.test.ts` holds it there. If that panel
             ever moves, this lead needs re-reading. */
          title="The registry publishes files, your machine runs them"
          lead="Point an agent at it over MCP, or take the folder yourself and wire it into what you already have."
        />

        {/* Three panels in a two-column grid, the first spanning both.
            ------------------------------------------------------------
            Four narrow columns would put each artefact box under 250px and the file names
            in them would truncate; two across gives every panel the width its listing
            needs. Compose stopped being a panel (this file's header), which leaves three,
            and rather than parking an empty half-track beside Download the panel takes the
            full row: the one capability that ships in full is the widest object here, its
            file listing gets a column to itself instead of a 342px track, and the pair
            that does not ship sits narrow under the rule. The order — what ships, then
            what does not, under one rule — is argued in this file's header; the short
            version is that two amber pills were reading before the capabilities that work.

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
          {/* Half a row, not the whole one. It spanned both columns when it held a
              five-row file listing beside a column of prose — "the one capability that
              ships in full is the widest object here". The listing is a folder now, and a
              104px folder centred in a full-width panel is 900px of empty sheet. Download
              and Teaching are the two that ship, they are the same size, and they sit side
              by side above the rule. */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <PanelHeading index="01" title="Download" mark="↓" />

            {/* The listing became a folder you open (2026-08-07, the author: "for the
                download box remove all the details and add the components
                https://reactbits.dev/components/folder where on mouse over appears 3
                files"). What stood here was a five-row `Artefact` beside a column of
                prose; both are gone and `components/home/lifecycle/Folder.tsx` carries the
                same four filenames on its three papers.

                `ComposeHint` and the link stayed, and neither is a "detail" in the sense
                the instruction meant. The hint is a claim the author asked for by name in
                an earlier pass — "compose should be a hint not a per se box" — and
                `beats.test.ts` holds both its words and its position above the unbuilt
                rule; the link is the panel's only way out. Removing either needs its own
                instruction. */}
            <Folder />

            <div className="flex min-w-0 flex-col gap-3">
              <ComposeHint />

              <Link href={`${STARTER}#download`} className={linkCls}>
                Take the starter folder
              </Link>
            </div>
          </article>

          {/* ---------- 02 · teaching ----------
              The author asked for a fourth panel "named teaching where there is an image of
              a teacher referring to the fact that there is a skill (DarkPrint skill) that
              helps user to define a blueprint".

              ── It sits ABOVE the rule, and that is the whole placement argument ──
              This file's header states the order the section is built on: what ships leads,
              what does not is grouped after it under one rule. The DarkPrint skill installs
              in one command and runs today, so a panel about it belongs beside Download and
              not with Connect and Upload. It is the fourth panel by count and the second by
              position, and Connect and Upload renumber to 03 and 04 behind it.

              ── The teacher is drawn, not photographed ──
              There is no photography anywhere on this site, and the register is not
              decorative: `app/globals.css` and `components/viz/` define a cyanotype
              vocabulary where a violet mark means a person and a lit disc means a step in a
              run. A stock photograph of a teacher would be the only raster image on the
              site and would say nothing in that vocabulary. So the teacher is the site's own
              person mark standing at a board, and what is on the board is a three-node
              graph — which is the thing being taught. `TeacherFigure` draws it. */}
          <article className="panel flex min-w-0 flex-col gap-4 p-5">
            <PanelHeading index="02" title="Teaching" mark="✎" />

            <TeacherFigure />

            <p className="text-sm leading-relaxed text-muted">
              The <Mono>DarkPrint skill</Mono> installs into your own agent in one command
              and interviews you into a blueprint: what the work is, who does which part of
              it, and what must never reach whom. It writes the graph and the cards for you
              and it runs today.
            </p>

            <Link href={SKILL_ROUTE} className={linkCls}>
              Install the skill
            </Link>
          </article>

          {/* ---------- the line the working capability ends at ----------
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
                thing, not in a footnote. `/mcp` carries the same sentence as its lead and
                `honesty.test.ts` holds it there. Verbatim, and it stays verbatim through
                any reordering of these panels. */}
            <p className="text-sm leading-relaxed text-muted">
              Point <Mono>Claude Code</Mono>, Gemini or any MCP client at the registry and
              let it pull the blueprint or the card that fits the work in front of it. The
              server is not built yet, so this is what the setup will look like.
            </p>

            <Link href={MCP_ROUTE} className={linkCls}>
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

            {/* Why anyone would upload at all, which the panel above states the mechanism
                of and never the motive (this file's header, and the author's own words).
                Every clause of it is unbuilt — there is no backend, no publishing and no
                readership — so it wears the badge and opens on "Not built yet:", the form
                `AgentHandoff` and `DownloadStep` already use for a claim about a capability
                that does not exist. `items-start` rather than `items-center`: this wraps to
                three lines on a phone and a pill vertically centred against a paragraph
                floats away from the word it qualifies. Held in
                `components/site/honesty.test.ts`'s ledger, `open`.

                It names the reader rather than repeating the verb. Measured on a phone, the
                first draft made this panel say "not built yet" three times in nine lines —
                the heading's dim note, the end of the paragraph above ("publishing so other
                people can find it is not built yet"), and then a third sentence opening on
                "publishing … so other people …" again. The limit is stated as many times as
                it needs to be; what was wasted was the words. "The second reader" is what
                the author asked to be stressed, it is a thing this site does not have, and
                the conditional that follows ("Once a bundle can be published") says the
                same limit a fourth way without spending the phrase a fourth time. */}
            <p className="flex flex-wrap items-start gap-2 text-[13px] leading-relaxed text-dim">
              <ComingSoonBadge />
              Not built yet: the second reader. Once a bundle can be published, other
              people can open the blueprint you proposed and tell you where it does not
              hold.
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
