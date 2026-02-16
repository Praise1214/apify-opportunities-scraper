/**
 * Utility functions for extracting and normalizing dates/deadlines
 * Customized for TRANXCARBON - Climate Tech Startup Opportunities
 */

// Regex patterns for deadline extraction - covers OFA and OpportunityDesk formats
const DEADLINE_PATTERNS = [
    // "Application Deadline: January 15, 2026" (common on OFA)
    /application\s+deadline\s*[:\-–—]?\s*(.+?)(?:\.|applications|$)/gi,
    
    // "Deadline: January 15, 2026" or "Deadline - Jan 15, 2026"
    /(?:deadline|due date|apply by|closes on|closing date|submission deadline|applications? close|last date|expires?)\s*[:\-–—]?\s*(.+?)(?:\.|,\s*\d{4}|\n|$)/gi,
    
    // "Applications close on January 15, 2026"
    /(?:applications? close|closes?|ends?|expires?)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s*\d{4})/gi,
    
    // "Before January 15, 2026"
    /(?:before|by|until|no later than)\s+(\w+\s+\d{1,2},?\s*\d{4})/gi,
    
    // "15/01/2026" or "01-15-2026" or "2026-01-15"
    /(?:deadline|due|closes?|by)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    
    // ISO format "2026-01-15"
    /(?:deadline|due|closes?)[:\s]+(\d{4}-\d{2}-\d{2})/gi,
    
    // Just a date pattern like "January 31st, 2026" or "31 January 2026"
    /(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})/gi,
    /(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/gi,
];

// Common date formats for parsing
const DATE_PATTERNS = [
    // "January 15, 2026" or "Jan 15, 2026"
    /(\w+)\s+(\d{1,2}),?\s*(\d{4})/,
    
    // "15 January 2026" or "15 Jan 2026"
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    
    // "01/15/2026" or "15/01/2026"
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    
    // "2026-01-15"
    /(\d{4})-(\d{2})-(\d{2})/,
];

const MONTH_MAP = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
};

/**
 * Extract deadline from text content
 * @param {string} text - The text to search for deadlines
 * @returns {string|null} - The extracted deadline string or null
 */
export function extractDeadline(text) {
    if (!text) return null;

    const cleanText = text.replace(/\s+/g, ' ').trim();

    // Pattern 1: "Application Deadline: Month DD, YYYY" (OFA format)
    let pattern = /application\s+deadline\s*[:\-–—]?\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i;
    let match = cleanText.match(pattern);
    if (match) return match[1].trim();

    // Pattern 2: "Deadline: Month DD, YYYY" (OpportunityDesk format)
    pattern = /(?:^|\s)deadline\s*[:\-–—]\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i;
    match = cleanText.match(pattern);
    if (match) return match[1].trim();

    // Pattern 3: Other deadline keywords
    pattern = /(?:closing\s+date|closes?\s+on|submission\s+deadline|due\s+date|apply\s+by)[:\s]+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i;
    match = cleanText.match(pattern);
    if (match) return match[1].trim();

    return null;
}
/**
 * Extract published date from element or text
 * @param {string} dateText - Direct date text from element
 * @param {string} fullText - Full text to search if dateText is empty
 * @returns {string|null} - The extracted date string or null
 */
export function extractPublishedDate(dateText, fullText) {
    if (dateText && looksLikeDate(dateText)) {
        return dateText;
    }
    
    if (!fullText) return null;
    
    // Try to find patterns like "Published on January 15, 2026"
    const publishedPatterns = [
        /(?:published|posted|created|updated)\s*(?:on|:)?\s*(.+?)(?:\.|,\s*by|\n|$)/gi,
        /(\w+\s+\d{1,2},?\s*\d{4})/,
    ];
    
    for (const pattern of publishedPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(fullText);
        if (match && match[1] && looksLikeDate(match[1])) {
            return match[1].trim();
        }
    }
    
    return null;
}

/**
 * Check if a string looks like a date
 * @param {string} str - The string to check
 * @returns {boolean}
 */
function looksLikeDate(str) {
    if (!str) return false;
    
    const cleanStr = str.toLowerCase();
    
    // Check for month names
    const hasMonth = Object.keys(MONTH_MAP).some(month => cleanStr.includes(month));
    
    // Check for date-like patterns
    const hasDateNumbers = /\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(str);
    const hasYearLike = /\d{4}/.test(str) || /20\d{2}/.test(str);
    
    return hasMonth || hasDateNumbers || hasYearLike;
}

/**
 * Normalize a date string to ISO format
 * @param {string} dateStr - The date string to normalize
 * @returns {string|null} - ISO date string or null
 */
export function normalizeDate(dateStr) {
    if (!dateStr) return null;

    const cleanStr = dateStr.trim();

    // Try parsing with Date constructor first
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        return parsed.toISOString().split('T')[0];
    }

    // Try manual parsing
    for (const pattern of DATE_PATTERNS) {
        const match = cleanStr.match(pattern);
        if (match) {
            try {
                let year, month, day;

                // ISO format: 2026-01-15
                if (pattern.source.startsWith('(\\d{4})')) {
                    year = parseInt(match[1]);
                    month = parseInt(match[2]) - 1;
                    day = parseInt(match[3]);
                }
                // Month name first: January 15, 2026 or Jan 15, 26
                else if (isNaN(parseInt(match[1]))) {
                    month = MONTH_MAP[match[1].toLowerCase()];
                    day = parseInt(match[2]);
                    year = parseInt(match[3]);
                }
                // Day first: 15 January 2026 or 15 Jan 26
                else if (isNaN(parseInt(match[2]))) {
                    day = parseInt(match[1]);
                    month = MONTH_MAP[match[2].toLowerCase()];
                    year = parseInt(match[3]);
                }
                // Numeric: assume MM/DD/YYYY for US sites, or MM/DD/YY
                else {
                    month = parseInt(match[1]) - 1;
                    day = parseInt(match[2]);
                    year = parseInt(match[3]);
                }

                // Fix 2-digit years: treat 00-99 as 2000-2099
                if (year && year < 100) {
                    year = 2000 + year;
                }

                // Reject/correct years before 2020 (likely parsing error)
                if (year && year < 2020) {
                    return null;
                }

                if (year && month !== undefined && day) {
                    const date = new Date(year, month, day);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            } catch (e) {
                continue;
            }
        }
    }

    return cleanStr; // Return original if can't parse
}

/**
 * Check if text matches any of the filter keywords
 * Used to filter opportunities relevant to TRANXCARBON (climate tech)
 * @param {string} text - The text to search
 * @param {string[]} keywords - Array of keywords to match
 * @returns {boolean}
 */
export function matchesKeywords(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return true;
    
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if a date is within the specified range
 * @param {string} dateStr - ISO date string (YYYY-MM-DD) or date text
 * @param {string} range - 'today', 'week', 'month', or 'all'
 * @returns {boolean}
 */
export function isWithinDateRange(dateStr, range) {
    // If no filter or 'all', accept everything
    if (!range || range === 'all') return true;
    
    // If no date provided, include it (better to show than miss)
    if (!dateStr) return true;
    
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Parse the article date
        let articleDate;
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            // ISO format
            articleDate = new Date(dateStr);
        } else {
            // Try parsing text date
            articleDate = new Date(dateStr);
        }
        
        if (isNaN(articleDate.getTime())) {
            // Can't parse date, include it to be safe
            return true;
        }
        
        articleDate.setHours(0, 0, 0, 0);
        
        // Calculate days difference
        const diffTime = today.getTime() - articleDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        switch (range) {
            case 'today':
                return diffDays === 0;
            case 'week':
                return diffDays >= 0 && diffDays <= 7;
            case 'month':
                return diffDays >= 0 && diffDays <= 30;
            default:
                return true;
        }
    } catch (e) {
        // On error, include the article
        return true;
    }
}

/**
 * Format a date as "January 9, 2026"
 * @param {string} dateStr - Date string (ISO or text format)
 * @returns {string} - Formatted date like "January 9, 2026"
 */
export function formatDatePretty(dateStr) {
    if (!dateStr) return '';
    
    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    try {
        let date;
        
        // Try parsing ISO format first (2026-01-09)
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [year, month, day] = dateStr.split('-').map(Number);
            date = new Date(year, month - 1, day);
        } else {
            // Try standard parsing
            date = new Date(dateStr);
        }
        
        if (isNaN(date.getTime())) {
            return dateStr; // Return original if can't parse
        }
        
        const month = MONTH_NAMES[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        
        return `${month} ${day}, ${year}`;
    } catch (e) {
        return dateStr; // Return original on error
    }
}