import { ChoiceCard } from "darkprint";

/** The pair as AccountForm composes it: one selected, one not, in one radio group. */
export const VisibilityChoice = () => (
  <div className="flex flex-col gap-3">
    <ChoiceCard
      name="default-visibility"
      id="visibility-private"
      title="Private"
      aside="recommended"
      selected
      onSelect={() => {}}
    >
      A new bundle is yours until you decide otherwise. It is listed on your profile only after you publish it.
    </ChoiceCard>
    <ChoiceCard
      name="default-visibility"
      id="visibility-public"
      title="Public"
      selected={false}
      onSelect={() => {}}
    >
      Every bundle you create is listed in the registry as soon as it validates.
    </ChoiceCard>
  </div>
);
