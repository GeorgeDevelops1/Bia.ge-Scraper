import { config } from "../config/config";
import { logger } from "../utils/logger";
import { createAuthenticatedContext } from "../services/authService";
import { runScraperOnPage } from "../services/scraperService";
import { exportBusinessesToExcel } from "../utils/excelExporter";

async function main(): Promise<void> {
  logger.info("Starting BIA.ge scraper...");

  const { browser, page } = await createAuthenticatedContext(config);

  try {
    const { businesses, failedUrls } = await runScraperOnPage(page, config);

    logger.info(
      `Scraping finished. Success: ${businesses.length}, Failed: ${failedUrls.length}`
    );

    await exportBusinessesToExcel(businesses, config.outputExcelPath);
  } finally {
    logger.info("Closing browser...");
    await browser.close();
  }
}

main().catch((err) => {
  logger.error("Fatal error in scraper", err);
  process.exit(1);
});


