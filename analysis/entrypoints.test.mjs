import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

for (const name of ['publication-fit.mjs', 'review-audit.mjs']) {
  test(`${name} rejects missing CLI arguments when launched through a symlink`, () => {
    const root = mkdtempSync(join(tmpdir(), 'action-effect-analysis-entry-'));
    try {
      const alias = join(root, 'entry.mjs');
      symlinkSync(fileURLToPath(new URL(name, import.meta.url)), alias);
      const result = spawnSync(process.execPath, [alias], { encoding: 'utf8', timeout: 15000 });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.notEqual(result.status, 0, 'must not silently exit without performing the requested check');
      assert.match(result.stderr, /Expected/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('importing analysis modules does not start their command-line work', () => {
  const paths = ['publication-fit.mjs', 'review-audit.mjs'].map(name => new URL(name, import.meta.url).href);
  const source = paths.map(path => `await import(${JSON.stringify(path)});`).join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
