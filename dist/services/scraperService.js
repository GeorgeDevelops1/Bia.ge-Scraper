"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScraperOnPage = runScraperOnPage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const listingService_1 = require("./listingService");
const detailService_1 = require("./detailService");
const excelExporter_1 = require("../utils/excelExporter");
async function writeCheckpoint(businesses, failedUrls, checkpointPath) {
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
    await fs.promises.writeFile(checkpointPath, JSON.stringify(payload, null, 2), "utf-8");
    logger_1.logger.info(`Checkpoint written to ${checkpointPath} (businesses=${businesses.length}, failed=${failedUrls.length})`);
}
async function runScraperOnPage(page, cfg) {
    const checkpointPath = "output/checkpoint.json";
    await (0, excelExporter_1.initializeExcelFile)(cfg.outputExcelPath);
    const businesses = [];
    const failedUrls = [];
    let index = 0;
    const onCompanyFound = async (url) => {
        index += 1;
        try {
            const biz = await (0, detailService_1.scrapeBusinessDetail)(page, url);
            businesses.push(biz);
            await (0, excelExporter_1.appendBusinessToExcel)(biz);
            if (cfg.detailDelayMs > 0) {
                await page.waitForTimeout(cfg.detailDelayMs);
            }
            if (index % cfg.checkpointEvery === 0) {
                await writeCheckpoint(businesses, failedUrls, checkpointPath);
            }
        }
        catch (err) {
            failedUrls.push(url);
            throw err;
        }
    };
    const { scraped, failed } = await (0, listingService_1.collectAndScrapeCompanies)(page, cfg, onCompanyFound);
    logger_1.logger.info(`Scraping finished. Success: ${scraped}, Failed: ${failed}`);
    await writeCheckpoint(businesses, failedUrls, checkpointPath);
    return { businesses, failedUrls };
}
