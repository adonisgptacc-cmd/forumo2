import { type Page, type Locator } from "@playwright/test";

export class MessagesPage {
  readonly page: Page;
  readonly threadList: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.threadList = page.locator('[data-testid="thread-list"]');
    this.messageInput = page.locator('[data-testid="message-input"]');
    this.sendButton = page.locator('[data-testid="send-message-btn"]');
    this.messages = page.locator('[data-testid="message"]');
  }

  async goto() {
    await this.page.goto("/app/messages");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoThread(threadId: string) {
    await this.page.goto(`/app/messages/${threadId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async sendMessage(body: string) {
    await this.messageInput.fill(body);
    await this.sendButton.click();
    await this.page.waitForLoadState("networkidle");
  }
}
