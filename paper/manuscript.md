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

Action-Effect is a versioned interchange for coupled effect descriptions bound
to captured arguments, implementation declarations, context, evidence, and
explicit coverage. We implement a finite GitHub issue-comment profile with a
JavaScript producer, a separately written Python checker, current OPA
authorization, and an occurrence-reserving dispatch gate. The technical contract
specifies canonical preimages, ordered refusals, and read-only recovery after
uncertain delivery. A factorized measurement method separates mapping,
reference-input authorization, admission, observation, task utility, and cost.
The main comparator is a complete structured adapter sharing the same policy,
projection semantics, and dispatch controls. In the frozen v0.2 study, both
strategies matched 108 native lane instances from 55 authored cases in 22 intent
groups and all 52 eligible decisions. A controlled live run matched 32 planned
checks and created 12 comments, including four recovered after deliberately
discarded acknowledgments. Accepted-input offline median cost was 3.97% higher
for the protocol. A separate read-only study used an existing Azure model and
the official GitHub MCP server on six maintainer goals. In its first run, all six
completed loop and schema checks. Only one extracted Markdown body fit
6000 bytes, and none of the complete JSON responses met the original delivery
contract; review identified conflicting harness instructions. Internal fact
review marked 27 of 30 facts met, two partial, and one incorrect. An amended
repeat completed two tasks and retained four byte-budget failures; all six
fully packaged repeat outputs nevertheless fit the larger comment-profile
limit. Its separate review marked 28 facts met, two partial, and none incorrect,
without reclassifying failed loops. A subsequent owned-resource study delivered
the two eligible reports through SDK and official MCP, then exercised six
separate process/acknowledgment faults. Twenty fresh workers made five comment
calls; all eight duplicate probes made none. Three delivered effects were
recovered read-only, while one pre-send interruption correctly remained unknown.
Human utility remained unmeasured. These observations show why semantic mapping,
useful output, and delivered effects
need distinct evidence. The contribution is an implemented interchange,
factorized evaluation, and inspectable conditional recovery contract, with
reproducible parity, cost, and integration findings. The evidence is
same-project and bounded; provider descendants and external validation remain
outside the observations.

## 1. Problem and Contribution

A tool name identifies an interface, not every consequence of an invocation.
Conversely, a worrying string does not establish a harmful occurrence. A useful
interchange must retain the operation, affected resource, destination, data,
quantities, applicability, and uncertainty needed by the adopter's policy. It
must also explain what its evidence can establish. A signed statement can be
authentically attributed and still be incomplete or wrong.

Existing interfaces supply complementary parts of this system. MCP annotations
describe tool-level hints [S1]; AuthZEN standardizes decision exchange [S2];
OAuth Rich Authorization Requests (RAR) carries detailed permission objects
[S3]; OPA and Cedar evaluate structured facts [S4-S7]. Action-Effect addresses
the transfer and checking of effect descriptions between native capture and
authorization, while preserving these systems' responsibility for authority.

We present three implemented contributions:

1. A versioned coupled interchange and finite profile. Exact native/context
   preimages, implementation declarations, evidence references, body quantities,
   coverage, and unresolved descendants cross a JavaScript/Python boundary.
   Equivalent SDK and MCP captures retain distinct invocation identities while
   producing the same supported direct-effect projection.
2. A factorized evaluation with a complete structured baseline. Literal mapping
   references, pure authorization controls, integrated outcomes, and full cost
   accounting distinguish correct semantics from a downstream decision that
   masks a mapping defect. Retained reports, source pins, and replay procedures
   make these comparisons inspectable, including unsuccessful attempts.
3. A conditional dispatch and recovery contract. Durable occurrence reservation,
   current-policy checks, exact-ID readback, and no-resend recovery have explicit
   state transitions, failure cuts, trust dependencies, and counterexamples.
   Task correctness is evaluated separately from request binding and delivery.

The measured result is cross-language mapping parity with a small accepted-input
cost increase, plus controlled recovery and concrete native-integration findings.
The first real-model run also exposed an output-contract mismatch that successful
loop and citation checks did not detect. The amended repeat retained four
task-budget failures even though all six final comment preparations fit the
native profile. Actual delivery then preserved the two-eligible/four-withheld
split, and real-process recovery retained uncertainty instead of resending.
These findings motivate an engineering
question: when does interoperable description checking justify its additional
integration and runtime cost relative to a complete direct adapter?

### 1.1 Running Operation: A Maintainer's Comment

Consider a maintainer preparing a release-verification note for a dedicated
issue. We use the illustrative body `abc` to expose the exact byte bindings.
A useful report additionally needs source-based checks of its technical
conclusions, as the real maintainer tasks in Section 8 demonstrate.

The SDK capture is `N = {lane: sdk, call: {owner: OndCo, repo:
Action-Effect-Bench, issue_number: 1, body: abc}}`, with strings understood as
JSON strings. The configured context `C` identifies a principal, the class
`synthetic-public`, and `github-comment-bridge/1`. The MCP capture nests the same
four parameters under `call.arguments`, with `call.name = add_issue_comment`.
These captures express the same direct requested mutation but are not the same
JSON document. An exact capture digest should distinguish them.

The checked projection says to create a comment on `OndCo/Action-Effect-Bench#1`,
at the constructed GitHub API endpoint, carrying exactly three UTF-8 bytes whose
SHA-256 is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
It does not say the principal has permission. It also does not say that the
provider will send no notification. The provider contract describes notification
behavior, while particular recipients, delivery, and further descendants remain
outside the observed direct-comment scope.

Suppose policy grants the triple `(repository, issue, class)` only for this
dedicated resource, with a body-byte limit and explicit acceptance of partial
direct scope. A well-formed three-byte proposal can then receive `allow`. Keeping
the same proposal but revoking policy gives `deny`; keeping the grant but not
accepting partial scope gives `review`. Adding an unknown executable parameter
does not give either answer: it makes the native request invalid. A missing
policy file is an evaluation failure. These differences tell an operator whether
to fix a request, ask for authority, restore a service, or investigate delivery.

The gate reserves an occurrence before dispatch. If the POST response is lost,
the semantic request and desired task have not changed, but knowledge of delivery
has. Creating a fresh occurrence and retrying would hide that distinction and
could create a duplicate. The original occurrence remains reserved, and
reconciliation can only read. A matching current comment is stronger evidence
than a local `allow`, but weaker than a proof of the provider execution history.

**Table 1. One operation, different obligations.** These are explanatory
counterfactuals, not additional measured cases.

| Change to the running operation | Obligation to reconsider | Required interpretation |
| --- | --- | --- |
| Body changes from `abc` to `abd` | Native, declaration, body and description bindings | Recompute/check exact bytes; old evidence is inapplicable |
| SDK capture becomes MCP capture | Invocation identity, not the intended direct tuple | Different capture digest; equal projection can still be correct |
| Issue number changes | Coupled resource, endpoint and grant | Map the new issue, then authorize that issue |
| Policy is revoked | Current authority | Prior description acceptance cannot override denial |
| Policy file is malformed | Policy processing | Withhold as failure, not a successful semantic denial |
| POST may have escaped but ACK is absent | Delivery knowledge and occurrence ownership | Retain unknown; do not send another POST |
| Another actor creates identical text | Observation binding | Body equality alone does not confirm this occurrence |
| Technical note contains a false conclusion | Original task utility | Correct mapping and authorization do not make the note correct |

### 1.2 Why Keep the Tuple Intact?

Take two grants: `(repository-A, issue-1, public)` and
`(repository-B, issue-2, internal)`. Independent membership tests against the
sets of repositories, issues, and classes would also admit
`(repository-A, issue-2, internal)`. Neither grant says that. The safe comparison
looks for one complete matching grant, rather than constructing a product of
independently allowed fields. The prototype's Rego rule does exactly that.
This is a conventional structured-policy obligation, not a new authorization
mechanism. An interchange must not destroy relationships an authorizer needs.

```text
grant A: [ repository-A | issue-1 | public   ]
grant B: [ repository-B | issue-2 | internal ]
                   retain each row
                         |
proposed [ repository-A | issue-2 | internal ]
                         |
              no complete matching row
                         v
                        deny
```

**Figure 1. Coupling is a row-level obligation.** Independent field sets create
permissions that neither input row asserted.

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

### 2.2 Conditional Guarantees and Assumptions

Let `E` be possible relevant effects and `U` a claimed upper bound. If a sound
checker establishes `E subseteq U`, current authority permits `U`, and execution
remains mediated under the same assumptions, then the covered admitted effects
respect that authority. For a policy expressible as an allowed set `B`, this is
the ordinary implication from `E subseteq U` and `U subseteq B` to
`E subseteq B`. This elementary implication identifies premises that an
implementation must discharge; a registry signature does not discharge them.

Actual policies can include history, aggregate budgets, separation of duties,
and temporal constraints; they are not generally reducible to independent
per-tuple membership tests. The interchange must not weaken those constraints.
Likewise, an observed trace supplies evidence about an occurrence rather than a
complete bound on possible behavior.

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

### 2.4 Identities and Canonical Preimages

Let `J(x)` be the UTF-8 encoding of the profile's canonical JSON value and
`H(x) = SHA256(J(x))`. Let `HB(b) = SHA256(b)` for an already specified byte
sequence. A digest of the JSON string `"abc"` is not the digest of its three
content bytes. The core's restricted RFC 8785-compatible domain rejects duplicate
decoded member names and non-scalar Unicode. Supported JSON number tokens are
safe integers without fraction or exponent syntax. Arrays retain order; object
keys are canonically sorted; strings are not normalized. Exact decimal quantity
strings are a separate domain, never interpreted through binary floating point.

The semantic action, native capture, description record, execution occurrence,
and provider object are distinct identities. The core does not allocate semantic
action or occurrence IDs for adopters. The concrete pilot bindings are below.

**Table 2. Exact identity targets.** `P` is the complete installed profile
manifest; `N` and `C` are complete native/context objects.

| Identity or binding | Exact preimage or source | Meaning of equality |
| --- | --- | --- |
| Effective profile digest | `H(P)` | Same canonical manifest, not authenticated publisher |
| Invocation binding | `H(N)` | Same captured lane, wrapper and arguments |
| Context binding | `H(C)` | Same complete context, including extra context fields |
| Implementation declaration | `H({id: github-comment-bridge/1, kind: declaration})` | Same declaration, not identical SaaS behavior |
| Mapping identity | Profile URI plus `#mapping`, revision `1`, digest `H(P)` | Same selected mapping contract |
| Declaration artifact | `H({native: N, context: C, profile_digest: H(P)})` | Same joint declaration inputs |
| Description record suffix | `H({native: N, context: C})` | Same pair; record ID alone omits profile revision |
| Complete description digest | `H(D)` | Same full description, evidence and unknowns |
| Body digest | `HB(UTF8(body))` | Same bytes without normalization or trimming |
| Ledger binding | `H({native: N, context: C})` | Same pair for the reserved occurrence, not permission |
| Ledger filename | `HB(UTF8(occurrence))` plus `.json` | Storage address for caller's occurrence string |
| Provider comment ID | GitHub response/readback integer | Provider object, not the execution occurrence |

The local invocation, context, implementation, and declaration URNs are selectors
with configured meanings. Their strings are not dereferenced. Hashing a URI,
hashing its selected object, and hashing an enclosing file would produce different
identities; only the declared preimage is valid. The mapping fragment is a local
contract identifier, not an instruction to fetch a page or resolve an ambient URL.

The record ID is insufficient to identify an accepted statement across profile
changes: its suffix binds `N,C`, while the full description binds `P`. Similarly,
the ledger binding omits policy state deliberately. Policy can narrow while the
request remains the same, so the stored pair must never act as permission reuse.
Different identities answer different questions; no digest is a universal ID.

### 2.5 Trust and Refusal Ownership

The threat model includes untrusted native input, malformed descriptions,
incorrect declarations, changed arguments, stale prepared data, and misleading
current-content matches. Hashing a compromised host's output cannot make the
host trustworthy. Gate code, credential acquisition, clocks, filesystem, policy
configuration, and provider adapter belong to this prototype's trusted base.

**Table 3. Trust ledger.** Each accepted fact needs a named acquisition path.

| Material fact | Acquisition/check | Trusted component | Residual failure or refusal |
| --- | --- | --- | --- |
| Native invocation | Snapshot of allowlisted fields | Capture and gate | A dishonest capture can misdescribe a bypassed call |
| Effective semantics | Installed manifest and consumer | Installer/profile maintainer/checker | Unknown revision is not dynamically fetched |
| Live principal | Authenticated-user lookup compared to context | Credential owner and provider adapter | Unavailable/different identity withholds |
| Data class | Configured context | Maintainer classification process | No content classifier establishes the label |
| Current grant | Policy loaded after asynchronous preflight | Local policy owner and OPA wrapper | Malformed/unavailable input is failure |
| Reserved occurrence | Exclusive creation and checked transitions | Local ledger/filesystem | Deletion, stale locks or other hosts break assumptions |
| Current content | Exact ID/issue/body/actor readback | Provider and bound read adapter | Missing/ambiguous content leaves unknown |
| Source/run identity | Blob inventory, report/journal hashes | Retained pins and run operator | Self-consistent fabrication is not excluded |
| Task success | Separate criteria and source review | Task evaluator | Authorized false statements still fail the task |

One organization can occupy several rows; listing roles does not establish
independence. Nor should the predicates be collapsed into a risk score. A policy
owner can resolve a grant decision, but cannot repair a malformed body on behalf
of the parser or manufacture a receipt. Refusal identifies the obligation and
owner that must be consulted before work can continue.

### 2.6 Conditional Invariants and Counterexamples

The following code-level invariants connect checker and gate behavior to
explicit assumptions. Each argument states its dependency and a counterexample
when that dependency is removed. The declared observation universe is the
direct comment; the arguments leave unresolved descendants unresolved.

**I1: accepted-description consistency.** Fix trusted profile `P`, native input
`N`, context `C`, deterministic `Project_P` and `Describe_P`, and a correct strict
comparison. Acceptance by Python `check` implies
`J(D) = J(Describe_P(N,C,Project_P(N,C)))`. The checker reconstructs all fields,
including evidence and unknowns, and compares the complete values. A changed
body hash or an extra array entry cannot pass by being well-shaped. This proves
consistency with an installed finite mapping, not truth about every real effect.
If that mapping omits a webhook, both implementations can agree on an incomplete
description.

**I2: decision congruence under baseline parity.** Identical complete projections,
authenticated context, policy bytes and deterministic total authorizer yield
identical decisions by substitution. Parity is therefore expected in the finite
domain, not a failed security result. The converse is false: identical decisions
need not mean identical projections. The planted body-hash diagnostic is a
counterexample because policy lacks an independent expected-body comparison.

**I3: one gate-level send per reserved occurrence.** Assume an intact shared local
ledger, atomic exclusive creation, no deletion/reassignment, and every write
passing through this gate. Only the caller that creates a reservation can reach
`reserved -> inflight`; that execution invokes `createComment` once. Repeated
calls see a record and do not send. This is an at-most-one invocation property
under local storage assumptions, not provider exactly-once behavior. Another host
with its own directory, a new occurrence for the same task, hidden adapter retries,
or provider duplication violates the premises or exceeds the conclusion. A crash
before POST may consume an occurrence without useful work.

**I4: locally fresh authorization, not atomic remote authorization.** With trusted
snapshots and policy ownership, the gate loads policy after awaited identity and
preflight checks. A change completed before that load is not hidden by an earlier
positive decision. A later change can still occur between local evaluation and
remote commit. That is a counterexample to global revocation atomicity, even if
there is no further application-level await before POST initiation. Removing an
await does not create a cross-organization transaction.

**I5: recovery creates no new write.** Reconciliation prepares, loads the ledger,
and reads the provider; it has no `createComment` branch. Assuming genuinely
read-only adapter methods, it cannot resend. It does not evaluate a fresh write
grant: observing an attempted effect is not requesting a new effect. Read
authorization remains the caller/provider's responsibility. An operator rerunning
the live task or a malicious read adapter is outside this routine's guarantee.

**I6: confirmation has two strengths.** With a response ID, exact ID, API URL,
issue URL, body and actor checks establish matching current direct content.
Without an ID, a complete preflight and one matching object with a previously
absent ID establish new current content since preflight. Neither establishes
complete execution history; the latter does not even establish which execution
caused creation. A same-account writer posting identical bytes defeats
attribution without defeating equality. The ID-less evidence string therefore
ends in `not-execution-attribution`.

These arguments distinguish control-flow properties from deployment premises.
Set containment cannot supply missing trust, exhaustive effects, currentness,
durability or provider behavior.

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
These objects preserve tuple relationships. RAR further explains in section 6.1 that arbitrary authorization
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
as the wire-description arm. It is not a keyword filter, a list of
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

### 3.5 Obligation-Level Comparison

The comparison unit is a responsibility at a boundary. An API transporting
decisions need not infer effects; an effect schema need not issue tokens; a
policy engine need not inspect a remote executable. Penalizing each component
for another's job would manufacture a gap. Table 4 identifies what the
integrating application must supply in every design.

**Table 4. Primary-source obligation comparison.** An application obligation is
not a documented defect in the named system.

| Obligation | Existing facility | Application / Action-Effect boundary |
| --- | --- | --- |
| Advertise tool intent and shape | MCP tools, schemas and hints [S1] | Bind actual arguments and trustworthy semantics; hints are not complete bounds |
| Request detailed authority | OAuth RAR typed details [S3] | Define comparisons, preserve permission objects and verify the grant |
| Exchange decisions | AuthZEN subject/action/resource/context [S2] | Agree on effect attributes and failure/review mapping |
| Evaluate complete facts | OPA objects and Rego [S4, S5] | Authenticate facts, preserve tuples and validate total output |
| Apply typed policy | Cedar schemas and diagnostics [S6, S7] | Specify errors and partial-scope semantics; not measured here |
| Restrict credentials | OAuth audience/privilege restriction [S8] | Actual resource-server enforcement remains necessary |
| Identify artifacts/derivations | RFC 8785 and PROV-DM [S9, S10] | Fix preimages and acquisition trust; derivation is not causality proof |
| Handle uncertain delivery | HTTP method semantics [S12] | Preserve occurrences and reconcile without blind non-idempotent retry |
| Describe comment creation | GitHub REST/OpenAPI [S11, S13] | Bind body/issue and retain notification uncertainty |

The proposal adds an agreement on description preimages, applicability, coverage,
unknowns and rejection semantics. A complete direct adapter can retain all those
facts internally. The question is whether making the agreement portable reduces
duplicated integration work or exposes mistakes across implementations. The
current pilot measures preservation and cost, not maintainer effort saved, and
does not isolate a benefit of this wire format from typed contracts generally.

A stronger future baseline could export its own complete typed record under
an equally explicit contract. It must not be denied hashes, context or failure
reasons. If interchange remains equal, governance, migration cost and available
consumers may determine the practical choice, rather than safety or speed.

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
uses the official SDK's stdio initialize/list/call flow against the
benchmark-authored `action-effect-comment-pilot` server, not GitHub's official
MCP server. Both live lanes use Octokit against GitHub.

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
protocol: native -> producer -> description -> separate consumer
baseline: native -> complete structured adapter
                         |
                 same real OPA and trusted facts
                         |
                 final gate -> GitHub -> fresh readback

pure authority: reference projections -> OPA (neither mapper)
```

**Figure 2. Measurement factorization.** Mapping, reference-input authority,
actual admission and provider observation have different answer keys.

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

### 4.1 Profile and Registry Lifecycle

The installed profile is a finite semantic program expressed by its manifest
and versioned rules. Repository release, core wire version, processing contract,
mapping revision, implementation declaration and dependency versions are separate
dimensions. `v0.2.0-draft.1` did not change core wire `0.1.0-draft.1`.
Similarly, opt-in `offline-consumer-v1.1` clarifies legacy refund processing
without silently rewriting the original contract or examples.

The comment manifest fixes permitted lanes, operation, path-safe identifiers,
body/issue limits, namespaces, local resolution, critical body-digest extension
and unknown scope. Its URI does not authorize loading arbitrary code. The
consumer loads locally configured semantics and independently reconstructs the
description rather than importing JavaScript's mapper or trusting its projection.

The core requires immutable revision meanings and experimental/stable/deprecated/
withdrawn states. A changed condition or evidence rule needs a new identity.
Withdrawal cannot silently substitute bytes: sensitive material can become
unavailable with a safe tombstone instead of remaining public merely to preserve
a hash. This prototype has no operating signed registry, tested key rotation
service or distributed freshness authority.

Byte caching and acceptance caching also differ. Cached JSON can remain readable
after evidence, trust configuration or context is stale. Reusing acceptance would
need the complete description, profile/mapping/checker revisions, implementation,
trust epoch and relevant dependencies. The pilot performs cold checks and has no
persisted acceptance cache. Python memoizes the installed profile within a
process, not an accepted invocation or permission. Neither a record hash nor
the occurrence ledger substitutes for that validation contract.

### 4.2 Ordered Native and Description Checking

Owner names are ASCII/path-safe and at most 39 characters; repository names are
path-safe strings of at most 100 characters, excluding `.` and `..`. Issue numbers
are positive integers at most 2147483647, not booleans or coerced strings. Bodies
are nonempty Unicode-scalar strings occupying at most 8192 UTF-8 bytes. Whitespace
and escaped NUL are not stripped. No caller-supplied endpoint, percent-decoded
identifier, template or executable expression is accepted.

**Algorithm 1. Native mapping (finite public contract).**

```text
Map(N, C, P):
  require exact outer keys {lane, call}; lane is sdk or mcp
  if lane is mcp:
    require {name, arguments}, scalar name and object arguments
    if name != add_issue_comment: unsupported_profile / operation
    A := call.arguments
  else: A := call
  require exact A keys {owner, repo, issue_number, body}
  require path-safe identities, issue range and scalar/UTF-8 body bounds
  require nonempty principal, data_class and implementation in C
  require C.implementation == github-comment-bridge/1
  Q := complete operation/repository/issue/endpoint/body-hash/bytes/class tuple
  D := exact profile description of N, C, Q, with the downstream unknown
  return accepted_partial / declared_partial, Q, D, H(D), authority:not_evaluated
```

Failure precedence is observable behavior. Invalid native shape precedes context
checks. Another otherwise shaped MCP tool is unsupported without executing its
arguments. Missing context and wrong implementation are distinct untrusted-evidence
reasons, not semantic review.

Python first bounds bytes/nesting and rejects malformed UTF-8, duplicate members
and framing. Its preliminary parser keeps fraction/exponent and oversized native
numbers outside the accepted domain without rounding or arbitrarily large integer
allocation. Native validation then classifies native number/scalar defects as
`native_input`. Accepted values are reparsed from the original bytes by the strict
core parser before hashing or acceptance. No preliminary value becomes a digest
preimage. This arrangement repairs the first run's precedence mismatch without
weakening the frozen core parser.

**Algorithm 2. Consumer `check`, in implemented order.**

```text
Check(frame):
  bounded request parse; require project/check operation and permitted keys
  load configured profile or fail as initialization/configuration error
  validate native input and context
  strictly reparse original bytes under the core JSON subset
  Q := independently Project_P(N, C)
  if operation is project: return accepted_partial, Q, authority:not_evaluated
  validate D's core structural shape
  resolve unique local effect/evidence IDs and quantity targets
  reject unknown critical extensions; require body-digest payload
  require representation of every required byte quantity
  E := independently Describe_P(N, C, Q)
  if J(D) != J(E): untrusted_evidence / description_binding
  return accepted_partial / declared_partial, Q, H(D), authority:not_evaluated
```

The exact comparison checks more than disconnected component hashes: it rejects
extra/missing evidence, changed coverage or assumptions, and reordered arrays.
It is correspondingly narrow. An equivalent meaning expressed through another
unsupported representation is not accepted. This is finite-profile consistency,
not general semantic equivalence. Limits and unexpected worker errors produce
evaluation failure, not a truncated partial success.

```text
native/context --> validate native --> strict core reparse --> projection Q
                                                               |
description D --> shape --> local references --> extensions -----+
                                                               |
                   expected complete description E <------------+
                                  |
                            J(D) == J(E)?
                            /          \
                 binding refusal    accepted partial
                                    authority not evaluated
```

**Figure 3. Ordered checking.** The consumer reconstructs projection from bound
inputs instead of extracting an authoritative answer from producer output.

### 4.3 The Exact Complete Baseline

`prepareAction` selects one of two paths. Protocol runs JavaScript `mapNative`,
constructs the description and invokes Python `check`. Structured calls Python
`project` directly on the same capture/context. Both return the same seven-field
projection and declared-partial result. The baseline has no deliberate tuple,
digest or unknown-information deficit.

Baseline and checker share the Python projection implementation; the JavaScript
producer was separately implemented. This isolates wire construction/validation
while introducing shared-code correlation. It is not two independent stacks or
an externally supplied product benchmark. Literal references and pure-authority
controls address different errors but do not eliminate shared design assumptions.

**Table 5. Matched and intentionally different work.**

| Obligation | Protocol | Complete structured baseline |
| --- | --- | --- |
| Native/context domain | JavaScript precheck and Python validation | Python validation |
| Complete projection | Producer proposes, consumer reconstructs | Consumer constructs directly |
| Wire/evidence association | Full description and exact binding check | No effect-wire round trip |
| Python boundary | Cold `check` process | Cold `project` process |
| Authority | Same wrapper, executable, Rego and current policy | Same |
| Principal and grant semantics | Same authenticated facts and coupled grants | Same |
| Reservation/dispatch | Same gate, ledger and provider | Same |
| Readback/no-resend recovery | Same exact receipt checks | Same |

The authorizer validates policy, projection, context and local OPA configuration,
in that order. It reconstructs allowlisted input rather than serializing arbitrary
objects with hooks or secrets. A bounded OPA process evaluates
`data.action_effect.decision`. Exactly one expression must return a recognized
decision/reason pair. Missing, malformed or failed output is evaluation failure;
successful process invocation alone is insufficient.

After validation, precedence is revocation, principal mismatch, absent coupled
grant, byte-limit excess, unaccepted partial scope, then allow. The first four
are denials; partial scope is review. The body digest is structurally validated
but not compared with an independent expected body by policy. Correct body
binding belongs to mapper/checker/gate, explaining the diagnostic without
implying an OPA defect.

### 4.4 Dispatch State and Failure Cuts

Before the first await, the gate snapshots native/context/optional description,
strategy, policy/ledger paths, occurrence, and bound provider methods. JSON is
canonicalized, strictly reparsed and recursively frozen. A caller cannot change
these options during identity lookup or preflight. Remote state and arbitrary
adapter internals are not frozen by this mechanism.

Preparation precedes exclusive reservation. An existing matching occurrence
returns `duplicate_suppressed/already_reserved`; a different binding returns
suppression with `binding_mismatch`. Neither grants a fresh occurrence. For a
new reservation, authenticated-principal comparison and complete comment listing
precede policy load. Preexisting matching body/actor content withholds. Only
allow can persist `inflight` with pre-dispatch IDs, then invoke the write.

```text
unseen --exclusive reserve--> reserved --persist preflight--> inflight
                                |                            |     |
                          deny/review/failure          exact GET   uncertain
                                |                            |     |
                                v                            v     v
                             withheld                    confirmed unknown
                                                                     |
                                                           read-only reconcile
                                                                     |
                                                                     v
                                                                 confirmed
existing occurrence --> duplicate_suppressed (no new send)
```

**Figure 4. Local state transitions.** No state after uncertain delivery has a
retry-to-write edge; a crash may leave an earlier durable state.

Reservation uses exclusive creation, restrictive permissions, file `fsync` and
directory `fsync`. Transition acquires a per-record lock directory, checks the
expected state, writes/syncs a unique temporary file, renames it and syncs the
directory. Metadata is allowlisted. A stale lock is never stolen automatically.
A persistence failure can retain reserved/inflight state and require operator
work: conservative retention has a liveness cost, not a completion credit.

**Table 6. Failure cuts.** Control-flow analysis, not a claim that the v0.2 live
run executed every crash cut.

| Cut | Durable/observable information | Permitted continuation |
| --- | --- | --- |
| Before reservation | No gate-owned occurrence | Fix preparation; provider dispatch not reached |
| Reserved, before preflight | Record exists; no dispatch edge | Suppress repeated occurrence; account for lost work |
| Preflight, before policy read | Current IDs known | Load current policy; failure withholds |
| Allow, before inflight persistence | Local decision only | Persistence failure must not send |
| Inflight, before provider call | State alone cannot distinguish a later crash | Read-only recovery; no resend |
| Provider committed, ACK absent | Object may exist; local ID may be absent | Preflight-qualified readback or unknown |
| Response ID known, GET fails | Possible commit with bound ID | GET that ID, not a convenient substitute |
| Readback succeeds, persistence fails | Seen current content, durable state may lag | Reconcile/read; never another write |
| Lock survives process exit | Ownership unresolved | Withhold; explicit operator handling |

### 4.5 Bound Observation and Recovery

`receiptFrom` checks positive safe-integer ID, exact expected ID when available,
exact API/issue URLs, body and actor. Stored digest/byte count summarize the
content; display URLs and timestamps cannot replace those bindings. The provider
constructs fixed GitHub requests, rejects redirects, applies timeouts and never
gets credentials from a proposal.

Listing is bounded to five pages of 100 and returns only after a page has fewer
than 100 entries. Five full pages cannot establish completeness and throw, even
if exactly 500 objects might exist. Absence from page one is not absence from
the issue. Duplicate, invalid or oversized ID lists are rejected before storage.

Reconciliation reloads the original occurrence and verifies `H({native,context})`.
Only inflight/unknown can proceed. A known response ID selects exactly that object.
Without an ID, the persisted preflight is required, every old ID is excluded,
and exactly one current matching body/actor must remain. Zero/multiple matches,
unavailable pages, changed bindings and failed persistence stay unresolved.
Editing an old comment to match cannot qualify as newly created content.

```text
inflight/unknown + matching occurrence binding
                    |
            response ID recorded?
              /             \
            yes              no
             |                |
      GET exact ID     complete preflight IDs required
             |                |
             |         complete current listing
             |                |
             |         exclude every preflight ID
              \              /
           exact issue + body + actor + one match
                         |
                 persist confirmed
     known-ID current content OR new current content only
                    never resend
```

**Figure 5. Two observation strengths, one no-resend rule.** The trusted
successful-ACK-discard witness is separate from recovery evidence.

`confirmed` must be read with its qualifier. The ID-less branch explicitly reports
`new-current-content-since-preflight-not-execution-attribution`. A dedicated
single-writer issue limits ambiguity; a same-account concurrent writer defeats
causal attribution. The observer reports its checks, not universal exactly-once
or comprehensive-effects assurance.

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

### 5.4 Real Maintainer Use as a Separate Study

The [field-use design](../docs/design/2026-10-19-field-use-and-full-manuscript.md)
extends the research question beyond scripted comments. It specifies ordinary
model-driven maintenance, native integration conformance, and induced faults as
separate populations. Its purpose is to discover whether the interface supports
useful work, not to rename the old 32 scripted checks as realistic autonomous use.
Two executions used the same six real read-only maintainer goals, reported
separately in Sections 8.9 and 8.10. The second is a post-review repeat under an
amended output contract, not six new independent intents. The larger design
also specifies new write and delivery-fault experiments; neither field run
executed those populations. Section 8.12 reports their separately frozen
owned-write continuation.

Ordinary tasks inspect real public release material and produce maintainer
reports about source/release binding, installation, contract migration, native
compatibility, recovery limitations and documentation. Task goals, bounded tools,
source snapshots, budgets, completion criteria and failure rules are fixed before
scored runs. The model chooses reads and report text. Supplying canned answers,
putting reference answers into tool data, or revising expectations after reading
the output would invalidate the intended distinction.

Read-only tools are constrained to explicit repository/ref/path bounds, not an
arbitrary shell or URL fetcher. This is a study capability boundary outside the
comment-mutation profile, not evidence that the profile covers reads. Repository
content and tool descriptions remain untrusted data. A proposed write receives
both protocol and complete-baseline preparation on identical captured arguments;
one authorized execution can be selected to avoid duplicate public comments.
Two shadow decisions are not two provider trials or paired end-to-end model runs.

Provider mutation is a separate authorization boundary, not a prerequisite for
report-writing tasks. Without a separately confirmed fresh owned resource, the
study can complete read-only maintainer reports and shadow qualification of
captured proposals. That mode cannot establish official-server comment delivery,
mutation recovery, or end-to-end behavior of a newly integrated write path.

Native integration must distinguish a benchmark-authored MCP server using the
official SDK from GitHub's official MCP implementation. The latter requires its
own executable/source identity, advertised schema and strict result decoding.
If remote authentication fails, that remains a setup result. A pinned official
local executable may be an alternative, but cannot establish success of the
remote endpoint. Neither version strings nor binary hashes prove complete effects.

The fault population separately schedules process exits, disconnected transport,
policy narrowing/revocation, duplicate occurrences and ambiguous ACKs. After
delivery may have started, continuation is read-only. Unfinished model tasks,
stale locks, unknowns, setup failures and operator intervention remain visible.
Writes stop on unexpected targets, source drift, missing journals, exhausted
budgets or unexplained outcomes. Model safety stops are retained, not bypassed
by switching interfaces. These requirements define the write/fault boundary;
the read-only runs do not measure it. The separately reported continuation
must be assessed on its own counts and observations.

### 5.5 Official-Server Compatibility Boundary

The field integration selects [GitHub MCP server v2.0.2][official-mcp-release],
source commit `eb47a99ddb866ca2b8a162920e6bda9521f33ebb`. Its selected Darwin ARM64
release archive has SHA-256
`5d9b38511bffc84d2272eb6189129eb721c8900e45784d8ea7eaf25f8d3dd835`.
The successful installation record verifies that archive and a distinct
executable SHA-256, `2d431e46617f06b1516818fa09917096ff6dfc3664b37b0bdb31e1c1a35be368`.
These pins identify the selected local artifact, not every acquisition attempt
or every deployed server instance; they do not establish a reproducible build
from the pinned source. They are distinct from the old handwritten server and
from the MCP SDK's package identity.

The official [typed-tool schema documentation][official-mcp-typed] [S15] distinguishes
legacy output from the modern `2026-07-28` typed-output path. SDK 1.32.1 negotiates
no later than `2025-11-25`; integration must record the negotiated revision rather
than assume the newest advertised schema. The legacy comment result contains
JSON text with `id` and `url`; the modern typed result uses `id` and `html_url`
and represents the identifier as a string. A bridge into the original gate's
safe-integer ID contract needs explicit syntax/range validation rather than
blind numeric coercion or accepting either shape without a version rule.

The official [issue-tool handler][official-mcp-handler] [S16] also supports reaction
behavior. The closed comment profile does not. Reaction variants or additional
mutation arguments must be rejected, not dropped to manufacture a conforming
comment proposal. One handler-level `CreateComment` application call does not
prove one HTTP wire attempt: Go transport/redirect behavior remains a distinct
layer. Hosted MCP behavior is not established by reviewing the local handler.
The official [server configuration][official-mcp-config] [S14] is part of that
integration contract, not proof of its runtime outcome.

| Integration dimension | Old measured v0.2 lane | New field configuration |
| --- | --- | --- |
| Server implementation | Benchmark-authored server | Pinned official GitHub server |
| Client/library | MCP SDK 1.32.1 | Same SDK capability ceiling must be respected |
| Returned value | Benchmark instrumentation envelope | Versioned upstream result, strictly decoded |
| Mutation scope | Exact comment operation | Comment-only adapter must reject reaction variants |
| Delivery claim | Controlled no-resend gate and readback | Application call count is not exact wire-attempt count |
| Task unit | Scripted cases/slots | Same six read-only goals in two runs; three SDK, three MCP each |

The existing Azure deployment returns model ID `gpt-6-astra`; its configuration
declares version `2026-09-03` and region Sweden Central, using Responses v1.
These identifiers are not an immutable model-weight identity. Section 8.8
reports a successful connectivity response, not a scored maintainer task. Read tools remain
operator-allowlisted capabilities outside comment-profile semantics. Six task
goals are not six incidents, and different SDK/MCP task goals cannot be treated
as paired end-to-end latency trials.

Microsoft documents the resource-specific `/openai/v1/responses` endpoint [S17].
In the implemented and recorded field loop, a model `function_call` requests an
application operation, and a corresponding
`function_call_output` carries its result under the same `call_id`. The harness
validates names and arguments against the fixed read-tool interface before
calling GitHub. It uses `store: false`, low reasoning effort, non-streaming
foreground requests, and no parallel tool calls. The 6000-token output ceiling,
180-second request timeout, 12-round limit, and 18-tool-call limit are distinct
from a report's UTF-8 byte budget. These loop settings and deployment observations
come from the retained implementation and run, not a general availability catalog.

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

### 6.5 Measurement-to-Claim Map

Every reported claim should identify its population, reference and observation
boundary. In particular, exact mapping includes expected nonacceptance, whereas
authorization accuracy only applies where a decision reference exists. A native
lane is not an independent intent, a method is not a case, and a provider object
is not a complete task outcome.

**Table 7. What the retained measurements can and cannot answer.**

| Claim or endpoint | Unit/reference | Evidence | Excluded inference |
| --- | --- | --- | --- |
| Finite native mapping parity | 108 lane instances per strategy; literal expectations | Status/reason/projection comparison | Arbitrary tool inference or population accuracy |
| Eligible decision agreement | 52 accepted instances per strategy | Same real OPA and frozen decisions | Correctness of mapper solely from decision agreement |
| Pure authorization | 26 reference projections | No candidate mapper input | External oracle independence |
| Diagnostic masking | 26 deliberately corrupted projections | 0 exact mappings, 26 unchanged decisions | Natural attack rate or competitor weakness |
| Planned live behavior | 32 scripted slots | Exact reason/outcome and fault witness | 32 useful tasks or 32 created comments |
| Direct created content | 12 unique comment IDs | Bound fresh readbacks | Complete provider history or all descendants |
| No recovery resend | Four injected ACK losses | Recovery records plus send/receipt accounting | Distributed exactly-once under arbitrary crashes |
| Accepted cold cost | 52 observations per strategy | Retained monotonic row times | Useful-task speedup or isolated engine overhead |
| Ordinary live cost | Four observations per strategy | Sequential process/HTTP timings | Ranking, throughput or SLA |
| First-run report formation | Six real-model tasks | Six mechanical passes; zero original delivery-compliant responses | Six correct or useful reports |
| Amended repeat | Same six goals, fresh contexts | Two completed loops; four retained byte-budget failures | Causal improvement or twelve independent intents |
| Retained-content review | Thirty fixed facts per run, same-project reviewer | First: 27 met/2 partial/1 incorrect; repeat: 28/2/0 | Independent ground truth or human acceptance |
| Publication fit | Each run's six outputs, two forms, two strategies | 24 related rows per run; equal categories across strategies | Policy approval, task success or public delivery |
| Owned native delivery | Two eligible outputs from the amended six-task cohort | One SDK and one official-MCP publication, exact body readback | Six successful tasks or independent human usefulness |
| Owned fault behavior | Six deliberate conditions, four recovery processes | Two denials, three recovered deliveries, one retained unknown | Natural outage rate or multi-host atomicity |
| Duplicate suppression | Eight fresh-process probes of existing occurrences | No further native comment calls | Exactly-once across lost ledgers or different occurrences |
| Task usefulness | Original legitimate goals and source-based completion checks | Same-project rubric; human use/disposition remains unknown | An authorized comment is automatically correct |
| Reproducibility | Reports, source inventory and journal | Local semantic replay/current GETs | Operator authentication or replayed historical time |

```text
55 authored cases / 22 intent groups
             |
       108 native lane instances --------> 2 strategies = 216 rows
             |
      52 accepted per strategy ----------> 52 eligible decisions each

26 reference projections --> pure authority
26 corrupted projections --> masking diagnostic (not another baseline)

8 live scenarios x 2 lanes x 2 strategies = 32 checks --> 12 new comments

6 read-only goals x 2 runs --> 6 retained outputs per run
                         --> 24 packaging preparations per run
second-run cohort: 2 eligible / 4 task-layer withheld
2 ordinary deliveries + 6 fault scenarios --> 8 initial proposals
8 initial + 4 read-only recovery + 8 duplicate probes --> 20 workers
5 native comment calls --> 5 objects (2 reports + 3 fault controls)
paired initial preparations: 8 per strategy, not 16 live trials
```

**Figure 6. Denominator map.** Each arrow changes the unit; it does not create
independent samples or permit pooling task utility with conformance.

For task runs, let `T` be all scheduled legitimate tasks, `U` completed
and correctly evaluated useful tasks, and `V` those with adequate evidence of
permitted effects in the declared observation universe. Report `|U|/|T|` and
`|U intersect V|/|T|` separately. If `k` completed tasks lack sufficient effect
observation, their joint outcome is unresolved, not verified. The interval from
known verified tasks to those tasks plus `k`, divided by `|T|`, is a missingness
sensitivity range, not a confidence interval or additional observed success.

Cost accounting likewise separates model requests, tool attempts, supported
write proposals, actual POSTs, provider GETs and human intervention. Provider
reported token usage is not invoice cost; elapsed task time is not sum of
overlapping spans. A failed setup before tasks begin belongs to setup, but cannot
be suppressed from the engineering account because it is outside task accuracy.

## 7. Scope and Validity

**Semantic coverage.** The mutation profile covers one direct GitHub comment.
Notifications, recipients, webhooks, and other descendants remain unknown; all
accepted mappings are partial. The original live inputs were synthetic public
data. Real-model maintenance adds bounded reading and report generation, not
profile-governed semantics for arbitrary reads. The publication-fit analysis
does not dispatch; the distinct owned-write continuation in Section 8.12 does
observe official-server mutations and uses the same finite direct-comment
profile. Its deliberately injected faults are not naturally observed outages.

**Trust and concurrency.** The host, configured principal/class, provider adapter,
policy files, and same-host ledger are trusted. Bridge identity is declared,
not SaaS attestation. The conditional invariants are code-level arguments rather
than machine-checked whole-system proofs. Local policy reload is not atomic with
remote commit. ID-less recovery depends on complete preflight, unique matching
new content, and a dedicated single writer; another same-account writer defeats
execution attribution. Hashes and replay establish specified consistency, not
operator honesty, historical fsync, or distributed exactly-once delivery.

**Sampling and independence.** Shared policy, contracts, project control, and
AI-assisted authoring/review permit correlated mistakes. Separately written
consumers and separately authored references are valuable checks but not
independent institutions. External independently authored evaluations number
zero. The six maintenance goals concern the project's own exposed public
sources. Post-review repetitions of those goals remain exposed follow-up work,
not protected holdouts. A rubric label requesting human review does not itself
establish that such review occurred; actual reviewer provenance is reported.

**Inference and deployment.** Cold, small, sequential timings support the stated
samples rather than throughput, tail-SLA, staffing, or monetary claims. The
different SDK/MCP task goals are not paired lane-speed observations. Loop
completion, citation availability, report quality, decision readiness, actual
maintainer use, and public delivery are distinct outcomes. The related-work
comparison covers concrete interface obligations, not a comprehensive novelty
survey of effect systems or authorization theory. Customer qualification and
long-duration operational benefit require additional evidence.

## 8. Results

### 8.1 Sources and Denominators

The earlier refund profile remains separate: its
[102-case rerun](../reports/offline-consumers-2026-10-19T03-59-16-707Z.json)
matched both consumers without adapter faults. Opt-in `offline-consumer-v1.1`
clarifies startup and compound-error precedence without rewriting frozen v1.
At the measured v0.2 source,
[Linux/macOS CI](https://github.com/OndCo/Action-Effect-Bench/actions/runs/39199258635)
passed 64 Spec JavaScript, 11 legacy Bench JavaScript, 115 Spec Python, 333
runtime JavaScript, and 50 runtime Python methods: 573 methods, not workloads.
Eight gate regressions concerning stale content, ID binding, mutable
configuration, and policy freshness were corrected before that source; they
are retained development history rather than an additional independent cohort.

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

### 8.6 Case Analyses: What the Aggregate Hides

The Unicode cases test byte semantics rather than natural-language correctness.
`unicode-nfc` and `unicode-nfd` retain distinct precomposed/decomposed byte strings;
the mapper does not silently normalize them. In the policy-bound examples, the
four-character spelling of cafe with a precomposed accented final letter occupies
five UTF-8 bytes: a five-byte limit allows it and a four-byte limit denies it.
At the native cap, 8192 bytes are accepted while 8193 are invalid before policy.
These are different boundaries, so a native-domain error cannot be scored as
correct detection of a current-policy excess.

The tuple cases separate `grant-cross-repository-issue`,
`grant-cross-data-class`, and `grant-exact-among-decoys`. The first two deny
despite independently matching component values; the third allows when one
complete matching grant exists among unrelated rows. A deny-everything adapter
would pass the first two but fail the positive control. Case-sensitive owner/
repository variants are deliberately mapped literally and denied against the
differently cased grant, rather than guessing provider alias equivalence.

The precedence cases combine revocation, absent grants or excessive bytes with
unaccepted partial scope. Applicable denials win over review. This does not mean
every uncertainty is converted to denial: `partial-not-accepted` receives review
when no earlier denial applies. Missing context and wrong implementation instead
produce untrusted evidence before policy. These controls test refusal ownership,
not merely whether a POST happened.

The original scorer failure illustrates a measurement-layer defect: JSON values
with ordinary and null prototypes were compared as language objects, producing
52 apparent masked errors per strategy. Correcting value comparison exposed a
different defect, eight structured numeric/Unicode error classifications. Those
eight were genuine interoperability mismatches even though they did not authorize
unsafe work. Labels and all 216 input/context/policy records stayed unchanged.
The useful lesson is to specify comparison and precedence, not to erase the first
attempt or claim 52 dangerous failures were repaired.

The live duplicate scenario reuses the earlier ASCII occurrence. Its suppression
is therefore an occurrence check, not a second policy denial and not another
created object. The lost-ACK scenario first completes an actual provider POST,
then deliberately discards the successful response. Recovery is supported by
both a controlled injection witness and a weaker current-content observation.
Conflating the two would incorrectly generalize the experiment to arbitrary
unwitnessed timeouts.

### 8.7 Cost Decomposition and Identifiable Contrasts

Let `T_P` and `T_S` denote measured protocol and structured row times. Their
accepted-input contrast includes process launch, Python parsing/projection,
description construction/checking where applicable, and OPA startup/evaluation.
The difference of medians is not the median of per-row differences, and does
not isolate an abstract serialization constant. Both paths use cold processes;
the data do not identify warm-service throughput or cache break-even points.

```text
accepted protocol: JS map + wire --> Python check --> real OPA
accepted baseline:              --> Python project -> real OPA
                           medians 50.391 / 48.468 ms

rejected protocol: JS prefilter stops (no Python on these rejections)
rejected baseline: Python launch + native rejection
                 mixed medians 0.042 / 44.507 ms are not useful-task speedup

normal live: preparation + reserve + identity + list + policy + POST + GET
MCP lane adds cold initialize/list/call transport; n=4 per strategy
```

**Figure 7. Timing boundaries.** Inclusion, not stacked arithmetic: mapping and
consumer timers overlap. The 1-second pacing waits are outside row timers but
inside the 99.049-second entire live run.

The study contains no maintainer-hour measurement, price schedule, sustained
offered-load sweep, random-order experiment or demonstrated amortization across
consumers. Any proposed economic advantage therefore remains a hypothesis. A
plausible portability benefit must pay for schema/registry maintenance and
failure triage as well as per-call computation. The observed 3.97% higher accepted
median cost is the bounded result, not a hidden speed advantage.

### 8.8 Field Setup and Native Compatibility Observations

Setup has its own population, `setup-not-task`; neither failure nor successful
connectivity is silently reassigned to the six prospective maintainer tasks.
Every setup/preflight report below records zero provider-write attempts.
Reported times are individual setup observations, not throughput measurements
or estimates of task-level model latency.

| Setup observation | Reported elapsed time | Outcome and evidential boundary |
| --- | --- | --- |
| Initial official-server archive acquisition | 91 s | curl HTTP/2 framing-layer failure, exit 16; no executable acquired in this attempt |
| Official executable initialization with hostname-only flag | 235.459 ms | Failed before tool dispatch; real parser requires an HTTP(S) scheme |
| Corrected official-server read-only preflight | 924.395 ms | Negotiated `2025-11-25` and read pinned `spec-lock.json`; no mutation |
| Existing Azure deployment connectivity | 4813.349 ms | Received `READY`; setup span includes credential retrieval, not a scored task |

The [first acquisition report](../reports/field-study-setup-2026-10-19T06-06-29.292Z-83109149.json)
retains the 91-second failure. A [later HTTP/1.1 installation record](../reports/field-study-setup-2026-10-19T06-10-02.910Z-8154f464.json)
verifies the archive and executable hashes in Section 5.5. Successful retry
does not erase acquisition cost or establish any task outcome.

The [initial MCP preflight](../reports/field-study-preflight-2026-10-19T06-14-44.920Z-85a0901c.json)
records `mcp_initialization_failed` and `not_dispatched`. Its
[diagnosis record](../reports/field-study-setup-2026-10-19T06-15-33.486Z-132f0b63.json)
preserves the real executable's error: `--gh-host=github.com` lacks a scheme.
The hostname-only configuration had passed fixture tests. Correcting it to
`--gh-host=https://github.com` and adding a regression illustrates an integration
gap that mock compatibility alone did not detect; it is not a protocol-mapping
failure or a false authorization decision.

The [corrected read-only preflight](../reports/field-study-preflight-2026-10-19T06-17-11.024Z-4a25c7d7.json)
records official server 2.0.2, negotiated protocol `2025-11-25`, and an allowlisted
inventory of `get_file_contents`, `get_release_by_tag`, and `issue_read`.
The actual invocation was `get_file_contents` for `spec-lock.json` at the pinned
Bench commit `cecde389637be4f5fd3482e4942ce3fd1a623ac6`; its resource content
contains the Spec pin `a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`.
An advertised read tool is not automatically a tested one, and this result does
not exercise the official comment handler or its response decoder.

The [model preflight](../reports/field-study-preflight-2026-10-19T06-15-46.567Z-58ee8190.json)
records a completed response containing `READY`, with 21 input and five output
tokens. Its 4813.349-ms setup span includes credential retrieval. It establishes
connectivity to the configured deployment, not autonomous task usefulness,
customer readiness, or a model-latency benchmark. The original 12-comment live
population remains separate and still used the benchmark-authored MCP server.

### 8.9 First Real-Model Read-Only Run

The [first use report](../reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json)
records six scheduled tasks against actual public GitHub sources using the
existing Azure `gpt-6-astra` deployment. Field runtime source was
`bc1d389a474c37a9c38b2b5acedbd7bb65650225`; the original 49-entry runtime-pilot
inventory was preserved, alongside 18 field-source entries. The
[freeze](../reports/field-study-freeze-2026-10-19T06-28-30.451Z-e3d388eb.json)
preceded scored requests and records task SHA-256
`990dbd74a66611cd2103cc537807ef7978343962fdcaae3d056559b783d4c0e9`
and criteria SHA-256
`a845424d29788315b49c7540d4b134a87df75838608f0b3c0910267ff51df130`.
Evidence was retained at commit `eff7bf6bee237162a7f321bbb131008f880346fb`.
Each task started with a fresh model context, the assigned lane, and pinned
source bounds; the model received neither the fact rubric nor another task's
output. Frozen sources were Bench `cecde389` and Spec `a9b86f4`, distinct from
the execution-source and evidence commits.

| Task | Read lane | Model requests | Reads | Task wall, ms | Input tokens | Output tokens | Body bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T1 Release integrity | SDK | 7 | 6 | 79893.440 | 24207 | 2132 | 5872 |
| T2 Clean-clone quickstart | Official MCP | 6 | 5 | 50447.211 | 25493 | 2201 | 7270 |
| T3 Consumer v1.1 migration | SDK | 4 | 3 | 44750.881 | 17145 | 2128 | 7981 |
| T4 Official-MCP compatibility | Official MCP | 6 | 5 | 49512.368 | 22108 | 2073 | 7284 |
| T5 Limits and recovery | SDK | 6 | 5 | 50971.146 | 33098 | 2050 | 6836 |
| T6 Conformance support | Official MCP | 6 | 5 | 51169.527 | 33292 | 1956 | 7159 |

All six loops produced a schema-valid JSON report, and every declared citation
URL resolved to a source URL returned by a successful task read. This is the
implemented citation check: it does not verify that a cited line supports each
assertion. There were 35 model requests, 29 read-tool calls, 155343 reported
input tokens, and 12540 output tokens, totaling 167883. The task spans sum to
326744.573 ms; the enclosing run span is 327262.889 ms. Recorded model-request,
tool-handling, and other task spans sum to 285544.690, 40481.360, and 718.523 ms
respectively. Earlier acquisition and preflight costs remain separate. Request
tokens include repeated context, and these observations do not compare lane
speed because task content and read sequences differ.

The outputs are concrete maintenance artifacts. T1 independently fetched the
selected offline report's 900348 bytes and matched its digest against the
adjacent checksum; its optional release inspection retrieved metadata rather
than downloading the PDF. T2 produced an ordered installation/readiness runbook.
T3 produced an opt-in migration/rollback note. T4 separated the published custom
MCP server from official-server integration. T5 produced condition-to-action
recovery guidance, and T6 produced a conformance claim/evidence crosswalk.
These descriptions identify the work products, not six completed semantic
quality or actual-use judgments.

**Retained response-contract deviation.** The frozen tasks/rubric requested
plain Markdown final text within 6000 UTF-8 bytes. The harness appended a JSON-envelope instruction
and an aim below 7000 bytes, while its initial mechanical scorer tested body fit
against the comment profile's 8192-byte limit. All six bodies fit that last
limit, but only T1's extracted Markdown fits 6000 bytes. All six complete final
texts are JSON rather than plain Markdown and exceed 6000 bytes: original
delivery compliance is therefore 0/6, not 1/6. Five extracted bodies require
length rework in addition to the shared format conflict. The conflicting
instruction and generous scorer are harness defects, not five independently
attributable model failures. Schema validity and citation
presence therefore cannot supply the missing quality credit. The original
inputs, outputs, criteria, and source remain retained rather than relabeled.
The [retained review](../analysis/review-first-field-use.json) attributes semantic
judgments to same-project AI-assisted rubric review, not independent human or
external evaluation. Deterministic checks of quotations, frozen facts, and byte
counts make the assessment auditable without making its semantic labels independent.

| Task | Frozen facts | Met | Partial | Incorrect | Final text bytes | Derived body grade |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| T1 | 4 | 4 | 0 | 0 | 7119 | Complete |
| T2 | 5 | 5 | 0 | 0 | 8319 | Partial |
| T3 | 5 | 5 | 0 | 0 | 8823 | Partial |
| T4 | 4 | 3 | 0 | 1 | 8345 | Incorrect |
| T5 | 6 | 5 | 1 | 0 | 7866 | Partial |
| T6 | 6 | 5 | 1 | 0 | 8071 | Partial |
| Total | 30 | 27 | 2 | 1 | All six exceed 6000 | 1 complete, 4 partial, 1 incorrect |

The derived grade is incorrect if any required fact is incorrect; otherwise it
is partial if any fact is unmet or the extracted Markdown exceeds 6000 bytes,
and complete otherwise. Thus T1 is substantively/body-byte complete, not
compliant with the original whole-response delivery contract. This derived
assessment does not replace the frozen criteria or the observed format failure.

The internal review marked T4's statement that "no server, authentication, tests
or provider operation was exercised in this task" as a material scope error:
the task actually obtained source files through the official MCP server. The
model-visible results omitted server startup metadata, so this finding is
confounded by an incomplete harness description of the current channel. It is
not an isolated measurement of model reliability. T5 incompletely identified the
critical extension carrying the body-hash binding. T6 omitted the complete
baseline's shared projection/controls and absence of description exchange.
These are fact-level judgments, not 30 independent tasks. Five reports need
length rework, and T4 additionally has the material error. Actual human utility,
review effort, and maintainer use are unmeasured for all six.

The original replay passed its implemented consistency checks, but review found
that it did not independently reconstruct complete event/source coverage. A
strengthened post-review replay of the unchanged first-run report then returned
`valid: true`: 242 journal records, 28 native-bound file observations including
27 retained texts, and one release-metadata observation accounted for 29 reads.
The file observations cover 20 distinct file URLs. Replay made zero model or
provider requests, and the task run made zero provider-write attempts.

The explicit `coverage_gaps` entry
`release_native_envelope_not_retained` remains: the normalized release observation
does not retain its native raw envelope. No release asset was downloaded in
this run. The version-2 reader retains this limitation, so native file binding
and a passing reconstruction are not full native release or asset verification.

### 8.10 Post-Review Read-Only Repeat

The [second use report](../reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json)
records a repeat at execution source
[`dff6ba7`](https://github.com/OndCo/Action-Effect-Bench/commit/dff6ba72e36842334fcc61d8d2c5f3545084898e),
with evidence retained at
[`7306d8b`](https://github.com/OndCo/Action-Effect-Bench/commit/7306d8b45402bb2ee7f9a1fbaf7203835e599110).
The pre-request freeze is
`field-study-freeze-2026-10-19T07-10-06.472Z-419977b3.json`. It binds amendment 2,
the same six goals, fixed facts, source documents and lanes, and fresh model
contexts. Its task and criteria hashes are respectively
`2c7fdb9d451c5c6474f7a0688d92e22d3bc3b8b32d444ec03f96d768a777a0d5`
and `ff7a7e6472414a916e39e377f3ed5e3181d9fa554d69ff0de848bc39c7a641ac`.
Twenty field-source entries accompany the unchanged 49-entry v0.2 inventory.

The amendment makes the JSON envelope explicit and applies a 6000-byte UTF-8
limit to its `report_markdown` field, with a recommended 5000-byte target. It
also supplies bounded startup/channel metadata rather than prior answers or
rubric labels. The scope of this amended limit differs from the original
whole-final-text Markdown contract. Oversized candidates are retained as failed
evidence, not truncated, automatically rewritten, or resubmitted to the model.

| Task | Lane | Body bytes | Loop outcome | Wall, ms | Input tokens | Output tokens | Derived grade |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- |
| T1 Release integrity | SDK | 5168 | Completed | 82818.211 | 25586 | 1973 | Complete |
| T2 Clean-clone guide | MCP | 6272 | Failed | 51893.392 | 27035 | 2007 | Partial |
| T3 v1.1 migration | SDK | 7051 | Failed | 43425.587 | 17949 | 1909 | Partial |
| T4 MCP compatibility | MCP | 5997 | Completed | 52504.850 | 23387 | 1868 | Complete |
| T5 Limits/recovery | SDK | 6267 | Failed | 49715.020 | 34286 | 1888 | Partial |
| T6 Conformance | MCP | 6454 | Failed | 51437.203 | 33700 | 1780 | Partial |

All four failures have reason `report_bytes_exceeded`. All six full JSON
candidates are retained, including failed ones. The scorer counts schema/citation
checks only for completed loops, so its two qualifying reports are not a claim
that the other four lacked JSON text or source observations. Task-level
model-request/read counts equal those of the first run: 35 requests and 29 reads
in total. Usage is 161943 input plus 11425 output tokens, totaling 173368.
Task spans sum to 331794.263 ms; the enclosing run takes 332244.655 ms. No provider
write was attempted. These are operational observations, not semantic-quality
or human-utility grades.

The [separate second review](../analysis/review-second-field-use.json) assessed
all six retained candidates against the same 30 facts: 28 met, two partial,
none incorrect. Derived content/body-budget grades are two complete and four
partial; the four failed loops stay failed. T4 now states, "All five source
reads succeeded on the MCP lane," and separates observed official-server reads
from historical tests, mutations and remote authentication. That resolves its
earlier categorical scope error under changed channel-information conditions.
T5 still omits the required critical-extension mechanism for the body hash.
T6 now names shared OPA, ledger and dispatcher, but still omits the shared Python
projection and the baseline's absence of an effect-description envelope.

All 29 citation entries were observed, including those in failed candidates.
The raw scorer's false/null/no-result fields for those failures remain unchanged.
The [review audit](../reports/field-study-review-audit-2026-10-19T07-23-39.012Z-f5138821.json)
validates 30 literal report quotations, frozen-fact references, byte counts and
grade arithmetic. It does not independently validate the same-project
AI-assisted semantic interpretation. Human acceptance, actual maintainer use,
review effort and business utility remain unknown for every task.

The [retained strict replay](../reports/field-study-replay-2026-10-19T07-18-25.099Z-3c9423af.json)
returns `valid: true` over 246 journal records, 28 native-bound file observations,
27 retained texts and one release-metadata observation, accounting for 29 reads
with zero model/provider replay requests. The release-native-envelope coverage
gap remains; there are no native release-envelope or asset-byte observations.
Replay reconstructs the two completed/four failed outcome split rather than
upgrading failed tasks to successes.

Review of the measured runner found a separate journal-failure gap: after
`runAgent` returns `journal_error`, `run.mjs` can append `scheduled_task_end` and
later seal a report as `recorded`. No such fault was observed in this run, but
passing replay does not qualify that failure path. The post-measurement repair
[`c72369a`](https://github.com/OndCo/Action-Effect-Bench/commit/c72369af0f3e3f3c7010d7e8bab3cb95ba3c0b79)
adds a runner-wide failure latch around journal operations and propagates agent
journal errors before further task-end recording or sealing. Thirty-seven
targeted regression tests passed after repair; 35 had failed against the old
runner. This is injected software-failure qualification, not a cloud rerun,
power-loss test, or retroactive property of measured `dff6ba7`.

The v0.3 local verification passed 1093 methods: 408 prior JavaScript, 115 Spec
Python, 50 runtime Python, 510 field and 10 analysis. These are software-test
methods, not workload cases or extra evidence of human utility. Both normal
strict replays remained valid at 242 and 246 journal records. No third model
run is included.

These are six repeated goals, not twelve independent intents. The output
contract, enforcement, channel information and replay changed together, and
generation remained stochastic. Neither the completion-count difference nor
the token/time difference isolates a causal amendment effect. The original
six mechanical passes and the amended two completions also apply different
acceptance rules; they are not directly comparable utility rates.

### 8.11 Exploratory Publication Fit of Captured Reports

The [publication-fit report](../reports/field-study-publication-fit-2026-10-19T06-40-15.561Z-bdcae674.json)
examines the first run's six captured outputs, not new model tasks. The
[second fit report](../reports/field-study-publication-fit-2026-10-19T07-18-12.145Z-b1330df7.json)
applies the same analysis to the second run, including its four failed candidates.
For each output,
`analysis/publication-fit.mjs` constructs a standalone body containing the
report, conclusion, and all citation URLs, and a linked handoff retaining the
conclusion plus an immutable evidence link and report-object digest. Both forms
are prepared by both strategies in the task's assigned lane: 24 related rows
per run, not additional independently sampled goals.
The destination issue `2147483647` and principal `packaging-fixture` are synthetic
placeholders. No OPA evaluation, ledger reservation, model call, provider
request, or public comment occurs in this analysis.

| Run | Task | Standalone bytes | Standalone result, both strategies | Linked bytes | Linked result, both strategies |
| --- | --- | ---: | --- | ---: | --- |
| 1 | T1 | 7086 | `accepted_partial` | 774 | `accepted_partial` |
| 1 | T2 | 8264 | `invalid_input/native_input` | 737 | `accepted_partial` |
| 1 | T3 | 8798 | `invalid_input/native_input` | 777 | `accepted_partial` |
| 1 | T4 | 8356 | `invalid_input/native_input` | 787 | `accepted_partial` |
| 1 | T5 | 7835 | `accepted_partial` | 708 | `accepted_partial` |
| 1 | T6 | 8050 | `accepted_partial` | 613 | `accepted_partial` |
| 2 | T1 | 6486 | `accepted_partial` | 878 | `accepted_partial` |
| 2 | T2 | 7318 | `accepted_partial` | 789 | `accepted_partial` |
| 2 | T3 | 7834 | `accepted_partial` | 743 | `accepted_partial` |
| 2 | T4 | 7210 | `accepted_partial` | 928 | `accepted_partial` |
| 2 | T5 | 7370 | `accepted_partial` | 812 | `accepted_partial` |
| 2 | T6 | 7528 | `accepted_partial` | 796 | `accepted_partial` |

The byte limits have different owners. The frozen 6000-byte task budget applies
to report construction; the 8192-byte native limit applies to the final comment
body after packaging. Three first-run standalone bodies exceed the latter, although each
unpackaged report body fits it. Both preparations reject those three and accept
the other three. All six first-run linked handoffs, 613--787 bytes, are accepted as partial
descriptions with `authority: not_evaluated`.

In the repeat, all standalone bodies (6486--7834 bytes) and linked handoffs
(743--928 bytes) fit the profile: all 24 preparations are `accepted_partial`
with authority not evaluated. Yet four underlying task bodies exceeded 6000
bytes and remain failed. There is no contradiction: task-budget compliance,
native-body fit, semantic quality and permission are different predicates.
No OPA, ledger, provider or model operation occurs in either fit analysis.

The linked representation preserves the full source artifact rather than
truncating it. Its URL selects evidence commit `eff7bf6` for run one or `7306d8b`
for run two, each verified locally to contain the corresponding report bytes.
The embedded per-task digest hashes
UTF-8 bytes of `JSON.stringify` applied to the parsed per-task report; it is distinct from the whole-run
report checksum and from the comment body's SHA-256. This is a packaging
identity, not a new core canonicalization rule. Mapping acceptance covers the
new handoff body, not truth or availability of the referenced report. The result
is a concrete composition constraint and equal preparation behavior, not
improved report quality, policy approval, or a competing-system win.

```text
extracted first-run report body: 5872--7981 bytes
6/6 bodies fit 8192; 1/6 bodies fit 6000
                         |
            final rendering and exact bytes
               /                       \
standalone report + sources        immutable linked handoff
7086--8798 bytes                   613--787 bytes
               \                       /
          protocol and complete structured preparation
          standalone: 3 accepted / 3 invalid, both strategies
          linked:     6 accepted / 0 invalid, both strategies
                         |
          authority remains not_evaluated
                         : separate, unexecuted boundary
          current authorization --> dispatch --> observation
```

**Figure 8. First-run rendering before mapping; authorize separately.** The bytes of the
final native body, not the earlier model field or its token budget, determine
profile fit. The dotted boundary is unexecuted in this preparation-only analysis.

### 8.12 Owned Delivery, Real Process Failure, and Recovery

The [owned-write report](../reports/owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json)
continues the amended cohort without generating new model answers. It freezes
execution source `f93b1cfcbf2c2665b4acc7c5dc8fb92d1ba8d6b6`, the same Spec
revision, 78 source-file entries, and the exact committed task and review
records. Both source checkouts were clean. A fixed plan admits T1 and T4 only;
the four task-budget failures remain withheld before authorization. This is
not a third six-task model trial or a repair of their failed outputs.

**Apparatus and observations.** The sole destination is a newly created owned
[issue #2](https://github.com/OndCo/Action-Effect-Bench/issues/2); older issue #1
is untouched. The plan permits at most twelve application-level comment calls
across all processes, but expects five actual objects. It renders the two
reports without rewriting their conclusions or source citations and adds
explicit same-project review/evidence references. Final bodies are 6917 and
7659 bytes: both within this profile's 8192-byte comment-body bound, not a claim
about GitHub's platform maximum. The six fault scenarios use
distinct, clearly labelled synthetic bodies, not additional useful model tasks.

Each initial execution, reconciliation and duplicate probe starts a new OS
process with its own journal; twenty distinct worker PIDs are retained. The
supervisor kills only process groups it created. Four initial scenarios select
SDK and four select official GitHub MCP v2.0.2 over stdio. Identity, preflight
and observation use the SDK for both lanes. Recovery/probe processes expose no
native mutation transport. Each native proposal is prepared through both the
protocol and complete structured path and compared with a literal seven-field
reference; only the selected path may dispatch. The eight initial proposals
match in both paths, with no mismatches. Repeated shadow checks in recovery and
probe phases are not independent cases or extra live trials.

**Owned delivery outcomes.** P = protocol preparation;
S = complete structured preparation. Every duplicate probe returns
`duplicate_suppressed`, with zero native comment calls.

| Scenario | Native lane / selected path | Initial outcome | Fresh-process recovery | New comments |
| --- | --- | --- | --- | ---: |
| Release-integrity report | SDK / P | Confirmed | Not needed | 1 |
| Official-MCP compatibility report | MCP / S | Confirmed | Not needed | 1 |
| Revoke after preflight | MCP / P | Withheld: revoked | Not needed | 0 |
| Narrow body limit after preflight | SDK / S | Withheld: body too large | Not needed | 0 |
| Kill after inflight persistence, before call | SDK / P | SIGKILL | Unknown: no unique readback | 0 |
| Kill after actual MCP reply, before receipt | MCP / P | SIGKILL | Confirmed current content | 1 |
| Discard actual SDK reply, expire timer | SDK / S | Unknown | Confirmed current content | 1 |
| Discard actual MCP reply, close stdio | MCP / P | Unknown | Confirmed current content | 1 |

The two authority changes occur after provider preflight and before the gate's
final policy load. The current deny prevents either mutation; it is not a
subsequent audit alert. In the first crash, durable inflight state exists but
the native writer was not called. The restarted gate finds no unique matching
comment and retains occurrence ownership and `unknown`. This conservative
answer is intentional: the recovery mechanism must not turn missing evidence
into permission to send, even when the experiment supervisor knows where it
stopped the earlier process.

In the post-reply crash, the official server's actual reply is journaled before
the supervisor sends SIGKILL, but the gate has not persisted a confirmed
receipt. The timeout scenario likewise observes a real successful SDK reply,
withholds it from the gate and waits for a real 500 ms timer. The disconnect
scenario captures a real mutation JSON-RPC response, discards it and closes the
actual stdio transport. These are controlled acknowledgment-delivery failures,
not claims that GitHub or an internet connection spontaneously failed. The
three subsequent processes perform only GET-based reconciliation and confirm
the matching current objects; no second POST is used to obtain success.

```text
Actual local/remote boundary                    Fresh process, same occurrence
reserve -> preflight -> current policy
                         | deny -----------------> no mutation
                         v
                    persist inflight
                         X kill before call ------> unknown; no resend
                         |
                    native GitHub call
                         |
              actual object + actual reply
                         X kill / lose ACK --------> read-only reconciliation
                         |                              |
                    persist receipt               unique current content
                                                        |
                                                     confirmed
All eight later duplicate probes retain the original occurrence: no new call.
```

**Figure 9. Real fault cuts and the information available after restart.** The
cuts were executed in the stated order, not simulated by fabricated success
responses. A recovery receipt establishes current content under the single-writer
assumption; it does not prove atomic remote revocation or provider-wide effects.

**Cost without a fabricated speed contest.** The complete supervisor run took
52436.648 ms, including fresh workers, paired shadow preparation, current-source
checks, real networking, fault synchronization and final observations. Earlier
issue creation and setup are excluded, separate costs. These costs are retained
rather than reporting only a local predicate's runtime.
The two ordinary gates took 3589.962 ms (SDK/P) and 4775.226 ms (MCP/S);
their full worker lifetimes were 4049.513 and 5346.507 ms. Current OPA costs were
20.581 and 20.339 ms, whereas the native dispatch spans were 1551.673 and
1827.885 ms and readbacks 876.455 and 599.670 ms. The nested consumer timing is
part of mapping time, not another cost to add twice. Source verification and
journal work immediately before a native call are included in dispatch spans.

**Measured costs.** Whole-process and gate costs, not a throughput benchmark.

| Phase class | n | Gate/reconciliation time, ms | Whole worker time, ms |
| --- | ---: | --- | --- |
| Ordinary SDK/P | 1 | 3589.962 | 4049.513 |
| Ordinary MCP/S | 1 | 4775.226 | 5346.507 |
| Pre-send unknown recovery | 1 | 1089.062 | 1507.631 |
| Confirming read-only recovery | 3 | 898.529--2008.267 | 1323.215--2437.639 |
| Duplicate probes, no send | 8 | 34.610--41.902 | 446.024--480.242 |

One live path per different scenario cannot identify a protocol-versus-baseline
causal cost difference. Shadow preparation always runs protocol then structured;
its raw samples remain available, but order and warm-up are confounders. The
earlier paired offline study's 3.97% overhead is still the relevant bounded
comparison, not a claim of live speedup. No p99, enterprise SLA, natural outage
rate or statistical zero-risk bound is inferred from this small planned run.

**Retained failure and correction.** The first attempt created issue #2 but
stopped before any occurrence reservation or comment-call permit. Its
[raw failure](../reports/owned-write-pre-reservation-failure.md) remains public.
The Python consumer's parsed projection had a null JavaScript prototype, while
the literal reference had a normal object prototype. Host-object deep equality
rejected identical JSON values before dispatch. A regression reproduced the
failure; comparison now uses the profile's canonical JSON digest and still
rejects a changed field. The continued run adopted the same unchanged, empty
issue only after fresh inspection, with the original failed record bound into
its new manifest. It did not retry an uncertain mutation or erase the failure.
Additional review hardened owned-child cleanup, actual MCP-close error handling,
and pre-call source/OPA identity checks. Those fixture-based regressions are
software qualification, not additional observed GitHub incidents.

**Audit boundary.** The
[offline replay](../reports/owned-write-replay-2026-10-19T13-50-51.561Z-2e5d127c.json)
reconstructs twenty worker journals plus the supervisor journal: 283 records,
five consumed call permits, five current objects, eight no-send probes, three
confirmed recoveries and one retained unknown. It checks the frozen plan,
historical source blobs, literal projections, current policy results, process
signals, ledger continuity, native replies and final content. Corrupt/missing
journals and altered outcome/permit records are rejected. Public GitHub readers
can independently fetch the five objects, but this still does not authenticate
every historical event supplied by the operator. A separate
[anonymous audit](../reports/owned-write-audit-2026-10-19T13-58-07.840Z-d8467612.json)
made six credential-free GETs at 13:58:03--13:58:07 UTC on 19 October: the issue
and all five exact comment IDs returned HTTP 200 and matched their committed
body hashes, identifiers, URLs and authors. Raw replies, hashes and observation
times are retained. This is a new current-state observation, not a new write
or proof of the earlier execution time.

The findings close the gap between read-only report generation and an observed
native effect for this profile. They do not establish high general model task
reliability: two of six candidates qualified, and independent human usefulness
is unknown. The dedicated issue, same-host durable ledger, single writer, trusted
adapter and deliberately bounded partial coverage remain important conditions.
Policy changes after the last local check but before remote commit, another
same-account writer, lost storage and unobserved notification descendants still
require separate treatment.

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

Action-Effect makes the relationship between native capture, coupled meaning,
evidence, current authority, and observation explicit and executable. The v0.2
results establish exact mapping/decision parity with the complete baseline,
controlled read-only recovery, and 3.97% higher accepted-input median cost.
Real-model maintenance adds an operational lesson: complete loops and source
citations can coexist with a broken output contract and material report errors.
The amended repeat retained four task-budget failures even though all its
native preparations fit; profile acceptance is not task completion.
Final rendering also changes profile fit; three fully cited reports exceeded
the body limit while immutable linked handoffs fit in both strategies.
The owned continuation then delivered the two eligible reports using real SDK
and official-MCP writes, denied current revoked/narrowed authority, and recovered
three delivered effects without resending while preserving one unknown. Eight
duplicate probes made no further calls. The resulting artifact is a
reconstructable interchange, measurement method,
and conditional recovery contract. Broader portability and useful deployment
remain empirical questions, with the same complete-baseline and retained-failure
standards applied to future work.

## Appendix A. Complete Profile Construction Example

This is an illustrative local construction, not another execution or a permission
to write to issue #1. The example principal is not an authenticated account.
Use the released manifest `P` and the following complete native/context inputs:

```json
{
  "native": {
    "lane": "sdk",
    "call": {
      "owner": "OndCo",
      "repo": "Action-Effect-Bench",
      "issue_number": 1,
      "body": "abc"
    }
  },
  "context": {
    "principal": "example-maintainer",
    "data_class": "synthetic-public",
    "implementation": "github-comment-bridge/1"
  }
}
```

Its exact projection is:

```json
{
  "operation": "create_issue_comment",
  "repository": "OndCo/Action-Effect-Bench",
  "issue_number": 1,
  "endpoint": "https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/1/comments",
  "body_sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  "body_bytes": 3,
  "data_class": "synthetic-public"
}
```

Let `B(name,x)` be `{reference: "urn:action-effect:github-comment:" + name,
digest: {algorithm: "sha-256", value: H(x)}}`, and `K(ns,v)` be
`{state: "known", namespace: ns, value: v}`. The following field map completely
specifies `D` without repeating each long immutable namespace URI. `P.field`
means the literal manifest value, not a network lookup.

| Description field | Exact construction |
| --- | --- |
| `spec_version`, `profile` | `P.core_spec`, `P.id` |
| `profile_digest` | `{algorithm: sha-256, value: H(P)}` |
| `record_id` | `urn:action-effect:github-comment:record:` concatenated with `H({native:N,context:C})` |
| `invocation`, `context` | `B(invocation,N)`, `B(context,C)` |
| `implementation` | `B(implementation,{id:P.implementation,kind:declaration})` |
| `mapping` | `{id:P.id + #mapping, revision:1, digest:{algorithm:sha-256,value:H(P)}}`; revision is a string |
| `coverage` | Direct, partial; single assumption `Declared direct GitHub comment only; provider descendants not bounded`; evidence refs `[declaration]` |
| `effects` | One `comment` effect, category `P.category`, operation `P.operation_uri`, modality `may`, refs `[declaration]` |
| Effect `resource` | `K(P.resource_namespace, OndCo/Action-Effect-Bench#1)` |
| Effect `destination` | `K(P.destination_namespace, projection.endpoint)` |
| Effect `data_class` | `K(P.data_namespace, synthetic-public)` |
| Effect `quantities` | One `{name:P.byte_quantity,value:3,unit:byte,scale:0}`, with value/scale as strings |
| `evidence` | One declaration, ID `declaration`, source `P.id`, artifact ref ending `:declaration`, digest of `{native:N,context:C,profile_digest:H(P)}`, scope `direct-request-declaration` |
| `unknowns` | One `{code:unobserved_descendants,scope:P.unknown_scope}` |
| `relations` | Empty array |
| `critical_extensions`, `extensions` | `[P.body_digest_extension]`; that exact key maps to the body digest |

All names and values shown symbolically in the field map are strings except
the explicitly structured objects/arrays. It is an exact construction recipe,
not abbreviated JSON presented as a wire vector. Arrays have the stated order
and there are no additional fields or observations.

Computed illustrative preimage digests (not run-result hashes):

| Preimage | SHA-256 |
| --- | --- |
| `P` | `c4c062d8181d3e0d2cd04a0667ec6711d159bd61db5eeeae95217918e80350b3` |
| `C` | `818d64bb2144b707c0549baabfcbde04bad3f5d3ced3acc2ac69a018c0bf8dc2` |
| SDK `N` | `e3810e3f794cb56e1ff7e7bbb7f37331ef693d88001f685ba5d86b7c4b09d36b` |
| Equivalent MCP capture | `aac012db8f99856868110153e6b5b86ee68f130a987ca44e1622c3345b276d71` |
| Implementation declaration | `73f14cd57f597e916d5ff8c9f513029a488a528a73b7e520d641edeb778d607f` |
| SDK native/context pair | `eed927eb65697081acdcc0c9b1bfca8e0bdab0696f312142298ac306221ab839` |
| SDK declaration artifact | `533a57eddceabfb41a049017af722f16aa2ff66a1e8b27a9d5cb7b346692df2f` |

## Appendix B. Core Obligation Index

The normative source is the pinned `SPEC.md`, not this summary. The index maps
each CORE ID to its implementation/measurement boundary. A row is not a claim
of full core conformance or a substitute for applicable design vectors.

| CORE | Obligation | Boundary in this implementation |
| --- | --- | --- |
| 001 | Separate acceptance, evidence, permission and completion | Distinct processing/authorization/outcome fields |
| 002 | Record material trust basis | Configured declaration and provider identity; no general attestation |
| 003 | Preserve coupled tuples | Exact projection and one-row grant matching |
| 004 | Unique IDs and resolvable local references | Core reference checks; no first/last-match repair |
| 005 | Versioned category semantics; no harmlessness inference | Installed finite profile, not automatic taxonomy resolution |
| 006 | Declare modality, scope and coverage | One `may`, direct/partial declaration |
| 007 | Check premises for bounded claims | No complete bound is established by this pilot |
| 008 | Preserve known effects beside unknowns | Explicit provider-descendant unknown retained |
| 009 | Strict JSON, unique names and scalar Unicode | Byte parsers and ordered native validation |
| 010 | Exact quantities and required unknown targets | Byte string, unit and scale; no currency conversion |
| 011 | Profile-bound identities | Exact case-sensitive comparison and manifest digest |
| 012 | Explicit canonical preimages | Complete objects versus body bytes distinguished |
| 013 | Mapping applicability and implementation | Finite declaration `github-comment-bridge/1` |
| 014 | Bind invocation/context and accepted association | Exact full-description comparison; occurrence kept separately |
| 015 | Evidence source, artifact and scope | Declaration only, not external analysis/review |
| 016 | Supported conditions; unknown distinct from failure | No general condition-language execution |
| 017 | Processing, policy and execution separation | Invalid/unsupported/failure do not become semantic denial |
| 018 | Withhold unmet obligations, preserve known denial | Ordered policy and final gate |
| 019 | Immutable revisions and safe withdrawal | Versioned repository artifacts; no live registry service |
| 020 | Acceptance reuse dependencies/currentness | No acceptance cache; no selective-invalidation claim |
| 021 | Signed distribution trust/rotation/freshness | Not implemented by repository hashes |
| 022 | Current authority on reuse | Policy reload for a new send; observation recovery is not reuse of permission |
| 023 | Versioned critical-extension handling | Required body hash; unknown critical extension refused |
| 024 | Explicit finite processing limits | Parser/schema/worker/OPA/list bounds |
| 025 | Treat references/expressions as untrusted data | No profile-triggered arbitrary fetch or execution |
| 026 | Telemetry minimization and authority | Selected public synthetic reports; not automatic anonymization |
| 027 | Bound provider observation and outcome semantics | Exact current-content receipts and conservative recovery |
| 028 | Identify claim scope and evaluator | Bounded same-project report, not certification |

## Appendix C. Processing Limits and Refusal Ownership

Limits are interoperability and resource bounds, not measured capacity claims.
Exceeding one cannot produce truncated success. These values describe the pinned
runtime and core utilities, not a promise about all future profiles.

| Boundary | Configured limit or validation | Refusal owner/result |
| --- | --- | --- |
| Core JSON frame | 1 MiB, nesting 64 | Parser: `evaluation_failure/limit_exceeded` |
| Core semantic arrays | 256 effects/evidence/unknowns; 1024 relations | Structural validator: invalid structure |
| Quantity coefficient/scale | Up to 78 digits; schema scale 0 through 18 | Structural validator; profile further narrows |
| Comment body | 1 through 8192 UTF-8 bytes | Native mapper: invalid input |
| Issue number | Integer 1 through 2147483647 | Native mapper: invalid input |
| Python child | 10 seconds, 2 MiB output buffer | Consumer wrapper: process failure |
| OPA child | 2 seconds, 65536 output bytes, 256 KiB input | Authority wrapper: explicit timeout/output/input failure |
| Policy grants | At most 1024 complete grant objects | Authority: invalid policy |
| Provider requests | 15-second HTTP timeout; redirects refused | Gate: identity/preflight failure or unknown after dispatch |
| Preflight listing | At most five pages of 100, final short page required | Provider adapter: incomplete listing fails |
| Occurrence name | Path-safe string, 1 through 120 characters | Ledger configuration failure |
| Live report/journal replay | 32 MiB file bounds, constrained journal path | Replay integrity failure |

The public core allows explicit unknown quantities where a supported profile
defines them. The comment native contract requires a concrete body and issue,
so missing values are invalid rather than invented unknowns. General support
for a syntax does not require a particular domain profile to treat every
missing field as meaningful uncertainty.

## Appendix D. Artifact and Replay Procedure

The measured v0.2 source remains Bench
`9f638df994504ba6f5d82c0b5409922a0be7a72e`, with Spec
`a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`. Later documentation or field-study
commits do not relabel those observations. Use the public lowercase sibling
clones and the pinned Spec checkout; installation commands are in the public
quickstart. Do not modify the source inventory to make an old report pass.

| Artifact | Identity / role |
| --- | --- |
| Offline report `runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json` | 216 rows, 26 pure controls and 26 diagnostics |
| Offline replay `runtime-pilot-replay-2026-10-19T04-24-39.129Z-61da80.json` | 216 row checks plus 52 reference/diagnostic checks |
| Live report `runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json` | 32 slots and 12 current-content receipts |
| Journal `runtime-pilot-live-attempt-338f0652-715c-4095-84df-4f19d8e2f8c7.jsonl` | Begin + 32 scheduled + 32 result + end = 66 entries |
| Live replay `runtime-pilot-replay-2026-10-19T04-26-57.109Z-690395.json` | 32 row checks and 12 anonymous GET matches |
| Initial failure `runtime-pilot-offline-2026-10-19T03-40-48.927Z-769420.json` | Original failed report, not a reconstructable exact old executable tree |
| `field-study-freeze-2026-10-19T06-28-30.451Z-e3d388eb.json` | First-run task/criteria and source freeze |
| `field-study-use-2026-10-19T06-33-57.736Z-0e238334.json` | Six first-run tasks, traces, mechanical checks, and usage |
| `field-use-2026-10-19T06-28-30.337Z-3ede5a.jsonl` | 242 records, hash-bound by the use report |
| `field-study-publication-fit-2026-10-19T06-40-15.561Z-bdcae674.json` | 24 preparation-only packaging rows |
| `field-study-freeze-2026-10-19T07-10-06.472Z-419977b3.json` | Amendment-2 source, task and criteria freeze |
| `field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json` | Same six goals: two completed, four retained byte-budget failures |
| `field-use-2026-10-19T07-10-06.329Z-1a193a.jsonl` | 246 records, hash-bound by the second use report |
| `field-study-replay-2026-10-19T07-18-25.099Z-3c9423af.json` | Strict second-run replay with explicit release-envelope gap |
| `field-study-publication-fit-2026-10-19T07-18-12.145Z-b1330df7.json` | 24 preparation-only rows from all six second-run candidates |
| `field-study-review-audit-2026-10-19T07-23-39.012Z-f5138821.json` | 30 literal quotations, frozen facts, bytes and grade arithmetic |
| `owned-write-study-2026-10-19T13-32-22.199Z-ab5303e5.json` | Preserved pre-reservation failure; no comment calls |
| `owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json` | Two ordinary deliveries, six fault cases, twenty fresh workers |
| `owned-write-20261019-b.*.jsonl` | Twenty worker journals plus supervisor, 283 records |
| `owned-write-replay-2026-10-19T13-50-51.561Z-2e5d127c.json` | Source, plan, policy, process, receipt and no-resend reconstruction |
| `owned-write-audit-2026-10-19T13-58-07.840Z-d8467612.json` | Timing arithmetic and six anonymous current-content GETs |

All artifacts reside under `reports/`; JSON reports have adjacent checksums,
and the field journal is hash-bound by its use report. The v0.2 digest inventory
and source-blob audit are in `measurement-contract.md`, `measurement-audit.json`
and `sources.json`. The first field-use report has SHA-256
`cdc07b7a10000a4fe96152a6a460f5633c3403bcc7c0cd8f3f68f8e1a5cbe9fc`;
the publication-fit report has SHA-256
`7bf1f16c13bd92b5db2952ea0454870163e3522cf8e5d8524e68c7579ddb3bc6`.
The second use, fit, and strict-replay reports have SHA-256, respectively,
`e6d9fe0e27ca93932fb9102cc5d5b7f16e4c7c138cd72c79eeeaaf1cb2961999`,
`3b501f6261821e5bd0c3d7901c090587c519e2c195cdcfa86e67282633a260e5`,
and `b9d854f40a79c9e68a3447470b2b7af768c198d0d7b4ab17d0f82a641f1048b9`.
The second review under `analysis/review-second-field-use.json` has SHA-256
`0f5b7954f549c1e184f5ece621126234f2c1c8034175391b1f1354ef2eca2682`;
its review-audit report has SHA-256
`a6c3490fcdd8957ec14a980ed709c18499bcdac6eb679ce1adadacd960186194`.
File hashes identify exact bytes;
canonical description hashes identify JSON values. Reformatting a report changes
the former even if every parsed value remains equal.

From a checkout matching the report's executable inventory:

```sh
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
node runtime-pilot/replay.mjs reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json --github
```

Replay first checks bytes/checksums and exact source inventory. Offline replay
checks scheduled keys, literal native/context/policy/reference records, derived
counts and timing summaries, then reruns current mapping/OPA for the matched
source. Pure and lossy controls are checked separately. Live replay additionally
checks the frozen plan, exact outcomes/reasons, dropped-ACK witnesses and journal
consistency. Duplicate rows remain not reauthorized; they are not new grants.

With `--github`, receipt IDs are deduplicated and anonymous GETs compare current
comment content. No POST or model request occurs. A later deletion, edit, rate
limit or missing artifact must remain a failed/unavailable check. Replay reports
are newly written local artifacts, but their current timestamps are not original
execution times. A report and checksum can be forged together; trusted retained
pins and custody are required for claims beyond internal consistency.

The first field report retains its `bc1d389` execution runtime and frozen
task/criteria files. Its local command is `node field-study/replay.mjs REPORT.json`;
the checker loads recorded execution sources rather than relabeling the run
with its own later revision. Section 8.9 distinguishes the original consistency
pass, the stronger post-review reconstruction, and the retained native-release
coverage gap. Checker revisions do not authorize changes to historical evidence.

The owned-write source is `f93b1cfcbf2c2665b4acc7c5dc8fb92d1ba8d6b6`.
Its report and first successful replay have SHA-256, respectively,
`735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7`
and `50a150f868ae00b065bbae35b1f782988a474cb0533cc526746f7f217302d384`.
The retained pre-reservation failure is also required by the continuation's
manifest. Run `node field-study/write-replay.mjs REPORT.json` from a full clone
with the recorded Git history available. Replay reads historical source as
data; it does not check out arbitrary old source or repeat a mutation. Live
setup/execution commands in `field-study/OWNED-WRITE.md` are not replay commands.

## Appendix E. Compatibility and Deployment Decisions

Before adding a domain, define its invocation capture, exact quantity/identity
semantics, permissible context acquisition, evidence reference rules, known
scope and required unknowns. Then implement an independent consumer and a
competent direct adapter before choosing benchmark expectations. A profile is
not made generic by accepting arbitrary JSON keys or resolving unknown URLs.

Migration needs separate checks for wire, profile, processing contract, installed
implementation and policy. Unknown critical semantics require refusal rather
than stripping fields and retrying. An unavailable old revision is unavailable,
not permission to interpret it under the newest rules. Historical reports should
continue to name the versions actually executed.

Promoting this interface into a product would require measured support for its
actual domains, durable ownership, credentials, operator recovery and task utility.
The bounded experiment accepts direct partial scope for synthetic public content;
a customer policy needing complete descendants cannot inherit that exception.
Likewise, the one-host ledger needs an explicit replacement or qualification
before multi-host deployment. These are engineering decisions with acceptance
criteria, not changes that a public working paper silently authorizes.

## References

The S1--S13 retrieval inventory, including UTC timestamps, digests and a partial
retrieval, is retained in [sources.json](sources.json). S14--S17 below identify
the additional primary sources for official-server and Responses integration.
Documentation commits are distinct from installed engine versions. Third-party
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
- **S14.** GitHub, [Server Configuration Guide][official-mcp-config], GitHub MCP server v2.0.2 source `eb47a99ddb866ca2b8a162920e6bda9521f33ebb`, tool selection and read-only mode; retrieved `2026-10-19T06:48:36.127Z`.
- **S15.** GitHub, [Typed tool schemas][official-mcp-typed], same pinned server source; retrieved `2026-10-19T06:48:36.386Z`.
- **S16.** GitHub, [Issue tool implementation][official-mcp-handler], same pinned server source, `AddIssueComment`; retrieved `2026-10-19T06:48:37.062Z`.
- **S17.** Microsoft, [Use the Azure OpenAI Responses API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses), resource-specific `/openai/v1/responses` endpoint; retrieved `2026-10-19T06:50:56.789Z`. Deployment/version/region observations come from the run record, not this general API guide.

[spec]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/SPEC.md
[spec-publication]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/PUBLICATION.md
[spec-release]: https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1
[released-profile]: https://github.com/OndCo/Action-Effect-Spec/blob/a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40/profiles/github-issue-comment/README.md
[official-mcp-release]: https://github.com/github/github-mcp-server/releases/tag/v2.0.2
[official-mcp-typed]: https://github.com/github/github-mcp-server/blob/eb47a99ddb866ca2b8a162920e6bda9521f33ebb/docs/typed-tool-schemas.md
[official-mcp-handler]: https://github.com/github/github-mcp-server/blob/eb47a99ddb866ca2b8a162920e6bda9521f33ebb/pkg/github/issues.go
[official-mcp-config]: https://github.com/github/github-mcp-server/blob/eb47a99ddb866ca2b8a162920e6bda9521f33ebb/docs/server-configuration.md
