import { type Page, type Locator } from "@playwright/test";

export class ListingPage {
  readonly page: Page;
  readonly title: Locator;
  readonly price: Locator;
  readonly buyButton: Locator;
  readonly wishlistButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('[data-testid="listing-title"]');
    this.price = page.locator('[data-testid="listing-price"]');
    this.buyButton = page.locator('[data-testid="buy-now-btn"]');
    this.wishlistButton = page.locator('[data-testid="wishlist-btn"]');
  }

  async goto(id: string) {
    await this.page.goto(`/listings/${id}`);
    await this.page.waitForLoadState("networkidle");
  }
}
