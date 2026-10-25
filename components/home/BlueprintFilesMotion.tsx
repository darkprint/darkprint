"use client";

import type { ReactNode } from "react";

import { useReveal } from "@/components/viz/useReveal";

export function BlueprintFilesMotion({ children, className }: { children: ReactNode; className: string }) {
  const { ref, phase } = useReveal<HTMLDivElement>({ amount: 0.2 });

  return (
    <div ref={ref} className={className} data-blueprint-motion={phase === "shown" ? "playing" : undefined}>
      {children}
    </div>
  );
}
