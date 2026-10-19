# Action Effect Bench

**Test shared effect semantics without treating agreement as correctness,
refusal as useful completion, or a description as permission.**

Version `0.1.0-draft.1`. Public development benchmark and evaluation-protocol
proposal. Not a leaderboard, external certification or completed protected study.

This repository is separate from
[Action Effect Spec](https://github.com/OndCo/Action-Effect-Spec). The runnable
part compares two separately written offline consumers of one finite synthetic
refund-declaration profile. The broader protocol defines how mapping accuracy,
authorization decisions, useful completion and full costs should be evaluated
separately; those tracks are not all implemented here.

## Reproduce

Use Node.js 22+ and Python 3.9+ on `PATH`; supported current releases are
recommended. No dependency installation, OSuite account, credentials or cloud
resource is needed. In a new directory:

```sh
git clone https://github.com/OndCo/Action-Effect-Bench.git action-effect-bench
git clone https://github.com/OndCo/Action-Effect-Spec.git action-effect-spec
SPEC_COMMIT=$(node -p "require('./action-effect-bench/spec-lock.json').commit")
git -C action-effect-spec checkout --detach "$SPEC_COMMIT"
node action-effect-bench/conformance/case-source.mjs --check
node --test action-effect-spec/implementations/javascript/consumer.test.mjs action-effect-spec/implementations/javascript/cli.test.mjs action-effect-bench/conformance/runner.test.mjs
python3 -B -W error -m unittest discover -s action-effect-spec/implementations/python/tests
node action-effect-bench/conformance/run.mjs
```

The explicit lowercase sibling directories matter on case-sensitive filesystems.
Do not substitute the latest Spec branch for the revision in
[spec-lock.json](spec-lock.json). To repeat a historical Bench version, check out
that version first and then read its lock. Make changes only in a separate
development copy when comparing a new candidate.

The runner exits nonzero on a mismatch, invalid response, timeout, disagreement
or source change. It starts real local consumer processes but never executes a
refund. New timestamped JSON/Markdown reports preserve expected fields, raw
responses, source hashes, runtime versions, failures and separate denominators.
See [the runner guide](conformance/README.md) and [reports](reports/README.md).

## Evidence and Limits

| Material | Scope |
| --- | --- |
| 80 frozen public-development cases | Contract-derived expectations authored before candidate inspection, within the same project. |
| 22 post-review regressions | Explicitly added after defects were found; not independent or held out. |
| Two consumers | Separately written JavaScript/Python implementations, not two independent institutions. |
| Unit and harness tests | Parser, binding, projection, framing and scorer checks; not separate customer workloads. |
| [12-case development design index](development-case-index.json) | Proposed broader scenarios, not 12 additional executed cases. |

Every consumer response has `authority: not_evaluated`. A successful
`accepted_partial` result is not a safe-action verdict. These cases do not
establish live authorization, signature verification, real provider outcomes,
arbitrary program analysis or full CORE-001..028 conformance. Per-process timing
is diagnostic, not an end-to-end latency advantage.

Expected-result matching and cross-implementation agreement are scored separately.
Two agreeing defects can still exist. A conforming report must state which fields
have an independent expected value; the current accepted-description digest is
cross-compared, not supplied by an independent full-document canonical oracle.

## Extend the Work

- [PROTOCOL.md](PROTOCOL.md): separate tracks, competent baselines, failure
  accounting, custody, preregistration and analysis.
- [Case provenance](conformance/case-provenance.md): frozen sources and exposure.
- [Collaboration contract](collaboration-contract.md): proposed roles and limits.
- [CONTRIBUTING.md](CONTRIBUTING.md): synthetic counterexamples, new consumers
  and independently defined future cohorts.
- [PUBLICATION.md](PUBLICATION.md): selected release scope and rights.

The original code, documentation and synthetic data in this release use the
repository's [MIT license](LICENSE). No protected research cases, customer traces
or unrelated commercial source are included. Confidential reports go through
[SECURITY.md](SECURITY.md), not a public issue.
