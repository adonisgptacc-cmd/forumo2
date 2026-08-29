import { type Page, type Locator } from "@playwright/test";

export class CheckoutPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly continueToPaymentButton: Locator;
  readonly payButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1, [data-testid="checkout-heading"]');
    this.continueToPaymentButton = page.locator(
      '[data-testid="continue-to-payment"]',
    );
    this.payButton = page.locator('[data-testid="pay-btn"]');
  }

  async goto() {
    await this.page.goto("/app/checkout");
    await this.page.waitForLoadState("networkidle");
  }
}
