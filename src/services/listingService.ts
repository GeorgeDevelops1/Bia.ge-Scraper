import { Page } from "playwright";
import { ScraperConfig } from "../config/config";
import { logger } from "../utils/logger";

export async function collectAndScrapeCompanies(
  page: Page,
  cfg: ScraperConfig,
  onCompanyFound: (url: string) => Promise<void>
): Promise<{ scraped: number; failed: number }> {
  logger.info(`Navigating to home page: ${cfg.baseUrl}`);
  await page.goto(cfg.baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  logger.info("Clicking Advanced Search button...");
  const advancedSearchOpenerLocator = page.locator("#AdvancedSearchOpener");
  await advancedSearchOpenerLocator.waitFor({ state: "visible", timeout: 10000 });
  await advancedSearchOpenerLocator.scrollIntoViewIfNeeded();
  await advancedSearchOpenerLocator.click();
  await page.waitForTimeout(2000);

  logger.info("Selecting 'საქმიანობის სფერო' (Industry) filter...");
  const industryMenuItemLocator = page.locator("#tpmiIndustry");
  await industryMenuItemLocator.waitFor({ state: "visible", timeout: 10000 });
  await industryMenuItemLocator.click();
  await page.waitForTimeout(1000);

  logger.info("Entering category 'რესტორნები, ბარები'...");
  const categoryInputLocator = page.locator(
    'input[name*="ServiceCategoriesIds"][type="text"]'
  );
  await categoryInputLocator.waitFor({ state: "visible", timeout: 10000 });
  
  const inputContainer = categoryInputLocator.locator("xpath=ancestor::tr | ancestor::div[contains(@class, 'form-list')]").first();
  
  await categoryInputLocator.fill("რესტორნები, ბარები");
  await page.waitForTimeout(1500);

  logger.info("Waiting for autocomplete dropdown and selecting option...");
  try {
    const autocompleteOption = page.locator(
      '.autocomplete-suggestions li, .ui-autocomplete li, [role="option"]'
    ).first();
    await autocompleteOption.waitFor({ state: "visible", timeout: 5000 });
    await autocompleteOption.click();
    await page.waitForTimeout(500);
  } catch (err) {
    logger.warn("Autocomplete dropdown not found, trying to press Enter...");
    await categoryInputLocator.press("Enter");
    await page.waitForTimeout(500);
  }

  logger.info("Clicking 'დამატება' (Add) button for ServiceCategories...");
  const addButtonLocator = inputContainer.locator(".form-list-button-add.add").first();
  if (await addButtonLocator.count() === 0) {
    const addButtonLocator2 = page.locator(".form-list-button-add.add").first();
    await addButtonLocator2.waitFor({ state: "visible", timeout: 10000 });
    await addButtonLocator2.scrollIntoViewIfNeeded();
    await addButtonLocator2.click();
  } else {
    await addButtonLocator.waitFor({ state: "visible", timeout: 10000 });
    await addButtonLocator.scrollIntoViewIfNeeded();
    await addButtonLocator.click();
  }
  await page.waitForTimeout(1000);

  logger.info("Clicking 'ძიება' (Search) button...");
  const searchButtonLocator = page.locator("#AdvancedSearchSubmit");
  await searchButtonLocator.waitFor({ state: "visible", timeout: 10000 });
  await searchButtonLocator.scrollIntoViewIfNeeded();
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
    searchButtonLocator.click()
  ]);

  const currentUrl = page.url();
  logger.info(`Navigated to: ${currentUrl}`);

  if (!currentUrl.includes("/Company/AdvancedSearch")) {
    logger.warn(
      `Expected to be on /Company/AdvancedSearch, but current URL is: ${currentUrl}`
    );
  }

  try {
    await page.waitForSelector("li.row-box", { timeout: 10000 });
  } catch {
    logger.warn(
      "Timed out waiting for company results (li.row-box); results may be empty."
    );
  }

  const collected = new Set<string>();
  let pageIndex = 1;
  let scrapedCount = 0;
  let failedCount = 0;

  while (true) {
    logger.info(`Collecting company URLs from listing page #${pageIndex}...`);

    const urlsOnPage = await page
      .$$eval("li.row-box a.title-box", (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .map((href) => href.replace(/[#?].*$/, ""))
          .filter((href, index, all) => all.indexOf(href) === index)
          .filter((href) => /\/Company\/\d+($|[#?])/.test(href))
      )
      .catch(() => [] as string[]);

    logger.info(
      `Found ${urlsOnPage.length} company URLs on page #${pageIndex}`
    );

    for (const url of urlsOnPage) {
      if (collected.has(url)) {
        continue;
      }

      if (collected.size >= cfg.maxCompanies) {
        logger.info(
          `Reached maxCompanies (${cfg.maxCompanies}). Stopping.`
        );
        return { scraped: scrapedCount, failed: failedCount };
      }

      collected.add(url);

      try {
        logger.info(`Scraping company ${collected.size}/${cfg.maxCompanies}: ${url}`);
        await onCompanyFound(url);
        scrapedCount++;
      } catch (err) {
        failedCount++;
        logger.error(`Failed to scrape ${url}`, err);
      }
    }

    if (collected.size >= cfg.maxCompanies) {
      logger.info(
        `Reached maxCompanies (${cfg.maxCompanies}). Stopping.`
      );
      break;
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

  return { scraped: scrapedCount, failed: failedCount };
}
