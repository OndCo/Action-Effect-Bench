import { randomBytes } from 'node:crypto';
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertPublicValue, digestBytes } from './artifacts.mjs';

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const MAXIMUM = 12;

function checkName(value, reason = 'state_name') {
  if (typeof value !== 'string' || !NAME.test(value)) throw new Error(reason);
}

function syncDirectory(path) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function bytesFor(value) {
  assertPublicValue(value);
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function exclusive(path, bytes) {
  let fd;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('state_exists'); throw error; }
  try { writeFileSync(fd, bytes); fsyncSync(fd); }
  finally { closeSync(fd); }
  syncDirectory(dirname(path));
}

export function writeState(root, name, value) {
  checkName(name);
  const bytes = bytesFor(value);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const path = join(realpathSync(root), name);
  exclusive(path, bytes);
  return path;
}

export function readState(path, expectedSha, maxBytes = 20_000_000) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('state_file');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || info.size > maxBytes) throw new Error('state_size');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let raw;
  try { raw = readFileSync(fd); } finally { closeSync(fd); }
  if (raw.length > maxBytes) throw new Error('state_size');
  const sha256 = digestBytes(raw);
  if (expectedSha !== undefined && sha256 !== expectedSha) throw new Error('state_hash');
  let value;
  try { value = JSON.parse(raw.toString('utf8')); }
  catch { throw new Error('state_json'); }
  assertPublicValue(value);
  return { value, raw, sha256 };
}

export function replaceState(root, name, value) {
  checkName(name);
  const bytes = bytesFor(value), base = realpathSync(root), path = join(base, name);
  readState(path);
  const temporary = join(base, `${name}.${randomBytes(6).toString('hex')}.tmp`);
  exclusive(temporary, bytes);
  renameSync(temporary, path);
  syncDirectory(base);
  return path;
}

export function claimWritePermit(root, runId, occurrence) {
  checkName(runId, 'state_identifier');
  checkName(occurrence, 'state_identifier');
  try { writeState(root, `claim-${digestBytes(occurrence)}.json`, { run_id: runId, occurrence }); }
  catch (error) {
    if (error.message === 'state_exists') throw new Error('occurrence_permit_exists');
    throw error;
  }
  // A reserved or partially written slot is never refunded, including after a crash.
  for (let slot = 0; slot < MAXIMUM; slot += 1) {
    const permit = { run_id: runId, occurrence, slot, maximum: MAXIMUM };
    try {
      writeState(root, `slot-${String(slot).padStart(2, '0')}.json`, permit);
      return permit;
    } catch (error) { if (error.message !== 'state_exists') throw error; }
  }
  throw new Error('write_ceiling');
}

export function readWritePermits(root) {
  return readdirSync(root).filter((name) => /^slot-\d{2}\.json$/.test(name)).sort()
    .map((name) => readState(join(root, name)).value);
}

export function scenarioPolicy(scenario, variant) {
  if (!['initial', 'revoked', 'narrowed'].includes(variant)) throw new Error('policy_variant');
  const params = scenario.native.lane === 'mcp' ? scenario.native.call.arguments : scenario.native.call;
  if (params.owner !== 'OndCo' || params.repo !== 'Action-Effect-Bench' ||
      !Number.isSafeInteger(params.issue_number) || params.issue_number <= 1) throw new Error('policy_target');
  return {
    revision: `owned-write-${variant}`, principal: scenario.context.principal,
    revoked: variant === 'revoked', allow_partial_direct: true,
    max_body_bytes: variant === 'narrowed' ? 1 : 8192,
    grants: [{ repository: `${params.owner}/${params.repo}`, issue_number: params.issue_number,
      data_class: scenario.context.data_class }],
  };
}
