import puppeteer from "puppeteer";
import pLimit from "p-limit";
import * as queueService from "../services/queueService.js";
import { deepCrawlDomain } from "../services/crawlerService.js";
import { normalizeUrl } from "../utils/helpers.js";
import logger from "../utils/logger.js";

let workerRunning = false;
let stopRequested = false;
const CONCURRENCY = 5; // Domains in parallel
const MAX_RETRIES = 3;

// Track active crawls: { domain: "example.com", pages: 0, emails: 0 }
const activeCrawls = new Map();

const processDomainEntry = async (browser, entry) => {
    const id = entry.id;
    const domain = entry.domain;
    const url = normalizeUrl(entry.url || domain);
    const logPrefix = `[${id}] ${domain}`;

    // Start tracking
    activeCrawls.set(id, { domain, pages: 0, emails: 0 });

    if (stopRequested) {
        await queueService.updateDomainStatus(id, 'queued');
        activeCrawls.delete(id);
        return;
    }

    try {
        // We need to hook into deepCrawlDomain to update progress if possible, 
        // but for now we'll just show "Processing" and final result.
        // To show live page count, we'd need to pass a callback to deepCrawlDomain.
        // Let's update deepCrawlDomain to accept a progress callback.

        const onProgress = (stats) => {
            const current = activeCrawls.get(id);
            if (current) {
                current.pages = stats.pages;
                current.emails = stats.emails;
                activeCrawls.set(id, current);
            }
        };

        const { emails, pagesVisited } = await deepCrawlDomain(browser, url, () => stopRequested, onProgress);

        await queueService.saveEmailsToDB(emails, url, domain);
        await queueService.updateDomainStatus(id, 'done', emails);

        logger.info(`${logPrefix} => done, emails=${emails.length}, pagesVisited=${pagesVisited}`);
    } catch (err) {
        logger.error(`${logPrefix} => error: ${err.message}`);
        const newRetry = (entry.retry_count || 0) + 1;
        const status = newRetry > MAX_RETRIES ? 'error' : 'queued';
        const lastError = err && err.message ? err.message.slice(0, 1000) : 'unknown';

        await queueService.updateDomainStatus(id, status, [], lastError, newRetry);
    } finally {
        // Stop tracking
        activeCrawls.delete(id);
    }
};

const workerLoop = async () => {
    if (workerRunning) return;
    workerRunning = true;
    stopRequested = false;
    logger.info("Worker started");

    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list",
            "--disable-features=IsolateOrigins,site-per-process"
        ]
    });

    try {
        while (!stopRequested) {
            const batch = await queueService.claimQueuedDomains(CONCURRENCY);

            if (!batch || batch.length === 0) {
                await new Promise((r) => setTimeout(r, 3000));
                continue;
            }

            const limit = pLimit(CONCURRENCY);
            await Promise.all(batch.map((entry) => limit(() => processDomainEntry(browser, entry))));
        }
    } catch (e) {
        logger.error(`Worker loop crashed: ${e.message}`);
    } finally {
        try { await browser.close(); } catch { }
        workerRunning = false;
        stopRequested = false;
        activeCrawls.clear();
        logger.info("Worker stopped");
    }
};

export const startWorker = async (req, res) => {
    if (workerRunning) return res.json({ message: "Worker already running" });
    workerLoop().catch((e) => logger.error(`workerLoop crash: ${e.message}`));
    res.json({ message: "Worker started" });
};

export const stopWorker = (req, res) => {
    if (!workerRunning) return res.json({ message: "Worker not running" });
    stopRequested = true;
    res.json({ message: "Stop requested" });
};

export const isWorkerRunning = () => workerRunning;
export const getActiveCrawls = () => Array.from(activeCrawls.values());
