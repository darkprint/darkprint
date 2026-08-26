import { ButtonLink } from "darkprint";

/** The primary variant axis: `ProfileHeader`'s "New blueprint" and "Settings" pair, plus ghost. */
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <ButtonLink href="/new" variant="primary">
      New blueprint
    </ButtonLink>
    <ButtonLink href="/settings" variant="outline">
      Settings
    </ButtonLink>
    <ButtonLink href="/welcome" variant="ghost">
      Sign in
    </ButtonLink>
  </div>
);

/** Same link, three heights: the site's own `sm`/`md`/`lg` scale. */
export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <ButtonLink href="/welcome" variant="outline" size="sm">
      Sign in
    </ButtonLink>
    <ButtonLink href="/welcome" variant="outline" size="md">
      Sign in
    </ButtonLink>
    <ButtonLink href="/welcome" variant="outline" size="lg">
      Sign in
    </ButtonLink>
  </div>
);
