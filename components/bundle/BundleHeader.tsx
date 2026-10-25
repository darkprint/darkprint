import Link from "next/link";
import styles from "@/components/ui/DetailPage.module.css";

import type { Lineage } from "@/lib/data/bundles";
import type { Author } from "@/lib/types";
import { ActionPill } from "@/components/ui/ActionPill";
import { Avatar } from "@/components/ui/Avatar";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { MetaPill } from "@/components/ui/MetaPill";
import { ForkButton } from "@/components/bundle/ForkButton";
import { blueprintHref } from "@/lib/href";

export function BundleHeader({
  owner,
  slug,
  visibility,
  summary,
  lineage,
  driftNote,
  forks,
  saveId,
  breadcrumb,
  title,
  validator = false,
  below,
  note,
  children,
  star,
  fork,
  download,
  identityMeta,
}: {
  owner: Author;
  slug: string;

  visibility?: "public" | "private";
  summary: string;
  lineage?: Lineage;

  driftNote?: string;
  forks: number;

  saveId: string;

  breadcrumb?: React.ReactNode;

  title?: string;

  validator?: boolean;

  below?: React.ReactNode;

  note?: string;

  children?: React.ReactNode;

  star?: { api: string; count: number; starred: boolean; signedIn: boolean };

  fork?: { api: string; sourceVersion: string; signedIn: boolean; viewerHandle?: string };

  download?: React.ReactNode;

  identityMeta?: React.ReactNode;
}) {
  return (
    <header className="border-b border-blue-rule bg-surface">
      <div className={`container-page ${styles.header}`}>
        {breadcrumb !== undefined && <div className={styles.breadcrumb}>{breadcrumb}</div>}
        <div className={styles.identity}>
          <Avatar author={owner} size="sm" link />
          <Link href={`/u/${owner.username}`} className="text-cyan hoverable:hover:underline">{owner.username}</Link>
          <span aria-hidden className="text-faint">/</span>
          <span className="min-w-0 break-words text-fg">{slug}</span>
          {visibility !== undefined && <MetaPill tone="surface">{visibility === "private" ? "Private" : "Public"}</MetaPill>}
          {lineage !== undefined && <MetaPill>forked</MetaPill>}
          {identityMeta}
          {validator && <span className="text-cyan">✦ validator</span>}
        </div>
        {title !== undefined && <h1 className={styles.title}>{title}</h1>}
        <p className={styles.summary}>{summary}</p>
        <div className={styles.actions}>
          {star !== undefined ? <FavoriteStar id={saveId} star={star} /> : <ActionPill glyph="star" label="Star" count={0} disabled title="Nothing stores a star for this blueprint yet." />}
          {fork === undefined ? <ActionPill glyph="fork" label="Fork" count={forks} disabled title="Nothing copies this blueprint into an account yet. Download the folder beside this instead." /> : <ForkButton api={fork.api} sourceVersion={fork.sourceVersion} signedIn={fork.signedIn} viewerHandle={fork.viewerHandle} forks={forks} />}
          {download}
        </div>
        <div className={styles.meta}>
          {below}
          {note !== undefined && <span>{note}</span>}
          {lineage !== undefined && <span className="font-mono">forked from <Link href={blueprintHref(lineage.owner, lineage.slug)} className="text-cyan hoverable:hover:underline">{lineage.owner} / {lineage.slug}</Link> at {lineage.version}{driftNote !== undefined && <span className="text-amber"> · {driftNote}</span>}</span>}
          {children}
        </div>
      </div>
    </header>
  );
}
