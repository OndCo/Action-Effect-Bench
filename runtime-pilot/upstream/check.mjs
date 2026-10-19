import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

const upstream = JSON.parse(readFileSync(new URL('./github-comment-openapi.json', import.meta.url)));
function resolve(value) {
  if (!value.$ref) return value;
  if (!value.$ref.startsWith('#/components/')) throw new Error('Unexpected external schema reference');
  return value.$ref.slice(2).split('/').reduce((object, field) => object[field], upstream);
}

export function upstreamContractCheck() {
  // OAS format hints are not governance labels or semantic effect validation.
  const ajv = new Ajv({ strict: false, validateFormats: false });
  const request = upstream.post.requestBody.content['application/json'];
  const response = upstream.post.responses['201'].content['application/json'];
  const requestValidator = ajv.compile({ ...request.schema, components: upstream.components });
  const responseValidator = ajv.compile({ ...resolve(response.schema), components: upstream.components });
  return {
    source_commit: upstream.provenance.commit, source_sha256: upstream.provenance.source_sha256,
    operation: upstream.post.operationId,
    request_example_valid: Boolean(requestValidator(request.examples.default.value)),
    response_example_valid: Boolean(responseValidator(resolve(response.examples.default).value)),
    missing_body_rejected: !requestValidator({}),
    notifications_declared: upstream.post['x-github'].triggersNotification === true,
    checked: 'upstream example structural compatibility; formats not asserted',
    independent_governance_labels: false
  };
}
