# Public Development Case Provenance

Initial authoring date: 2026-10-19 UTC / 2026-10-18 America/Toronto.
Target: `offline-consumer-v1`, narrowing
`0.1.0-draft.1`. Classification:
`public-development-not-independent-external`.

These are 80 deterministic, exposed, same-project public development cases.
They are not an independent external evaluation, institutional review, protected
holdout, certification, security guarantee, full core-conformance claim, or
consumer pass/fail report. The initial case-authoring session had not run a
candidate consumer. This public derivative preserves that construction record;
later comparison results are separate. Authoring was AI-assisted within the
same project, not performed by an independent institution.

## Source Freeze

The complete domain-source reading set was the seven public files below.
Hashes are SHA-256 of the exact reviewed file bytes, including whitespace and
newlines. `case-source.mjs` checks all seven before generation and verification;
source drift aborts rather than silently changing the oracle.

| Reviewed public file, relative to the work root | Raw-file SHA-256 |
| --- | --- |
| `action-effect-spec/SPEC.md` | `7e391c1ac5f1ed6edcf85a39aa39a1a2e852678da67baf3691927daa807ddca6` |
| `action-effect-spec/schemas/effect-description.schema.json` | `0bb7797509174f2f24f534e76ac302fe6ed92e28dcd1e6b92322b2bf1abdbe5e` |
| `action-effect-spec/conformance/consumer-profile-v1.md` | `140eeec0b16b291519df90182eecbff7bc50efddc2e9a3f6a0d47db804d0538c` |
| `action-effect-spec/examples/refund-profile.json` | `6d8ea42431f7c4d61e0d37d6001767128cad5b23e5cd252afdee63c606ef25ce` |
| `action-effect-spec/examples/binding-profile.md` | `50a6595feca35e49f17949570e6e16d2ea7510ad912f6ce69e640ab2be3421c4` |
| `action-effect-spec/examples/partial-refund.json` | `e4af7ed8add434febe59619e24d305ad8829074c8413b4ea1df0761d2b1742d4` |
| `action-effect-spec/examples/synthetic-basis.json` | `62037bd66852b603b6cb82e6499c1e4c3d36fcad27a4b3796fa49d5633a8662c` |

The canonical manifest digest
`dddac40519b57620ca8b6fec558746ed8fb1f6ddf77263fd93cf5b2b582f2e00`
is copied from the public consumer profile and example. It is not the raw-file
digest above, and the generator does not implement a manifest canonicalizer.

## Exposure and Boundaries

Domain expectations were derived only from the frozen public documents, never
from JavaScript or Python consumer source, candidate output, OSuite code,
historical runtime results, other benchmark cases, or protected collaboration data. Neither
implementation directory was opened, searched, imported, translated, or run.
No other author was contacted, no external source was fetched, and no network
request, product edit, Git operation, or publication was performed.

The chat initially supplied an OSuite workspace path and its AGENTS instructions;
that ambient text was visible, but no OSuite files were read. General local
workflow skill instructions for planning, test authoring, debugging, and review were
also read; they supplied no domain results. File existence/metadata checks and
tool discovery supplied no implementation contents. This exposure statement
describes this authoring session, not institutional independence or model
training provenance.

The only authored artifacts are `case-source.mjs`, `cases.json`, and this file
under `action-effect-bench/conformance/`. Source and prose are edited with
`apply_patch`; only the case generator writes generated `cases.json` data.
No separate planning, temporary fixture, or runtime-result file is created.

## Construction and Oracle

1. Freeze and review the seven sources. Treat the consumer profile's processing
   order as authoritative for this limited target, with the schema supplying
   structural constraints and the specification supplying the CORE obligations.
2. Copy the public partial-refund description for semantic cases. Make explicit,
   deterministic mutations. Native JSON serialization produces input bytes only;
   it never produces expected canonical description bytes or expected statuses.
3. Author expected status/reason pairs and accepted counts directly from the
   contract. Every result asserts `authority: not_evaluated`. Each case cites
   actual CORE IDs; those citations describe focused coverage, not satisfaction
   of the whole cited requirement.
4. Author canonical text literally in the source. Convert those literals to UTF-8
   and compute SHA-256 with standard `node:crypto`, not a candidate canonicalizer.
   The depth-64 preimage is a fixed repetition of literal brackets and `0`.
5. For changed fixture snapshots, recompute selected-member hashes using the
   separate, deliberately narrow ASCII fixture helper described below. Preserve
   the unchanged pinned profile digest. The stale-input-member test deliberately
   restores the old input digest after rebinding to test omitted-field hashing.
6. Generate the small corpus and verify its own shape, uniqueness, source hashes,
   canonical-literal hashes, limits and exact reproducibility. These are checks
   of authoring integrity, not observations of consumer behavior.

There is no clock, randomness, locale-sensitive sorting, remote lookup,
implementation dependency, expression evaluator, or subprocess in the generator.
Harmless `printf` and `$(true)` text occurs only in bound strings and noncritical
metadata; no command string is evaluated or dispatched.

`expected` is an explicit field-level oracle. Accepted declarations assert their
status, reason, authority, effect count and unresolved count; their complete
`description_digest` is deliberately not manufactured by a general canonicalizer
in this authoring tool. Canonicalization cases assert exact canonical bytes and
their SHA-256. Consumers still owe the full output shape and digest required by
the profile; omitted expected fields do not waive those obligations. Failures
have exactly the three contract result fields. `hello` has no `document_b64`.

### Literal Canonical Vectors

The literal preimages cover UTF-16 key order (CR, `1`, U+0080, U+00F6, U+20AC,
U+1F600, U+FB33), JSON escaping including unescaped U+2028/U+2029, both safe-integer
endpoints, numeric negative zero, empty objects/arrays, recursive key ordering,
numeric-looking keys `10` before `2`, retained array order, and distinct composed
and decomposed Unicode. Source Unicode escape notation is ASCII text denoting
the explicitly authored output characters; it is not an expected-result sort.
In particular, the supplementary key sorts before U+FB33 by UTF-16 code units,
not after it by Unicode scalar value.

### Narrow Fixture Hashing

Only the five selected members `input`, `implementation`, `context`, `mapping`,
and `declaration` are passed to `asciiFixtureMemberBytes`. Each is a flat plain
object with nonempty printable-ASCII keys and printable-ASCII string values.
The helper sorts those ASCII keys, quotes ASCII strings with native JSON string
serialization, concatenates the object syntax, and hashes the resulting UTF-8.
It rejects arrays, nested objects, numbers, booleans, null, control characters,
and non-ASCII keys/values. Its own checks compare all five original member
preimages against independently authored literals and the published digests.

This helper is NOT a general JCS implementation or an oracle for the Unicode,
numeric, escaping, or whole-description diagnostic cases. No fields are stripped
from a selected member. No enclosing fixture, URL string, arbitrary fragment,
or path is substituted for the selected member's preimage. All changed fixtures
in this corpus stay inside the stated ASCII-string subset.

`basis`, when present, is the entire inline synthetic fixture object, not a
request field or a path to read. A subsequent harness must supply that snapshot
as caller-selected startup configuration for the case, not let a request change
a running consumer's trust configuration. Cases without `basis` use the frozen
public default fixture. Multiple order/amount declarations are separate valid
one-effect cases, never an unsupported collection or Cartesian product.

## Numeric and Resource Subsets

Canonical diagnostics support only JSON integer tokens in
`-9007199254740991..9007199254740991`. Fractions and exponent notation remain
`unsupported_profile/numeric_domain`, even `1e0`; this does not label those valid
JSON tokens malformed. Non-finite tokens, malformed JSON, decoded duplicate keys,
invalid UTF-8 and lone surrogates are `invalid_input/syntax`. Syntax is checked
completely before numeric support. Numeric `-0` becomes `0`; quantity string
`"-0"`, leading-zero and exponent quantity strings remain structurally invalid.
This is not full binary64 or full RFC 8785 numerical conformance.

Refund quantities remain exact strings in `0..999999999999`, USD, scale `"2"`.
Valid variants include coefficients `0`, `1`, `7300` and `999999999999`, with
multiple opaque order strings. Wrong represented amount/unit/scale is a
projection trust failure; a missing representation is a final-stage structural
failure. Absent fixture amount has an explicit quantity-unknown target and does
not invent zero. Negative/out-of-range fixture amounts are applicability failures.

Exactly one document is 1,048,577 bytes, one byte above 1 MiB, and still fits a
valid under-2-MiB adapter frame after base64 wrapping. Container boundaries are
64 accepted levels and 65 rejected levels, with root container depth one. The
entire generated file is constrained below 3 MiB. No large effect-count stress
sets, huge numeric tokens, invalid base64 wrappers, or oversized adapter frames
are generated.

## Coverage and Precedence

| Track | Cases | Primary contract coverage |
| --- | ---: | --- |
| `capabilities` | 1 | Offline capabilities, numeric domain, no acceptance cache or authority |
| `canonicalization` | 8 | Literal canonical bytes, UTF-16 ordering, safe integers, depth-64 boundary |
| `byte-validation` | 7 | UTF-8, BOM, surrogate strings/keys, decoded duplicate names, complete syntax |
| `numeric-domain` | 5 | Valid JSON outside the integer-token subset; precedence over version checks |
| `limits` | 2 | Depth 65 and raw bytes over 1 MiB are evaluation failures |
| `valid-declarations` | 8 | Reordered input, multiple bound orders/amounts, explicit missing quantity, inert metadata, exact Unicode IDs |
| `schema-and-version` | 11 | Missing/unsupported version, extra fields, quantity syntax/types, occurrence/target requirements, URI validation |
| `references` | 9 | Duplicate IDs/names/targets, dangling relation/evidence/quantity targets, known/unknown collision |
| `support` | 7 | Critical extensions, unknown profile, pinned digest, transitive/bounded/observed claims |
| `bindings` | 11 | Finite reference table, exact revision/source, all five member digests and bound extra input fields |
| `projection` | 7 | Coupled order/destination/amount/unit/scale, missing known/unknown quantity representation |
| `applicability` | 4 | Rebound but invalid amount/currency/implementation declarations |

Deliberately combined-defect cases fix the precedence rather than accepting any
rejection: syntax before unsupported numeric tokens; numeric support before
version/schema; unsupported string version before other missing fields; schema
before critical-extension handling; references before critical extensions;
critical extensions before profile lookup; profile lookup before profile digest;
profile digest before evidence scope; evidence scope before artifact binding;
and fixture applicability before a disagreeing effect projection.

The schema requires an `unknown_quantity.target`, so a missing target fails at
stage 4 as `invalid_input/structure`, before stage 5's reference rules. A present
but dangling/wrong/duplicate target fails as `invalid_input/references`. This is
resolved by the authoritative precedence, not an alternate acceptable result.
Likewise an observed effect without `occurrence_ref` is structurally invalid,
while an otherwise shaped observed claim is unsupported in this consumer.

## Limits of the Claim

No expected outcome in these cases depends on unresolved contract ambiguity.
The profile does not fully spell out the boundary between invalid startup
configuration and request-time applicability for arbitrarily malformed fixture
shapes. Such startup fixtures are intentionally excluded: applicability cases
retain all five object members and string field types, changing only domain
values explicitly described as applicability failures in the projection section.

The narrower consumer target does not implement observations or empty bounds;
their unsupported results are not positive evidence-checking or policy credit.
Adapter framing/recovery, startup failure behavior, general Unicode fixture
hashing, all schema maxima, unrestricted binary64, caching, CEL, signatures,
network isolation instrumentation, authority, provider state and execution are
not established by this corpus. Matching these cases cannot establish all
CORE-001..028 obligations or any external-independence claim.

## Reproduction

Use Node.js 22 or later, with no third-party packages. From the work root:

```sh
node action-effect-bench/conformance/case-source.mjs --write
node action-effect-bench/conformance/case-source.mjs --check
```

Paths are resolved from the generator's own file URL, so its absolute path also
works from another current directory. `--write` writes only `cases.json`;
`--check` is read-only and compares exact serialized bytes against fresh
generation. Both check the frozen public sources and authoring invariants, then
report counts, sizes, and the generated file SHA-256. Neither runs a consumer.

## Authoring Check Record

Node.js v22.18.0 generated 80 cases in 1,607,615 bytes. The generated corpus
SHA-256 is
`8fd3ef99d7137b383dc1a69388d6a23c6bba58e73e62672d88adbfa619ea6dce`.
The generation and byte-for-byte `--check` both passed the frozen-source,
fixture-preimage, unique-ID, expected-field, base64, canonical-hash, count, and
resource-budget assertions. These results describe the authoring tool only.

One additional scratch verification probe initially failed: it used
`Object.keys(JSON.parse(literal))` to inspect the UTF-16 vector's serialized key
order. Native JavaScript enumeration puts integer-like key `1` ahead of CR,
regardless of the correct raw-byte order. A minimal two-key reproduction
confirmed that probe defect. The correction checks raw byte positions directly;
native parsing is used only for value-equivalence checks, with negative zero
handled explicitly. No case input, expected canonical byte, expected outcome,
or generated corpus hash changed as a result. The corrected checks are included
in `verifySuite` so they can be repeated without a consumer.
