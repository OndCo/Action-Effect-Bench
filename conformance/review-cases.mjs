import { readFileSync } from 'node:fs';

// Authored after internal review and exposed to the implementations. These are
// regressions, not additional independent or held-out evaluation samples.
export function reviewCases() {
  const base = JSON.parse(readFileSync(new URL('../../action-effect-spec/examples/partial-refund.json', import.meta.url), 'utf8'));
  const cases = [];
  function add(id, doc, status, reason, requirements) {
    cases.push({ id, track: 'post-review-regression', requirements, op: 'check',
      document_b64: Buffer.from(JSON.stringify(doc)).toString('base64'),
      expected: { status, reason, authority: 'not_evaluated',
        ...(status === 'accepted_partial' ? { effect_count: 1, unresolved_count: 1 } : {}) } });
  }
  const unknown = structuredClone(base);
  unknown.effects[0].quantities = [];
  unknown.unknowns.push({ code: 'unknown_quantity', scope: 'amount unavailable',
    target: { effect_id: 'effect-1', quantity_name: 'https://example.org/quantities/amount' } });
  add('review-known-amount-replaced-by-unknown', unknown, 'untrusted_evidence', 'effect_projection', ['CORE-008', 'CORE-010']);
  const missingName = structuredClone(base);
  missingName.effects[0].quantities[0].name = 'urn:quantities:other';
  add('review-required-amount-name-absent', missingName, 'invalid_input', 'structure', ['CORE-010']);
  const invalidUris = ['https://[', 'https://example.org/#first#second', 'https://[not-ip]/',
    'https://a:b:c/', 'https://example.org:port/', 'https://user@@host/',
    'https://host/path[raw]', 'https://host/?q=[raw]', 'urn:value#bad#fragment',
    'https://[::1]suffix/', 'https://[vG.invalid]/', 'https://[fe80::1%25en0]/'];
  const validUris = ['urn:example:one', 'mailto:operator@example.org', 'file:///tmp/example',
    'https://user:pass@[2001:db8::1]:443/path?q=a?b#frag', 'https://[vF.a:b]/',
    'https://host/%5Bencoded%5D?q=%23value#ok', 'custom:/a/b', 'custom:a:b@c'];
  for (const [index, uri] of invalidUris.entries()) {
    const doc = structuredClone(base); doc.record_id = uri;
    add(`review-invalid-uri-${index + 1}`, doc, 'invalid_input', 'structure', ['CORE-009']);
  }
  for (const [index, uri] of validUris.entries()) {
    const doc = structuredClone(base); doc.record_id = uri;
    add(`review-valid-generic-uri-${index + 1}`, doc, 'accepted_partial', 'declared_partial', ['CORE-011']);
  }
  return cases;
}
