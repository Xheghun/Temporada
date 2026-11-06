import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function start(directory: string) {
  const moduleUrl = new URL('./service.ts', import.meta.url).href;
  const code = `import {createMockService} from ${JSON.stringify(moduleUrl)}; const service=createMockService(process.env.TEST_DATA_DIR,{controlsEnabled:true}); const server=service.app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));`;
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', code],
    {
      env: { ...process.env, TEST_DATA_DIR: directory },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const port = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () =>
      reject(new Error(`Child exited before ready: ${stderr}`)),
    );
    child.once('message', (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'port' in message &&
        typeof message.port === 'number'
      )
        resolve(message.port);
      else reject(new Error('Invalid readiness message'));
    });
  });
  return {
    base: `http://127.0.0.1:${port}`,
    async kill() {
      const stopped = once(child, 'exit');
      child.kill('SIGKILL');
      await stopped;
    },
  };
}

test('SIGKILL after committed response drop preserves session, bytes and one replay effect', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worker-process-'));
  let child = await start(directory);
  const id = randomUUID();
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
    'base64',
  );
  const post = (path: string, body: unknown) =>
    fetch(child.base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    const session = (await (
      await post('/auth/otp/verify', {
        phoneNumber: '+525510000001',
        otp: '123456',
      })
    ).json()) as { token: string };
    const headers = {
      authorization: `Bearer ${session.token}`,
      'x-worker-id': 'ana',
    };
    const upload = () => {
      const data = new FormData();
      data.set('clientActionId', id);
      data.set('documentType', 'passport');
      data.set(
        'image',
        new Blob([bytes], { type: 'image/png' }),
        'passport.png',
      );
      return fetch(child.base + '/me/documents', {
        method: 'POST',
        headers,
        body: data,
      });
    };
    await post('/__dev/failures', { dropNextResponse: true });
    await assert.rejects(upload());
    await child.kill();
    child = await start(directory);
    const replay = await upload();
    assert.equal(replay.status, 200);
    assert.equal(
      ((await replay.json()) as { status: string }).status,
      'pending_review',
    );
    const state = (await (await fetch(child.base + '/__dev/state')).json()) as {
      receipts: { workerId: string }[];
      documentSubmissions: { workerId: string; clientActionId: string }[];
    };
    assert.equal(state.receipts.filter((r) => r.workerId === 'ana').length, 1);
    assert.equal(
      state.documentSubmissions.filter(
        (r) => r.workerId === 'ana' && r.clientActionId === id,
      ).length,
      1,
    );
  } finally {
    await child.kill();
    rmSync(directory, { recursive: true, force: true });
  }
});
