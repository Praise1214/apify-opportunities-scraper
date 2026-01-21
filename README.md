# Article Deadline Scraper - Apify Actor

A custom Apify Actor built with CheerioCrawler that extracts article information including titles, links, deadlines, and published dates from websites.

## Features

- 🚀 **Fast scraping** with CheerioCrawler (no browser overhead)
- 📅 **Smart deadline extraction** using regex patterns
- 🔄 **Automatic pagination** following
- 🎯 **Customizable selectors** for different site structures
- 📊 **Normalized date output** in ISO format

## Input Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `startUrls` | URLs to start crawling | Required |
| `articleSelector` | CSS selector for article cards | `article, .article, .post, .card` |
| `titleSelector` | CSS selector for titles | `h1, h2, h3, .title, .headline` |
| `linkSelector` | CSS selector for links | `a` |
| `dateSelector` | CSS selector for dates | `.date, .published, time, .timestamp` |
| `contentSelector` | CSS selector for content | `.content, .body, .description, p` |
| `maxRequestsPerCrawl` | Max pages to crawl | `100` |
| `followPagination` | Follow next page links | `true` |
| `paginationSelector` | CSS selector for pagination | `.next, .pagination a[rel="next"]` |

## Example Input

```json
{
    "startUrls": [
        { "url": "https://example.com/opportunities" },
        { "url": "https://another-site.com/grants" }
    ],
    "articleSelector": ".opportunity-card",
    "titleSelector": "h2.title",
    "dateSelector": ".posted-date",
    "contentSelector": ".description",
    "maxRequestsPerCrawl": 50
}
```

## Output Format

Each scraped article includes:

```json
{
    "title": "Grant Opportunity Title",
    "link": "https://example.com/opportunity/123",
    "publishedDate": "2026-01-05",
    "deadline": "2026-02-15",
    "deadlineRaw": "February 15, 2026",
    "sourceUrl": "https://example.com/opportunities",
    "scrapedAt": "2026-01-08T10:30:00.000Z"
}
```

## Deadline Detection

The actor recognizes various deadline formats:
- "Deadline: January 15, 2026"
- "Apply by February 1st, 2026"
- "Closes on 2026-03-01"
- "Applications close March 15, 2026"
- "Due date: 01/15/2026"

## Local Development

```bash
# Install dependencies
npm install

# Run locally
npm start

# Or with Apify CLI
apify run
```

## Deployment

```bash
# Login to Apify
apify login

# Push to Apify platform
apify push
```

## Customization Tips

### For different site structures:
1. Inspect the target site's HTML
2. Identify the article container selector
3. Update `articleSelector` in input
4. Customize `titleSelector`, `linkSelector`, etc.

### For sites with different deadline formats:
Edit [src/utils.js](src/utils.js) to add new regex patterns to `DEADLINE_PATTERNS`.

## License

ISC