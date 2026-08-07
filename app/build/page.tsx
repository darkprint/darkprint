import type { Metadata } from "next";
import { hasErrors, loadBundle, ontologyView, CORE_ONTOLOGY } from "@/lib/core";
import { buildStarterBundle, starterSlug } from "@/lib/starter/variants";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { BuildWorkspace } from "@/components/build/BuildWorkspace";
import { ALL_COMBINATIONS } from "@/components/build/choices";
import { OnwardRoutes } from "@/components/ui/OnwardRoutes";

export const metadata: Metadata = {
  /* "Design a blueprint", not "Build your own blueprint". The author renamed the nav
     label on 2026-08-07 and this site's own doctrine — `components/site/nav.test.ts`'s
     header, "one route, one name" — makes the page's `h1` and its `<title>` follow: the
     label a reader clicks should be the heading they land on, with nothing to re-resolve
     on arrival. "Design" is also the truer verb for what this workspace is. Nothing is
     built here; three choices are made over a graph and a folder comes out. */
  title: "Design a blueprint",
  description:
    "One workspace over a blueprint's three parts: the graph, a card for every node, and the vocabulary both are written against. Start from the five-node starter, make three choices that stay in the artefact, and leave holding a blueprint that runs from your own command line. Every score is computed by the same static analysis the registry uses. Nothing is uploaded and there is nowhere to save it yet.",
};

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
  const combinations = verifyEveryVariant();

  return (
    <div className="container-page py-12">
      <header className="max-w-3xl">
        <Eyebrow>Workspace</Eyebrow>
        {/* Redesign spec §4.3: the header is the first thing a reader skips, so it holds
            one sentence of orientation and one of honesty. What left it is the promise
            that there is nowhere to save the result, which `DownloadPanel` states at the
            step where a reader can act on it, and the word "static", which the sentence
            about nothing running says already. */}
        <SectionHeading
          className="mt-3"
          as="h1"
          title="Design a blueprint"
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
          lead="Start from the five-node starter and change it with three choices. Every choice rewrites the graph, the cards and the vocabulary together."
        />
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Each of the three choices sits in the panel under the graph, and every score on
          the page is computed in your browser, by the analysis the gallery runs, on the
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
        <BuildWorkspace />
      </div>

      {/* The one outbound link on this page was `/upload`, inside a 13px `text-dim`
          paragraph two thirds of the way down, and the page ended on a download with
          nowhere to go. A reader who has just built a blueprint has two obvious next
          moves and neither was offered. */}
      <OnwardRoutes
        className="mt-12"
        routes={[
          {
            href: "/upload",
            // The label the header, the footer and the phone panel all use for this
            // destination, and the `h1` it lands on. One route, one name.
            label: "Upload blueprint",
          },
          {
            // `/skill` and not `/mcp`, now that "Install" is two routes. This page is the
            // workspace where a reader designs a blueprint by hand, and the skill is the
            // same job done by an agent instead — the one exit of the two that continues
            // what they were already doing. `/mcp` is about reading the registry from
            // inside a client, which is a different errand and not built.
            href: "/skill",
            // The name the header and the footer both give this route. "Point a client
            // at it" was a third name for one destination, and it read as a sentence in
            // a slot that is now a button's face. It was "Install MCP", then "Install",
            // and the three tables move in one commit every time: `nav.test.ts` holds
            // them to one label per route.
            label: "The DarkPrint skill",
          },
        ]}
      />
    </div>
  );
}
