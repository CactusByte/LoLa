import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { BrowserController } from "../browser/index.js";
import { logger } from "../utils/index.js";

/**
 * Browser Tools
 * Web browsing actions for the agent.
 * Keep tool outputs concise. The agent only needs enough info to plan next actions.
 */

export function createBrowserTools(browserController: BrowserController) {
  const gotoTool = tool(
    async ({ url }: { url: string }) => {
      logger.browser(`Navigating to: ${url}`);
      const page = await browserController.ensure();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      logger.browser(`Page loaded: "${title}"`);
      return `Navigated to ${url}. Title: ${title}`;
    },
    {
      name: "browser_goto",
      description: "Navigate the browser to a URL.",
      schema: z.object({
        url: z.string().url(),
      }),
    }
  );

  const clickTool = tool(
    async ({ selector }: { selector: string }) => {
      logger.browser(`Attempting to click: ${selector}`);
      const page = await browserController.ensure();
      
      try {
        // Wait for the element to be visible and clickable
        await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
        
        // Check if element exists and is visible
        const element = await page.$(selector);
        if (!element) {
          const error = `Element not found: ${selector}`;
          logger.browser(`✗ ${error}`);
          return `ERROR: ${error}. Use browser_find_links or browser_find_by_text to find the correct selector.`;
        }

        // Check if element is visible
        const isVisible = await element.isVisible();
        if (!isVisible) {
          const error = `Element exists but is not visible: ${selector}`;
          logger.browser(`✗ ${error}`);
          return `ERROR: ${error}. The element might be hidden or require scrolling.`;
        }

        // Try to click
        await page.click(selector, { timeout: 15000 });
        logger.browser(`✓ Successfully clicked: ${selector}`);
        
        // Wait a bit for page to respond
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return `Successfully clicked: ${selector}`;
      } catch (e: any) {
        const errorMsg = e?.message ?? String(e);
        logger.browser(`✗ Click failed: ${errorMsg}`);
        return `ERROR clicking ${selector}: ${errorMsg}. Try using browser_find_by_text to find the element by its text content, or browser_find_links to see all clickable links.`;
      }
    },
    {
      name: "browser_click",
      description: "Left click an element using a CSS selector. The element must be visible and clickable. If the selector doesn't work, use browser_find_by_text or browser_find_links first.",
      schema: z.object({
        selector: z.string(),
      }),
    }
  );

  const rightClickTool = tool(
    async ({ selector }: { selector: string }) => {
      logger.browser(`Right-clicking: ${selector}`);
      const page = await browserController.ensure();
      await page.click(selector, { button: "right", timeout: 15000 });
      logger.browser(`✓ Right-clicked: ${selector}`);
      return `Right-clicked selector: ${selector}`;
    },
    {
      name: "browser_right_click",
      description: "Right click an element using a CSS selector.",
      schema: z.object({
        selector: z.string(),
      }),
    }
  );

  const typeTool = tool(
    async ({ selector, text, pressEnter }: { selector: string; text: string; pressEnter?: boolean }) => {
      logger.browser(`Typing into ${selector}: "${text}"${pressEnter ? " (will press Enter)" : ""}`);
      const page = await browserController.ensure();
      await page.fill(selector, text, { timeout: 15000 });
      if (pressEnter) await page.press(selector, "Enter");
      logger.browser(`✓ Typed into ${selector}`);
      return `Typed into ${selector}: "${text}"${pressEnter ? " and pressed Enter" : ""}`;
    },
    {
      name: "browser_type",
      description: "Type into an input/textarea using a CSS selector. Optionally press Enter.",
      schema: z.object({
        selector: z.string(),
        text: z.string(),
        pressEnter: z.boolean().optional(),
      }),
    }
  );

  const scrollTool = tool(
    async ({ dy }: { dy: number }) => {
      logger.browser(`Scrolling ${dy > 0 ? "down" : "up"} by ${Math.abs(dy)}px`);
      const page = await browserController.ensure();
      await page.mouse.wheel(0, dy);
      return `Scrolled vertically by dy=${dy}`;
    },
    {
      name: "browser_scroll",
      description: "Scroll the page vertically by dy pixels (positive = down, negative = up).",
      schema: z.object({
        dy: z.number(),
      }),
    }
  );

  const screenshotTool = tool(
    async ({ path }: { path: string }) => {
      logger.browser(`Taking screenshot: ${path}`);
      const page = await browserController.ensure();
      await page.screenshot({ path, fullPage: true });
      logger.browser(`✓ Screenshot saved: ${path}`);
      return `Saved screenshot to ${path}`;
    },
    {
      name: "browser_screenshot",
      description: "Take a full-page screenshot and save it to a file path.",
      schema: z.object({
        path: z.string(),
      }),
    }
  );

  const extractTextTool = tool(
    async ({ selector, maxChars }: { selector: string; maxChars?: number }) => {
      logger.browser(`Extracting text from: ${selector}`);
      const page = await browserController.ensure();
      const el = await page.$(selector);
      if (!el) {
        logger.browser(`✗ Element not found: ${selector}`);
        return `No element found for selector: ${selector}`;
      }
      const text = (await el.innerText()).trim();
      const clipped = typeof maxChars === "number" ? text.slice(0, maxChars) : text.slice(0, 2000);
      logger.browser(`✓ Extracted ${clipped.length} characters from ${selector}`);
      return `Extracted text (${clipped.length} chars) from ${selector}:\n${clipped}`;
    },
    {
      name: "browser_extract_text",
      description: "Extract innerText from a CSS selector (clipped).",
      schema: z.object({
        selector: z.string(),
        maxChars: z.number().optional(),
      }),
    }
  );

  const findByTextTool = tool(
    async ({ text, exact }: { text: string; exact?: boolean }) => {
      logger.browser(`Finding elements containing text: "${text}"`);
      const page = await browserController.ensure();
      
      try {
        // Use Playwright's getByText or locator with text
        let elements;
        if (exact) {
          elements = await page.locator(`text="${text}"`).all();
        } else {
          // Find all elements and filter by text content
          elements = await page.locator(`text=/.*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*/i`).all();
        }
        
        if (elements.length === 0) {
          logger.browser(`✗ No elements found with text: "${text}"`);
          return `No elements found containing text: "${text}". Try using browser_find_links to see all clickable elements.`;
        }

        const results = [];
        for (let i = 0; i < Math.min(elements.length, 10); i++) {
          const el = elements[i];
          try {
            const tagName = await el.evaluate((el: Element) => el.tagName.toLowerCase());
            const isVisible = await el.isVisible();
            const href = tagName === "a" ? await el.getAttribute("href") : null;
            const innerText = (await el.innerText()).trim().substring(0, 100);
            
            // Try to get a better selector
            let betterSelector = `text="${text}"`;
            try {
              const id = await el.getAttribute("id");
              if (id) betterSelector = `#${id}`;
              else {
                const className = await el.getAttribute("class");
                if (className) {
                  const firstClass = className.split(" ")[0];
                  betterSelector = `${tagName}.${firstClass}`;
                } else {
                  betterSelector = `${tagName}:has-text("${text}")`;
                }
              }
            } catch {}

            results.push({
              index: i + 1,
              tag: tagName,
              visible: isVisible,
              selector: betterSelector,
              text: innerText,
              href: href,
            });
          } catch (e) {
            // Skip elements that can't be evaluated
            continue;
          }
        }

        if (results.length === 0) {
          logger.browser(`✗ Found elements but couldn't extract info`);
          return `Found ${elements.length} element(s) but couldn't extract details. Try using browser_find_links instead.`;
        }

        logger.browser(`✓ Found ${results.length} element(s) with text "${text}"`);
        const resultStr = `Found ${results.length} element(s) containing "${text}":\n${JSON.stringify(results, null, 2)}`;
        return resultStr;
      } catch (e: any) {
        const errorMsg = e?.message ?? String(e);
        logger.browser(`✗ Error finding by text: ${errorMsg}`);
        return `ERROR: ${errorMsg}. Try using browser_find_links to see all clickable elements.`;
      }
    },
    {
      name: "browser_find_by_text",
      description: "Find clickable elements by their text content. Returns selectors you can use with browser_click. Use this when you know the text but not the selector.",
      schema: z.object({
        text: z.string(),
        exact: z.boolean().optional(),
      }),
    }
  );

  const findLinksTool = tool(
    async ({ maxLinks }: { maxLinks?: number }) => {
      logger.browser("Finding all clickable links on the page");
      const page = await browserController.ensure();
      
      try {
        const links = await page.$$eval("a, button, [onclick], [role='button']", (elements) => {
          return elements.slice(0, 50).map((el, i) => {
            const tag = el.tagName.toLowerCase();
            const text = el.textContent?.trim().substring(0, 100) || "";
            const href = (el as HTMLAnchorElement).href || "";
            const id = el.id || "";
            const className = el.className?.toString().split(" ")[0] || "";
            
            let selector = tag;
            if (id) selector = `#${id}`;
            else if (className) selector = `${tag}.${className}`;
            
            return {
              index: i + 1,
              tag,
              text,
              href: href || null,
              selector,
            };
          });
        });

        const limit = maxLinks || 20;
        const limitedLinks = links.slice(0, limit);
        
        logger.browser(`✓ Found ${links.length} clickable element(s), showing first ${limitedLinks.length}`);
        return `Found ${links.length} clickable elements:\n${JSON.stringify(limitedLinks, null, 2)}`;
      } catch (e: any) {
        const errorMsg = e?.message ?? String(e);
        logger.browser(`✗ Error finding links: ${errorMsg}`);
        return `ERROR: ${errorMsg}`;
      }
    },
    {
      name: "browser_find_links",
      description: "Find all clickable links, buttons, and interactive elements on the page. Returns their text, href, and selectors. Use this to discover what's clickable on the page.",
      schema: z.object({
        maxLinks: z.number().optional(),
      }),
    }
  );

  return [
    gotoTool,
    clickTool,
    rightClickTool,
    typeTool,
    scrollTool,
    screenshotTool,
    extractTextTool,
    findByTextTool,
    findLinksTool,
  ];
}

