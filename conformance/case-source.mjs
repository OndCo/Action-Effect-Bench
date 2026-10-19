// Public development vectors, authored from the frozen public contract only.
// No consumer, candidate canonicalizer, network client, or subprocess is used.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../', import.meta.url);
const OUTPUT = new URL('./cases.json', import.meta.url);
const MIB = 1024 * 1024;
const VERSION = 'offline-consumer-v1';
const CLASSIFICATION = 'public-development-not-independent-external';
const PROFILE = 'https://example.org/profiles/refund/0.1.0-draft.1';
const PROFILE_DIGEST = 'dddac40519b57620ca8b6fec558746ed8fb1f6ddf77263fd93cf5b2b582f2e00';
const AMOUNT = 'https://example.org/quantities/amount';
const MARKER = 'https://example.org/extensions/public-development-marker/1';
const ZERO_DIGEST = '0'.repeat(64);

// Raw-file SHA-256, not canonical JSON digests. Abort on source drift.
const REVIEWED_SOURCES = [
  ['action-effect-spec/SPEC.md', '7e391c1ac5f1ed6edcf85a39aa39a1a2e852678da67baf3691927daa807ddca6'],
  ['action-effect-spec/schemas/effect-description.schema.json', '0bb7797509174f2f24f534e76ac302fe6ed92e28dcd1e6b92322b2bf1abdbe5e'],
  ['action-effect-spec/conformance/consumer-profile-v1.md', '140eeec0b16b291519df90182eecbff7bc50efddc2e9a3f6a0d47db804d0538c'],
  ['action-effect-spec/examples/refund-profile.json', '6d8ea42431f7c4d61e0d37d6001767128cad5b23e5cd252afdee63c606ef25ce'],
  ['action-effect-spec/examples/binding-profile.md', '50a6595feca35e49f17949570e6e16d2ea7510ad912f6ce69e640ab2be3421c4'],
  ['action-effect-spec/examples/partial-refund.json', 'e4af7ed8add434febe59619e24d305ad8829074c8413b4ea1df0761d2b1742d4'],
  ['action-effect-spec/examples/synthetic-basis.json', '62037bd66852b603b6cb82e6499c1e4c3d36fcad27a4b3796fa49d5633a8662c'],
];

// Independently written, literal member preimages check the narrow fixture helper.
const FIXTURE_PREIMAGES = {
  input: '{"amount_minor":"7300","currency":"USD","operation":"refund","order":"order-42"}',
  implementation: '{"name":"synthetic-refund-tool","version":"1.0.0","visibility":"declared"}',
  context: '{"account":"merchant-demo","destination":"original-payment","environment":"synthetic"}',
  mapping: '{"id":"https://example.org/mappings/refund","revision":"1","semantics":"possible refund to the original payment destination; downstream coverage partial"}',
  declaration: '{"claim":"editorial example only; not an observation or accepted completeness proof","issuer":"https://example.org/synthetic-issuer"}',
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function reviewedBytes() {
  return new Map(REVIEWED_SOURCES.map(([path, digest]) => {
    const bytes = readFileSync(new URL(path, ROOT));
    assert.equal(sha256(bytes), digest, `Reviewed public source changed: ${path}`);
    return [path, bytes];
  }));
}

// NOT general JCS: flat objects, nonempty printable-ASCII keys, and only
// printable-ASCII string values. No arrays, nested objects, numbers or Unicode.
// Sorting and JSON string quoting agree with JCS only within this narrow scope.
function asciiFixtureMemberBytes(member) {
  assert(member !== null && Object.getPrototypeOf(member) === Object.prototype,
    'Fixture hash helper requires a plain flat object');
  const fields = Object.keys(member).sort().map((key) => {
    assert(/^[\x20-\x7e]+$/.test(key), 'Fixture key must be printable ASCII');
    const value = member[key];
    assert(typeof value === 'string' && /^[\x20-\x7e]*$/.test(value),
      'Fixture value must be a printable ASCII string');
    return `${JSON.stringify(key)}:${JSON.stringify(value)}`;
  });
  return Buffer.from(`{${fields.join(',')}}`, 'utf8');
}

function rebindFixture(document, basis) {
  for (const member of ['input', 'implementation', 'context', 'mapping']) {
    const field = member === 'input' ? 'invocation' : member;
    document[field].digest.value = sha256(asciiFixtureMemberBytes(basis[member]));
  }
  const digest = sha256(asciiFixtureMemberBytes(basis.declaration));
  for (const item of document.evidence) item.artifact_digest.value = digest;
}

function failure(status, reason) {
  return { status, reason, authority: 'not_evaluated' };
}

function accepted(unresolvedCount = 1) {
  return {
    status: 'accepted_partial',
    reason: 'declared_partial',
    authority: 'not_evaluated',
    effect_count: 1,
    unresolved_count: unresolvedCount,
  };
}

function unknownQuantity(effectId = 'effect-1', name = AMOUNT) {
  return {
    code: 'unknown_quantity',
    scope: 'Required refund amount is explicitly unresolved',
    target: { effect_id: effectId, quantity_name: name },
  };
}

// This only permutes INPUT member order. It is not used for expected bytes.
function reverseInputMembers(value) {
  if (Array.isArray(value)) return value.map(reverseInputMembers);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse()
      .map(([key, item]) => [key, reverseInputMembers(item)]));
  }
  return value;
}

function verifyFixtureHelper(seed, basis) {
  for (const [member, literal] of Object.entries(FIXTURE_PREIMAGES)) {
    assert.equal(asciiFixtureMemberBytes(basis[member]).toString('utf8'), literal);
    const published = member === 'declaration'
      ? seed.evidence[0].artifact_digest.value
      : seed[member === 'input' ? 'invocation' : member].digest.value;
    assert.equal(sha256(Buffer.from(literal, 'utf8')), published);
  }
  for (const outsideScope of [null, [], { x: 1 }, { x: true }, { x: {} },
    { x: [] }, { x: '\u00e9' }, { '\u00e9': 'x' }, { x: '\n' }]) {
    assert.throws(() => asciiFixtureMemberBytes(outsideScope));
  }
}

export function buildSuite() {
  const sources = reviewedBytes();
  const exampleBytes = sources.get('action-effect-spec/examples/partial-refund.json');
  const seed = JSON.parse(exampleBytes.toString('utf8'));
  const seedBasis = JSON.parse(sources.get('action-effect-spec/examples/synthetic-basis.json').toString('utf8'));
  assert.equal(seed.profile, PROFILE);
  assert.equal(seed.profile_digest.value, PROFILE_DIGEST);
  verifyFixtureHelper(seed, seedBasis);
  const cases = [];

  function raw(id, track, requirements, op, input, expected, basis) {
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
    const item = { id, track, requirements, document_b64: bytes.toString('base64'), op, expected };
    if (basis !== undefined) item.basis = basis;
    cases.push(item);
  }

  function check(id, track, requirements, document, expected, basis) {
    // Native serialization is for description INPUT, never its expected digest.
    raw(id, track, requirements, 'check', JSON.stringify(document), expected, basis);
  }

  function mutation(id, track, requirements, expected, change) {
    const document = structuredClone(seed);
    change(document);
    check(id, track, requirements, document, expected);
  }

  function boundCase(id, track, requirements, expected, change, afterBinding) {
    const document = structuredClone(seed);
    const basis = structuredClone(seedBasis);
    change(basis, document);
    rebindFixture(document, basis);
    if (afterBinding) afterBinding(document);
    check(id, track, requirements, document, expected, basis);
  }

  function canonical(id, input, literalExpected, requirements = ['CORE-009', 'CORE-012']) {
    const bytes = Buffer.from(literalExpected, 'utf8');
    raw(id, 'canonicalization', requirements, 'canonicalize', input, {
      status: 'canonicalized',
      reason: 'supported_subset',
      authority: 'not_evaluated',
      canonical_b64: bytes.toString('base64'),
      sha256: sha256(bytes),
    });
  }

  // 01: Capability advertisement is not an authority decision.
  cases.push({
    id: 'hello-public-offline-profile',
    track: 'capabilities',
    requirements: ['CORE-001', 'CORE-020', 'CORE-023', 'CORE-028'],
    op: 'hello',
    expected: {
      status: 'capabilities',
      reason: 'offline_snapshot',
      authority: 'not_evaluated',
      spec_version: '0.1.0-draft.1',
      profile: PROFILE,
      numeric_domain: 'safe_integer_tokens_only',
      acceptance_cache: false,
    },
  });

  // 02..08: Expected canonical text below is authored literally, never sorted
  // or serialized from parsed inputs. JS Unicode escapes denote actual UTF-8.
  canonical('canonical-utf16-key-order',
    String.raw`{"\ufb33":"bmp","\ud83d\ude00":"astral","\u20ac":"euro","\u00f6":"o","\u0080":"control","1":"one","\r":"CR"}`,
    '{"\\r":"CR","1":"one","\u0080":"control","\u00f6":"o","\u20ac":"euro","\ud83d\ude00":"astral","\ufb33":"bmp"}');

  canonical('canonical-json-escaping',
    String.raw`{"s":"\u0022\u005c\/\u0008\u0009\u000a\u000c\u000d\u0000\u000f\u001F\u2028\u2029"}`,
    '{"s":"\\"\\\\/\\b\\t\\n\\f\\r\\u0000\\u000f\\u001f\u2028\u2029"}');

  canonical('canonical-safe-integer-endpoints',
    ' { "positive": 9007199254740991, "negative": -9007199254740991, "large": 2147483648 } ',
    '{"large":2147483648,"negative":-9007199254740991,"positive":9007199254740991}');

  canonical('canonical-negative-zero', '[ -0, 0, -0 ]', '[0,0,0]');

  canonical('canonical-empty-containers',
    ' { "c": [ { }, [ ] ], "b": { }, "a": [ ] } ',
    '{"a":[],"b":{},"c":[{},[]]}');

  canonical('canonical-recursive-keys-preserve-arrays',
    '{"z":[{"b":2,"a":1},3,2,1],"2":"two","10":"ten","a":{"z":false,"a":null}}',
    '{"10":"ten","2":"two","a":{"a":null,"z":false},"z":[{"a":1,"b":2},3,2,1]}');

  canonical('canonical-no-unicode-normalization',
    String.raw`{"\u00e9":"\u00e9","e\u0301":"e\u0301"}`,
    '{"e\u0301":"e\u0301","\u00e9":"\u00e9"}');

  // 09..15: Complete syntax is checked before unsupported numeric tokens.
  raw('bytes-invalid-utf8', 'byte-validation', ['CORE-009'], 'canonicalize',
    Buffer.from([0x22, 0xc3, 0x28, 0x22]), failure('invalid_input', 'syntax'));
  raw('bytes-utf8-bom', 'byte-validation', ['CORE-009'], 'canonicalize',
    Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), failure('invalid_input', 'syntax'));
  raw('syntax-lone-high-surrogate-value', 'byte-validation', ['CORE-009'], 'canonicalize',
    String.raw`"\ud800"`, failure('invalid_input', 'syntax'));
  raw('syntax-lone-low-surrogate-key', 'byte-validation', ['CORE-009'], 'canonicalize',
    String.raw`{"\udfff":0}`, failure('invalid_input', 'syntax'));
  raw('syntax-duplicate-decoded-key-before-numeric', 'byte-validation', ['CORE-009'], 'canonicalize',
    String.raw`{"a":1e0,"\u0061":2}`, failure('invalid_input', 'syntax'));
  raw('syntax-malformed-tail-before-numeric', 'byte-validation', ['CORE-009'], 'canonicalize',
    '[1e0,]', failure('invalid_input', 'syntax'));
  raw('syntax-nonfinite-token', 'byte-validation', ['CORE-009'], 'canonicalize',
    '{"n":NaN}', failure('invalid_input', 'syntax'));

  // 16..19: These are valid JSON tokens, outside this consumer's numeric subset.
  for (const [id, input] of [
    ['numeric-fraction-unsupported', '1.5'],
    ['numeric-exponent-unsupported-even-if-integral', '1e0'],
    ['numeric-positive-unsafe-integer', '9007199254740992'],
    ['numeric-negative-unsafe-integer', '-9007199254740992'],
  ]) {
    raw(id, 'numeric-domain', ['CORE-009', 'CORE-012', 'CORE-023'], 'canonicalize',
      input, failure('unsupported_profile', 'numeric_domain'));
  }

  // 20..22: Root container depth is one. Only one document exceeds 1 MiB.
  const depth64Literal = '['.repeat(64) + '0' + ']'.repeat(64);
  canonical('canonical-depth-64-boundary', depth64Literal, depth64Literal,
    ['CORE-009', 'CORE-012', 'CORE-024']);
  raw('limit-container-depth-65', 'limits', ['CORE-024'], 'canonicalize',
    '['.repeat(65) + '0' + ']'.repeat(65), failure('evaluation_failure', 'limit_exceeded'));
  raw('limit-document-one-byte-over-1mib', 'limits', ['CORE-024'], 'canonicalize',
    '"' + 'x'.repeat(MIB - 1) + '"', failure('evaluation_failure', 'limit_exceeded'));

  // 23: Numeric support is considered before the version/root-shape stages.
  raw('numeric-domain-before-version-and-structure', 'numeric-domain',
    ['CORE-009', 'CORE-023'], 'check', '{"spec_version":"future","n":1e0}',
    failure('unsupported_profile', 'numeric_domain'));

  // 24..31: Separate fixture snapshots, not a multi-effect collection profile.
  raw('refund-public-example', 'valid-declarations',
    ['CORE-001', 'CORE-008', 'CORE-010', 'CORE-014'], 'check', exampleBytes, accepted());
  check('refund-reordered-object-members', 'valid-declarations',
    ['CORE-009', 'CORE-014'], reverseInputMembers(seed), accepted());

  for (const [id, order, amount] of [
    ['refund-other-order-zero', 'order-zero', '0'],
    ['refund-case-distinct-order-one', 'ORDER-42', '1'],
    ['refund-other-order-maximum', 'order-maximum', '999999999999'],
  ]) {
    boundCase(id, 'valid-declarations', ['CORE-003', 'CORE-010', 'CORE-011', 'CORE-014'],
      accepted(), (basis, document) => {
        basis.input.order = order;
        basis.input.amount_minor = amount;
        document.effects[0].resource.value = order;
        document.effects[0].quantities[0].value = amount;
      });
  }

  boundCase('refund-absent-amount-explicit-unknown', 'valid-declarations',
    ['CORE-004', 'CORE-008', 'CORE-010', 'CORE-014'], accepted(2), (basis, document) => {
      delete basis.input.amount_minor;
      document.effects[0].quantities = [];
      document.unknowns.push(unknownQuantity());
    });

  boundCase('refund-bound-inert-commandlike-metadata', 'valid-declarations',
    ['CORE-001', 'CORE-012', 'CORE-023', 'CORE-025'], accepted(), (basis, document) => {
      basis.input.note = 'printf "data only"; $(true)';
      basis.mapping.semantics = 'Declaration text only: printf "not executed"';
      document.extensions['https://example.org/extensions/inert-metadata/1'] = {
        command: 'printf "still only data"',
        verified: true,
        comment: 'This noncritical metadata grants no authority or wider coverage',
      };
    });

  mutation('refund-exact-unicode-local-identifiers', 'valid-declarations',
    ['CORE-004', 'CORE-009', 'CORE-011'], accepted(), (document) => {
      const first = document.evidence[0];
      first.evidence_id = 'decl-\u00e9';
      const second = structuredClone(first);
      second.evidence_id = 'decl-e\u0301';
      document.evidence.push(second);
      document.effects[0].effect_id = 'refund-\ud83d\ude00';
      document.coverage.evidence_refs = [first.evidence_id];
      document.effects[0].evidence_refs = [second.evidence_id];
    });

  // 32..42: Ordered version/schema checks, not policy outcomes.
  check('structure-missing-spec-version', 'schema-and-version', ['CORE-009', 'CORE-023'],
    {}, failure('invalid_input', 'structure'));
  check('version-unsupported-before-other-missing-fields', 'schema-and-version', ['CORE-023'],
    { spec_version: '0.2.0' }, failure('unsupported_profile', 'spec_version'));
  mutation('structure-extra-member-before-critical-extension', 'schema-and-version',
    ['CORE-009', 'CORE-023'], failure('invalid_input', 'structure'), (document) => {
      document.unexpected_member = true;
      document.critical_extensions = [MARKER];
    });
  for (const [id, value] of [
    ['structure-quantity-negative-zero-string', '-0'],
    ['structure-quantity-leading-zero-string', '07300'],
    ['structure-quantity-exponent-string', '73e2'],
    ['structure-quantity-json-number', 7300],
  ]) {
    mutation(id, 'schema-and-version', ['CORE-010'], failure('invalid_input', 'structure'),
      (document) => { document.effects[0].quantities[0].value = value; });
  }
  mutation('structure-observed-without-occurrence', 'schema-and-version',
    ['CORE-006', 'CORE-027'], failure('invalid_input', 'structure'), (document) => {
      document.effects[0].modality = 'observed';
    });
  mutation('structure-unknown-quantity-without-target', 'schema-and-version',
    ['CORE-004', 'CORE-010'], failure('invalid_input', 'structure'), (document) => {
      document.effects[0].quantities = [];
      document.unknowns.push({ code: 'unknown_quantity', scope: 'Missing target, not a valid unknown' });
    });
  mutation('structure-uri-malformed-percent-escape', 'schema-and-version',
    ['CORE-009'], failure('invalid_input', 'structure'), (document) => {
      document.record_id = 'https://example.org/descriptions/%GG';
    });
  mutation('structure-profile-uri-is-relative', 'schema-and-version',
    ['CORE-009', 'CORE-011'], failure('invalid_input', 'structure'), (document) => {
      document.profile = 'profiles/refund/0.1.0-draft.1';
    });

  // 43..51: Exact local identity resolution precedes support/trust decisions.
  mutation('references-duplicate-effects-before-critical', 'references',
    ['CORE-004', 'CORE-023'], failure('invalid_input', 'references'), (document) => {
      document.effects.push(structuredClone(document.effects[0]));
      document.critical_extensions = [MARKER];
    });
  mutation('references-duplicate-evidence-identifiers', 'references',
    ['CORE-004'], failure('invalid_input', 'references'), (document) => {
      document.evidence.push(structuredClone(document.evidence[0]));
    });
  mutation('references-dangling-relation-endpoint', 'references',
    ['CORE-004'], failure('invalid_input', 'references'), (document) => {
      document.relations.push({
        from: 'effect-1', to: 'missing-effect',
        kind: 'https://example.org/relations/may-trigger/1', evidence_refs: ['decl-1'],
      });
    });
  mutation('references-dangling-effect-evidence', 'references',
    ['CORE-004', 'CORE-015'], failure('invalid_input', 'references'), (document) => {
      document.effects[0].evidence_refs = ['missing-declaration'];
    });
  mutation('references-duplicate-quantity-names', 'references',
    ['CORE-010'], failure('invalid_input', 'references'), (document) => {
      document.effects[0].quantities.push(structuredClone(document.effects[0].quantities[0]));
    });
  mutation('references-unknown-quantity-dangling-effect', 'references',
    ['CORE-004', 'CORE-010'], failure('invalid_input', 'references'), (document) => {
      document.effects[0].quantities = [];
      document.unknowns.push(unknownQuantity('missing-effect'));
    });
  mutation('references-unknown-quantity-wrong-name', 'references',
    ['CORE-004', 'CORE-010'], failure('invalid_input', 'references'), (document) => {
      document.effects[0].quantities = [];
      document.unknowns.push(unknownQuantity('effect-1', 'https://example.org/quantities/tax'));
    });
  mutation('references-duplicate-unknown-quantity-targets', 'references',
    ['CORE-004', 'CORE-010'], failure('invalid_input', 'references'), (document) => {
      document.effects[0].quantities = [];
      document.unknowns.push(unknownQuantity(), unknownQuantity());
    });
  mutation('references-quantity-both-known-and-unknown', 'references',
    ['CORE-010'], failure('invalid_input', 'references'), (document) => {
      document.unknowns.push(unknownQuantity());
    });

  // 52..58: Structurally valid unsupported claims are not malformed input.
  mutation('support-critical-before-unknown-profile', 'support',
    ['CORE-023'], failure('unsupported_profile', 'critical_extension'), (document) => {
      document.critical_extensions = [MARKER];
      document.profile = 'https://example.org/profiles/not-configured/1';
    });
  mutation('support-unknown-profile-before-profile-digest', 'support',
    ['CORE-011', 'CORE-023'], failure('unsupported_profile', 'profile'), (document) => {
      document.profile = 'https://example.org/profiles/not-configured/1';
      document.profile_digest.value = ZERO_DIGEST;
    });
  mutation('trust-profile-digest-before-evidence-scope', 'support',
    ['CORE-007', 'CORE-011'], failure('untrusted_evidence', 'profile_binding'), (document) => {
      document.profile_digest.value = ZERO_DIGEST;
      document.coverage.completeness = 'bounded_claim';
    });
  mutation('support-transitive-coverage', 'support',
    ['CORE-006'], failure('unsupported_profile', 'evidence_scope'), (document) => {
      document.coverage.scope = 'transitive';
    });
  mutation('support-empty-bounded-claim', 'support',
    ['CORE-005', 'CORE-007'], failure('unsupported_profile', 'evidence_scope'), (document) => {
      document.coverage.completeness = 'bounded_claim';
      document.effects = [];
      document.unknowns = [];
    });
  mutation('support-observed-with-occurrence', 'support',
    ['CORE-006', 'CORE-027'], failure('unsupported_profile', 'evidence_scope'), (document) => {
      document.effects[0].modality = 'observed';
      document.effects[0].occurrence_ref = 'synthetic-occurrence-only';
    });
  mutation('support-observation-evidence-before-artifact-binding', 'support',
    ['CORE-015', 'CORE-027'], failure('unsupported_profile', 'evidence_scope'), (document) => {
      document.evidence[0].kind = 'observation';
      document.evidence[0].artifact_ref = 'https://example.org/unlisted-observation';
    });

  // 59..69: Finite, opaque reference table and complete selected-member digests.
  for (const [id, field, reference] of [
    ['binding-invocation-not-json-pointer', 'invocation', 'synthetic-basis.json#/input'],
    ['binding-implementation-no-path-normalization', 'implementation', './synthetic-basis.json#implementation'],
    ['binding-context-reference-case-sensitive', 'context', 'synthetic-basis.json#Context'],
  ]) {
    mutation(id, 'bindings', ['CORE-011', 'CORE-012', 'CORE-014', 'CORE-025'],
      failure('untrusted_evidence', 'artifact_binding'), (document) => {
        document[field].reference = reference;
      });
  }
  mutation('binding-mapping-revision-is-exact', 'bindings',
    ['CORE-013', 'CORE-014'], failure('untrusted_evidence', 'artifact_binding'), (document) => {
      document.mapping.revision = '01';
    });
  mutation('binding-declaration-artifact-reference', 'bindings',
    ['CORE-012', 'CORE-015', 'CORE-025'], failure('untrusted_evidence', 'artifact_binding'), (document) => {
      document.evidence[0].artifact_ref = 'https://example.org/local-fixtures/synthetic-basis#/declaration';
    });
  boundCase('binding-full-input-member-includes-extra-string', 'bindings',
    ['CORE-012', 'CORE-014'], failure('untrusted_evidence', 'artifact_binding'), (basis) => {
      basis.input.note = 'This extra input string is part of the selected member';
    }, (document) => {
      // Deliberately restore the old digest: it omits the newly bound member.
      document.invocation.digest.value = seed.invocation.digest.value;
    });
  for (const field of ['implementation', 'context', 'mapping']) {
    mutation(`binding-${field}-digest-mismatch`, 'bindings', ['CORE-012', 'CORE-014'],
      failure('untrusted_evidence', 'artifact_binding'), (document) => {
        document[field].digest.value = ZERO_DIGEST;
      });
  }
  mutation('binding-declaration-digest-mismatch', 'bindings',
    ['CORE-012', 'CORE-015'], failure('untrusted_evidence', 'artifact_binding'), (document) => {
      document.evidence[0].artifact_digest.value = ZERO_DIGEST;
    });
  mutation('binding-evidence-source-exact-no-uri-normalization', 'bindings',
    ['CORE-002', 'CORE-011', 'CORE-015'], failure('untrusted_evidence', 'artifact_binding'), (document) => {
      document.evidence[0].source = 'https://EXAMPLE.ORG/synthetic-issuer';
    });

  // 70..76: Bound components do not establish a matching semantic projection.
  mutation('projection-order-is-case-sensitive', 'projection',
    ['CORE-003', 'CORE-011', 'CORE-014'], failure('untrusted_evidence', 'effect_projection'), (document) => {
      document.effects[0].resource.value = 'ORDER-42';
    });
  mutation('projection-destination-mismatch', 'projection',
    ['CORE-003', 'CORE-014'], failure('untrusted_evidence', 'effect_projection'), (document) => {
      document.effects[0].destination.value = 'different-payment';
    });
  for (const [id, field, value] of [
    ['projection-amount-mismatch', 'value', '7301'],
    ['projection-no-currency-conversion', 'unit', 'EUR'],
    ['projection-no-scale-conversion', 'scale', '3'],
  ]) {
    mutation(id, 'projection', ['CORE-003', 'CORE-010', 'CORE-014'],
      failure('untrusted_evidence', 'effect_projection'), (document) => {
        document.effects[0].quantities[0][field] = value;
      });
  }
  mutation('projection-missing-known-amount-representation', 'projection',
    ['CORE-010'], failure('invalid_input', 'structure'), (document) => {
      document.effects[0].quantities = [];
    });
  boundCase('projection-missing-unknown-amount-representation', 'projection',
    ['CORE-008', 'CORE-010'], failure('invalid_input', 'structure'), (basis, document) => {
      delete basis.input.amount_minor;
      document.effects[0].quantities = [];
    });

  // 77..80: These retain all five object members and ASCII string value types.
  // Rebound hashes do not make semantically inapplicable fixture values usable.
  for (const [id, member, field, value, requirements] of [
    ['applicability-negative-refund-amount', 'input', 'amount_minor', '-1', ['CORE-010', 'CORE-013']],
    ['applicability-refund-above-profile-maximum', 'input', 'amount_minor', '1000000000000', ['CORE-010', 'CORE-013']],
    ['applicability-unsupported-fixture-currency', 'input', 'currency', 'EUR', ['CORE-010', 'CORE-013']],
    ['applicability-implementation-version-is-not-a-range', 'implementation', 'version', '1.0.1', ['CORE-013']],
  ]) {
    boundCase(id, 'applicability', requirements, failure('untrusted_evidence', 'applicability'),
      (basis) => { basis[member][field] = value; });
  }

  return { version: VERSION, classification: CLASSIFICATION, cases };
}

// Authoring-integrity checks only. They neither evaluate a description nor
// predict a consumer's result; all expected statuses and bytes above are fixed.
export function verifySuite(suite) {
  assert.deepEqual(Object.keys(suite), ['version', 'classification', 'cases']);
  assert.equal(suite.version, VERSION);
  assert.equal(suite.classification, CLASSIFICATION);
  assert.equal(suite.cases.length, 80);
  const ids = new Set();
  const tracks = {};
  const statuses = {};
  let oversizedDocuments = 0;
  let maxDocumentBytes = 0;
  let canonicalLiterals = 0;
  for (const item of suite.cases) {
    assert(/^[a-z0-9-]{1,128}$/.test(item.id));
    assert(!ids.has(item.id), `Duplicate case ID: ${item.id}`);
    ids.add(item.id);
    assert(['hello', 'check', 'canonicalize'].includes(item.op));
    assert(item.requirements.length > 0);
    assert.equal(new Set(item.requirements).size, item.requirements.length);
    for (const requirement of item.requirements) {
      assert(/^CORE-\d{3}$/.test(requirement));
      assert(Number(requirement.slice(5)) >= 1 && Number(requirement.slice(5)) <= 28);
    }
    assert.equal(item.expected.authority, 'not_evaluated');
    assert(typeof item.expected.status === 'string' && typeof item.expected.reason === 'string');
    const fields = ['id', 'track', 'requirements', 'op', 'expected'];
    if (item.op === 'hello') {
      assert.equal(item.expected.status, 'capabilities');
      assert(!Object.hasOwn(item, 'document_b64'));
    } else {
      fields.push('document_b64');
      assert(typeof item.document_b64 === 'string');
      const bytes = Buffer.from(item.document_b64, 'base64');
      assert.equal(bytes.toString('base64'), item.document_b64);
      maxDocumentBytes = Math.max(maxDocumentBytes, bytes.length);
      if (bytes.length > MIB) {
        oversizedDocuments += 1;
        assert.equal(item.id, 'limit-document-one-byte-over-1mib');
        assert.equal(bytes.length, MIB + 1);
      }
      // Even the document-size rejection fits the 2 MiB adapter frame budget.
      assert(Buffer.byteLength(JSON.stringify({ id: item.id, op: item.op,
        document_b64: item.document_b64 }), 'utf8') < 2 * MIB);
    }
    if (Object.hasOwn(item, 'basis')) {
      fields.push('basis');
      assert.equal(item.op, 'check');
      assert.deepEqual(Object.keys(item.basis).sort(),
        ['context', 'declaration', 'implementation', 'input', 'mapping']);
      for (const member of Object.values(item.basis)) asciiFixtureMemberBytes(member);
    }
    assert.deepEqual(Object.keys(item).sort(), fields.sort());
    if (item.expected.status === 'canonicalized') {
      assert.equal(item.op, 'canonicalize');
      const bytes = Buffer.from(item.expected.canonical_b64, 'base64');
      assert.equal(bytes.toString('base64'), item.expected.canonical_b64);
      assert.equal(sha256(bytes), item.expected.sha256);
      const literal = bytes.toString('utf8');
      const input = Buffer.from(item.document_b64, 'base64').toString('utf8');
      if (item.id === 'canonical-negative-zero') {
        assert.deepEqual(JSON.parse(input), [-0, 0, -0]);
        assert.deepEqual(JSON.parse(literal), [0, 0, 0]);
      } else {
        // Value preservation only; native object enumeration is not key order.
        assert.deepEqual(JSON.parse(literal), JSON.parse(input), item.id);
      }
      if (item.id === 'canonical-utf16-key-order') {
        assert(literal.startsWith('{"\\r":"CR","1":"one",'));
        const astralPosition = bytes.indexOf(Buffer.from('"\ud83d\ude00":'));
        const bmpPosition = bytes.indexOf(Buffer.from('"\ufb33":'));
        assert(astralPosition >= 0 && bmpPosition > astralPosition);
      }
      if (item.id === 'canonical-recursive-keys-preserve-arrays') {
        assert(literal.startsWith('{"10":"ten","2":"two",'));
      }
      canonicalLiterals += 1;
    } else if (item.expected.status === 'accepted_partial') {
      assert.equal(item.op, 'check');
      assert.equal(item.expected.effect_count, 1);
      assert([1, 2].includes(item.expected.unresolved_count));
    } else if (item.expected.status !== 'capabilities') {
      assert.deepEqual(Object.keys(item.expected).sort(), ['authority', 'reason', 'status']);
    }
    tracks[item.track] = (tracks[item.track] ?? 0) + 1;
    statuses[item.expected.status] = (statuses[item.expected.status] ?? 0) + 1;
  }
  assert.equal(canonicalLiterals, 8);
  assert.equal(oversizedDocuments, 1);
  const serialized = JSON.stringify(suite, null, 2) + '\n';
  assert(Buffer.byteLength(serialized, 'utf8') < 3 * MIB, 'Keep the public corpus small');
  return { serialized, summary: {
    count: suite.cases.length,
    tracks,
    expected_statuses: statuses,
    max_document_bytes: maxDocumentBytes,
    file_bytes: Buffer.byteLength(serialized, 'utf8'),
    file_sha256: sha256(Buffer.from(serialized, 'utf8')),
  } };
}

function isEntryPoint() {
  try {
    return Boolean(process.argv[1])
      && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  assert(process.argv.length <= 3, 'Usage: node case-source.mjs [--write|--check]');
  const mode = process.argv[2] ?? '--write';
  assert(['--write', '--check'].includes(mode), 'Usage: node case-source.mjs [--write|--check]');
  const { serialized, summary } = verifySuite(buildSuite());
  if (mode === '--check') {
    assert.equal(readFileSync(OUTPUT, 'utf8'), serialized, 'cases.json differs from its frozen source');
  } else {
    // The only generated-data write. All manually authored changes use apply_patch.
    writeFileSync(OUTPUT, serialized, 'utf8');
  }
  console.log(JSON.stringify({ mode, verification: 'authoring-integrity-only-no-consumer-run', ...summary }, null, 2));
}
