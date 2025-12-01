import * as fs from "fs";
import * as path from "path";
import { Page } from "playwright";
import { ScraperConfig } from "../config/config";
import { Business } from "../types/Business";
import { logger } from "../utils/logger";
import { collectCompanyUrls } from "./listingService";
import { scrapeBusinessDetail } from "./detailService";

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

  const companyUrls = await collectCompanyUrls(page, cfg);
  logger.info(
    `Total unique company URLs collected: ${companyUrls.length} (maxCompanies=${cfg.maxCompanies})`
  );

  const businesses: Business[] = [];
  const failedUrls: string[] = [];

  let index = 0;
  for (const url of companyUrls) {
    index += 1;
    try {
      const biz = await scrapeBusinessDetail(page, url);
      businesses.push(biz);
      logger.info(
        `Scraped ${index}/${companyUrls.length} companies (success so far: ${businesses.length})`
      );
    } catch (err) {
      logger.error(`Failed to scrape ${url}`, err);
      failedUrls.push(url);
    }

    if (cfg.detailDelayMs > 0) {
      await page.waitForTimeout(cfg.detailDelayMs);
    }

    if (index % cfg.checkpointEvery === 0) {
      await writeCheckpoint(businesses, failedUrls, checkpointPath);
    }
  }

  await writeCheckpoint(businesses, failedUrls, checkpointPath);

  return { businesses, failedUrls };
}


