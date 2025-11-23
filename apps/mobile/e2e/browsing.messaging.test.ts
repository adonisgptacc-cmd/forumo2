/* eslint-env detox/detox, jest */

describe('Marketplace browsing', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await element(by.id('get-started-button')).tap();
    await element(by.text('Use demo account')).tap();
  });

  it('shows discovery listings with demo data', async () => {
    await expect(element(by.id('listing-discovery'))).toBeVisible();
    await expect(element(by.id('listing-card-11111111-2222-3333-4444-555555555555'))).toBeVisible();
  });

  it('opens inbox and replies in a thread', async () => {
    await element(by.text('Inbox')).tap();
    await expect(element(by.id('messaging-inbox'))).toBeVisible();
    await element(by.id('thread-card-123e4567-e89b-12d3-a456-426614174000')).tap();
    await expect(element(by.id('thread-screen'))).toBeVisible();
    await element(by.id('message-input')).typeText('Appreciate the quick response!');
    await element(by.id('send-message-button')).tap();
    await expect(element(by.text('Appreciate the quick response!'))).toBeVisible();
  });
});
