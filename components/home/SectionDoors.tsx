/* ============================================================
   Beat 5 of redesign spec §2, and rung 6 of doc 2 §2.1: two doors.

   "Due porte. *Sfoglia i blueprint* oppure *costruisci il tuo*."

   ── What came off, and why that is allowed ──
   Redesign spec §5 lets a page drop "prose that says the same thing
   a second time", and this section carried four paragraphs of it.
   The gallery door explained what a published bundle contains,
   which every blueprint page prints in full; the build door
   explained the three choices, which `/build` puts on the screen a
   reader is about to open; and the closing line pointed at
   `/which-tasks`, a route that has folded into
   `/towards-a-dark-factory` and is reachable from the nav.

   ── What stayed, and why it had to ──
   The line about where `/build` stops. Spec §0.4: nothing
   may be described as working that is not built, "say so wherever
   the question arises", and a door that says "build your own" is
   exactly where it arises. One sentence is enough to be honest;
   four were enough to lose the reader.

   The three counts stay because they are read off the archive at
   build time rather than written here, so they are the one thing on
   this beat a reader could check.

   And the line saying so stays with them. It went out with the four
   paragraphs and it was not one of them: "Counted off the archive on
   the last deploy, and nothing here is rounded up" is the claim that
   makes the three figures worth printing, and it was the only
   sentence on the site that made it. A number beside a door with
   nothing behind it is marketing.

   ── Why the second door now carries figures too ──
   `md:grid-cols-2` stretches both cells to the taller one and
   `Door`'s `mt-auto` pins the button to the floor, so a door with no
   children is not a shorter card: it is the same card with ~112px of
   void in the middle of it. Measured inside the 305px cell it used
   to be, the gallery door ran h3, line, counts, caption, CTA and the
   build door ran h3, line, nothing, nothing, CTA. The reader is at the one
   decision point on the landing, and the option with no evidence
   under it reads as the lesser one or as the unfinished one — which
   is backwards, because `/build` is the path that works end to end
   today and the gallery is the one that only reads.

   So the build door states its own shape in the same register: three
   figures and a line saying what they buy. They are not counted off
   disk the way `PLATFORM_STATS` is, and the constant below records
   where each one is read from so a change to the path is a failing
   grep rather than a stale number.

   ── And the limit statement moved into it ──
   "The workspace ends at the download. There is nowhere to publish
   yet." hung under the two-column grid, centred, attached to
   neither door. It is about the build door specifically. A sentence
   that qualifies one of two options and is printed under both of
   them qualifies the wrong one half the time, so it sits inside the
   door it is about, in the same caption register as the gallery
   door's own qualifier. Verbatim; spec §0.4 is why it exists.
   ============================================================ */

import { ButtonLink } from "@/components/ui/Button";

/* `COUNTS`, the `PLATFORM_STATS` import it read, and the `Figures` component that
   rendered it all stood here. The author asked both doors' figure rows out on 2026-08-07,
   so there is nothing left to render and no second caller to keep the component honest
   against.

   `lib/data` still exports `PLATFORM_STATS` and it still counts `content/` at build time.
   Nothing on the landing reads it now. That is the piece to reach for if figures ever come
   back — it is the reason they were checkable rather than decorative. */

/** What the figures above it are worth. One line, under the row it qualifies. */
function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-blueprint-ink/70">{children}</p>;
}

function Door({
  title,
  line,
  href,
  cta,
  children,
}: {
  title: string;
  /** The door's one sentence. Optional since 2026-08-07: the build door has none. */
  line?: string;
  href: string;
  cta: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-blueprint-line/40 bg-blueprint/20 p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold text-blueprint-ink">{title}</h3>
      {line !== undefined && (
        <p className="text-sm leading-relaxed text-blueprint-ink/85">{line}</p>
      )}
      {children}
      <div className="mt-auto pt-2">
        <ButtonLink href={href} variant="primary" size="lg">
          {cta}
        </ButtonLink>
      </div>
    </article>
  );
}

export function SectionDoors() {
  return (
    <section
      id="start"
      className="relative overflow-hidden bg-blueprint-deep py-20 sm:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bp-grid opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 40%, color-mix(in oklab, var(--color-void) 55%, transparent) 100%)",
        }}
      />

      <div className="container-page relative">
        {/* A `darkprint.io` mono strip stood above this heading and is gone. A domain name
            is not a section label: it names the site a reader is already on, on the one
            band that needs no naming — the cyanotype ground is a register nothing else on
            the landing uses, and that is what says "this is the end of the argument". It
            was also the site's only instance of 0.28em tracking, and the mono eyebrow is
            rationed to one per page or per full-bleed band. */}
        <div className="flex flex-col items-center text-center">
          <h2 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-blueprint-ink sm:text-5xl">
            Read one, or build one
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Door
            title="Browse the blueprints"
            line="Every graph is published as the files it runs from."
            href="/blueprints"
            cta="Open the gallery"
          >
            {/* The three counts and their caption — "Counted off the archive on the last
                deploy, and nothing here is rounded up" — stood here until 2026-08-07.

                The caption goes WITH the numbers rather than outliving them: it existed to
                vouch for figures that are no longer printed, and a sentence promising the
                counts are exact on a card showing no counts is a claim about nothing. */}
          </Door>

          {/* `line="Three choices, and a blueprint that downloads to your machine."` stood
              here and came out with the two captions below, on the author's instruction. */}
          <Door title="Build your own" href="/build" cta="Open the workspace">
            {/* `<Figures items={PATH} />` — 3 choices, 80 combinations, 1 bundle — stood
                here until 2026-08-07, when the author asked it out.

                It was evidence of the wrong kind for this door. The gallery's figures count
                things a reader can go and look at, and its caption says they are exact; this
                door's counted the SHAPE OF A GENERATOR, and "80 combinations" is a fact
                about the code behind the workspace rather than about anything a reader
                receives. The caption below already answers the question this door is
                actually asked — what do I end up holding — and it answers it in nouns. */}
            {/* What the three choices hand over. The gallery door's caption says its figures
                are exact; this one says what its figures produce, which is the equivalent
                question for a workspace rather than an archive. */}
            <Caption>A .dot topology, the cards it pins, and a README you can run.</Caption>
            {/* "The workspace ends at the download. There is nowhere to publish yet."
                stood here, and it is the one removal in this pass worth reading twice.

                `beats.test.ts` guarded it with a docblock recording that it had left the
                site by accident TWICE — once as an orphan under the section, and once when
                `/build`'s eight-step path became a workspace and the noun changed while the
                limit did not. It comes out only because the claim it qualified went with it
                in the same edit: this door no longer promises a download, or three choices,
                or anything beyond its own title and a control. A door that promises nothing
                has nothing to refuse.

                Where the refusal still lives, unchanged: `DownloadPanel` on `/build` ends
                on "there is nowhere to save this yet", at the step where a reader is
                actually holding the folder, and `/build`'s `metadata.description` carries
                it for anyone who never opens the page. If a promise returns to this door,
                this sentence returns with it. */}
          </Door>
        </div>
      </div>
    </section>
  );
}
