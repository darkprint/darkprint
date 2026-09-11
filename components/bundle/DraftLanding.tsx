import Link from "next/link";
import type { Author } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import {
  CLAUDE_CODE_SKILLS_PARENT,
  SKILL_ARCHIVE_ROOT,
  SKILL_INSTALL_COMMAND,
  SKILL_ROUTE,
} from "@/lib/skill";
import { BundleHeader } from "@/components/bundle/BundleHeader";
import { ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

/* ============================================================
   The draft branch of `/blueprints/[owner]/[slug]`: a bundle with an
   account and a name and no release yet, the empty-repository screen
   applied to `draftBundle()`. The page mounts this instead of the
   published-bundle render when `blueprint()` answers undefined and
   `draftBundle()` answers something, the same "absent or unreadable,
   either way" collapse every other reader here makes.

   `BundleHeader` at the top for the same reason the published branch
   uses it, one identity band for a bundle seen from any side, with no
   `download` (there is no release to fetch, and the band's `note` says
   so where the control would have been) and no `star`/`fork` (a target
   nothing has released is not a thing either of those is wired onto).

   No visibility switch. The owner ruled that control belongs on the
   blueprint list of the owner's profile and nowhere else, and a draft
   is on that list too (`components/profile/OwnedBundles.tsx`).
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

/* The CLI's own grammar, spelled once so the printed line and the copy button cannot drift. */
const cloneCommand = (owner: string, slug: string) => `npx -y darkprint clone ${owner}/${slug}`;

export function DraftLanding({
  draft,
  owner,
  isOwner,
}: {
  draft: DraftLandingBundle;
  owner: Author;
  /** Whether the current actor holds this bundle, which gates the quick-setup panel. */
  isOwner: boolean;
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
          /* ---------- Quick setup, the empty-repository panel ----------
             Three ways in, same as a fresh repository offers: push a release from the
             wizard, install the DarkPrint skill and let it draft the graph, or clone the
             bundle by name. None of them is a fallback for another. Owner-only: the upload
             wizard's own prefill only pins a bundle the session owns, so offering this call
             to action to a visitor would point them at a form that refuses them the moment
             they submit it. */
          <section className="panel flex flex-col gap-6 p-6">
            <div>
              <span className="label">Quick setup</span>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Nobody can fetch this bundle yet. Publish a release from the upload
                wizard, pinned to this exact draft.
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
                  DarkPrint skill
                </Link>{" "}
                at your own goal and let your agent draft the graph before you publish it
                here. The line has npx fetch the darkprint package from npm and copy the
                DarkPrint skill into{" "}
                <code className="font-mono text-[12px] text-fg">
                  {CLAUDE_CODE_SKILLS_PARENT}/{SKILL_ARCHIVE_ROOT}
                </code>
                ; nothing else is installed and no account is created. Its page has the
                Codex form:
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-void px-3 py-2">
                <code className="flex-1 overflow-x-auto font-mono text-[12px] text-fg">
                  {SKILL_INSTALL_COMMAND}
                </code>
                <CopyButton text={SKILL_INSTALL_COMMAND} ariaLabel="Copy the DarkPrint skill install command" />
              </div>
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
                There is no release yet, so the command has nothing to fetch until you
                publish one.
              </p>
            </div>
          </section>
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
