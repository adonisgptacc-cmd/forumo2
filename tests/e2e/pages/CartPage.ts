import { type Page, type Locator } from "@playwright/test";

export class CartPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.checkoutButton = page.locator('[data-testid="checkout-btn"]');
    this.clearButton = page.locator('[data-testid="clear-cart-btn"]');
  }

  async goto() {
    await this.page.goto("/app/cart");
    await this.page.waitForLoadState("networkidle");
  }

  async getItemCount(): Promise<number> {
    return this.cartItems.count();
  }
}
