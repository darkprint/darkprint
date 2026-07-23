import { notFound } from "next/navigation";
import type { AnyContent, ContentKind } from "@/lib/types";
import {
  AUTHOR_LIST,
  getAuthor,
  contentByAuthor,
} from "@/lib/data";
import { compact } from "@/lib/format";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { Stat } from "@/components/ui/Stat";
import { ContentCard } from "@/components/ui/ContentCard";
import { ButtonLink } from "@/components/ui/Button";

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return { title: author.displayName, description: author.bio };
}

const SECTIONS: { kind: ContentKind; label: string; dot: string }[] = [
  { kind: "blueprint", label: "Blueprints", dot: "var(--color-cyan)" },
  { kind: "part", label: "Parts", dot: "var(--color-amber)" },
  { kind: "ontology", label: "Ontologies", dot: "var(--color-violet)" },
];

function ContentSection({
  label,
  dot,
  items,
}: {
  label: string;
  dot: string;
  items: AnyContent[];
}) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-fg">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: dot }}
          aria-hidden
        />
        {label}
        <span className="font-mono text-sm font-normal text-dim">
          {items.length}
        </span>
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ContentCard key={`${item.kind}-${item.slug}`} item={item} />
        ))}
      </div>
    </section>
  );
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) notFound();

  const content = contentByAuthor(username);
  const totalDownloads = content.reduce((n, c) => n + c.downloads, 0);

  return (
    <div className="container-page py-12">
      <ProfileHeader author={author} />

      {/* Summary stats */}
      <div className="mt-6 grid grid-cols-2 gap-6 rounded-xl border border-line bg-surface-2 p-6 sm:grid-cols-4 sm:gap-8">
        <Stat value={content.length} label="Uploads" />
        <Stat
          value={compact(totalDownloads)}
          label="Downloads"
          accent="var(--color-emerald)"
        />
        <Stat
          value={compact(author.reputation)}
          label="Reputation"
          accent="var(--color-violet)"
        />
        <Stat
          value={author.validator ? "Yes" : "No"}
          label="Validator"
          accent={
            author.validator ? "var(--color-cyan)" : "var(--color-dim)"
          }
        />
      </div>

      {/* Published content */}
      <div className="mt-14 flex flex-col gap-14">
        {content.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
            <p className="font-display text-lg text-fg">Nothing published yet</p>
            <p className="max-w-md text-sm text-muted">
              {author.displayName} hasn&apos;t shared any blueprints, parts or
              ontologies with the registry so far.
            </p>
            <ButtonLink href="/gallery" variant="outline" size="sm">
              Browse the registry
            </ButtonLink>
          </div>
        ) : (
          SECTIONS.map(({ kind, label, dot }) => {
            const items = content.filter((c) => c.kind === kind);
            if (items.length === 0) return null;
            return (
              <ContentSection
                key={kind}
                label={label}
                dot={dot}
                items={items}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
