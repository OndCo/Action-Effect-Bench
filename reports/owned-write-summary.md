# Owned Native Delivery and Recovery

Editorial date: 19 October 2026, America/Toronto. Evidence timestamps are UTC.
This is same-project self-use on real GitHub, not a customer deployment or
independent external evaluation. No Studio, Hook or protected data was changed.

## What Happened

The six actual model outputs from the amended read-only run were retained.
T1 (release integrity) and T4 (official-MCP compatibility) meet the original
task budget and internal source-review criteria. The four oversized outputs
remain task-layer withheld; no model retry, trimming or revised grade made them
eligible. The two complete report bodies were delivered, respectively, through
Octokit and the official pinned GitHub MCP server, to one dedicated public issue.

- [Actual issue and five comments](https://github.com/OndCo/Action-Effect-Bench/issues/2).
- [Source at execution](https://github.com/OndCo/Action-Effect-Bench/commit/f93b1cfcbf2c2665b4acc7c5dc8fb92d1ba8d6b6).
- [Raw study](owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json), SHA-256
  `735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7`.
- [Offline reconstruction](owned-write-replay-2026-10-19T13-50-51.561Z-2e5d127c.json), SHA-256
  `50a150f868ae00b065bbae35b1f782988a474cb0533cc526746f7f217302d384`.
- [Quantitative and public-content audit](owned-write-audit-2026-10-19T13-58-07.840Z-d8467612.json), SHA-256
  `89757bc8f869d5ee6f4f900e6f63cf5bb5836b2fbb313f51117821f1da836a82`.
  Six anonymous GETs returned HTTP 200 and matched the issue plus five exact
  comments at 13:58:03--13:58:07 UTC. These are current-content observations.
- [Earlier pre-reservation failure](owned-write-pre-reservation-failure.md),
  retained and linked into the new manifest. The existing empty issue was
  inspected and adopted; no second issue was created.

## Separate Denominators

| Population | Observation |
| --- | --- |
| Six original model candidates | Two eligible; four still fail the task budget |
| Two ordinary report deliveries | Two confirmed, one per native lane |
| Six separate controlled faults | Two current-policy denials; one pre-send crash; three delivered-but-unacknowledged effects |
| Twenty distinct worker processes | Eight initial, four read-only recovery, eight duplicate probes |
| Eight initial native proposals | Both preparation strategies match all eight literal references |
| Native comment calls / new objects | Five / five; only two objects are model reports |
| Recovery | Three current-content confirmations; one retained unknown |
| Duplicate probes | Eight suppressed; zero new native comment calls |
| Evidence | 21 journals, 283 records, 78 frozen source-file entries |
| Independent human evaluations / new model calls | Zero / zero in this continuation |

## Actual Fault Cuts

| Scenario | Initial result | Recovery | Native calls / objects |
| --- | --- | --- | ---: |
| Release-integrity report, SDK | Confirmed | Not needed | 1 / 1 |
| Compatibility report, official MCP | Confirmed | Not needed | 1 / 1 |
| Policy revoked after preflight | Withheld: revoked | Not needed | 0 / 0 |
| Body limit narrowed after preflight | Withheld: body too large | Not needed | 0 / 0 |
| SIGKILL after inflight state, before send | Process killed | Unknown; no unique readback | 0 / 0 |
| SIGKILL after actual MCP reply, before receipt | Process killed | Confirmed by read-only search | 1 / 1 |
| Actual SDK reply withheld until timer expires | Unknown | Confirmed by read-only search | 1 / 1 |
| Actual MCP reply discarded, stdio disconnected | Unknown | Confirmed by read-only search | 1 / 1 |

These are real process kills, actual provider effects and actual transport
closure. Fault timing is deliberately injected; it is not a naturally observed
outage. The application-level comment-call ceiling is twelve across children;
five permits were consumed. Internal HTTP attempts inside the official server
were not instrumented. Read-only recovery does not free or replace an uncertain
occurrence so that it can be sent again.

The supervisor knows it killed the pre-send worker before the call. The gate
does not use that external knowledge as proof of non-delivery: after restart,
no matching object means unknown, not success and not authority to resend.

## Complete Cost Boundary

The 52,436.648 ms supervisor span includes worker startup, both preparation
shadows, source/binary checks, network operations, deliberate faults and final
observations. Earlier issue creation and setup are excluded, separate costs.
The two ordinary gates took 3,589.962 and 4,775.226 ms; their
whole worker lifetimes were 4,049.513 and 5,346.507 ms. The gate's OPA spans
were 20.581 and 20.339 ms, not the complete user-visible latency.

Three confirming recoveries took 898.529--2,008.267 ms within the gate and
1,323.215--2,437.639 ms as full processes. Eight no-send probes took
34.610--41.902 ms inside the gate, or 446.024--480.242 ms with process startup
and the evidence checks. These are observed minima/maxima, not percentiles.

Different scenarios choose different live preparation strategies. Shadows
always run protocol first, then structured. This is not a randomized, paired
live speed comparison. The earlier offline comparison's measured 3.97% extra
protocol cost remains unchanged; no speed superiority, throughput or SLA is
claimed here.

## Reproduce Without Sending

Use a full Bench clone, the pinned Spec sibling, locked runtime dependencies
and pinned OPA from the [v0.4 replay guide](../docs/replay-v0.4.0.md):

```sh
node field-study/write-replay.mjs reports/owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json
node analysis/owned-write-audit.mjs
```

This reconstructs historical sources as data, plan/population, native request
bytes, reference projections, current authority, actual recorded cuts, ledger
continuity, call permits and final content. It needs neither a model key nor
GitHub login. Missing source history, changed content or missing journals fail
the check. Never run `--setup` or `--execute` to replay this result.

## What This Does Not Prove

The result supports bounded owned-use of the comment profile. It does not
establish independent human usefulness, broad task completion, natural failure
rates, hosted-MCP authentication, multi-host recovery, or complete provider
descendants. The ledger is one-host durable storage, not a cross-SaaS atomic
transaction. Revocation after the last local policy read but before remote
commit remains a race; a second same-account writer can defeat attribution.
Current content can later change. Hashes detect differences relative to a
retained commitment, not fabrication by an operator controlling every input.

The [full manuscript](../paper/manuscript.md#812-owned-delivery-real-process-failure-and-recovery)
connects these findings to the protocol, checking algorithm, invariants,
counterexamples and complete-baseline comparison. The draft is ready for
specific external technical scrutiny, not an assertion of universal standard
conformance or production certification.
