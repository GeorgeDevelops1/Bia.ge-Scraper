"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthenticatedContext = createAuthenticatedContext;
const playwright_1 = require("playwright");
const logger_1 = require("../utils/logger");
async function createAuthenticatedContext(cfg) {
    logger_1.logger.info("Launching browser...");
    const browser = await playwright_1.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    logger_1.logger.info(`Navigating to login page: ${cfg.loginUrl}`);
    await page.goto(cfg.loginUrl, { waitUntil: "domcontentloaded" });
    logger_1.logger.info("Filling login form using precise selectors...");
    const emailLocator = page.locator('form#UserLoginForm input[name="Email"]');
    const passwordLocator = page.locator('form#UserLoginForm input[name="Password"]');
    await emailLocator.fill(cfg.email, { force: true });
    await passwordLocator.fill(cfg.password, { force: true });
    logger_1.logger.info("Submitting #UserLoginForm via JS...");
    await page.evaluate(() => {
        const form = document.getElementById("UserLoginForm");
        form?.submit();
    });
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    if (currentUrl.includes("Login")) {
        logger_1.logger.warn(`Still on login page after submitting credentials. Current URL: ${currentUrl}`);
    }
    else {
        logger_1.logger.info(`Login appears successful. Current URL: ${currentUrl}`);
    }
    return { browser, context, page };
}
