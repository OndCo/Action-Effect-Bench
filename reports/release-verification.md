# Release Verification

19 October 2026, America/Toronto. This is same-project release verification,
not a newly independent evaluation cohort or new provider-write experiment.

## Remote CI

The [measured implementation CI](https://github.com/OndCo/Action-Effect-Bench/actions/runs/39199258635)
checked out the public Bench source and pinned Spec on Linux (Node 22/Python
3.11) and macOS (Node 24/Python 3.13). Both jobs completed successfully,
including dependency installation, verified OPA installation, all tests,
the original 102-case comparison and the new offline runtime comparison.
CI does not receive live provider credentials or issue comments.

## Fresh Public Clone

A separate clone fetched public Bench commit
`ede12ea` and Spec release `v0.2.0-draft.1`, resolving to
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`. This was not a worktree or a copy
of the local source tree. The runtime source inventory was identical to the
measured implementation `9f638df994504ba6f5d82c0b5409922a0be7a72e`.

`npm ci --ignore-scripts --no-fund --no-audit` installed all pinned packages.
The local OPA release-asset download timed out. A replay and part of a test
suite were mistakenly started before that dependency was ready: the
[first clean-clone replay](runtime-pilot-replay-2026-10-19T04-30-54.158Z-7d25e5.json)
returned `valid:false`, and the incomplete test process was stopped.
These are setup/orchestration failures, not successful evaluations. No provider
write occurred and no original report or frozen input was changed.

The already downloaded OPA release binary was then copied as a dependency cache
and verified by the unchanged installer against the published SHA-256:

```text
e358121f0d96a41103499d878184e493cc5ab10956f98e835089b9de0ac2de62
```

No checksum or TLS check was disabled. This local verification therefore used
a hash-verified cached executable; it is not evidence of a second successful
fresh local download. Remote CI had independently completed its installation.

After verified setup:

| Check | Result |
| --- | --- |
| Spec JavaScript plus original harness | 75 methods passed. |
| Spec Python | 115 methods passed. |
| New runtime JavaScript | 333 methods passed. |
| New runtime Python | 50 methods passed. |
| [Original corpus rerun](offline-consumers-2026-10-19T04-33-39-951Z.md) | Both consumers 102/102; agreement 102/102; zero adapter faults. |
| [Offline source/result replay](runtime-pilot-replay-2026-10-19T04-32-39.164Z-a9986b.json) | Valid; 216 rows plus 52 reference/diagnostic records; benchmark passed. |
| [Live public replay](runtime-pilot-replay-2026-10-19T04-33-09.234Z-34378d.json) | Valid; 32 rows and 12 anonymous GitHub readbacks; benchmark passed. |

The live replay did not issue another POST. It establishes reproducible local
calculation and a fresh current-content match, not original request causality
or historical latency. Public current-content checks remain time-dependent.
Source-stable reports, not the surrounding clone's generated report files,
determine which implementation was evaluated.
