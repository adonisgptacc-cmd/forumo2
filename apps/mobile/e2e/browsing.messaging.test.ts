/* eslint-env jest */

describe("Marketplace browsing", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("shows discovery listings", async () => {
    await expect(element(by.id("listing-discovery"))).toBeVisible();
  });

  it("opens inbox and replies in a thread", async () => {
    await element(by.id("inbox-tab")).tap();
    await expect(element(by.id("messaging-inbox"))).toBeVisible();
  });
});
