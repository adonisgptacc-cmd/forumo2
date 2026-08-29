import { type Page, type Locator } from "@playwright/test";

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('[data-testid="register-name"]');
    this.emailInput = page.locator('[data-testid="register-email"]');
    this.phoneInput = page.locator('[data-testid="register-phone"]');
    this.passwordInput = page.locator('[data-testid="register-password"]');
    this.submitButton = page.locator('[data-testid="register-submit"]');
  }

  async goto() {
    await this.page.goto("/signup");
    await this.page.waitForLoadState("networkidle");
  }

  async register(params: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    await this.nameInput.fill(params.name);
    await this.emailInput.fill(params.email);
    await this.phoneInput.fill(params.phone);
    await this.passwordInput.fill(params.password);
    await this.submitButton.click();
    await this.page.waitForLoadState("networkidle");
  }
}
