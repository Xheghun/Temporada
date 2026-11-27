import assert from 'node:assert/strict';
import test from 'node:test';
import { require360DpDisplay } from './display-geometry.mts';

test('the actual 360dp framebuffer satisfies the layout target', () => {
  assert.equal(
    require360DpDisplay('Physical size: 360x720', 'Physical density: 160'),
    360,
  );
});

test('Android 9 clamping cannot be reported as the requested layout width', () => {
  assert.throws(
    () =>
      require360DpDisplay(
        'Physical size: 320x640\nOverride size: 640x1280',
        'Physical density: 160\nOverride density: 480',
      ),
    /got 213/,
  );
});

test('missing display observations cannot satisfy the layout target', () => {
  assert.throws(() => require360DpDisplay('', ''), /geometry unavailable/);
});
