import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   What it is, before the page spends four sections on what it
   isn't.

   Redesign spec §3 moves the landing's anchoring rung here:
   "«what it is» and «not a skill library» → /what-it-isnt,
   condensed." The landing keeps the picture and loses the
   paragraph: beat 4 draws the same room with the lights off, in one
   sentence. The sentences that made the name decode itself are
   these, and they belong on the page whose whole job is telling two
   objects apart. A reader cannot be told what a dark factory is
   not until they have been told what one is.

   The copy is `components/home/SectionAnchor.tsx`'s, lifted rather
   than imported. That file has since been deleted: with the rung
   living here and the picture living in the landing's beat 4,
   nothing imported it, and the integrator removed it rather than
   leave a second copy of this paragraph in the tree for somebody to
   edit by mistake. `git log` has it if the wording is ever wanted
   back.

   Doc 2 §2.1 rung 2, verbatim in its brief: "Ancoraggio. La
   fabbrica al buio. Una riga, e il nome del sito diventa
   autoesplicativo." One line is the brief, so this section says
   where the term comes from, makes `DarkPrint` decode itself, and
   stops.

   ── What was left behind on the way over ──
   `SectionAnchor` carried a strip of the five phases under its
   lead. It is not here, and spec §5 is why: `SectionComponentRecap`
   at the foot of this page already prints the five as links, under
   an entry whose entire subject is what a phase is. Two copies of
   one closed list on one page is prose saying the same thing a
   second time, and the copy that stays is the one that also
   explains itself.
   ============================================================ */

export function SectionWhatItIs() {
  return (
    <section id="what-it-is" className="relative overflow-hidden bg-void py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid opacity-70"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />
      <div className="container-page relative">
        <SectionHeading
          eyebrow="What it is"
          title="A dark factory runs with the lights off"
          lead="FANUC has been building robots with robots in Oshino since 2001, and the plant runs unlit. A software dark factory is the same arrangement: a specification goes in, and the work happens without anyone standing over it."
        />

        <p className="mt-8 max-w-3xl border-l-2 border-cyan/50 pl-5 text-base leading-relaxed text-muted">
          The factory is dark. The drawing of one is a{" "}
          <span className="text-fg">blueprint</span>. This site is where those drawings
          are kept.
        </p>
      </div>
    </section>
  );
}
