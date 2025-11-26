import puppeteer from "puppeteer";

const testSulopa = async () => {
    console.log("🔍 Testing connection to sulopa.com with STEALTH mode...");

    const browser = await puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });

    try {
        const page = await browser.newPage();

        // STEALTH: Override navigator.webdriver
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

        // Request interception (re-enabled with better logic)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("Navigating to https://sulopa.com...");

        await page.goto('https://sulopa.com', {
            waitUntil: ["domcontentloaded", "networkidle2"],
            timeout: 45000
        });

        console.log("✅ Navigation successful!");
        const title = await page.title();
        console.log("Page Title:", title);

    } catch (err) {
        console.error("❌ Navigation failed:", err.message);
    } finally {
        await browser.close();
    }
};

testSulopa();
