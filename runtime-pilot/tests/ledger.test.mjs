import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserve, transition, load } from '../ledger.mjs';

test('reserved occurrences cannot be executed a second time or rebound', () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-ledger-'));
  try {
    assert.equal(reserve(dir, 'run-1', 'a'.repeat(64)).reserved, true);
    assert.equal(reserve(dir, 'run-1', 'a'.repeat(64)).reserved, false);
    assert.equal(reserve(dir, 'run-1', 'b'.repeat(64)).reason, 'binding_mismatch');
    assert.equal(load(dir, 'run-1').state, 'reserved');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('possible delivery survives restart as unknown and cannot automatically resend', () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-ledger-'));
  try {
    reserve(dir, 'run-2', 'a'.repeat(64));
    transition(dir, 'run-2', 'reserved', 'inflight');
    assert.equal(reserve(dir, 'run-2', 'a'.repeat(64)).reserved, false);
    assert.equal(load(dir, 'run-2').state, 'inflight');
    transition(dir, 'run-2', 'inflight', 'unknown', { reason: 'acknowledgment_lost' });
    assert.equal(load(dir, 'run-2').state, 'unknown');
    assert.throws(() => transition(dir, 'run-2', 'unknown', 'inflight'));
    transition(dir, 'run-2', 'unknown', 'confirmed', { comment_id: 123 });
    assert.equal(load(dir, 'run-2').comment_id, 123);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('invalid occurrence identifiers never select an arbitrary path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-ledger-'));
  try { assert.throws(() => reserve(dir, '../escape', 'a'.repeat(64))); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('occurrence IDs and bindings reject a trailing newline rather than matching a prefix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'effect-ledger-'));
  try {
    assert.throws(() => reserve(dir, 'run-1\n', 'a'.repeat(64)), /invalid_occurrence/);
    assert.throws(() => reserve(dir, 'run-1', `${'a'.repeat(64)}\n`), /invalid_binding/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
