# Real Maintainer Use: Evidence and Readiness

Editorial date: 19 October 2026, America/Toronto. Event timestamps are UTC.

## What Actually Ran

Six distinct repository-maintenance tasks used the existing Azure Responses
deployment and real public GitHub reads. Three tasks used Octokit and three
used the pinned official GitHub MCP server as a local stdio process. The model
selected its reads and wrote reports; its answers were not scripted fixtures.
The task sources were immutable public revisions of these two repositories.

This is same-project self-use, not customer production or independent external
validation. Reads were constrained by an allowlist outside the comment profile.
No GitHub write was made during these read-only runs. The separately recorded
[owned-write continuation](owned-write-summary.md) delivers two eligible
outputs and tests six fault conditions without rerunning the model. The earlier [12-comment controlled live
experiment](runtime-pilot-summary.md) remains a separate population, with its
own custom MCP server and deliberately injected failures.

## First Run

- [Raw report](field-study-use-2026-10-19T06-33-57.736Z-0e238334.json), SHA-256
  `cdc07b7a10000a4fe96152a6a460f5633c3403bcc7c0cd8f3f68f8e1a5cbe9fc`.
- [Pre-request freeze](field-study-freeze-2026-10-19T06-28-30.451Z-e3d388eb.json).
- [Original journal](field-use-2026-10-19T06-28-30.337Z-3ede5a.jsonl): 242 records.
- Runtime source: `bc1d389a474c37a9c38b2b5acedbd7bb65650225`.
- Evidence commit: `eff7bf6bee237162a7f321bbb131008f880346fb`.
- [Internal source-based review](../analysis/review-first-field-use.md) and
  [machine-readable labels](../analysis/review-first-field-use.json).
- [Review arithmetic and quote audit](field-study-review-audit-2026-10-19T07-07-08.416Z-b7a13a14.json).

| Task | Native lane | Model requests | Read calls | Task wall, ms | Report body, UTF-8 bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| Release integrity | SDK | 7 | 6 | 79,893.440 | 5,872 |
| Clean-clone quickstart | Official MCP | 6 | 5 | 50,447.211 | 7,270 |
| Consumer migration | SDK | 4 | 3 | 44,750.881 | 7,981 |
| Official MCP compatibility | Official MCP | 6 | 5 | 49,512.368 | 7,284 |
| Limits and recovery | SDK | 6 | 5 | 50,971.146 | 6,836 |
| Conformance support | Official MCP | 6 | 5 | 51,169.527 | 7,159 |

All six loops produced schema-valid JSON; all 29 citation URLs pointed to
observed sources. Those checks did **not** establish correct conclusions or
useful completion. The 35 model requests used 155,343 reported input tokens and
12,540 output tokens. Task wall times sum to 326,744.573 ms. These are unpaired
tasks, not a speed comparison between SDK and MCP or a service SLA.

### Problems Found, Not Hidden

The first task definitions requested a Markdown answer within 6,000 bytes,
while the harness appended a JSON-envelope instruction aiming below 7,000 body
bytes. Its mechanical scorer instead checked the profile's 8,192-byte limit.
All six bodies fit 8,192 bytes, but only one fit 6,000. This conflicting contract
is a harness defect, not a clean model instruction-following experiment.

Same-project, AI-assisted source review found 27 of 30 required facts met,
two partially covered, and one incorrect. The material error was a report
claiming that no server or provider operation had been exercised during a task
that had made actual official-MCP reads. The original model-visible results did
not expose current native-channel identity. The review also found omitted
body-hash binding and incomplete explanation of the matched baseline. Labels
are not independent human judgments, and actual human task acceptance is unknown.

The quote audit checks literal quotations, frozen criterion IDs, source
references, byte counts and grade arithmetic. It does not independently certify
the reviewer's semantic interpretation. The derived substantive/body-budget
grades are one complete, four partial and one incorrect; even the first grade
does not retroactively fix the original raw-Markdown versus JSON conflict.

### Publication Fit Is a Separate Check

[Preparation-only analysis](field-study-publication-fit-2026-10-19T06-40-15.561Z-bdcae674.json)
used the six actual reports, not six new tasks. Adding headings, conclusions and
all citations produced standalone comment bodies of 7,086, 8,264, 8,798, 8,356,
7,835 and 8,050 bytes. Three exceeded the profile's 8,192-byte limit. Both the
protocol path and complete structured baseline rejected those three and
accepted the other three as partial descriptions, without granting authority.

An alternative handoff containing the conclusion, an immutable artifact link
and a report-object digest fit in 613-787 bytes for every task. Both paths
accepted all six handoffs as partial descriptions. No OPA decision, ledger
reservation, model request or provider write occurred in this analysis. A valid
handoff does not make its linked report correct; changing packaging changes
the exact action body and requires a new binding.

## Repairs and Follow-Up Contract

[Amendment 2](../field-study/amendment-2.json) retains the same six task goals,
lanes, allowed sources and 30 required facts. It fixes one JSON response
contract with a 6,000-byte `report_markdown` ceiling, exposes current channel
metadata, and makes a journal failure stop the session rather than become an
ordinary missing tool result. Oversized reports are retained as failures, not
silently truncated or automatically rewritten.

A repeat after these changes is explicitly post-review follow-up. It is not a
new held-out cohort, six additional independent intents, or causal evidence for
any one fix. The first report and its original executable source remain intact.

## Recorded Follow-Up

The [second raw report](field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json)
has SHA-256 `e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999`.
Its runtime is `dff6ba72e36842334fcc61d8d2c5f3545084898e`, and its evidence
commit is `7306d8b45402bb2ee7f9a1fbaf7203835e599110`.
The [246-record journal](field-use-2026-10-19T07-10-06.329Z-1a193a.jsonl),
[pre-request freeze](field-study-freeze-2026-10-19T07-10-06.472Z-419977b3.json)
and [strict replay result](field-study-replay-2026-10-19T07-18-25.099Z-3c9423af.json)
are retained independently from the first run.

| Task | Report body bytes | Follow-up outcome | Task wall, ms |
| --- | ---: | --- | ---: |
| Release integrity | 5,168 | Completed loop | 82,818.211 |
| Clean-clone quickstart | 6,272 | Failed: report budget | 51,893.392 |
| Consumer migration | 7,051 | Failed: report budget | 43,425.587 |
| Official MCP compatibility | 5,997 | Completed loop | 52,504.850 |
| Limits and recovery | 6,267 | Failed: report budget | 49,715.020 |
| Conformance support | 6,454 | Failed: report budget | 51,437.203 |

The process returned nonzero: only two of six loops met the amended output
contract. All six final JSON strings remain in the raw evidence, including the
four rejected reports. No truncation or automatic rewrite was used. The frozen
scorer's `schema_valid_reports` is gated on completed status and therefore says
two; it is not a statement that the other four retained JSON strings cannot be
parsed. Separate source review must still judge their content.

The [second internal review](../analysis/review-second-field-use.md) assesses
the same 30 frozen facts: 28 met, two partial, none incorrect. The two remaining
omissions concern critical body-digest binding and the complete baseline's
shared controls. T4 no longer makes the first run's false categorical claim
about current provider use. The [quote/arithmetic
audit](field-study-review-audit-2026-10-19T07-23-39.012Z-f5138821.json) checks
30 literal report quotations and the frozen references. This is still
same-project AI-assisted review, not human acceptance or independent validation.

The run made 35 model requests and 29 read calls, with 161,943 reported input
tokens and 11,425 output tokens, totaling 173,368. Task spans sum to
331,794.263 ms. Across both runs there were 70 model requests and 58 read calls
for the **same six intents**, not twelve independent workloads.

[Second publication-fit analysis](field-study-publication-fit-2026-10-19T07-18-12.145Z-b1330df7.json)
prepared all six retained outputs, including the four failed task reports.
Standalone bodies were 6,486-7,834 bytes and handoffs 743-928 bytes. Both
strategies accepted all twelve representations as partial descriptions under
the separate 8,192-byte profile. These 24 related preparation rows are not
24 grants or executions. The result directly demonstrates that a valid action
description does not establish compliance with an upstream task requirement.

## Post-Run Reliability Repairs

Source `c72369af0f3e3f3c7010d7e8bab3cb95ba3c0b79` repairs an additional
runner-level journal failure found during review. A failure may occur after
bytes have reached storage; no further append or seal is then attempted, the
opened MCP session is closed, and the process exits nonzero without a normal
`recorded` report. Existing journal bytes are not replaced or retried.

Thirty-seven injected runner tests include failures before/after possible
persistence, native setup, model/tool records, task completion, cleanup and
sealing. Thirty-five first failed against the old runner. These execute the
real orchestration body with injected side-effect dependencies; they do not
simulate a real power loss or add another Azure/provider trial. The two real
runs did not encounter a journal failure and keep their original source pins.

The same commit fixes a symlinked publication-analysis command that could
otherwise exit without running. Three entry-point regressions cover both
analysis commands and import safety. Existing calculations and retained
packaging reports are unchanged.

The v0.3 local regression: 408 existing JavaScript methods, 115 Spec Python,
50 runtime Python, and 520 field/analysis methods: **1,093 passing methods**.
They are software tests, not 1,093 independent real-use tasks. Both original
field runs and their unsuccessful outcomes still pass strict evidence replay.

A [fresh anonymous readback](runtime-pilot-replay-2026-10-19T07-38-25.829Z-9d9db8.json)
also matched all 12 comments from the old controlled live pilot. This used only
GETs and checks current content; it adds neither new writes nor new historical
causality evidence. The [release verification record](release-verification-v0.3.0.md)
keeps these populations separate.

## Native Setup and Replay Boundaries

The official MCP release is `v2.0.2`, source
`eb47a99ddb866ca2b8a162920e6bda9521f33ebb`. The archived binary is hash-pinned;
that is not a reproducible-build attestation. Actual negotiation was
`2025-11-25`, not the later typed-output protocol described in upstream docs.
The hosted remote MCP service and its authentication flow were not tested.

The initial archive download failed with HTTP/2 curl exit 16; a separately
recorded HTTP/1.1 attempt succeeded. Initial MCP startup rejected the hostname
without a scheme; `--gh-host=https://github.com` corrected that assumption.
These setup failures remain in `field-study-setup-*` and
`field-study-preflight-*` artifacts, not erased or counted as task completions.

Replay checks hashes, frozen Git blobs, event order, task control flow,
counters, captured source bytes and derived mechanical results without model or
provider calls. First-run replay binds 28 file observations, including 27
retained text observations. One release metadata observation lacks a retained
native release envelope and is explicitly reported as a coverage gap. No
release-asset bytes were captured in that run. Replay does not prove provider
honesty, reproduce stochastic generation, or establish historical remote cause.

```sh
node field-study/replay.mjs reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json
node field-study/replay.mjs reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json
node analysis/review-audit.mjs reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json analysis/review-first-field-use.json
node analysis/review-audit.mjs reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json analysis/review-second-field-use.json
```

Use a full Bench clone so the recorded source commits are available, with the
Spec sibling at `spec-lock.json`'s pin. No credentials are needed for these
commands. A missing historical commit fails replay; it is not fetched or
executed automatically.

## Readiness Boundary

The observations justify concrete technical review, not customer deployment
qualification. The [v0.4 continuation](owned-write-summary.md) now observes
two eligible report deliveries, official-server writes and six controlled
process/acknowledgment conditions. It does not add model intents or turn the
four failed candidates into successes. Hosted MCP authentication, independent
evaluation, multi-host recovery, human usefulness and sustained production
remain unmeasured. No external invitation or customer action was issued;
Studio and its Hook were not changed.
