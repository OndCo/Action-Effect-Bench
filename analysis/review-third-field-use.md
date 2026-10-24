# Internal Content Review: Field-Study Edition Three

Editorial date: 24 October 2026, America/Toronto.

Input: [the complete six-task report](../reports/field-study-use-2026-10-24T14-59-47.404Z-d49779b4.json),
SHA-256 `21077fac84582bbb12dc3a78c58422a9a4eebf775e5e313b417abf8a6e20667d`.
The review uses the unchanged thirty-fact
[criterion set](../field-study/criteria.json) at runtime commit
`c6345b588e1c15bd6b7e3fb8928663f9240b7354`, the final text and captured tool
results, and the criterion set's original pinned source refs. The earlier
rejected drafts are not replacement final reports.

This is same-project, AI-assisted source review with a second context checking
the actual output. It is not an independent institution, human ground-truth
study or user-acceptance evaluation. No raw report, criterion, label in a prior
run, source pin or model prompt was changed after observing these results.

## Judgments

| Task | Internal content judgment | Distinction from contract readiness |
| --- | --- | --- |
| Release integrity | Complete limitation report | The required raw report inspection failed. Honest disclosure meets the rubric, but byte verification was not completed. |
| Clean-clone quickstart | No result | Model transport failed; there is no final output to grade. The rejected draft is not promoted. |
| Consumer migration | Complete | Covers startup selection/rollback, configuration versus applicability, ordered projection and unchanged identities/scope. |
| Official MCP compatibility | Complete | Separates the Bench-authored SDK server from the official GitHub server and preserves evidence/identity limits. |
| Limits and recovery | Partial | Omits an explicit required extension detail, although the final contract passes. |
| Conformance support | Partial | Omits the shared projection/no-envelope distinction, although the final contract passes. |

The resulting judgment is **3 complete, 2 partial, 0 incorrect, 1 no result**.
This is a source-review judgment, not a measured semantic accuracy rate. Actual
maintainer acceptance, use and incremental business value remain unmeasured.
In particular, the first row is not a successful integrity check.

## Two Required-Fact Omissions

**Limits and recovery, `native-and-body-limits`.** The final says:

> Preserve exact text/SHA-256.

It gives the byte and numeric restrictions, but does not explicitly state that
the body-digest extension is mandatory. The pinned profile says:

> The manifest's extension URI is required in `critical_extensions`.

See the [original profile semantics](https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/profiles/github-issue-comment/README.md#L105).
The distinction matters: mentioning a digest is not specifying the required
profile field and its binding obligation. This is an omission, not evidence that
the consumer failed to enforce the extension. The underlying implementation and
normative profile were not changed by this report-producing experiment.

**Conformance support, `runtime-population`.** The final says:

> Two paths share OPA, ledger and dispatcher.

It omits that the structured baseline shares the Python projection and avoids
transferring the effect-description envelope. The pinned README says:

> The structured baseline uses the same Python projection, OPA and dispatch controls without transferring an effect-description envelope.

See the [original baseline description](https://github.com/OndCo/Action-Effect-Bench/blob/cecde389637be4f5fd3482e4942ce3fd1a623ac6/README.md#L30).
Without that distinction, a reader must reconstruct what the comparison changes.
The reported denominators, failure history and agreement/oracle limits are
otherwise distinguished in the final. This is a reporting omission, not a new
baseline implementation defect or evidence of a protocol performance advantage.

These explanations are maintainer annotations. They do not repair the recorded
model output or change its partial grade.

## Limits Retained

T1 explicitly reports: "Comparison outcome: not performed; inspection failure,
neither match nor mismatch." That matches its captured `reader_unavailable`.
The frozen rubric permits accurate unavailable-evidence disclosure; it does not
turn that disclosure into a verified digest match.

T2 retains `model_transport_error` and `finalOutput: null`. T3 and T4 distinguish
documented behavior from tests, authentication or deployment not actually run.
No material false claim was found in the five actual finals under this rubric.
The separate replay still reports `release_native_envelope_not_retained`.

The model saw ordinary exposed maintenance inputs, not these fact labels or
this review. A second AI context within the same project does not make the
evaluation independent. An external recipient must still review the intended
workflow and decide whether the result is useful before an adoption claim.
