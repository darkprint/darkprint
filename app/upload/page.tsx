import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { stringify as stringifyYaml } from "yaml";
import { allBlueprints, bundleSource, bundleVocabulary, getRegistry } from "@/lib/content";
import { getSharedDbClient } from "@/lib/db";
import { actorFrom } from "@/lib/server/accounts";
import { draftBundle } from "@/lib/server/registry";
import { SKILL_ROUTE } from "@/lib/skill";
import { readSession } from "@/components/profile/session";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { UploadFlow, type ExampleBundle, type PublishTarget } from "@/components/upload/UploadFlow";

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
     had no backend for at the time. It has one now, which is what T263 changed and why
     the sentences below it moved.

     "Upload blueprint" is the author's name for the route and it is the honest one, and
     since T263 it is honest in the plain way: a bundle IS read in this tab, and pressing
     Publish sends it to the registry and stores a release. That was not true when this
     note was written, and the sentences that said so came off in the change that made
     them false rather than in a later tidy (D-78, D-263-02). What still may not be
     dropped for pace is the one limit that remains — the skill does not push from the
     editor — and the divergence between the reading taken here and the registry's own.
     Two HIGH findings in this project were disclaimers going missing during a length
     pass. `components/site/nav.test.ts` holds the chrome to this name. */
  title: "Publish",
  description:
    "Check a blueprint folder in your browser, then publish it to the DarkPrint registry as a numbered release. Every problem the check finds says where and why. Publishing needs an account.",
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
  files.push({ name: "topology.dot", text: source.dot });
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

/** The first string value under `key`, when there is one — `searchParams` carries an array
    for a repeated query key, and this route only ever reads one of each. */
function firstString(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = searchParams[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

/**
 * `?owner=&slug=`, resolved into a `PublishTarget` only once the session reading this
 * page OWNS the addressed bundle — checked here, server-side, before the wizard ever
 * sees the pin, rather than left to the client to ask and trust.
 *
 * Ownership is a literal handle match rather than a `can` call: `draftBundle` already
 * enforces B-03 readability (a private bundle that is not the caller's answers
 * `undefined`, the same as one that does not exist), and a stranger reading a PUBLIC
 * bundle's owner/slug in the URL must still not have the wizard address a release at it
 * on their behalf — only the owner may pin their own upload.
 */
async function resolveTarget(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<PublishTarget | undefined> {
  const owner = firstString(searchParams, "owner");
  const slug = firstString(searchParams, "slug");
  if (owner === undefined || slug === undefined) return undefined;

  const session = await readSession();
  if (session === undefined || session.handle !== owner) return undefined;

  const { db } = getSharedDbClient();
  const draft = await draftBundle(db, actorFrom(session), owner, slug);
  if (draft === undefined) return undefined;

  const target: PublishTarget = {
    owner: draft.ownerHandle,
    slug: draft.slug,
    visibility: draft.visibility,
  };
  if (draft.title !== undefined) target.title = draft.title;
  if (draft.summary !== undefined) target.summary = draft.summary;
  if (draft.description !== undefined) target.description = draft.description;
  if (draft.category !== undefined) target.category = draft.category;
  if (draft.tags !== undefined) target.tags = draft.tags;
  return target;
}

/**
 * The wizard's own shape, empty — what a reader sees for the moment (typically well under
 * a frame) `TargetedUploadFlow` takes to resolve `?owner=&slug=`.
 *
 * A skeleton rather than an untargeted `UploadFlow`: the two are different components, so
 * swapping one for the other on resolve UNMOUNTS whichever rendered first and takes
 * anything typed into it along — the mistake this shape avoids is a reader who started
 * typing during the fallback losing it the instant the real wizard mounts.
 */
function UploadFlowSkeleton() {
  return (
    <div
      className="panel flex min-h-[420px] items-center justify-center overflow-hidden"
      aria-hidden
    >
      <span className="font-mono text-xs text-dim">Loading…</span>
    </div>
  );
}

/**
 * The wizard itself, once `?owner=&slug=` has been resolved (or found absent).
 *
 * Async and therefore only reachable inside the `Suspense` boundary `UploadPage` wraps it
 * in — see that function's own header for why the split exists. One more thing follows
 * from the split, worth recording because it is not obvious from the two files alone:
 * `renderToStaticMarkup` (`tests/server/t263/ac5-retired-copy.test.ts`'s own render
 * technique, over `UploadPage` with no real `searchParams` promise) cannot await this
 * component, and — same as `React.lazy` under that renderer — shows the boundary's
 * fallback instead of crashing on it, which is what keeps that suite collectible.
 */
async function TargetedUploadFlow({
  searchParams,
}: {
  searchParams: PageProps<"/upload">["searchParams"];
}) {
  // `?? {}` guards a call outside a real request — `searchParams` is never actually
  // absent from a live Next request, but the render technique in the header note above
  // passes this component no real promise at all, and an absent record answers "no pin"
  // exactly the way an empty one does rather than throwing on the property read.
  const target = await resolveTarget((await searchParams) ?? {});
  return <UploadFlow example={exampleBundle()} {...(target === undefined ? {} : { target })} />;
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
 *
 * ── `searchParams`, and why the RESOLUTION is split into its own component ──
 * `?owner=&slug=` (T280) pins the wizard to a bundle the reader already owns — `/u/*`'s
 * DraftRow and the blueprint page's "Publish a release" link both build this URL, and
 * resolving it needs a session-derived actor and a `Db` handle, both async. This function
 * itself stays SYNCHRONOUS on purpose, with that work pushed into `TargetedUploadFlow`
 * below and wrapped in `Suspense`: an async default export would make this route
 * per-request either way (the same mechanism `cookies()` opts other routes into
 * elsewhere in this codebase), but everything ABOVE the fold here — the header, the two
 * disclosure paragraphs — needs neither a session nor a database row, and there is no
 * reason to hold it behind a query that only some visits even carry.
 */
export default function UploadPage({ searchParams }: PageProps<"/upload">) {
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
        <Eyebrow>Check it, then publish it</Eyebrow>
        <SectionHeading
          as="h1"
          className="mt-3"
          title="Publish"
          lead="Drop a blueprint folder: the topology.dot graph and the cards it names. This page checks it in your browser: every node has a card, the cards' inputs and outputs line up along each edge, and every term they use is known. Each problem it finds says where and why. Publishing a release needs an account, or a write-scoped API key from your settings."
        />
        {/* ── Where the folder in front of the reader came from ──
            The population arriving here changed. Until now the only person with a bundle
            in hand had downloaded one from `/blueprints` or exported one from `/build`,
            and both of those handed over something finished. `/build` was deleted on
            2026-09-06, which leaves `/blueprints` as the only such source and makes the
            paragraph below more true rather than less. The DarkPrint skill writes the
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
          If your coding agent wrote the folder with the{" "}
          <Link href={SKILL_ROUTE} className={PROSE_LINK}>
            DarkPrint skill
          </Link>
          , drop it in as it is. The DarkPrint skill writes exactly what this page reads, a{" "}
          <span className="font-mono text-cyan">topology.dot</span> and the{" "}
          <span className="font-mono text-cyan">cards/</span> it names, so there is nothing
          to export or convert. You can bring it before it is finished: a graph whose cards
          are half written is checked as far as it goes, and the report says how far.
        </p>
        {/* ── The other folder a reader can arrive with (§11.0 Q20 c) ──
            A person holding an Attractor pipeline was, until now, the one visitor this
            route had nothing for. `importAttractorDot` has been complete and tested for
            releases and its only non-test caller was a CLI whose npm package is
            unpublished, so dropping a `.dot` here produced one `bundle/missing-card` per
            node and advice about an authoring format the reader had not asked about.

            The owner ruled it runs in the browser (2026-09-04): `lib/core` is isomorphic by
            contract, `importAttractorDot` is pure, and this route already resolves whole
            bundles in the tab. So there is no endpoint behind this paragraph and no seam to
            cite, which is why it does not carry a `ComingSoonBadge` the way the sentence
            under it does.

            "offers" and never "converts". `components/upload/AttractorOffer.tsx` shows what
            the import cannot carry across before anything is written, and refuses outright
            when the session has no handle to attribute the cards to. A sentence here
            promising a conversion would describe a button that is deliberately not that. */}
        <p className="mt-5 text-sm leading-relaxed text-muted">
          An Attractor pipeline works here too. Drop its{" "}
          <span className="font-mono text-cyan">.dot</span> and this page offers to read it
          into a draft bundle in your browser, one card per node, attributed to you. Before
          it writes anything it lists what the two formats cannot express in each other.
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
          Not built yet: a live push from the editor the skill runs in. The DarkPrint skill
          writes the folder to your disk, and you bring it here yourself.
        </p>
        {/* The vocabulary asymmetry, moved here from `/what-it-isnt` when that page was
            removed. It is a statement about this page, and it was the only unconditional
            statement of it on the site: `BundleDropzone` says the bundle is read against
            the curated core alone, but only once a dropped bundle has already tripped a
            vocabulary problem, so a reader comparing what a blueprint page says about a
            bundle against what the wizard says never sees it first.

            ── D-263-01: this REMAINED, rewritten, and the premise for deleting it was false ──
            The contract said the divergence "is resolved once the server resolves against
            published overlays". It is not. `app/api/validate/bundle/route.ts` never calls
            `openView`: `validateBundle` falls back to `ontologyView(CORE_ONTOLOGY,
            extensions)`, which is bit-for-bit the vocabulary this tab already builds. What
            the cutover changed is the PUBLISH leg, where `publish.ts` opened the STORED
            ontology at the version the manifest named. So the gap did not close, it moved:
            a bundle can read clean here and be refused at publish, and the reverse. That
            last sentence is still true and its mechanism is not: the version half of this
            paragraph is history, and what separates the two readings today is the overlay
            alone. The 2026-09-04 note below is where that is worked out.

            The client-side pass stays on purpose — the same Contract line says so, and
            `docs/ARCHITECTURE.md` §7 puts the server's authoritative pass at publish time.
            Deleting this sentence on the stated premise would have replaced a true
            disclosure with silence about a divergence that is still there.

            Not folded, and not shortened: two HIGH findings in this project were disclaimers
            going missing while somebody was cutting for pace.

            ── 2026-09-04: the VERSION half of it went, the disclosure did not ──
            Two sentences here made the divergence a version story: the registry resolved
            "against the ontology version the manifest names", and "a bundle pinning an older
            version can be judged on different terms there than here". The owner removed
            ontology versioning outright, and both sentences now describe a mechanism that
            has no parts — a manifest names no version and `lib/server/registry/graphs.ts`
            records that `openView` reaches no store to select one from.

            What is NOT deleted is the last two sentences, and the reason is D-263-01's own:
            the subject decides whether a sentence retires. Their subject is which of the two
            passes is authoritative, and the answer is unchanged. A reader is still owed the
            fact that the check in front of them is the fast one and the publish leg is the
            one that decides. The illustration this note used to carry, `frontline-triage`
            reading 4 here and 2 on its page, went with the number on the page rather than
            with the divergence. */}
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-dim">
          The terms your cards use are checked against DarkPrint&rsquo;s core vocabulary, plus
          any <span className="font-mono text-cyan">ontology/extensions.yaml</span> in the
          folder. When you publish, the registry runs the same check on its side. The reading
          on this page is the quick one. The registry&rsquo;s reading decides.
        </p>
      </header>

      {/* Two facts the lead used to carry about the result, moved to where the result
          appears. Both qualified what the reader is about to look at, which is the one place
          a limit belongs: a graph with a person in it is read, not penalised, and the
          scorecard that came back had four axes nothing could fill.

          The second one is gone since 2026-09-04. It read "Two of the six axes are read off
          the graph. Efficacy, reliability and transparency need votes. Cost and time need a
          run." — and the votes half of it stopped being true when the ballot was deleted
          from the site: `components/bundle/VoteControl.tsx` is not in the tree any more, so
          nothing anywhere collects a vote and a sentence telling a reader three axes are
          waiting for one is describing a queue with no door. It goes rather than gets
          reworded: the axes it counted are still drawn inside the wizard, and rewording it
          into a quieter version of the same promise on the page ABOVE the wizard would put
          the header's name on a claim the header cannot keep.

          `components/upload/UploadFlow.tsx` and `ValidationReport.tsx` said the votes
          sentence beside the result itself until 2026-09-05, when §11.0 Q28 reached them:
          the wizard's "Filled in later" legend keeps its cost/time half whole and has lost
          the three community axes, and the downloadable report no longer counts six of
          anything. Nothing on this route names a ballot now.

          The first sentence stays and is doc 2 §1.1's, which nothing in the scoring removal
          touches: a person standing in the graph is a design decision the analyzer reports
          and never a shortfall it deducts for. That claim is the one this paragraph exists
          to make on the one page where somebody is being asked to hand over their work. */}
      <p className="mt-5 text-sm leading-relaxed text-dim">
        A graph with a human step in it is checked the same way as one without. The report
        names the node where a person acts and treats it as a design choice.
      </p>

      <div className="mt-10">
        <Suspense fallback={<UploadFlowSkeleton />}>
          <TargetedUploadFlow searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
