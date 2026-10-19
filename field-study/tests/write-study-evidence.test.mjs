import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { digestBytes } from '../artifacts.mjs';
import { replayOwnedStudy } from '../write-replay.mjs';

const reports = new URL('../../reports/', import.meta.url);
const bytes = readFileSync(new URL('owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json', reports));
assert.equal(digestBytes(bytes), '735bfdfc5c5ae993f64b6374ec599bf4ee76429dbcf995305cc2c9c3832ff6d7');
const fresh = () => JSON.parse(bytes);
const readJournal = name => {
  assert.match(name, /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/);
  return readFileSync(new URL(name, reports));
};

test('recorded native study reconstructs twenty fresh workers without provider calls', () => {
  const result = replayOwnedStudy(fresh(), { readJournal });
  assert.equal(result.valid, true);
  assert.equal(result.worker_processes, 20);
  assert.equal(result.comment_calls, 5);
  assert.equal(result.current_comment_objects, 5);
  assert.equal(result.task_layer_withheld, 4);
  assert.equal(result.retained_unknown, 1);
  assert.equal(result.duplicate_probes_without_send, 8);
});

const mutations = [
  ['stopped status', study => { study.status = 'stopped'; }],
  ['missing scenario', study => { study.cases.pop(); }],
  ['missing phase', study => { study.phases.pop(); }],
  ['reused worker PID', study => { study.phases[1].process.pid = study.phases[0].process.pid; }],
  ['extra provider object', study => { study.current_comments.push({ ...study.current_comments[0], id: 999 }); }],
  ['changed provider body', study => { study.current_comments[0].body += 'changed'; }],
  ['false successful crash recovery', study => {
    study.phases.find(phase => phase.id === 'fault-pre-send-crash.reconcile').result.outcome = 'confirmed';
  }],
  ['relabeled ordinary outcome', study => { study.phases[0].result.outcome = 'unknown'; }],
  ['changed current policy', study => {
    study.phases.find(phase => phase.id === 'fault-revoked.execute').policy_after.revoked = false;
  }],
  ['missing call permit', study => { study.write_permits.pop(); }],
  ['changed manifest bytes', study => { study.manifest_bytes += ' '; }],
  ['self-consistent altered expected plan', study => {
    study.manifest.plan.expected_comment_objects = 6;
    study.manifest_bytes = JSON.stringify(study.manifest);
    study.manifest_sha256 = digestBytes(study.manifest_bytes);
  }],
];
for (const [name, mutate] of mutations) test(`recorded study refuses ${name}`, () => {
  const study = fresh();
  mutate(study);
  assert.throws(() => replayOwnedStudy(study, { readJournal }));
});

test('missing raw phase journal is not reconstructed from summary fields', () => {
  const study = fresh();
  assert.throws(() => replayOwnedStudy(study, { readJournal(name) {
    if (name === study.phases[0].journal.file) throw new Error('missing_raw_phase');
    return readJournal(name);
  } }), /missing_raw_phase/);
});

test('raw native journal corruption remains a failure even when the study summary is unchanged', () => {
  const study = fresh();
  assert.throws(() => replayOwnedStudy(study, { readJournal(name) {
    const raw = readJournal(name);
    return name === study.phases[0].journal.file ? raw.subarray(0, raw.length - 1) : raw;
  } }), /replay_journal/);
});

test('the earlier failed attempt cannot be omitted from the adoption evidence', () => {
  const study = fresh();
  assert.throws(() => replayOwnedStudy(study, { readJournal(name) {
    if (name === study.manifest.reuse_of_unstarted_setup.previous_study_file) return Buffer.from('{}');
    return readJournal(name);
  } }), /replay_previous_study_hash/);
});
