// Test script to verify email extraction and crawler functionality
import puppeteer from "puppeteer";
import { extractEmails } from "./src/utils/helpers.js";

const testCrawler = async () => {
    console.log("🧪 Testing Email Crawler...\n");

    // Test 1: Email Regex
    console.log("Test 1: Email Extraction Regex");
    const testHTML = `
        <html>
            <body>
                <p>Contact us at: info@example.com</p>
                <p>Support: support@test.org</p>
                <a href="mailto:hello@company.net">Email us</a>
                <div>Sales: sales@business.co.uk</div>
            </body>
        </html>
    `;
    const extractedEmails = extractEmails(testHTML);
    console.log("Found emails:", extractedEmails);
    console.log("✅ Regex test passed\n");

    // Test 2: Real website crawl
    console.log("Test 2: Crawling real website (example.com)");
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

        // Block resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log("Navigating to example.com...");
        await page.goto('https://example.com', {
            waitUntil: ["domcontentloaded", "networkidle2"],
            timeout: 45000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();
        const innerText = await page.evaluate(() => document.body.innerText);

        console.log("HTML length:", html.length);
        console.log("InnerText length:", innerText.length);

        const htmlEmails = extractEmails(html);
        const textEmails = extractEmails(innerText);
        const allEmails = [...new Set([...htmlEmails, ...textEmails])];

        console.log("Emails from HTML:", htmlEmails);
        console.log("Emails from innerText:", textEmails);
        console.log("Total unique emails:", allEmails);

        if (allEmails.length > 0) {
            console.log("✅ Email extraction working!\n");
        } else {
            console.log("⚠️ No emails found (example.com may not have emails)\n");
        }

        await page.close();

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        if (browser) await browser.close();
    }

    // Test 3: Test with a site known to have emails
    console.log("Test 3: Testing with contact page");
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Test with a page that likely has emails
        console.log("Navigating to github.com/contact...");
        await page.goto('https://github.com/contact', {
            waitUntil: ["domcontentloaded", "networkidle2"],
            timeout: 45000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();
        const innerText = await page.evaluate(() => document.body.innerText);

        const htmlEmails = extractEmails(html);
        const textEmails = extractEmails(innerText);
        const allEmails = [...new Set([...htmlEmails, ...textEmails])];

        console.log("Found emails:", allEmails);
        console.log("Total:", allEmails.length);

        await page.close();

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        if (browser) await browser.close();
    }

    console.log("\n✅ All tests completed!");
};

testCrawler().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
