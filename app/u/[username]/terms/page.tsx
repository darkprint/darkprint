import Link from "next/link";
import { notFound } from "next/navigation";

import { termHref } from "@/lib/href";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { EmptyState } from "@/components/profile/parts";
import { profileMetadata, profileView } from "@/components/profile/load";
import { readSession } from "@/components/profile/session";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-60) (cited at line 42): GET /api/authors/{handle}/terms

/* ============================================================
   /u/[username]/terms — the vocabulary this handle added.

   Ownership is read off the id and not out of a field, because a term has no author field:
   doc 3 §7 namespaces a local term with the handle that minted it (`lupo/pii-handling`), so
   the prefix *is* the claim. That is also why the count is honest at zero for most handles
   — the curated core belongs to nobody, and adding to it is rare on purpose.
   ============================================================ */

/* No `dynamicParams` and no `generateStaticParams`, and the deletion is the criterion
   rather than tidying: **a prerendered page cannot render a different view per reader**
   (AC1, D-262-11). Both stood on `AUTHOR_LIST`, a fixed fixture list, which could not
   have served a registry that grows between deploys either. `readSession` reaches
   `next/headers`, so these routes are request-time by construction now. */

export async function generateMetadata({ params }: PageProps<"/u/[username]/terms">) {
  const { username } = await params;
  const author = await profileMetadata(username);
  if (author === undefined) return { title: "Builder not found" };
  return {
    title: `${author.displayName} · vocabulary terms`,
    description: `Local vocabulary terms namespaced under ${username}.`,
  };
}

export default async function Page({ params }: PageProps<"/u/[username]/terms">) {
  const { username } = await params;
  const view = await profileView(username, await readSession());
  if (view === undefined) notFound();

  return (
    <ProfileShell view={view} active="terms">
      {view.terms.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No terms under this handle"
            action={{ href: "/ontology", label: "Read the core vocabulary" }}
          >
            The curated core belongs to nobody. A term appears here only when this handle
            has minted one in its own namespace. The resolver requires that minted term to
            hang off a core term.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-10 overflow-hidden rounded-xl border border-line bg-surface">
          {view.terms.map((term) => (
            <li
              key={term.id}
              className="flex flex-col gap-2 border-b border-line p-5 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={termHref(term.id)}
                  className="font-mono text-[13px] text-cyan transition-colors hoverable:hover:text-cyan-bright"
                >
                  {term.id}
                </Link>
                <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-dim">
                  {term.kind}
                </span>
                {term.defaultWeight !== undefined && (
                  <span className="font-mono text-[11px] text-dim">
                    weight {term.defaultWeight}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-muted">{term.description}</p>
              {term.broader !== undefined && (
                <p className="font-mono text-[11px] text-dim">
                  broader{" "}
                  <Link
                    href={termHref(term.broader)}
                    className="text-muted transition-colors hoverable:hover:text-cyan"
                  >
                    {term.broader}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </ProfileShell>
  );
}
