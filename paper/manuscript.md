# Action-Effect: An Empirical Protocol for Interchanging Effect Descriptions Without Conflating Evidence and Permission

**Ond Holdings Inc., Toronto, Ontario, Canada**

**Working draft. First drafted 18 October 2026; revised 19 October 2026,
America/Toronto (EDT, UTC-04:00).** Retrieval and run timestamps use UTC.
The Spec release's publication date is separate from any later publication
of this manuscript.

**Working paper for public review.** Bounded offline and live measurements,
retained failures, and report replays are included. America/Toronto is the
editorial timezone, not an attestation of the execution host's location.

## Abstract

Agent tools expose interfaces, while authorization concerns consequences under
particular implementations, arguments, credentials, and environments. Existing
systems already provide tool annotations, structured authorization requests,
policy decision interfaces, and expressive policy engines. The research problem
is therefore not to invent structured permission or another universal policy
decision point. It is to test whether a shared, implementation- and context-bound
effect description preserves meaning across integrations, makes unsupported
knowledge visible, and improves engineering outcomes relative to a competent
structured adapter. We propose a bounded empirical protocol separating wire
conformance, native-input mapping, authorization on independently specified
reference effects, integrated admission, observed task outcomes, and complete
cost. The proposed pilot maps GitHub issue-comment operations through official
MCP SDK transport and an SDK API lane, comparing description-plus-consumer-plus-OPA
with a complete structured adapter using the same OPA policy and enforcement
boundary. Deliberately lossy mapping is an ablation, not the main competitor.
The protocol records mapping errors masked by downstream denials, unsupported
semantics, processing failures, legitimate work withheld, and ambiguous provider
outcomes without awarding semantic correctness to accidental non-execution.
On 55 authored cases in 22 base-intent groups, both complete strategies matched
all 108 native lane instances and all 52 eligible authorization decisions. A
controlled live run matched 32 planned outcome checks and created 12 comments,
including four recovered after deliberately discarded acknowledgments. The
protocol's accepted-input offline median cost was 3.97% higher than the
structured baseline. These same-project observations support bounded
interoperability feasibility, not added safety or performance superiority.
Independent protected evaluation still requires actual input and outcome
custody; none occurred. No production readiness or new soundness theorem is claimed.

## 1. Problem and Proposed Contribution

A tool name identifies an interface, not every consequence of an invocation.
Conversely, a worrying string does not establish a harmful occurrence. A useful
interchange must retain the operation, affected resource, destination, data,
quantities, applicability, and uncertainty needed by the adopter's policy. It
must also explain what its evidence can establish. A signed statement can be
authentically attributed and still be incomplete or wrong.

This is not an empty space. MCP tool annotations explicitly describe themselves
as hints [S1]. AuthZEN standardizes authorization request and decision exchange
[S2]. OAuth Rich Authorization Requests (RAR) supports detailed permissions,
including separate objects that avoid combining unrelated permissions [S3].
OPA and Cedar already evaluate structured facts and expressive policies
[S4-S7]. A new serialization cannot claim these capabilities as inventions.

The proposed contribution is an empirical protocol at the boundary between
those facilities. It has three parts:

1. A testable interchange contract for coupled effect descriptions, binding
   evidence, coverage, and distinct processing outcomes. Its value must be
   demonstrated by independently implementable profiles and cross-integration
   tests, not inferred from the number of fields in a schema.
2. A factorized experiment that can distinguish a correct mapper from a wrong
   mapper whose output happens to be blocked, and a justified decision from a
   crash that happens to prevent execution. The same independently authored
   references are applied to every scored arm.
3. A reproducibility and custody procedure that retains unknowns, failed
   attempts, and utility loss in the scheduled populations, while separating
   public development from genuinely protected external evaluation.

These are proposed methodological and engineering contributions. Neither an
additional schema nor an evaluation checklist alone establishes scholarly
novelty. The decisive evidence would be reproducible distinctions that existing
competent integrations do not already supply, or useful cross-implementation
portability at an explicitly measured cost. Equal correctness with extra cost
is a legitimate result. Equality would not prove an added safety benefit.

## 2. Semantic and Trust Model

An invocation is interpreted under an implementation and relevant context. An
effect is a coupled tuple:

`(category, operation, resource, destination, data_class, quantities, modality)`.

An effect description adds a versioned effective profile, mapping revision,
invocation and implementation bindings, context binding, evidence references,
coverage, and explicit unresolved facts. This follows the public draft
[specification][spec]. It does not redefine the principal's current grant or
the application's execution occurrence identifier.

Coupling matters: permission for one resource/destination/data combination must
not be turned into permission for every combination of its fields. Exact
quantity representation and profile-defined identity comparison matter for the
same reason. Unknown, none, and known values are different states. Evidence of
a known effect must survive the presence of an unresolved descendant.

### 2.1 Evidence Is Not Permission

The experiment preserves the following boundaries, in both main arms:

| Stage | What its output can establish | What it cannot establish alone |
| --- | --- | --- |
| Description processing | Supported syntax and profile interpretation, possibly partial | Truth of an arbitrary declaration, authority, or completion |
| Evidence checking | A specified claim under particular bindings and assumptions | A broader effect bound or a current grant |
| Authorization | A decision using authenticated facts and current applicable policy | That the mapper is correct or the provider acted |
| Final dispatch gate | Admission or withholding at the controlled boundary | Atomicity with a remote provider |
| Provider observation | A particular covered occurrence or unresolved outcome | Absence of every possible descendant |

An accepted description remains `authority: not_evaluated`. A trusted applicable
denial is not canceled by unrelated uncertainty. Where a required obligation
cannot be established, the affected execution is withheld; the reason remains
unsupported semantics, invalid input, untrusted evidence, or evaluation failure,
not a falsely credited semantic block. Human review can decide whether to grant
authority within an explicitly accepted scope. It cannot make an invalid proof
valid or turn an unknown fact into an established fact.

An adopter may deliberately authorize a partial direct-effect profile for a
dedicated experimental resource. That is a scoped policy choice, not a silent
downgrade of a policy that requires complete descendant coverage. Other
resources must not inherit the experiment's acceptance of that uncertainty.

### 2.2 Ordinary Obligations, Not a New Theorem

Let `E` be possible relevant effects and `U` a claimed upper bound. If a sound
checker establishes `E subseteq U`, current authority permits `U`, and execution
remains mediated under the same assumptions, then the covered admitted effects
respect that authority. For a policy expressible as an allowed set `B`, this is
the ordinary implication from `E subseteq U` and `U subseteq B` to
`E subseteq B`. We claim no novelty for subset inclusion. Establishing the
premises is the difficult part and is not provided by a registry signature.

Actual policies can include history, aggregate budgets, separation of duties,
and temporal constraints; they are not generally reducible to independent
per-tuple membership tests. The interchange must not weaken those constraints.
Likewise, an observed trace is not a complete bound on possible behavior. This
is an evidence limitation, not a new impossibility theorem.

### 2.3 Threat and Observation Boundaries

Relevant faults include changed arguments, body or implementation drift,
untrusted declarations, stale context, tuple recombination, unsupported
operations, policy change between preparation and dispatch, duplicate
occurrences, and uncertain delivery. Framework faults and unavailable policy
or observation services are included, not removed from reporting.

The finite pilot does not establish complete mediation of arbitrary tools,
malicious provider internals, covert channels, or effects outside its declared
observation universe. An authenticated provider principal is distinct from a
principal name supplied inside a test input. Local evidence of approval is
distinct from provider evidence of completion.

## 3. Relation to Existing Interfaces

### 3.1 MCP Tool Annotations

The selected published MCP schema is `2025-11-25`, inspected at a fixed official
repository commit, not asserted to be the latest MCP revision. Its
`ToolAnnotations` includes `readOnlyHint`, `destructiveHint`, `idempotentHint`,
and `openWorldHint`; the schema warns that annotations are hints and must not
drive tool-use decisions when received from untrusted servers [S1]. MCP also
provides tool input/output structures. These are useful integration inputs,
not evidence of a complete invocation-specific consequence bound.

An Action-Effect profile could derive structured descriptions from the same
documented tool contract and permitted context, or exchange them through an
explicitly agreed extension or separate interface. It must not forge an
upstream-standard `effects` field or bypass MCP transport authorization. This
paper does not claim a registered MCP extension or upstream approval. A
hints-only comparator is informative about information loss but cannot stand
in for a capable MCP integration with its own structured adapter.

### 3.2 AuthZEN and OAuth RAR

AuthZEN Authorization API 1.0 is a Final specification published on 11 January
2026. It defines subject, action, resource, context, and decision, including
evaluation and search interfaces [S2]. An agreed application profile can place
effect information in the existing extensible exchange. AuthZEN is not a
semantic inference engine, but it does not need to be replaced to use these
facts. Action-Effect is not an already standardized AuthZEN attribute.

Successful AuthZEN evaluation has a boolean decision and optional context.
The benchmark's `review`, unsupported, and processing-failure states therefore
need an explicitly documented application-level mapping. They cannot silently
become new AuthZEN boolean values, nor can an HTTP or PDP failure be credited
as a semantically justified `false` decision.

RFC 9396 already supports structured `authorization_details`, type-specific
semantics, and common fields such as actions, locations, and datatypes. Its
section 2.2 examples use separate objects for different access combinations.
Tuple preservation is consequently not novel merely because this draft also
requires it. RAR further explains in section 6.1 that arbitrary authorization
detail requests do not have a universal standardized comparison operation;
comparison depends on their type-specific semantics [S3].

The distinction is between describing possible or observed effects and
requesting or receiving authority. Neither a requested authorization detail
nor an accepted effect description is a grant. An application must still use
its actual authorization flow, resource-server checks, and current constraints.
OAuth's security BCP includes token privilege restriction and audience checks
[S8]. Reusable effect evidence must not cache or widen permission.

### 3.3 Complete Structured OPA and Cedar Adapters

OPA accepts structured data and Rego can preserve complete tuples, unknown
markers, and contextual constraints [S4, S5]. A complete native-input adapter
feeding OPA is therefore the primary baseline, with the same facts and policy
as the proposed wire-description arm. It is not a keyword filter, a list of
uncoupled allowed fields, or a hand-written imitation of OPA.

Engine and integration failures need deliberate treatment. OPA's Data API can
return HTTP 200 without a `result` for an undefined document. Its documentation
also describes built-in errors evaluating to undefined by default and optional
strict built-in error handling [S4, S5]. A required total-decision interface
must validate the returned decision, declare its error configuration, and keep
missing output distinct from an intentional policy decision. The experiment
must not benefit one arm by hardening only its wrapper.

Cedar likewise supports a principal/action/resource/context request, policies,
entities, and schema-based validation [S6, S7]. A competent Cedar comparator
would use a typed, relationship-preserving projection and equivalent trusted
facts, rather than a deliberately impoverished translation. Native Cedar uses
default deny, forbid-overrides-permit, and skip-on-error, returning diagnostics
for erroneous policies. An error in one policy can coexist with an `Allow`
from another. That documented behavior is not automatically a Cedar bug.
Any stricter profile wrapper, handling of semantic unknowns, or review route
must be explicit, tested, and symmetric between compared arms. Validation of
policy against a schema is not authentication of supplied facts.

Cedar is a proposed additional policy-engine lane, not a measured component
of the OPA runtime pilot. An OPA-versus-Cedar experiment would require its own
matched policies and reference decisions; it must not be inferred from this
paper's OPA-only design.

### 3.4 Provenance, Digests, and Provider Semantics

W3C PROV-DM supplies entity, activity, agent, and derivation concepts [S9]. A
provenance structure can help explain an evidence chain but does not by itself
authenticate the chain's factual claims. RFC 8785 supplies JSON
canonicalization, not semantic truth or permission [S10]. Its general numerical
requirements must not be conflated with the limited numerical domain of the
existing offline consumer profile.

GitHub's version-selected REST documentation explicitly says issue-comment
creation triggers notifications and may encounter secondary rate limiting
[S11]. A description of one direct comment creation is therefore only a
partial description. Notification possibility is known from the provider
contract; particular recipients, deliveries, webhooks, and provider-internal
descendants are not established by reading back the comment. The initial
profile retains this partial scope as `unobserved_descendants`; it does not
infer a complete notification tuple. These unresolved effects must not be
described as absent.

HTTP semantics explains why non-idempotent requests must not be blindly
retried after uncertain delivery [S12]. A synthetic marker can support later
readback; it is not a provider idempotency key. Nor does an MCP idempotence
hint create such a key.

This is a focused primary-source compatibility review, not a completed
systematic scholarly novelty review. Prior effect systems, abstract
interpretation, capabilities, information-flow enforcement, and agent runtime
governance still require a claim-specific literature comparison before any
submission. No superiority over an unintegrated named system is asserted.

## 4. Bounded Runtime Pilot

The [approved runtime design](../docs/design/2026-10-19-runtime-pilot.md) proposes
one direct operation: creating a synthetic comment on an owned dedicated public
GitHub test issue. Native SDK input is `{owner, repo, issue_number, body}`. The
MCP lane represents a `tools/call` of `add_issue_comment` with those arguments.
The measured implementation is Bench
[`9f638df`](https://github.com/OndCo/Action-Effect-Bench/commit/9f638df994504ba6f5d82c0b5409922a0be7a72e).
Reports record MCP SDK `1.32.1`, Octokit `22.0.1`, OPA `1.21.2`, Node
`22.18.0`, and Python `3.9.6`, with dependency and executable hashes. Offline
evaluation calls the local mapping/checking paths and real OPA on SDK- and
MCP-shaped captures; it does not exercise provider transport. The live MCP lane
uses the official SDK's stdio initialize/list/call flow, and both live lanes
use Octokit against GitHub.

The published Spec prerelease is [v0.2.0-draft.1][spec-release], at commit
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`, also pinned by Bench's
[spec-lock.json](../spec-lock.json). Its
[GitHub Issue Comment Profile 1][released-profile] is additive, with unchanged
core wire version `0.1.0-draft.1`. The released commit, effective profile digest,
and executed Bench sources still must be bound to each measured run. The profile
defines lane-specific local capture envelopes, not a replacement
MCP protocol, and compares checked projections rather than full description
digests, which differ across native lanes.

The profile binds the exact issue and API destination to the body SHA-256 and
UTF-8 byte count. It uses conservative, profile-defined identity comparison;
case folding or alias resolution must not be assumed. Extra action parameters,
unsupported operations, and request-supplied authority are not silently
accepted. The two lanes are transport/API integrations, not evidence of two
independent organizations or necessarily two implementation languages.
The current profile accepts a nonempty Unicode-scalar body of at most 8192
UTF-8 bytes and a finite path-safe input domain. Data classification is trusted
test configuration, not a DLP inference. The implementation identity
`github-comment-bridge/1` is a checked declaration, not an attestation of SaaS
code. Successful processing is `accepted_partial/declared_partial`, still with
`authority: not_evaluated`. Its policy requires explicit
`allow_partial_direct: true` after applicable denial checks; otherwise the
partial scope requires review.

The implemented path is:

```text
native invocation -> producer -> description -> separate consumer
                  -> OPA -> final dispatch gate -> GitHub -> fresh readback
```

The main baseline replaces producer/description/consumer with a complete
structured adapter while retaining the same OPA policy, authenticated principal,
admission conditions, occurrence ledger, dispatch code, and observation rules.
Both receive equal access to upstream documentation and relevant context.
Both must bind the exact body and resource. Shared protection must not be
charged exclusively to the baseline or credited exclusively to the proposal.

Only approved synthetic operations reach the provider. Invalid, adversarial,
or unsafe ablations remain offline or use an explicitly safe controlled
environment. A live subset includes both allowed and withheld work in both
lanes and both main strategies. Running a stub, replaying an old receipt, or
falling back to a fake provider is not a live result.

Before POST, the dispatcher reserves the occurrence and rechecks current local
experimental policy against the authenticated principal and bound request.
A changed grant cannot reuse an earlier positive check. This tests a local
stale-policy path; it does not make the authorization check atomic with GitHub
or guarantee instantaneous observation of provider-side revocation.

After delivery may have begun, retain the reservation and do not automatically
repeat POST. With a response ID, readback must bind that exact ID. Without one,
recovery requires a complete pre-dispatch ID list, an ID absent from that list,
and a unique exact body/actor match on the dedicated single-writer issue.
Its evidence is explicitly `new-current-content-since-preflight-not-execution-attribution`.
A concurrent same-account writer is outside that assumption. A single-host
ledger is not distributed exactly-once execution; missing or ambiguous evidence
remains unknown. The controlled lost-ACK experiment records a successful-response
discard witness separately from this weaker recovery observation.

## 5. Falsifiable Questions and Experimental Design

The detailed governing proposal is [PROTOCOL.md](../PROTOCOL.md). This section
specializes it to the finite pilot; it does not silently revise its frozen
corpora, scoring rules, or independence requirements.

| Question | Discriminating test | Outcome that limits the proposed benefit |
| --- | --- | --- |
| Q1: Does interchange preserve mapping meaning? | Compare each arm with reference coupled effects, bindings, and uncertainty; compare equivalent intents across lanes | Equal baseline accuracy shows no added mapping benefit; candidate loss or extra unsupported results is evidence against it |
| Q2: Does factoring the pipeline reveal policy-masked mapping errors? | Score mapping, reference-input authorization, and integrated admission separately under the same policy | Equal final blocks cannot support correct mapping; an undetected mapping defect defeats the claimed diagnostic value |
| Q3: Are uncertainty and freshness obligations preserved? | Vary implementation/body/context, current authority, required capabilities, and delivery knowledge with prewritten expectations | Stale acceptance, fabricated known facts, error-as-review, or permission reuse contradicts the intended contract |
| Q4: Is any portability or protection benefit worth its cost? | Matched legitimate work, provider readback, recovery, complete timing, and integration effort | Baseline parity with additional burden limits the benefit to whatever interoperability evidence is actually demonstrated |

### 5.1 Arms and Ablations

| Arm | Pipeline and purpose | Status in this draft |
| --- | --- | --- |
| Description + OPA | Native input, effect description, separate consumer, real OPA, common gate | Measured offline and live |
| Structured adapter + OPA | Native input, complete structured projection, same real OPA and common gate | Measured primary baseline, with equal observed correctness |
| Lossy-field diagnostic | Deliberately replace the body digest in 26 reference projections | Measured explanatory diagnostic, not a competitor or attack rate |
| Additional ablations | Remove binding, collapse unknown/failure, or omit invalidation one at a time | Proposed only; report as unrun unless actually integrated |
| Structured Cedar adapter | Equivalent typed policy projection with declared diagnostics and wrapper semantics | Future integration, not measured |

Both main arms need public-development competence checks before evaluation.
Freeze the same observable context, policies, principal, request validation,
interception point, retry budget, evidence requirements, and offered workload.
Publish any unavoidable differences. If a baseline integration is broken,
report that fault and repair it in development; do not interpret its failure as
evidence of a better semantic method.

The pure authorization track consumes case-author reference effects, not either
producer's output. An OPA engine cannot define the expected answer and then
receive independent correctness credit for agreeing with itself. Literal
decision expectations require separate authoring or adjudication under the
declared policy. An engine used to define an oracle is a noncompetitive
diagnostic, not an independently evaluated arm.

### 5.2 Unit, Freeze, and Exposure

The sampling unit is a base intent. Syntax variants, repeats, transport lanes,
and implementations are not extra independent intents. The pilot is an
author-designed convenience set, not a population sample of customer workflows.
Each scheduled case has a native input, initial context, reference effects and
unknowns, processing expectation, policy expectation, permitted execution,
task-success check, observation scope, and failure budget.

Freeze protocol/profile versions, inputs and literal expectations, policy,
candidate and baseline sources, semantic comparison rules, scoring, exclusions,
budgets, execution order, and analysis before results. Freeze how IDs, tuple
ordering, and lane-specific bindings are compared; semantically irrelevant
generated identifiers must not produce post hoc scoring discretion. Distinct
live occurrence markers and their expected body digests must be fixed before
their runs, not excused after a mismatch. Record provider-state and run-order
effects when executing matched live tasks sequentially.

**Authoring and independence.** The implementation, case authoring, and review
were AI-assisted within one project. The case author supplied literal inputs
and expected outcomes through a separate authoring path without inspecting
candidate output; implementation proceeded in parallel from the agreed public
interface. The corrected custody record describes case withholding until a
pre-execution/pre-result freeze, not a pre-implementation freeze. Early failures
then became exposed development regressions. This paper audits retained reports
after execution; it does not independently author their reference labels.
No external evaluation or protected external cohort occurred.

Keep public development, exposed regression, and protected external cohorts
separate. A newly learned failure becomes development material for future
versions. Hiding or hashing an exposed case does not make it unseen. Public
provider documentation constrains an oracle but does not independently author
the experiment's expected outcomes. The selected official GitHub
OpenAPI commit is `755ee33b4a81d51f6f07a902cce26cbec3b822f2` [S13]. The pinned
excerpt retains its upstream MIT notice; the run checks request/response example
structure and declared notification behavior, not all formats or API semantics.
The official-source review verifies commit identity; the measurement record
separately hashes the extracted artifact. Neither is independent governance
labeling or a reference authorization oracle.

The [external evaluation procedure](../docs/adoption/external-evaluation.md)
requires independently authored native inputs and expected outcomes sealed
before candidate exposure, distinct access controls for inputs and labels,
and recorded roles and conflicts. The tested system must receive an input;
that necessary exposure is not permission for its developers or hosted
provider operators to inspect active protected material. External independence
must be demonstrated by actual custody and governance, not inferred from two
languages, two repositories, or two AI-assisted sessions.

### 5.3 Pipeline-Masking Diagnostic

For every base intent, retain both mapping correctness and decision correctness.
At minimum report their four joint cells: correct/correct, correct/incorrect,
incorrect/correct, and incorrect/incorrect. Processing and observation failures
form additional explicit cells rather than being forced into this binary table.
The incorrect-mapping/correct-decision cell is important: a downstream denial
may mask missing destination or body information. It is not successful mapping.

Likewise, a mapper or PDP crash followed by a withheld dispatch is operational
non-execution, not correct semantic recognition. A complete baseline can reveal
the same diagnostic distinctions. Whether the interchange makes them easier to
reproduce across implementations is a falsifiable engineering question, not a
guaranteed advantage over the baseline.

## 6. Metrics and Analysis

All primary denominators are frozen scheduled populations. Missing, unsupported,
and failed outputs remain in them. Conditional metrics among successfully
interpreted cases may be supplementary, but cannot replace full-population
metrics. Pure malformed-wire tests occupy a separately declared track.

### 6.1 Mapping, Unknowns, and Failure

Report exact semantic mapping match, per-field error, coupled-tuple precision
and recall where references permit them, correct scope/modality, and binding
validity. Exact match requires the expected known tuples and explicit unresolved
facts; returning nothing is not an exact match. Publish coverage and ambiguous
reference counts alongside accuracy.

Unknown reporting is slot- and reason-specific. It includes unresolved
destination, required quantity, identity, descendant coverage, evidence conflict,
and unsupported semantics. For preassigned reference-unknown slots, report
correct unknown retention and unjustified known/none assertions. For
reference-known slots, report avoidable unknown assertions and field loss.
Failures or absent output earn no unknown-retention credit; report them
separately against the same eligible slots. The profile's downstream-scope
unknown must not become an assertion that notifications or webhooks are absent.

Report invalid input/configuration, unsupported profile or operation, untrusted
evidence, evaluation failure, timeout, crash, missing output, invalid output,
policy failure, provider failure, and observer failure by stage. A host failure
is not the same as a policy language's documented expression semantics. Publish
both raw diagnostics and the frozen classification rule, suitably sanitized.

### 6.2 Authorization and Admission

Let `A`, `B`, and `R` be the frozen expected-allow, expected-block, and
expected-review populations. For each, publish a full cross-tabulation against
valid allow/block/review and all non-decision outcomes. Main rates include:

| Endpoint | Numerator | Denominator |
| --- | --- | --- |
| False allow on expected block | Valid semantic allow on an expected block | All scheduled `B` |
| False allow on expected review | Valid semantic allow on an expected review | All scheduled `R` |
| False block | Valid semantic block on an expected allow | All scheduled `A` |
| Correct review | Valid semantic review on an expected review | All scheduled `R` |
| Unnecessary review | Valid semantic review on an expected allow | All scheduled `A` |
| Legitimate work withheld | Expected allow that was not dispatched, including faults and unsupported cases | All scheduled `A` |
| Forbidden dispatch | Actual dispatch contrary to the frozen admission reference | All scheduled expected-withhold cases |

Report these for pure authorization and integrated admission without conflating
their inputs. The final gate can fail even when the authorizer is right; report
its decisions and actual dispatch separately. A fault-induced stop contributes
to failure and legitimate-work loss, not to correct block/review. An all-block
system may have no false allows and still be unusable; no single safety score
is permitted to hide that outcome.

### 6.3 Completion, Recovery, and Observation

Task completion uses all scheduled legitimate-goal tasks. Withholding, timeout,
abandonment, and missing completion are non-completions. Track actual forbidden
effects within the frozen scope separately from decisions. Classify provider
outcomes as confirmed, partial, unknown, or conflicting; intentional
non-dispatch is recorded as not attempted, not delivery-unknown.

The unresolved-outcome rate uses all attempted occurrences, including uncertain
delivery. Also report its count against all scheduled tasks so selective
non-execution cannot make the system look well observed. Report reservations
retained, duplicate effects, no-resend violations, reconciliation attempts and
time, and human intervention/waiting/handling burden. Readback establishes only
what the returned provider evidence covers, not independent institutional review.

Joint verified useful-and-safe completion requires the original legitimate goal,
no forbidden effect within the declared execution window and effect universe,
and sufficient observation coverage to establish both. Unknown coverage cannot
meet this endpoint. A direct-comment-only result must be named scoped verified
completion, not safety of notifications, webhooks, or all descendants. Publish
clean and challenged workloads separately. Give conservative sensitivity bounds
for unresolved eligible outcomes, clearly labeled as bounds rather than extra
verified successes.

### 6.4 Complete Cost and Statistical Limits

Measure preparation, native parsing, mapping, serialization, consumer validation,
evidence acquisition/checking, invalidation, authorization, final recheck,
transport, dispatch, durable reservation, provider response, and reconciliation.
Retain raw monotonic stage timings, end-to-end wall time, cold/warm state, input
size, offered/rejected work, process startup, concurrency, resource usage,
network conditions, provider-call counts, and any human or monetary cost.
Overlapping timers must not be blindly summed. Absent instrumentation is
reported as unmeasured, not as zero cost.

Use paired comparisons for matched intents, with variants and repeats clustered
within intent. Freeze family weights and any common-capability subset in
advance; the full scheduled population still appears in the primary report.
Report per-lane and per-arm counts, effects, and uncertainty, not just pooled
scores or the most favorable workload.

A small convenience pilot warrants descriptive results, not population coverage,
enterprise SLA claims, or an unsupported p99. Tail percentiles need their sample
counts and estimation method. Zero observed failures does not prove zero risk;
an independent-Bernoulli bound is not justified by counting correlated variants
as independent trials. Any later claim of preserved utility or review burden
requires a justified preregistered non-inferiority margin and adequate precision,
not a nonsignificant difference. Hypotheses, sampling rationale, multiplicity,
and failure/rerun rules must be fixed before confirmatory evaluation.

## 7. Current Artifacts and Limitations

The released GitHub profile and two complete implementations establish a finite
test surface, not general effect inference. The earlier refund profile remains
separate: its [102-case rerun](../reports/offline-consumers-2026-10-19T03-59-16-707Z.json)
matched both consumers without adapter faults. Opt-in `offline-consumer-v1.1`
clarifies startup-configuration and compound-error precedence without rewriting
frozen v1. Neither that rerun nor its unit tests count as new runtime workloads.

The measured source's [Linux/macOS CI](https://github.com/OndCo/Action-Effect-Bench/actions/runs/39199258635)
succeeded. The reported suite comprises 64 Spec JavaScript, 11 legacy Bench
JavaScript, 115 Spec Python, 333 runtime JavaScript, and 50 runtime Python
methods: 573 methods, not 573 benchmark cases or independent evaluations.

Material limits remain after the bounded run:

- One direct GitHub operation and synthetic public inputs do not cover arbitrary
  tools, customer workflows, autonomous model decisions, or cross-domain effects.
- Notifications, recipients, delivery, webhooks, and other descendants remain
  unknown. All accepted mappings are partial; comment readback is not a
  transitive effect bound or a general useful-and-safe completion guarantee.
- The host, configured principal/class, provider adapter, policy files, and
  same-host ledger are trusted. Bridge identity is declared, not attested SaaS
  code. A hash does not make a dishonest capture or report truthful.
- Local policy reload after asynchronous preparation is not atomic with the
  remote POST. Snapshotting configuration and binding response/readback IDs
  closes specific reviewed defects, not every concurrent mutation or revocation
  race.
- ID-less recovery assumes complete preflight, unique exact new content/actor,
  and a dedicated single writer. It establishes new current content, not
  execution attribution. A same-account concurrent writer can violate that
  assumption; distributed exactly-once delivery is not established.
- Shared policy, contract, and project control permit correlated errors.
  Independent reference authoring within the project is not external
  validation. The number of external independently authored evaluations is zero.
- The cold, small, sequential timing samples do not establish throughput, tail
  latency, isolation, staffing savings, integration effort, monetary savings,
  or customer deployment readiness.

Internal review reports eight gate regressions involving stale or edited old
content, ID binding, configuration changes across awaits, and policy freshness,
corrected before the measured commit. This is development history, not another
independent cohort. The measured live run uses only the corrected source.

## 8. Results

### 8.1 Sources and Denominators

The [offline report](../reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json)
and [live report](../reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json)
use Bench `9f638df994504ba6f5d82c0b5409922a0be7a72e` and Spec
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`. Both record stable source
inventories; all 49 entries match the respective frozen Git blobs in the
[editorial arithmetic audit](measurement-audit.json). Bench's reported dirty
status includes documentation and reports and is not represented as a clean
checkout. Checksums identify bytes, not independently authenticated events.

The offline cohort has 55 authored cases in 22 base-intent groups: 53 SDK and
55 MCP inputs, giving 108 lane instances per strategy and 216 strategy rows.
The two omitted SDK renderings are inapplicable MCP-specific inputs, not failed
or silently dropped work. Accepted input comprises 26 authored cases in
13 groups, rendered in both lanes: 52 rows per strategy. No independent-trial
or population-accuracy claim follows from these related observations.

### 8.2 Offline Mapping and Authorization

| Check, per strategy | Protocol | Structured baseline |
| --- | ---: | ---: |
| Exact status, reason, and supported projection | 108/108 | 108/108 |
| Accepted partial mappings | 52 | 52 |
| Invalid input / untrusted evidence / unsupported profile | 51 / 4 / 1 | 51 / 4 / 1 |
| Exact decisions among eligible mappings | 52/52 | 52/52 |
| Allow / deny / review | 22 / 28 / 2 | 22 / 28 / 2 |
| Authorization not evaluated after nonacceptance | 56 | 56 |
| False allows on deny or review | 0/30 | 0/30 |
| Expected allows not allowed | 0/22 | 0/22 |
| Real masked mapping errors / operational failures | 0 / 0 | 0 / 0 |

Pure authorization matched 26/26 separately authored reference-projection
decisions (11 allow, 14 deny, 1 review), without either candidate mapper.
These are controls drawn from the same authored cases, not an additional
independent cohort. Correct nonacceptance is included in mapping scoring but
is not credited as a correct policy denial.

In a separate diagnostic, replacing 26 reference body digests with zeros
produced 0/26 exact mappings but 26/26 unchanged policy decisions. This
deliberately planted blind spot shows why authorization accuracy cannot
substitute for mapping checks. It is neither a competitor weakness, an observed
attack rate, nor a naturally occurring error in either complete strategy.

### 8.3 Controlled Live Outcomes

The live run on [issue #1](https://github.com/OndCo/Action-Effect-Bench/issues/1)
ran from 2026-10-19T04:24:32.195Z to 04:26:11.245Z. Eight scripted scenarios,
two strategies, and two lanes produced 32 scheduled checks, not 32 independent
incidents or 32 successful comment-creation tasks.

| Observed category, per strategy | Protocol | Structured baseline |
| --- | ---: | ---: |
| Planned outcome/reason checks satisfied | 16/16 | 16/16 |
| Ordinary immediate confirmations | 4 | 4 |
| Lost ACK: initially unknown, then read-only confirmed | 2 | 2 |
| Duplicate occurrences suppressed | 2 | 2 |
| Withheld: policy deny / review / invalid-policy failure | 4 / 2 / 2 | 4 / 2 / 2 |

The issue started with zero comments and ended with 12 run-scoped new comments:
eight ordinary writes and four controlled lost-ACK writes. Duplicate occurrences
added none. The four initially unknown deliveries are 4/12 new-create attempts
and 4/32 scheduled checks by design, not an estimated outage probability.
Each has a `successful_post_ack_discarded` witness and a read-only recovery
record with `automatic_resend: false`. This injected loss follows a successful
real POST response; it is not a naturally occurring network outage.

The four invalid-policy rows are genuine evaluation-failure classifications,
correctly withheld, not four semantic denials. Thus 32/32 planned checks does
not mean every row succeeded operationally. Final confirmations cover direct
current content only; downstream effects remain unresolved.

### 8.4 Cost Without a Speed Ranking

| Median elapsed time | Protocol | Structured baseline | Observations per strategy |
| --- | ---: | ---: | ---: |
| Accepted-input offline mapping/check plus OPA | 50.391 ms | 48.468 ms | 52 |
| All-input offline path, including rejection | 0.042 ms | 44.507 ms | 108 |
| Ordinary live completion | 3110.848 ms | 3161.205 ms | 4 |

The accepted-input difference is 1.923 ms, or **3.97% more median cost** for
the protocol, computed as a ratio of marginal medians, not a median paired
percentage or a significance result. Accepted includes deny/review decisions;
this is not provider-task latency. The all-input median crosses a different
execution boundary: 56 protocol rows stop in JavaScript without Python startup,
whereas the structured adapter starts Python. It is not comparable useful-task
speedup and is not used as a performance headline.

Offline accepted costs include cold Python communication/checking and real OPA
startup. Normal live costs additionally include identity lookup, preflight,
ledger, HTTP POST/readback, and cold MCP transport where applicable. The entire
live run took 99.049 seconds, including one-second pacing waits excluded
from row timers. Initial rows overlapped same-host read-only offline replay;
the run was not an isolated performance experiment. No speed ranking or SLA
is supported by four normal observations per path.

The host reports Darwin arm64, Apple M4 Pro, 14 logical CPUs and 24 GiB memory.
America/Toronto is editorial metadata, not execution geolocation.

### 8.5 Retained Failure and Replay

The [first failed offline report](../reports/runtime-pilot-offline-2026-10-19T03-40-48.927Z-769420.json)
is retained. Its scorer counted 52 apparent masked errors per strategy because
it compared null-prototype and ordinary objects. Comparing serialized JSON
values instead finds 108 exact protocol mappings and 100 exact structured
mappings; the remaining eight structured rows have numeric/Unicode error-
classification mismatches. They are not 52 real policy-masked defects.
The final and initial reports contain the same 216 input/context/policy and
expected records. Repairs changed scoring/implementation, not those labels.
The complete initial executable source tree was not archived, so the first
attempt is retained evidence, not an exact old-source rerun claim.

The [offline replay](../reports/runtime-pilot-replay-2026-10-19T04-24-39.129Z-61da80.json)
passed 216 strategy rows plus 52 reference/diagnostic records. The
[live replay](../reports/runtime-pilot-replay-2026-10-19T04-26-57.109Z-690395.json)
passed 32 rows and matched all 12 unique comments through unauthenticated GETs
at its recorded check time. The
[attempt journal](../reports/runtime-pilot-live-attempt-338f0652-715c-4095-84df-4f19d8e2f8c7.jsonl)
contains one begin, 32 scheduled, 32 result, and one end record, consistent with
the live report. Replays check recorded consistency, calculations, and current
content; they do not authenticate an operator, replay historical latency,
establish historical fsync, or prove complete execution causality. Later
changed/deleted/rate-limited content must remain a failed or unavailable readback,
not an assumed match. Exact hashes and commands are in the
[measurement record](measurement-contract.md).

## 9. Adoption, Rights, and Publication Boundary

Adoption is staged and interface-only: implement a bounded profile, test it
offline, compare non-dispatching decisions, then consider a separately approved
owned-resource experiment. No OSuite account, endpoint, module, purchase, or
implementation is required. The [quickstart](../docs/adoption/quickstart.md)
documents the implemented installation, offline, replay, and authorized-live
interfaces, with automatic read-only lost-ACK recovery. These interfaces and
their unit tests do not establish completed measurements or customer deployment
readiness.

The public RFC seeks concrete tests: contradictory mappings, tuple-loss cases,
unsupported facts, drift, error classification, fair baseline comparisons, and
independently authored evaluation proposals. The [outreach drafts](../docs/adoption/outreach.md)
are unsent editorial material, not evidence of invitations delivered or adoption.
Active protected inputs or expected outcomes must never be posted in a public
issue. Unrelated protected research material is excluded entirely.

The owner approved MIT publication of both repositories' selected original
contributions. Third-party standards, source material, and externally submitted
data retain their applicable rights; incorporation needs documented contributor
authority and license assent under [CONTRIBUTING.md](../CONTRIBUTING.md).
MIT publication is not patent clearance, a separate patent covenant, legal
certification, standards-body approval, or consent to another party's authorship.
The current stewardship is convenor-led, not an independent governing body.
This institutional working paper is for public review, not an automatic formal
submission. Any formal submission or individual-author byline requires separate
confirmation; no external coauthor, endorsement, or custodial appointment is
implied. Outreach copy remains unsent.

## 10. Conclusion

The useful test of Action-Effect is not whether a description can contain more
fields, but whether different integrations preserve the same supported meaning,
expose the same limits, and deliver useful controlled work at a justified cost.
The protocol makes failures and strong-baseline parity visible instead of
treating them as inconvenient exceptions. The completed bounded study found
equal mapping and authorization checks, equal planned live outcomes, and higher
accepted-input offline median cost for the protocol. Its contribution is an
inspectable interchange and empirical method with explicit evidence limits,
not demonstrated superiority over a competent structured adapter. Independent
evaluation, other domains, and realistic operational workloads remain open.

## References

Exact successfully retrieved official URLs, selected versions or commits, UTC
retrieval timestamps, raw-response digests, scope notes, and the unsuccessful
partial retrieval are recorded in [sources.json](sources.json). Documentation
commit identities are not claims about an installed engine version. Third-party
source captures are not redistributed.

- **S1.** Model Context Protocol, [2025-11-25 schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/c4c367f9f58296a7053f5c78a52fd02bfbb56a49/schema/2025-11-25/schema.ts), `ToolAnnotations` and tool definitions; selected published revision.
- **S2.** OpenID Foundation, [Authorization API 1.0](https://openid.net/specs/authorization-api-1_0.html), Final, 11 January 2026; sections 5-7.
- **S3.** Lodderstedt, Richer, and Campbell, [RFC 9396: OAuth 2.0 Rich Authorization Requests](https://www.rfc-editor.org/rfc/rfc9396.txt), May 2023; sections 2.2, 6.1, 7, and 9.
- **S4.** Open Policy Agent, [REST API documentation](https://github.com/open-policy-agent/opa/blob/7bcf86187363b525802096f4668c2db1e058a831/docs/docs/rest-api.md), source snapshot `7bcf86187363b525802096f4668c2db1e058a831`; Data API.
- **S5.** Open Policy Agent, [Policy Language documentation](https://github.com/open-policy-agent/opa/blob/7bcf86187363b525802096f4668c2db1e058a831/docs/docs/policy-language.md), same source snapshot; objects, defaults, and built-in errors.
- **S6.** Cedar, [Authorization documentation](https://github.com/cedar-policy/cedar-docs/blob/3a37098eba6e02e716949cfc92b889b38db25602/docs/collections/_auth/authorization.md), source snapshot `3a37098eba6e02e716949cfc92b889b38db25602`.
- **S7.** Cedar, [Policy validation documentation](https://github.com/cedar-policy/cedar-docs/blob/3a37098eba6e02e716949cfc92b889b38db25602/docs/collections/_policies/validation.md), same source snapshot.
- **S8.** Lodderstedt, Bradley, Labunets, and Fett, [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.txt), January 2025; section 2.3.
- **S9.** W3C, [PROV-DM: The PROV Data Model](https://www.w3.org/TR/2013/REC-prov-dm-20130430/), Recommendation, 30 April 2013.
- **S10.** Rundgren, Jordan, and Erdtman, [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.txt), Informational, June 2020.
- **S11.** GitHub, [REST issue-comment documentation](https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28), selected API version `2022-11-28`; create/get comment and provider side-effect notice.
- **S12.** Fielding, Nottingham, and Reschke, [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.txt), June 2022; section 9.2.2.

- **S13.** GitHub, [REST API description commit](https://api.github.com/repos/github/rest-api-description/commits/755ee33b4a81d51f6f07a902cce26cbec3b822f2), `755ee33b4a81d51f6f07a902cce26cbec3b822f2`; commit metadata only, not the extracted schema or governance labels.

[spec]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/SPEC.md
[spec-publication]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/PUBLICATION.md
[spec-release]: https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1
[released-profile]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/profiles/github-issue-comment/README.md
