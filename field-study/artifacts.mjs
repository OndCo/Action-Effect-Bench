import { createHash, randomBytes } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const PRIVATE_KEYS = /^(?:api[_-]?key|access[_-]?token|authorization|encrypted_content|refresh[_-]?token|client[_-]?secret|password|cookie|set-cookie)$/i;
const CREDENTIAL = /(?:\bgh[opusr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bBearer\s+[A-Za-z0-9._~-]{16,}|\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/;
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;

export function digestBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertPublicValue(value, seen = new Set(), depth = 0) {
  if (depth > 64) throw new Error('value_too_deep');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite');
    return;
  }
  if (typeof value === 'string') {
    if (CREDENTIAL.test(value)) throw new Error('credential_value');
    return;
  }
  if (typeof value !== 'object') throw new Error('unsupported_public_value');
  if (seen.has(value)) throw new Error('cyclic_public_value');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('unsupported_public_object');
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_KEYS.test(key)) throw new Error('private_field');
    assertPublicValue(child, seen, depth + 1);
  }
  seen.delete(value);
}

function durableWrite(path, bytes, flag) {
  const fd = openSync(path, flag, 0o600);
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function safeName(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) throw new Error('invalid_run_id');
}

export function createJournal(root, runId, metadata) {
  safeName(runId);
  assertPublicValue(metadata);
  mkdirSync(root, { recursive: true });
  const path = join(root, `${runId}.jsonl`);
  let sequence = 0, previous = null, sealed = false;
  function write(event, flag = 'a') {
    assertPublicValue(event);
    const record = { sequence, previous_sha256: previous, recorded_at: new Date().toISOString(), event };
    const sha256 = digestBytes(JSON.stringify(record));
    const line = `${JSON.stringify({ ...record, sha256 })}\n`;
    durableWrite(path, line, flag);
    sequence += 1;
    previous = digestBytes(line);
  }
  write({ type: 'begin', run_id: runId, metadata }, 'wx');
  return {
    path,
    append(event) {
      if (sealed) throw new Error('journal_sealed');
      if (!event || typeof event.type !== 'string' || ['begin', 'end'].includes(event.type)) throw new Error('invalid_event_type');
      write(event);
    },
    seal(outcome) {
      if (sealed) throw new Error('journal_sealed');
      write({ type: 'end', outcome });
      sealed = true;
      return { path, sha256: digestBytes(readFileSync(path)), records: sequence };
    },
  };
}

export function verifyJournal(bytes) {
  try {
    const text = Buffer.from(bytes).toString('utf8');
    if (!text.endsWith('\n') || !Buffer.from(text).equals(Buffer.from(bytes))) throw new Error('incomplete_or_invalid_bytes');
    const lines = text.slice(0, -1).split('\n');
    let previous = null, complete = false;
    for (let index = 0; index < lines.length; index += 1) {
      const parsed = JSON.parse(lines[index]);
      assertPublicValue(parsed);
      const { sequence, previous_sha256, recorded_at, event, sha256 } = parsed;
      const record = { sequence, previous_sha256, recorded_at, event };
      if (JSON.stringify({ ...record, sha256 }) !== lines[index] || sequence !== index || previous_sha256 !== previous) throw new Error('invalid_chain');
      if (typeof recorded_at !== 'string' || !Number.isFinite(Date.parse(recorded_at)) || !event || typeof event.type !== 'string') throw new Error('invalid_record');
      if (digestBytes(JSON.stringify(record)) !== sha256) throw new Error('invalid_record_hash');
      if ((index === 0) !== (event.type === 'begin') || complete) throw new Error('invalid_record_order');
      complete = event.type === 'end';
      previous = digestBytes(`${lines[index]}\n`);
    }
    return { valid: true, complete, records: lines.length, sha256: digestBytes(bytes) };
  } catch (error) {
    return { valid: false, complete: false, reason: error.message };
  }
}

export function saveArtifact(root, prefix, value) {
  safeName(prefix);
  assertPublicValue(value);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  const sha256 = digestBytes(bytes);
  const name = `${prefix}-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(4).toString('hex')}.json`;
  mkdirSync(root, { recursive: true });
  const path = join(root, name);
  durableWrite(path, bytes, 'wx');
  durableWrite(`${path}.sha256`, `${sha256}  ${basename(path)}\n`, 'wx');
  return { path, sha256 };
}
