import type { Metadata } from "next";
import { stringify as stringifyYaml } from "yaml";
import { allBlueprints, bundleSource, bundleVocabulary, getRegistry } from "@/lib/content";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { UploadFlow, type ExampleBundle } from "@/components/upload/UploadFlow";

export const metadata: Metadata = {
  title: "Share a blueprint",
  description:
    "Upload the DOT graph of your pipeline. DarkPrint parses it in your browser, names its autonomy class and scores its security by static analysis. Publishing to the registry is not built yet, nothing leaves the tab.",
};

/**
 * A real bundle, flattened to plain text files.
 *
 * The wizard resolves whatever it is given inside the browser tab, where the archive is
 * out of reach, so the example it can load has to travel as props: the manifest, the
 * topology and every card the DOT pins, named exactly as the archive names them. It is
 * fed back through the very same drop-zone path a hand-picked selection takes, which is
 * the only way the button demonstrates anything at all.
 */
function exampleBundle(): ExampleBundle {
  const blueprints = allBlueprints();
  const bp = blueprints.find((b) => b.seed) ?? blueprints[0];
  const source = bundleSource(bp.slug);
  const record = getRegistry().blueprint(bp.slug);

  const files: ExampleBundle["files"] = [];
  if (record !== undefined) {
    files.push({ name: "blueprint.yaml", text: stringifyYaml(record.manifest) });
  }
  files.push({ name: "blueprint.dot", text: source.dot });
  for (const card of source.cards) {
    // `bundleSource` reports the repo-relative path; the bundle-relative name is what
    // diagnostics quote back, so the wizard shows the same locations the loader does.
    files.push({ name: card.file.replace(/^content\//, ""), text: card.text });
  }
  // Doc 3 §7. Carried for the same reason the download carries it: a card declaring a
  // local term resolves against nothing without the file that defines it, and an example
  // that arrives with two errors in it teaches the wrong thing about the validator.
  const vocabulary = bundleVocabulary(bp.slug);
  if (vocabulary !== undefined) {
    files.push({ name: vocabulary.file, text: vocabulary.text });
  }

  return { title: bp.title, files };
}

/**
 * The page a reader arrives at with their own graph in hand.
 *
 * The lead used to open "Upload the DOT graph of your dark factory", which made a
 * classification into a condition of entry on the one surface where somebody is being
 * asked to submit something. Doc 2 §1.1 names that exact reading as the barrier the
 * principle exists to remove, and `app/blueprints/page.tsx` records the same rule for the
 * index, where the identical construction was already dropped. Since `isDarkFactory` is a
 * literal zero-human-node test, the sentence was also false about any graph with a gate
 * in it, `guarded-merge-bot` included. What the page asks for is a pipeline; what the
 * analyzer answers with is the class it belongs to.
 */
export default function UploadPage() {
  return (
    <div className="container-page py-12">
      {/* `as="h1"`. The page a contributor lands on had no level-one heading at all: its
          outline opened at `h2` and a screen reader reached the route with no title.

          The lead was 89 words and did five jobs in one breath: what to drop, what comes
          back, how a human node resolves, which four axes stay empty and why, and that
          publishing is not built. Four of those five qualify things further down the
          page, so they now sit beside what they qualify. `max-w-2xl` came off with them,
          the same full-width rule the other heroes follow. */}
      <header>
        <Eyebrow>Contribute</Eyebrow>
        <SectionHeading
          as="h1"
          className="mt-3"
          title="Share a blueprint"
          lead="Drop the DOT graph of your pipeline. This page parses it in your own tab, names the autonomy class and scores the security, with no form to guess your way through."
        />
        {/* The vocabulary asymmetry, moved here from `/what-it-isnt` when that page was
            removed. It is a statement about this page, and it was the only unconditional
            statement of it on the site: `BundleDropzone` says the bundle is read against
            the curated core alone, but only once a dropped bundle has already tripped a
            vocabulary problem, so a reader comparing a page's score against the wizard's
            never sees it first.

            The claim is exact and worth keeping exact: the wizard builds its vocabulary
            from `CORE_ONTOLOGY` alone (`components/upload/UploadFlow.tsx`) while the
            archive resolves against the core plus `content/ontology/extensions.yaml`, so
            this release's own `frontline-triage` bundle reports two unknown terms in the
            wizard and scores 4 where its page shows 2. Not folded, and not shortened:
            two HIGH findings in this project were disclaimers going missing while
            somebody was cutting for pace. */}
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-dim">
          It resolves what you drop against the curated core vocabulary only. Bundles in
          the archive are resolved against the core plus the terms this release adds in
          its own namespace, so a graph using one of those comes back with the term
          unknown and a security score computed without it.
        </p>
      </header>

      {/* The two facts the lead used to carry about the result, moved to where the
          result appears. Both qualify what the reader is about to look at, which is the
          one place a limit belongs: a graph with a person in it is read, not penalised,
          and the scorecard that comes back has four axes nothing can fill. */}
      <p className="mt-5 text-sm leading-relaxed text-dim">
        A graph with a person standing in it resolves like one without, and names the node
        where they act. Two of the six axes are read off the graph; efficacy, reliability
        and transparency need votes, and cost and time need a run.
      </p>

      <div className="mt-10">
        <UploadFlow example={exampleBundle()} />
      </div>
    </div>
  );
}
