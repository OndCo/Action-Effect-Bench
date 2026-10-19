import { execFileSync } from 'node:child_process';

export function credentialReaders(execute = execFileSync) {
  const options = { encoding: 'utf8', timeout: 60000, maxBuffer: 32768, stdio: ['ignore', 'pipe', 'pipe'] };
  function get(name, command, args) {
    try {
      const value = execute(command, args, options).trim();
      if (!value || /\s/.test(value)) throw new Error('invalid_credential');
      return value;
    } catch {
      throw new Error(`${name}_auth_unavailable`);
    }
  }
  return {
    github: () => get('github', 'gh', ['auth', 'token', '--hostname', 'github.com']),
    azure: () => ({ kind: 'api-key', value: get('azure', 'az', [
      'cognitiveservices', 'account', 'keys', 'list', '--resource-group', 'Ond_OAI',
      '--name', 'ond-resource', '--query', 'key1', '--output', 'tsv',
    ]) }),
  };
}
