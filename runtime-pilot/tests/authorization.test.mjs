import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const runtimeDir = dirname(dirname(fileURLToPath(import.meta.url)));
const authorizationPath = join(runtimeDir, 'authorization.mjs');
const policyPath = join(runtimeDir, 'policy.rego');
const query = 'data.action_effect.decision';
const secret = 'private_fixture_do_not_return';
const projection = {
  operation: 'create_issue_comment',
  repository: 'OndCo/Action-Effect-Bench',
  issue_number: 1,
  endpoint: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/1/comments',
  body_sha256: createHash('sha256').update('Synthetic test').digest('hex'),
  body_bytes: Buffer.byteLength('Synthetic test'),
  data_class: 'synthetic-public',
};
const context = { principal: 'fixture-user' };
const policy = {
  revision: 'p1',
  principal: 'fixture-user',
  revoked: false,
  allow_partial_direct: true,
  max_body_bytes: 8192,
  grants: [{ repository: 'OndCo/Action-Effect-Bench', issue_number: 1, data_class: 'synthetic-public' }],
};
const envelope = (value) => ({ result: [{ expressions: [{ value, text: query }] }] });
let opaInstallation;

async function authorizer(directory = runtimeDir) {
  assert.ok(existsSync(authorizationPath), 'the synchronous OPA authorizer must be implemented');
  const module = await import(pathToFileURL(join(directory, 'authorization.mjs')));
  assert.equal(typeof module.authorize, 'function');
  return module.authorize;
}

async function realOpa() {
  opaInstallation ??= (async () => {
    const { installTools } = await import('../install-tools.mjs');
    const installed = await installTools();
    const manifest = JSON.parse(await readFile(join(runtimeDir, 'tools.json'), 'utf8'));
    const pinned = manifest.opa.assets[`${process.platform}-${process.arch}`].sha256;
    assert.equal(createHash('sha256').update(await readFile(installed.opaPath)).digest('hex'), pinned);
    return installed.opaPath;
  })();
  return opaInstallation;
}

function checkResult(result, decision, reason, revision = 'p1') {
  assert.equal(result instanceof Promise, false, 'authorize must remain synchronous');
  assert.equal(result.decision, decision);
  assert.equal(result.reason, reason);
  assert.equal(typeof result.duration_ms, 'number');
  assert.ok(Number.isFinite(result.duration_ms) && result.duration_ms >= 0);
  if (revision !== undefined) assert.equal(result.policy_revision, revision);
  assert.ok(Object.keys(result).every((key) => ['decision', 'reason', 'policy_revision', 'duration_ms'].includes(key)));
  assert.equal(JSON.stringify(result).includes(secret), false);
}

async function tempDirectory(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'action-effect-authorization-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function fakeOpa(t, source, name = 'fake-opa.cjs') {
  const root = await tempDirectory(t);
  const path = join(root, name);
  await writeFile(path, `#!${process.execPath}\nconst fs = require('node:fs');\nconst input = JSON.parse(fs.readFileSync(0, 'utf8'));\n${source}\n`, { mode: 0o755 });
  return path;
}

async function directDecision(input) {
  assert.ok(existsSync(policyPath), 'the real Rego policy must be implemented');
  const result = spawnSync(await realOpa(), ['eval', '--stdin-input', '--data', policyPath, '--format=json', query], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 5_000, maxBuffer: 65_536, shell: false,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout).result[0].expressions[0].value;
}

test('allows the exact grant synchronously using the verified REAL OPA default', async () => {
  const authorize = await authorizer();
  await realOpa();
  const before = JSON.stringify({ projection, context, policy });
  checkResult(authorize(projection, context, policy), 'allow', 'authorized');
  assert.equal(JSON.stringify({ projection, context, policy }), before);
});

test('the actual Rego decision independently allows the fixture', async () => {
  await authorizer();
  assert.deepEqual(await directDecision({ projection, context, policy }), { decision: 'allow', reason: 'authorized' });
});

for (const [label, changedPolicy, changedContext, changedProjection, decision, reason] of [
  ['revocation beats unknown scope and unknown principal', { revoked: true, allow_partial_direct: false }, { principal: 'unknown-user', unknowns: ['descendants'] }, {}, 'deny', 'revoked'],
  ['principal mismatch beats scope review', { allow_partial_direct: false }, { principal: 'unknown-user' }, {}, 'deny', 'principal_mismatch'],
  ['missing grant beats scope review', { grants: [], allow_partial_direct: false }, {}, {}, 'deny', 'no_matching_grant'],
  ['body limit beats scope review', { allow_partial_direct: false }, {}, { body_bytes: 8193 }, 'deny', 'body_too_large'],
  ['unknown descendants require explicit partial-scope permission', { allow_partial_direct: false }, {}, {}, 'review', 'partial_scope'],
  ['exact byte-limit boundary is allowed', {}, {}, { body_bytes: 8192 }, 'allow', 'authorized'],
  ['byte count above limit is denied', {}, {}, { body_bytes: 8193 }, 'deny', 'body_too_large'],
  ['valid but ungranted data class is denied', {}, {}, { data_class: 'restricted' }, 'deny', 'no_matching_grant'],
  ['repository identities are case-sensitive', { grants: [{ repository: 'ondco/Action-Effect-Bench', issue_number: 1, data_class: 'synthetic-public' }] }, {}, {}, 'deny', 'no_matching_grant'],
]) {
  test(`REAL OPA: ${label}`, async () => {
    const authorize = await authorizer();
    await realOpa();
    checkResult(authorize({ ...projection, ...changedProjection }, { ...context, ...changedContext }, { ...policy, ...changedPolicy }), decision, reason);
  });
}

test('REAL OPA never Cartesian-combines fields from different grants', async () => {
  const authorize = await authorizer();
  await realOpa();
  const combinedPolicy = { ...policy, grants: [
    { repository: 'OndCo/Action-Effect-Bench', issue_number: 2, data_class: 'synthetic-public' },
    { repository: 'OndCo/Other', issue_number: 1, data_class: 'restricted' },
  ] };
  checkResult(authorize(projection, context, combinedPolicy), 'deny', 'no_matching_grant');
  assert.deepEqual(await directDecision({ projection, context, policy: combinedPolicy }), {
    decision: 'deny', reason: 'no_matching_grant',
  });
});

test('REAL OPA also couples data class, not just repository and issue', async () => {
  const authorize = await authorizer();
  await realOpa();
  const changed = { ...policy, grants: [
    { repository: projection.repository, issue_number: 1, data_class: 'restricted' },
    { repository: 'OndCo/Other', issue_number: 2, data_class: 'synthetic-public' },
  ] };
  checkResult(authorize(projection, context, changed), 'deny', 'no_matching_grant');
});

test('REAL OPA accepts a complete matching grant among unrelated grants', async () => {
  const authorize = await authorizer();
  await realOpa();
  checkResult(authorize(projection, context, { ...policy, grants: [
    { repository: 'OndCo/Other', issue_number: 2, data_class: 'restricted' }, ...policy.grants,
  ] }), 'allow', 'authorized');
});

test('REAL OPA re-evaluates policy changes rather than caching positive authority', async () => {
  const authorize = await authorizer();
  await realOpa();
  checkResult(authorize(projection, context, policy), 'allow', 'authorized');
  checkResult(authorize(projection, context, { ...policy, revision: 'p2', revoked: true }), 'deny', 'revoked', 'p2');
});

test('classification is any nonempty string, with authority determined by the exact grant', async (t) => {
  const authorize = await authorizer();
  const stdout = JSON.stringify(envelope({ decision: 'allow', reason: 'authorized' }));
  const path = await fakeOpa(t, `process.stdout.write(${JSON.stringify(stdout)});`);
  const data_class = 'synthetic public / \u516c\u5f00\nfixture';
  const classified = { ...projection, data_class };
  const configured = { ...policy, grants: [{ ...policy.grants[0], data_class }] };
  checkResult(authorize(classified, context, configured, { opaPath: path }), 'allow', 'authorized');
});

test('REAL OPA compares arbitrary nonempty classifications exactly', async () => {
  const authorize = await authorizer();
  const opaPath = await realOpa();
  const data_class = 'synthetic public / \u516c\u5f00\nfixture';
  const classified = { ...projection, data_class };
  const configured = { ...policy, grants: [{ ...policy.grants[0], data_class }] };
  checkResult(authorize(classified, context, configured, { opaPath }), 'allow', 'authorized');
  checkResult(authorize(classified, context, policy, { opaPath }), 'deny', 'no_matching_grant');
});

const badPolicies = [
  ['null', null], ['array', []], ['missing fields', {}],
  ['extra field', { ...policy, opaPath: '/request-selected-executable' }],
  ['empty revision', { ...policy, revision: '' }],
  ['nonstring revision', { ...policy, revision: 1 }],
  ['empty principal', { ...policy, principal: '' }],
  ['nonboolean revoked', { ...policy, revoked: 'false' }],
  ['nonboolean scope flag', { ...policy, allow_partial_direct: 1 }],
  ['zero limit', { ...policy, max_body_bytes: 0 }],
  ['negative limit', { ...policy, max_body_bytes: -1 }],
  ['fractional limit', { ...policy, max_body_bytes: 2.5 }],
  ['unsafe limit', { ...policy, max_body_bytes: Number.MAX_SAFE_INTEGER + 1 }],
  ['infinite limit', { ...policy, max_body_bytes: Infinity }],
  ['NaN limit', { ...policy, max_body_bytes: NaN }],
  ['nonarray grants', { ...policy, grants: {} }],
  ['null grant', { ...policy, grants: [null] }],
  ['missing grant field', { ...policy, grants: [{ repository: projection.repository, issue_number: 1 }] }],
  ['extra grant field', { ...policy, grants: [{ ...policy.grants[0], principal: 'fixture-user' }] }],
  ['unsafe grant issue', { ...policy, grants: [{ ...policy.grants[0], issue_number: Number.MAX_SAFE_INTEGER + 1 }] }],
  ['boolean grant issue', { ...policy, grants: [{ ...policy.grants[0], issue_number: true }] }],
  ['path-unsafe grant repository', { ...policy, grants: [{ ...policy.grants[0], repository: 'OndCo/../Other' }] }],
  ['empty grant class', { ...policy, grants: [{ ...policy.grants[0], data_class: '' }] }],
];

for (const [label, invalidPolicy] of badPolicies) {
  test(`invalid policy (${label}) fails before attempting to invoke OPA`, async (t) => {
    const authorize = await authorizer();
    const root = await tempDirectory(t);
    const result = authorize(projection, context, invalidPolicy, { opaPath: join(root, 'absent-opa') });
    assert.equal(result.decision, 'evaluation_failure');
    assert.equal(result.reason, 'invalid_policy');
    assert.equal(Object.hasOwn(result, 'policy_revision'), false);
  });
}

const badProjections = [
  ['array', []], ['missing fields', {}],
  ['other operation', { ...projection, operation: 'delete_issue_comment' }],
  ['extra field', { ...projection, body: secret }],
  ['repository traversal', { ...projection, repository: 'OndCo/../Other' }],
  ['repository escaping', { ...projection, repository: 'OndCo%2fOther/Action-Effect-Bench' }],
  ['repository dot component', { ...projection, repository: 'OndCo/..' }],
  ['zero issue', { ...projection, issue_number: 0 }],
  ['boolean issue', { ...projection, issue_number: true }],
  ['fractional issue', { ...projection, issue_number: 1.5 }],
  ['unsafe issue', { ...projection, issue_number: Number.MAX_SAFE_INTEGER + 1 }],
  ['endpoint host', { ...projection, endpoint: 'https://example.invalid/repos/OndCo/Action-Effect-Bench/issues/1/comments' }],
  ['endpoint issue binding', { ...projection, endpoint: 'https://api.github.com/repos/OndCo/Action-Effect-Bench/issues/2/comments' }],
  ['endpoint repository binding', { ...projection, endpoint: 'https://api.github.com/repos/OndCo/Other/issues/1/comments' }],
  ['endpoint query', { ...projection, endpoint: `${projection.endpoint}?unexpected=1` }],
  ['nonhex digest', { ...projection, body_sha256: 'z'.repeat(64) }],
  ['short digest', { ...projection, body_sha256: 'a'.repeat(63) }],
  ['missing digest', { ...projection, body_sha256: undefined }],
  ['zero bytes', { ...projection, body_bytes: 0 }],
  ['negative bytes', { ...projection, body_bytes: -1 }],
  ['fractional bytes', { ...projection, body_bytes: 1.5 }],
  ['unsafe bytes', { ...projection, body_bytes: Number.MAX_SAFE_INTEGER + 1 }],
  ['nonfinite bytes', { ...projection, body_bytes: Infinity }],
  ['empty class', { ...projection, data_class: '' }],
];

for (const [label, invalidProjection] of badProjections) {
  test(`invalid projection (${label}) cannot be authorized even as a reference`, async (t) => {
    const authorize = await authorizer();
    const root = await tempDirectory(t);
    checkResult(authorize(invalidProjection, context, policy, { opaPath: join(root, 'absent-opa') }), 'evaluation_failure', 'invalid_projection');
  });
}

for (const missing of [undefined, null]) {
  test(`missing projection (${String(missing)}) is an evaluation failure, not a semantic denial`, async () => {
    const authorize = await authorizer();
    checkResult(authorize(missing, context, policy), 'evaluation_failure', 'missing_projection');
  });
}

for (const [label, invalidContext, reason] of [
  ['undefined', undefined, 'missing_context'], ['null', null, 'missing_context'],
  ['empty', {}, 'invalid_context'], ['wrong type', { principal: true }, 'invalid_context'],
  ['empty principal', { principal: '' }, 'invalid_context'],
]) {
  test(`missing or malformed context (${label}) fails closed`, async () => {
    const authorize = await authorizer();
    checkResult(authorize(projection, invalidContext, policy), 'evaluation_failure', reason);
  });
}

test('accessors and inherited policy facts are not executable validation hooks', async () => {
  const authorize = await authorizer();
  let getterCalled = false;
  const accessor = { ...policy };
  Object.defineProperty(accessor, 'revoked', { enumerable: true, get() { getterCalled = true; return false; } });
  assert.equal(authorize(projection, context, accessor).reason, 'invalid_policy');
  assert.equal(getterCalled, false);
  assert.equal(authorize(projection, context, Object.create(policy)).reason, 'invalid_policy');
});

test('grant arrays cannot hide invalid grant fields behind iterators or accessors', async (t) => {
  const authorize = await authorizer();
  const root = await tempDirectory(t);
  const options = { opaPath: join(root, 'absent-opa') };
  let hookCalled = false;
  const iterated = [{ ...policy.grants[0], unexpected: true }];
  iterated[Symbol.iterator] = function* () { hookCalled = true; yield policy.grants[0]; };
  assert.equal(authorize(projection, context, { ...policy, grants: iterated }, options).reason, 'invalid_policy');
  const accessed = [policy.grants[0]];
  Object.defineProperty(accessed, '0', { enumerable: true, get() { hookCalled = true; return policy.grants[0]; } });
  assert.equal(authorize(projection, context, { ...policy, grants: accessed }, options).reason, 'invalid_policy');
  assert.equal(hookCalled, false);
});

test('trailing line terminators never bypass complete field validation before OPA', async (t) => {
  const authorize = await authorizer();
  const root = await tempDirectory(t);
  const options = { opaPath: join(root, 'absent-opa') };
  for (const key of ['revision', 'principal']) {
    assert.equal(authorize(projection, context, { ...policy, [key]: `${policy[key]}\n` }, options).reason, 'invalid_policy');
  }
  const repository = `${projection.repository}\n`;
  for (const invalid of [
    { ...projection, body_sha256: `${projection.body_sha256}\n` },
    { ...projection, repository, endpoint: `https://api.github.com/repos/${repository}/issues/1/comments` },
  ]) {
    assert.equal(authorize(invalid, context, policy, options).reason, 'invalid_projection');
  }
});

test('the Rego policy independently rejects malformed pure-reference facts', async () => {
  await authorizer();
  for (const invalidProjection of [
    { ...projection, operation: 'delete_issue_comment' },
    { ...projection, endpoint: `${projection.endpoint}/wrong` },
    { ...projection, body_sha256: 'not-a-digest' },
    { ...projection, body_bytes: 0 },
    { ...projection, issue_number: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.deepEqual(await directDecision({ projection: invalidProjection, context, policy }), {
      decision: 'evaluation_failure', reason: 'invalid_projection',
    });
  }
});

test('the Rego policy independently fails closed for invalid configuration and missing projection', async () => {
  await authorizer();
  for (const invalidPolicy of [null, { ...policy, revoked: 'false' }, { ...policy, grants: [{ ...policy.grants[0], extra: true }] }]) {
    assert.deepEqual(await directDecision({ projection, context, policy: invalidPolicy }), {
      decision: 'evaluation_failure', reason: 'invalid_policy',
    });
  }
  assert.deepEqual(await directDecision({ context, policy }), { decision: 'evaluation_failure', reason: 'missing_projection' });
});

test('an absent OPA binary is a worker failure, never semantic withholding', async (t) => {
  const authorize = await authorizer();
  const root = await tempDirectory(t);
  checkResult(authorize(projection, context, policy, { opaPath: join(root, 'absent') }), 'evaluation_failure', 'opa_unavailable');
});

test('non-executable OPA files fail closed', async (t) => {
  const authorize = await authorizer();
  const stdout = JSON.stringify(envelope({ decision: 'allow', reason: 'authorized' }));
  const path = await fakeOpa(t, `process.stdout.write(${JSON.stringify(stdout)});`);
  await chmod(path, 0o600);
  checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_unavailable');
});

const malformedOutputs = [
  ['empty', '', 'malformed_opa_output'],
  ['non-JSON', secret, 'malformed_opa_output'],
  ['null', 'null', 'malformed_opa_output'],
  ['undefined result', '{}', 'undefined_decision'],
  ['empty result', '{"result":[]}', 'undefined_decision'],
  ['wrong result type', '{"result":{}}', 'malformed_opa_output'],
  ['multiple results', JSON.stringify({ result: [...envelope({ decision: 'allow', reason: 'authorized' }).result, ...envelope({ decision: 'deny', reason: 'revoked' }).result] }), 'malformed_opa_output'],
  ['missing expression', '{"result":[{"expressions":[]}]}', 'undefined_decision'],
  ['multiple expressions', JSON.stringify({ result: [{ expressions: [{ value: { decision: 'allow', reason: 'authorized' } }, { value: true }] }] }), 'malformed_opa_output'],
  ['missing decision value', JSON.stringify(envelope(null)), 'malformed_opa_output'],
  ['unknown decision', JSON.stringify(envelope({ decision: 'withhold', reason: 'revoked' })), 'malformed_opa_output'],
  ['nonstring decision', JSON.stringify(envelope({ decision: ['allow'], reason: 'authorized' })), 'malformed_opa_output'],
  ['untrusted reason', JSON.stringify(envelope({ decision: 'allow', reason: secret })), 'malformed_opa_output'],
  ['mismatched reason', JSON.stringify(envelope({ decision: 'allow', reason: 'revoked' })), 'malformed_opa_output'],
  ['extra secret field', JSON.stringify(envelope({ decision: 'allow', reason: 'authorized', input: secret })), 'malformed_opa_output'],
  ['OPA error payload', JSON.stringify({ errors: [{ message: secret }], ...envelope({ decision: 'allow', reason: 'authorized' }) }), 'opa_error'],
];

for (const [label, stdout, reason] of malformedOutputs) {
  test(`malformed tool output (${label}) is an evaluation failure without raw output`, async (t) => {
    const authorize = await authorizer();
    const path = await fakeOpa(t, `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(secret)});`);
    checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', reason);
  });
}

test('a nonzero worker exit cannot be masked by an allow-shaped stdout', async (t) => {
  const authorize = await authorizer();
  const stdout = JSON.stringify(envelope({ decision: 'allow', reason: 'authorized' }));
  const path = await fakeOpa(t, `process.stdout.write(${JSON.stringify(stdout)}); process.exitCode = 2;`);
  checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_error');
});

test('a signal-terminated worker is not a policy denial', async (t) => {
  const authorize = await authorizer();
  const path = await fakeOpa(t, `process.kill(process.pid, 'SIGKILL');`);
  checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_error');
});

for (const stream of ['stdout', 'stderr']) {
  test(`worker ${stream} is bounded`, async (t) => {
    const authorize = await authorizer();
    const path = await fakeOpa(t, `process.${stream}.write('x'.repeat(2 * 1024 * 1024));`);
    checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_output_limit');
  });
}

test('a worker ignoring SIGTERM is killed within the fixed timeout', async (t) => {
  const authorize = await authorizer();
  const path = await fakeOpa(t, `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`);
  const started = performance.now();
  checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_timeout');
  assert.ok(performance.now() - started < 5_000);
});

test('OPA receives only minimized facts via stdin and the fixed argument vector', async (t) => {
  const authorize = await authorizer();
  const root = await tempDirectory(t);
  const capture = join(root, 'capture.json');
  const stdout = JSON.stringify(envelope({ decision: 'allow', reason: 'authorized' }));
  const path = await fakeOpa(t, `fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ input, args: process.argv.slice(2), env: process.env })); process.stdout.write(${JSON.stringify(stdout)});`, 'opa ; no-shell.cjs');
  const previous = process.env.ACTION_EFFECT_TEST_SECRET;
  process.env.ACTION_EFFECT_TEST_SECRET = secret;
  t.after(() => {
    if (previous === undefined) delete process.env.ACTION_EFFECT_TEST_SECRET;
    else process.env.ACTION_EFFECT_TEST_SECRET = previous;
  });
  checkResult(authorize(projection, { ...context, token: secret, unused: { secret } }, policy, { opaPath: path }), 'allow', 'authorized');
  const seen = JSON.parse(await readFile(capture, 'utf8'));
  assert.deepEqual(seen.input, { projection, context, policy });
  assert.deepEqual(seen.args, ['eval', '--stdin-input', '--data', policyPath, '--format=json', query]);
  assert.equal(JSON.stringify(seen).includes(secret), false);
});

test('request context cannot select an executable or grant partial-scope authority', async (t) => {
  const authorize = await authorizer();
  await realOpa();
  const root = await tempDirectory(t);
  const marker = join(root, 'executed');
  const path = await fakeOpa(t, `fs.writeFileSync(${JSON.stringify(marker)}, 'bad');`);
  checkResult(authorize(projection, { ...context, opaPath: path, allow_partial_direct: true }, { ...policy, allow_partial_direct: false }), 'review', 'partial_scope');
  assert.equal(existsSync(marker), false);
});

for (const options of [{ opaPath: 'opa' }, { opaPath: '/opa\0bad' }, { timeout: 0 }, null]) {
  test(`invalid local options (${JSON.stringify(options)}) cannot weaken process limits`, async () => {
    const authorize = await authorizer();
    checkResult(authorize(projection, context, policy, options), 'evaluation_failure', 'invalid_options');
  });
}

test('the default binary never falls back to PATH, environment, or a request executable', async (t) => {
  const authorize = await authorizer();
  const directory = await tempDirectory(t);
  await copyFile(authorizationPath, join(directory, 'authorization.mjs'));
  await copyFile(policyPath, join(directory, 'policy.rego'));
  const isolatedAuthorize = await authorizer(directory);
  checkResult(isolatedAuthorize(projection, { ...context, opaPath: await realOpa() }, policy), 'evaluation_failure', 'opa_unavailable');
  assert.equal(existsSync(join(directory, '.tools')), false);
  assert.equal(typeof authorize, 'function');
});

test('symlinked executable paths fail closed instead of following replacement targets', async (t) => {
  const authorize = await authorizer();
  const root = await tempDirectory(t);
  const path = join(root, 'opa');
  await symlink(await realOpa(), path);
  checkResult(authorize(projection, context, policy, { opaPath: path }), 'evaluation_failure', 'opa_unavailable');
});

test('actual Rego compilation errors are evaluation failures', async (t) => {
  await authorizer();
  const directory = await tempDirectory(t);
  await copyFile(authorizationPath, join(directory, 'authorization.mjs'));
  await writeFile(join(directory, 'policy.rego'), 'package action_effect\nthis is not valid rego');
  const authorize = await authorizer(directory);
  checkResult(authorize(projection, context, policy, { opaPath: await realOpa() }), 'evaluation_failure', 'opa_error');
});

test('importing authorization never runs OPA or installs tools', async (t) => {
  await authorizer();
  const directory = await tempDirectory(t);
  await copyFile(authorizationPath, join(directory, 'authorization.mjs'));
  await mkdir(join(directory, '.tools'));
  const marker = join(directory, 'executed');
  await writeFile(join(directory, '.tools', 'opa'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad');`, { mode: 0o755 });
  await authorizer(directory);
  assert.equal(existsSync(marker), false);
});
