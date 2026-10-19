# Measurement Record and Reproduction

Editorial revision: 19 October 2026, America/Toronto (EDT, UTC-04:00).
Working paper for public review. Toronto is an editorial timezone, not execution
geolocation. This record maps completed, bounded measurements to retained
artifacts; it does not redefine the protocol or claim external validation.

## Sources and Artifact Map

The measured Bench commit is
[`9f638df`](https://github.com/OndCo/Action-Effect-Bench/commit/9f638df994504ba6f5d82c0b5409922a0be7a72e).
Spec [`v0.2.0-draft.1`](https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1)
is pinned by [spec-lock.json](../spec-lock.json) to
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`; core wire version remains
`0.1.0-draft.1`. Full commit, profile, lock, executable and per-file hashes
are in the reports and [sources.json](sources.json).

| Retained artifact | Scope |
| --- | --- |
| [Offline report](../reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json) | 216 strategy rows, 26 reference-authority checks, 26 deliberately corrupted diagnostic rows |
| [Offline replay](../reports/runtime-pilot-replay-2026-10-19T04-24-39.129Z-61da80.json) | Valid; 216 strategy rows plus 52 reference/diagnostic records |
| [Live report](../reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json) | 32 planned slots, exact outcomes/reasons, four fault witnesses, timings and 12 unique comment receipts |
| [Live attempt journal](../reports/runtime-pilot-live-attempt-338f0652-715c-4095-84df-4f19d8e2f8c7.jsonl) | 66 records: begin, 32 scheduled, 32 result, end |
| [Live public replay](../reports/runtime-pilot-replay-2026-10-19T04-26-57.109Z-690395.json) | Valid; 32 rows and 12 successful anonymous current-content GETs |
| [First failed attempt](../reports/runtime-pilot-offline-2026-10-19T03-40-48.927Z-769420.json) | Preserved failure, not replayable as an exact initial executable tree |
| [Original-profile rerun](../reports/offline-consumers-2026-10-19T03-59-16-707Z.json) | Separate legacy 102-case comparison; not new runtime measurements |
| [Editorial arithmetic audit](measurement-audit.json) | Report/checksum, denominator, source-blob and journal consistency checks; not another runtime run |
| [Results index](../reports/runtime-pilot-summary.md) | Human-readable results and verification history |

Each raw report and the attempt journal has an adjacent `.sha256` file.
The final offline and live report digests are respectively
`d2244f7a2704d6fb3624969b146e37581a181ced0cc2c88daab8675d72ef8662`
and `6459f4f5494392774e6dba938fe555c223c944657bfbc772476bf551c1a8f1da`.
Both report stable source inventories. All 49 recorded source entries match
the frozen Git blobs in the editorial audit. Bench's reported dirty state
includes documentation and reports; no clean-worktree claim is substituted.

The current case-manifest digest is
`17afe9ecdb4e4f8894ae410fef5e537c903b5597dd290d20c8e6d1b8447622ce`;
the retained corpus digest is
`f452e4fcb30a04bebe179ca6a3393b0a006497ddee2f110440bcd0e3b476ca17`.
The corrected custody record is a pre-execution/pre-result freeze, not a
pre-implementation freeze. Cases and labels are same-project, AI-assisted
public development, with no external cohort.

## Counts and Meaning

| Population/check | Observed value |
| --- | --- |
| Authored cases / base intents | 55 / 22 |
| SDK / MCP renderings per strategy | 53 / 55, or 108 lane instances |
| Both strategies combined | 216 rows, not independent tasks |
| Exact mapping/status/reason per strategy | 108/108 |
| Accepted partial / invalid / untrusted / unsupported per strategy | 52 / 51 / 4 / 1 |
| Eligible decisions per strategy | 52/52 exact: 22 allow, 28 deny, 2 review |
| Remaining authorization states per strategy | 56 not evaluated after nonacceptance |
| False allow on deny/review; expected allow not allowed | 0/30; 0/22 per strategy |
| Real masked mapping defects / operational failures, final offline | 0 / 0 per strategy |
| Pure reference-projection authorization | 26/26: 11 allow, 14 deny, 1 review |
| Deliberately corrupted body-digest diagnostic | 0/26 mapping; 26/26 unchanged policy decisions |
| Live planned checks | 32/32 total, 16/16 per strategy |
| Live immediate / initially unknown then recovered / duplicate-suppressed | 4 / 2 / 2 per strategy |
| Live withheld per strategy | 4 denials, 2 reviews, 2 invalid-policy evaluation failures |
| New comments | 12 total, from zero initial comments |
| External independently authored evaluations | 0 |

Mapping equality compares status, reason and the exact supported projection;
it is not a full-core conformance or arbitrary effect-inference metric.
All accepted mappings retain partial direct scope. Nonacceptance and policy
denial are different outcomes. The pure reference control is separately
authored within this project, not an external oracle.

The 26 planted digest errors demonstrate a scoring blind spot, not a competitor
weakness, natural defect frequency or attack rate. Live invalid-policy failures
remain failures even though correct classification/withholding passes a planned
check. Four lost-ACK unknowns are 4/12 new-create attempts and 4/32 scheduled
slots by design. SDK/MCP pairs and variants are related observations.

## Provider and Recovery Boundary

The live run on [issue #1](https://github.com/OndCo/Action-Effect-Bench/issues/1)
started at `2026-10-19T04:24:32.195Z` and finished at
`2026-10-19T04:26:11.245Z`. The report contains all 12 public comment links.
Do not reuse this issue for another live run.

Each controlled lost ACK has `successful_post_ack_discarded: true`; an actual
successful provider response was discarded by the trusted harness. Each recovery
has `automatic_resend: false`. This is fault injection, not a natural outage.
Known response IDs bind exact GET results. ID-less recovery needs a complete
pre-dispatch list, a previously absent ID, and a unique exact body/actor match
on the dedicated single-writer issue. Its explicit evidence is
`new-current-content-since-preflight-not-execution-attribution`.

Snapshots across asynchronous waits, current-policy reload and response-ID
checks address specific reviewed defects. They do not establish global
revocation atomicity, adversarial concurrent-writer safety, causal execution
attribution or distributed exactly-once delivery. Notification recipients,
delivery, webhooks and other provider descendants remain unknown.

The first failure's apparent 52 masked errors per strategy arose from the
scorer's object-prototype comparison. A serialized-JSON value audit finds no
such real masked defect, but eight structured error-semantic mismatches.
All 216 input/context/policy and expected records are unchanged between first
and final reports. The original complete failing executable tree was not
archived; only its retained report and hashes are claimed.

## Cost and Verification

Accepted offline medians are **50.391 ms protocol** and **48.468 ms
structured**, n=52 per path: a 1.923 ms or 3.97% higher protocol median.
These include mapping/checking, Python process communication and real OPA
startup, including denied/reviewed accepted inputs. They are not useful-task
completion times.

All-input medians are 0.042 versus 44.507 ms, n=108. The protocol rejects
56 inputs before Python, whereas the structured adapter starts Python.
This is not a comparable useful-task speedup. No latency headline is drawn
from that mixed workload.

Normal live medians are 3110.848 versus 3161.205 ms, n=4 per path.
The full 99.049-second run includes one-second pacing waits excluded from
row timers. Early rows overlapped same-host read-only offline replay, so this
was not an isolated performance run. No speed ranking, throughput or SLA is
inferred. Raw measurements, not inferred zeros, define cost coverage.

The reports identify Darwin arm64, Apple M4 Pro, 14 logical CPUs, 24 GiB memory,
Node 22.18.0, Python 3.9.6, MCP SDK 1.32.1, Octokit 22.0.1 and OPA 1.21.2.
[Linux/macOS CI](https://github.com/OndCo/Action-Effect-Bench/actions/runs/39199258635)
succeeded at the measured source. Reported unit totals are 75 JavaScript
(64 Spec + 11 legacy Bench), 115 Spec Python, 333 runtime JavaScript and
50 runtime Python: **573 methods**, not cases or extra independent runs.
Subsequent verification reported a local OPA redownload timeout followed by
verification of the same-hash cached binary and passing tests/replays.
That installation event is not concealed as an uninterrupted download or
counted as another external study.

Human effort, monetary cost, sustained load, tail latency, customer utility,
and complete descendant effects were not measured. The bounded observations
do not populate those fields with zeros or proxy claims.

## Reproduce Without New Writes

Install the locked dependencies and OPA using the
[quickstart](../docs/adoption/quickstart.md). From the Bench root:

```sh
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
node runtime-pilot/replay.mjs reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json --github
```

These commands write local verification reports but never repeat a provider
POST. Replay checks source/byte identities, calculations, current mappings/OPA,
journal consistency and, with `--github`, current public content. Duplicate
occurrences remain not reauthorized; 32 replayed rows are not 32 fresh grants.
The recorded public replay checked all 12 comments at
`2026-10-19T04:26:57.108Z`. Later deletion, change or rate limiting must remain
an unavailable/failed check.

A report and checksum can be forged together. Replay is not operator
authentication, historical fsync proof, execution causality or reproduction of
original wall-clock timing. Use separately retained trusted pins and actual
custody for stronger evidence. Publication of this working paper does not
authorize submission, external authorship, customer deployment or new writes.

## Real Maintainer Use: Separate Population

The field-use extension uses six exposed maintenance intents over the pinned
public repositories. Three use Octokit and three use the actual official
GitHub MCP stdio server. The model chooses reads and writes report text through
the existing Azure Responses deployment. It has no offered write or arbitrary
shell tool. This is real model/provider operation under an internal bounded
study, not a customer deployment or a governed comment-write experiment.

| Record | First run | Post-review repeat |
| --- | --- | --- |
| Runtime commit | `bc1d389a474c37a9c38b2b5acedbd7bb65650225` | `dff6ba72e36842334fcc61d8d2c5f3545084898e` |
| Evidence commit | `eff7bf6bee237162a7f321bbb131008f880346fb` | `7306d8b45402bb2ee7f9a1fbaf7203835e599110` |
| Raw report | [First](../reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json) | [Second](../reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json) |
| Raw SHA-256 | `cdc07b7a10000a4fe96152a6a460f5633c3403bcc7c0cd8f3f68f8e1a5cbe9fc` | `e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999` |
| Tasks / distinct intents | 6 / 6 | Same 6 / same 6 |
| Model requests / read calls | 35 / 29 | 35 / 29 |
| Recorded completed / failed loops | 6 / 0 | 2 / 4 |
| Report bodies within 6,000 bytes | 1 / 6 | 2 / 6 |
| Provider-reported input / output tokens | 155,343 / 12,540 | 161,943 / 11,425 |
| Sum of task wall spans, ms | 326,744.573 | 331,794.263 |
| New provider writes | 0 | 0 |

The first run's 6/6 loop completion cannot establish its output-contract
compliance: task and runtime instructions disagreed about raw Markdown versus
JSON and 6,000 versus 7,000 bytes. The original scorer tested a separate
8,192-byte profile budget. The repeat fixes a JSON envelope and 6,000-byte body
ceiling before execution, adds current-channel metadata, and retains the same
30 fact records and source references. Its four over-budget reports remain
failed with their full final JSON; they are not silently truncated or omitted.
These exposed repeated intents do not support a causal before/after estimate.

The first internal source review found 27 facts met, two partial and one
incorrect. This is AI-assisted same-project judgment, not independent labels or
human acceptance. Exact quotations and grading arithmetic have a separate
[audit](../reports/field-study-review-audit-2026-10-19T07-07-08.416Z-b7a13a14.json).
The [field-use index](../reports/field-study-summary.md) links the separate
follow-up review, native observations, setup failures and final readiness.

Each run has 28 native-bound file observations, 27 retained file texts and one
normalized release-metadata observation. Replay reports the missing native
release envelope as a gap. No release asset was downloaded. Model identity is
the configured deployment and returned model string, not immutable weights.
Token counts are provider reports, not an invoice or unique-source-byte count.

### Publication Preparation Is Not Task Completion

The first [fit analysis](../reports/field-study-publication-fit-2026-10-19T06-40-15.561Z-bdcae674.json)
and [follow-up fit analysis](../reports/field-study-publication-fit-2026-10-19T07-18-12.145Z-b1330df7.json)
each have 24 related rows: six retained outputs, two representations, two
preparation strategies. Placeholder targets are synthetic; neither invokes
OPA, reserves an occurrence, calls a model, or sends to GitHub.

First-run standalone packaging fits the 8,192-byte profile in three of six
cases; linked handoffs fit all six. All six repeat standalone bodies and linked
handoffs fit. Both strategies give the same preparation outcomes. Four repeat
task reports still fail their independent 6,000-byte requirement. A description
being accepted as partial does not repair task failure, validate its conclusion
or authorize publication.

### Recompute Captured Field Evidence

Use a full Bench clone and the pinned Spec sibling. These commands perform no
model or provider request and do not execute historical source blobs:

```sh
node field-study/replay.mjs reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json
node field-study/replay.mjs reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json
```

The two retained [first replay](../reports/field-study-replay-2026-10-19T07-10-32.901Z-82046180.json)
and [second replay](../reports/field-study-replay-2026-10-19T07-18-25.099Z-3c9423af.json)
check 242 and 246 records respectively. Source identity, configuration,
setup inventory, task prompts, visible model outputs, tool order, counters,
captured bytes and terminal results are reconstructed. Valid replay can
faithfully establish the presence of failed task outcomes; it does not turn
those failures into success or recreate stochastic generation.

## Owned Native Delivery and Recovery Addendum

This subsequent cohort is separate from both read-only model runs and the
older scripted mutation pilot. Its source is
`f93b1cfcbf2c2665b4acc7c5dc8fb92d1ba8d6b6`, with the unchanged Spec pin.
It reuses the amended run's exact six report candidates and internal review.
T1/T4 qualify; the four task-budget failures remain withheld. No new model
answer, changed fact label or automatic shortening enters the cohort.

The [raw study](../reports/owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json)
has SHA-256 `735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7`.
Its frozen plan defines two ordinary deliveries and six distinct fault
conditions, eight initial native proposals, four recoveries, eight duplicate
probes and twenty actual worker processes. Both preparations match eight
initial references, but only one strategy dispatches per scenario. Therefore
sixteen shadow matches are not sixteen independent/live cases.

The report contains five native comment-call permits and five actual objects
on [issue #2](https://github.com/OndCo/Action-Effect-Bench/issues/2). Two objects
are eligible model reports and three are synthetic fault controls. Two current
authority denials send nothing; three delivered-but-unacknowledged actions
recover by reads; the pre-send crash remains unknown. All eight probes make
no further call. The earlier pre-reservation failure remains required evidence
for adopting the same empty issue, not an omitted attempted run.

Twenty worker journals plus the supervisor contain 283 records. Offline replay
checks source blobs, manifest bytes, references, current policy, process exits,
ledger continuity, replies, permits and final content. A separate six-GET
[anonymous audit](../reports/owned-write-audit-2026-10-19T13-58-07.840Z-d8467612.json)
matches the issue and all five comment body/ID/URL/author commitments at the
recorded observation times. These checks do not authenticate an untrusted
operator or observe complete provider descendants.

Whole-run cost is 52436.647875 ms; nested gate, process, consumer, networking
and fault waits must not be added twice. Killed workers lack terminal gate
timers: missing is not zero. Gate and process costs are descriptive, not
paired live strategy comparisons. The SDK/MCP task goals differ and shadow
order is fixed. Actual human usefulness, multi-host recovery, atomic remote
revocation and production SLA remain unmeasured.

```sh
node field-study/write-replay.mjs reports/owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json
node analysis/owned-write-audit.mjs
```

Both commands are offline. Explicit `--public` on the audit adds only six
fixed anonymous GETs, retaining any rate limit, content change or failure; it
never sends a mutation, credentials, redirect or retry.
