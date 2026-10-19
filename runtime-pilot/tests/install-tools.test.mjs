import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm,
  symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const runtimeDir = dirname(dirname(fileURLToPath(import.meta.url)));
const installerPath = join(runtimeDir, 'install-tools.mjs');
const manifest = JSON.parse(await readFile(join(runtimeDir, 'tools.json'), 'utf8'));
const asset = manifest.opa.assets[`${process.platform}-${process.arch}`];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const noNetwork = async () => assert.fail('unexpected download');
let verifiedBytes;

async function installer(directory = runtimeDir) {
  assert.ok(existsSync(installerPath), 'the pinned installer must be implemented');
  const module = await import(pathToFileURL(join(directory, 'install-tools.mjs')));
  assert.equal(typeof module.installTools, 'function');
  return module.installTools;
}

async function fixture(t) {
  await installer();
  const root = await realpath(await mkdtemp(join(tmpdir(), 'action-effect-opa-install-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'runtime-pilot');
  await mkdir(directory);
  await copyFile(installerPath, join(directory, 'install-tools.mjs'));
  await writeFile(join(directory, 'tools.json'), JSON.stringify(manifest));
  return {
    root,
    directory,
    toolsDir: join(directory, '.tools'),
    opaPath: join(directory, '.tools', 'opa'),
    install: await installer(directory),
  };
}

async function officialBytes() {
  verifiedBytes ??= (async () => {
    assert.ok(asset, 'integration tests require a supported Darwin/Linux architecture');
    const install = await installer();
    const result = await install();
    assert.equal(result.opaPath, join(runtimeDir, '.tools', 'opa'));
    assert.equal(result.version, '1.21.2');
    assert.equal(result.sha256, asset.sha256);
    const bytes = await readFile(result.opaPath);
    assert.equal(digest(bytes), asset.sha256);
    return bytes;
  })();
  return verifiedBytes;
}

test('provisions REAL pinned OPA and verifies the executable version', async () => {
  await officialBytes();
  const opaPath = join(runtimeDir, '.tools', 'opa');
  assert.equal((await lstat(opaPath)).isSymbolicLink(), false);
  const result = spawnSync(opaPath, ['version'], {
    encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384, shell: false,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Version: 1\.21\.2$/m);
});

test('a valid existing binary is hash-checked without another download', async () => {
  await officialBytes();
  const install = await installer();
  const result = await install({ fetchImpl: noNetwork });
  assert.equal(result.installed, false);
  assert.equal(result.sha256, asset.sha256);
});

test('importing the CLI has no filesystem, network, or output side effects', async (t) => {
  const f = await fixture(t);
  const url = pathToFileURL(join(f.directory, 'install-tools.mjs')).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval',
    `globalThis.fetch = () => { throw Error('network_on_import'); }; await import(${JSON.stringify(url)});`,
  ], { encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(existsSync(f.toolsDir), false);
});

test('a symlinked CLI uses the actual module directory, including preserve-symlinks-main', async (t) => {
  const f = await fixture(t);
  await mkdir(f.toolsDir);
  await writeFile(f.opaPath, await officialBytes(), { mode: 0o600 });
  const entry = join(f.root, 'bootstrap.mjs');
  await symlink(join(f.directory, 'install-tools.mjs'), entry);
  const result = spawnSync(process.execPath, ['--preserve-symlinks-main', entry], {
    cwd: f.root, encoding: 'utf8', timeout: 5_000, maxBuffer: 16_384,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).opaPath, f.opaPath);
  assert.equal(existsSync(join(f.root, '.tools')), false);
});

for (const [platform, arch] of [['win32', 'x64'], ['freebsd', 'arm64'], ['linux', 'ia32']]) {
  test(`rejects unsupported ${platform}/${arch} before writes or download`, async (t) => {
    const f = await fixture(t);
    await assert.rejects(f.install({ platform, arch, fetchImpl: noNetwork }), { message: 'unsupported_platform' });
    assert.equal(existsSync(f.toolsDir), false);
  });
}

for (const [label, mutate] of [
  ['floating version', (m) => { m.opa.version = 'latest'; }],
  ['nonofficial release', (m) => { m.opa.release = 'https://example.invalid/opa'; }],
  ['invalid checksum', (m) => { m.opa.assets[`${process.platform}-${process.arch}`].sha256 = 'not-a-hash'; }],
  ['asset path traversal', (m) => { m.opa.assets[`${process.platform}-${process.arch}`].name = '../opa'; }],
  ['unexpected asset field', (m) => { m.opa.assets[`${process.platform}-${process.arch}`].url = 'https://example.invalid/opa'; }],
]) {
  test(`rejects a manifest with ${label} before writes or download`, async (t) => {
    const f = await fixture(t);
    const changed = structuredClone(manifest);
    mutate(changed);
    await writeFile(join(f.directory, 'tools.json'), JSON.stringify(changed));
    await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'invalid_tools_manifest' });
    assert.equal(existsSync(f.toolsDir), false);
  });
}

test('does not follow a symlinked tools directory', async (t) => {
  const f = await fixture(t);
  const external = join(f.root, 'external');
  await mkdir(external);
  await symlink(external, f.toolsDir);
  await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'unsafe_tools_directory' });
  assert.deepEqual(await readdir(external), []);
});

for (const dangling of [false, true]) {
  test(`does not follow ${dangling ? 'dangling' : 'existing'} binary symlinks`, async (t) => {
    const f = await fixture(t);
    await mkdir(f.toolsDir);
    const external = join(f.root, 'external-opa');
    if (!dangling) await writeFile(external, 'private_external_bytes', { mode: 0o600 });
    await symlink(external, f.opaPath);
    await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'unsafe_opa_path' });
    assert.equal((await lstat(f.opaPath)).isSymbolicLink(), true);
    if (!dangling) {
      assert.equal(await readFile(external, 'utf8'), 'private_external_bytes');
      assert.equal((await lstat(external)).mode & 0o777, 0o600);
    } else {
      assert.equal(existsSync(external), false);
    }
  });
}

test('does not chmod an externally hard-linked binary', async (t) => {
  const f = await fixture(t);
  await mkdir(f.toolsDir);
  const external = join(f.root, 'external-opa');
  await writeFile(external, await officialBytes(), { mode: 0o600 });
  await link(external, f.opaPath);
  await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'unsafe_opa_path' });
  assert.equal((await lstat(external)).mode & 0o777, 0o600);
});

test('rejects a non-file destination without replacing it', async (t) => {
  const f = await fixture(t);
  await mkdir(f.opaPath, { recursive: true });
  await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'unsafe_opa_path' });
  assert.equal((await lstat(f.opaPath)).isDirectory(), true);
});

test('detects existing binary tampering before chmod, execution, or redownload', async (t) => {
  const f = await fixture(t);
  await mkdir(f.toolsDir);
  await writeFile(f.opaPath, 'unverified_binary', { mode: 0o600 });
  await assert.rejects(f.install({ fetchImpl: noNetwork }), { message: 'checksum_mismatch' });
  assert.equal(await readFile(f.opaPath, 'utf8'), 'unverified_binary');
  assert.equal((await lstat(f.opaPath)).mode & 0o777, 0o600);
});

test('repairs executable permissions only on an existing hash-verified binary', async (t) => {
  const f = await fixture(t);
  await mkdir(f.toolsDir);
  await writeFile(f.opaPath, await officialBytes(), { mode: 0o600 });
  const result = await f.install({ fetchImpl: noNetwork });
  assert.equal(result.installed, false);
  assert.equal((await lstat(f.opaPath)).mode & 0o777, 0o755);
});

test('downloads only the exact official URL and keeps staged bytes non-executable', async (t) => {
  const f = await fixture(t);
  const bytes = await officialBytes();
  let downloads = 0;
  const result = await f.install({ fetchImpl: async (url, options) => {
    downloads += 1;
    assert.equal(url, `https://github.com/open-policy-agent/opa/releases/download/v1.21.2/${asset.name}`);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    const stages = await readdir(f.toolsDir);
    assert.equal(stages.length, 1);
    const stage = join(f.toolsDir, stages[0]);
    assert.equal((await lstat(stage)).mode & 0o777, 0o700);
    assert.equal((await lstat(join(stage, 'opa'))).mode & 0o777, 0o600);
    return new Response(bytes);
  } });
  assert.equal(downloads, 1);
  assert.equal(result.installed, true);
  assert.equal(digest(await readFile(f.opaPath)), asset.sha256);
  assert.equal((await lstat(f.opaPath)).mode & 0o777, 0o755);
  assert.deepEqual(await readdir(f.toolsDir), ['opa']);
});

test('rejects corrupt downloaded bytes without executing or retaining them', async (t) => {
  const f = await fixture(t);
  const marker = join(f.root, 'executed');
  const payload = `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad');\n`;
  await assert.rejects(f.install({ fetchImpl: async () => new Response(payload) }), { message: 'checksum_mismatch' });
  assert.equal(existsSync(f.opaPath), false);
  assert.equal(existsSync(marker), false);
  assert.deepEqual(await readdir(f.toolsDir), []);
});

test('follows official HTTPS asset redirects without changing the pinned digest', async (t) => {
  const f = await fixture(t);
  const bytes = await officialBytes();
  let requests = 0;
  await f.install({ fetchImpl: async (url) => {
    requests += 1;
    if (requests === 1) return new Response(null, { status: 302, headers: {
      location: 'https://release-assets.githubusercontent.com/pinned-asset',
    } });
    assert.equal(url, 'https://release-assets.githubusercontent.com/pinned-asset');
    return new Response(bytes);
  } });
  assert.equal(requests, 2);
  assert.equal(digest(await readFile(f.opaPath)), asset.sha256);
});

for (const location of ['https://example.invalid/binary', 'http://github.com/binary', 'https://user:secret@github.com/binary']) {
  test(`rejects an unsafe redirect to ${new URL(location).origin}`, async (t) => {
    const f = await fixture(t);
    let requests = 0;
    await assert.rejects(f.install({ fetchImpl: async () => {
      requests += 1;
      return new Response(null, { status: 302, headers: { location } });
    } }), { message: 'download_failed' });
    assert.equal(requests, 1);
    assert.deepEqual(await readdir(f.toolsDir), []);
  });
}

test('bounds HTTP redirect loops', async (t) => {
  const f = await fixture(t);
  let requests = 0;
  await assert.rejects(f.install({ fetchImpl: async () => {
    requests += 1;
    return new Response(null, { status: 302, headers: { location: 'https://github.com/loop' } });
  } }), { message: 'download_failed' });
  assert.ok(requests <= 6);
});

test('HTTP failures leave no executable and expose only a stable reason', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.install({ fetchImpl: async () => new Response('private_server_detail', { status: 500 }) }), {
    message: 'download_failed',
  });
  assert.deepEqual(await readdir(f.toolsDir), []);
});

test('download timeouts fail closed with a stable reason', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.install({ fetchImpl: async () => {
    throw new DOMException('private_timeout_detail', 'TimeoutError');
  } }), { message: 'download_timeout' });
  assert.deepEqual(await readdir(f.toolsDir), []);
});

test('rejects an oversized declared download before consuming its body', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.install({ fetchImpl: async () => new Response('x', {
    headers: { 'content-length': String(128 * 1024 * 1024 + 1) },
  }) }), { message: 'download_too_large' });
  assert.deepEqual(await readdir(f.toolsDir), []);
});

test('bounds streaming downloads even without a Content-Length header', async (t) => {
  const f = await fixture(t);
  const chunk = new Uint8Array(8 * 1024 * 1024);
  await assert.rejects(f.install({ fetchImpl: async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
  })) }), { message: 'download_too_large' });
  assert.deepEqual(await readdir(f.toolsDir), []);
});

test('a destination planted during download is not chmodded or overwritten', async (t) => {
  const f = await fixture(t);
  const bytes = await officialBytes();
  await assert.rejects(f.install({ fetchImpl: async () => {
    await writeFile(f.opaPath, 'planted_binary', { mode: 0o600 });
    return new Response(bytes);
  } }), { message: 'checksum_mismatch' });
  assert.equal(await readFile(f.opaPath, 'utf8'), 'planted_binary');
  assert.equal((await lstat(f.opaPath)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(f.toolsDir), ['opa']);
});
