# Comparison Reports

## Real Maintainer Use 0.3

The [field-use index](field-study-summary.md) separates first-run observations,
internal source-based review, post-review follow-up, setup failures and
preparation-only publication fit. These use actual model requests and native
public GitHub reads, not scripted model outputs. They are not additional
provider-write experiments or an independently held-out evaluation.

Each `field-study-*.json` and `field-use-*.jsonl` has an adjacent checksum.
The strengthened replay reads recorded Git blobs as data and recomputes captured
events; it never checks out historical code, calls the model, or writes to the
provider. Full Git history is needed. Missing native evidence remains an explicit
coverage gap, even when all reconstructable checks pass.

## Runtime Pilot 0.2

The [runtime results and replay index](runtime-pilot-summary.md) covers the
completed MCP/SDK, real OPA and controlled GitHub experiment. It includes all
raw reports, first-attempt failures, cost, current-content readbacks and limits.
These results are distinct from the original offline corpus described below.

Current original-corpus run: Spec
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`,
[19 October 2026 03:59:16 UTC](offline-consumers-2026-10-19T03-59-16-707Z.md)
([raw JSON](offline-consumers-2026-10-19T03-59-16-707Z.json)).
That is 18 October 2026, 23:59:16 America/Toronto. Both consumers matched all
102 expected results and all 102 comparisons agreed, with zero adapter faults.

## Original Offline Reports

Each `offline-consumers-*.json` and matching Markdown file describes one actual
local process run. New runs use a new UTC timestamp and never overwrite an
existing report. The source inventories, raw response bytes and runtime versions
are part of the result, not inferred from the repository's current main branch.

The initial public release reports are fresh runs of the public source selection.
Earlier internal development reports remain in the original local archive, not
relabelled as public-release measurements. Git history retains published reports
if a later commit changes an implementation or documentation file.

The [workflow](../.github/workflows/conformance.yml) additionally runs the pinned
sources on Linux and macOS and retains its artifacts for 30 days. Those reruns
are still same-project automated evaluation, not independent external validation.
The checked-in release report remains available after CI artifact expiry.

Every run separately reports 80 frozen public-development cases and 22
post-review regressions. Matching those finite cases is not a population-level
accuracy claim, a production safety guarantee or full core conformance.

Reproduce using [the pinned instructions](../README.md#reproduce-the-original-corpus). Process startup
and communication are included in per-invocation diagnostic timings; those values
must not be interpreted as a runtime performance ranking or an execution SLA.

## Historical Entry-Point Repair Snapshot

Spec commit: `ff5de37da6402c5a0e42d1a9cc7d4880579e374d`.
Run: 19 October 2026, 02:28:28 UTC / 18 October 2026, 22:28:28 America/Toronto.

The [current report](offline-consumers-2026-10-19T02-28-28-994Z.md) and
[raw JSON](offline-consumers-2026-10-19T02-28-28-994Z.json) cover the
[entry-point repair](../CHANGELOG.md). Both consumers matched all 102 expected
results; all 102 cross-consumer comparisons agreed, with zero adapter faults.
The report records 52 stable source hashes and 204 original response frames.

The unit suite now has **144 passing methods**: 36 JavaScript consumer/adapter,
97 Python and 11 benchmark harness/entry-point tests. The five new methods
exercise symbolic-link startup and import safety; they do not add five new
semantic benchmark cases. The corpus remains 80 original cases plus 22
post-review regressions, byte-identical to its original generated contents.

## Historical Initial Public Source Run

Spec commit: `971cad977ee1cc5c8d78cc56bc075fcd0e5898f4`.
Run: 19 October 2026, 02:21:28 UTC / 18 October 2026, 22:21:28 America/Toronto.

| Evidence | Result |
| --- | --- |
| [Human-readable report](offline-consumers-2026-10-19T02-21-28-159Z.md) | 102 cases per consumer; every expected-result check and agreement check matched. |
| [Raw JSON report](offline-consumers-2026-10-19T02-21-28-159Z.json) | 50 source hashes, raw responses and timing diagnostics; sources unchanged during the run. |
| Original public-development subset | JavaScript 80/80; Python 80/80. |
| Post-review regression subset | JavaScript 22/22; Python 22/22. |
| Adapter faults | 0 for JavaScript; 0 for Python. |
| External independent evaluations / live authorizations / real provider effects | 0 / 0 / 0. |

The separate pre-publication unit runs passed 34 JavaScript consumer/adapter
tests, 97 Python tests and 8 harness tests. These are 139 test methods, not 139
additional benchmark actions or independent statistical samples. GitHub CI
reruns them and preserves its own logs rather than inheriting this result.
