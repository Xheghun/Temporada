import assert from 'node:assert/strict';

const applicationId = 'com.cremedigital.seasonalworker.e2e';
const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Device mutations are limited to the dedicated emulator and E2E package. */
export function androidDevice({ adb, flow }) {
  return {
    async settings() {
      return {
        airplane: await adb(
          'shell',
          'settings',
          'get',
          'global',
          'airplane_mode_on',
        ),
        wifi: await adb('shell', 'settings', 'get', 'global', 'wifi_on'),
        fontScale: await adb(
          'shell',
          'settings',
          'get',
          'system',
          'font_scale',
        ),
      };
    },
    async offline() {
      await flow('probe-airplane');
      await adb('shell', 'svc', 'wifi', 'disable');
      assert.equal(
        await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'),
        '1',
      );
      assert.equal(
        await adb('shell', 'settings', 'get', 'global', 'wifi_on'),
        '0',
      );
      await flow('device-offline');
    },
    async online() {
      await flow('probe-airplane-off');
      await adb('shell', 'svc', 'wifi', 'enable');
      assert.equal(
        await adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'),
        '0',
      );
      await flow('device-online');
    },
    async forceStop() {
      await adb('shell', 'am', 'force-stop', applicationId);
    },
    async relaunch() {
      await adb(
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        `${applicationId}/.MainActivity`,
      );
      await flow('device-home');
    },
    async reboot() {
      await adb('reboot');
      await adb('wait-for-device');
      const deadline = Date.now() + 120_000;
      while ((await adb('shell', 'getprop', 'sys.boot_completed')) !== '1') {
        assert(Date.now() < deadline, 'Emulator reboot deadline exceeded');
        await pause(500);
      }
      await adb('shell', 'input', 'keyevent', '82');
      // ADB reverse mappings do not survive emulator reboot.
      await adb('reverse', 'tcp:3101', 'tcp:3101');
    },
    async restore(settings) {
      const errors = [];
      for (const restore of [
        () =>
          flow(
            settings.airplane === '1' ? 'probe-airplane' : 'probe-airplane-off',
          ),
        () =>
          adb(
            'shell',
            'svc',
            'wifi',
            settings.wifi === '0' ? 'disable' : 'enable',
          ),
        () =>
          settings.fontScale === 'null'
            ? adb('shell', 'settings', 'delete', 'system', 'font_scale')
            : adb(
                'shell',
                'settings',
                'put',
                'system',
                'font_scale',
                settings.fontScale,
              ),
      ]) {
        try {
          await restore();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(errors, 'Device settings restoration failed');
    },
  };
}
