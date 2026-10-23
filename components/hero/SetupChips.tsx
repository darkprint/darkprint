import { ButtonLink } from "@/components/ui/Button";

export function SetupChips() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <ButtonLink data-setup="browse" href="/blueprints" size="lg">
        Browse blueprints
      </ButtonLink>
      <ButtonLink data-setup="connect" href="/mcp" variant="outline" size="lg">
        Connect your agent
      </ButtonLink>
    </div>
  );
}
