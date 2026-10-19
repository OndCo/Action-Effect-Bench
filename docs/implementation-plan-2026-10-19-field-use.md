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

## 1. Freeze Scope, Tasks and Baseline

Files: this plan; `docs/design/2026-10-19-field-use-and-full-manuscript.md`;
`field-study/tasks.json`; `field-study/source-lock.json`.

- [ ] Pin the existing Bench/Spec release commits and preserve all old inputs.
- [ ] Record task IDs, goals, required source observations, model/tool limits,
  write ceiling, score semantics and stop rules before model outcomes exist.
- [ ] Separate actual self-use from native conformance and induced faults.

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

- [ ] Write tests rejecting non-HTTPS/unconfigured endpoints, malformed replies,
  unknown tool names, invalid arguments, exhausted rounds and safety stops.
- [ ] Observe those tests fail before implementing the adapters.
- [ ] Implement no-store Responses calls with explicit budgets. Keep live
  credentials and encrypted reasoning only in memory; publish neither.
- [ ] Capture visible tool calls, public outputs, usage, duration and stop reason.
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

Files: `field-study/github-native.mjs`, `field-study/install-tools.mjs`,
`field-study/tools.json`, `field-study/tests/github-native.test.mjs`.

- [ ] Pin a real official release, source and platform artifact identities.
- [ ] Test target/ref/path restrictions, advertised schema checks, strict result
  decoding, failed initialization and no automatic mutation resend.
- [ ] Implement official MCP initialize/list/call and actual SDK operations.
  Provider writes are unavailable in read-only mode.
- [ ] Record SDK/MCP native envelopes and responses before semantic projection.
  Normalize only documented provider result fields; never invent a receipt.

```js
await assert.rejects(() => readPublicFile({
  owner: 'other-owner', repo: 'private-target', path: 'secret', ref: 'main'
}), /scope/);
```

## 4. Task Sources and Utility Checks

Files: `field-study/task-tools.mjs`, `field-study/scoring.mjs`,
`field-study/tests/scoring.test.mjs`, `field-study/tests/task-tools.test.mjs`.

- [ ] Capture actual public release/source facts before model results.
- [ ] Keep references outside the model's offered tool set. Tests distinguish
  missing observation, wrong task fact, correct mapping, denied authority and
  provider uncertainty. No one result substitutes for another.
- [ ] Validate source citations and numeric/hash facts independently of the
  generated prose. Report first-proposal and final task completion separately.
- [ ] Account for supported mutation calls and out-of-profile read tooling.

## 5. Runner, Journal and Read-Only Replay

Files: `field-study/run.mjs`, `field-study/artifacts.mjs`,
`field-study/replay.mjs`, `field-study/tests/artifacts.test.mjs`.

- [ ] Test immutable artifact creation, source drift, omitted attempts, changed
  hashes, invalid population totals and leaked credential-like fields.
- [ ] Persist task-start, model-result, tool-attempt/result and task-end records.
  Interrupted runs remain failed/incomplete rather than disappearing.
- [ ] Implement read-only replay that recomputes deterministic task/decision
  checks without calling a model or reposting to GitHub. A model rerun is a new
  stochastic observation, not byte-for-byte reproduction of the previous one.

## 6. Real Use and Separate Recovery Tests

Files: `field-study/recovery-run.mjs`, `field-study/recovery-worker.mjs`,
`field-study/tests/recovery.test.mjs`, new immutable `reports/field-study-*`.

- [ ] Run read-only setup and real-model tasks first; retain setup failures.
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

- [ ] Expand the running case, exact identities/preimages, algorithms,
  conditional invariants and counterexamples from actual code and specification.
- [ ] Add process, tuple-coupling, dispatch/recovery, timer and artifact diagrams.
- [ ] Add an obligation-to-code table and complete profile/replay appendices.
- [ ] Integrate only source-stable new observations. Distinguish old scripted
  pilot, real self-use, model quality, shadow comparisons and induced faults.
- [ ] Consolidate repeated scope warnings; do not pad the manuscript with them.

## 8. Integration and Completion

- [ ] Run all old and new tests, preserving old source-inventory compatibility.
- [ ] Recompute report totals, hashes and readbacks, including unsuccessful runs.
- [ ] Scan public candidates for credentials, private paths and protected data.
- [ ] Compile LaTeX, render every page, fix clipping/overlap and verify figures
  and numeric tables against immutable raw results.
- [ ] Record the actual readiness decision; no external invitation, production
  qualification or formal manuscript submission is inferred from a green test.

Core regression commands remain:

```sh
node --test ../action-effect-spec/implementations/javascript/*.test.mjs conformance/*.test.mjs
python3 -B -W error -m unittest discover -s ../action-effect-spec/implementations/python/tests
node --test runtime-pilot/tests/*.test.mjs field-study/tests/*.test.mjs
python3 -B -W error -m unittest discover -s runtime-pilot/tests -p 'test_*.py'
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
```
