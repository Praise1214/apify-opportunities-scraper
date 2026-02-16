global.File = class { };
import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import * as cheerio from 'cheerio';
import { google } from 'googleapis';
import { extractDeadline, extractPublishedDate, normalizeDate, matchesKeywords, isWithinDateRange, formatDatePretty } from './utils.js';

await Actor.init();

// Get input configuration
const input = await Actor.getInput() ?? {};
const {
    // Default to climate/startup opportunity sites
    startUrls = [
        { url: 'https://www.opportunitiesforafricans.com/' },
        { url: 'https://opportunitydesk.org/' }
    ],
    // Site-specific selectors (works for both OFA and OpportunityDesk)
    // More comprehensive selectors to catch all article formats
    articleSelector = 'article, .post, .entry, .latest-opportunities article, .category-box article, .widget article',
    titleSelector = 'h2 a, h3 a, h4 a, .entry-title a, .post-title a, a[rel="bookmark"]',
    linkSelector = 'a[href*="opportunitiesforafricans.com/"], a[href*="opportunitydesk.org/"], h2 a, h3 a, .entry-title a, a[rel="bookmark"]',
    dateSelector = '.post-date, .entry-date, time, .date, .published, .meta-date',
    contentSelector = '.entry-content, .post-content, .excerpt, .entry-summary, p',
    maxRequestsPerCrawl = 100,
    followPagination = false,
    paginationSelector = '.next, .pagination a.next, a.next-page, .nav-previous a',
    // TRANXCARBON: Filter for climate/sustainability/startup keywords
    filterKeywords = [
        'climate', 'sustainability', 'environment', 'green', 'carbon',
        'renewable', 'energy', 'cleantech', 'startup', 'entrepreneur',
        'innovation', 'tech', 'technology', 'accelerator', 'incubator',
        'grant', 'funding', 'seed', 'venture', 'africa', 'impact'
    ],
    enableKeywordFilter = true, // Set to true to only get climate-related opps
    // DATE FILTER: Only get posts from today or this week
    dateFilter = 'week', // Options: 'today', 'week', 'month', 'all'
    useProxy = false, // Disable proxy by default - only enable if sites block you
    // Google Sheets integration
    googleSheetId = '',
    googleSheetName = 'Sheet1',
    googleCredentials = '', // Can paste JSON directly in input
} = input;

// Store for extracted articles
const results = [];

// Configure Apify proxy for bypassing Cloudflare (only if enabled)
let proxyConfiguration = null;
if (useProxy) {
    try {
        proxyConfiguration = await Actor.createProxyConfiguration({
            groups: ['RESIDENTIAL'],
        });
        console.log('Using Apify residential proxy to bypass anti-bot protection');
    } catch (e) {
        console.log('Proxy configuration failed, trying without proxy:', e.message);
    }
} else {
    console.log('Running without proxy (direct connection)');
}

// Create PlaywrightCrawler - uses a real browser to bypass Cloudflare
const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl,
    ...(proxyConfiguration && { proxyConfiguration }),

    // Use Chrome browser in headless mode
    launchContext: {
        launchOptions: {
            headless: true,
        },
    },

    // Wait for page to fully load before scraping
    preNavigationHooks: [
        async ({ page }) => {
            // Block images and other resources to speed up crawling
            await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico}', (route) => route.abort());
        },
    ],

    async requestHandler({ request, page, enqueueLinks, log }) {
        log.info(`Processing: ${request.url}`);

        // Wait for content to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        // Get page HTML and parse with Cheerio
        const html = await page.content();
        const $ = cheerio.load(html);

        const pageTitle = $('title').text();
        log.info(`Page title: ${pageTitle}`);

        // Determine if this is a listing page or article page
        const isArticlePage = request.label === 'ARTICLE' ||
            request.url.match(/\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/) ||
            (request.url.includes('-2026') && !request.url.includes('/category/') && !request.url.includes('/author/'));

        log.info(`Page type: ${isArticlePage ? 'ARTICLE' : 'LISTING'}`);

        if (isArticlePage) {
            // ========== INDIVIDUAL ARTICLE PAGE ==========
            log.info('📄 Scraping individual article page');

            // Extract title
            const title = $('h1.entry-title, h1, .post-title, .entry-header h1').first().text().trim() ||
                $('title').text().split('|')[0].trim();

            // Get the FULL article content (this is where deadlines are)
            const contentText = $('.entry-content, .post-content, article, .content').text();

            // Extract published date
            const dateElement = $('time, .entry-date, .posted-on, .published, .post-date').first();
            let publishedDate = dateElement.attr('datetime') ||
                dateElement.text().trim() ||
                null;
            publishedDate = extractPublishedDate(publishedDate, contentText);

            // Extract deadline from FULL content
            const deadline = extractDeadline(contentText);

            log.info(`Title: ${title?.substring(0, 50)}`);
            log.info(`Deadline found: ${deadline || 'NOT FOUND'}`);

            // Check filters
            const fullText = `${title} ${contentText}`.toLowerCase();
            const matchesFilter = !enableKeywordFilter || matchesKeywords(fullText, filterKeywords);
            const normalizedPubDate = normalizeDate(publishedDate);
            const isRecent = isWithinDateRange(normalizedPubDate, dateFilter);

            if (title && matchesFilter && isRecent) {
                const articleData = {
                    title,
                    link: request.url,
                    publishedDate: normalizedPubDate,
                    deadline: deadline ? normalizeDate(deadline) : null,
                    deadlineRaw: deadline,
                    sourceUrl: request.url,
                    scrapedAt: new Date().toISOString(),
                    applied: false,
                    status: 'New',
                    category: request.url.includes('opportunitiesforafricans') ? 'OFA' : 'OpportunityDesk',
                };

                results.push(articleData);
                log.info(`✅ Extracted: ${title?.substring(0, 50)}...`);
            }

        } else {
            // ========== LISTING PAGE (Homepage/Category) ==========
            log.info('📋 Scraping listing page - finding article links');

            let articleLinks = [];

            // Find articles based on site
            if (request.url.includes('opportunitiesforafricans')) {
                log.info('🔍 Detecting OFA article links...');

                // Find all article containers
                const articles = $('article, .post, div[class*="jeg_post"]');
                log.info(`DEBUG: Found ${articles.length} article containers on OFA`);

                // Extract links from each article
                articles.each((index, element) => {
                    const $article = $(element);

                    // Find the main link (usually in h2, h3, or with rel="bookmark")
                    const linkElement = $article.find('h2 a, h3 a, .entry-title a, a[rel="bookmark"]').first();
                    const href = linkElement.attr('href');
                    const text = linkElement.text().trim();

                    if (index < 5) {
                        log.info(`  Article ${index + 1}: "${text.substring(0, 60)}" -> ${href}`);
                    }

                    if (href &&
                        href.startsWith('http') &&
                        !href.includes('/category/') &&
                        !href.includes('/author/') &&
                        !href.includes('/tag/') &&
                        !href.includes('/#') &&
                        !href.includes('/page/')) {

                        articleLinks.push(href);
                    }
                });

                log.info(`OFA: Found ${articleLinks.length} valid article links from ${articles.length} containers`);

            } else {
                // OpportunityDesk strategy
                log.info('🔍 Detecting OpportunityDesk article links...');

                const articles = $(articleSelector);
                log.info(`Found ${articles.length} articles on OpportunityDesk listing page`);

                articles.each((index, element) => {
                    const $article = $(element);
                    const linkElement = $article.find('a[href*="/202"]').first();
                    const href = linkElement.attr('href');

                    if (href && href.startsWith('http')) {
                        if (!href.includes('/category/') &&
                            !href.includes('/author/') &&
                            !href.includes('/tag/') &&
                            !href.includes('/#')) {
                            articleLinks.push(href);
                        }
                    }
                });

                log.info(`OpportunityDesk: Found ${articleLinks.length} valid article links`);
            }

            // Remove duplicates
            articleLinks = [...new Set(articleLinks)];
            log.info(`Total unique article links to scrape: ${articleLinks.length}`);

            // Enqueue all article pages for detailed scraping
            for (const link of articleLinks) {
                await crawler.addRequests([{ url: link, label: 'ARTICLE' }]);
            }

            // Follow pagination if enabled
            if (followPagination) {
                await enqueueLinks({
                    selector: paginationSelector,
                    label: 'LISTING',
                });
            }
        }
    },

    async failedRequestHandler({ request, log }) {
        log.error(`Request failed: ${request.url}`);
    },
});

// Run the crawler
await crawler.run(startUrls);

// Deduplicate results by link
const uniqueResults = [];
const seenLinks = new Set();


for (const article of results) {
    const key = article.link || article.title;
    if (!seenLinks.has(key)) {
        seenLinks.add(key);
        // Replace publishedDate with pretty format, keep deadlinePretty
        uniqueResults.push({
            ...article,
            publishedDate: formatDatePretty(article.publishedDate),
            deadlineDate: article.deadline ? formatDatePretty(article.deadline) : '',
        });
    }
}


// TERMINAL OUTPUT - FORMATTED TABLE 
console.log('\n' + '='.repeat(120));
console.log('📊 SCRAPING RESULTS');
console.log('='.repeat(120) + '\n');

if (uniqueResults.length === 0) {
    console.log('❌ No articles found matching your criteria.\n');
} else {
    uniqueResults.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title || 'No Title'}`);
        console.log(`   🔗 URL: ${article.link || 'N/A'}`);
        console.log(`   📅 Published: ${article.publishedDate || 'N/A'}`);
        console.log(`   ⏰ Deadline: ${article.deadlineDate || 'Not found'}`);
        console.log(`   🌍 Source: ${article.category || 'N/A'}`);
        console.log(`   ${'-'.repeat(115)}`);
    });

    console.log('\n' + '='.repeat(120));
    console.log(`✅ Total: ${uniqueResults.length} unique articles scraped`);
    console.log(`📅 Articles with deadlines: ${uniqueResults.filter(a => a.deadlineDate).length}`);
    console.log(`🕒 Scraped at: ${new Date().toLocaleString()}`);
    console.log('='.repeat(120) + '\n');
}

// Push results to Apify dataset
await Actor.pushData(uniqueResults);

// ========== GOOGLE SHEETS EXPORT ==========
if (googleSheetId) {
    console.log('📊 Exporting to Google Sheets...');

    try {
        // Get Google credentials from input OR environment variable
        const credentialsJson = googleCredentials || process.env.GOOGLE_CREDENTIALS;

        if (!credentialsJson) {
            console.log('⚠️ Google credentials not provided. Skipping Google Sheets export.');
            console.log('   To enable: Paste your Google Service Account JSON in the "Google Service Account JSON" input field');
        } else {
            const credentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;

            // Authenticate with Google
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const sheets = google.sheets({ version: 'v4', auth });

            // First, get existing links to avoid duplicates
            let existingLinks = new Set();
            try {
                const existingData = await sheets.spreadsheets.values.get({
                    spreadsheetId: googleSheetId,
                    range: `${googleSheetName}!B:B`, // Column B = Links
                });

                if (existingData.data.values) {
                    existingLinks = new Set(existingData.data.values.flat());
                }
                console.log(`   Found ${existingLinks.size} existing entries in sheet`);
            } catch (e) {
                console.log('   Sheet appears empty, will add all entries');
            }

            // Filter out duplicates
            const newArticles = uniqueResults.filter(article => !existingLinks.has(article.link));
            console.log(`   ${newArticles.length} new articles to add (${uniqueResults.length - newArticles.length} duplicates skipped)`);

            if (newArticles.length > 0) {
                // Prepare rows for Google Sheets
                // Columns: Title | Link | Published Date | Deadline | Source | Scraped At | Applied | Status | Notes
                const rows = newArticles.map(article => [
                    article.title || '',
                    article.link || '',
                    // Format dates as "January 9, 2026"
                    formatDatePretty(article.publishedDate) || '',
                    formatDatePretty(article.deadline) || article.deadlineRaw || '',
                    article.category || '',
                    formatDatePretty(new Date().toISOString().split('T')[0]), // Today's date formatted
                    'FALSE',  // Applied
                    'New',    // Status
                    '',       // Notes
                ]);

                // Append to sheet
                await sheets.spreadsheets.values.append({
                    spreadsheetId: googleSheetId,
                    range: `${googleSheetName}!A:I`,
                    valueInputOption: 'RAW',  // Changed to RAW to preserve text formatting
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: {
                        values: rows,
                    },
                });

                console.log(`✅ Added ${newArticles.length} new opportunities to Google Sheets!`);
            } else {
                console.log('   No new articles to add.');
            }
        }
    } catch (error) {
        console.error('❌ Google Sheets export failed:', error.message);
        // Don't fail the whole actor, just log the error
    }
} else {
    console.log('ℹ️ Google Sheet ID not provided. Skipping export. Data saved to Apify Dataset.');
}

// Save summary
await Actor.setValue('SUMMARY', {
    totalArticles: uniqueResults.length,
    articlesWithDeadlines: uniqueResults.filter(a => a.deadline).length,
    articlesWithDates: uniqueResults.filter(a => a.publishedDate).length,
    scrapedAt: new Date().toISOString(),
});

await Actor.exit();