import { SingleDocDropzone } from "darkprint";

/* The wizard's Node/Ontology dropzone. `UploadFlow.tsx` mounts one bound to state:
   `<SingleDocDropzone doc={singleDoc} onChange={setSingleDoc} kindLabel={KIND_NOUN[kind]} />`.
   `onChange` is a no-op here — nothing above these cells reads it back. */

export const Empty = () => (
  <SingleDocDropzone doc={undefined} onChange={() => {}} kindLabel="node card" />
);

const acceptanceTester = {
  name: "acceptance-tester@1.0.0.yaml",
  text: "id: acceptance-tester\nname: Acceptance Tester\ntype: validation\nphase: testing\n",
};

/** A document already dropped, ready to replace or clear. */
export const Filled = () => (
  <SingleDocDropzone doc={acceptanceTester} onChange={() => {}} kindLabel="ontology" />
);
