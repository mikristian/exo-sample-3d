/** Server-side archive index lookup. Never import this module into the browser bundle. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../../integrations/clothcraft/pattern-archive-search-20261102.py', import.meta.url));

export function searchExoArchivePatterns(filters = {}, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    const errors = [];
    let size = 0;
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) child.kill('SIGKILL');
      else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Archive query failed (${code}): ${Buffer.concat(errors).toString().slice(0, 500)}`));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(filters ?? {}));
  });
}
