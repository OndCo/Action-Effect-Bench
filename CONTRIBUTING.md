# Contributing

Start with the [protocol](PROTOCOL.md), [provenance](conformance/case-provenance.md)
and [pinned reproduction](README.md#reproduce). No OSuite purchase or account is
needed. Current governance is convenor-led, not an independent certification body.

## Public Development Contributions

Useful contributions include a minimal synthetic counterexample, a scorer
failure test, a separately written consumer or a small new domain with explicit
expected semantics. State the clause, source versions, input, expected result,
actual result and your exposure to the candidate implementation. Include failure
and unsupported cases, not only favorable examples.

Do not change `cases.json` to fit a candidate. The initial 80 cases are frozen;
newly discovered cases belong in a separately identified regression suite or
explicitly versioned corpus. Changes to frozen contracts, oracles and exclusion
rules require review and a visible provenance/version update.

## Rights and Data

To incorporate original code, prose, inputs, labels or diagrams, contributors
must explicitly confirm authority to provide that material under this
repository's MIT license. Identify sources, third-party terms, affiliations
and relevant conflicts in the pull request. Unclear/different rights require
review before adoption; unsolicited submissions are not automatically licensed.
No later policy is treated as retroactive consent.

Never include credentials, customer data, a private provider trace or another
collaboration's protected cases. Do not run command strings just because they
appear in a benchmark. Confidential issues follow [SECURITY.md](SECURITY.md).
No separate CLA fee or paid membership is required.

## Independent Evaluation Proposals

Use an issue only to propose a non-sensitive scope. Do not reveal intended
protected inputs or answers there. A future cohort needs agreed custody, role
separation, rights, budgets, fixed scoring and failure handling before candidate
exposure. It does not become independent merely because an outside person
submitted examples or because it lives in a second repository.

An evaluated developer cannot decide their own disputed protected score.
If independent adjudication is unavailable, defer or explicitly label the run
internal. The current release provides public development evidence only.
