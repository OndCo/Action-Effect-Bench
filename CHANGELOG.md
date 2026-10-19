# Draft Change Record

## Runtime Pilot 0.2

Adds an opt-in GitHub issue-comment domain profile, a JavaScript producer,
separately written Python consumer, direct structured-adapter baseline, real
OPA authorization, official MCP stdio transport and Octokit dispatch. The
companion Spec is pinned to `a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`.
The original 80+22-case corpus and earlier reports are unchanged.

The new development corpus was frozen before candidate execution/results, not
before all implementation work. Its inputs/labels remain unchanged; the
incorrect initial description of that ordering and subsequent corrections are
preserved in the custody history. It is not an external held-out evaluation.

The first offline attempt is retained as a failed report. Review identified a
scoring defect: JSON objects produced with different JavaScript prototypes
were treated as different semantic projections. The scorer now compares JSON
values independently of prototypes. The structured adapter also received
error-precedence fixes for out-of-domain numeric native input and invalid
Unicode; the frozen expected labels were not changed to make it pass.

Before live dispatch, eight newly failing gate regressions exposed and then
checked repairs to stale-comment recovery, POST/readback ID binding, current
policy reload and configuration replacement across asynchronous operations.
The gate now records pre-dispatch comment IDs and never automatically resends
an uncertain POST. New matching content is not claimed as complete causal
execution provenance.

Report replay recomputes mapping, authorization, counts and timing summaries,
checks the complete source inventory and verifies the attempt journal. A
faithfully reproduced failed benchmark is distinguished from corrupt evidence.
The external-evaluation tool separates sealed inputs and labels, preserves
partial failures, and rejects duplicate JSON keys; it does not itself provide
sandboxed custody or outside-team validation.

See the release's report index for measured results. Unit fixtures are not
real SaaS effects, and successful local tests are not production certification.

## Public-Checkout Entry Point Repair

Clean remote-clone reproduction exposed a path-identity mismatch in the runner,
case generator and companion JavaScript consumer. A symbolic link in the launch
path could make a command exit zero with no output. Node's resolved module URL
and the lexical invocation path were being compared as if they were identical.

The entry-point checks now compare resolved filesystem identities. The new
entry-point regressions first failed against the previous code, and also check
that importing the modules from stdin does not start a command-line run. CI and
the public unit command include these regressions. The benchmark pins the
corrected Spec commit in `spec-lock.json`.

Earlier completed comparison reports remain unchanged and identify their actual
sources. They did run the consumers, but did not exercise symlinked CLI startup.
The clean-clone command with no output produced no report and is not a passing
experiment. A fresh report is recorded for the corrected publication snapshot.

No frozen contract byte, generated public case, expected outcome, scoring rule
or authorization capability was changed. The two 102-case denominators remain
80 original development cases plus 22 post-review regressions.
