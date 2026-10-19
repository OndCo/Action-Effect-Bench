# Release Verification: Real Maintainer Use and Full Manuscript

Editorial date: 19 October 2026, America/Toronto. Event times are UTC.
This records same-project release checks, not external certification.

## Frozen Sources and Preserved Evidence

Spec remains `a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40` and its
`v0.2.0-draft.1` release. Bench's old `v0.2.0-draft.1` tag and release assets
are unchanged. Field run one uses `bc1d389a474c37a9c38b2b5acedbd7bb65650225`;
run two uses `dff6ba72e36842334fcc61d8d2c5f3545084898e`.
Post-run repairs at `c72369af0f3e3f3c7010d7e8bab3cb95ba3c0b79` do not relabel
either measured runtime. See [the evidence index](field-study-summary.md).

## Local Regression

| Test population | Passing methods | Failing / skipped |
| --- | ---: | ---: |
| Existing Spec/harness/runtime JavaScript | 408 | 0 / 0 |
| Spec Python | 115 | 0 / 0 |
| Runtime Python | 50 | 0 / 0 |
| New field-use JavaScript | 510 | 0 / 0 |
| Publication/review analysis JavaScript | 10 | 0 / 0 |
| Total | 1,093 | 0 / 0 |

These are software methods, not independent workloads. Thirty-seven field
tests execute the real runner body with injected journal faults; 35 first
failed against the prior runner. This qualifies fail-stop orchestration under
those injections, not actual power-loss durability. Three entry-point tests
also reproduce and repair a silent symlinked analysis-command exit.

The checked-in CI runs the suite on Linux/Node 22/Python 3.11 and
macOS/Node 24/Python 3.13, plus no-network field replay and review audits.
The [Actions history](https://github.com/OndCo/Action-Effect-Bench/actions)
is the source of remote CI status; this local record does not predict a result.

## Evidence and Public-Scope Checks

- Strict replay passes for the first 242-record and second 246-record journals,
  retaining the second run's four failed task reports. Each has one explicit
  normalized-release-envelope coverage gap.
- Both internal review audits pass quote, frozen-source, byte-count and grade
  arithmetic checks. This does not independently validate semantic labels.
- The old offline replay validates 216 strategy rows and 52 reference/diagnostic
  records. A [fresh old-pilot live replay](runtime-pilot-replay-2026-10-19T07-38-25.829Z-9d9db8.json)
  validates 32 scheduled checks and matches 12/12 current public comment bodies
  at `2026-10-19T07:38:25.829Z`. These are GETs, not new writes or proof of cause.
- A pre-release scan checks 23 selected field-report/review JSON or JSONL files,
  totaling 519 top-level records, with the public-value validator and private-path
  and private-key-marker checks. No credential/private-path finding was reported.
  This is a bounded automated check, not proof that arbitrary data are public.
- All 29 checksum sidecars then present under `reports/` match their file bytes.
  The original reports, including failures, were not edited to obtain these matches.
- All 125 local Markdown links in the 15 changed Markdown candidates at that
  checkpoint resolve. Publication links to frozen commits are checked after push.

No credentials, encrypted reasoning, installed upstream binaries, customer data
or protected collaboration cases are selected for this release. The current
paper/release documentation is original project material.

## Manuscript Build and Visual Check

The standalone TeX source builds with TeX Live 2026 to 39 US Letter pages,
including eight figures, algorithms, tables, references and five appendices.
Every page was rendered and visually inspected. No clipping or overlapping
text/figures was observed, and the final log contains no overfull, underfull,
undefined-reference or warning diagnostics. The old nine-page release PDF
remains available from the old release.

| File | SHA-256 |
| --- | --- |
| `paper/manuscript.md` | `8971fea9aa14c4a94c8f3450d1538dc627d96efc182166c152c26ebe3fb1d38a` |
| `paper/manuscript.tex` | `ed4607b2211af4fdb16981f6501e4c775419f27cdbb0d0b50f785657a4cd161b` |
| `paper/manuscript.pdf` (462,668 bytes) | `e023ca99f6f47f2ba8c0bd5930c741cb2870f6e5362d94fa08f821ed4317ac2c` |

PDF byte identity applies to this build; a rebuild can change PDF metadata.
The illustrative Appendix A projection and its seven preimage digests were
recomputed against the actual mapper. This does not add a measured task.

## Release Decision

Suitable for public technical scrutiny as a bounded protocol and methods
working draft. Not a production-qualified gateway, endorsed standard, completed
external evaluation or automatically submission-ready venue manuscript.

The same six exposed intents were run twice, totaling 70 model requests and
58 real GitHub read calls. The follow-up's 28 met / two partial fact judgments
do not turn its four output-budget failures into successful tasks. Human
acceptance and actual end-user utility remain unmeasured.

New official-MCP writes, model-led mutation completion, a newly proposed
process-kill/transport-fault cohort, hosted MCP authentication and sustained
multi-host production remain unexecuted. No Studio/Hook change, new cloud
resource, new external invitation or formal submission occurred.
