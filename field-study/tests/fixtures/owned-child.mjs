import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const mode = process.argv[2];
if (mode === 'finish') process.send({ type: 'finished', result_file: 'result.json' }, () => process.disconnect());
else if (mode === 'checkpoint') {
  process.on('message', message => {
    if (message.type === 'continue' && message.stage === 'test-cut') {
      process.send({ type: 'finished', result_file: 'result.json' }, () => process.disconnect());
    }
  });
  process.send({ type: 'checkpoint', stage: 'test-cut' });
} else if (mode === 'bad') process.send({ type: 'run_command', command: 'not allowed' });
else if (mode === 'silent') process.disconnect();
else if (mode === 'wait') setInterval(() => {}, 1000);
else if (mode === 'orphan') {
  const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  writeFileSync(process.argv[3], String(descendant.pid));
  descendant.unref();
  process.disconnect();
}
