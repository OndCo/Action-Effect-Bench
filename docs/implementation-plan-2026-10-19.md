# Runtime Pilot Implementation Plan

> Execute with bounded subagents and local integration. User approved the whole
> round; report progress without another discretionary approval gate.

**Goal:** Publish a reproducible, vendor-neutral real-runtime pilot and an honest
research/adoption package while preserving the earlier frozen release.

**Architecture:** Add a versioned domain profile to Spec. Put runtime adapters,
OPA policy, experiments, custody/scoring and reports in Bench. No commercial
application dependency. External human validation remains an explicit unfilled
evidence requirement, not an implementation task labeled complete.

**Tech Stack:** Node.js >=22, Python >=3.9, official MCP SDK, Octokit, pinned OPA,
GitHub REST, Markdown and standalone LaTeX.

## Tasks

- [x] Spec: add clarification contract and tests without editing the seven
  frozen source files; add a GitHub profile and binding/unknown semantics.
- [x] Cases: separately author and seal public-development inputs and literal
  expected mappings/decisions before running candidates; document custody.
- [x] Implementation: write failing tests for mapping, exact input validation,
  OPA fail-closed results, final-policy recheck and no-resend recovery.
- [x] Implement producer, separate consumer and structured baseline; actual OPA
  executable and official transport/SDK dependencies are exact-version pinned.
- [x] Run offline suites; preserve first failures and add labeled regressions.
- [x] Execute bounded live GitHub subset on a dedicated owned issue; capture
  fresh readback, all attempts, actual process timings and source identities.
- [x] Score mapping independently of decisions, and decisions independently of
  candidate mapping; separate framework errors from semantic review/denial.
- [x] Recompute all observations and report raw evidence and limitations.
- [x] Update manuscript, adoption guide, external contribution/custody packet
  and outreach copy. No unapproved institutional endorsements or emails.
- [x] Review spec compliance, code quality and publication privacy/claims.
- [x] Run old and new tests, lock dependent Spec commit, clean-clone reproduce,
  push the measured source and evidence, and verify Linux/macOS CI.

## Completion Evidence and Publication

The [results record](../reports/runtime-pilot-summary.md) and
[fresh-clone verification](../reports/release-verification.md) document the
completed bounded measurements, retained failures, exact source identities and
573 passing test methods. No protected external evaluation or production rollout
is implied by these checkboxes.

Final publication is recorded by the
[Bench prerelease](https://github.com/OndCo/Action-Effect-Bench/releases/tag/v0.2.0-draft.1),
[Spec prerelease](https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1),
and public RFC issue, not inferred from the presence of local release files.
The [invitation text](adoption/rfc-issue.md) and
[unsent outreach drafts](adoption/outreach.md) are separate artifacts. Actual
external case authorship, independent implementation and collaborator responses
cannot be completed by this project's own tests.

## Checkpoints and Commands

Legacy regression remains:

```sh
node --test ../action-effect-spec/implementations/javascript/*.test.mjs conformance/*.test.mjs
python3 -B -W error -m unittest discover -s ../action-effect-spec/implementations/python/tests
node conformance/case-source.mjs --check
node conformance/run.mjs
```

The new runner must return nonzero for missing OPA, invalid policy/output,
source drift or failed evidence checks. A dry/offline run cannot be labeled
live. A live runner must not silently fall back to a local fake provider.

Each worker reports paths, failing-before/passing-after commands and caveats.
The integrator records final commands, exact counts and immutable links after
publication; results are not inserted into a manuscript before measurement.
