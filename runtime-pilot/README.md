# Bounded Runtime Pilot

This directory implements the GitHub Issue Comment Profile 1 from the pinned
companion Spec. It is an executable research/adoption example, not the OSuite
application, a general sandbox, or an independently certified standard.

## Two Complete Paths

```text
SDK or MCP request + configured context
  protocol:   JS description -> Python binding/tuple check
  structured: Python native-to-structured projection
        -> same current OPA policy -> same occurrence ledger
        -> one GitHub POST -> fresh readback
        -> confirmed, unknown, withheld, or duplicate-suppressed
```

Both paths use the same finite native-input restrictions, policy and controlled
dispatch behavior. The protocol adds a transferable description and a second
implementation's binding checks; it is not assumed faster or more accurate
than a correct direct adapter. SDK/MCP envelopes differ, so compare semantic
projections rather than treating their full wire hashes as identical.

Install and execute using [the quickstart](../docs/adoption/quickstart.md).
Results and exact retained reports are indexed [here](../reports/runtime-pilot-summary.md).

## Inputs and Outcomes

- `mapping.mjs` produces a direct **partial** effect declaration; the Python
  consumer checks it against the actual native capture and configured context.
- `authorization.mjs` invokes the pinned real OPA binary and validates its
  output. An engine/configuration failure is not counted as a policy denial.
- `gate.mjs` snapshots the native input and configured provider methods,
  validates provider identity, and reloads current policy after preparation
  and read-only preflight. Descriptor acceptance alone never permits a write.
- `ledger.mjs` reserves an occurrence with exclusive creation and durable
  state transitions. It is a same-host ledger, not a distributed transaction.
- `provider.mjs` uses Octokit with fixed GitHub API endpoints and no automatic
  POST retry. Credentials remain in memory and outside public evidence.
- `mcp-server.mjs` and `mcp-client.mjs` use the official SDK's real stdio
  initialize/list/call exchange. Unknown keys are rejected, not stripped.
- `replay.mjs` verifies retained byte identities and reruns local mapping/OPA.
  `--github` performs unauthenticated, read-only current-content checks.

The raw processing states (`accepted_partial`, `invalid_input`,
`unsupported_profile`, `untrusted_evidence`, `evaluation_failure`) are separate
from `allow`/`deny`/`review` and separate again from the observed provider result.
The external-evaluation CLI likewise seals inputs and labels separately before
running/scoring; see [its contract](../docs/adoption/external-evaluation-cli.md).

## Trust and Non-Claims

Local code, profile installation, policy files, configured principal/class,
ledger storage and host filesystem are trusted. The implementation identity is
a **declaration**, not an attested binary or proof of GitHub's internal code.
The native capture must come from the path that actually dispatches the request;
a hash cannot make a dishonest capture truthful.

GitHub explicitly documents notification behavior for comment creation. We
represent only the direct comment and retain unknown downstream recipients,
delivery, webhooks and internal descendants. Partial scope is admitted only
with the experiment's explicit policy choice on synthetic public resources.
No notification or transitive-closure completeness is claimed.

Current local authorization and the remote POST are not atomic. A revocation
after the final local check may race with dispatch. A local occurrence ledger
does not provide global exactly-once delivery, automatic crash-lock recovery,
multi-tenant isolation, distributed quota handling, or a provider idempotency key.
If delivery might have occurred, the reservation stays consumed and recovery
only queries. Missing or ambiguous observations remain unknown.

Readback must match the POST response ID when that ID is known. With a lost
acknowledgment, recovery excludes every comment ID recorded before dispatch
and requires one new exact content/actor match. Preexisting matching content
is withheld before dispatch. This test uses a dedicated issue, unique body
markers and one controlled writer. A new matching comment establishes current
content after preflight, not causal proof that this specific POST created it:
a concurrent same-account writer or provider-side mutation is outside that
attribution guarantee. This distinction is recorded in `recovery_evidence`.

The live runner records each scheduled/result step in a fsynced attempt journal,
stops new writes after an unexpected result, and refuses to reuse an issue
already containing a pilot marker. It does not silently create a new occurrence
to retry an uncertain write. Keep partial journals and the private local ledger
if interrupted; use read-only reconciliation instead of rerunning the live CLI.

## Evaluation Boundaries

The 55-case/22-intent development corpus is same-project, AI-assisted and public.
It was hidden from candidate implementers until its pre-result freeze, not
withheld from implementation development forever. The original incorrect freeze
ordering statement and its corrections are retained in the custody history.
The real live subset is eight scripted scenarios across two lanes and two
strategies, not 32 independent incidents or autonomous model decisions.

The upstream GitHub OpenAPI excerpt is genuine third-party interface material
with a pinned commit and retained MIT notice. It is not independently authored
governance labels. No outside team has yet run the external-custody protocol.
Costs include cold subprocesses and communication where measured; there is no
warm-path throughput claim, tail SLA, or broad customer-deployment qualification.
The `America/Toronto` report timezone is an editorial preference, not a
geolocation or Canadian work-location attestation.
