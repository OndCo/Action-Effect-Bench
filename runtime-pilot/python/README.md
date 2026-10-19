# Independent Python GitHub Profile Consumer

This is an offline implementation of the GitHub issue-comment profile, derived
from its normative README and manifest and the original core SPEC/schema. The
initial implementation was completed before JavaScript mapper exposure. Later
internal review exposed the JavaScript integration, and subsequent fixes are
exposed development, not fresh independent validation. The benchmark case corpus
has not been consulted or changed by this implementation worker.

Python 3.9 or later and the standard library are sufficient. The sibling
`action-effect-spec` checkout must remain beside `action-effect-bench`. Only its
unchanged `offline_consumer` JSON/canonicalization, schema/URI validation,
local-reference validation, and rejection utilities are imported. Its domain adapter, projection, consumer,
configuration, and test vectors are not used. The normative profile manifest is
loaded from a fixed local path, never from request data or a remote reference.

## Protocol

From the benchmark checkout:

```sh
python3 runtime-pilot/python/consumer.py
```

The CLI reads UTF-8 JSON lines and writes one JSON result per input line. EOF
without a final newline is supported; an empty stream produces no results.

Requests have `op`, `native`, and `context` members. `check` additionally takes a
`description` member. Unknown request members and operations are rejected.

- `project` validates the complete native SDK/MCP semantics and the required
  context, then returns the structured projection. It is a context-aware
  baseline, not a tool-name-only approximation or an authorizer.
- `check` uses the same native/context validation, validates the supplied
  description against the original core shape and local-reference rules, checks
  required quantities and extension semantics, and constructs every expected
  profile field. The complete canonical descriptions must match. No coverage,
  evidence, unknown, binding, extension, or extra array entry is ignored.

Accepted results contain `status: accepted_partial`, `reason: declared_partial`,
`authority: not_evaluated`, and `projection`. A successful `check` also contains
`description_digest`, a lowercase SHA-256 hex string of the complete canonical
description. Equivalent SDK/MCP invocations have equal projections but different
native-envelope and full-description digests.

Context extensions are allowed and bound in full, although only `data_class`
appears in the projection. Principal and classification are supplied facts, not
authentication or DLP. Repository case, Unicode body text, and array ordering are
preserved exactly. No policy, OPA evaluator, network request, invocation dispatch,
observation, or remote reference resolution occurs. Bytecode writes are disabled.

## Bounds And Failures

Each JSON payload is limited to 1 MiB, excluding its LF or CRLF terminator, and
64 container nesting levels. Reads are bounded; oversized lines produce one
`evaluation_failure/limit_exceeded` result, are drained in bounded chunks, and do
not desynchronize later lines. Native bodies are limited to 8192 UTF-8 bytes and
issue numbers to 1 through 2147483647, excluding booleans.

The unchanged core validator also limits effects/evidence/unknowns to 256 each,
relations to 1024, quantities per effect to 64, quantity magnitudes to 78 digits,
and assumptions/critical extensions/extension payload keys to 64 each. Original
core shape violations are `invalid_input/structure`.

Malformed UTF-8, duplicate names, malformed JSON, and non-finite constants produce
`invalid_input/syntax`. A bounded syntax-only request pass first leaves escaped
surrogates and unsupported numeric values available for native validation. Native
field violations, including fractional/exponent issue-number tokens, unsafe
integers, and lone-surrogate strings, produce `invalid_input/native_input`.

Context facts are checked next, including Unicode-scalar validity of principal,
classification, and implementation. Missing or malformed required facts produce
`untrusted_evidence/missing_context`; a different valid implementation produces
`untrusted_evidence/implementation_binding`. Otherwise the complete context must
be canonicalizable: unsupported numbers or scalar errors in extra context fields
produce `invalid_input/native_input`, including in `project` mode.

After native/context validation, the same raw bytes are reparsed with the
unchanged core parser before any acceptance, projection, or digest construction.
Effect descriptions retain the core's Unicode-scalar and integer-token-only
rules: invalid scalars produce `invalid_input/syntax`, and fractional/exponent
tokens or unsafe integers produce `unsupported_profile/numeric_domain`. The
syntax-only intermediate representation is never hashed or accepted. Finite
size/depth limit failures are operational failures, not semantic denials.

Another otherwise shaped MCP tool is `unsupported_profile/operation`. After core
shape validation, duplicate effect/evidence IDs, duplicate quantity names,
dangling references, and inconsistent unknown-quantity targets produce
`invalid_input/references`. Missing required quantities without a matching
unknown target, missing critical body-digest declarations, and missing/malformed
required payloads produce `invalid_input/structure`. Unknown critical extensions
produce `unsupported_profile/critical_extension`; they are never stripped or
retried. Only well-formed, locally consistent concrete descriptor mismatches
produce `untrusted_evidence/description_binding`.
Unexpected parser/checker/dependency failures are
`evaluation_failure/internal_error`, never successful review or binding rejection.
Error results contain no input content, exception details, or tracebacks.

Acceptance retains the explicit unknown provider descendants and grants no
authority. This narrow experiment checks core shape, local integrity, and this
exact profile descriptor, not arbitrary profiles or full general-purpose core
conformance.

## Verification

```sh
python3 -B -W error -m unittest discover -s runtime-pilot/tests -p test_python_profile.py -v
```

Tests construct their own descriptors from the normative contract; they do not
call the implementation's descriptor builder for expected values. Coverage
includes native boundaries, UTF-8 and canonical ordering, both lanes, complete
context binding, tampering across every concrete field, reference and extension
error semantics, malformed JSON, stream limits/recovery, failure redaction, and
no network/execution.

TDD evidence: the initial 27 tests failed before implementation, then passed.
A startup-dependency regression test subsequently failed on an exposed traceback;
after the fix, all 30 tests passed. The later exposed native-error-classification
fix first produced 30 failed assertions across four regression tests; all 37
tests then passed, including unchanged strict-core guard tests. The context
follow-up produced 46 failed assertions across 41 tests. Adding independent core
reference/extension regressions and operational-error guards then produced 86
failed assertions across 50 tests; after the production fixes, all 50 passed
with warnings treated as errors. The original offline report and frozen expected
data were not rewritten. No commit or push is part of this work.
