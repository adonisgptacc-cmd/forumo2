import { type Page, type Locator, expect } from "@playwright/test";

export class BrowsePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly itemCards: Locator;
  readonly createButton: Locator;
  readonly noResults: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.itemCards = page.locator('[data-testid="item-card"]');
    this.createButton = page.locator('[data-testid="create-btn"]');
    this.noResults = page.locator('[data-testid="no-results"]');
  }

  async goto() {
    await this.page.goto("/listings");
    await this.page.waitForLoadState("networkidle");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Avoid hard timeouts — wait for search network response if backend is present, otherwise networkidle
    await this.page.waitForLoadState("networkidle");
  }

  async getItemCount(): Promise<number> {
    return this.itemCards.count();
  }

  async expectItemVisible(text: RegExp | string) {
    await expect(this.itemCards.first()).toContainText(text);
  }
}
