import Link from "next/link";

import { cx } from "@/lib/format";

export interface PageContentsItem {
  href: `#${string}`;
  label: string;
  meta?: string;
}

/** A compact scan map for long reference and artifact pages. */
export function PageContents({
  items,
  label = "On this page",
  className,
  desktopColumns = 3,
}: {
  items: readonly PageContentsItem[];
  label?: string;
  className?: string;
  desktopColumns?: 2 | 3 | 4;
}) {
  const desktopGrid = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  }[desktopColumns];

  return (
    <nav
      aria-label={label}
      className={cx(
        "overflow-hidden rounded-lg border border-line bg-surface/65",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <span className="label-lead">{label}</span>
        <span className="label">
          {items.length} section{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <ol className={cx("grid sm:grid-cols-2", desktopGrid)}>
        {items.map((item, index) => (
          <li key={item.href} className="border-t border-line first:border-t-0 sm:border-t-0">
            <Link
              href={item.href}
              className="group flex min-h-12 items-baseline gap-3 px-4 py-3 transition-colors hoverable:hover:bg-surface-2/70"
            >
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-cyan">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-sm font-medium text-fg transition-colors hoverable:group-hover:text-cyan">
                {item.label}
              </span>
              {item.meta !== undefined && (
                <span className="ml-auto shrink-0 font-mono text-[11px] text-dim">
                  {item.meta}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
