# Runtime Interoperability Pilot

19 October 2026, America/Toronto. Approved scope: complete the public-draft
hardening, real MCP/SDK and OPA pilot, evaluation, research manuscript, adopter
materials and publication in one coordinated round. This is not approval to
change Studio, activate hooks, use protected collaboration cases or contact
named collaborators on the user's behalf.

## Deliverables and Boundaries

1. Preserve the v0.1 release, seven frozen source files and original cases.
   Clarify configuration/projection errors in a separately versioned contract.
2. Add an additive GitHub issue-comment profile using the unchanged core wire
   schema. The release version and core wire version are distinct.
3. Run actual official MCP SDK stdio transport and Octokit calls against owned
   dedicated public test issues. Use real OPA, not a hand-written substitute.
4. Publish mapping, authorization, integrated admission, provider readback and
   complete cost separately. A mature structured adapter is the main baseline;
   a deliberately lossy mapper is an ablation, not a claimed competitor.
5. Provide an updated research manuscript, executable adoption guide, external
   case submission/custody instructions, and a public invitation. Receiving
   external review is not something this project can manufacture on demand.

The pilot is finite, author-designed and AI-assisted. Actual SaaS effects do
not make case labels externally independent. Official upstream interface data
can constrain mappings but is not an independent governance oracle. No claim of
novel inference, universal safety, standard adoption or production qualification
follows from this experiment.

## Architecture

Runtime-native input -> producer -> conditional effect description -> separately
implemented consumer -> OPA authorization -> final dispatch gate -> GitHub ->
fresh readback. Description acceptance remains `authority: not_evaluated`.

SDK native input is `{owner, repo, issue_number, body}`. MCP native input is a
`tools/call` for `add_issue_comment` with those arguments. No arbitrary URL,
shell, credential or executable expression is accepted from a test case.
Unknown operation/extra action parameters are rejected rather than ignored.

The profile projects one coupled effect: comment creation on an exact issue,
to its exact GitHub API endpoint, with UTF-8 byte count and body SHA-256 binding.
Case-sensitive repository identity is conservative; no alias inference occurs.
Only synthetic public text is dispatched. Notifications, webhooks and provider
internal descendants remain explicitly unknown, not claimed absent. A policy
may explicitly accept this partial direct scope for the dedicated test resource;
an unrelated production action must not inherit that experiment policy.

Implementation and context bindings are checked against caller-configured
artifacts, never self-authorized by fields inside a request. The live principal
comes from the authenticated provider, not a user-supplied claim. Every dispatched
request is checked again against current local experimental authority. This
closes the tested local stale-policy path, not an atomic transaction with GitHub.

## Authorization and Recovery

OPA receives complete tuples plus separately trusted policy/principal data.
Allow, deny, review and evaluation failure stay distinct. Policy unavailability,
invalid description, missing facts and changed binding cannot become permission.
Known denial takes precedence over unrelated uncertainty where the policy can
establish the denial. No positive result is cached across policy change.

The dispatcher reserves an occurrence before POST. If delivery may have started,
it does not automatically repeat the POST. It records confirmed/unknown outcome;
read-only reconciliation can resolve an unknown. Unique synthetic markers support
readback but are not a provider idempotency key. A single-host durable ledger is
not a global exactly-once guarantee.

## Evaluation and Freeze

Before candidate results, freeze the declared native-input contract, case list,
literal mapping/decision expectations, policy, scoring and retry rules. Keep a
same-project provenance record and retain all attempts. New regressions after a
failure belong to exposed development, not a refreshed hidden evaluation.

Compare protocol+OPA and a complete structured adapter+OPA with the same policy,
principal, input, dispatch checks and offered work. Measure a lossy-field ablation
separately to show whether downstream denials can mask mapping errors.
Pure authorization consumes case-author reference effects, not producer output.

Offline cases cover normal Unicode/ASCII content, alternate issue/repository,
authority revocation/narrowing, unsupported operation, missing context,
implementation/body drift, tuple recombination, unknown descendants, duplicate
occurrences and ambiguous delivery. Only valid approved synthetic operations
reach the live provider. A bounded live subset includes both allow and withheld
cases, both runtimes and both main strategies. No attack against another party.

Report per-track denominators, withheld legitimate work, missing/invalid outputs,
OPA and provider failures, raw per-stage timing, policy revision, source/input
hashes and provider readback. Small convenience samples do not justify population
confidence or tail-SLA claims. Baseline parity or extra cost is a valid finding.

## Publication and Product Boundary

Publish only authored code, synthetic inputs, sanitized observations and source
metadata. Keep credentials, full HTTP headers and local account files out. MIT
is retained for these repositories; it is not a patent-clearance certification.
Release as a prerelease after tests, clean-clone reproduction and CI. Do not
deploy a customer-facing service. Provide an adapter interface and staged product
adoption criteria, not a silent OSuite implementation dependency.

The paper is an executable protocol/measurement manuscript with measured claims,
not a guaranteed venue-ready novel algorithm. Existing research and Shuwen's
independent skill-boundary collaboration retain their own scope and custody.
