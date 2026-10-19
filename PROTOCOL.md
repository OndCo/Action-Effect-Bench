# Evaluation Protocol Proposal

18 October 2026. Editorial draft; no case/label custody has been appointed and
no confirmatory run has started. This protocol must be jointly frozen before
confirmation. Active protected inputs and labels remain unavailable to candidate
developers before and during the run; freezing the protocol does not permit
developer preview. Controlled exposure to the system under test is distinct
from disclosure to its developers.

## 1. Research Questions

RQ1: Do conditional, implementation-bound effect descriptions improve mapping
correctness and explicit coverage compared with competent existing descriptions?

RQ2: Does that improvement reduce dangerous authorization errors without
increasing false blocks, unnecessary reviews or completed-task loss?

RQ3: Can independently written consumers preserve the meaning across runtimes,
versions and incomplete evidence, without adopting one vendor's private code?

RQ4: What are the complete costs, update/revocation limits, failure regimes and
operational burden relative to matched protection mechanisms?

The benchmark does not assume positive answers. A correct rejection of the
proposed method's benefit is a publishable result, not a failed benchmark.

## 2. Separate Measurement Tracks

| Track | Input | Reference | Report separately |
| --- | --- | --- | --- |
| Syntax/conformance | Frozen wire vectors | Normative spec/profile clauses | Passed, failed, unsupported; no security score |
| Mapping | Runtime-native invocation plus permitted context | Independently specified coupled effect tuples and uncertainty | Exact tuple match, per-field error, coverage, unsupported and processing failures |
| Authorization | Independent reference tuples and authenticated reference policy context | Frozen decision table | False allow/block, valid review, failures; does not call candidate mapper |
| Integrated admission | Candidate mapping plus identical reference authority | Original reference action/decision | End-to-end errors without hiding mapping loss |
| End-to-end utility | Actual controlled task environment | Original task success and safety checks | Useful completion, unsafe effects, intervention and recovery |
| Cost/recovery | Same protection, evidence and offered load | Captured complete work and receiver outcomes | Cold/warm cost, tail latency, unknown/partial results, retained reservations |

Passing a conformance vector does not imply a sound effect analyzer. A mapper
crash that happens to stop execution is a processing failure, not a correctly
recognized policy violation. Original benchmark success checks are retained
when external task suites are used, with version and license pinned.

## 3. Case Structure and Domains

The unit is an independently specified base intent, not a syntactic variant,
repeated run, language implementation or runtime lane. A case contains:

1. native input, tool/implementation versions and runtime lane;
2. initial state and independently constructed semantic reference;
3. material conditions, ambiguity and permissible observations;
4. unchanged, narrowed or denied current authority where appropriate;
5. expected mapping result and expected authorization result separately;
6. permitted execution effects and original useful-task success criterion;
7. exposure history, domain/runtime holdout status and provenance;
8. adjudication status and explicit failure/timeout budget.

Suggested domain families: document/email, repository/release, payment/refund,
cloud/IAM, async workflows and binary/opaque-tool cases. Browsers, on-chain
actions and industrial devices require distinct environment and safety contracts,
not speculative coverage claims. No domain is called supported until measured.

Targeted variations include equivalent syntax, changed destination/data/quantity,
field recombination, implementation drift, changed descendants, stale mappings,
unrelated state changes, contradictory evidence, retry ambiguity and resource
exhaustion. Syntax variants remain clustered under their base intent.

## 4. Dataset Independence and Freeze

Keep separate datasets for public development, exposed diagnostic failures and
protected confirmatory evaluation. Existing OSuite benchmarks, Matoi runs,
AgentDojo tasks already inspected and related collaboration development probes are exposed;
hashing or renaming them does not make them independent.

Before confirmation freeze: spec/profile/registry versions; cases and labels;
reference policy; adapter implementations; scoring; budgets; exclusions; hardware;
network conditions; randomization; retry and invalid-run rules; and planned
statistical analyses. The custodian seals protected inputs and labels before
the evaluated implementation can see them. A hash records identity, not secrecy.

Separate case authors, annotators/adjudicators, developers, runners and scorers
where feasible; record every overlap and who could access what, when. Access
agreements and real custodians are required before calling a run independent.
Two LLM agents or two same-team languages do not constitute independent labs.

For the independent track, developers of any scored implementation cannot author
or adjudicate its protected expected outcomes, inspect active hidden items, score
their own disputed results or control the deciding appeal panel. A conflicted
person recuses; if the remaining declared independent quorum is unavailable,
defer the decision or label the run internal rather than waive independence.
Record appointments/removals, corporate control, funding and contractual vetoes.
Funding disclosure alone does not cure control over unfavorable outcomes.

Custodians restrict feedback and submission budgets to limit adaptive extraction.
The tested system necessarily receives task inputs; hosted-provider logging,
retention and operator access must therefore be documented and constrained.
Unverified provider-side secrecy is reported as an exposure limitation, not
equivalent to independently controlled sealed execution.

Once a failure teaches the registry or mapper a new rule, those cases become
development material for subsequent versions. Do not tune and rerun while
retaining the label "unseen". Hidden sets rotate with versioned cohorts and
overlap reporting, not by silently replacing difficult cases.

## 5. Annotation and Oracle Design

Annotators receive native inputs, authoritative environment information and
the labeling guide, not the candidate mapper output as the answer. They record
complete tuple relations and missing/uncertain facts, not only scalar risk.
Use at least two qualified labelers for independently assessed subsets, report
agreement and adjudication, and preserve unresolved disagreements.

An annotation agreement statistic is not proof of correctness. Use actual
instrumented side effects where ethical and available, distinguishing observed
facts from conservative possibility bounds. An observed trace cannot establish
all possible descendants. Cases lacking a defensible reference are reported
as ambiguous/unsupported under preregistered rules, not silently dropped.

For action-to-authorization tests, the reference authorizer consumes independent
reference tuples. It must not reconstruct the answer through the candidate's
own registry, parser or policy evaluator. Policy alternatives remain coupled;
requested authority is not a grant, and runtime narrowing cannot widen it.

The oracle-independence restriction applies to every scored arm, including
baselines. A baseline's own evaluator cannot define the expected answers and
then receive independent-correctness credit for agreeing with itself. Record
shared libraries/models and independently adjudicate the reference. An engine
used as the defining oracle is labeled a noncompetitive oracle diagnostic.

## 6. Matched Baselines and Ablations

Compare components only where their responsibilities match:

| Comparison | Competent baseline | Matching requirements |
| --- | --- | --- |
| Effect mapping | Documented tool schemas and context-aware structured adapter; hints-only as a weaker diagnostic | Same observable context, tool versions and inference budget |
| Authorization | Independently implemented complete-tuple policy, e.g. supported OPA/Cedar policy model | Same authenticated facts, constraints, deny/review semantics |
| Runtime protection | Applicable information-flow/runtime policy systems, selected after actual integration | Same interception points, credentials, task goals and attack budget |
| Evidence preparation | Full recomputation and protected dependency-aware reuse | Same live authority, durable occurrence, coverage and failure rules |
| Whole task | Ungoverned environment plus governed arms | Original task oracle, agent/model configuration and invocation budgets |

CaMeL, Progent, LlamaFirewall, NeMo Guardrails or other named systems are candidate
comparisons only after source/rights/environment review. They are not represented
as integrated, inferior or interchangeable by listing them here. A PDP is not
penalized for lacking a runtime parser it never claimed to implement.

Freeze public-development integration checks and tuning budgets for each arm.
Verify clean-task competence and original task solvability before interpreting
protection differences; report broken integrations rather than handicapping a
baseline. Any capability threshold or common-capability subset is predeclared
using development evidence. It cannot be chosen from favorable hidden results;
the full scheduled population still appears in the primary report.

Predeclare ablations: remove context binding; remove implementation binding;
flatten coupled tuples; collapse unknown with failure; use declarations instead
of evidence; omit update invalidation; compare full and selective revalidation.
Run unsafe ablations only in controlled environments. Ablations isolate each
claimed contribution, not merely the number of fields present.

## 7. Failure Accounting and Metrics

Every planned case remains in the run ledger. Keep valid allow/block/review
separate from invalid input/configuration, unsupported mapping, timeout, crash,
missing result, invalid output, untrusted evidence and environment failure.
Predeclare rerun rules; retain original failures and new attempt identities.

Report mapping exact-match by base intent and per field; recall/precision by
effect type with coverage; ambiguous-reference counts; and processing failure
rate. Do not present accuracy conditional on successful mapping as total accuracy.

Authorization reporting includes false allow among expected blocks, false allow
among expected reviews, false block among expected allows, valid-review accuracy,
and unnecessary-review rate. Report eligible denominators and coverage together.
An all-block system cannot win through a single safety score.

Freeze the allow/block/review reference populations before execution. Each main
rate uses its entire preassigned population, including processing failures and
unsupported/missing results; separately report those failures so zero false
allows cannot be confused with useful operation. Also give explicitly labeled
conditional rates among successfully interpreted cases, never as replacements.
Task completion uses the frozen population of scheduled legitimate-goal tasks;
refusal, timeout and missing completion remain non-completions. Pure malformed-
wire tests belong to a separately declared track, not a post hoc exclusion.

Freeze aggregation weights before results: first aggregate variants/repeats
within base intent, then intents/families under a declared weighting scheme.
Do not let a family with more paraphrases dominate an unlabelled pooled score.

Operational reporting includes original task completion, actual unsafe effects,
human interventions per 100 actions, human waiting/handling time, abandonment,
unknown and partial outcomes, recovery work, duplicate effects and complete cost.
Record preparation, parsing, evidence ingestion, invalidation, authorization,
communication, dispatch and reconciliation, not just a favorable inner-loop timer.

Add joint verified useful-and-safe completion: the original legitimate goal is
completed, no forbidden effect occurs during the defined full execution window,
and the observation coverage needed for that conclusion is established. Report
this separately for clean and attacked runs, while retaining original task and
attack-success metrics for comparison. Unknown/insufficient observations cannot
satisfy this endpoint. Report missingness and conservative sensitivity bounds;
an unobserved outcome is neither a confirmed unsafe event nor confirmed safety.

Latency includes p50/p95/p99 where sample support is adequate, cold and warm
paths, sample count, offered load, rejected work and measurement boundaries.
Do not extrapolate a local verifier time to enterprise SLA or provider latency.

## 8. Statistical Analysis

Use paired comparisons where the same base task is run under matched systems.
Cluster uncertainty estimates by independently sampled intent/family and account
for variants and repeats; they are not additional independent cases. State the
sampling population. A convenience dataset does not establish population-wide
customer coverage, regardless of a narrow confidence interval.

Choose sample sizes from the intended claim, failure prevalence and pilot
variance, not a desired perfect score. Use an appropriate interval for rare/zero
failure counts; naive bootstrap of zero failures is degenerate. The approximate
"3/n" zero-event upper bound presumes independent Bernoulli trials and is not
valid simply because there are n runtime variants.

Preregister primary/secondary endpoints and any multiplicity handling. Report
negative findings, confidence intervals and effect sizes, not only p-values or
the best-performing workload. Record analysis changes as exploratory.

A claim such as "without increasing review burden" requires a predeclared
non-inferiority margin justified by the intended use, adequate precision/power,
directional confidence-interval rule and joint endpoint/multiplicity rule.
Failure to find a significant loss is not evidence of preservation. Without
those conditions, report estimated tradeoffs and uncertainty instead. Safety
limits for severe failures remain separate from an averaged utility score.

## 9. Security and Reproducibility

Synthetic secrets and owned local/sandbox receivers are the default. Any real
external service requires explicit authorization, rate/cost limits, cleanup and
privacy rules. Inputs may contain adversarial text and commands: do not execute
them merely to classify or display them. A benchmark runner is not automatically
a secure sandbox.

For public or retired cohorts eligible for release, publish exact source
versions, dependency closure, environment lockfiles, permitted datasets, raw
per-case observations, failure ledger, scoring code and replay instructions
with content hashes. Preserve third-party notices and
provider/privacy restrictions. Public artifacts omit credentials and customer
material. Remote effects are independently read back only within the provider's
actual contract; lack of readback is unknown, not proof of non-execution.

For active hidden cohorts, retain raw inputs, labels, traces, failures and replay
material sealed with controlled auditor access rather than release them publicly.
Arguments, observations and diagnostic examples can leak a hidden case even if
its dataset file is withheld. Public reports use aggregates and reviewed redacted
coverage evidence. Publish full material only after cohort retirement and rights
review; record what independent auditors could access and any reproducibility
limitations. An accidental disclosure quarantines the related family and marks
affected result versions; it is not silently repaired by replacing hard cases.

## 10. Acceptance and Publication Gates

A stable benchmark needs outside case review, validated scoring and actual
custody. A publishable study needs a discriminating contribution and completed
results. A production claim separately needs supported profiles, trustworthy
identity/evidence, tenant isolation, key/storage lifecycle, real recovery,
load/cost measurements and a controlled customer pilot.

No result threshold, broad customer-coverage percentage, industry certification,
venue acceptance or product readiness is asserted in this protocol draft.
