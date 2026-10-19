# External Evaluation CLI

This executable supports separate input, label, and result custody without
claiming that external custodians or an independent evaluation exist. Its tests
use only a small, synthetic public-development example. No Shuwen or other
private/customer data belongs in these examples. Existing frozen corpus files
and their provenance are not edited or automatically loaded by this tool.

Separation is structural, NOT filesystem-isolated custody: the runner has no
label-path option, but the process still has its ordinary filesystem access.
An actual external custodian and a separately controlled process/access boundary
remain required for an external-custody claim; this CLI supplies neither.

## Three Phases

Use Node 22 or newer from the benchmark root. All paths are caller-supplied local
paths; outputs are exclusive and never overwrite an existing artifact. The
parent directory of a new run directory must already exist.

```sh
node runtime-pilot/external-evaluation.mjs seal --inputs /work/inputs.json --labels /custody/labels.json --out /work/seal.json
node runtime-pilot/external-evaluation.mjs run --inputs /work/inputs.json --seal /work/seal.json --seal-sha256 TRUSTED_SEAL_SHA256 --run-dir /work/run-001 --strategy protocol
node runtime-pilot/external-evaluation.mjs score --labels /custody/labels.json --seal /work/seal.json --seal-sha256 TRUSTED_SEAL_SHA256 --results /work/run-001/results.json --results-sha256 TRUSTED_RESULTS_SHA256 --out /work/score.json
```

`TRUSTED_SEAL_SHA256` and `TRUSTED_RESULTS_SHA256` stand for the exact lowercase
64-hex pins returned by earlier phases, independently retained by the operator.
Do not derive a replacement pin from an artifact whose integrity is in question.

1. **Seal** reads the input pack and separately supplied labels. It validates
   schemas, unique IDs, and exact row correspondence, then records exact-byte
   SHA-256 hashes and lengths in a public seal. The seal has no label path or
   expected values. Stdout reports `seal_path`, `seal_sha256`, and case count.
2. **Run** accepts only inputs, the public seal, its independently retained pin,
   a fresh run directory, and optional `protocol` or `structured` strategy.
   There is no labels option. It verifies inputs before invoking the fixed
   `prepareAction(native, context, strategy)` and, only for accepted mappings,
   `authorize(projection, context, policy)` APIs. It saves unabridged JSON
   preparation/authorization outputs in `results.json`, plus its digest. It
   never calls dispatch, provider mutation, or reconciliation APIs.
3. **Score** reads only the public seal, independently supplied labels, and saved
   results with both trusted digest pins. It neither loads input files nor
   imports or reruns candidate APIs. It validates complete row correspondence
   and outputs before comparing status, reason, checked projection, and decision.

Each output has a `.sha256` sidecar containing its lowercase digest and newline.
Sidecars are conveniences, not independently trusted pins. Keep labels outside
the run environment in an actual custody exercise; this CLI does not create or
attest such a separation itself. File copies/forks remain usable because seals
contain hashes and IDs, not input/label locations.

## JSON Contracts

Input pack, with no expected values or executable/module paths:

```text
{
  schema_version: "external-evaluation-inputs/1",
  classification: "synthetic-public",
  cases: [{id, native: <one SDK or MCP outer object>, context, policy}]
}
```

Each `native` is one unchanged JSON outer object, not a `native.sdk/native.mcp`
pair. Separate IDs can represent paired lanes, but those are not independent
trials. Negative native envelopes are allowed: the tool must not repair missing
fields, normalize body text, or turn malformed calls into corpus-schema errors.
`context` is null or an object with only `principal`, `data_class`, and
`implementation` keys; missing facts are allowed as negative inputs. When a
context data class is supplied, it must be `synthetic-public`. This is an
operator declaration, not content inspection or a DLP claim.

Trusted policies have exactly `revision`, `principal`, `revoked`,
`allow_partial_direct`, `max_body_bytes`, and `grants`. Revision/principal are
nonempty strings; the two flags are booleans. A valid OPA policy requires a
positive safe-integer byte bound. The pack format also accepts zero solely as
a deliberate operational-invalid-policy input, not valid authority: reaching
authorization with it must fail the run, not earn semantic denial credit.
Each grant has exactly a path-safe `repository`, positive safe
`issue_number` at most 2147483647, and nonempty `data_class`. These policy schema
checks run before candidate execution. Additional runtime configuration failures
remain operational failures rather than earning denial credit.

Separately held labels:

```text
{
  schema_version: "external-evaluation-labels/1",
  cases: [{id, expected: {
    mapping: {status, reason, projection?},
    decision: "allow" | "deny" | "review" | "not_evaluated"
  }}]
}
```

Accepted labels use `accepted_partial/declared_partial` and the exact seven-field
checked projection: `operation`, `repository`, `issue_number`, `endpoint`,
`body_sha256`, `body_bytes`, `data_class`. Rejections use
`invalid_input/native_input`, `unsupported_profile/operation`, or
`untrusted_evidence` with `missing_context`, `implementation_binding`, or
`description_binding`. Rejections have no projection and require
`decision: "not_evaluated"`. IDs are 1-100 ASCII alphanumeric/dot/underscore/hyphen
characters, starting with an alphanumeric character. Keys are exact. Packs are
limited to 1-1000 cases, 16 MiB per JSON artifact, and 100 levels of nesting.
All JSON artifacts reject duplicate decoded object names, including escaped
aliases, at every nesting level. Finite negative and fractional native values
remain allowed as negative test inputs; key-like text inside strings is data.

Raw result rows are `{id, preparation, authorization}`. `preparation` preserves
the complete JSON return from `prepareAction`, including descriptions and timing
when returned. `authorization` preserves the complete authorizer output, or is
null for a nonaccepted mapping. Unknown statuses, malformed projections,
non-JSON outputs, and authorizer `evaluation_failure` outputs are operational
failures. They cannot become a synthetic denial or a successful result row.

## Identity and Failure Handling

Results record the absolute run directory, timestamps, strategy, Node/platform
identity, and before/after source-file hashes. Source discovery is fixed to
repository runtime code, the GitHub profile, and local consumer implementations.
It excludes `cases`, `tests`, reports, private runtime directories, caches, and
dependencies, and does not follow symlinks. It reads code files and two fixed
normative JSON files, never searches for label JSON, and does not use the broader
fixture-reading `artifacts.mjs` snapshot. The snapshot is repository source
identity, not complete dependency/binary attestation or proof against an
in-process change-and-revert. No source path stored in a result is executed or
opened by scoring.

A source change during a run retains the raw report with `source_drift: true`;
scoring marks it `exploratory-source-drift`. Rerun stable sources for stronger
evidence. Adding this CLI can change a broader exploratory source snapshot;
retaining that older report does not make it stable or independent.

After input verification and creation of a fresh run directory, runtime,
configuration, and output faults retain `failure.json` and `failure.json.sha256`.
Its `external-evaluation-failure/1` schema contains run metadata and available
source hashes, only fully validated completed `rows`, a `failed_case_id` (null
for setup/finalization faults), all `scheduled_ids` in input order, and
`not_started_ids`. Source observations are null when unavailable; `source_drift`
is null unless both source snapshots completed. A fixed `failure_phase` is one
of `source_before`, `runtime_configuration`, `preparation`, `preparation_output`,
`authorization`, `authorization_output`, `source_after`, or `results_write`.
Caught error text, stacks, and malformed outputs are not retained. Execution
stops at the first fault without rerunning candidates or resuming the directory.

Faulted runs exit 1 with empty stdout; stderr includes a sanitized diagnostic
and a JSON receipt `{failure_path, failure_sha256}`. Failure artifacts cannot be
scored, even if every case completed before a finalization fault. Preflight
option/schema/integrity failures are rejected before creating the run directory.
If storage or artifact limits prevent failure-evidence retention, the diagnostic
explicitly reports that limitation rather than claiming a receipt.

All schema, digest, duplicate-key/ID, missing-row, runtime, and malformed-output
failures exit 1 and withhold a successful phase result. Score mismatch reports
are retained and exit 2; matched reports exit 0. A source-drift report may exit 0
but remains explicitly exploratory. `not_evaluated` matches are counted
separately from semantic decisions and never increment `correct_denials`.

The CLI has no arbitrary module/plugin, command, URL, or code-path option and
does not interpret paths from pack contents. It is not an OS sandbox for a
malicious candidate or filesystem owner. Hashes detect modification relative
to trusted pins; they do not establish independent authorship, custody, or
honesty if the same actor replaces both artifacts and pins.

## Verification

```sh
node --test runtime-pilot/tests/external-evaluation.test.mjs
```

Tests exercise real seal/score logic, retained runtime/configuration failures,
label absence during run, input absence during score, tampering, duplicate
decoded keys and duplicate/missing IDs, negative/fractional native numbers,
source drift, non-JSON outputs, symlink help and silent stdin imports. Real CLI
smoke tests use only the fixed offline preparation and authorization APIs.
Tests create synthetic temporary fixtures and remove them afterward; no frozen
corpus comparison is performed.
