import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";
import { ScraperConfig } from "../config/config";
import { Business } from "../types/Business";
import { logger } from "../utils/logger";
import { collectAndScrapeCompanies } from "./listingService";
import { scrapeBusinessDetail } from "./detailService";
import {
  initializeExcelFile,
  appendBusinessToExcel
} from "../utils/excelExporter";

interface ScrapeResult {
  businesses: Business[];
  failedUrls: string[];
}

async function writeCheckpoint(
  businesses: Business[],
  failedUrls: string[],
  checkpointPath: string
): Promise<void> {
  const dir = path.dirname(checkpointPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: businesses.length,
    failedCount: failedUrls.length,
    businesses,
    failedUrls
  };

  await fs.promises.writeFile(
    checkpointPath,
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
  logger.info(
    `Checkpoint written to ${checkpointPath} (businesses=${businesses.length}, failed=${failedUrls.length})`
  );
}

export async function runScraperOnPage(
  page: Page,
  cfg: ScraperConfig
): Promise<ScrapeResult> {
  const checkpointPath = "output/checkpoint.json";

  await initializeExcelFile(cfg.outputExcelPath);

  const businesses: Business[] = [];
  const failedUrls: string[] = [];
  let index = 0;

  const onCompanyFound = async (url: string): Promise<void> => {
    index += 1;
    try {
      const biz = await scrapeBusinessDetail(page, url);
      businesses.push(biz);
      await appendBusinessToExcel(biz);
      
      if (cfg.detailDelayMs > 0) {
        await page.waitForTimeout(cfg.detailDelayMs);
      }

      if (index % cfg.checkpointEvery === 0) {
        await writeCheckpoint(businesses, failedUrls, checkpointPath);
      }
    } catch (err) {
      failedUrls.push(url);
      throw err;
    }
  };

  const { scraped, failed } = await collectAndScrapeCompanies(
    page,
    cfg,
    onCompanyFound
  );

  logger.info(
    `Scraping finished. Success: ${scraped}, Failed: ${failed}`
  );

  await writeCheckpoint(businesses, failedUrls, checkpointPath);

  return { businesses, failedUrls };
}


