# Candidate Readiness and Real-Use Follow-Up

Editorial date: 24 October 2026, America/Toronto. Event times use UTC.

This completes the internally executable part of the
[readiness plan](../docs/implementation-plan-2026-10-24-profile-readiness.md).
It supplies inspectable candidate semantics, stricter report handling, retained
failure evidence and an implementer handoff. It is not a stable standard,
independent evaluation, production gateway qualification or customer deployment.
The original manuscript and historical reports are unchanged.

## Frozen Scope

The live run used Bench `c6345b588e1c15bd6b7e3fb8928663f9240b7354` and
Spec `92f4a686e80c22ee88e964b2281ec1660ea5c81b`. Runtime source inventories
were unchanged throughout. The six tasks, thirty source-review criteria, source
refs, model configuration and 6000-byte report limit remain the edition-two
inputs. Each task was scheduled once, with no automatic model retry, write tool,
customer input or protected collaboration cases. The new local draft-check tool
and its prompt instruction were recorded in
[amendment 3](../field-study/amendment-3.json) before scored requests.

The Spec addition accounts for all 28 CORE requirements without claiming that
all are implemented. Its verifier checks 22 local files and 131 local anchors;
35 separately pinned Bench anchors are explicitly not checked by that CLI.
For this integration, all 35 selectors were separately checked against the exact
Bench `6d4f3c358ca5f68040a1416d751328e9aab041f5` Git blobs and matched uniquely.
Neither anchor check runs a cited test or proves its assertion is sufficient.

The GitHub candidate pins four original normative files and its own manifest
bytes. It does not change the wire profile or supply authorization. A final
code review found that non-string anchor IDs could evade local checking through
JavaScript property-key coercion. Array and numeric counterexamples failed
before the string-type fix and passed afterward. All 61 sidecar tests pass.

## Real Tasks, Not Scripted Model Outputs

These are actual configured Azure model requests and public GitHub reads through
SDK and the pinned official MCP server. Draft checking is local. No comment was
posted in this edition. A ready report means it satisfies the report contract
and matches an accepted recorded draft, not that every statement is correct.

| Task | Lane | Draft body bytes in order | Final body bytes | Recorded result |
| --- | --- | --- | --- | --- |
| Release integrity | SDK | 5649 | 5649 | Contract-ready; required large-file inspection remained unavailable. |
| Clean-clone quickstart | MCP | 6586 | No final report | Oversized draft, then `model_transport_error`; not retried. |
| Consumer migration | SDK | 6884, 6453, 6267, 6002, 5994 | 5994 | Four explicit revisions after rejection; contract-ready. |
| Official MCP compatibility | MCP | 5686 | 5686 | Contract-ready. |
| Limits and recovery | SDK | 6097, 5830 | 5830 | Revised after rejection; contract-ready. |
| Conformance support | MCP | 6103, 5753 | 5753 | Revised after rejection; contract-ready. |

Five of six final reports satisfy the new contract. Only two tasks had a ready
first draft. All twelve draft checks and seven failed drafts remain in the
journal. The two-byte excess in the migration draft was rejected, not rounded
away. No failed final output was replaced by a shortened copy or a later run.

T1's required report inspection returned `reader_unavailable` after about
30 seconds. Its final report explicitly says no digest comparison was performed;
it must not be advertised as a successful integrity verification. T2's seventh
model request failed at the transport boundary after about 60 seconds. The
record does not identify the underlying transport cause, and contains no final
report or usage for that request. Its earlier rejected draft is not a deliverable.

## Separate Content Review

The [internal source-based review](../analysis/review-third-field-use.md) finds
3 complete reports, 2 partial reports and 1 task with no final result, with no
material false claim found in the five finals. T5 omits the required body-digest
extension detail; T6 omits the shared Python projection/no-envelope baseline
distinction. Both omissions remain in the raw results. T1 is a complete account
of an unavailable inspection, not completed byte verification. These judgments
are same-project AI-assisted review, not independent human validation, and do
not change the raw report's mechanical-only scope or establish actual user use.

## Cost and Comparison

This is a sequential repeat of six exposed tasks, not a randomized causal study.
The earlier edition had no local preflight; the new readiness condition is
stricter because it also binds the final report to an accepted draft.

| Measure | Retained edition two | This edition |
| --- | --- | --- |
| Scheduled tasks | 6 | 6 |
| Completed loops with valid final reports and observed citations | 2 | 5 |
| Final reports matching accepted preflight | Not applicable | 5 |
| Model requests, including failures | 35 | 47 |
| Logical native read-tool calls | 29 | 29 |
| Local draft-check calls | 0 | 12 |
| Total study wall time | 332.245 s | 670.567 s |
| Token usage | 173368 reported | Exact total unknown; 339214 reported across 46 of 47 requests. |
| Provider write attempts | 0 | 0 |

The recorded improvement is deliverable-contract reliability, not speed or lower
cost. The new run took about twice as long. Reported token usage is a subtotal,
not an imputation of zero for the failed request. Transport/read failures,
generation variability and explicit revisions all affect the comparison; these
data do not isolate the checker's causal effect or establish customer-wide rates.

## Recompute the Evidence

- [Raw field report](field-study-use-2026-10-24T14-59-47.404Z-d49779b4.json) and [checksum](field-study-use-2026-10-24T14-59-47.404Z-d49779b4.json.sha256).
- [Pre-request freeze](field-study-freeze-2026-10-24T14-48-36.801Z-31f07db1.json) and [checksum](field-study-freeze-2026-10-24T14-48-36.801Z-31f07db1.json.sha256).
- [Complete 291-record journal](field-use-2026-10-24T14-48-36.676Z-c46355.jsonl), whose byte digest is bound by the report.
- [Retained previous report](field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json), including all four oversized final outputs.

The new report SHA-256 is
`21077fac84582bbb12dc3a78c58422a9a4eebf775e5e313b417abf8a6e20667d`.
With both repository histories available locally, from the Bench root:

```sh
node field-study/replay.mjs reports/field-study-use-2026-10-24T14-59-47.404Z-d49779b4.json
node --test field-study/tests/third-edition-evidence.test.mjs
```

Replay passes with no model/provider calls. It reconstructs all 291 records,
27 retained native file observations, 29 native read calls, one unavailable read,
the draft/final bindings and missing usage. The existing
`release_native_envelope_not_retained` coverage gap remains: one release metadata
observation is not a retained native release envelope. Recomputable evidence is
not an independent witness of execution or proof of all provider behavior.

Eight artifact regressions preserve that distinction, including rejection of
inflated readiness, a promoted failed draft, altered feedback, changed final
content, hidden draft failures and invented read/token totals even after all
outer framing hashes are recomputed. They are test methods, not new live tasks.

The final local regression groups pass: 1088 field/analysis/harness methods,
349 runtime JavaScript methods, 50 runtime Python methods, 64 Spec JavaScript
methods, 115 Spec Python methods and 61 sidecar methods. These 1727 methods are
not additional customer tasks or independent benchmark samples. The source
commits also passed [Spec CI](https://github.com/OndCo/Action-Effect-Spec/actions/runs/40104184363)
and [Bench CI](https://github.com/OndCo/Action-Effect-Bench/actions/runs/40104389342)
on Linux and macOS; those CI links precede this new evidence-publication commit.

The two 24 October connectivity-preflight reports are also retained. They used
the working tree before the source commit and are setup evidence only, excluded
from this six-task denominator and not presented as source-frozen measurements.

## Runtime and Compatibility Regression

The [fresh offline consumer report](offline-consumers-2026-10-24T15-00-36-084Z.md)
retains the original 80-case population and 22 exposed regressions. Both language
consumers match 102/102 expected results and agree on 102/102 comparisons, with
zero adapter failures. This does not supply full CORE conformance.

The [fresh runtime report](runtime-pilot-offline-2026-10-24T15-00-44.685Z-52ce65.json)
and [offline replay](runtime-pilot-replay-2026-10-24T15-02-51.299Z-2d17ed.json)
preserve the 55 authored rows, 22 base intents and 108 lane instances. Both the
protocol and complete structured baseline match 108/108 mappings and 52/52
eligible decisions. Their accepted cold-path medians are 47.018 ms and 45.905 ms
respectively; the protocol is not advertised as faster. Source inventories are
stable and no provider writes occur. These authored checks are not a sample of
108 independent customer tasks.

Sixteen new compound regressions exercise the real mapper, Python checker, OPA
and filesystem ledger with a synthetic provider. Revocation prevents a new send;
reconciling a prior completion does not grant new authority. Unknown or ambiguous
completion is not resent when grants return. Policy errors and changed actors
remain withheld. This adds failure-composition coverage, not sixteen new GitHub
side effects or atomic authorization across a remote SaaS boundary.

## Decision and Remaining Gates

The [implementer handoff](../docs/adoption/profile-candidate-handoff.md) is ready
for scoped technical discussion without an OSuite account. External independent
implementations, protected evaluation custody and actual recipient acceptance
remain unmeasured. A second platform requires a partner's real workflow and its
own bounded profile, not a rename of the GitHub tuple. Stable status also requires
evidence for applicable mandatory obligations, agreed failure semantics and
deployment-owner acceptance. No invitations, stable tag, Studio deployment,
Hook activation or manuscript revision were performed in this round.
