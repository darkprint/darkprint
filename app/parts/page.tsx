import type { Metadata } from "next";
import { PARTS } from "@/lib/data";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContentCard } from "@/components/ui/ContentCard";

export const metadata: Metadata = {
  title: "Parts",
  description:
    "Reusable sub-graphs — retry, validation, negotiation and routing primitives you drop into a dark factory like npm packages for orchestration logic.",
};

export default function PartsPage() {
  return (
    <div className="container-page py-12">
      <SectionHeading
        eyebrow="Reusable sub-graphs"
        title="Parts"
        lead="Orchestration primitives you drop into a factory like npm packages — a bounded retry, a schema gate, a weighted vote. Import the sub-graph, wire its typed inputs and outputs, and inherit behaviour that has already been graded on other builders' runs."
      />

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PARTS.map((part) => (
          <ContentCard key={part.slug} item={part} />
        ))}
      </div>
    </div>
  );
}
