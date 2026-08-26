import { Button } from "darkprint";

/** The three variants at the default size. Primary is the one call to action per screen. */
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">Fork this blueprint</Button>
    <Button variant="outline">Download bundle</Button>
    <Button variant="ghost">Cancel</Button>
  </div>
);

/** The size scale, on the variant that carries it most often across the site. */
export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="sm" variant="outline">
      Watch
    </Button>
    <Button size="md">Save changes</Button>
    <Button size="lg">Create bundle</Button>
  </div>
);

/** Disabled reads at 60% opacity rather than vanishing, so the reason it is off stays legible. */
export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary" disabled>
      Publish
    </Button>
    <Button variant="outline" disabled>
      Delete forever
    </Button>
  </div>
);
