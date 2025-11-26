// Simple test to crawl a real domain and find emails
import puppeteer from "puppeteer";
import { extractEmails, extractLinks } from "./src/utils/helpers.js";

const testRealDomain = async () => {
    console.log("🔍 Testing with real domain that has emails...\n");

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
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

        // Test with a simple contact page
        const testUrl = 'https://www.w3.org/Consortium/contact';
        console.log(`Testing URL: ${testUrl}\n`);

        await page.goto(testUrl, {
            waitUntil: ["domcontentloaded", "networkidle2"],
            timeout: 45000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();
        const innerText = await page.evaluate(() => document.body.innerText);

        console.log("HTML length:", html.length);
        console.log("InnerText length:", innerText.length);
        console.log("\n--- First 500 chars of innerText ---");
        console.log(innerText.substring(0, 500));
        console.log("\n--- Searching for emails ---");

        const htmlEmails = extractEmails(html);
        const textEmails = extractEmails(innerText);
        const allEmails = [...new Set([...htmlEmails, ...textEmails])];

        console.log("\nEmails from HTML:", htmlEmails);
        console.log("Emails from innerText:", textEmails);
        console.log("Total unique emails:", allEmails);
        console.log("Count:", allEmails.length);

        // Also test link extraction
        console.log("\n--- Testing link extraction ---");
        const links = extractLinks(testUrl, html);
        console.log("Found links:", links.length);
        console.log("First 5 links:", links.slice(0, 5));

        await page.close();

    } catch (err) {
        console.error("❌ Error:", err.message);
        console.error(err.stack);
    } finally {
        await browser.close();
    }
};

testRealDomain().then(() => {
    console.log("\n✅ Test completed!");
    process.exit(0);
}).catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
