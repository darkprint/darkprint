import { SourcePanel } from "@/components/ui/SourcePanel";

/**
 * Collapsible DOT-source panel. A thin skin over `SourcePanel` — the generic one
 * owns the copy button, the line numbers and the scroll container; this fixes the
 * language so the schematic pages read the way they always have.
 */
export function DotSource({
  dot,
  defaultOpen = false,
  className,
}: {
  dot: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <SourcePanel
      source={dot}
      language="DOT"
      title="DOT source"
      collapsible
      defaultOpen={defaultOpen}
      className={className}
    />
  );
}
