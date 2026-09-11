import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* One page for every missing address: unknown URLs and every `notFound()` a route throws.
   It names the three shapes an address takes here, because most dead links are one of them
   spelled wrongly, and it offers the three places a reader most likely wanted. */

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container-page flex flex-col gap-8 py-16 sm:py-20">
      <SectionHeading as="h1" eyebrow="404" title="Page not found" />
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted">
          There is nothing at this address. Blueprints live at{" "}
          <code className="font-mono text-[13px] text-fg">/blueprints/{"{owner}"}/{"{slug}"}</code>,
          cards at <code className="font-mono text-[13px] text-fg">/nodes/{"{id}"}</code>, and
          profiles at <code className="font-mono text-[13px] text-fg">/u/{"{handle}"}</code>.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          If you followed a link from inside DarkPrint, what it pointed at may have moved,
          been deleted or been made private.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <ButtonLink href="/blueprints">Browse blueprints</ButtonLink>
          <ButtonLink href="/nodes" variant="outline">
            Browse cards
          </ButtonLink>
          <ButtonLink href="/spec/card" variant="outline">
            Read the spec
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
