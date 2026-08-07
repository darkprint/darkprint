import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { InstallTabs } from "@/components/install/InstallTabs";

export const metadata: Metadata = {
  title: "Install",
  description:
    "How an agent will connect to the DarkPrint registry over MCP, once the server exists. Not built yet: nothing here runs.",
};

export default function InstallPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <SectionHeading
        as="h1"
        eyebrow="MCP access"
        title="Bring blueprints and nodes into your agent"
        lead="Not built yet: this is what setup will look like once the registry has an MCP server to point a client at."
        align="center"
        className="mx-auto"
      />

      {/* A second `ComingSoonBadge` floated here, under a lead that already opens "Not
          built yet". Two markers on one screen for one fact is the repetition the author
          asked off the site, and this was the one qualifying nothing in particular. The
          badge that stays is in `InstallTabs`, attached to the configuration snippet,
          which is the thing on this page a reader would otherwise copy into a client and
          expect to work. The lead sentence and `metadata.description` are both pinned in
          `components/site/honesty.test.ts` and are untouched. */}

      <div className="mx-auto mt-10 max-w-2xl">
        <InstallTabs />
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
        An MCP server here will expose every published blueprint and node card as a
        resource an agent can read directly, from the same registry{" "}
        <Link
          href="/blueprints"
          className="underline decoration-line-bright underline-offset-4 hover:text-fg"
        >
          the gallery
        </Link>{" "}
        already browses by hand.
      </p>

      {/* No tail navigation here, and that is the instruction. The author, 2026-08-07,
          after asking for the onward boxes on `/build` to read as controls: "We found
          such buttons also in the install mcp page. in this page you can just delete
          them."

          What goes with them: this page's only link to `/build`, and one of its two
          links to `/blueprints`. The inline "the gallery" link in the paragraph above
          survives, so the page is not a dead end — it ends on a sentence that offers the
          one destination worth offering from a page about a server that does not exist
          yet. `components/ui/OnwardRoutes.tsx` was written on the premise that `/install`
          carried no `.route-box`; its docblock now records that this is deliberate rather
          than the defect it used to be. The lead sentence and `metadata.description`,
          both pinned in `components/site/honesty.test.ts`, are untouched. */}
    </div>
  );
}
