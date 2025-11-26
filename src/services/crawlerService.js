import pLimit from "p-limit";
import puppeteer from "puppeteer";
import { extractEmails, extractLinks } from "../utils/helpers.js";
import logger from "../utils/logger.js";

const CONCURRENCY = 5; // Reduced for Puppeteer
const MAX_DEPTH = 3;
const MAX_PAGES_PER_DOMAIN = 300;

const fetchPageWithPuppeteer = async (browser, url) => {
    let page = null;
    try {
        page = await browser.newPage();

        // STEALTH: Override navigator.webdriver to bypass simple bot detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // STEALTH: Add realistic headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
        });

        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        // Block resources to speed up
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // ENHANCED: Wait for both DOM and network to be idle
        // This ensures JavaScript frameworks (React, Angular, Vue) have time to render
        await page.goto(url, {
            waitUntil: ["domcontentloaded", "networkidle2"],
            timeout: 45000
        });

        // ENHANCED: Additional wait for React/Angular/Vue hydration and AJAX requests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ENHANCED: Auto-scroll to trigger lazy-loaded content
        // Many modern sites load content as you scroll
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
        } catch (scrollErr) {
            // Scrolling failed, continue anyway
            logger.debug(`Auto-scroll failed for ${url}: ${scrollErr.message}`);
        }

        // ENHANCED: Get both HTML and innerText for comprehensive email extraction
        // innerText captures dynamically rendered content that might not be in HTML
        const html = await page.content();
        const innerText = await page.evaluate(() => document.body.innerText);

        return { html, innerText };
    } catch (err) {
        logger.warn(`Puppeteer fetch failed for ${url}: ${err.message}`);
        return null;
    } finally {
        if (page) await page.close().catch(() => { });
    }
};

export const deepCrawlDomain = async (browser, startUrl, shouldStop = () => false, onProgress = () => { }) => {
    const visited = new Set();
    const emails = new Set();
    const queue = [{ url: startUrl, depth: 0 }];
    const pageLimiter = pLimit(CONCURRENCY);

    while (queue.length > 0 && visited.size < MAX_PAGES_PER_DOMAIN) {
        if (shouldStop()) {
            logger.info(`Stopping crawl for ${startUrl} due to stop signal.`);
            queue.length = 0;
            break;
        }

        const batch = queue.splice(0, CONCURRENCY);
        const tasks = batch.map(({ url, depth }) =>
            pageLimiter(async () => {
                if (shouldStop()) return;
                if (!url || visited.has(url)) return;
                visited.add(url);

                // Use Puppeteer to fetch page with enhanced JavaScript support
                const result = await fetchPageWithPuppeteer(browser, url);
                if (!result) return;

                const { html, innerText } = result;

                // ENHANCED: Extract emails from both HTML and rendered text
                // This catches emails in JavaScript variables, dynamically loaded content, etc.
                const htmlEmails = extractEmails(html);
                const textEmails = extractEmails(innerText);
                const newEmails = [...new Set([...htmlEmails, ...textEmails])];

                newEmails.forEach((e) => emails.add(e));

                // Report progress
                onProgress({ pages: visited.size, emails: emails.size });

                if (depth < MAX_DEPTH) {
                    const links = extractLinks(url, html);
                    for (const link of links) {
                        if (!visited.has(link)) queue.push({ url: link, depth: depth + 1 });
                    }
                }
            })
        );

        try {
            await Promise.all(tasks);
        } catch (err) {
            logger.error(`Batch processing error for ${startUrl}: ${err.message}`);
        }
    }

    return { emails: Array.from(emails), pagesVisited: visited.size };
};
