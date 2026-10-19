import { createHash } from 'node:crypto';
import { constants, realpathSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const modulePath = realpathSync(fileURLToPath(import.meta.url));
const runtimeDir = dirname(modulePath);
const MAX_BINARY_BYTES = 128 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const assetNames = {
  'darwin-arm64': 'opa_darwin_arm64',
  'darwin-x64': 'opa_darwin_amd64',
  'linux-x64': 'opa_linux_amd64_static',
  'linux-arm64': 'opa_linux_arm64_static',
};
const reasons = new Set([
  'unsupported_platform', 'invalid_install_options', 'invalid_tools_manifest',
  'unsafe_tools_directory', 'unsafe_opa_path', 'checksum_mismatch',
  'download_failed', 'download_timeout', 'download_too_large', 'installation_failed',
]);
const fail = (reason) => { throw new Error(reason); };
const exactKeys = (value, keys) => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).length === keys.length
  && keys.every((key) => Object.hasOwn(value, key));

async function readManifest() {
  let handle;
  try {
    handle = await open(join(runtimeDir, 'tools.json'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 16_384) fail('invalid_tools_manifest');
    const manifest = JSON.parse(await handle.readFile('utf8'));
    const opa = manifest?.opa;
    if (!exactKeys(manifest, ['opa']) || !exactKeys(opa, ['version', 'release', 'assets'])
      || typeof opa.version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(opa.version)
      || opa.release !== `https://github.com/open-policy-agent/opa/releases/tag/v${opa.version}`
      || !exactKeys(opa.assets, Object.keys(assetNames))) fail('invalid_tools_manifest');
    for (const [platform, name] of Object.entries(assetNames)) {
      const asset = opa.assets[platform];
      if (!exactKeys(asset, ['name', 'sha256']) || asset.name !== name
        || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) fail('invalid_tools_manifest');
    }
    return opa;
  } catch {
    fail('invalid_tools_manifest');
  } finally {
    await handle?.close();
  }
}

async function checkDirectory(path, expected) {
  let stat;
  try { stat = await lstat(path); } catch { fail('unsafe_tools_directory'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || (expected && (stat.dev !== expected.dev || stat.ino !== expected.ino))) fail('unsafe_tools_directory');
  return stat;
}

async function toolsDirectory(path) {
  try { await mkdir(path, { mode: 0o700 }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return checkDirectory(path);
}

async function verifyExisting(path, sha256, toolsDir, directoryStat) {
  await checkDirectory(toolsDir, directoryStat);
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('unsafe_opa_path');
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || stat.dev !== opened.dev || stat.ino !== opened.ino) fail('unsafe_opa_path');
    if (opened.size > MAX_BINARY_BYTES) fail('checksum_mismatch');
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      size += chunk.length;
      if (size > MAX_BINARY_BYTES) fail('checksum_mismatch');
      hash.update(chunk);
    }
    if (hash.digest('hex') !== sha256) fail('checksum_mismatch');
    await checkDirectory(toolsDir, directoryStat);
    const current = await lstat(path);
    if (!current.isFile() || current.nlink !== 1 || current.dev !== opened.dev || current.ino !== opened.ino
      || current.size !== opened.size || current.mtimeMs !== opened.mtimeMs || current.ctimeMs !== opened.ctimeMs) fail('unsafe_opa_path');
    // Use the verified descriptor, never chmod through a caller-replaceable path.
    if ((opened.mode & 0o777) !== 0o755) await handle.chmod(0o755);
    return true;
  } catch (error) {
    if (error.code === 'ELOOP') fail('unsafe_opa_path');
    throw error;
  } finally {
    await handle?.close();
  }
}

function officialURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname)) {
    fail('download_failed');
  }
  return url.href;
}

async function download(handle, initialURL, sha256, fetchImpl) {
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  let response;
  try {
    let url = officialURL(initialURL);
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      response = await fetchImpl(url, { redirect: 'manual', signal });
      if (response.status === 200) break;
      await response.body?.cancel();
      if (![301, 302, 303, 307, 308].includes(response.status) || redirects === 5) fail('download_failed');
      const location = response.headers.get('location');
      if (!location) fail('download_failed');
      url = officialURL(new URL(location, url).href);
    }
    if (!response.body) fail('download_failed');
    const declaredSize = response.headers.get('content-length');
    if (declaredSize !== null) {
      if (!/^\d+$/.test(declaredSize)) fail('download_failed');
      if (BigInt(declaredSize) > BigInt(MAX_BINARY_BYTES)) fail('download_too_large');
    }
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of response.body) {
      signal.throwIfAborted();
      size += chunk.byteLength;
      if (size > MAX_BINARY_BYTES) fail('download_too_large');
      await handle.writeFile(chunk);
      hash.update(chunk);
    }
    if (hash.digest('hex') !== sha256) fail('checksum_mismatch');
    await handle.sync();
  } catch (error) {
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    if (signal.aborted || error.name === 'TimeoutError' || error.name === 'AbortError') fail('download_timeout');
    fail(reasons.has(error.message) ? error.message : 'download_failed');
  }
}

// Options are local bootstrap/test controls, never native action/request fields.
export async function installTools(options = {}) {
  let stagingDir;
  let handle;
  let directoryStat;
  const toolsDir = join(runtimeDir, '.tools');
  const opaPath = join(toolsDir, 'opa');
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => !['platform', 'arch', 'fetchImpl'].includes(key))) fail('invalid_install_options');
    const { platform = process.platform, arch = process.arch, fetchImpl = globalThis.fetch } = options;
    const platformKey = `${platform}-${arch}`;
    if (!Object.hasOwn(assetNames, platformKey)) fail('unsupported_platform');
    if (typeof fetchImpl !== 'function') fail('invalid_install_options');
    const opa = await readManifest();
    const asset = opa.assets[platformKey];
    directoryStat = await toolsDirectory(toolsDir);
    const result = { opaPath, version: opa.version, sha256: asset.sha256, installed: false };
    if (await verifyExisting(opaPath, asset.sha256, toolsDir, directoryStat)) return result;

    stagingDir = await mkdtemp(join(toolsDir, '.opa-'));
    const stagingPath = join(stagingDir, 'opa');
    handle = await open(stagingPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    const url = `https://github.com/open-policy-agent/opa/releases/download/v${opa.version}/${asset.name}`;
    await download(handle, url, asset.sha256, fetchImpl);
    // Recheck before publication so a file planted during the download is not trusted.
    if (await verifyExisting(opaPath, asset.sha256, toolsDir, directoryStat)) return result;
    await handle.chmod(0o755);
    await handle.close();
    handle = undefined;
    await checkDirectory(toolsDir, directoryStat);
    await rename(stagingPath, opaPath);
    return { ...result, installed: true };
  } catch (error) {
    fail(reasons.has(error.message) ? error.message : 'installation_failed');
  } finally {
    await handle?.close();
    if (stagingDir) {
      // Never clean up through a replaced/symlinked parent directory.
      try {
        await checkDirectory(toolsDir, directoryStat);
        await rm(stagingDir, { recursive: true, force: true });
      } catch { /* A displaced private staging directory must be removed by its owner. */ }
    }
  }
}

function isMain() {
  if (!process.argv[1] || process.execArgv.some((arg) => /^(?:-e|-p|--eval|--print)(?:=|$)/.test(arg))) return false;
  try { return realpathSync(process.argv[1]) === modulePath; } catch { return false; }
}

if (isMain()) {
  try {
    if (process.argv.length !== 2) throw new Error('invalid_arguments');
    process.stdout.write(`${JSON.stringify(await installTools())}\n`);
  } catch (error) {
    process.stderr.write(`opa_installation_failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
