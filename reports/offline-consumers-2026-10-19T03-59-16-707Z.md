# Offline Consumer Comparison

Run: 2026-10-19T03:59:16.707Z. Status: PASS.

Exposed internal development cases, not external validation or full core conformance.
No live authorization decisions or real provider side effects. Timing includes process startup; no speed ranking.

JavaScript matches: 102/102. Python matches: 102/102.
Frozen public cases: 80. Additional post-review regressions: 22 (not independent samples).
Exact cross-implementation agreement: 102/102. Agreement alone is not correctness.
Adapter failures: JS 0, Python 0. Source snapshot unchanged: true.

The [JSON report](./offline-consumers-2026-10-19T03-59-16-707Z.json) contains source hashes, runtime versions, expected outcomes and exact responses.

| Case | JavaScript | Python | Agreement |
| --- | --- | --- | --- |
| hello-public-offline-profile | match | match | yes |
| canonical-utf16-key-order | match | match | yes |
| canonical-json-escaping | match | match | yes |
| canonical-safe-integer-endpoints | match | match | yes |
| canonical-negative-zero | match | match | yes |
| canonical-empty-containers | match | match | yes |
| canonical-recursive-keys-preserve-arrays | match | match | yes |
| canonical-no-unicode-normalization | match | match | yes |
| bytes-invalid-utf8 | match | match | yes |
| bytes-utf8-bom | match | match | yes |
| syntax-lone-high-surrogate-value | match | match | yes |
| syntax-lone-low-surrogate-key | match | match | yes |
| syntax-duplicate-decoded-key-before-numeric | match | match | yes |
| syntax-malformed-tail-before-numeric | match | match | yes |
| syntax-nonfinite-token | match | match | yes |
| numeric-fraction-unsupported | match | match | yes |
| numeric-exponent-unsupported-even-if-integral | match | match | yes |
| numeric-positive-unsafe-integer | match | match | yes |
| numeric-negative-unsafe-integer | match | match | yes |
| canonical-depth-64-boundary | match | match | yes |
| limit-container-depth-65 | match | match | yes |
| limit-document-one-byte-over-1mib | match | match | yes |
| numeric-domain-before-version-and-structure | match | match | yes |
| refund-public-example | match | match | yes |
| refund-reordered-object-members | match | match | yes |
| refund-other-order-zero | match | match | yes |
| refund-case-distinct-order-one | match | match | yes |
| refund-other-order-maximum | match | match | yes |
| refund-absent-amount-explicit-unknown | match | match | yes |
| refund-bound-inert-commandlike-metadata | match | match | yes |
| refund-exact-unicode-local-identifiers | match | match | yes |
| structure-missing-spec-version | match | match | yes |
| version-unsupported-before-other-missing-fields | match | match | yes |
| structure-extra-member-before-critical-extension | match | match | yes |
| structure-quantity-negative-zero-string | match | match | yes |
| structure-quantity-leading-zero-string | match | match | yes |
| structure-quantity-exponent-string | match | match | yes |
| structure-quantity-json-number | match | match | yes |
| structure-observed-without-occurrence | match | match | yes |
| structure-unknown-quantity-without-target | match | match | yes |
| structure-uri-malformed-percent-escape | match | match | yes |
| structure-profile-uri-is-relative | match | match | yes |
| references-duplicate-effects-before-critical | match | match | yes |
| references-duplicate-evidence-identifiers | match | match | yes |
| references-dangling-relation-endpoint | match | match | yes |
| references-dangling-effect-evidence | match | match | yes |
| references-duplicate-quantity-names | match | match | yes |
| references-unknown-quantity-dangling-effect | match | match | yes |
| references-unknown-quantity-wrong-name | match | match | yes |
| references-duplicate-unknown-quantity-targets | match | match | yes |
| references-quantity-both-known-and-unknown | match | match | yes |
| support-critical-before-unknown-profile | match | match | yes |
| support-unknown-profile-before-profile-digest | match | match | yes |
| trust-profile-digest-before-evidence-scope | match | match | yes |
| support-transitive-coverage | match | match | yes |
| support-empty-bounded-claim | match | match | yes |
| support-observed-with-occurrence | match | match | yes |
| support-observation-evidence-before-artifact-binding | match | match | yes |
| binding-invocation-not-json-pointer | match | match | yes |
| binding-implementation-no-path-normalization | match | match | yes |
| binding-context-reference-case-sensitive | match | match | yes |
| binding-mapping-revision-is-exact | match | match | yes |
| binding-declaration-artifact-reference | match | match | yes |
| binding-full-input-member-includes-extra-string | match | match | yes |
| binding-implementation-digest-mismatch | match | match | yes |
| binding-context-digest-mismatch | match | match | yes |
| binding-mapping-digest-mismatch | match | match | yes |
| binding-declaration-digest-mismatch | match | match | yes |
| binding-evidence-source-exact-no-uri-normalization | match | match | yes |
| projection-order-is-case-sensitive | match | match | yes |
| projection-destination-mismatch | match | match | yes |
| projection-amount-mismatch | match | match | yes |
| projection-no-currency-conversion | match | match | yes |
| projection-no-scale-conversion | match | match | yes |
| projection-missing-known-amount-representation | match | match | yes |
| projection-missing-unknown-amount-representation | match | match | yes |
| applicability-negative-refund-amount | match | match | yes |
| applicability-refund-above-profile-maximum | match | match | yes |
| applicability-unsupported-fixture-currency | match | match | yes |
| applicability-implementation-version-is-not-a-range | match | match | yes |
| review-known-amount-replaced-by-unknown | match | match | yes |
| review-required-amount-name-absent | match | match | yes |
| review-invalid-uri-1 | match | match | yes |
| review-invalid-uri-2 | match | match | yes |
| review-invalid-uri-3 | match | match | yes |
| review-invalid-uri-4 | match | match | yes |
| review-invalid-uri-5 | match | match | yes |
| review-invalid-uri-6 | match | match | yes |
| review-invalid-uri-7 | match | match | yes |
| review-invalid-uri-8 | match | match | yes |
| review-invalid-uri-9 | match | match | yes |
| review-invalid-uri-10 | match | match | yes |
| review-invalid-uri-11 | match | match | yes |
| review-invalid-uri-12 | match | match | yes |
| review-valid-generic-uri-1 | match | match | yes |
| review-valid-generic-uri-2 | match | match | yes |
| review-valid-generic-uri-3 | match | match | yes |
| review-valid-generic-uri-4 | match | match | yes |
| review-valid-generic-uri-5 | match | match | yes |
| review-valid-generic-uri-6 | match | match | yes |
| review-valid-generic-uri-7 | match | match | yes |
| review-valid-generic-uri-8 | match | match | yes |
