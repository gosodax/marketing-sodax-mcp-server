/**
 * Technical Glossary Service
 *
 * Fetches the SODAX Technical Glossary from two Notion databases via the
 * official Notion API.  New entries added to either database in Notion are
 * picked up automatically on the next cache refresh (every 5 min or on demand).
 *
 * Sources:
 *   - System Concepts — high-level ideas and principles behind SODAX
 *   - System Components — concrete parts and modules that make up SODAX
 */

import { Client as NotionClient, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import {
  GLOSSARY_SYSTEM_CONCEPTS_DB,
  GLOSSARY_SYSTEM_COMPONENTS_DB,
  GLOSSARY_CACHE_DURATION_MS,
} from "../constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlossaryCategory = "system-concept" | "system-component";

export interface GlossaryTerm {
  title: string;
  summary: string;
  tags: string[];
  category: GlossaryCategory;
  owner?: string;
}

export interface GlossaryData {
  title: string;
  lastUpdated: Date;
  terms: GlossaryTerm[];
}

// ---------------------------------------------------------------------------
// Notion client (lazy-initialised so the server can start without a token and
//               fall back to hardcoded data)
// ---------------------------------------------------------------------------

let notionClient: NotionClient | null = null;

function getNotionClient(): NotionClient | null {
  if (notionClient) return notionClient;
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error(
      "NOTION_TOKEN not set — glossary will use hardcoded fallback data. " +
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

let cachedGlossary: GlossaryData | null = null;
let lastGlossaryFetchTime: Date | null = null;

function isGlossaryCacheValid(): boolean {
  if (!cachedGlossary || !lastGlossaryFetchTime) return false;
  return Date.now() - lastGlossaryFetchTime.getTime() < GLOSSARY_CACHE_DURATION_MS;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback terms
// Kept as a safety net when the Notion API is unreachable or unconfigured.
// ---------------------------------------------------------------------------

const FALLBACK_SYSTEM_CONCEPTS: GlossaryTerm[] = [
  {
    title: "Modern money",
    summary:
      "Money that exists in programmable, multi-network systems, where its usefulness depends on coordinated execution, timing, and context, not just ownership.",
    tags: ["money", "programmable", "multi-network", "execution"],
    category: "system-concept",
  },
];

const FALLBACK_SYSTEM_COMPONENTS: GlossaryTerm[] = [
  {
    title: "Money Market",
    summary:
      "A cross-network money market that lets SODAX and builders lend, borrow, and reuse capital across all integrated networks.",
    tags: ["money-market", "lending", "borrowing", "cross-network", "capital", "yield", "solver", "sdk"],
    category: "system-component",
  },
  {
    title: "AMM",
    summary:
      "The SODAX AMM is SODAX's internal decentralized exchange on the Sonic network, used to create tradeable markets for SODAX-native assets, primarily paired against bnUSD.",
    tags: ["system", "amm", "liquidity", "execution", "settlement"],
    category: "system-component",
  },
  {
    title: "sodaVariants",
    summary:
      "sodaVariants are how SODAX extends assets into networks where they do not exist natively, making them immediately usable through system-level liquidity.",
    tags: ["system", "assets", "liquidity", "execution", "cross-network"],
    category: "system-component",
  },
  {
    title: "Liquidity",
    summary:
      "Liquidity is the SODAX system component that enables cross-network actions to complete by treating assets as a unified, globally accessible inventory rather than isolated pools.",
    tags: ["system", "liquidity", "inventory", "execution", "cross-network"],
    category: "system-component",
  },
  {
    title: "Solver",
    summary:
      "The Solver is the part of SODAX responsible for deciding, initiating, and coordinating how a cross-network action is carried out, selecting the most reliable execution path across networks.",
    tags: ["routing", "solver", "cross-network", "execution", "liquidity"],
    category: "system-component",
  },
  {
    title: "Coordinator",
    summary:
      "The coordinator is a solver component responsible for constructing and monitoring the execution plan for a cross-network action across networks.",
    tags: ["system", "solver", "coordinator", "execution", "cross-network"],
    category: "system-component",
  },
];

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a Notion rich-text array */
function richTextToPlain(rt: RichTextItemResponse[]): string {
  return rt.map((t) => t.plain_text).join("");
}

/** Convert a Notion database page to a GlossaryTerm */
function pageToTerm(page: PageObjectResponse, category: GlossaryCategory): GlossaryTerm | null {
  const props = page.properties;

  // Title — Notion stores the title in a property of type "title"
  const titleProp = Object.values(props).find((p) => p.type === "title");
  const title = titleProp && titleProp.type === "title" ? richTextToPlain(titleProp.title) : "";

  // Summary — look for "One-sentency summary" or "Summary" rich_text property
  let summary = "";
  for (const key of ["One-sentency summary", "Summary", "Description"]) {
    const prop = props[key];
    if (prop && prop.type === "rich_text") {
      summary = richTextToPlain(prop.rich_text);
      if (summary) break;
    }
  }

  // Tags — multi_select property named "Tags"
  const tagsProp = props["Tags"];
  const tags: string[] =
    tagsProp && tagsProp.type === "multi_select"
      ? tagsProp.multi_select.map((t) => t.name)
      : [];

  // Owner — person property or rich_text named "Owner"
  let owner: string | undefined;
  const ownerProp = props["Owner"];
  if (ownerProp?.type === "people" && ownerProp.people.length > 0) {
    const person = ownerProp.people[0];
    owner = "name" in person ? (person.name ?? undefined) : undefined;
  } else if (ownerProp?.type === "rich_text") {
    owner = richTextToPlain(ownerProp.rich_text) || undefined;
  }

  if (!title || !summary) return null;

  return { title, summary, tags, category, owner };
}

/** Query all pages from a Notion database using dataSources.query (v5.9+) */
async function queryDatabase(
  notion: NotionClient,
  databaseId: string,
  category: GlossaryCategory
): Promise<GlossaryTerm[]> {
  const terms: GlossaryTerm[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (!isFullPage(page)) continue;
      const term = pageToTerm(page, category);
      if (term) terms.push(term);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return terms;
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

export async function fetchGlossary(forceRefresh = false): Promise<GlossaryData> {
  if (!forceRefresh && isGlossaryCacheValid() && cachedGlossary) {
    return cachedGlossary;
  }

  const notion = getNotionClient();

  if (notion) {
    try {
      const [concepts, components] = await Promise.all([
        queryDatabase(notion, GLOSSARY_SYSTEM_CONCEPTS_DB, "system-concept"),
        queryDatabase(notion, GLOSSARY_SYSTEM_COMPONENTS_DB, "system-component"),
      ]);

      const glossary: GlossaryData = {
        title: "SODAX Technical Glossary",
        lastUpdated: new Date(),
        terms: [...concepts, ...components],
      };

      cachedGlossary = glossary;
      lastGlossaryFetchTime = new Date();
      console.error(
        `Glossary fetched from Notion API at ${lastGlossaryFetchTime.toISOString()} — ` +
          `${concepts.length} concepts, ${components.length} components`
      );
      return glossary;
    } catch (error) {
      console.error("Error fetching glossary from Notion API:", error);
      if (cachedGlossary) {
        console.error("Returning cached glossary due to API error");
        return cachedGlossary;
      }
      // Fall through to fallback
    }
  }

  // Fallback: hardcoded terms
  const glossary: GlossaryData = {
    title: "SODAX Technical Glossary",
    lastUpdated: new Date(),
    terms: [...FALLBACK_SYSTEM_CONCEPTS, ...FALLBACK_SYSTEM_COMPONENTS],
  };

  cachedGlossary = glossary;
  lastGlossaryFetchTime = new Date();
  console.error("Using hardcoded fallback glossary data");
  return glossary;
}

// ---------------------------------------------------------------------------
// Public helpers consumed by tools
// ---------------------------------------------------------------------------

export async function getGlossaryOverview(): Promise<{
  title: string;
  lastUpdated: string;
  termCount: number;
  conceptCount: number;
  componentCount: number;
  allTags: string[];
  categories: GlossaryCategory[];
}> {
  const glossary = await fetchGlossary();

  const allTags = new Set<string>();
  let conceptCount = 0;
  let componentCount = 0;
  for (const term of glossary.terms) {
    for (const tag of term.tags) allTags.add(tag);
    if (term.category === "system-concept") conceptCount++;
    else componentCount++;
  }

  return {
    title: glossary.title,
    lastUpdated: glossary.lastUpdated.toISOString(),
    termCount: glossary.terms.length,
    conceptCount,
    componentCount,
    allTags: Array.from(allTags).sort(),
    categories: ["system-concept", "system-component"],
  };
}

export async function getAllTerms(category?: GlossaryCategory): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  return category ? glossary.terms.filter((t) => t.category === category) : glossary.terms;
}

export async function getTerm(termTitle: string): Promise<GlossaryTerm | null> {
  const glossary = await fetchGlossary();
  const q = termTitle.toLowerCase();
  return (
    glossary.terms.find(
      (t) => t.title.toLowerCase() === q || t.title.toLowerCase().includes(q)
    ) ?? null
  );
}

export async function searchGlossary(
  query: string,
  category?: GlossaryCategory
): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  const words = query.toLowerCase().split(/\s+/);

  const scored: { term: GlossaryTerm; score: number }[] = [];

  for (const term of glossary.terms) {
    if (category && term.category !== category) continue;
    let score = 0;
    const tl = term.title.toLowerCase();
    const sl = term.summary.toLowerCase();
    for (const w of words) {
      if (tl.includes(w)) score += 10;
      if (term.tags.some((tag) => tag.toLowerCase().includes(w))) score += 5;
      if (sl.includes(w)) score += 2;
    }
    if (tl === query.toLowerCase()) score += 20;
    if (score > 0) scored.push({ term, score });
  }

  return scored.sort((a, b) => b.score - a.score).map((r) => r.term);
}

export async function getTermsByTag(
  tag: string,
  category?: GlossaryCategory
): Promise<GlossaryTerm[]> {
  const glossary = await fetchGlossary();
  const q = tag.toLowerCase();
  return glossary.terms.filter((term) => {
    if (category && term.category !== category) return false;
    return term.tags.some((t) => t.toLowerCase().includes(q));
  });
}

export async function refreshGlossary(): Promise<{ success: boolean; message: string }> {
  try {
    const glossary = await fetchGlossary(true);
    return {
      success: true,
      message: `Glossary refreshed at ${lastGlossaryFetchTime?.toISOString()} — ${glossary.terms.length} total terms`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function translateTerm(technicalTerm: string): Promise<{
  term: string;
  category: GlossaryCategory;
  technicalDefinition: string;
  simpleExplanation: string;
  relatedTerms: string[];
} | null> {
  const term = await getTerm(technicalTerm);
  if (!term) return null;

  const glossary = await fetchGlossary();
  const relatedTerms: string[] = [];
  for (const other of glossary.terms) {
    if (other.title === term.title) continue;
    if (term.tags.some((tag) => other.tags.includes(tag))) {
      relatedTerms.push(other.title);
    }
  }

  return {
    term: term.title,
    category: term.category,
    technicalDefinition: term.summary,
    simpleExplanation: simplifyExplanation(term.summary),
    relatedTerms: relatedTerms.slice(0, 5),
  };
}

function simplifyExplanation(technical: string): string {
  return technical
    .replace(/cross-network/gi, "across multiple blockchains")
    .replace(/execution path/gi, "route")
    .replace(/orchestrated/gi, "managed")
    .replace(/decentralized exchange/gi, "trading platform")
    .replace(/liquidity/gi, "available funds")
    .replace(/settlement/gi, "final processing")
    .replace(/interoperability/gi, "ability to work together")
    .replace(/protocol/gi, "system");
}
