import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLiveToken } from "@/lib/core/tutorial/live";
import { LiveBoard } from "@/components/tutorial-live/LiveBoard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   /tutorial/live/[token]: the page the blueprint-writing skill
   posts a draft to while it interviews the reader.

   A shell. The token is checked here so a malformed address is a
   404 before any script runs, and everything that moves is
   `LiveBoard`, which polls the record in the browser and draws
   whatever the engine can resolve from it. Not a stop in the Learn
   sequence: a reader arrives from their own tutorial session and
   leaves by the link back to it.
   ============================================================ */

export const metadata: Metadata = {
  title: "Your blueprint, live",
  description:
    "The draft your agent is writing, drawn as a graph while the interview runs. Nothing on this page runs it.",
  // Every token is one reader's session, so none of these pages belongs in an index.
  robots: { index: false, follow: false },
};

export default async function LivePage({ params }: PageProps<"/tutorial/live/[token]">) {
  const { token } = await params;
  if (!isLiveToken(token)) notFound();

  return (
    <div className="container-page flex flex-col gap-10 py-16 sm:py-20">
      <div className="flex flex-col gap-6">
        <nav className="font-mono text-xs text-dim" aria-label="Breadcrumb">
          <Link href="/tutorial" className="transition-colors hover:text-cyan">
            ← Back to the tutorial
          </Link>
        </nav>
        <SectionHeading
          as="h1"
          eyebrow="Live"
          title="Your blueprint, live"
          lead="Your agent posts the draft here after every phase of the interview, and the page draws the graph as it takes shape. When the folder is written, the next step is here too."
        />
      </div>
      <LiveBoard token={token} />
    </div>
  );
}
