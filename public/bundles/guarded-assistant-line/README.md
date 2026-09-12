# Guarded Assistant Line

Four checks in front of an assistant and one behind it, with every failed guard landing on the same person rather than on the customer.

```
blueprint      guarded-assistant-line
bundle digest  sha256:57384dcf9d673e4ac9d65a16be41be8eefcf991c893f085305288f871860861d
nodes          7
cards pinned   7
local terms    autogen/prompt-injection, autogen/untrusted-text
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

## What is in the folder

```
topology.dot               node ids, edges, and the card version pinned on each node
cards/                     the pinned cards, as the registry stores them; each carries the `spec` that becomes its node's prompt
ontology/extensions.yaml   the local terms these cards declare, and the weights that price them
README.md                  this file
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
| `inbound` | `untrusted-intake@1.0.0` |
| `sanitize` | `input-sanitizer@1.0.0` |
| `screen` | `policy-screen@1.0.0` |
| `assist` | `constrained-assistant@1.0.0` |
| `filter` | `output-filter@1.0.0` |
| `gate` | `reviewer-gate@1.0.0` |
| `send` | `reply-delivery@1.0.0` |

---

Exported from https://www.darkprint.io/blueprints/guarded-assistant-line
