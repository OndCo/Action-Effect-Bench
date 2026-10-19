# Owned-Resource Delivery and Recovery

This is a separate continuation of the recorded real maintainer study. It is
not a new six-task model run or a claim of independent evaluation. The original
six outputs are read from their committed evidence, not regenerated. Two pass
the unchanged task contract and same-project review; four byte-budget failures
remain withheld. No reader should count fault-control comments as useful tasks.

## Fixed Scope

- One new owned issue in `OndCo/Action-Effect-Bench`, never the older issue #1.
- Maximum twelve application-level comment-call permits across all child
  processes; the fixed plan expects five actual objects, not twelve.
- Eight initial scenarios: two ordinary deliveries and six separately labelled
  fault conditions. Every initial run, recovery and duplicate probe is a new
  OS process. All processes share one local durable ledger.
- Official pinned GitHub MCP over stdio for four initial scenarios; Octokit
  for the other four. Exact-ID/preflight observation and recovery use Octokit.
- Complete structured and protocol preparation receive the same native input.
  Only one strategy dispatches per scenario. Shadows are not extra live trials
  or a causal between-strategy latency experiment.
- No model request, real bank, customer data, Studio/Hook change, invitation,
  remote policy weakening, or automatic mutation resend.

## Live Commands Are Opt-In

Both source repositories must be clean and committed. Install the same pinned
tools and dependencies as the v0.3 read-only study first. An operator must be
authenticated with `gh` and authorized to create the dedicated issue.

```sh
node field-study/write-run.mjs --setup owned-write-YYYYMMDD
node field-study/write-run.mjs --execute /absolute/path/to/returned/manifest.json
```

Setup persists an exclusive intent before its single issue-creation call.
**Do not repeat setup or create another run ID after an uncertain response.**
Inspect the saved response and the owned GitHub repository first. Execution
likewise refuses to restart a previously started whole study. Individual
recovery is read-only and tied to the original occurrence.

An exceptionally narrow continuation command can adopt an empty issue after
the retained pre-reservation comparison failure:

```sh
node field-study/write-run.mjs --adopt-unstarted /absolute/old/manifest.json new-run-id
```

It checks the exact stopped record, null original ledger, absent permits, and
the fresh unchanged/empty GitHub issue before creating a new source-bound
manifest. It makes no issue-creation call and cannot adopt an inflight or
unknown occurrence. The original attempt remains part of the evidence chain.

Tests and offline replay never call either live entry point. The user approved
the specific study conducted by this repository's maintainer; this is not
blanket authorization for third parties to publish to this repository.

## Deliberately Induced Cuts

| Condition | Exact cut | Expected observation |
| --- | --- | --- |
| Revocation | After native preflight, before final policy load | Current deny, no call |
| Narrowing | Body limit reduced at the same cut | Current deny, no call |
| Pre-send crash | SIGKILL after inflight persistence, before native create | No object; fresh recovery stays unknown |
| Post-reply crash | SIGKILL after actual MCP reply, before gate receipt persistence | Fresh read-only recovery can confirm current content |
| SDK acknowledgment timeout | Actual SDK reply observed, then withheld until a real timer expires | Unknown followed by read-only recovery |
| MCP disconnect | Capture actual mutation JSON-RPC reply, discard it, close actual stdio | Unknown followed by fresh SDK read-only recovery |

These are deliberately injected process/acknowledgment faults, not natural
internet outages. The permit count concerns calls made by this harness. The
official server's complete HTTP wire-attempt history is not instrumented. A
policy revocation after the final local check but before the remote commit
remains outside an atomic guarantee. Matching current content does not prove
all provider descendants or execution-time provenance.

## Evidence and Replay

The study archive includes exact committed inputs, final rendered bodies,
native events, process exits/signals, current-policy changes, monotonic ledger
states, per-occurrence write permits, observations and interrupted journals.
An unsealed but intact crash journal is distinguished from a corrupt journal.
Offline replay verifies historical sources as data; it never checks out or
executes arbitrary historical source and never makes a provider mutation.

```sh
node field-study/write-replay.mjs reports/owned-write-study-<timestamp>-<id>.json
```

Do not equate a green replay with independent provenance. Hashes and chains
make the archived record checkable against its published commitment; they do
not prevent an operator who controls every input from fabricating a different
record. Final public GitHub GETs provide an additional, narrower current-state
check.
