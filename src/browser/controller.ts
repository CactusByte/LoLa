import { chromium, Browser, Page } from "playwright";

/**
 * Browser Controller (Playwright)
 * Manages browser lifecycle and provides page access
 */
export class BrowserController {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async ensure(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: false }); // set true on servers
      const ctx = await this.browser.newContext();
      this.page = await ctx.newPage();
    }
    if (!this.page) throw new Error("Browser page not initialized");
    return this.page;
  }

  async close() {
    await this.page?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.page = null;
    this.browser = null;
  }
}

