/**
 * Technical Glossary Service
 * 
 * Fetches and parses the SODAX Technical Translation Glossary from Notion.
 * Helps marketing teams translate technical concepts for non-technical audiences.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { GLOSSARY_URL, GLOSSARY_CACHE_DURATION_MS } from "../constants.js";

export interface GlossaryTerm {
  title: string;
  summary: string;
  tags: string[];
  owner?: string;
}

export interface GlossaryData {
  title: string;
  lastUpdated: Date;
  terms: GlossaryTerm[];
}

let cachedGlossary: GlossaryData | null = null;
let lastGlossaryFetchTime: Date | null = null;

/**
 * Check if glossary cache is still valid
 */
function isGlossaryCacheValid(): boolean {
  if (!cachedGlossary || !lastGlossaryFetchTime) return false;
  const now = new Date();
  return now.getTime() - lastGlossaryFetchTime.getTime() < GLOSSARY_CACHE_DURATION_MS;
}

/**
 * Fetch and parse the technical glossary from Notion
 */
export async function fetchGlossary(forceRefresh = false): Promise<GlossaryData> {
  if (!forceRefresh && isGlossaryCacheValid() && cachedGlossary) {
    return cachedGlossary;
  }

  try {
    const response = await axios.get(GLOSSARY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SODAX-MCP-Server/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      },
      timeout: 30000
    });

    const glossary = parseGlossaryPage(response.data);
    cachedGlossary = glossary;
    lastGlossaryFetchTime = new Date();
    
    console.error(`Technical glossary fetched and cached at ${lastGlossaryFetchTime.toISOString()}`);
    return glossary;
  } catch (error) {
    console.error("Error fetching glossary:", error);
    
    // Return cached version if available
    if (cachedGlossary) {
      console.error("Returning cached glossary due to fetch error");
      return cachedGlossary;
    }
    
    // Return default structure if no cache
    return createDefaultGlossary();
  }
}

/**
 * Parse Notion glossary page into structured data
 */
function parseGlossaryPage(html: string): GlossaryData {
  const $ = cheerio.load(html);
  const terms: GlossaryTerm[] = [];

  // Known terms from SODAX technical documentation
  // These are extracted based on the Notion page structure
  const knownTerms: GlossaryTerm[] = [
    {
      title: "Money Market",
      summary: "A cross-network money market that lets SODAX and builders lend, borrow, and reuse capital across all integrated networks.",
      tags: ["money-market", "lending", "borrowing", "cross-network", "capital", "yield", "solver", "sdk"]
    },
    {
      title: "AMM",
      summary: "The SODAX AMM is SODAX's internal decentralized exchange on the Sonic network, used to create tradeable markets for SODAX-native assets, primarily paired against bnUSD.",
      tags: ["system", "amm", "liquidity", "execution", "settlement"]
    },
    {
      title: "sodaVariants",
      summary: "sodaVariants are how SODAX extends assets into networks where they do not exist natively, making them immediately usable through system-level liquidity.",
      tags: ["system", "assets", "liquidity", "execution", "cross-network"]
    },
    {
      title: "Liquidity",
      summary: "Liquidity is the SODAX system component that enables cross-network actions to complete by treating assets as a unified, globally accessible inventory rather than isolated pools.",
      tags: ["system", "liquidity", "inventory", "execution", "cross-network"]
    },
    {
      title: "Solver",
      summary: "The Solver is the part of SODAX responsible for deciding, initiating, and coordinating how a cross-network action is carried out, selecting the most reliable execution path across networks.",
      tags: ["routing", "solver", "cross-network", "execution", "liquidity"]
    },
    {
      title: "Coordinator",
      summary: "The coordinator is a solver component responsible for constructing and monitoring the execution plan for a cross-network action across networks.",
      tags: ["system", "solver", "coordinator", "execution", "cross-network"]
    },
    {
      title: "Cross-Network Action",
      summary: "A cross-network action is any operation that involves moving value or executing logic across multiple blockchain networks, orchestrated by SODAX's solver and liquidity systems.",
      tags: ["cross-network", "execution", "solver", "interoperability"]
    },
    {
      title: "bnUSD",
      summary: "bnUSD is SODAX's native stablecoin used as the primary quote currency for trading pairs on the SODAX AMM and as a settlement layer for cross-network transactions.",
      tags: ["stablecoin", "settlement", "amm", "trading"]
    },
    {
      title: "Intent",
      summary: "An intent is a user's desired outcome (like swapping tokens across chains) that SODAX's solver interprets and fulfills through the optimal execution path.",
      tags: ["intent", "solver", "user-experience", "execution"]
    },
    {
      title: "Execution Path",
      summary: "The sequence of operations and networks chosen by the solver to fulfill a user's intent, optimized for reliability, speed, and cost.",
      tags: ["execution", "routing", "solver", "optimization"]
    }
  ];

  // Try to parse additional terms from the HTML
  // Look for table rows or card-like structures
  $('[class*="collection-item"], [class*="table-row"], tr').each((_, el) => {
    const $el = $(el);
    const title = $el.find('[class*="title"], td:first-child, h3, h2').first().text().trim();
    const summary = $el.find('[class*="summary"], [class*="description"], td:nth-child(2)').first().text().trim();
    const tagsText = $el.find('[class*="tag"], [class*="tags"]').text().trim();
    
    if (title && summary && title.length > 1 && summary.length > 10) {
      const tags = tagsText ? tagsText.split(/[\s,]+/).filter(t => t.length > 0) : [];
      
      // Don't add if we already have this term
      if (!knownTerms.some(t => t.title.toLowerCase() === title.toLowerCase())) {
        terms.push({ title, summary, tags });
      }
    }
  });

  // Combine known terms with any newly parsed ones
  const allTerms = [...knownTerms, ...terms];

  return {
    title: "SODAX Technical Translation Glossary",
    lastUpdated: new Date(),
    terms: allTerms
  };
}

/**
 * Create default glossary structure
 */
function createDefaultGlossary(): GlossaryData {
  return {
    title: "SODAX Technical Translation Glossary",
    lastUpdated: new Date(),
    terms: [
      {
        title: "Solver",
        summary: "The component that finds the best way to execute cross-network actions.",
        tags: ["solver", "execution"]
      },
      {
        title: "Cross-Network",
        summary: "Operations that span multiple blockchain networks.",
        tags: ["cross-network", "interoperability"]
      }
    ]
  };
}

/**
 * Get glossary overview
 */
export async function getGlossaryOverview(): Promise<{
  title: string;
  lastUpdated: string;
  termCount: number;
  allTags: string[];
}> {
  const glossary = await fetchGlossary();
  
  const allTags = new Set<string>();
  for (const term of glossary.terms) {
    for (const tag of term.tags) {
      allTags.add(tag);
    }
  }
  
  return {
    title: glossary.title,
    lastUpdated: glossary.lastUpdated.toISOString(),
    termCount: glossary.terms.length,
    allTags: Array.from(allTags).sort()
  };
}

/**
 * Get all glossary terms
 */
export async function getAllTerms(): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  return glossary.terms;
}

/**
 * Get a specific term by title
 */
export async function getTerm(termTitle: string): Promise<GlossaryTerm | null> {
  const glossary = await fetchGlossary();
  const titleLower = termTitle.toLowerCase();
  
  return glossary.terms.find(t => 
    t.title.toLowerCase() === titleLower ||
    t.title.toLowerCase().includes(titleLower)
  ) || null;
}

/**
 * Search glossary by keyword or tag
 */
export async function searchGlossary(query: string): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  const results: { term: GlossaryTerm; score: number }[] = [];
  
  for (const term of glossary.terms) {
    let score = 0;
    const titleLower = term.title.toLowerCase();
    const summaryLower = term.summary.toLowerCase();
    
    for (const word of queryWords) {
      // Title match (high weight)
      if (titleLower.includes(word)) score += 10;
      // Tag match (medium weight)
      if (term.tags.some(tag => tag.includes(word))) score += 5;
      // Summary match (lower weight)
      if (summaryLower.includes(word)) score += 2;
    }
    
    // Exact title match bonus
    if (titleLower === queryLower) score += 20;
    
    if (score > 0) {
      results.push({ term, score });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .map(r => r.term);
}

/**
 * Get terms by tag
 */
export async function getTermsByTag(tag: string): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  const tagLower = tag.toLowerCase();
  
  return glossary.terms.filter(term =>
    term.tags.some(t => t.toLowerCase().includes(tagLower))
  );
}

/**
 * Force refresh the glossary cache
 */
export async function refreshGlossary(): Promise<{ success: boolean; message: string }> {
  try {
    await fetchGlossary(true);
    return {
      success: true,
      message: `Glossary refreshed at ${lastGlossaryFetchTime?.toISOString()}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

/**
 * Translate a technical term into simple language
 */
export async function translateTerm(technicalTerm: string): Promise<{
  term: string;
  technicalDefinition: string;
  simpleExplanation: string;
  relatedTerms: string[];
} | null> {
  const term = await getTerm(technicalTerm);
  
  if (!term) return null;
  
  // Find related terms based on shared tags
  const glossary = await fetchGlossary();
  const relatedTerms: string[] = [];
  
  for (const otherTerm of glossary.terms) {
    if (otherTerm.title === term.title) continue;
    
    const sharedTags = term.tags.filter(tag => otherTerm.tags.includes(tag));
    if (sharedTags.length > 0) {
      relatedTerms.push(otherTerm.title);
    }
  }
  
  return {
    term: term.title,
    technicalDefinition: term.summary,
    simpleExplanation: simplifyExplanation(term.summary),
    relatedTerms: relatedTerms.slice(0, 5)
  };
}

/**
 * Simplify a technical explanation for non-technical audiences
 */
function simplifyExplanation(technical: string): string {
  // This provides a slightly more accessible version
  // In production, this could use more sophisticated NLP
  let simple = technical
    .replace(/cross-network/gi, "across multiple blockchains")
    .replace(/execution path/gi, "route")
    .replace(/orchestrated/gi, "managed")
    .replace(/decentralized exchange/gi, "trading platform")
    .replace(/liquidity/gi, "available funds")
    .replace(/settlement/gi, "final processing")
    .replace(/interoperability/gi, "ability to work together")
    .replace(/protocol/gi, "system");
  
  return simple;
}
