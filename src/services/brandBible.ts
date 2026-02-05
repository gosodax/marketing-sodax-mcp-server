/**
 * Brand Bible Service
 * 
 * Fetches and parses the SODAX Brand Bible from Notion.
 * Implements caching with auto-refresh every 5 minutes.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { parse as parseHTML, HTMLElement } from "node-html-parser";
import {
  BrandBible,
  BrandSection,
  BrandSubsection,
  BrandOverview,
  SearchResult
} from "../types.js";
import { BRAND_BIBLE_URL, CACHE_DURATION_MS, BRAND_SECTIONS } from "../constants.js";

let cachedBrandBible: BrandBible | null = null;
let lastFetchTime: Date | null = null;

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cachedBrandBible || !lastFetchTime) return false;
  const now = new Date();
  return now.getTime() - lastFetchTime.getTime() < CACHE_DURATION_MS;
}

/**
 * Fetch and parse the brand bible from Notion
 */
export async function fetchBrandBible(forceRefresh = false): Promise<BrandBible> {
  if (!forceRefresh && isCacheValid() && cachedBrandBible) {
    return cachedBrandBible;
  }

  try {
    const response = await axios.get(BRAND_BIBLE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SODAX-MCP-Server/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      },
      timeout: 30000
    });

    const brandBible = parseNotionPage(response.data);
    cachedBrandBible = brandBible;
    lastFetchTime = new Date();
    
    console.error(`Brand bible fetched and cached at ${lastFetchTime.toISOString()}`);
    return brandBible;
  } catch (error) {
    console.error("Error fetching brand bible:", error);
    
    // Return cached version if available, even if expired
    if (cachedBrandBible) {
      console.error("Returning cached brand bible due to fetch error");
      return cachedBrandBible;
    }
    
    // Return a default structure if no cache
    return createDefaultBrandBible();
  }
}

/**
 * Parse Notion page HTML into structured brand bible
 */
function parseNotionPage(html: string): BrandBible {
  const $ = cheerio.load(html);
  const root = parseHTML(html);
  
  const sections: BrandSection[] = [];
  let currentSection: BrandSection | null = null;
  let currentSubsection: BrandSubsection | null = null;
  let sectionIndex = 0;
  let subsectionIndex = 0;

  // Find main content area
  const contentBlocks = root.querySelectorAll('[class*="notion-"]');
  
  // Extract title
  const titleElement = root.querySelector('[class*="notion-page-block"]') || 
                       root.querySelector('h1') ||
                       root.querySelector('[class*="title"]');
  const title = titleElement?.textContent?.trim() || "SODAX Brand Bible";

  // Process content blocks
  contentBlocks.forEach((block: HTMLElement) => {
    const text = block.textContent?.trim() || "";
    const tagName = block.tagName?.toLowerCase() || "";
    const className = block.getAttribute("class") || "";

    // Detect section headers (h1, h2 or large text)
    if (isMainHeader(className, tagName, text)) {
      sectionIndex++;
      subsectionIndex = 0;
      
      currentSection = {
        id: String(sectionIndex),
        title: text || BRAND_SECTIONS[String(sectionIndex) as keyof typeof BRAND_SECTIONS] || `Section ${sectionIndex}`,
        content: "",
        subsections: []
      };
      sections.push(currentSection);
      currentSubsection = null;
    }
    // Detect subsection headers (h2, h3)
    else if (isSubHeader(className, tagName, text) && currentSection) {
      subsectionIndex++;
      
      currentSubsection = {
        id: `${currentSection.id}.${subsectionIndex}`,
        parentId: currentSection.id,
        title: text,
        content: ""
      };
      currentSection.subsections.push(currentSubsection);
    }
    // Regular content
    else if (text && text.length > 0) {
      if (currentSubsection) {
        currentSubsection.content += (currentSubsection.content ? "\n\n" : "") + text;
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? "\n\n" : "") + text;
      }
    }
  });

  // If no sections were found, create default structure
  if (sections.length === 0) {
    return createDefaultBrandBible();
  }

  return {
    title,
    lastUpdated: new Date(),
    sections
  };
}

/**
 * Check if element is a main section header
 */
function isMainHeader(className: string, tagName: string, text: string): boolean {
  if (tagName === "h1") return true;
  if (className.includes("header-block") && !className.includes("sub")) return true;
  if (className.includes("notion-h1")) return true;
  // Check for numbered sections like "1. Introduction"
  if (/^[1-6]\.\s/.test(text)) return true;
  return false;
}

/**
 * Check if element is a subsection header
 */
function isSubHeader(className: string, tagName: string, text: string): boolean {
  if (tagName === "h2" || tagName === "h3") return true;
  if (className.includes("sub-header") || className.includes("notion-h2") || className.includes("notion-h3")) return true;
  // Check for numbered subsections like "1.1" or "2.3"
  if (/^[1-6]\.[1-9]\s/.test(text)) return true;
  return false;
}

/**
 * Create a default brand bible structure
 */
function createDefaultBrandBible(): BrandBible {
  const sections: BrandSection[] = Object.entries(BRAND_SECTIONS).map(([id, title]) => ({
    id,
    title,
    content: `Content for ${title}. Please refresh to load from Notion.`,
    subsections: []
  }));

  return {
    title: "SODAX Brand Bible",
    lastUpdated: new Date(),
    sections
  };
}

/**
 * Get brand overview with section summaries
 */
export async function getBrandOverview(): Promise<BrandOverview> {
  const brandBible = await fetchBrandBible();
  
  return {
    title: brandBible.title,
    lastUpdated: brandBible.lastUpdated.toISOString(),
    sectionCount: brandBible.sections.length,
    sections: brandBible.sections.map(section => ({
      id: section.id,
      title: section.title,
      subsectionCount: section.subsections.length
    }))
  };
}

/**
 * Get a specific section by ID
 */
export async function getSection(sectionId: string): Promise<BrandSection | null> {
  const brandBible = await fetchBrandBible();
  return brandBible.sections.find(s => s.id === sectionId) || null;
}

/**
 * Get a specific subsection by ID (e.g., "3.1")
 */
export async function getSubsection(subsectionId: string): Promise<BrandSubsection | null> {
  const brandBible = await fetchBrandBible();
  
  for (const section of brandBible.sections) {
    const subsection = section.subsections.find(s => s.id === subsectionId);
    if (subsection) return subsection;
  }
  
  return null;
}

/**
 * List all subsections with their IDs and titles
 */
export async function listSubsections(): Promise<{ id: string; title: string; parentSection: string }[]> {
  const brandBible = await fetchBrandBible();
  const results: { id: string; title: string; parentSection: string }[] = [];
  
  for (const section of brandBible.sections) {
    for (const subsection of section.subsections) {
      results.push({
        id: subsection.id,
        title: subsection.title,
        parentSection: section.title
      });
    }
  }
  
  return results;
}

/**
 * Search brand bible by keyword
 */
export async function searchBrandBible(query: string, maxResults = 5): Promise<SearchResult[]> {
  const brandBible = await fetchBrandBible();
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);

  for (const section of brandBible.sections) {
    // Search in section content
    const sectionScore = calculateRelevanceScore(section.title + " " + section.content, queryWords);
    if (sectionScore > 0) {
      results.push({
        sectionId: section.id,
        sectionTitle: section.title,
        matchedContent: extractMatchContext(section.content, queryWords),
        relevanceScore: sectionScore
      });
    }

    // Search in subsections
    for (const subsection of section.subsections) {
      const subsectionScore = calculateRelevanceScore(subsection.title + " " + subsection.content, queryWords);
      if (subsectionScore > 0) {
        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          subsectionId: subsection.id,
          subsectionTitle: subsection.title,
          matchedContent: extractMatchContext(subsection.content, queryWords),
          relevanceScore: subsectionScore
        });
      }
    }
  }

  // Sort by relevance and limit results
  return results
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

/**
 * Calculate relevance score based on word matches
 */
function calculateRelevanceScore(text: string, queryWords: string[]): number {
  const textLower = text.toLowerCase();
  let score = 0;

  for (const word of queryWords) {
    const regex = new RegExp(word, "gi");
    const matches = textLower.match(regex);
    if (matches) {
      score += matches.length;
      // Bonus for exact phrase match
      if (textLower.includes(queryWords.join(" "))) {
        score += 5;
      }
    }
  }

  return score;
}

/**
 * Extract context around matched keywords
 */
function extractMatchContext(content: string, queryWords: string[], contextLength = 150): string {
  const contentLower = content.toLowerCase();
  
  for (const word of queryWords) {
    const index = contentLower.indexOf(word);
    if (index !== -1) {
      const start = Math.max(0, index - contextLength / 2);
      const end = Math.min(content.length, index + word.length + contextLength / 2);
      let context = content.substring(start, end);
      
      if (start > 0) context = "..." + context;
      if (end < content.length) context = context + "...";
      
      return context;
    }
  }

  // Return beginning if no match found
  return content.length > contextLength 
    ? content.substring(0, contextLength) + "..." 
    : content;
}

/**
 * Force refresh the brand bible cache
 */
export async function refreshBrandBible(): Promise<{ success: boolean; message: string }> {
  try {
    await fetchBrandBible(true);
    return {
      success: true,
      message: `Brand bible refreshed at ${lastFetchTime?.toISOString()}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

/**
 * Get cache status
 */
export function getCacheStatus(): { cached: boolean; lastUpdated: string | null; expiresIn: number | null } {
  if (!lastFetchTime) {
    return { cached: false, lastUpdated: null, expiresIn: null };
  }

  const now = new Date();
  const elapsed = now.getTime() - lastFetchTime.getTime();
  const expiresIn = Math.max(0, CACHE_DURATION_MS - elapsed);

  return {
    cached: isCacheValid(),
    lastUpdated: lastFetchTime.toISOString(),
    expiresIn: Math.round(expiresIn / 1000) // seconds
  };
}
