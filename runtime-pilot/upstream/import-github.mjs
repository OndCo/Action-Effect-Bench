import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';

const commit = '755ee33b4a81d51f6f07a902cce26cbec3b822f2';
const base = `https://raw.githubusercontent.com/github/rest-api-description/${commit}`;
const source = `${base}/descriptions/api.github.com/api.github.com.json`;
const bytes = Buffer.from(await (await fetch(source, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
const upstream = JSON.parse(bytes.toString('utf8'));
const path = '/repos/{owner}/{repo}/issues/{issue_number}/comments';
const post = upstream.paths[path].post;
if (post.operationId !== 'issues/create-comment') throw new Error('Unexpected upstream operation');
const selected = { path, post, components: { schemas: {}, parameters: {} } };
const seen = new Set();
function refs(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string') {
    if (!/^#\/components\/(schemas|parameters|examples|responses|headers|links|securitySchemes)\/[^/]+$/.test(value.$ref)) throw new Error(`Unsupported upstream reference: ${value.$ref}`);
    if (!seen.has(value.$ref)) {
      seen.add(value.$ref);
      const [, , group, name] = value.$ref.split('/');
      const object = upstream.components[group][name];
      if (!object) throw new Error('Missing upstream reference');
      selected.components[group] ??= {};
      selected.components[group][name] = object;
      refs(object);
    }
  }
  for (const item of Object.values(value)) refs(item);
}
refs(post);
const artifact = { provenance: { repository: 'https://github.com/github/rest-api-description', commit, source,
  source_sha256: createHash('sha256').update(bytes).digest('hex'),
  extraction: 'Exact selected POST operation and recursively referenced components; not governance labels',
  license: 'MIT', external_semantic_labels: false }, ...selected };
const licenseResponse = await fetch(`${base}/LICENSE.md`, { signal: AbortSignal.timeout(30000) });
if (!licenseResponse.ok) throw new Error('Could not fetch license');
writeFileSync(new URL('./github-LICENSE.md', import.meta.url), await licenseResponse.text());
writeFileSync(new URL('./github-comment-openapi.json', import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ operation: post.operationId, source_sha256: artifact.provenance.source_sha256,
  schema_count: Object.keys(selected.components.schemas).length }));
