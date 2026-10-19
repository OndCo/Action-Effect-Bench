# Owned Write and Recovery Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development and
> verification-before-completion. The user approved the existing field-use
> design, including one new owned issue and at most twelve comments. Work on
> normal main in these public clones; do not use a worktree or modify Studio.

**Goal:** Deliver eligible real maintainer outputs through SDK/official MCP,
and separately measure real-process recovery, timeout and current revocation.

**Architecture:** Reuse the public v0.2 gate, consumer, OPA and durable ledger.
New field-study modules wrap native delivery and supervise isolated worker
processes. Preserve v0.3 read-only evidence, task failures and source identities.
No new model run, scoring relaxation or automatic rewrite is needed to test
delivery. No provider mutation is available to the replay path.

**Tech Stack:** Node, pinned Octokit and official GitHub MCP v2.0.2, existing
Python checker/OPA, local durable artifacts, GitHub REST readback, LaTeX.

## 1. Fix the Population Before Delivery

- [ ] Load the immutable second field report at evidence commit
  `7306d8b45402bb2ee7f9a1fbaf7203835e599110` and its checksum
  `e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999`.
- [ ] Apply the existing JSON/body contract and same-project source review:
  six scheduled report candidates, two eligible, four over-budget failures.
  The four stay withheld at the task layer, not counted as policy denials.
- [ ] Render the two accepted bodies with their unmodified report text,
  conclusions, source links and explicit internal-review status. Bind the final
  rendered bytes; reject an oversized render rather than truncate it.
- [ ] Keep fault-control bodies distinct and explicitly synthetic. Do not
  describe their publication as completed model tasks.

`field-study/write-plan.mjs` owns plan construction and literal reference
projections. Its pure interface is:

```js
buildWritePlan({ report, review, target, principal, runId })
// { format, target, principal, run_id, candidates, scenarios,
//   max_comment_calls: 12, expected_comment_objects: 5 }
```

`target` is exactly `{owner: 'OndCo', repo: 'Action-Effect-Bench', issue_number}`.
Candidates keep all six task IDs and original status. Each executable scenario
contains `id`, `lane`, `strategy`, `fault`, `occurrence`, `native`, `context`,
`reference_projection` and `expected`. No credentials or filesystem paths enter
the public plan. Parent review fixes exact field names before runner integration.

## 2. Native Writer and No-Resend Observation

Files: `field-study/native-writer.mjs`, `field-study/fault-transport.mjs`,
`field-study/tests/native-writer.test.mjs`,
`field-study/tests/fault-transport.test.mjs`.

- [ ] TDD: reject changed target/body shape, unsupported mutation, malformed
  native response, mismatched ID URL, failed journal, and second uncertain send.
- [ ] Wrap the existing `openNativeMcp` and `decodeCommentResult` for actual
  `add_issue_comment`. Use SDK identity/preflight/exact-ID readback independently.
  MCP mutation response and negotiated inventory remain in public evidence.
- [ ] Support a transport wrapper that captures and deliberately discards the
  real mutation reply, then closes the actual stdio transport. Never fabricate
  a provider reply or reissue a mutation. Tests use fixtures; live evidence is
  a separate run.
- [ ] Count native application calls and observed new objects separately.
  Internal Go HTTP wire-attempt counts remain unknown, not inferred from one
  MCP call. No arbitrary URL, token or raw HTTP header is recorded.

## 3. Real Worker and Supervisor

Files: `field-study/write-worker.mjs`, `field-study/write-run.mjs`,
`field-study/write-artifacts.mjs`, and corresponding tests.

- [ ] TDD: frozen configuration, write ceiling, durable occurrence ownership,
  source drift, interrupted journal, invalid IPC and missing worker output.
- [ ] Parent obtains a dedicated issue once after read-only preflight and code
  tests. Record creation separately from the comment profile. No blind retry if
  issue creation has an uncertain outcome.
- [ ] Every scenario executes in an actual independent process. Parent supplies
  only a frozen manifest and local state paths; credentials are acquired in
  worker memory. Journals must be durable before crossing a mutation boundary.
- [ ] Six fault scenarios are fixed: revoke after preflight; narrow the body
  limit after preflight; kill after inflight persistence but before native call;
  kill after actual MCP reply but before gate receipt persistence; SDK response
  timeout after an observed successful write; actual MCP stdio disconnect after
  the captured mutation reply. Expected new objects are 0, 0, 0, 1, 1, 1.
- [ ] Recovery starts a fresh read-only process with the original occurrence.
  The pre-send kill remains unknown without a receipt; delivered writes can be
  reconciled under the gate's existing current-content assumptions. Unknowns
  retain occurrence ownership. Retry probes reuse the same occurrence and must
  not call a provider mutation.
- [ ] The two ordinary deliveries plus three deliberate-fault deliveries imply
  five expected new comments, below the absolute twelve-call ceiling. Stop on
  unexpected targets, extra objects, unexplained outcomes or missing evidence.

Faults are explicit controlled cuts, not observed natural outages. Parent and
worker share one host and ledger; this is not a multi-host atomicity test.
Revocation before the gate's final policy read must deny. Revocation between
that read and a remote commit remains outside an atomic guarantee.

## 4. Matched Preparation and Evidence Replay

Files: `field-study/write-replay.mjs`,
`field-study/tests/write-replay.test.mjs`, new immutable reports.

- [ ] For each executable native proposal, check protocol and complete
  structured preparations against the same literal native-derived reference.
  Run one selected live strategy only; two shadows are not two provider trials.
- [ ] Preserve initial grant, amended policy, both decisions, worker events,
  exit/signal, ledger snapshots, native replies, readback and manual steps.
- [ ] Offline replay checks exact source/data hashes, input/plan correspondence,
  process/journal ordering, counts and current-content predicates. It must
  reject missing or changed data and distinguish honest unknown from corruption.
- [ ] Optional anonymous GETs check only current public comments. No model call,
  POST, new occurrence or implicit network fetch occurs in offline replay.

## 5. Manuscript, Verification and Publication

- [ ] Preserve v0.3's complete paper and evidence through its immutable release.
- [ ] Add the new population, source identities, actual ordinary/fault counts,
  comparison boundaries, latency components and negative results to both
  manuscript sources. Do not pool read-only task quality with write recovery.
- [ ] Run old and new regressions, source/frozen-evidence replay, public-value
  and credential scans, and Linux/macOS CI before a new prerelease.
- [ ] Compile the standalone paper and inspect every final page. Keep the
  Toronto editorial timezone and no geolocation/independence exaggeration.
- [ ] Publish immutable raw reports, source, full manuscript and checksums.
  No automatic journal/conference submission, external invitation or customer
  production launch is implied.
