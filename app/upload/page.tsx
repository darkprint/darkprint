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
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { guideStyles as guide } from "@/components/ui/Guide";
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
  "text-fg underline decoration-line-bright underline-offset-4 transition-colors hoverable:hover:text-cyan";

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
     dropped for pace is the divergence between the reading taken here and the registry's
     own, and the sentence naming the other door: the DarkPrint skill publishes the folder
     from the terminal it runs in.
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
  const params = (await searchParams) ?? {};
  const target = await resolveTarget(params);
  /* `?kind=` is read but never trusted: it seeds the picker and nothing else, so an
     unknown value opens the ordinary Blueprint kind rather than a state the flow has no
     step for. */
  const asked = firstString(params, "kind");
  const initialKind = asked === "node" || asked === "ontology" || asked === "blueprint" ? asked : undefined;
  return (
    <UploadFlow
      example={exampleBundle()}
      {...(target === undefined ? {} : { target })}
      {...(initialKind === undefined ? {} : { initialKind })}
    />
  );
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
    <div className={`${guide.page} container-page py-16 sm:py-20`}>
      <header>
        <Eyebrow>Check your files</Eyebrow>
        <SectionHeading as="h1" className="mt-3" title="Publish" lead="Check a blueprint folder or a node card, then publish it to the registry. Publishing needs an account." />
      </header>

      <div className="mt-10">
        <Suspense fallback={<UploadFlowSkeleton />}>
          <TargetedUploadFlow searchParams={searchParams} />
        </Suspense>
      </div>

      <section className={`${guide.panel} mt-8 flex flex-col gap-4`} aria-labelledby="about-checks">
        <h2 id="about-checks" className="font-display text-xl font-semibold text-fg">About these checks</h2>
        <p className={guide.prose}>
          A blueprint folder contains <code>topology.dot</code> and the <code>cards/</code> it pins.
          Folders from the registry or the <Link href={SKILL_ROUTE} className={PROSE_LINK}>DarkPrint skill</Link> work as they are.
          Unfinished folders are checked as far as their files allow.
        </p>
        <p className={guide.prose}>
          The terms your cards use are checked against DarkPrint’s core vocabulary, plus any <code>ontology/extensions.yaml</code> in the folder.
          When you publish, the registry checks the submitted files again. The registry’s reading decides.
        </p>
        <p className={guide.prose}>
          A graph with a human step in it is checked the same way as one without. The report names the node where a person acts and treats it as a design choice.
        </p>
        <p className={guide.prose}>
          An Attractor pipeline works here too. Drop its <code>.dot</code> file to create a draft bundle in your browser.
          Before importing, the page lists what cannot be carried across. Imported cards are attributed to your handle.
        </p>
        <p className={guide.prose}>
          The DarkPrint skill ends with a publish command for the terminal it runs in, using a write-scoped API key from your settings.
          You can also publish from this page.
        </p>
      </section>
    </div>
  );
}
