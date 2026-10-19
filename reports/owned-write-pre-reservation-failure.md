# Retained Pre-Reservation Failure

On 19 October 2026 the first owned-write attempt created the dedicated issue
[Action-Effect-Bench#2](https://github.com/OndCo/Action-Effect-Bench/issues/2),
then stopped before reserving any occurrence or calling a comment mutation.
The issue-creation setup is separate from the comment profile.

- Source commit: `349138520169588752305ee02c145fadddd0ea24`.
- Run ID: `owned-write-20261019`.
- Stopped report: [raw record](owned-write-study-2026-10-19T13-32-22.199Z-ab5303e5.json).
- Report SHA-256: `7a5afddcdd237aeb0e3a14391fcf2c5907376e6131e0dbb05251ac5184213bee`.
- [Supervisor journal](owned-write-20261019.supervisor.jsonl).
- [Failed child journal](owned-write-20261019.normal-release-integrity.execute.jsonl).
- Durable occurrence entries: zero. Comment-call permits: zero.

## Cause and Correction

The independently written Python consumer returns a parsed projection whose
JavaScript representation has a null prototype. The literal reference uses a
normal object prototype. `isDeepStrictEqual` rejected these equal wire values:
all seven fields and their serialized JSON matched, but their host-language
prototypes differed. The check stopped before the gate, not because the action
was denied or its effect mapping was semantically incorrect.

The correction compares the profile's canonical JSON digests instead. A direct
regression reproduced the original mismatch; the corrected check accepts the
equal values and still refuses a changed body-byte reference. All eight frozen
scenario proposals then matched both preparation paths in a non-dispatching
check. This is an engineering correction, not another successful live cohort.

The controller permits reuse of the already-created issue only after verifying
the old failure journal has exactly begin / null ledger-before / failure events,
no occurrences or write permits exist, and a fresh GitHub read finds the same
owned issue unchanged and empty. It preserves the old attempt and creates a
new manifest linking back to it. It does not retry an unknown mutation, create
a second issue, or relax the twelve-call ceiling.

## Additional Pre-Dispatch Review

Same-project code review also prompted regressions for owned descendants
surviving a leader's exit, actual transport-cleanup error propagation, a
synchronous durable recorder contract, current OPA executable identity, and
source/binary verification immediately before the native call. Those local
fixture failures are development evidence, not additional GitHub incidents.
