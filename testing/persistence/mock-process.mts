import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function startMockProcess(directory: string) {
  const moduleUrl = new URL('../../mock-server/src/service.ts', import.meta.url)
    .href;
  const code = `import {createMockService} from ${JSON.stringify(moduleUrl)}; const service=createMockService(process.env.TEST_DATA_DIR,{controlsEnabled:true}); const server=service.app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));`;
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', code],
    {
      env: { ...process.env, TEST_DATA_DIR: directory },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
  const port = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () =>
      reject(new Error('mock_process_exited_before_ready')),
    );
    child.once('message', (value: unknown) => {
      if (
        value &&
        typeof value === 'object' &&
        'port' in value &&
        typeof value.port === 'number'
      )
        resolve(value.port);
      else reject(new Error('invalid_readiness'));
    });
  });
  return {
    base: `http://127.0.0.1:${port}`,
    async kill() {
      const exit = once(child, 'exit');
      child.kill('SIGKILL');
      await exit;
    },
  };
}
