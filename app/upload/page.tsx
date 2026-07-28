import type { Metadata } from "next";
import { stringify as stringifyYaml } from "yaml";
import { allBlueprints, bundleSource, bundleVocabulary, getRegistry } from "@/lib/content";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { UploadFlow, type ExampleBundle } from "@/components/upload/UploadFlow";

export const metadata: Metadata = {
  title: "Share a blueprint",
  description:
    "Upload the DOT graph of your dark factory. DarkPrint parses it in your browser and scores its autonomy and security by static analysis. Publishing to the registry is not built yet — nothing leaves the tab.",
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

export default function UploadPage() {
  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <Eyebrow>Contribute</Eyebrow>
        <SectionHeading
          className="mt-3"
          title="Share a blueprint"
          lead="Upload the DOT graph of your dark factory. DarkPrint parses the schematic in this tab, then statically analyses it to score autonomy and security automatically — no forms to guess your way through. The other four axes stay empty: efficacy, reliability and transparency are meant to come from community votes and cost and time from a real run, and neither the ballot nor the runner is built. Nor is publishing — nothing here leaves your browser."
        />
      </header>

      <div className="mt-10">
        <UploadFlow example={exampleBundle()} />
      </div>
    </div>
  );
}
