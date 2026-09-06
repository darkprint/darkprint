import Link from "next/link";
import type { Author } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";
import { BundleHeader } from "@/components/bundle/BundleHeader";
import { VisibilitySwitch } from "@/components/bundle/Aside";
import { ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

/* ============================================================
   The draft branch of `/blueprints/[owner]/[slug]`: a bundle with an
   account and a name and no release yet — GitHub's empty-repo screen,
   applied to `draftBundle()` (0007_drafts, T280). The page mounts this
   INSTEAD of the published-bundle render when `blueprint()` answers
   undefined and `draftBundle()` answers something (B-03: the same
   "absent or unreadable, either way" collapse every other reader here
   makes).

   `BundleHeader` at the top for the same reason the published branch
   uses it — one identity band for a bundle seen from any side — with
   no `download` (there is no release to fetch, and the band's `note`
   says so where the control would have been) and no `star`/`fork` (a
   target nothing has released is not a thing this pass wires either
   of those onto; `lib/server/counters` keys targets by kind, and
   "blueprint" targets a released bundle's row by convention here).

   THE VISIBILITY SWITCH STAYS HERE, and it is the one route that
   still draws one. The owner took it off the published page on
   2026-09-06 and put it on the account's blueprint list instead; a
   draft is on that list too, so this mount is redundant the day the
   list grows one. It is kept until then rather than after, because
   removing it first would leave a bundle created through `/new` with
   no way at all to be made public.
   ============================================================ */

export interface DraftLandingBundle {
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
  title?: string;
  summary?: string;
  description?: string;
  createdAt: string;
}

/* D-270-07's ruled spelling. The CLI is not on npm (T270 todo), and the line below says
   so where it renders — the same preview-not-control stance CloneMenu holds on the
   published branch. */
const cloneCommand = (owner: string, slug: string) => `darkprint clone ${owner}/${slug}`;

export function DraftLanding({
  draft,
  owner,
  isOwner,
  visibilityApi,
}: {
  draft: DraftLandingBundle;
  owner: Author;
  /** Whether the current actor holds this bundle — gates the visibility switch alone. */
  isOwner: boolean;
  /** `/api/bundles/{owner}/{slug}/visibility`. Present only when `isOwner`. */
  visibilityApi?: string;
}) {
  const uploadHref = `/upload?owner=${encodeURIComponent(draft.ownerHandle)}&slug=${encodeURIComponent(draft.slug)}`;

  return (
    <>
      <BundleHeader
        owner={owner}
        slug={draft.slug}
        visibility={draft.visibility}
        title={draft.title ?? draft.slug}
        summary={draft.summary ?? "No summary yet."}
        forks={0}
        saveId={`blueprint:${draft.slug}`}
        note="no release yet: this bundle has an owner and a name, and nothing published under them"
        breadcrumb={
          <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
            <Link href="/blueprints" className="transition-colors hover:text-cyan">
              ← Blueprints
            </Link>
          </nav>
        }
        below={
          <span className="font-mono text-[11px] text-dim">
            created {prettyDate(draft.createdAt.slice(0, 10))} · 0 releases
          </span>
        }
      />

      <div className="container-page flex flex-col gap-8 py-10 lg:py-12">
        {draft.description !== undefined && draft.description.trim() !== "" && (
          <p className="max-w-none text-[15px] leading-relaxed text-muted">{draft.description}</p>
        )}

        {isOwner ? (
          <>
            {/* ---------- Quick setup, the GitHub empty-repo panel ----------
                Three ways in, same as a fresh repository offers: push a release from the
                wizard, point the blueprint-writing skill at this exact draft (its install
                command needs a public repository, and each caveat below says which limit
                it is stating), or clone the bundle by name (a preview until the CLI
                ships). None of them is a fallback for another. Owner-only: the
                upload wizard's own prefill only pins a bundle the session owns (B6's
                contract), so offering this call to action to a visitor would point them at
                a form that refuses them the moment they submit it. */}
            <section className="panel flex flex-col gap-6 p-6">
              <div>
                <span className="label">Quick setup</span>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  This bundle exists and nobody can fetch it yet: there is no release.
                  Publish one from the upload wizard, pinned to this exact draft.
                </p>
              </div>

              <ButtonLink href={uploadHref} className="self-start">
                Publish your first release
              </ButtonLink>

              <div className="border-t border-line pt-5">
                <p className="text-sm leading-relaxed text-muted">
                  Or point the{" "}
                  <Link
                    href={SKILL_ROUTE}
                    className="text-cyan underline decoration-cyan/40 underline-offset-4"
                  >
                    blueprint-writing skill
                  </Link>{" "}
                  at your own goal and let your agent draft the graph before you publish it
                  here:
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-void px-3 py-2">
                  <code className="flex-1 overflow-x-auto font-mono text-[12px] text-fg">
                    {SKILL_INSTALL_COMMAND}
                  </code>
                  <CopyButton text={SKILL_INSTALL_COMMAND} ariaLabel="Copy the skill install command" />
                </div>
                {/* The same shape, tone and position the clone command's caveat uses below,
                    because it is the same kind of claim: a line printed as a control that
                    is not one yet. Added 2026-09-05 on the owner's ruling (§11.0 Q8), and
                    `lib/skill.ts`'s header holds the measurement.

                    The two limits are NOT the same fact and the wording keeps them apart.
                    The CLI below does not exist yet; the DarkPrint skill does, and what
                    blocks it is read access to the repository the skills CLI fetches it
                    from. Saying "not built" here would be a different false claim from the
                    one it replaced. Deleting this paragraph is this file's whole undo. */}
                <p className="mt-2 text-xs leading-relaxed text-dim">
                  Not runnable yet. DarkPrint&rsquo;s repository is private, so the line
                  above answers 404 for everyone but its owner. The blueprint-writing skill
                  it fetches is written; what is missing is read access to it.
                </p>
              </div>

              <div className="border-t border-line pt-5">
                <p className="text-sm leading-relaxed text-muted">
                  Or clone it onto your own disk, the way you would a repository:
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-void px-3 py-2">
                  <code className="flex-1 overflow-x-auto font-mono text-[12px] text-fg">
                    {cloneCommand(draft.ownerHandle, draft.slug)}
                  </code>
                  <CopyButton
                    text={cloneCommand(draft.ownerHandle, draft.slug)}
                    ariaLabel="Copy the clone command"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-dim">
                  Not built yet. The darkprint CLI is not on npm, so the line above is a
                  preview, not a command. Once it ships, it will fetch this bundle by
                  name. There is no release yet, so it can only bring down the name and
                  the folder to fill.
                </p>
              </div>
            </section>

            {visibilityApi !== undefined && (
              <div className="max-w-md">
                <VisibilitySwitch visibility={draft.visibility} live={{ api: visibilityApi }} />
              </div>
            )}
          </>
        ) : (
          <section className="panel p-6">
            <p className="text-sm leading-relaxed text-muted">
              This blueprint has an owner and a name, and nothing has been published under
              them yet.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
