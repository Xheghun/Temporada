import './build-isolation-fixture.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createMediaFixture } from './media-fixture.mjs';

await mkdir('e2e-results', { recursive: true });
await createMediaFixture(path.resolve('e2e-results/camera-feed.png'));
