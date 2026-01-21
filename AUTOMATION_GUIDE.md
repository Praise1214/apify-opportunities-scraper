# TRANXCARBON Opportunity Automation Guide

## 🎯 Overview

This guide shows you how to automate scraping opportunities from:
- **OpportunitiesForAfricans.com**
- **OpportunityDesk.org**

And automatically upload them to Google Sheets daily using **Apify + Make.com**.

---

## 📋 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Apify Actor   │────▶│    Make.com     │────▶│  Google Sheets  │
│  (Daily Scrape) │     │   (Webhook)     │     │  (Your Tracker) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │         Scheduled Daily at 8 AM              │
        └──────────────────────────────────────────────┘
```

---

## 🚀 Step 1: Deploy Apify Actor

### 1.1 Install Apify CLI
```bash
npm install -g apify-cli
```

### 1.2 Login & Deploy
```bash
cd "/Users/USER/Apify Actor"
apify login
apify push
```

### 1.3 Test Run
1. Go to [Apify Console](https://console.apify.com)
2. Find your Actor "article-deadline-scraper"
3. Click "Start" to run it
4. Check the Dataset tab for results

---

## 📊 Step 2: Set Up Google Sheet

Create a Google Sheet with these columns:

| Column | Description |
|--------|-------------|
| A: Title | Opportunity name |
| B: Link | URL to apply |
| C: Published Date | When posted |
| D: Deadline | Application deadline |
| E: Source | OFA or OpportunityDesk |
| F: Scraped At | When we found it |
| G: Applied | ☐ Checkbox (your tracking) |
| H: Status | New / Applied / Rejected / Won |
| I: Notes | Your notes |

### Google Sheet Template Header Row:
```
Title | Link | Published Date | Deadline | Source | Scraped At | Applied | Status | Notes
```

---

## 🔗 Step 3: Connect Make.com

### 3.1 Create Make.com Account
Go to [Make.com](https://www.make.com) (free tier: 1000 ops/month)

### 3.2 Create New Scenario

**Module 1: Apify - Watch Actor Runs**
1. Add "Apify" module → "Watch Actor Runs"
2. Connect your Apify account (API token from Settings)
3. Select your Actor: "article-deadline-scraper"
4. Trigger: When run succeeds

**Module 2: Apify - Get Dataset Items**
1. Add "Apify" → "Get Dataset Items"
2. Dataset ID: `{{1.defaultDatasetId}}`
3. Limit: 100

**Module 3: Iterator**
1. Add "Iterator" module
2. Array: `{{2.items}}`

**Module 4: Google Sheets - Search Rows**
1. Add "Google Sheets" → "Search Rows"
2. Spreadsheet: Your tracker sheet
3. Sheet: Sheet1
4. Filter: Column B (Link) = `{{3.link}}`

**Module 5: Router (Add only NEW items)**
1. Add Router
2. Route 1 Filter: `{{length(4.results)}} = 0` (no existing row)

**Module 6: Google Sheets - Add Row**
1. Add "Google Sheets" → "Add a Row"
2. Map fields:
   - Title: `{{3.title}}`
   - Link: `{{3.link}}`
   - Published Date: `{{3.publishedDate}}`
   - Deadline: `{{3.deadline}}`
   - Source: `{{3.category}}`
   - Scraped At: `{{3.scrapedAt}}`
   - Applied: `FALSE`
   - Status: `New`

### 3.3 Make.com Scenario Flow
```
[Apify Watch] → [Get Dataset] → [Iterator] → [Search Sheet] → [Router] → [Add Row]
                                                                  ↓
                                              (Skip if already exists)
```

---

## ⏰ Step 4: Schedule Daily Runs

### Option A: Schedule in Apify (Recommended)
1. Go to your Actor in Apify Console
2. Click "Schedules" tab
3. Create new schedule:
   - Cron: `0 21 * * *` (9 PM daily)
   - Timezone: Your timezone

### Option B: Schedule in Make.com
1. Edit your Make.com scenario
2. Click the clock icon on the Apify Watch module
3. Set to run at specific time daily

---

## 🎯 Step 5: Filter for Climate/Startup Opps (Optional)

To only get opportunities relevant to TRANXCARBON:

1. Go to Apify Console → Your Actor → Input
2. Set `enableKeywordFilter: true`
3. Customize `filterKeywords`:
```json
{
    "enableKeywordFilter": true,
    "filterKeywords": [
        "climate", "carbon", "sustainability", "green tech",
        "renewable", "cleantech", "startup", "entrepreneur",
        "accelerator", "incubator", "grant", "funding",
        "impact", "environment", "net zero", "emissions"
    ]
}
```

---

## ✅ Result: Your Automated Tracker

Every day at 8 AM:
1. ✅ Apify scrapes both sites for new opportunities
2. ✅ Extracts titles, links, deadlines, dates
3. ✅ Make.com receives the data
4. ✅ Checks if opportunity already exists in your sheet
5. ✅ Adds only NEW opportunities
6. ✅ You check your sheet and mark what you've applied to!

---

## 💡 Pro Tips

### Track Application Status
Use Google Sheets Data Validation for Status column:
- New
- Reviewing
- Applied
- Interview
- Rejected
- Won! 🎉

### Get Notified of Deadlines
Add a Make.com scenario that:
1. Runs daily
2. Checks for deadlines within 7 days
3. Sends you a Slack/Email reminder

### Filter by Deadline
Add conditional formatting in Google Sheets:
- 🟢 Green: Deadline > 14 days away
- 🟡 Yellow: Deadline 7-14 days
- 🔴 Red: Deadline < 7 days

---

## 🆘 Troubleshooting

**No data scraped?**
- Check if the sites changed their HTML structure
- Update the CSS selectors in Input configuration

**Duplicates in sheet?**
- Make sure the Search Rows module checks the Link column
- Router should filter: `length(searchResults) = 0`

**Deadline not extracted?**
- The deadline might be on the detail page, not the listing
- Consider adding a second crawl step for detail pages

---

## 📞 Need Help?

- Apify Docs: https://docs.apify.com
- Make.com Docs: https://www.make.com/en/help
- Crawlee Docs: https://crawlee.dev

Good luck with TRANXCARBON! 🌍💚