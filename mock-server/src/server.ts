import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockService } from './service.ts';

const directory = process.env.MOCK_DATA_DIR
  ? resolve(process.env.MOCK_DATA_DIR)
  : fileURLToPath(new URL('../.data', import.meta.url));
const port = Number(process.env.MOCK_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid MOCK_PORT');
if (process.env.NODE_ENV === 'production')
  throw new Error(
    'This fictional OTP mock must not run as a production service',
  );
const { app, store } = createMockService(directory, {
  controlsEnabled: process.env.MOCK_ENABLE_CONTROLS === '1',
});
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Worker mock listening on http://127.0.0.1:${port}`);
});
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
