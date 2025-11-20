/* eslint-env detox/detox, jest */

describe('Navigation shell snapshot', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('captures the root shell', async () => {
    await expect(element(by.id('navigation-shell'))).toBeVisible();
    await device.takeScreenshot('navigation-shell');
  });
});
