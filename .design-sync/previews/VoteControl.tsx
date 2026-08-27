import { VoteControl } from "darkprint";

/* Real aggregate figures, lib/data/community.ts's starter-software-factory row. */
const aggregate = {
  efficacy: { value: 84, sampleSize: 23, isSample: false },
  reliability: { value: 78, sampleSize: 23, isSample: false },
  transparency: { value: 88, sampleSize: 23, isSample: false },
};

/** A signed-in reader, free to drag a slider and cast a ballot. */
export const SignedIn = () => (
  <VoteControl
    api="/api/blueprints/orin/starter-software-factory/votes"
    aggregate={aggregate}
    signedIn
  />
);

/** Signed out: the sliders read the aggregate and the cast action is refused. */
export const SignedOut = () => (
  <VoteControl
    api="/api/blueprints/orin/starter-software-factory/votes"
    aggregate={aggregate}
    signedIn={false}
  />
);

/** A blueprint too new for a real sample: three ballots, flagged small on every axis. */
export const SmallSample = () => (
  <VoteControl
    api="/api/blueprints/orin/warehouse-nightly-sync/votes"
    aggregate={{
      efficacy: { value: 90, sampleSize: 3, isSample: true },
      reliability: { value: 67, sampleSize: 3, isSample: true },
      transparency: { value: 80, sampleSize: 3, isSample: true },
    }}
    signedIn
  />
);
