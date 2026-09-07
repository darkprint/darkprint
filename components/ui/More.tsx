import { cx } from "@/lib/format";

/* ============================================================
   The support behind something, folded away.

   Redesign spec §4.3 asked `/build` for "one idea per step, with
   the supporting prose behind a disclosure", and the reviewers
   measured that it worked: the visible word count per step fell by
   between 37% and 66% and nothing on the page stopped being true.
   §4.4 asked the same of `/what-it-isnt`, which was then the
   longest page on the site; that route has since been removed
   outright. The climb's four-phase account is in the same position.

   So the device is one component rather than three copies. It was
   written inside `/build`'s own step prose and moved here the
   moment a second page needed it; that route's steps have since
   been deleted and this component outlived them, which is the
   argument for having moved it.

   A native `<details>`, the same disclosure `DiagnosticList`
   already uses, so the whole site opens one the
   same way. It is deliberately not a tab and not a modal: the
   content stays in the document, keyboard reachable, printable,
   searchable by find-in-page, and — the reason it is allowed here
   at all — present in the prerendered HTML, which is the property
   that makes §4.3's cut a cut in density rather than a cut in what
   the page says.
   ============================================================ */

export function More({
  summary,
  children,
  bare = false,
  className,
}: {
  /** What is behind it, said plainly enough that a reader can decide not to open it. */
  summary: string;
  children: React.ReactNode;
  /**
   * Drop the box, and read as a line of text that opens.
   *
   * The bordered form is right where the disclosure is one of several panels on a page
   * and its border is what separates them. It is wrong directly under a paragraph it
   * continues: the author, on the blueprint page's "Read more", said they did not like
   * "how to open the read more and the fact that is in a box". A box there announces a
   * new region and what is behind it is the same paragraph at greater length.
   *
   * Everything else is unchanged. It is the same native `<details>`, so the content is
   * still prerendered, still keyboard-reachable and still found by find-in-page.
   */
  bare?: boolean;
  className?: string;
}) {
  return (
    <details
      className={cx(
        "group",
        bare ? "" : "rounded-lg border border-line bg-surface-2/40 px-4 py-2.5",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-2 text-[13px] text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden py-1 -my-1">
        <span
          className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
          aria-hidden
        >
          ▸
        </span>
        {summary}
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
