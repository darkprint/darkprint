import type { Metadata } from "next";
import { Eyebrow, SectionHeading } from "@/components/ui/SectionHeading";
import { UploadFlow } from "@/components/upload/UploadFlow";

export const metadata: Metadata = {
  title: "Share a blueprint",
  description:
    "Upload the DOT graph of your dark factory. DarkPrint parses it, scores its autonomy and security by static analysis, and publishes it to the registry.",
};

export default function UploadPage() {
  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <Eyebrow>Contribute</Eyebrow>
        <SectionHeading
          className="mt-3"
          title="Share a blueprint"
          lead="Upload the DOT graph of your dark factory. DarkPrint parses the schematic, then statically analyses it to score autonomy and security automatically — no forms to guess your way through. Efficacy, reliability and transparency come later from community votes; cost and time are measured on the first real run."
        />
      </header>

      <div className="mt-10">
        <UploadFlow />
      </div>
    </div>
  );
}
