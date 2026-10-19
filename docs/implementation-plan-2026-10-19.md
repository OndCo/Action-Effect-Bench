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

- [ ] Spec: add clarification contract and tests without editing the seven
  frozen source files; add a GitHub profile and binding/unknown semantics.
- [ ] Cases: separately author and seal public-development inputs and literal
  expected mappings/decisions before running candidates; document custody.
- [ ] Implementation: write failing tests for mapping, exact input validation,
  OPA fail-closed results, final-policy recheck and no-resend recovery.
- [ ] Implement producer, separate consumer and structured baseline; actual OPA
  executable and official transport/SDK dependencies are exact-version pinned.
- [ ] Run offline suites; preserve first failures and add labeled regressions.
- [ ] Execute bounded live GitHub subset on a dedicated owned issue; capture
  fresh readback, all attempts, actual process timings and source identities.
- [ ] Score mapping independently of decisions, and decisions independently of
  candidate mapping; separate framework errors from semantic review/denial.
- [ ] Recompute all observations and report raw evidence and limitations.
- [ ] Update manuscript, adoption guide, external contribution/custody packet
  and outreach copy. No unapproved institutional endorsements or emails.
- [ ] Review spec compliance, code quality and publication privacy/claims.
- [ ] Run old and new tests, lock dependent Spec commit, clean-clone reproduce,
  push, verify Linux/macOS CI and publish prereleases plus public invitation.

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
