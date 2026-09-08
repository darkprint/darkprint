# Grounded Research Desk

Splits a question across web, vector and code search, synthesizes one answer, and loops back through a fact-checker until every claim is grounded.

```
blueprint      grounded-research-desk
bundle digest  sha256:845ed41b13a0af93112d18117fec778c769bc1d96dfffb538f177a52eb4ddb81
nodes          8
cards pinned   8
```

The digest is taken over `topology.dot` and the digest of every card version pinned in it.
Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a
different digest.

## Run it

This runs on your machine. DarkPrint hands out the files and analyses them statically. It
executes nothing and holds none of your provider keys.

This folder carries the topology and its pinned cards, nothing compiled. To compile them into
a pipeline a graph runner takes, run `darkprint export <dir> --attractor`. It writes Attractor
DOT to stdout, and that file opens with the same two lists this README carries under *What
these files leave to the runner*. Adapting the result, or building the run yourself from these
files instead, is your own harness's job.

3 of the 8 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   node ids, edges, and the card version pinned on each node
cards/         the pinned cards, as the registry stores them; each carries the `spec` that becomes its node's prompt
README.md      this file
```

8 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it. The paths are relative to the repository you run this blueprint from, and writing the
documents is yours to do. Nothing here needs them to run, because every card carries its own
`spec` inline.

```
question    skills/question-intake.md
plan        skills/retrieval-planner.md
web         skills/web-retriever.md
vectors     skills/vector-recall.md
code        skills/code-index-search.md
synth       skills/evidence-synthesizer.md
factcheck   skills/claim-verifier.md
report      skills/report-delivery.md
```

## What these files leave to the runner

Attractor reads more attributes than a DarkPrint blueprint has fields to set. Compile these
files into a pipeline, by the command above or by hand, and the names below are the ones
nothing in this folder sets. Write them in where your run needs them, and expect a later
export of this blueprint to overwrite the whole compiled file. Appendix A of the Attractor
spec tabulates most of them; the rest are named by the retry rules in §3.5, by the handler
pseudocode in §4, and by §9.7's tool call hooks.

Left out, these fall to the runner and the pipeline still runs. The Attractor spec states a
value or a behaviour for each one's absence, in Appendix A or in the handler pseudocode that
reads it, so what you get is a choice nobody in this folder made:

- graph: `model_stylesheet`, `default_max_retries`, `default_max_retry`, `default_fidelity`,
`retry_target`, `fallback_retry_target`, `stack.child_workdir`, `tool_hooks.pre`,
`tool_hooks.post`
- node: `goal_gate`, `retry_target`, `fallback_retry_target`, `fidelity`, `thread_id`,
`timeout`, `llm_provider`, `reasoning_effort`, `auto_status`, `allow_partial`, `join_policy`,
`max_parallel`, `manager.poll_interval`, `manager.max_cycles`, `manager.stop_condition`,
`manager.actions`, `stack.child_autostart`, `tool_hooks.pre`, `tool_hooks.post`
- edge: `fidelity`, `thread_id`, `loop_restart`

Left out, these have nothing to fall to. The handler a node's shape selects reads each one
directly, and with no value it refuses or goes round again while the rest of the compiled file
reads as though the node would run. Read §4's handler section for the shape you are compiling
before you leave one of these unset:

- graph: `stack.child_dotfile`
- node: `human.default_choice`

## The nodes

| node | card |
| --- | --- |
| `question` | `question-intake@1.0.0` |
| `plan` | `retrieval-planner@1.0.0` |
| `web` | `web-retriever@1.0.0` |
| `vectors` | `vector-recall@1.0.0` |
| `code` | `code-index-search@1.0.0` |
| `synth` | `evidence-synthesizer@1.0.0` |
| `factcheck` | `claim-verifier@1.1.0` |
| `report` | `report-delivery@1.0.0` |

---

Exported from https://www.darkprint.io/blueprints/grounded-research-desk
