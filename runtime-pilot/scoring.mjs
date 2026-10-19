import { canonicalBytes } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';

function sameProjection(actual, expected) {
  if (actual === undefined || expected === undefined) return actual === expected;
  try {
    // Compare JSON values, not a host parser's object prototype.
    return canonicalBytes(actual).equals(canonicalBytes(expected));
  } catch { return false; }
}

export function mappingMatches(actual, expected) {
  return actual?.status === expected.status && actual?.reason === expected.reason
    && sameProjection(actual?.projection, expected.projection);
}

export function scoreRows(rows) {
  const result = { rows: rows.length, base_intents: new Set(rows.map(row => row.base_intent)).size,
    mapping_exact: 0, decision_eligible: 0, decision_exact: 0, masked_mapping_errors: 0,
    operational_failures: 0, expected_allow: 0, expected_deny: 0, expected_review: 0,
    false_allows_on_deny: 0, false_allows_on_review: 0, false_blocks: 0,
    expected_allow_not_allowed: 0, correct_reviews: 0, unnecessary_reviews: 0 };
  const byIntent = new Map();
  for (const row of rows) {
    const exact = mappingMatches(row.mapping, row.expected.mapping);
    if (exact) result.mapping_exact += 1;
    const group = byIntent.get(row.base_intent) ?? [];
    group.push(exact ? 1 : 0); byIntent.set(row.base_intent, group);
    const expected = row.expected.decision, decision = row.authorization?.decision;
    if (['allow', 'deny', 'review'].includes(expected)) {
      result.decision_eligible += 1;
      result[`expected_${expected}`] += 1;
      if (decision === expected) result.decision_exact += 1;
      if (!exact && decision === expected) result.masked_mapping_errors += 1;
    }
    if (row.mapping?.status === 'evaluation_failure' || decision === 'evaluation_failure') result.operational_failures += 1;
    if (expected === 'deny' && decision === 'allow') result.false_allows_on_deny += 1;
    if (expected === 'review' && decision === 'allow') result.false_allows_on_review += 1;
    if (expected === 'allow' && decision === 'deny') result.false_blocks += 1;
    if (expected === 'allow' && decision !== 'allow') result.expected_allow_not_allowed += 1;
    if (expected === 'review' && decision === 'review') result.correct_reviews += 1;
    if (expected === 'allow' && decision === 'review') result.unnecessary_reviews += 1;
  }
  result.base_intent_weighted_mapping_match = byIntent.size ? [...byIntent.values()]
    .reduce((sum, values) => sum + values.reduce((a, b) => a + b, 0) / values.length, 0) / byIntent.size : null;
  return result;
}

export function durationSummary(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { n: 0 };
  const middle = Math.floor(sorted.length / 2);
  return { n: sorted.length, minimum_ms: sorted[0],
    median_ms: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    maximum_ms: sorted.at(-1), mean_ms: sorted.reduce((sum, value) => sum + value, 0) / sorted.length };
}
