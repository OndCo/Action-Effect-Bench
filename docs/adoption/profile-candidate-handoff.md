# Implementer handoff: GitHub issue comments

Status: candidate evaluation, not stable certification. No external implementer
or evaluation custodian is confirmed. No OSuite service, account or purchase is
required. This handoff does not grant access to a repository or permission to
post comments.

## One bounded job

Represent a proposed GitHub issue comment through either an SDK call or an MCP
`add_issue_comment` call. Preserve the coupled repository, issue, endpoint,
exact body digest, UTF-8 byte count and caller-declared data class. A description
of the direct effect is partial: notifications, webhooks and other descendants
are not established by a successful comment readback.

Keep these five results distinct:

1. What effect the mapper says the proposed invocation requests.
2. Whether the description and its evidence satisfy the selected profile.
3. Whether the current authority permits that exact coupled effect.
4. Whether a particular occurrence was dispatched and can be confirmed.
5. Whether the resulting report actually helps its intended reader.

`accepted_partial` is a result for step 2, never an answer to steps 3-5.
The experiment's `allow_partial_direct` flag is local policy, not a universally
safe default or a field granting authority to the tool itself.

## Implement without our implementation

Use the Spec candidate's requirement matrix, normative component lock, original
GitHub profile and processing contract. Record the candidate identifier and
manifest digest before implementing. Retain exact bytes and unsupported cases;
do not import the reference mapper to manufacture expected outputs.

- [Core requirement accountability](https://github.com/OndCo/Action-Effect-Spec/blob/main/conformance/profile-readiness.md).
- [GitHub comment candidate and verification](https://github.com/OndCo/Action-Effect-Spec/blob/main/profiles/github-issue-comment/candidate/README.md).
- [Candidate manifest](https://github.com/OndCo/Action-Effect-Spec/blob/main/profiles/github-issue-comment/candidate/manifest.json).

Those are discovery links, not trusted mutable pins. Select the actual Spec
commit and verify the candidate manifest pin before evaluating an implementation.

An external implementer should return:

- Language/runtime, source revision, build instructions and dependency lock.
- Claimed roles and profile identifiers, including unsupported obligations.
- Raw input and output records, with mapping and authorization in separate fields.
- Positive and negative tests for coupled fields, exact body bytes, missing
  evidence, version mismatch and unsupported operations.
- A note identifying reused reference code, same-organization reviewers and any
  conflicts. Another language or another AI coding session is not independence.

The existing [comparison runner](../../conformance/README.md) invokes the two
bundled offline consumers. The [runtime custody CLI](external-evaluation-cli.md)
invokes fixed internal preparation/authorization APIs, not arbitrary external
implementations. Neither currently supplies an isolated third-party execution
sandbox. Agree and freeze a separate adapter invocation and result contract
before scoring someone else's executable; do not call an internal CLI run
external validation just because another organization supplied input files.

## Pilot agreement before protected inputs

Agree the task, roles, versions, authority owner, source rights and publication
scope in writing. The protocol author, reference implementer, input/label
custodian, scoring operator and deployment owner are distinct roles even if
some are held by the same people. Disclose such overlap.

Follow [external evaluation custody](external-evaluation.md): fix inputs and
expected outcomes independently before the evaluated implementation sees them.
Keep labels outside its access boundary. A seal digest alone neither hides
guessable labels nor proves that a freeze happened earlier. Retain failed,
aborted and not-started cases and resolve disagreements before scoring.

Run the same complete structured baseline with the same current policy,
occurrence ledger and recovery controls. Do not remove safeguards from the
baseline to create an apparent protocol benefit.

## Outcome sheet

| Dimension | Required report |
| --- | --- |
| Mapping | Exact expected-versus-observed coupled projection; missing/unsupported evidence separately. |
| Authorization | Decision using independently fixed reference effects, then decision using mapped effects. Masked mapping errors remain errors. |
| Safe execution | False allows, incorrect blocks, correct review, operational errors and unknown delivery, with denominators. |
| Recovery | Native send attempts, confirmed occurrences, unknown occurrences, duplicate probes and read-only reconciliations. |
| Usefulness | Scheduled tasks, first-draft fit, final contract readiness, independent content review and actual recipient acceptance, separately. |
| Cost | Preparation, policy, provider, queue/model time, recovery, manual interventions and all failed attempts. |

Do not sum paired lanes, repeated attempts or unit-test methods into a count of
independent users. Do not credit a timeout as a correct denial. Do not infer
historical execution attribution from matching current content when another
writer could have produced it.

## Second platform and stable-release gates

A second profile starts from a partner's actual bounded workflow, not by
renaming this comment tuple. Obtain its operation schema, resource identifiers,
credential owner, irreversible effects, retry/idempotency contract, event or
readback semantics, known descendants and missing-evidence behavior. A GitHub
PR, Slack message, wallet transfer or audit-session launch needs its own scope
and evidence; none inherits comment guarantees automatically.

Do not claim stability until all applicable mandatory obligations have executed
evidence, independently written implementations interoperate, evaluation custody
is real, failure semantics are agreed, and deployment owners accept the residual
risks. Signed distribution, tool-code attestation and global SaaS exactly-once
execution are not supplied by this candidate. The existing MIT licenses and
upstream notices apply; no new patent covenant or institutional endorsement is
created by this handoff.
