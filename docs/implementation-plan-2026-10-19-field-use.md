# Field-Use and Full-Manuscript Implementation Plan

> For agentic workers: use subagent-driven-development for disjoint implementation
> slices and verification-before-completion for integration. The user requested
> one complete round rather than repeated prioritization gates. Provider writes
> retain the separate owned-resource choice; read-only work need not wait for it.

**Goal:** Validate actual maintainer use with a real model and native integrations,
then deliver a substantially complete, evidence-traceable manuscript.

**Architecture:** A new `field-study/` layer surrounds the preserved public
comment profile and dispatch modules. Real model-selected reads produce task
reports; native mutation proposals, policy decisions, provider observations and
useful-task checks have separate records. Official MCP and SDK operations use
the same bounded owned resources. Historical reports remain source-pinned.

**Tech Stack:** Node 22, existing official MCP/Octokit SDK dependencies, pinned
GitHub MCP executable, existing Azure Responses deployment, Python consumer,
OPA, LaTeX, Markdown. No new production service or Hook installation.

## Execution Boundary

This round completed real read-only maintainer use, native setup/conformance,
preparation-only comparison, local fault regressions and a full manuscript.
The proposed new mutation/process-crash population in section 6 was not
executed: the separate new-issue resource choice received no answer. It is not
counted as completed and no old mutation result is renamed to fill that gap.
See [the complete results](../reports/field-study-summary.md). Actual code paths
below replace the initial planning names; historical measured sources remain
in Git and are not replaced by post-run repairs.

## 1. Freeze Scope, Tasks and Baseline

Files: this plan; `docs/design/2026-10-19-field-use-and-full-manuscript.md`;
`field-study/tasks.json`; `field-study/criteria.json`; `field-study/tools.json`;
timestamped pre-request freeze artifacts under `reports/`.

- [x] Pin the existing Bench/Spec release commits and preserve all old inputs.
- [x] Record task IDs, goals, required source observations, model/tool limits,
  write ceiling, score semantics and stop rules before model outcomes exist.
- [x] Separate actual self-use from native conformance and induced faults.

Public source identity commands:

```sh
git rev-parse v0.2.0-draft.1^{commit}
git -C ../action-effect-spec rev-parse v0.2.0-draft.1^{commit}
```

Expected starting identities are Bench
`cecde389637be4f5fd3482e4942ce3fd1a623ac6` and Spec
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`.

## 2. Safe Model/Tool Loop

Files: `field-study/model-client.mjs`, `field-study/agent-loop.mjs`,
`field-study/tests/model.test.mjs`, `field-study/tests/agent-loop.test.mjs`.

- [x] Write tests rejecting non-HTTPS/unconfigured endpoints, malformed replies,
  unknown tool names, invalid arguments, exhausted rounds and safety stops.
- [x] Observe those tests fail before implementing the adapters.
- [x] Implement no-store Responses calls with explicit budgets. Keep live
  credentials and encrypted reasoning only in memory; publish neither.
- [x] Capture visible tool calls, public outputs, usage, duration and stop reason.
  Never change APIs to evade a safety stop or fabricate missing model output.

The loop's contract is `runAgent({ task, model, tools, journal, limits })`.
`model` exposes `respond(input, tools)`; each tool is an explicitly named handler.
Unknown functions are recorded as rejected calls, not passed to a shell.

```js
await assert.rejects(() => runAgent({
  task, model: hostileUnknownToolModel, tools: {}, journal,
  limits: { rounds: 1, toolCalls: 1 }
}), /unsupported_tool|budget/);
```

Tests use model-shaped fixtures for orchestration only; the real-use report must
identify actual provider calls and cannot reuse fixture outcomes as observations.

## 3. Official Native Adapter

Files: `field-study/native-mcp.mjs`, `field-study/native-reader.mjs`,
`field-study/github-reader.mjs`, `field-study/preflight.mjs`,
`field-study/tools.json`, and their matching tests.

- [x] Pin a real official release, source and platform artifact identities.
  Acquisition commands and failures are recorded in setup artifacts; no general
  cross-platform native-server installer is claimed.
- [x] Test target/ref/path restrictions, advertised schema checks, strict result
  decoding and failed initialization; offer no mutation tool in this runner.
- [x] Implement official MCP initialize/list/call and actual SDK operations.
  Provider writes are unavailable in read-only mode.
- [x] Record SDK/MCP file-read native envelopes and responses before normalization.
  The normalized-only release metadata gap is explicit, not full native coverage.

```js
await assert.rejects(() => readPublicFile({
  owner: 'other-owner', repo: 'private-target', path: 'secret', ref: 'main'
}), /scope/);
```

## 4. Task Sources and Utility Checks

Files: `field-study/read-tools.mjs`, `field-study/scoring.mjs`,
`field-study/tests/scoring.test.mjs`, `field-study/tests/read-tools.test.mjs`,
and separately retained `analysis/review-*-field-use.*` assessments.

- [x] Capture actual public release/source facts before model results.
- [x] Keep references outside the model's offered tool set. Tests distinguish
  missing observation, wrong task fact, correct mapping, denied authority and
  provider uncertainty. No one result substitutes for another.
- [x] Validate source citations and numeric/hash facts against retained sources,
  with same-project AI-assisted review explicitly distinguished from human truth.
- [x] Account for supported mutation calls and out-of-profile read tooling.

## 5. Runner, Journal and Read-Only Replay

Files: `field-study/run.mjs`, `field-study/artifacts.mjs`,
`field-study/replay.mjs`, `field-study/tests/artifacts.test.mjs`.

- [x] Test immutable artifact creation, source drift, omitted attempts, changed
  hashes, invalid population totals and leaked credential-like fields.
- [x] Persist task-start, model-result, tool-attempt/result and task-end records.
  Interrupted runs remain failed/incomplete rather than disappearing.
- [x] Implement read-only replay that reconstructs captured task checks and
  reports coverage gaps without calling a model or reposting to GitHub. A rerun is a new
  stochastic observation, not byte-for-byte reproduction of the previous one.

## 6. Real Use and Separate Recovery Tests

The proposed `recovery-run.mjs` and `recovery-worker.mjs` were not created.
New immutable `reports/field-study-*` contain the read-only population;
`field-study/tests/runner-journal.test.mjs` covers injected local recorder faults,
not a replacement cloud/process-crash population.

- [x] Run read-only setup and real-model tasks first; retain setup failures.
- [ ] Once the owned-write boundary is confirmed, create the new dedicated
  issue and run only the explicitly bounded mutation subset.
- [ ] Exercise actual independent processes, transport failure and conservative
  recovery. Label all deliberate faults and do not exhaust provider quotas.
- [ ] Count attempted POSTs and confirmed objects separately; reconcile unknown
  delivery read-only and stop writes on unexpected/unbounded behavior.

## 7. Full Technical Manuscript

Files: `paper/manuscript.md`, `paper/manuscript.tex`, `paper/sources.json`,
`paper/measurement-contract.md`, `paper/measurement-audit.json`,
`paper/manuscript.pdf`.

- [x] Expand the running case, exact identities/preimages, algorithms,
  conditional invariants and counterexamples from actual code and specification.
- [x] Add process, tuple-coupling, dispatch/recovery, timer and artifact diagrams.
- [x] Add an obligation-to-code table and complete profile/replay appendices.
- [x] Integrate only source-stable new observations. Distinguish old scripted
  pilot, real self-use, model quality, shadow comparisons and induced faults.
- [x] Consolidate repeated scope warnings; do not pad the manuscript with them.

## 8. Integration and Completion

- [x] Run all old and new tests, preserving old source-inventory compatibility.
- [x] Recompute report totals and hashes, including unsuccessful runs; public
  historical readback remains separately recorded.
- [x] Scan public candidates for credentials, private paths and protected data.
- [x] Compile LaTeX, render every page, fix clipping/overlap and verify figures
  and numeric tables against immutable raw results.
- [x] Record the actual readiness decision; no external invitation, production
  qualification or formal manuscript submission is inferred from a green test.

The [release verification record](../reports/release-verification-v0.3.0.md)
records test populations, public-artifact checks, current readback and the
39-page PDF inspection. The unexecuted section 6 subset remains explicit.

Core regression commands remain:

```sh
node --test ../action-effect-spec/implementations/javascript/*.test.mjs conformance/*.test.mjs
python3 -B -W error -m unittest discover -s ../action-effect-spec/implementations/python/tests
node --test runtime-pilot/tests/*.test.mjs field-study/tests/*.test.mjs
python3 -B -W error -m unittest discover -s runtime-pilot/tests -p 'test_*.py'
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
```
