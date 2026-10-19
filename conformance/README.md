# Offline Consumer Comparison

This runner exercises two separately written consumers against an exposed,
same-project public development corpus. It is not the protected confirmatory
evaluation proposed by `../PROTOCOL.md`, and not a policy or attack benchmark.

## Layout and Commands

Keep `action-effect-spec` and `action-effect-bench` as sibling directories.
First use the exact Spec commit in [spec-lock.json](../spec-lock.json), following
the [clone instructions](../README.md#reproduce). Case generation independently
checks the seven original contract files; that does not replace pinning the
consumer implementation revision.
Required: Node >=22 and Python >=3.9 on `PATH`. No package installation, OSuite,
Azure, account, credential or third-party runtime dependency is required.

From their common parent directory:

```sh
node action-effect-bench/conformance/case-source.mjs --check
node --test action-effect-bench/conformance/runner.test.mjs
node action-effect-bench/conformance/run.mjs
```

The comparison also works from another current directory when invoked by its
absolute script path. It returns nonzero on any expected-result mismatch,
consumer disagreement, adapter failure or source change during the run.

New timestamped JSON and Markdown reports go into `action-effect-bench/reports`.
Existing reports, including failures, are never overwritten. Each JSON report
contains the exact source/input hashes, runtime versions, expected fields,
consumer responses, per-case matches and cross-implementation agreement.
New reports also retain `stdout_b64`, the original response bytes; `stderr` is
a diagnostic preview limited to 1,000 characters, not a complete error archive.
The corpus is hashed before either consumer runs and source stability is checked
again at the end. This is a local freeze, not an external preregistration service.

The original `cases.json` remains the 80-case source-frozen public corpus.
`review-cases.mjs` adds 22 explicitly exposed post-review regressions for amount
representation and RFC 3986 generic URI structure. They were authored after
review found defects, not independently before seeing behavior. New reports
identify each case's suite and separate the two denominators. The first local
pre-publication report covered only the original 80 cases and remains in the
internal archive. This public repository starts with fresh runs of the selected
public sources. No old expected result or historical archive is rewritten.

## What Is Scored

`cases.json` carries explicit expected status/reason pairs, supported canonical
bytes and selected scalar result fields. The runner also checks the entire
response shape, ID, `authority: not_evaluated`, digest formats and diagnostic
canonical bytes versus their SHA-256. It does not import either consumer.
Response counts are checked as exact mathematical safe integers before trusting
native numeric decoding; exact aliases such as `1.0` remain valid, but a fraction
that binary64 would round to `1` cannot pass as a count of one.

An accepted description's full digest is compared between implementations;
the public expected-result oracle does not independently give that full digest.
Its underlying byte rules are separately checked by literal canonical vectors.
Agreement is shown separately from expected-result matching: two agreeing bugs
are not evidence of correctness. Every unexpected result remains in the report.

Trusted startup configuration may change per case through a generated temporary
fixture file. Case content cannot select executable code, arbitrary paths or a
network endpoint. Every consumer invocation starts a new bounded process, with
only a minimal environment; the runner does not forward cloud credentials.

Missing output, extra output, malformed UTF-8/JSON, duplicate keys, process crash
and timeout fail evaluation. They are never counted as a correct security block.
Well-formed JSON that violates the response contract also counts as an adapter
fault, rather than disappearing from failure totals or earning agreement.
Runner unit tests use fixed local fixture workers only to test those harness
failure paths; they are not consumer experiments.

## Interpretation

The implemented target is `offline-consumer-v1`, not full CORE-001..028
conformance. The original 40 design vectors remain design-only unless a specific
separate result says otherwise. This run does not grant authority, issue a
refund, test a real provider, inspect tool source code, or evaluate signatures,
authorization freshness, revocation, effects bounds or a live registry.

Elapsed times include process startup and transport and are diagnostic only.
They must not be marketed as end-to-end execution latency or a performance win.
See `case-provenance.md` for exposure, literal oracles and fixture-hashing limits.
