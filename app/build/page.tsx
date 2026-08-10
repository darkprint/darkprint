import type { Metadata } from "next";
import { hasErrors, loadBundle, ontologyView, CORE_ONTOLOGY } from "@/lib/core";
import { buildStarterBundle, starterSlug } from "@/lib/starter/variants";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { BuildWorkspace } from "@/components/build/BuildWorkspace";
import { ALL_COMBINATIONS } from "@/components/build/choices";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";

export const metadata: Metadata = {
  /* This site's doctrine — `components/site/nav.test.ts`'s header, "one route, one name" —
     makes the page's `h1` and its `<title>` follow the label a reader clicks, with nothing
     to re-resolve on arrival. The label moved when the page split: "Create" went to
     `/skill` with the authoring half, and what is left here is the worked example, which is
     what the Learn rail and the `h1` now both call it.

     Both strings are read off `components/spec/sequence.ts` below rather than typed, except
     this one: `metadata` is a module constant and cannot call `specNeighbours`. It is the
     one place the title is spelled twice, and `spec-routes.test.ts` holds the pair. */
  title: "Customize the starter blueprint",
  description:
    "A sandbox for one five-node software workflow. Change its output, release gate, and retry cap, and watch the graph, the cards, the vocabulary and the static reading move together.",
};

const HERE = "/build";

/* ============================================================
   /build — doc 2 §5, items 12 and 13. Restructured as one workspace
   per docs/superpowers/specs/2026-08-06-build-restructure-design.md.
   ------------------------------------------------------------
   The page itself is thin. `BuildWorkspace` — one large graph, three
   simultaneous controls, two co-equal exits — replaces what used to
   be an eight-step path here, and it is a client component for the
   same reason the path was: the reader is choosing between eighty
   bundles and each one has to be generated, scored and exported for
   whichever they land on; `lib/starter/variants` is pure and
   client-safe, the engine already runs in the browser on `/upload`,
   and precomputing eighty finished states would put megabytes on a
   page a reader sees one state of. Doc 1 §0.1.3 keeps *execution*
   off the server, and static analysis is not execution.

   What the server does is the part a browser cannot: it walks the
   whole choice space before the page ships. Doc 2 §5.3 is blunt
   about the failure mode — a persisted broken configuration is a
   defective factory sent out with the registry's name on it — and
   §5.7 asks for all eight structural variants to be checked rather
   than the two a developer clicks. So every combination goes
   through `loadBundle` here, and a single error-severity diagnostic
   fails the build, the same way `lib/content/read.ts` refuses to
   publish a broken archive bundle.

   ── Why the page is not called "Build a dark factory" ──
   Choice 2 offers a named approver at the release boundary, and
   every combination that takes it resolves to a conditional graph
   with a human node in it. A title promising a dark factory would
   therefore be a promise one of the three choices breaks, and doc 2
   §5.3 is explicit that the approver must not read as a penalty:
   "chi sceglie l'approvazione umana non deve vedere niente che
   somigli a una penalità". The deliverable of the hour is a factory
   the reader owns and can run. Which class the analyzer reads off it
   is the reader's design decision, stated in the strip above the
   graph and in full behind the Score tab, and never set as the
   target of the page.
   ============================================================ */

/** The same vocabulary the workspace builds in the browser, so the two agree by construction. */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

let checked = false;

/**
 * Every combination the workspace can produce, resolved once per build.
 *
 * Memoized at module scope because a static build renders a page more than once and this
 * is the same answer every time. Throws with every failing combination listed, rather than
 * the first: one broken output kind should not hide the rest.
 */
function verifyEveryVariant(): number {
  if (checked) return ALL_COMBINATIONS.length;

  const problems: string[] = [];
  for (const choices of ALL_COMBINATIONS) {
    const where = `${starterSlug(choices)} @ cap ${choices.maxIterations}`;
    const result = loadBundle(buildStarterBundle(choices), { ontology: ONTOLOGY });
    if (result.blueprint === undefined || result.analysis === undefined) {
      problems.push(`${where}  the bundle did not resolve at all.`);
      continue;
    }
    if (hasErrors(result.diagnostics)) {
      problems.push(
        `${where}  resolved with errors.`,
        ...result.diagnostics
          .filter((d) => d.severity === "error")
          .map((d) => `    ${d.code}  ${d.message}`),
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      [
        `The workspace can produce a blueprint that does not resolve: ${problems.length} problem${
          problems.length === 1 ? "" : "s"
        } across ${ALL_COMBINATIONS.length} combinations.`,
        "",
        ...problems,
        "",
        "Doc 2 §5.3: every combination of choices has to produce a working blueprint. Fix lib/starter/ before shipping /build.",
      ].join("\n"),
    );
  }

  checked = true;
  return ALL_COMBINATIONS.length;
}

export default function BuildPage() {
  /* Called for the throw, not for the number. `verifyEveryVariant()` walks all 80
     combinations through the engine at build time and fails the build on a single error;
     the count it returns was printed under the lead until the author asked that line out on
     2026-08-08. The call stays exactly where it was — a check nobody reads is still a check,
     and deleting it to satisfy an unused-variable warning would trade a build-time guarantee
     for a lint line. */
  verifyEveryVariant();

  const { page } = specNeighbours(HERE);

  return (
    <div className="container-page py-12">
      {/* Full width, on the author's instruction 2026-08-07. `max-w-3xl` capped the lead,
          the two paragraphs and the route-box that follows them at 48rem; the workspace
          below has always run the container's whole width, so the page opened on a column
          two thirds as wide as the thing it introduces. */}
      <header>
        <SpecCrumb href={HERE} />
        <Eyebrow className="mt-5">{page.eyebrow}</Eyebrow>
        {/* Redesign spec §4.3: the header is the first thing a reader skips, so it holds
            one sentence of orientation and one of honesty. What left it is the promise
            that there is nowhere to save the result, which `DownloadPanel` states at the
            step where a reader can act on it, and the word "static", which the sentence
            about nothing running says already. */}
        <SectionHeading
          className="mt-3"
          as="h1"
          title={page.title}
          /* Doc 2 §5.3/§5.7 named the choices; the build-restructure spec's §2.4 fixed
             where the hour goes.
             ------------------------------------------------------------
             The previous lead opened on "About an hour". The author, 2026-08-06, on
             exactly that line: "the 'about one hour' push away a user." The hour was
             never the true cost of this page — three radio buttons and a download take a
             few minutes — and what actually takes an hour is wiring the resulting folder
             into a reader's own agent runner afterwards, which is why it now lives on
             `DownloadStep` (task 5), stated in the past tense of a download already in
             hand rather than as a promise about what is still ahead on this screen.

             What replaces it names the artefact and the three choices' shared subject
             instead: the five-node starter, and that every choice moves the graph, the
             cards and the vocabulary together. That second claim is not asserted here on
             faith — `components/build/surfaces.ts` diffs the real bundle before and after
             every choice and only marks a tab whose bytes actually moved, so the workspace
             below is checking the sentence this lead makes, not just repeating it. */
          lead="This is a sandbox for one five-node software workflow, not a general designer. Change its output, release gate, and retry cap to see the graph, cards, vocabulary, and static reading move together."
        />
        {/* Two paragraphs stood here and the author asked both out on 2026-08-08.

            "Each of the three choices sits in the panel under the graph, and every score on
            the page is computed in your browser … Nothing is uploaded." It described the
            layout of the thing directly under it — three controls in a panel under a graph
            — to a reader who can see it, and its honesty clause is `DownloadPanel`'s closing
            sentence at the foot of the same page, which `components/site/honesty.test.ts`
            pins there.

            "{combinations} combinations, each resolved through the engine when this page was
            built. One error would have failed the build." That is the build's own coverage
            figure. `verifyEveryVariant()` still computes it and the build still fails on a
            single error; the number just stopped being printed at a reader. A check nobody
            reads is still a check, which is why the function is untouched. */}
      </header>

      {/* The sandbox, and now the whole page rather than the second half of one.
          ------------------------------------------------------------
          `CreateEntry` stood above this, under an `h1` reading "Create a blueprint from
          your goal", and the section below it repeated that heading one type-step down as
          "Customize the starter blueprint" with `Eyebrow`, an `h2` and a paragraph. The
          author asked the two halves apart, so the skill half is at `/skill` and what was
          the sub-heading is now the page's own name.

          The duplicated block goes with it. Keeping the eyebrow, the `h2` and the sentence
          under an `h1` that now says the same words would be the page starting twice, which
          is the defect `/what-a-blueprint-is` records refusing when the doors moved onto it.
          The sentence is not lost: it is the lead above, verbatim.

          `#starter-sandbox-title` goes too, and nothing links it. It was declared in this
          page's own `PageContents` panel, which the rail replaced, and
          `components/spec/sequence.ts` lists the one anchor a reader still needs, the
          workspace's own `#workspace-heading`. */}
      <div className="mt-10">
        <BuildWorkspace />
      </div>

      {/* The one outbound link on this page was `/upload`, inside a 13px `text-dim`
          paragraph two thirds of the way down, and the page ended on a download with
          nowhere to go. A reader who has just built a blueprint has two obvious next
          moves and neither was offered. */}
      <div className="mt-12">
        <SpecPager href={HERE} />
      </div>
    </div>
  );
}
