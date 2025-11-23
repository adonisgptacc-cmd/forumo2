/* eslint-env detox/detox, jest */

describe('Onboarding flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('navigates from onboarding to login', async () => {
    await expect(element(by.id('onboarding-screen'))).toBeVisible();
    await element(by.id('get-started-button')).tap();
    await expect(element(by.id('login-screen'))).toBeVisible();
  });
});
