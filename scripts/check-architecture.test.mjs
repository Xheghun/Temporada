import assert from 'node:assert/strict';
import test from 'node:test';
import { checkArchitecture } from './check-architecture.mjs';

test('rejects native and persistence imports in domain including dynamic imports', () => {
  assert.equal(
    checkArchitecture({
      'src/features/terms/domain/a.ts':
        "import('expo-sqlite'); import db from '@/core/database/db';",
    }).length,
    2,
  );
});
test('rejects private imports between features but permits public entry points', () => {
  assert.equal(
    checkArchitecture({
      'src/features/terms/data/a.ts':
        "import x from '@/features/documents/data/private'; import y from '@/features/documents/index';",
    }).length,
    1,
  );
});
test('detects alias/relative circular dependencies', () => {
  assert.match(
    checkArchitecture({
      'src/core/a.ts': "import './b'",
      'src/core/b.ts': "import '@/core/a'",
    }).join(),
    /Circular/,
  );
});
test('screens cannot bypass services for sync/transport or raw fetch', () => {
  assert.equal(
    checkArchitecture({
      'app/index.tsx': "import x from '@/core/sync/engine'; fetch('x');",
    }).length,
    2,
  );
});
test('accepts domain interface and application service separation', () => {
  assert.deepEqual(
    checkArchitecture({
      'app/index.tsx': "import '@/features/terms/index';",
      'src/features/terms/index.ts': "export * from './domain/terms';",
      'src/features/terms/domain/terms.ts':
        'export interface Terms { version: string }',
    }),
    [],
  );
});
