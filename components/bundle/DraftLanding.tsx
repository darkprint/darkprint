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
   no `clone` (there is no folder yet, so `Get the folder` draws its
   own honest disabled state) and no `star`/`watch`/`fork` (a target
   nothing has released is not a thing this pass wires either of
   those onto; `lib/server/counters` keys targets by kind, and
   "blueprint" targets a released bundle's row by convention here).
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

const STARTER_LAYOUT = (slug: string) =>
  [
    `${slug}/`,
    "├── blueprint.dot        # the topology: agents, tools, and how they hand off",
    "├── AGENTS.md             # per-node prompts your runner reads",
    "├── README.md             # what this blueprint does and how to run it",
    "└── cards/",
    "    └── <node-id>.yaml    # one card per node named in blueprint.dot",
  ].join("\n");

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
        watchers={0}
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
                wizard, point the skill at this exact draft, or take a starter folder and
                wire it up by hand. None of them is a fallback for another. Owner-only: the
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
              </div>

              <div className="border-t border-line pt-5">
                <p className="text-sm leading-relaxed text-muted">
                  Or start from a folder on your own disk, in the shape a release takes here:
                </p>
                <div className="mt-2 flex items-start gap-2 rounded-md border border-line bg-void px-3 py-2.5">
                  <pre className="flex-1 overflow-x-auto font-mono text-[12px] leading-relaxed text-fg">
                    {STARTER_LAYOUT(draft.slug)}
                  </pre>
                  <CopyButton
                    text={STARTER_LAYOUT(draft.slug)}
                    ariaLabel="Copy the starter folder layout"
                    className="mt-0.5"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-dim">
                  A layout to copy, not a download: there is no chosen example behind this
                  draft for a zip to come from. <code className="text-fg">AGENTS.md</code>{" "}
                  and the vocabulary file are the two a release adds beyond what you write by
                  hand.
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
