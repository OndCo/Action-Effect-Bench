# Runtime Pilot Results

**Release evidence, 19 October 2026 (America/Toronto).**
These are bounded, same-project development results, not an adopted standard,
external certification, general agent-safety accuracy or a production SLA.

## What Actually Ran

Two paths processed the same supported inputs and used the same current OPA
policy, local occurrence ledger and GitHub dispatcher:

1. Protocol: JavaScript effect description, separately written Python binding
   and tuple checker, then OPA.
2. Structured baseline: direct Python native-to-structured projection, then OPA,
   without transferring the effect-description envelope.

The live MCP lane used the official SDK's real stdio initialize/list/call flow;
both lanes used Octokit against GitHub, not a mock receiver. The tested profile
only describes the direct issue comment. Notification delivery, recipients,
webhooks and other provider descendants remain unknown.

| Measurement | Protocol | Structured baseline |
| --- | ---: | ---: |
| Exact mapping/status/reason checks | 108/108 | 108/108 |
| Authorization on accepted mapped inputs | 52/52 | 52/52 |
| Expected allow / deny / review instances | 22 / 28 / 2 | 22 / 28 / 2 |
| False allow on deny or review | 0/30 | 0/30 |
| Expected allows not allowed | 0/22 | 0/22 |
| Masked mapping errors / operational faults, offline | 0 / 0 | 0 / 0 |
| Accepted-input cold total median, n=52 | 50.391 ms | 48.468 ms |
| Live planned checks | 16/16 | 16/16 |

The offline corpus contains **55 authored cases, 22 base intents and 108 lane
instances (53 SDK, 55 MCP)**, not 108 independent tasks. Accepted mappings
account for 52 instances; the other 56 check explicit nonacceptance. Repeated
variants, shared implementations and repeated policy contexts limit statistical
independence. No population confidence claim is inferred from perfect agreement.

Separately, OPA matched all **26/26 independently specified reference-projection
labels** without using the candidate mapper. "Independently specified" here
means a separate authoring path within this project, not an external evaluator.
The deliberately lossy diagnostic altered 26 body digests: mapping matched
0/26 while decisions still matched 26/26. This demonstrates why decision
accuracy alone can conceal mapping errors. It is an ablation, not a competitor.

## Real Provider Outcomes

The single controlled run used
[this dedicated public GitHub issue](https://github.com/OndCo/Action-Effect-Bench/issues/1).
It started with zero comments and produced exactly **12 new comments**.

| Scenario | Checks across both paths/lanes | Observed result |
| --- | ---: | --- |
| Ordinary ASCII and Unicode content | 8 | Authorized; 8 comments created and read back. |
| Current revocation and narrower byte limit | 8 | Denied; no comment created. |
| Partial scope requiring review | 4 | Review; no comment created. |
| Invalid policy configuration | 4 | Evaluation failure; no comment created; not credited as semantic denial. |
| Controlled lost acknowledgment after successful POST | 4 | Initially unknown; 4 new comments recovered by read-only lookup, no resend. |
| Duplicate occurrence | 4 | Suppressed; no second POST or new comment. |

Thus **32/32 planned checks** passed. They are eight scripted scenarios crossed
with two paths and two lanes, not 32 independent incidents. The acknowledgment
loss was deliberately injected after a successful real provider response; it
was not a naturally occurring network outage or an autonomous model attack.

Examples of public observations:

- [Protocol SDK normal comment](https://github.com/OndCo/Action-Effect-Bench/issues/1#issuecomment-6259619239).
- [Protocol MCP normal comment](https://github.com/OndCo/Action-Effect-Bench/issues/1#issuecomment-6259620019).
- [Protocol lost-ack readback](https://github.com/OndCo/Action-Effect-Bench/issues/1#issuecomment-6259633673).
- [Structured MCP lost-ack readback](https://github.com/OndCo/Action-Effect-Bench/issues/1#issuecomment-6259636603).

The known POST response ID must match its GET. With no returned ID, recovery
excludes every pre-dispatch comment ID and requires one new exact body/actor
match. Unique markers and a dedicated single-writer issue bound this experiment.
This establishes new current content after preflight, **not causal proof that
our POST created it**, complete provider provenance or global exactly-once
delivery. A concurrent same-account writer is outside that attribution guarantee.
Local authorization and a remote mutation are not one atomic transaction.

## Cost, Without a Speed Claim

For accepted offline inputs the protocol's median cold cost was **1.923 ms
(about 3.97%) higher** than the structured baseline. These timings include
Python process startup/communication, mapping/checking and a real OPA process.
They are not warm serving throughput or an amortized deployment estimate.

The all-input medians, 0.042 ms versus 44.507 ms, are not useful-task speedup:
more than half the protocol inputs are rejected in JavaScript without starting
Python, whereas the direct adapter processes them in Python. We retain these
values in raw data rather than using them as a marketing headline.

Normal live completion included identity lookup, comment preflight, current
policy evaluation, ledger transitions, POST and fresh GET; MCP additionally
included cold transport/server startup. Its medians were **3,110.848 ms** for
protocol and **3,161.205 ms** for structured, with only **four observations per
path**. This is descriptive evidence, not a performance ranking. Initial rows
overlapped a same-host read-only offline replay; the host was not isolated for
a performance experiment. One-second inter-row pacing is excluded from row
costs and included in the approximately 99.049-second complete live run.

Local runtime: Apple M4 Pro, 14 logical CPUs, 24 GiB memory, Darwin arm64,
Node 22.18.0, Python 3.9.6 and pinned OPA 1.21.2. Exact installed dependency
versions, executable hashes and source inventories are inside the reports.
America/Toronto is the editorial timezone, not a location attestation.

## Evidence and Replay

| Artifact | Purpose |
| --- | --- |
| [Offline raw report](runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json) and [.sha256](runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json.sha256) | All 216 candidate rows, 26 reference-authority checks, 26 diagnostic rows and exact sources. |
| [Offline replay](runtime-pilot-replay-2026-10-19T04-24-39.129Z-61da80.json) | Recomputed 216 rows plus 52 reference/diagnostic records; valid and benchmark passed. |
| [Live raw report](runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json) and [.sha256](runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json.sha256) | All 32 slots, decisions, fault witnesses, timings and exact provider receipts. |
| [Attempt journal](runtime-pilot-live-attempt-338f0652-715c-4095-84df-4f19d8e2f8c7.jsonl) and [.sha256](runtime-pilot-live-attempt-338f0652-715c-4095-84df-4f19d8e2f8c7.jsonl.sha256) | Begin, every scheduled/result entry, and final observation record; no omitted unsuccessful slots. |
| [Live public replay](runtime-pilot-replay-2026-10-19T04-26-57.109Z-690395.json) | 32 rows recomputed; all 12 unique comments fetched anonymously and matched. |
| [Pinned GitHub OpenAPI excerpt](../runtime-pilot/upstream/github-comment-openapi.json) | Genuine upstream request/response examples and notification wording, not external governance ground truth. |

Implementation commit:
[`9f638df994504ba6f5d82c0b5409922a0be7a72e`](https://github.com/OndCo/Action-Effect-Bench/commit/9f638df994504ba6f5d82c0b5409922a0be7a72e).
Spec commit:
[`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`](https://github.com/OndCo/Action-Effect-Spec/commit/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40).
Release-only documentation/report commits do not change the runtime source
inventory. Install the pinned tools using the [quickstart](../docs/adoption/quickstart.md),
then run these **read-only** checks from the Bench root:

```sh
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
node runtime-pilot/replay.mjs reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json --github
```

Public GitHub may later change, delete content or rate-limit anonymous requests;
the reader must retain an unavailable/changed outcome rather than assuming a
match. These commands never repost. A replay verifies bytes, calculations and
current content, not historical latency, complete execution causality or the
honesty of an operator who could forge both a report and its checksum.

## Verification and Retained Failures

[Linux/macOS CI for the measured implementation](https://github.com/OndCo/Action-Effect-Bench/actions/runs/39199258635)
passed the pinned setup, original corpus, new offline evaluation and tests.
The suite comprises 64 Spec JavaScript, 115 Spec Python, 11 legacy harness,
333 runtime JavaScript and 50 runtime Python methods: **573 methods**, not 573
additional benchmark workloads. Runtime unit fixtures do not create SaaS effects.
The [fresh public-clone verification](release-verification.md) also passed
after a dependency-download/setup failure was resolved with the exact
hash-verified binary cache; both the failed and successful replays are retained.

The [first offline attempt](runtime-pilot-offline-2026-10-19T03-40-48.927Z-769420.json)
is retained as **failed**. A scorer incorrectly distinguished null-prototype and
ordinary JSON objects; the direct adapter also disagreed on some invalid numeric
and Unicode error semantics. Fixes changed the scorer/implementation, not frozen
case inputs or labels. That attempt predates the final source commit; its raw
data and hashes survive, but a complete exact old source tree was not archived.
It must not be presented as replayable with the current implementation.

Before the live run, internal review also reproduced eight gate regressions
covering stale identical content, edited old comments, mismatched response IDs,
configuration changes during awaits and current-policy reload. Each failed
against the preceding implementation and passed after correction. The live
experiment only used the corrected source.

The original offline profile still matched 102/102 expected outputs in each
consumer with 102/102 agreement and zero adapter faults;
[that separate report](offline-consumers-2026-10-19T03-59-16-707Z.md) preserves
its own scope and source identities.

## What Is Ready and What Is Not

The versioned draft, separately written implementations, bounded runtime example,
competent baseline, raw evidence, read-only replay, working paper and
[external seal/run/score tooling](../docs/adoption/external-evaluation-cli.md)
are available for inspection and contribution without an OSuite service.

**External independently authored evaluations: zero.** Actual custody requires
other participants and access controls; a hash or a subprocess cannot establish
independent authorship. No Shuwen protected cases, production tenants, Studio
code or Hook configuration were used. Broader domains, adversarial provider
behavior, full descendants, independently maintained implementations and
production operations are not qualified by this pilot. Those limits do not
prevent public review of the completed bounded artifact.
