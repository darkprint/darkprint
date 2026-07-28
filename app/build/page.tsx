import type { Metadata } from "next";
import { hasErrors, loadBundle, ontologyView, CORE_ONTOLOGY } from "@/lib/core";
import { buildStarterBundle, starterSlug } from "@/lib/starter/variants";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { ALL_COMBINATIONS } from "@/components/build/choices";
import { GuidedPath } from "@/components/build/GuidedPath";

export const metadata: Metadata = {
  title: "Build your own factory",
  description:
    "The guided path. Start from the five-node starter, make three choices that stay in the artefact, and finish holding a factory that runs from your own command line. Every score on the page is computed by the same static analysis the registry uses. Nothing is uploaded and there is nowhere to save it yet.",
};

/* ============================================================
   /build — doc 2 §5, items 12 and 13.
   ------------------------------------------------------------
   The page itself is thin. The path is a client component because
   the reader is choosing between eighty bundles and each one has to
   be generated, scored and exported for whichever they land on;
   `lib/starter/variants` is pure and client-safe, the engine
   already runs in the browser on `/upload`, and precomputing eighty
   finished states would put megabytes on a page a reader sees one
   state of. Doc 1 §0.1.3 keeps *execution* off the server, and
   static analysis is not execution.

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
   is the reader's design decision, stated in the panel beside the
   graph and never set as the target of the page.
   ============================================================ */

/** The same vocabulary the path builds in the browser, so the two agree by construction. */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

let checked = false;

/**
 * Every combination the path can produce, resolved once per build.
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
        `The guided path can produce a factory that does not resolve: ${problems.length} problem${
          problems.length === 1 ? "" : "s"
        } across ${ALL_COMBINATIONS.length} combinations.`,
        "",
        ...problems,
        "",
        "Doc 2 §5.3: every combination of choices has to produce a working factory. Fix lib/starter/ before shipping /build.",
      ].join("\n"),
    );
  }

  checked = true;
  return ALL_COMBINATIONS.length;
}

export default function BuildPage() {
  const combinations = verifyEveryVariant();

  return (
    <div className="container-page py-12">
      <header className="max-w-3xl">
        <Eyebrow>Guided path</Eyebrow>
        {/* Redesign spec §4.3: the header is the first thing a reader skips, so it holds
            one sentence of orientation and one of honesty. What left it is the promise
            that there is nowhere to save the result, which `DownloadPanel` states at the
            step where a reader can act on it, and the word "static", which the sentence
            about nothing running says already. */}
        <SectionHeading
          className="mt-3"
          as="h1"
          title="Build your own factory"
          lead="About an hour. Start from the five-node starter, make three choices, and leave with a factory that runs from your own command line."
        />
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Every score is computed in this tab, by the analysis the gallery runs, on the
          exact bytes you download. Nothing is uploaded.
        </p>
        {/* Doc 2 §5.7's count, stated rather than claimed: the number is the length of the
            enumeration the build just walked through the engine. */}
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-dim">
          {combinations} combinations, each resolved through the engine when this page was
          built. One error would have failed the build.
        </p>
      </header>

      <div className="mt-10">
        <GuidedPath />
      </div>
    </div>
  );
}
