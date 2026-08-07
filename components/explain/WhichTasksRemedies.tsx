import Link from "next/link";
import type { Blueprint } from "@/lib/types";
import { allBlueprints, getBlueprintBySlug } from "@/lib/content";
import { contentHref } from "@/lib/href";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   The filter has to do something for the reader it turns away,
   or it is just a wall. Doc 2 §4 puts the page there to stop a
   doomed attempt; doc 2 §5.3 supplies the move that rescues the
   commonest failure, and doc 2 §1.1 constrains how it is worded.

   The third move is the one that carries §1.1. A task whose
   failure lands in production is not a task DarkPrint has no
   answer for: the answer is a graph with a person standing at
   the step where a mistake gets expensive. That graph reads at a
   lower autonomy band, and the band says where the person is.
   Nothing here may imply the author settled for something.

   ── The length pass (PROJECT.md §3.1) ──
   The third card used to open by describing that graph in the same
   words `WhichTasksGlance`'s caption uses, four sections higher:
   "a node with a person at it, positioned at the step where a
   mistake becomes expensive, and everything upstream of it running
   unattended". One copy of a sentence, and the one that stayed is
   the one standing beside the branch of the figure it reads. The
   same trim took the section lead's two-of-three signpost, which
   the figure draws, and the first card's "questions 01 and 02 both
   answer yes", which the caption states as "answer them and ask
   again".

   The §1.1 sentence at the end of the third card is shorter and it
   is still here. `/towards-a-dark-factory#autonomy` states the rule
   in full and this now links there, because a page that turns a
   reader away on question 04 is the page where "you settled for
   less" is easiest to read into the answer.

   ── The scale pass ──
   The `h2` moves off a hand-written `font-display text-2xl` onto
   `SectionHeading`, and its one-sentence lead becomes the deck it
   already was. The three card labels were three copies of
   `font-mono text-[11px] uppercase tracking-[0.18em] text-dim` —
   the exact string the `.label` tier was written to replace, and
   the reason this one file had three chances to disagree with
   itself about what a label is. The id `aria-labelledby` names
   rides a `<span>` inside the title, because `SectionHeading` takes
   no id prop and a second copy of its class list is the thing being
   deleted.
   ============================================================ */

/**
 * A published graph that stops for a person before the irreversible step.
 *
 * Named by slug because the argument is about this specific shape (agents do the work,
 * a maintainer makes the call that cannot be undone), and read out of the archive rather
 * than described from memory, so the level quoted below is the level the analyzer
 * computed on the last build. If that bundle ever leaves the archive the fallback picks
 * whichever published graph puts a person at the most nodes, and if none does the
 * paragraph renders without an example instead of pointing at a 404.
 */
function supervisedExample(): { blueprint: Blueprint; people: number } | undefined {
  const preferred = getBlueprintBySlug("guarded-merge-bot");
  const candidates = preferred !== undefined ? [preferred] : allBlueprints();

  let best: { blueprint: Blueprint; people: number } | undefined;
  for (const blueprint of candidates) {
    const people = blueprint.analysis.autonomy.contributions.filter(
      (c) => c.requiresHuman,
    ).length;
    if (people === 0) continue;
    if (
      best === undefined ||
      people > best.people ||
      (people === best.people && blueprint.slug < best.blueprint.slug)
    ) {
      best = { blueprint, people };
    }
  }
  return best;
}

const EXAMPLE = supervisedExample();

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

export function WhichTasksRemedies() {
  return (
    <section className="flex flex-col gap-10" aria-labelledby="remedies-heading">
      {/* An eyebrow, like the three bands above it. The eyebrow says why the section is
          here rather than restating the title: a filter that only turns people away is a
          wall, and this is the half that makes it a filter. */}
      <SectionHeading
        eyebrow="The other half of the filter"
        title={<span id="remedies-heading">What to do with a no</span>}
        lead="A no is about this task in its current shape."
      />

      <ol className="grid gap-5 lg:grid-cols-3">
        <li className="panel flex flex-col gap-3 p-5">
          <span className="label">01 / 02 · verdict and harness</span>
          <h3 className="font-display text-lg font-semibold leading-snug text-fg">
            Build the check, and call that the task
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            Work with no verifier is two pieces of work, and the verifier is the piece
            worth doing by hand: writing it is where you find out what you meant by
            correct.
          </p>
          {/* The length pass folded the second paragraph into this one. It read "a
              harness written after the code, by the thing that wrote the code, tests the
              code that exists. The behaviour you wanted never gets checked", which is the
              clause below at twice the length. */}
          <p className="text-sm leading-relaxed text-dim">
            Written afterwards, by the thing that wrote the code, a harness only tests the
            code that exists.
          </p>
        </li>

        <li className="panel flex flex-col gap-3 p-5">
          <span className="label">03 · the edges</span>
          <h3 className="font-display text-lg font-semibold leading-snug text-fg">
            Shrink it until the edges are visible
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            <em className="text-fg">Modernise the billing code</em> does not become
            tractable by adding paragraphs to the prompt. It becomes tractable as{" "}
            <em className="text-fg">
              move these forty call sites off this deprecated API
            </em>
            , which has a first line, a last line and a test that goes red.
          </p>
          <p className="text-sm leading-relaxed text-dim">
            If the smaller task feels too small to be worth automating, the ambiguity was
            the whole job.
          </p>
        </li>

        <li className="panel flex flex-col gap-3 p-5">
          <span className="label">04 · cost of being wrong</span>
          <h3 className="font-display text-lg font-semibold leading-snug text-fg">
            Put a person where being wrong stops being cheap
          </h3>
          <p className="text-sm leading-relaxed text-muted">
            A critical task is still buildable, in the shape the figure above draws. The
            agents keep the toil, and the irreversible call stays with whoever is
            accountable for it.
          </p>
          {EXAMPLE !== undefined && (
            <p className="text-sm leading-relaxed text-muted">
              <Link
                href={contentHref(EXAMPLE.blueprint)}
                className={INLINE}
              >
                {EXAMPLE.blueprint.title}
              </Link>{" "}
              is that graph as published: it reads{" "}
              {EXAMPLE.blueprint.analysis.autonomy.label}, which states where its{" "}
              {EXAMPLE.people === 1 ? "person stands" : "people stand"} and nothing else.
              The class describes a design decision and never ranks one graph over
              another,{" "}
              <Link href="/towards-a-dark-factory#autonomy" className={INLINE}>
                the rule in full
              </Link>
              .
            </p>
          )}
        </li>
      </ol>
    </section>
  );
}
