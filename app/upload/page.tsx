import type { Metadata } from "next";
import Link from "next/link";
import { stringify as stringifyYaml } from "yaml";
import { allBlueprints, bundleSource, bundleVocabulary, getRegistry } from "@/lib/content";
import { SKILL_ROUTE } from "@/lib/skill";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { UploadFlow, type ExampleBundle } from "@/components/upload/UploadFlow";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-95) (cited at line 138): folded into SEAM-27

/**
 * The house style for a link written inside a sentence, copied rather than imported.
 *
 * Four components already spell these exact utilities inline
 * (`components/home/SectionRoles.tsx`, `SectionLevels.tsx`,
 * `components/explain/WhichTasksRemedies.tsx`); there is no shared primitive to reach
 * for, and inventing one here would put a site-wide decision in a route file.
 */
const PROSE_LINK =
  "text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan";

export const metadata: Metadata = {
  /* One destination, one name. Every door into this route — the header, the phone panel,
     the footer and both landing doors — has to print the same words as the `h1` below,
     and the words are now "Upload blueprint". They were "Validate a bundle" for a
     release, and before that this page answered to "Share a blueprint" in 48px display
     type under an eyebrow reading CONTRIBUTE, which was a promise of publishing the site
     has no backend for.

     "Upload blueprint" is the author's name for the route and it is the honest one, and
     since T263 it is honest in the plain way: a bundle IS read in this tab, and pressing
     Publish sends it to the registry and stores a release. That was not true when this
     note was written, and the sentences that said so came off in the change that made
     them false rather than in a later tidy (D-78, D-263-02). What still may not be
     dropped for pace is the one limit that remains — the skill does not push from the
     editor — and the divergence between the reading taken here and the registry's own.
     Two HIGH findings in this project were disclaimers going missing during a length
     pass. `components/site/nav.test.ts` holds the chrome to this name. */
  title: "Validate and publish",
  description:
    "Validate and publish a blueprint bundle. DarkPrint resolves it in your browser, names its autonomy class, and reports static risk exposure before a release is created.",
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
        {/* CONTRIBUTE, and the h1 under it, both promised publishing. See the note on
            `metadata.title`: the chrome sends a reader here calling it "Upload
            blueprint", so that is what they must land on.

            The eyebrow does the work the old title used to do badly. "Upload blueprint"
            names the action; "Check your work" names the outcome, one line above it, so
            the two are read together and a reader knows before the fold that uploading
            here is how a bundle gets checked and not how it gets somewhere. */}
        <Eyebrow>Validate before release</Eyebrow>
        <SectionHeading
          as="h1"
          className="mt-3"
          title="Validate and publish"
          lead="Choose a blueprint bundle and resolve it in your own tab. You get explainable diagnostics, an autonomy class, and a bounded static risk-exposure reading before the separate publish step."
        />
        {/* ── Where the folder in front of the reader came from ──
            The population arriving here changed. Until now the only person with a bundle
            in hand had downloaded one from `/blueprints` or exported one from `/build`,
            and both of those hand over something finished. The DarkPrint skill writes the
            registry shape into a working directory a card at a time, and it points at
            this route, so the ordinary visitor is now an author halfway through — which
            is what the second sentence is for and what `components/upload/progress.ts`
            re-frames the wizard around.

            Named, not merely accommodated: a reader who has never heard of the skill
            learns from this paragraph that it exists, which is the only mention of it on
            the route. "The DarkPrint skill" and never "the skill" — `lib/skill.ts` sets
            that rule out, and the reason is that `skill:` is already a field on a node
            card meaning something one level down. The link goes to `SKILL_ROUTE` rather
            than to a path written here, so this sentence follows the page that explains
            the skill wherever it lives. */}
        {/* `text-muted`, not the `text-dim` the two paragraphs under it wear. Both of
            those qualify something — a promise about later, and an asymmetry in the
            vocabulary — and dim is this site's register for a qualification. This one is
            wayfinding, the first thing a reader arriving from the skill needs to read, and
            at dim it sat in the same tier as the fine print and was skimmed with it. */}
        {/* Full width, on the author's instruction 2026-08-07: `max-w-2xl` off this one.
            The paragraphs around it keep their measure; this is a named exception. */}
        <p className="mt-5 text-sm leading-relaxed text-muted">
          A folder written by the{" "}
          <Link href={SKILL_ROUTE} className={PROSE_LINK}>
            DarkPrint skill
          </Link>{" "}
          drops straight in. It runs in your own editor and writes the two things this page
          reads, a <span className="font-mono text-cyan">blueprint.dot</span> and the{" "}
          <span className="font-mono text-cyan">cards/</span> it pins, so there is nothing
          to export and nothing to convert. Bring it before it is finished: a graph whose
          cards are half written resolves as far as it goes, and the report says how far.
        </p>
        {/* ── Two of the three sentences that stood here are gone, and ONE stayed (D-263-02) ──
            The paragraph used to refuse three things at once: an account to upload into,
            a backend to upload to, and a push from the editor the skill runs in.

            The first two became false in the change that wired this route. There is an
            account (T050) and a registry that stores a release under it, and each release
            is published public or private from the control on the Details step — which is
            the whole of what the first sentence said was missing. D-78's direction rule is
            what forces them off HERE and not in a later tidy: a marker over a figure that
            has become real comes off in the same change that makes it real, because a true
            statement that has become a lie about the product is worse than no statement.

            **The third stayed, and it is not an oversight.** T270 is `todo`: the DarkPrint
            skill still writes a folder to disk and nothing pushes it anywhere. Removing it
            with the other two would have been a false claim in the opposite direction, and
            "those three disclosures come off together" reads as licence to do exactly that.
            It keeps the badge, because the badge is what the sentence is for.

            `components/site/honesty.test.ts` holds this one sentence over the rendered
            route; the two rows for the other two came off in this same commit. */}
        {/* `max-w-2xl`, the same measure as the paragraph under it. Without one this line
            set to the full 1152px container at 13px, which is roughly 150 characters —
            two and a half times the measure everything else in this header keeps, and the
            badge ended up alone at the far left of a single very long line. */}
        <p className="mt-5 flex max-w-2xl flex-wrap items-center gap-2 text-[13px] leading-relaxed text-dim">
          <ComingSoonBadge />
          Not built yet: a live push from the editor the skill runs in. It writes the folder
          to your disk, and you bring it here.
        </p>
        {/* The vocabulary asymmetry, moved here from `/what-it-isnt` when that page was
            removed. It is a statement about this page, and it was the only unconditional
            statement of it on the site: `BundleDropzone` says the bundle is read against
            the curated core alone, but only once a dropped bundle has already tripped a
            vocabulary problem, so a reader comparing a page's score against the wizard's
            never sees it first.

            ── D-263-01: this REMAINED, rewritten, and the premise for deleting it was false ──
            The contract said the divergence "is resolved once the server resolves against
            published overlays". It is not. `app/api/validate/bundle/route.ts` never calls
            `openView`: `validateBundle` falls back to `ontologyView(CORE_ONTOLOGY,
            extensions)`, which is bit-for-bit the vocabulary this tab already builds. What
            the cutover changed is the PUBLISH leg, where `publish.ts:168` opens the STORED
            ontology at the version the manifest names. So the gap did not close, it moved:
            a bundle can read clean here and be refused at publish, and the reverse.

            The client-side pass stays on purpose — the same Contract line says so, and
            `docs/ARCHITECTURE.md` §7 puts the server's authoritative pass at publish time —
            so the wizard still scores `frontline-triage` at 4 where its page shows 2.
            Deleting this sentence on the stated premise would have replaced a true
            disclosure with silence about a divergence that is still there.

            Not folded, and not shortened: two HIGH findings in this project were disclaimers
            going missing while somebody was cutting for pace. */}
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-dim">
          What you drop is resolved here against the curated core vocabulary plus any{" "}
          <span className="font-mono text-cyan">ontology/extensions.yaml</span> in the
          folder. The registry resolves it again when you publish, against the ontology
          version the manifest names, so a bundle pinning an older version can be judged on
          different terms there than here. The reading on this page is the fast one; the
          registry&rsquo;s is the one that decides.
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
