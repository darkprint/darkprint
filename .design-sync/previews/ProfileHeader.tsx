import { ProfileHeader } from "darkprint";

const mara = {
  username: "mara-veil",
  displayName: "Mara Veiga",
  avatarHue: 268,
  validator: true,
  bio: "Orchestration researcher. Builds closed-loop agent lines and breaks them for a living.",
};

const orin = {
  username: "orin",
  displayName: "Orin Vasquez",
  avatarHue: 208,
  validator: false,
  bio: "Turning natural-language goals into runnable blueprints for non-technical teams.",
};

/** The owner's own profile: `Edit profile` / `New blueprint` in place of Watch / Support. */
export const OwnerView = () => (
  <ProfileHeader
    author={mara}
    blueprints={4}
    cards={9}
    downloads={1280}
    stars={76}
    validated={12}
    joinedAt="2026-03-14T00:00:00.000Z"
    watchers={0}
    support={0}
    owner
    viewerSignedIn
  />
);

/** A signed-in visitor's read: Watch and Support are live, neither is the reader's own row. */
export const VisitorView = () => (
  <ProfileHeader
    author={orin}
    blueprints={2}
    cards={5}
    downloads={340}
    stars={18}
    validated={3}
    joinedAt="2026-05-02T00:00:00.000Z"
    watchers={41}
    support={9}
    owner={false}
    viewerSignedIn
  />
);
