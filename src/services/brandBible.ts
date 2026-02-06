/**
 * Brand Bible Service
 *
 * Fetches the SODAX Brand Bible from a Notion page via the Notion API.
 * The page content is retrieved using blocks.children.list and parsed into
 * sections and subsections based on heading hierarchy.
 *
 * Implements caching with auto-refresh every 5 minutes.
 */

import { Client as NotionClient } from "@notionhq/client";
import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import {
  BrandBible,
  BrandSection,
  BrandSubsection,
  BrandOverview,
  SearchResult,
} from "../types.js";
import { BRAND_BIBLE_PAGE_ID, CACHE_DURATION_MS, BRAND_SECTIONS } from "../constants.js";

let cachedBrandBible: BrandBible | null = null;
let lastFetchTime: Date | null = null;

// ---------------------------------------------------------------------------
// Notion client (lazy-initialised)
// ---------------------------------------------------------------------------

let notionClient: NotionClient | null = null;

function getNotionClient(): NotionClient | null {
  if (notionClient) return notionClient;
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error(
      "NOTION_TOKEN not set — Brand Bible will use hardcoded fallback data. " +
        "Set the NOTION_TOKEN environment variable for live Notion sync."
    );
    return null;
  }
  notionClient = new NotionClient({ auth: token });
  return notionClient;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function isCacheValid(): boolean {
  if (!cachedBrandBible || !lastFetchTime) return false;
  return Date.now() - lastFetchTime.getTime() < CACHE_DURATION_MS;
}

// ---------------------------------------------------------------------------
// Notion block helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a Notion rich-text array */
function richTextToPlain(rt: RichTextItemResponse[]): string {
  return rt.map((t) => t.plain_text).join("");
}

/** Check if a block is a text-containing block and extract its text */
function getBlockText(block: BlockObjectResponse): string {
  switch (block.type) {
    case "paragraph":
      return richTextToPlain(block.paragraph.rich_text);
    case "heading_1":
      return richTextToPlain(block.heading_1.rich_text);
    case "heading_2":
      return richTextToPlain(block.heading_2.rich_text);
    case "heading_3":
      return richTextToPlain(block.heading_3.rich_text);
    case "bulleted_list_item":
      return "• " + richTextToPlain(block.bulleted_list_item.rich_text);
    case "numbered_list_item":
      return richTextToPlain(block.numbered_list_item.rich_text);
    case "toggle":
      return richTextToPlain(block.toggle.rich_text);
    case "quote":
      return richTextToPlain(block.quote.rich_text);
    case "callout":
      return richTextToPlain(block.callout.rich_text);
    case "code":
      return richTextToPlain(block.code.rich_text);
    case "to_do":
      return (block.to_do.checked ? "☑ " : "☐ ") + richTextToPlain(block.to_do.rich_text);
    case "divider":
      return "---";
    default:
      return "";
  }
}

/** Fetch all blocks from a Notion page (handles pagination) */
async function fetchAllBlocks(notion: NotionClient, blockId: string): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if ("type" in block) {
        blocks.push(block as BlockObjectResponse);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

/** Parse Notion blocks into Brand Bible structure */
function parseBlocksIntoBrandBible(blocks: BlockObjectResponse[]): BrandBible {
  const sections: BrandSection[] = [];
  let currentSection: BrandSection | null = null;
  let currentSubsection: BrandSubsection | null = null;
  let sectionIndex = 0;
  let subsectionIndex = 0;

  for (const block of blocks) {
    const text = getBlockText(block).trim();
    if (!text) continue;

    if (block.type === "heading_1") {
      // New main section
      sectionIndex++;
      subsectionIndex = 0;
      currentSection = {
        id: String(sectionIndex),
        title: text,
        content: "",
        subsections: [],
      };
      sections.push(currentSection);
      currentSubsection = null;
    } else if (block.type === "heading_2" && currentSection) {
      // New subsection
      subsectionIndex++;
      currentSubsection = {
        id: `${currentSection.id}.${subsectionIndex}`,
        parentId: currentSection.id,
        title: text,
        content: "",
      };
      currentSection.subsections.push(currentSubsection);
    } else if (block.type === "heading_3" && currentSubsection) {
      // Append heading_3 as bold content within subsection
      currentSubsection.content += (currentSubsection.content ? "\n\n" : "") + `**${text}**`;
    } else {
      // Regular content
      if (currentSubsection) {
        currentSubsection.content += (currentSubsection.content ? "\n\n" : "") + text;
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? "\n\n" : "") + text;
      }
    }
  }

  return {
    title: "SODAX Brand Bible",
    lastUpdated: new Date(),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Default / fallback
// ---------------------------------------------------------------------------

function createDefaultBrandBible(): BrandBible {
  const sections: BrandSection[] = Object.entries(BRAND_SECTIONS).map(([id, title]) => ({
    id,
    title,
    content: `Content for ${title}. Please set NOTION_TOKEN environment variable to load from Notion.`,
    subsections: [],
  }));

  return {
    title: "SODAX Brand Bible",
    lastUpdated: new Date(),
    sections,
  };
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

export async function fetchBrandBible(forceRefresh = false): Promise<BrandBible> {
  if (!forceRefresh && isCacheValid() && cachedBrandBible) {
    return cachedBrandBible;
  }

  const notion = getNotionClient();

  if (notion) {
    try {
      const blocks = await fetchAllBlocks(notion, BRAND_BIBLE_PAGE_ID);
      const brandBible = parseBlocksIntoBrandBible(blocks);

      // If parsing found sections, use it
      if (brandBible.sections.length > 0) {
        cachedBrandBible = brandBible;
        lastFetchTime = new Date();
        console.error(
          `Brand Bible fetched from Notion API at ${lastFetchTime.toISOString()} — ` +
            `${brandBible.sections.length} sections`
        );
        return brandBible;
      }
    } catch (error) {
      console.error("Error fetching Brand Bible from Notion API:", error);
      if (cachedBrandBible) {
        console.error("Returning cached Brand Bible due to API error");
        return cachedBrandBible;
      }
    }
  }

  // Fallback
  const fallback = createDefaultBrandBible();
  cachedBrandBible = fallback;
  lastFetchTime = new Date();
  console.error("Using hardcoded fallback Brand Bible data");
  return fallback;
}

// ---------------------------------------------------------------------------
// Public helpers consumed by tools
// ---------------------------------------------------------------------------

export async function getBrandOverview(): Promise<BrandOverview> {
  const brandBible = await fetchBrandBible();

  return {
    title: brandBible.title,
    lastUpdated: brandBible.lastUpdated.toISOString(),
    sectionCount: brandBible.sections.length,
    sections: brandBible.sections.map((section) => ({
      id: section.id,
      title: section.title,
      subsectionCount: section.subsections.length,
    })),
  };
}

export async function getSection(sectionId: string): Promise<BrandSection | null> {
  const brandBible = await fetchBrandBible();
  return brandBible.sections.find((s) => s.id === sectionId) || null;
}

export async function getSubsection(subsectionId: string): Promise<BrandSubsection | null> {
  const brandBible = await fetchBrandBible();

  for (const section of brandBible.sections) {
    const subsection = section.subsections.find((s) => s.id === subsectionId);
    if (subsection) return subsection;
  }

  return null;
}

export async function listSubsections(): Promise<{ id: string; title: string; parentSection: string }[]> {
  const brandBible = await fetchBrandBible();
  const results: { id: string; title: string; parentSection: string }[] = [];

  for (const section of brandBible.sections) {
    for (const subsection of section.subsections) {
      results.push({
        id: subsection.id,
        title: subsection.title,
        parentSection: section.title,
      });
    }
  }

  return results;
}

export async function searchBrandBible(query: string, maxResults = 5): Promise<SearchResult[]> {
  const brandBible = await fetchBrandBible();
  const results: SearchResult[] = [];
  const queryWords = query.toLowerCase().split(/\s+/);

  for (const section of brandBible.sections) {
    const sectionScore = calculateRelevanceScore(section.title + " " + section.content, queryWords);
    if (sectionScore > 0) {
      results.push({
        sectionId: section.id,
        sectionTitle: section.title,
        matchedContent: extractMatchContext(section.content, queryWords),
        relevanceScore: sectionScore,
      });
    }

    for (const subsection of section.subsections) {
      const subsectionScore = calculateRelevanceScore(subsection.title + " " + subsection.content, queryWords);
      if (subsectionScore > 0) {
        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          subsectionId: subsection.id,
          subsectionTitle: subsection.title,
          matchedContent: extractMatchContext(subsection.content, queryWords),
          relevanceScore: subsectionScore,
        });
      }
    }
  }

  return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxResults);
}

function calculateRelevanceScore(text: string, queryWords: string[]): number {
  const textLower = text.toLowerCase();
  let score = 0;

  for (const word of queryWords) {
    const regex = new RegExp(word, "gi");
    const matches = textLower.match(regex);
    if (matches) {
      score += matches.length;
      if (textLower.includes(queryWords.join(" "))) {
        score += 5;
      }
    }
  }

  return score;
}

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

  return content.length > contextLength ? content.substring(0, contextLength) + "..." : content;
}

export async function refreshBrandBible(): Promise<{ success: boolean; message: string }> {
  try {
    const bb = await fetchBrandBible(true);
    return {
      success: true,
      message: `Brand Bible refreshed at ${lastFetchTime?.toISOString()} — ${bb.sections.length} sections`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export function getCacheStatus(): { cached: boolean; lastUpdated: string | null; expiresIn: number | null } {
  if (!lastFetchTime) {
    return { cached: false, lastUpdated: null, expiresIn: null };
  }

  const elapsed = Date.now() - lastFetchTime.getTime();
  const expiresIn = Math.max(0, CACHE_DURATION_MS - elapsed);

  return {
    cached: isCacheValid(),
    lastUpdated: lastFetchTime.toISOString(),
    expiresIn: Math.round(expiresIn / 1000),
  };
}
