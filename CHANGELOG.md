# Draft Change Record

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
