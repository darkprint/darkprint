# Frontline Triage

Classifies inbound tickets, auto-resolves the simple ones with a KB lookup, QAs its own reply, and escalates only when confidence drops.

```
blueprint      frontline-triage
bundle digest  sha256:8e227dd8d30f02dc1f1591cbdc800bc35bf2c4bb459ab78fde5dec6a4d4e5b8c
nodes          7
cards pinned   7
local terms    lupo/pii-handling
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

2 of the 7 nodes name the model they run on, in their card's own `model` field. Read it off
`cards/<ref>.yaml`; whether your harness honours it is yours to decide.

## What is in the folder

```
topology.dot               the DarkPrint topology: node ids, edges, the card version pinned on each node
cards/                     the pinned cards, byte for byte as the registry stores them
ontology/extensions.yaml   the local terms these cards declare, and the weights that price them
README.md                  this file
```

6 of the nodes in this bundle name a skill document. There is no `skills/` directory above and
there is not meant to be: DarkPrint stores the pointer and reads nothing at the other end of
it, so a skill document is never part of a bundle. The paths are relative to the repository
you run this blueprint from, and writing the documents is yours to do.

```
ticket        skills/event-intake.md
classify      skills/intent-router.md
autoresolve   skills/resolution-composer.md
kb            skills/kb-resolver.md
qa            skills/reply-qa-check.md
send          skills/reply-dispatch.md
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
| `ticket` | `event-intake@1.0.0` | none declared |
| `classify` | `intent-router@1.1.0` | none declared |
| `autoresolve` | `resolution-composer@1.0.0` | implementation |
| `kb` | `kb-resolver@1.0.0` | none declared |
| `qa` | `reply-qa-check@1.0.0` | testing |
| `send` | `reply-dispatch@1.0.0` | deployment |
| `escalate` | `confidence-escalation@1.0.0` | none declared |

## What DarkPrint computed

Autonomy: Supervised.

> 6 of 7 nodes run unattended, 1 has a person in the loop. 2 of 3 control points run unattended. 0.6667 ≥ 0.50 → Supervised.

Where a person acts:

- `escalate` (Confidence Escalation): Let anything at or above the confidence threshold through untouched and park the rest for a person, with the full context pack attached and an SLA on the clock (type: human-gate). A person acts here.

Security level 2.

> 4 − 1.50 (irreversible-action) − 0.50 (lupo/pii-handling) → 2

What was charged:

- Node "Reply Dispatch" (send) declares the risk marker `irreversible-action` (Irreversible action).
- Node "Reply QA Check" (qa) declares the risk marker `lupo/pii-handling` (PII handling).
- Node "Reply Dispatch" (send) declares the risk marker `lupo/pii-handling` (PII handling).

Both were read against the core vocabulary and the local terms these cards declare:
`lupo/pii-handling`. Their definitions and the weights that price them are in
`ontology/extensions.yaml`, in this folder. Score the folder without that file and those ids
resolve against nothing, the cards carrying them are rejected with them, and both numbers
move.

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

Exported from https://www.darkprint.io/blueprints/frontline-triage
