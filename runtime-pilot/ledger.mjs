import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync, fsyncSync,
  renameSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const edges = { reserved: ['inflight', 'withheld'], inflight: ['unknown', 'confirmed'], unknown: ['confirmed'] };

function pathFor(root, occurrence) {
  if (typeof occurrence !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(occurrence)) {
    throw new Error('invalid_occurrence');
  }
  return join(root, `${createHash('sha256').update(occurrence).digest('hex')}.json`);
}

function syncDirectory(root) {
  const fd = openSync(root, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

export function load(root, occurrence) {
  const value = JSON.parse(readFileSync(pathFor(root, occurrence), 'utf8'));
  if (value.occurrence !== occurrence || typeof value.binding !== 'string' || typeof value.state !== 'string') {
    throw new Error('invalid_ledger');
  }
  return value;
}

export function reserve(root, occurrence, binding) {
  if (typeof binding !== 'string' || !/^[a-f0-9]{64}$/.test(binding)) throw new Error('invalid_binding');
  const path = pathFor(root, occurrence);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  let fd;
  try { fd = openSync(path, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = load(root, occurrence);
    return { reserved: false, reason: existing.binding === binding ? 'already_reserved' : 'binding_mismatch', state: existing.state };
  }
  try {
    writeFileSync(fd, JSON.stringify({ occurrence, binding, state: 'reserved', revision: 0 }));
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDirectory(root);
  return { reserved: true, state: 'reserved' };
}

export function transition(root, occurrence, from, to, metadata = {}) {
  if (!edges[from]?.includes(to)) throw new Error('invalid_transition');
  if (Object.keys(metadata).some(key => !['reason', 'comment_id', 'content_sha256', 'pre_dispatch_comment_ids'].includes(key))) {
    throw new Error('invalid_metadata');
  }
  if (metadata.pre_dispatch_comment_ids !== undefined) {
    const ids = metadata.pre_dispatch_comment_ids;
    if (from !== 'reserved' || to !== 'inflight' || !Array.isArray(ids) || ids.length > 500
      || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
      throw new Error('invalid_preflight_metadata');
    }
  }
  const path = pathFor(root, occurrence), lock = `${path}.lock`;
  // A crashed lock is not automatically stolen. Recovery must withhold work.
  mkdirSync(lock, { mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const current = load(root, occurrence);
    if (current.state !== from) throw new Error('state_conflict');
    const next = { ...current, ...metadata, state: to, revision: current.revision + 1 };
    const fd = openSync(temp, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(next)); fsyncSync(fd); }
    finally { closeSync(fd); }
    renameSync(temp, path);
    syncDirectory(root);
    return next;
  } finally {
    try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    rmdirSync(lock);
  }
}
