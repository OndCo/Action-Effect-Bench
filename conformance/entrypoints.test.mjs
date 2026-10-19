import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function linkedInvocation(name, args) {
  const directory = mkdtempSync(join(tmpdir(), 'effect-bench-link-'));
  try {
    const alias = join(directory, name);
    symlinkSync(fileURLToPath(new URL(name, import.meta.url)), alias);
    return spawnSync(process.execPath, [alias, ...args], {
      cwd: directory, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('a symlinked runner rejects invalid arguments instead of silently exiting zero', () => {
  const result = linkedInvocation('run.mjs', ['--unsupported']);
  assert.equal(result.status, 2, 'The runner must enter its command-line handler');
  assert.match(result.stderr, /Usage: node conformance\/run\.mjs/);
});

test('a symlinked case generator actually checks the frozen corpus', () => {
  const result = linkedInvocation('case-source.mjs', ['--check']);
  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(result.stdout.trim(), '', 'Zero output cannot be a verified corpus');
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.count, 80);
  assert.equal(summary.mode, '--check');
  assert.equal(summary.file_sha256, '8fd3ef99d7137b383dc1a69388d6a23c6bba58e73e62672d88adbfa619ea6dce');
});

test('both benchmark modules remain import-safe from stdin', () => {
  const urls = ['run.mjs', 'case-source.mjs'].map(name => new URL(name, import.meta.url).href);
  const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
    input: `for (const url of ${JSON.stringify(urls)}) await import(url); console.log('import-only');`,
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'import-only\n');
});
