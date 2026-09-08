# Incident Commander

Triages alerts, routes to the right runbook, drafts a mitigation, QAs it against blast-radius rules, and escalates to on-call when risk is high.

```
blueprint      incident-commander
bundle digest  sha256:31510b7bdf6eec6472a6eb431c902ad13ad59d00c15877a3ed43f03b3016a23e
nodes          7
cards pinned   7
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

2 of the 7 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot   node ids, edges, and the card version pinned on each node
cards/         the pinned cards, as the registry stores them; each carries the `spec` that becomes its node's prompt
README.md      this file
```

6 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it. The paths are relative to the repository you run this blueprint from, and writing the
documents is yours to do. Nothing here needs them to run, because every card carries its own
`spec` inline.

```
ticket        skills/event-intake.md
classify      skills/intent-router.md
autoresolve   skills/resolution-composer.md
kb            skills/runbook-resolver.md
qa            skills/blast-radius-check.md
send          skills/runbook-executor.md
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
| `ticket` | `event-intake@1.0.0` |
| `classify` | `intent-router@2.1.0` |
| `autoresolve` | `resolution-composer@1.0.0` |
| `kb` | `runbook-resolver@1.0.0` |
| `qa` | `blast-radius-check@1.0.0` |
| `send` | `runbook-executor@1.1.0` |
| `escalate` | `confidence-escalation@1.0.0` |

---

Exported from https://www.darkprint.io/blueprints/incident-commander
