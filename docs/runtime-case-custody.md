# Runtime Case Custody

## Status and provenance

This is a finite, synthetic, public-development evaluation corpus for GitHub
issue-comment mapping and authorization. Case authors and implementation authors
belong to the same project; case authoring is AI assisted. This is NOT an external,
held-out, independent-laboratory, or independently validated evaluation. SDK/MCP
renderings and boundary variants are related observations, not independent samples.

The retained corpus has 55 case rows in 22 base-intent groups: 53 SDK inputs and
55 MCP inputs, or 108 lane instances. The user explicitly retained these counts
after briefly suggesting a 24-row limit. No case inputs or labels were changed
in the provenance correction described below.

The case inputs and labels were authored from the interface supplied in the
task. After the initial freeze, the user explicitly authorized reading
`../action-effect-spec/profiles/github-issue-comment/README.md` and `profile.json`;
their source hashes are recorded in the revised manifest. No `mapping.mjs`, other
runtime candidate source, candidate output, Studio/osuite data, or Shuwen data
was read or used. No network requests, provider calls, real comments, or other
remote effects were performed. Repository and principal strings are fixture
targets, not proof that an issue exists or a user controls a GitHub account.

The parent DID begin implementing from the agreed public interface while the
case author was authoring the corpus. Per the user's direct provenance
correction, the parent has not read case JSON or expected outputs and has not
run the candidate on the corpus or compared results before this revised freeze.
The parent has read only this custody document and freeze metadata, not case
JSON or expected values. The case author has not inspected
candidate code or output. This is a freeze BEFORE CORPUS RUNS AND RESULT
COMPARISON, NOT a pre-implementation freeze. It records a same-project procedural
boundary based on the user's report, not independent attestation. Local hashes
detect drift relative to the retained anchor; they are not signatures or
third-party timestamp attestations.

The current manifest's exact ordering value is:

```text
case-author-did-not-read-candidate; parent-did-not-read-corpus-until-freeze; implementation-parallel-from-agreed-interface
```

## Historical correction

The initial manifest, timestamped `2026-10-19T03:28:08Z`, and its detached hash
are preserved byte-for-byte under `runtime-pilot/cases/historical/initial-freeze/`
as `freeze-manifest.json` and `freeze-manifest.sha256`. Its manifest SHA-256 is
`103b003ee13ddecd8027fce1ca8b5ffdeed3b7c36273438116433b1cc69cffb7`.
Its ordering claim that implementation waited was incorrect and is explicitly
superseded. Do not use that historical claim in reporting results.

The intermediate `freeze-manifest.v2.json` and `freeze-manifest.v2.sha256` are
also retained unchanged as historical artifacts. Their manifest SHA-256 is
`3774e734d8d58c4aa3e9e63159e383a9c90463c0404feb2a24d69a591441bf76`.
That revision corrected provenance but left the misleading initial manifest at
the conventional current path. Revision 3 fixes that ambiguity.

`runtime-pilot/cases/freeze-manifest.json` is now the CURRENT freeze, revision 3,
with `freeze-manifest.sha256` as its detached anchor. It contains the exact
ordering statement above and binds the current custody documentation, separate
integrator case shape, checker, unchanged corpus, and both historical seals.
The retained
`github-issue-comment.v1.json` is byte-for-byte unchanged, with SHA-256
`f452e4fcb30a04bebe179ca6a3393b0a006497ddee2f110440bcd0e3b476ca17`.
Historical helper/document hashes describe their prior versions, not the revised
files. No candidate behavior or results motivated any label change; there were
no label changes. These revisions change metadata/custody, not the case set.

## Files and format

- `runtime-pilot/cases/author-corpus.mjs`: deterministic interface-only authoring
  helper using Node standard-library modules; it never imports a candidate.
- `runtime-pilot/cases/github-issue-comment.v1.json`: retained, literal native
  calls, expected projections, and explicit mapping/decision labels.
- `runtime-pilot/cases/case-shape.md`: separate exact integrator/scoring contract.
- `runtime-pilot/cases/freeze-manifest.json`: current revision-3 timestamp, corrected
  custody, authorized normative-source hashes, and artifact hashes/byte counts.
- `runtime-pilot/cases/freeze-manifest.sha256`: detached SHA-256 of the current
  manifest bytes, avoiding a self-referential hash.
- `runtime-pilot/cases/historical/initial-freeze/`: byte-preserved initial
  manifest and anchor, not the current freeze.
- `runtime-pilot/cases/freeze-manifest.v2.json` and `freeze-manifest.v2.sha256`:
  byte-preserved intermediate seal, not the current freeze.

The JSON root has `schema_version`, `corpus_id`, `provenance`, `scope`, `format`,
`counts`, and `cases`. Each case has exactly:

```text
{id, base_intent, scenario, native, context, policy,
 expected: {mapping: {status, reason, projection?}, decision}}
```

`native` is a nonempty object whose keys are a subset of `sdk` and `mcp`.
Every present entry is one native input to evaluate against the same `expected`.
MCP-only operation/envelope cases omit `sdk` rather than invent an SDK operation,
insert a null executable input, or silently reuse an incompatible expectation.
An omitted lane is not applicable, not a success, failure, or skipped execution.
Most rows pair both lanes. `counts` reports case rows, distinct `base_intent`
groups, and lane instances separately; none is an independence claim.

The `context` key is always present in a case; its value `null` explicitly encodes
absent context evidence. This is a supported negative fixture, not an invalid
corpus record. Other fixture metadata is not forwarded inside native calls.
Unknown issue fixtures deliberately omit or null the native `issue_number`;
the harness must preserve these inputs instead of supplying defaults.

The helper emits ASCII JSON with escapes for Unicode (including deliberately
unpaired surrogates), so JSON parsing recovers the exact test strings. Never
normalize, trim, replace invalid scalars, coerce numbers, or repair input before
mapping. Rejected native inputs are deliberate test data, not corpus-schema
failures. Malformed case records, invalid trusted-policy configuration, missing
artifacts, checker failures, and candidate/harness exceptions are evaluation
failures, never correct `deny`, `review`, or `not_evaluated` decisions.

## Interface oracle

Supported native envelopes are exactly:

```text
{lane: 'sdk', call: {owner, repo, issue_number, body}}
{lane: 'mcp', call: {name: 'add_issue_comment',
                   arguments: {owner, repo, issue_number, body}}}
```

Allowed keys are exact at every native object level. Extra executable arguments,
outer keys, or MCP call keys are `invalid_input/native_input`, not ignored.
A well-shaped MCP call naming a different operation is
`unsupported_profile/operation`. Unknown outer lanes and native syntax/domain
errors are `invalid_input/native_input`. The corpus does not settle precedence
between two simultaneous, different mapping errors: negative rows isolate one
error class. No caller-supplied URL, method override, transport, or provider
operation is supported.

Owner and repository must be nonempty ASCII GitHub path-safe identifiers. These
fixtures reject empty values, separators, traversal dot segments, percent
escapes, non-ASCII identifiers, and whitespace. Positive identifiers use
unambiguous alphanumeric/hyphen spellings. The authorized normative profile
specifies owner `^[A-Za-z0-9][A-Za-z0-9-]{0,38}$` and repository
`^[A-Za-z0-9_.-]{1,100}$`, with repository `.` and `..` excluded. This finite
corpus does not exhaust that grammar or add account-existence checks or naming
rules. In particular, it does not exercise the 39/100-character length edges.
Repository strings remain case sensitive.

`issue_number` is a positive safe integer at most 2147483647, never a numeric
string. Unknown, null, fractional, zero, negative, unsafe, and over-limit issue
values are invalid native input, not wildcard grants or authorization review.
`body` is a nonempty scalar-valid string of at most 8192 UTF-8 bytes. Nonempty
whitespace and NUL are valid under this interface. An unpaired surrogate is
invalid, even if a UTF-8 encoder would replace it. Body bytes are not UTF-16 code
units or Unicode code-point counts.

A valid, trusted mapped call has `status: 'accepted_partial'`,
`reason: 'declared_partial'`, and exactly this semantic projection:

```text
{operation: 'create_issue_comment',
 repository: 'owner/repo', issue_number: <native positive integer>,
 endpoint: 'https://api.github.com/repos/owner/repo/issues/<integer>/comments',
 body_sha256: <lowercase SHA-256 of exact UTF-8 body bytes>,
 body_bytes: <exact UTF-8 byte count>, data_class: context.data_class}
```

Projection expectations are literal JSON, computed at authoring time only from
the supplied interface and authored synthetic values. The helper constructs
projections only for explicitly accepted rows; it does not derive mapping or
authorization labels from candidate behavior. The operation, repository, issue,
fixed GitHub endpoint, hash, bytes, and data class are all compared, not just the
decision. The principal is separate context, not a projection field or a value
trusted from a native caller.

The default context is exactly
`{principal: 'fixture-user', data_class: 'synthetic-public', implementation: 'github-comment-bridge/1'}`.
Absent context is `untrusted_evidence/missing_context`; a different implementation
binding is `untrusted_evidence/implementation_binding`. Both omit `projection`
and have `decision: 'not_evaluated'`. Every other nonaccepted mapping likewise
omits the projection and bypasses authorization. These exact labels supersede
the earlier ambiguous `incomplete/missing_context` wording in the task.

## Authorization oracle

The default trusted policy is:

```json
{
  "revision": "p1",
  "principal": "fixture-user",
  "revoked": false,
  "allow_partial_direct": true,
  "max_body_bytes": 8192,
  "grants": [{
    "repository": "OndCo/Action-Effect-Bench",
    "issue_number": 1,
    "data_class": "synthetic-public"
  }]
}
```

Policies are trusted harness inputs, not caller-controlled native arguments.
All scored policy variants remain well formed. An empty grant array is a valid
configuration with no grant, not a schema error. Exact coupled grants compare
`repository`, `issue_number`, and `data_class` within the SAME grant object;
matching each field across separate grants is insufficient.

For accepted mappings, known denial takes precedence: revoked policy, known
principal mismatch, no exact coupled grant, or body bytes above the trusted
bound means `deny`. Otherwise missing authorization facts or partial scope not
explicitly accepted means `review`; otherwise `allow`. The corpus explicitly
tests `allow_partial_direct: false` and denial-over-review precedence. Missing
whole context is tested at the earlier mapping boundary, not as a policy review.
Other partially missing context/fact combinations are outside these frozen
cases; this is not permission to assume unknown facts are true. Policy schema
errors must fail evaluation rather than masquerade as missing-fact reviews.

All accepted mappings describe only partial direct scope. Provider descendants
(notifications, webhooks, automations, storage, and other downstream behavior)
are unobserved. Even `allow` means the trusted policy explicitly accepts this
partial direct declaration; it does not certify complete effects or provider
execution. No live provider effects or arbitrary URL targets belong to this
corpus.

## Coverage and freeze procedure

There are 22 distinct base-intent groups: ASCII content, Unicode content,
verbatim content, changed repository, changed issue, coupled grants,
revocation, narrowed UTF-8 policy bounds, principal binding, partial-scope
review and known-denial precedence, unsupported operation, exact native keys,
absent context, implementation binding, body shape, unknown issue,
case-sensitive repositories, identifier safety, numeric issue bounds,
native UTF-8 body cap, scalar validity, and envelope shape. Boundary/control
variants within a group and SDK/MCP pairs are intentionally related.

The authoring sequence is: derive explicit labels from the supplied interface;
write the helper and this methodology with `apply_patch`; generate the literal
JSON and retain it with `apply_patch`; validate schema, projections, coupled
grant controls, boundaries, and counts without any candidate; then hash the
completed artifacts, record a single UTC freeze timestamp in the manifest,
and retain the manifest and detached hash with `apply_patch`. No Git commit is
made. The parent receives paths, the schema decisions, and the revised freeze
anchor before candidate corpus runs and result comparison, not before
implementation. The metadata correction is separately versioned and leaves
the original case JSON and historical manifest/anchor unchanged.

From the repository root, use Node 22 or newer:

```sh
node runtime-pilot/cases/author-corpus.mjs --check
```

`--check` targets current `freeze-manifest.json` revision 3, regenerates in memory,
compares the retained JSON byte for byte, checks metadata/schema invariants,
and verifies every artifact hash plus the active manifest anchor. It is
read-only, consults no current clock, and never refreshes
the freeze timestamp. Repeated checks against unchanged files return identical
output. `--print` (also the default) writes deterministic corpus JSON to stdout
only; it never writes or re-freezes files. Neither mode imports, locates, runs,
or reads a runtime candidate. The checker records but does not reread or fetch
the authorized normative sources; their recorded hashes identify the versions
read during this authoring task.

After freeze, do not edit this corpus, helper, custody note, manifest, or anchor
in place to fit implementation output. A correction requires an explicitly
versioned freeze revision and disclosure; changes to case inputs or labels also
require a new corpus version. Prior results retain the old hash.
Report parser/schema/configuration errors separately from behavioral mismatches.
Report public-development results by base intent and by lane without presenting
the paired renderings as independent trials or claiming external validation.
