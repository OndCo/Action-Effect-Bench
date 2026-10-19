# Action Effect Bench

**Test shared effect semantics without treating agreement as correctness,
refusal as useful completion, or a description as permission.**

Release series `v0.4.0-draft.1`. Public development benchmark and evaluation-protocol
proposal. Not a leaderboard, external certification or completed protected study.

This repository is separate from
[Action Effect Spec](https://github.com/OndCo/Action-Effect-Spec). The runnable
part retains the original two offline refund-profile consumers and adds a
bounded GitHub-comment pilot: JavaScript production, a separately written
Python checker, actual OPA authorization, official MCP transport/Octokit, a
local occurrence ledger and read-only provider reconciliation. No OSuite
server or account is required. It is not a general-purpose production gateway.

## Real Maintainer Use and Full Manuscript

The [field-use evidence](reports/field-study-summary.md) records real model-led
maintenance work through public GitHub REST and the official GitHub MCP server,
separate from the older scripted mutation experiment. It retains setup failures,
an incorrect report conclusion, a conflicting first-run output contract and
post-review repairs. Loop completion is not silently counted as useful output.

- [Full technical manuscript](paper/manuscript.md) and [PDF](paper/manuscript.pdf).
- [Read-only field-use guide](field-study/README.md): setup, scope and replay.
- [Field-use results and limits](reports/field-study-summary.md).
- [Owned native delivery and recovery](reports/owned-write-summary.md): two
  eligible model reports delivered, six separate fault cases, twenty fresh
  worker processes, five comment calls and eight no-send duplicate probes.
- [Live public evidence](https://github.com/OndCo/Action-Effect-Bench/issues/2)
  and [versioned no-send replay guide](docs/replay-v0.4.0.md).
- [Original 0.3 release](https://github.com/OndCo/Action-Effect-Bench/releases/tag/v0.3.0-draft.1): unchanged read-only runs and 39-page manuscript.
- [Original 0.2 release](https://github.com/OndCo/Action-Effect-Bench/releases/tag/v0.2.0-draft.1): unchanged evidence and short paper.

Offline replay needs neither Azure access nor GitHub credentials. A new model
run requires explicitly configured credentials and incurs model costs. These
observations are internal self-use, not external certification, arbitrary
autonomous-write qualification or evidence that a correct adapter needs this
wire format. Four of the six amended model outputs still fail the task budget;
successful delivery of two does not reclassify the other four.

## Runtime Pilot

- [Quickstart](docs/adoption/quickstart.md): install pinned tools, run locally,
  and distinguish safe replay from an explicitly authorized live write.
- [Runtime guide](runtime-pilot/README.md): two strategies, scope and trust boundaries.
- [Results](reports/runtime-pilot-summary.md): measured denominators, failures,
  cost and public provider readback links.
- [Working paper](paper/manuscript.md): research question, protocol and evidence limits.
- [Independent evaluation pathway](docs/adoption/external-evaluation.md): custody
  and separate input/label handling, not a claim that an external study occurred.

The new author-defined corpus has 55 rows, 22 base intents and 108 lane
instances. Runtime cases are frozen before candidate execution/results, not
before implementation. The structured baseline uses the same Python projection,
OPA and dispatch controls without transferring an effect-description envelope.
Protocol overhead is reported, not assumed to be a performance win.

## Reproduce the Original Corpus

Use Node.js 22+ and Python 3.9+ on `PATH`; supported current releases are
recommended. No dependency installation, OSuite account, credentials or cloud
resource is needed. The qualified CI targets are Linux and macOS, not Windows.
In a new directory:

```sh
git clone https://github.com/OndCo/Action-Effect-Bench.git action-effect-bench
git clone https://github.com/OndCo/Action-Effect-Spec.git action-effect-spec
SPEC_COMMIT=$(node -p "require('./action-effect-bench/spec-lock.json').commit")
git -C action-effect-spec checkout --detach "$SPEC_COMMIT"
node action-effect-bench/conformance/case-source.mjs --check
node --test action-effect-spec/implementations/javascript/*.test.mjs action-effect-bench/conformance/runner.test.mjs action-effect-bench/conformance/entrypoints.test.mjs
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
`accepted_partial` result is not a safe-action verdict. These original cases do not
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
