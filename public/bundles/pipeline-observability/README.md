# Pipeline Observability

Observability for a pipeline you already have: tracing on every watched step, metrics per step in one report, monitoring of that report against thresholds, and an alert when a step fails or runs long. To feed the tracer, a step has to emit one structured value per run, json or a table will do, plus its outcome signal when it has one; the gate's signal is the only thing that reaches the alert sender.

```
blueprint      pipeline-observability
bundle digest  sha256:c6ef312cfffd549b691b3339a155ac1e12c280fac1329d7c61fda272354b39d1
nodes          4
cards pinned   4
```

The digest is taken over `topology.dot` and the digest of every card version pinned in it.
Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a
different digest.

## Run it

This runs on your machine. DarkPrint hands out the files and analyses them statically. It
executes nothing and holds none of your provider keys.

This folder carries the topology and its pinned cards, nothing compiled. `topology.dot` names
every node, every edge and the card version pinned on it. Each card under `cards/` carries the
`spec` that becomes that node's prompt.

To compile these two into a pipeline a graph runner takes, run `darkprint export <dir>
--attractor`. It writes Attractor DOT to stdout, and that file opens with the same two lists
this README carries under *What these files leave to the runner*. Adapting the result, or
building the run yourself from these files instead, is your own harness's job.

2 of the 4 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/         the pinned cards, byte for byte as the registry stores them
README.md      this file
```

4 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
tracer       skills/step-tracer.md
summariser   skills/run-summariser.md
gate         skills/anomaly-gate.md
dispatch     skills/alert-dispatch.md
```

Nothing here needs them to run. Every card carries its own `spec` inline, which is the whole
instruction for that node whatever harness compiles this topology into a running pipeline. A
skill document adds a capability to one agent; what the blueprint decides is who is wired to
whom.

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

| node | card | phase |
| --- | --- | --- |
| `tracer` | `step-tracer@1.0.0` | none declared |
| `summariser` | `run-summariser@1.0.0` | testing |
| `gate` | `anomaly-gate@1.0.0` | testing |
| `dispatch` | `alert-dispatch@1.0.0` | deployment |

## What DarkPrint computed

Autonomy: Closed-loop.

> 4 of 4 nodes run unattended, none have a person in the loop. The graph declares 1 control point, which is one reading rather than a share. 1.00 > 0.90 → Closed-loop.

Security level 3.

> 4 − 1.50 (irreversible-action) → 3

What was charged:

- Node "Alert Dispatch" (dispatch) declares the risk marker `irreversible-action` (Irreversible action).

Both readings come from the topology and the cards, with nothing executed. These are the files
that produced them, so the same arithmetic on your side gives the same class and the same
security level.

The autonomy class says what this blueprint automates and where a person stands in it.
Nothing here is a grade.

## What gets reported back

Nothing. No file in this folder calls home, and DarkPrint watches no run.

Cost and runtime on the blueprint page are labelled *reported* for that reason: whoever runs a
blueprint on their own hardware is the only party that can measure them. Sending a report
would be something you opt into. It is designed and not built, so there is no account, no
endpoint and no client for it in this bundle or on the site.

---

Exported from https://www.darkprint.io/blueprints/pipeline-observability
