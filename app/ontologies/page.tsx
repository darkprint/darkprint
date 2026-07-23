import type { Metadata } from "next";
import { ONTOLOGIES } from "@/lib/data";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContentCard } from "@/components/ui/ContentCard";

export const metadata: Metadata = {
  title: "Ontologies",
  description:
    "Typed vocabularies of node and edge kinds for encoding a dark factory as a graph — the shared schemas DarkPrint's analyzers read to grade autonomy, trust and cost.",
};

export default function OntologiesPage() {
  return (
    <div className="container-page py-12">
      <SectionHeading
        eyebrow="Typed graph vocabularies"
        title="Ontologies"
        lead="The typed node and edge kinds that let a factory be encoded — and read — as a graph. Type a blueprint against one and its structure becomes machine-checkable: this is what the static analyzers consult to grade autonomy, security and cost without running anything."
      />

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ONTOLOGIES.map((ontology) => (
          <ContentCard key={ontology.slug} item={ontology} />
        ))}
      </div>
    </div>
  );
}
