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

    logger.info("Navigating back to listing page to check for next page...");
    await page.goto(currentListingPageUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    
    await page.waitForSelector("li.row-box", { timeout: 10000 }).catch(() => {});
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);
    
    const totalResults = await page.evaluate(() => {
      const resultText = document.body.innerText;
      const match = resultText.match(/(\d+)\s*(შედეგი|result)/i);
      return match ? parseInt(match[1]) : null;
    });
    
    if (totalResults && totalResults > collected.size) {
      logger.info(`Found ${totalResults} total results, have ${collected.size}, should have more pages`);
    }

    let nextButton = null;
    
    const findNextButton = async (): Promise<any> => {
      logger.info("Searching for next page button...");
      
      const allClickableElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll("a, button, [onclick], [role='button']"));
        return elements.map(el => ({
          tag: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || "",
          href: el.getAttribute("href") || "",
          onclick: el.getAttribute("onclick") || "",
          classes: el.className || "",
          id: el.id || "",
          innerHTML: el.innerHTML.substring(0, 200)
        })).filter(el => 
          el.text.toLowerCase().includes("next") || 
          el.text.includes("შემდეგი") ||
          el.href.includes("page") ||
          el.onclick.includes("page") ||
          el.classes.toLowerCase().includes("next") ||
          el.classes.toLowerCase().includes("pagination")
        );
      });
      
      logger.info(`Found ${allClickableElements.length} potential next buttons`);
      if (allClickableElements.length > 0) {
        logger.info(`Sample elements: ${JSON.stringify(allClickableElements.slice(0, 3))}`);
      }
      try {
        nextButton = await page.$("a[rel='next']");
        if (nextButton) return nextButton;
      } catch {}
      
      try {
        const locator = page.locator("a:has-text('შემდეგი')").first();
        if (await locator.count() > 0) {
          nextButton = await locator.elementHandle();
          if (nextButton) return nextButton;
        }
      } catch {}
      
      try {
        const locator = page.locator(".pagination a.next, .pager a.next, a.next").first();
        if (await locator.count() > 0) {
          nextButton = await locator.elementHandle();
          if (nextButton) return nextButton;
        }
      } catch {}
      
      try {
        const allLinks = await page.$$("a");
        for (const link of allLinks) {
          const text = await link.textContent();
          if (text && (text.trim() === "შემდეგი" || text.trim().toLowerCase() === "next")) {
            return link;
          }
        }
      } catch {}
      
      try {
        const paginationSelectors = [
          ".pagination", ".pager", "[class*='pagination']", "[class*='pager']",
          "[class*='Pagination']", "[class*='Pager']", "nav", "[role='navigation']"
        ];
        
        for (const selector of paginationSelectors) {
          const container = await page.$(selector);
          if (container) {
            const links = await container.$$("a, button");
            for (const link of links) {
              const text = await link.textContent();
              const href = await link.getAttribute("href");
              const tagName = await link.evaluate((el) => el.tagName.toLowerCase());
              
              const isActive = await link.evaluate((el) => {
                return el.classList.contains("active") || 
                       el.classList.contains("current") ||
                       el.classList.contains("disabled") ||
                       el.getAttribute("aria-current") === "page" ||
                       el.getAttribute("aria-disabled") === "true";
              });
              
              if (isActive) continue;
              
              if (text && (text.includes("შემდეგი") || text.trim().toLowerCase().includes("next"))) {
                return link;
              }
              
              if (href) {
                const pageMatch = href.match(/[Pp]age[=_](\d+)/);
                if (pageMatch) {
                  const linkPageNum = parseInt(pageMatch[1]);
                  if (linkPageNum === pageIndex + 1) {
                    return link;
                  }
                }
              }
              
              if (text && /^\d+$/.test(text.trim())) {
                const linkPageNum = parseInt(text.trim());
                if (linkPageNum === pageIndex + 1) {
                  return link;
                }
              }
            }
          }
        }
      } catch {}
      
      try {
        const currentPageNum = pageIndex;
        const nextPageNum = currentPageNum + 1;
        
        const allLinks = await page.$$("a, button, [onclick], [role='button'], span[onclick], div[onclick]");
        logger.info(`Checking ${allLinks.length} clickable elements for next page (page ${nextPageNum})...`);
        
        for (const link of allLinks) {
          const href = await link.getAttribute("href");
          const text = await link.textContent();
          const onclick = await link.getAttribute("onclick");
          const classes = await link.getAttribute("class") || "";
          const id = await link.getAttribute("id") || "";
          
          const isVisible = await link.evaluate((el) => {
            if (!(el instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(el);
            return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
          });
          
          if (!isVisible) continue;
          
          if (text && (text.trim() === "შემდეგი" || text.trim().toLowerCase() === "next" || text.trim() === "»" || text.trim() === "→")) {
            logger.info(`Found next button by text: "${text.trim()}"`);
            return link;
          }
          
          if (text && text.trim() === String(nextPageNum)) {
            const parent = await link.evaluateHandle((el) => el.closest(".pagination, .pager, nav, [class*='page']"));
            if (parent) {
              logger.info(`Found page ${nextPageNum} link`);
              return link;
            }
          }
          
          if (href && (href.includes("page=") || href.includes("Page="))) {
            const pageMatch = href.match(/[Pp]age[=_](\d+)/);
            if (pageMatch) {
              const linkPageNum = parseInt(pageMatch[1]);
              if (linkPageNum === nextPageNum) {
                logger.info(`Found next page link by href: ${href}`);
                return link;
              }
            }
          }
          
          if (onclick && (onclick.includes(`page=${nextPageNum}`) || onclick.includes(`Page=${nextPageNum}`) || onclick.includes(`page:${nextPageNum}`))) {
            logger.info(`Found next page link by onclick: ${onclick.substring(0, 100)}`);
            return link;
          }
          
          if ((classes.toLowerCase().includes("next") || id.toLowerCase().includes("next")) && !classes.toLowerCase().includes("disabled")) {
            logger.info(`Found next button by class/id: ${classes} ${id}`);
            return link;
          }
        }
      } catch (err) {
        logger.warn(`Error searching for next button: ${err}`);
      }
      
      return null;
    };
    
    nextButton = await findNextButton();

    if (!nextButton) {
      logger.info(
        "No next page button found. Assuming this is the last listing page."
      );
      break;
    }

    pageIndex += 1;
    logger.info(`Clicking next page (page #${pageIndex})...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
      nextButton.click()
    ]);
    
    currentListingPageUrl = page.url();

    if (cfg.pageDelayMs > 0) {
      await page.waitForTimeout(cfg.pageDelayMs);
    }
  }

  return { scraped: scrapedCount, failed: failedCount };
}
