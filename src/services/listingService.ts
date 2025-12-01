import { Page } from "playwright";
import { ScraperConfig } from "../config/config";
import { logger } from "../utils/logger";

export async function collectCompanyUrls(
  page: Page,
  cfg: ScraperConfig
): Promise<string[]> {
  logger.info(`Navigating to company search page: ${cfg.searchUrl}`);
  await page.goto(cfg.searchUrl, { waitUntil: "domcontentloaded" });

  const searchSubmit = await page.$('input[type="submit"]');
  if (searchSubmit) {
    logger.info("Triggering default company search by clicking submit button...");
    await Promise.all([
      page.waitForLoadState("networkidle"),
      searchSubmit.click()
    ]);

    try {
      await page.waitForSelector(
        ".list-row, .company-list, a[href*='/Company/']",
        { timeout: 10000 }
      );
    } catch {
      logger.warn(
        "Timed out waiting for company results after search submit; results may be empty."
      );
    }
  } else {
    logger.warn(
      "Could not find search submit button on /Company/Search; results may be empty."
    );
  }

  const collected = new Set<string>();
  let pageIndex = 1;

  while (true) {
    logger.info(`Collecting company URLs from listing page #${pageIndex}...`);

    const urlsOnPage = await page
      .$$eval("a[href*='/Company/']", (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .map((href) => href.replace(/[#?].*$/, ""))
          .filter((href, index, all) => all.indexOf(href) === index)
          .filter((href) => /\/Company\/\d+($|[#?])/.test(href))
      )
      .catch(() => [] as string[]);

    logger.info(
      `Found ${urlsOnPage.length} anchor URLs in listing rows on page #${pageIndex}`
    );

    for (const url of urlsOnPage) {
      collected.add(url);
      if (collected.size >= cfg.maxCompanies) {
        logger.info(
          `Reached maxCompanies (${cfg.maxCompanies}). Stopping collection.`
        );
        return Array.from(collected);
      }
    }

    const nextButton =
      (await page.$("a[rel='next']")) ??
      (await page.$(".pagination a.next")) ??
      (await page.$("text=შემდეგი"));

    if (!nextButton) {
      logger.info(
        "No next page button found. Assuming this is the last listing page."
      );
      break;
    }

    pageIndex += 1;
    logger.info(`Clicking next page (page #${pageIndex})...`);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      nextButton.click()
    ]);

    if (cfg.pageDelayMs > 0) {
      await page.waitForTimeout(cfg.pageDelayMs);
    }
  }

  return Array.from(collected);
}


