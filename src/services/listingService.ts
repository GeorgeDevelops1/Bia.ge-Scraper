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
  let currentListingPageUrl = page.url();

  while (true) {
    logger.info(`Collecting company URLs from listing page #${pageIndex}...`);
    
    if (page.url() !== currentListingPageUrl && !page.url().includes("/Company/")) {
      await page.goto(currentListingPageUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
    }

    await page.waitForSelector("li.row-box", { timeout: 10000 }).catch(() => {});
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);
    
    await page.waitForSelector(".manipulations, .form-button-paging", { timeout: 5000 }).catch(() => {});

    logger.info("Checking for next page button before scraping companies...");
    
    let hasNextPage = false;
    let nextPageClickHandler: string | null = null;
    
    const nextButtonLocator = page.locator("div.form-button-paging.button-next").first();
    const nextButtonCount = await nextButtonLocator.count();
    
    if (nextButtonCount > 0) {
      const isVisible = await nextButtonLocator.isVisible().catch(() => false);
      const isDisabled = await nextButtonLocator.evaluate((el) => {
        return el.classList.contains("disabled") || 
               el.getAttribute("aria-disabled") === "true" ||
               (el as HTMLElement).style.pointerEvents === "none" ||
               (el as HTMLElement).style.display === "none";
      }).catch(() => false);
      
      if (isVisible && !isDisabled) {
        hasNextPage = true;
        const buttonText = await nextButtonLocator.textContent().catch(() => "");
        logger.info(`Found next button with text: "${buttonText?.trim()}"`);
        
        nextPageClickHandler = await nextButtonLocator.evaluate((el) => {
          return (el as HTMLElement).getAttribute("onclick") || 
                 (el as HTMLElement).getAttribute("data-url") ||
                 null;
        }).catch(() => null);
      }
    }
    
    if (!hasNextPage) {
      const alternativeLocator = page.locator(".form-button-paging").filter({ hasText: "შემდეგი" }).first();
      const altCount = await alternativeLocator.count();
      
      if (altCount > 0) {
        const isVisible = await alternativeLocator.isVisible().catch(() => false);
        const isDisabled = await alternativeLocator.evaluate((el) => {
          return el.classList.contains("disabled") || 
                 el.getAttribute("aria-disabled") === "true" ||
                 (el as HTMLElement).style.pointerEvents === "none" ||
                 (el as HTMLElement).style.display === "none";
        }).catch(() => false);
        
        if (isVisible && !isDisabled) {
          hasNextPage = true;
          const buttonText = await alternativeLocator.textContent().catch(() => "");
          logger.info(`Found next button (alternative) with text: "${buttonText?.trim()}"`);
          
          nextPageClickHandler = await alternativeLocator.evaluate((el) => {
            return (el as HTMLElement).getAttribute("onclick") || 
                   (el as HTMLElement).getAttribute("data-url") ||
                   null;
          }).catch(() => null);
        }
      }
    }

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

    if (!hasNextPage) {
      logger.info("No next page button found. Assuming this is the last listing page.");
      break;
    }

    pageIndex += 1;
    logger.info(`Navigating to next page (page #${pageIndex})...`);
    
    if (nextPageClickHandler) {
      logger.info(`Using stored click handler: ${nextPageClickHandler.substring(0, 100)}`);
      await page.goto(currentListingPageUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await page.evaluate((handler) => {
        if (handler) {
          try {
            eval(handler);
          } catch (e) {
            const btn = document.querySelector("div.form-button-paging.button-next") as HTMLElement;
            if (btn) btn.click();
          }
        }
      }, nextPageClickHandler);
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    } else {
      logger.info("Navigating back to listing page to click next page...");
      await page.goto(currentListingPageUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(3000);
      
      await page.waitForSelector("li.row-box", { timeout: 10000 }).catch(() => {});
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);
      
      const pageNumberUpdated = await page.evaluate((nextPageNum) => {
        const pageInput = document.querySelector('input.field-page-number[name*="PageNumber"]') as HTMLInputElement;
        if (pageInput) {
          pageInput.value = String(nextPageNum);
          pageInput.dispatchEvent(new Event('change', { bubbles: true }));
          const goButton = pageInput.closest('.paging-info')?.querySelector('input[type="button"][value="GO"]') as HTMLElement;
          if (goButton) {
            goButton.click();
            return true;
          }
        }
        return false;
      }, pageIndex);
      
      if (pageNumberUpdated) {
        logger.info("Updated page number and clicked GO button");
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1000);
      } else {
        for (let retry = 0; retry < 3; retry++) {
          await page.waitForSelector(".manipulations, .form-button-paging", { timeout: 5000 }).catch(() => {});
          
          const clicked = await page.evaluate(() => {
            const nextBtn = document.querySelector("div.form-button-paging.button-next") as HTMLElement;
            if (nextBtn && nextBtn.offsetParent !== null && !nextBtn.classList.contains("disabled")) {
              nextBtn.click();
              return true;
            }
            
            const allButtons = Array.from(document.querySelectorAll(".form-button-paging"));
            for (const btn of allButtons) {
              const btnEl = btn as HTMLElement;
              if (btn.textContent?.trim() === "შემდეგი" && btnEl.offsetParent !== null && !btnEl.classList.contains("disabled")) {
                btnEl.click();
                return true;
              }
            }
            return false;
          });
          
          if (clicked) {
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(1000);
            break;
          }
          
          if (retry < 2) {
            logger.info(`Retry ${retry + 1}/3: Waiting longer for pagination to load...`);
            await page.waitForTimeout(2000);
          } else {
            logger.info("Could not find or click next button after 3 retries. Stopping.");
            break;
          }
        }
      }
    }
    
    currentListingPageUrl = page.url();

    if (cfg.pageDelayMs > 0) {
      await page.waitForTimeout(cfg.pageDelayMs);
    }
  }

  return { scraped: scrapedCount, failed: failedCount };
}
