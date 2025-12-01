import { chromium, Browser, BrowserContext, Page } from "playwright";
import { ScraperConfig } from "../config/config";
import { logger } from "../utils/logger";

export interface AuthContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function createAuthenticatedContext(
  cfg: ScraperConfig
): Promise<AuthContext> {
  logger.info("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  logger.info(`Navigating to login page: ${cfg.loginUrl}`);
  await page.goto(cfg.loginUrl, { waitUntil: "domcontentloaded" });

  logger.info("Filling login form using precise selectors...");

  const emailLocator = page.locator('form#UserLoginForm input[name="Email"]');
  const passwordLocator = page.locator(
    'form#UserLoginForm input[name="Password"]'
  );

  await emailLocator.fill(cfg.email, { force: true });
  await passwordLocator.fill(cfg.password, { force: true });

  logger.info("Submitting #UserLoginForm via JS...");
  await page.evaluate(() => {
    const form = document.getElementById(
      "UserLoginForm"
    ) as HTMLFormElement | null;
    form?.submit();
  });

  await page.waitForLoadState("networkidle");

  const currentUrl = page.url();
  if (currentUrl.includes("Login")) {
    logger.warn(
      `Still on login page after submitting credentials. Current URL: ${currentUrl}`
    );
  } else {
    logger.info(`Login appears successful. Current URL: ${currentUrl}`);
  }

  return { browser, context, page };
}


