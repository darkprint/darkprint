import { Hero } from "@/components/hero/Hero";
import {
  SectionWhat,
  SectionContent,
  SectionScoring,
  SectionAutonomy,
  SectionSeed,
  SectionTelemetry,
  SectionCTA,
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      <Hero />
      <SectionWhat />
      <SectionContent />
      <SectionScoring />
      <SectionAutonomy />
      <SectionSeed />
      <SectionTelemetry />
      <SectionCTA />
    </>
  );
}
