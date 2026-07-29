import type { Metadata } from "next";
import Link from "next/link";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
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
        eyebrow="MCP access"
        title="Bring blueprints and nodes into your agent"
        lead="Not built yet: this is what setup will look like once the registry has an MCP server to point a client at."
        align="center"
        className="mx-auto"
      />

      <div className="mx-auto mt-4 flex justify-center">
        <ComingSoonBadge />
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <InstallTabs />
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
        Once live, an MCP server here will expose every published blueprint and node card
        as a resource an agent can read directly, from the same registry{" "}
        <Link
          href="/blueprints"
          className="underline decoration-line-bright underline-offset-4 hover:text-fg"
        >
          the gallery
        </Link>{" "}
        already browses by hand.
      </p>
    </div>
  );
}
