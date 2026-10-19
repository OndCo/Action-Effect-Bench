# Real Maintainer Use

This directory tests actual model-selected work on the two public Action-Effect
repositories. It does not turn the older scripted comment pilot into customer
production data. See the [results](../reports/field-use-summary.md) and
[full manuscript](../paper/manuscript.md).

## What Runs

Six maintenance intents cover release integrity, installation, consumer
migration, official MCP compatibility, recovery instructions and conformance
claims. Each starts with a fresh conversation and immutable source allowlists.
The model chooses its read calls and report text. Three tasks use Octokit and
three use the official GitHub MCP server over local stdio; the different task
assignments are not a paired transport-speed experiment.

The runner uses a configured existing Azure Responses deployment, not fixture
model responses. Its read tools cannot write files, execute shell commands,
post comments, change issues, access an arbitrary URL or read the rubric. The
capability restriction on reads is not the GitHub comment authorization profile.
No Studio account, Hook or private collaboration corpus is involved.

## Recheck Captured Evidence Offline

Use the two lowercase sibling clones and install the locked Node dependencies
with `npm ci --prefix runtime-pilot --ignore-scripts --no-fund --no-audit`.
Keep Git history: the strict replay reads source blobs from the run's recorded
commits as data, without checking them out or executing historical code. A
shallow clone that lacks a recorded commit must obtain that public history
explicitly; replay does not silently fetch it.

From the Bench root:

```sh
node --test field-study/tests/*.test.mjs
node --test analysis/*.test.mjs
node field-study/replay.mjs reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json
```

These commands make no model or provider calls. Replay verifies the retained
source inventory, freeze, event chain, report consistency and observations. It
does not recreate stochastic text, prove the authenticity of the operator, or
independently grade the report's conclusions. An honestly recorded failure is
different from corrupt evidence and from a successful task.

## Actual Live Reads Are Opt-In

`node field-study/run.mjs --real-readonly` invokes a paid model and live GitHub
reads. `tools.json` names the existing deployment and the exact Darwin-arm64
GitHub MCP executable used here, not a general installer for another account or
platform. The executable's archive and binary hashes are checked against that
file. Recorded setup failures are retained under `reports/field-study-*`.

Credentials are obtained from the authorized local GitHub and Azure CLIs in
memory. Do not put keys in arguments or public configuration. Responses use
`store: false`; encrypted reasoning is carried only in process memory and is
not published. The loop respects safety stops, budgets and journal failures.
It never retries a failed model request automatically or switches providers to
evade a stop. A rerun is a new observation, not replay.

## First Run and Post-Review Amendment

The first run's source is `bc1d389a474c37a9c38b2b5acedbd7bb65650225` and its
evidence is retained at `eff7bf6bee237162a7f321bbb131008f880346fb`. Its task
instructions requested Markdown within 6000 bytes, but an appended instruction
required JSON and aimed below 7000 Markdown bytes. Five bodies exceeded 6000
bytes; one report made an incorrect claim about current provider use. These
results are not silently rescored under the later contract.

[Amendment 2](amendment-2.json) resolves the envelope, enforces the 6000-byte
Markdown limit, supplies bounded current-channel metadata, and strengthens
replay and fail-stop journaling. The thirty required fact records, source
allowlists and task lanes remain unchanged. The repeat is post-review exposed
development, not a held-out or causal evaluation. An oversized candidate stays
in the evidence as `failed/report_bytes_exceeded`; it is not truncated or
automatically rewritten into a successful result.

## Read the Results on Separate Axes

- Loop completion means the model returned a valid final object, not that its
  conclusions were correct or that anyone used the report.
- Source review is same-project and AI-assisted, not independent human labels.
- Citation observation proves the URL was observed, not that it supports every
  sentence that cites it.
- The exploratory publication-fit analysis packages actual reports with their
  conclusions and citation URLs, then checks both preparation strategies. It
  uses a placeholder issue/principal and never calls OPA or a provider.
- No new official-MCP write, remote authorization, restart, lost-ACK or
  revocation trial is claimed by this read-only population. The older live
  pilot retains its own narrower evidence and custom MCP server identity.

Further invitations, write tests, human acceptance and customer qualification
are separate decisions. No evidence package grants permission to post.
