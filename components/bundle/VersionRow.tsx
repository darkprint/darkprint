import { Button } from "@/components/ui/Button";

/**
 * The row above the file listing: which snapshot you are looking at, and how many there are.
 *
 * The selector is drawn and switched off. A bundle can carry several real releases now
 * (T280: `listReleases` over `release`, append-only), so "there is exactly one snapshot" is
 * no longer the reason — the reason is that switching the listing and the digest panel to a
 * different release, in place, is designed and not built. A dropdown wired to reload nothing
 * is worse than a control that says so.
 *
 * `Compare with upstream` renders only for a bundle that has one, for the same reason the
 * lineage line does: a control offering to compare a bundle with nothing would make lineage
 * read as a property everything has an answer to.
 */
export function VersionRow({
  version,
  versions,
  changes,
  hasUpstream,
  addressedByDigest = false,
}: {
  version: string;
  versions: number;
  changes: number;
  hasUpstream: boolean;
  /**
   * True for a published bundle, whose "version" IS its digest.
   *
   * The row read `1 version · 0 changes` there, and "0 changes" is not a fact about
   * anything: an archive bundle is one snapshot and there is no earlier one for it to
   * differ from. It says what is actually true instead.
   */
  addressedByDigest?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        variant="outline"
        disabled
        title="Choosing between versions in place is designed, not built."
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
          version
        </span>
        <span className="font-mono text-sm text-fg">{version}</span>
        <span aria-hidden className="text-dim">
          ▾
        </span>
      </Button>

      <span className="font-mono text-[11px] text-dim">
        {addressedByDigest ? (
          <>
            addressed by digest · {versions} release{versions === 1 ? "" : "s"}
          </>
        ) : (
          <>
            {versions} version{versions === 1 ? "" : "s"} · {changes} change
            {changes === 1 ? "" : "s"}
          </>
        )}
      </span>

      {hasUpstream && (
        <Button
          variant="outline"
          disabled
          className="ml-auto"
          title="Comparing two bundles by digest is designed, not built."
        >
          Compare with upstream
        </Button>
      )}
    </div>
  );
}
