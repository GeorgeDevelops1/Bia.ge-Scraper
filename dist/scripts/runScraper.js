"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const authService_1 = require("../services/authService");
const scraperService_1 = require("../services/scraperService");
async function main() {
    logger_1.logger.info("Starting BIA.ge scraper...");
    const { browser, page } = await (0, authService_1.createAuthenticatedContext)(config_1.config);
    try {
        const { businesses, failedUrls } = await (0, scraperService_1.runScraperOnPage)(page, config_1.config);
        logger_1.logger.info(`Scraping finished. Success: ${businesses.length}, Failed: ${failedUrls.length}`);
        logger_1.logger.info(`Excel file saved incrementally to: ${config_1.config.outputExcelPath}`);
    }
    finally {
        logger_1.logger.info("Closing browser...");
        await browser.close();
    }
}
main().catch((err) => {
    logger_1.logger.error("Fatal error in scraper", err);
    process.exit(1);
});
