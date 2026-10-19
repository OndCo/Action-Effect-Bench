# Comparison Reports

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

Reproduce using [the pinned instructions](../README.md#reproduce). Process startup
and communication are included in per-invocation diagnostic timings; those values
must not be interpreted as a runtime performance ranking or an execution SLA.

## Initial Public Source Run

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
