/**
 * Technical Glossary MCP Tools
 * 
 * Tool definitions for translating technical concepts for marketing teams.
 * The glossary is sourced from two Notion pages:
 * - System Concepts (high-level ideas)
 * - System Components (concrete system parts)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getGlossaryOverview,
  getAllTerms,
  getTerm,
  searchGlossary,
  getTermsByTag,
  refreshGlossary,
  translateTerm
} from "../services/glossary.js";
import type { GlossaryCategory, GlossaryTerm } from "../services/glossary.js";

const categoryEnum = z.enum(["system-concept", "system-component"]).optional()
  .describe("Filter by category: 'system-concept' (high-level ideas) or 'system-component' (concrete system parts). Omit for all.");

/** Human-readable label for a category */
function categoryLabel(cat: GlossaryCategory): string {
  return cat === "system-concept" ? "System Concept" : "System Component";
}

/** Format a single term as markdown */
function formatTerm(term: GlossaryTerm): string {
  let md = `## ${term.title}\n\n`;
  md += `**Category:** ${categoryLabel(term.category)}\n\n`;
  md += `${term.summary}\n\n`;
  if (term.tags.length > 0) {
    md += `**Tags:** ${term.tags.map(t => `\`${t}\``).join(", ")}\n\n`;
  }
  md += `---\n\n`;
  return md;
}

/**
 * Register all glossary tools with the MCP server
 */
export function registerGlossaryTools(server: McpServer): void {

  // Tool 1: Get Glossary Overview
  server.tool(
    "sodax_get_glossary_overview",
    "Get an overview of the SODAX Technical Glossary, including available terms, categories, and tags. The glossary covers System Concepts (high-level ideas) and System Components (concrete parts of SODAX).",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ format = "markdown" }) => {
      const overview = await getGlossaryOverview();

      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(overview, null, 2)
          }]
        };
      }

      let markdown = `# ${overview.title}\n\n`;
      markdown += `**Last Updated:** ${overview.lastUpdated}\n`;
      markdown += `**Total Terms:** ${overview.termCount}\n`;
      markdown += `- System Concepts: ${overview.conceptCount}\n`;
      markdown += `- System Components: ${overview.componentCount}\n\n`;
      markdown += `## Available Tags\n\n`;
      markdown += overview.allTags.map(tag => `\`${tag}\``).join(", ");
      markdown += `\n\n## Sources\n\n`;
      markdown += `- [System Concepts](https://iconfoundation.notion.site/system-concepts)\n`;
      markdown += `- [System Components](https://iconfoundation.notion.site/system-components)\n`;
      markdown += `\n---\n*Use sodax_list_glossary_terms to see all terms, optionally filtered by category*`;

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 2: List Glossary Terms
  server.tool(
    "sodax_list_glossary_terms",
    "List terms in the SODAX Technical Glossary. Can filter by category: 'system-concept' or 'system-component'.",
    {
      category: categoryEnum,
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ category, format = "markdown" }) => {
      const terms = await getAllTerms(category as GlossaryCategory | undefined);

      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(terms, null, 2)
          }]
        };
      }

      const label = category ? categoryLabel(category as GlossaryCategory) : "All";
      let markdown = `# SODAX Technical Glossary — ${label}\n\n`;
      markdown += `Found ${terms.length} terms:\n\n`;

      for (const term of terms) {
        markdown += formatTerm(term);
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 3: Get Specific Term
  server.tool(
    "sodax_get_glossary_term",
    "Look up a specific technical term in the SODAX glossary. Returns the definition, category, and related information.",
    {
      term: z.string().describe("The technical term to look up (e.g., 'Solver', 'AMM', 'Modern money')")
    },
    async ({ term }) => {
      const result = await getTerm(term);

      if (!result) {
        const allTerms = await getAllTerms();
        return {
          content: [{
            type: "text" as const,
            text: `Term "${term}" not found.\n\nAvailable terms:\n${allTerms.map(t => `- ${t.title} *(${categoryLabel(t.category)})*`).join("\n")}`
          }],
          isError: true
        };
      }

      let markdown = `# ${result.title}\n\n`;
      markdown += `**Category:** ${categoryLabel(result.category)}\n\n`;
      markdown += `${result.summary}\n\n`;
      if (result.tags.length > 0) {
        markdown += `**Tags:** ${result.tags.map(t => `\`${t}\``).join(", ")}\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 4: Search Glossary
  server.tool(
    "sodax_search_glossary",
    "Search the technical glossary by keyword, concept, or tag. Can filter by category.",
    {
      query: z.string().describe("Search query (keyword, concept, or tag)"),
      category: categoryEnum,
      maxResults: z.number().optional().describe("Maximum results (default: 10)")
    },
    async ({ query, category, maxResults = 10 }) => {
      const results = await searchGlossary(query, category as GlossaryCategory | undefined);

      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No results found for "${query}"${category ? ` in ${categoryLabel(category as GlossaryCategory)}` : ""}. Try different keywords or use sodax_list_glossary_terms to see all available terms.`
          }]
        };
      }

      const limited = results.slice(0, maxResults);

      let markdown = `# Search Results for "${query}"\n\n`;
      if (category) markdown += `**Filtered to:** ${categoryLabel(category as GlossaryCategory)}\n\n`;
      markdown += `Found ${results.length} result(s)${results.length > maxResults ? ` (showing ${maxResults})` : ""}:\n\n`;

      for (const term of limited) {
        markdown += formatTerm(term);
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 5: Translate Technical Term
  server.tool(
    "sodax_translate_term",
    "Translate a technical SODAX term into simpler language for non-technical audiences. Perfect for marketing content creation.",
    {
      term: z.string().describe("The technical term to translate (e.g., 'Solver', 'cross-network', 'Modern money')")
    },
    async ({ term }) => {
      const result = await translateTerm(term);

      if (!result) {
        const allTerms = await getAllTerms();
        return {
          content: [{
            type: "text" as const,
            text: `Term "${term}" not found in glossary.\n\nAvailable terms:\n${allTerms.map(t => `- ${t.title} *(${categoryLabel(t.category)})*`).join("\n")}`
          }],
          isError: true
        };
      }

      let markdown = `# Translation: ${result.term}\n\n`;
      markdown += `**Category:** ${categoryLabel(result.category)}\n\n`;
      markdown += `## Technical Definition\n${result.technicalDefinition}\n\n`;
      markdown += `## Simple Explanation\n${result.simpleExplanation}\n\n`;

      if (result.relatedTerms.length > 0) {
        markdown += `## Related Terms\n`;
        markdown += result.relatedTerms.map(t => `- ${t}`).join("\n");
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 6: Get Terms by Tag
  server.tool(
    "sodax_get_terms_by_tag",
    "Get all glossary terms that have a specific tag. Can filter by category.",
    {
      tag: z.string().describe("Tag to filter by (e.g., 'solver', 'liquidity', 'cross-network')"),
      category: categoryEnum
    },
    async ({ tag, category }) => {
      const terms = await getTermsByTag(tag, category as GlossaryCategory | undefined);

      if (terms.length === 0) {
        const overview = await getGlossaryOverview();
        return {
          content: [{
            type: "text" as const,
            text: `No terms found with tag "${tag}"${category ? ` in ${categoryLabel(category as GlossaryCategory)}` : ""}.\n\nAvailable tags:\n${overview.allTags.map(t => `\`${t}\``).join(", ")}`
          }]
        };
      }

      let markdown = `# Terms Tagged: "${tag}"\n\n`;
      if (category) markdown += `**Filtered to:** ${categoryLabel(category as GlossaryCategory)}\n\n`;
      markdown += `Found ${terms.length} term(s):\n\n`;

      for (const term of terms) {
        markdown += formatTerm(term);
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 7: Refresh Glossary
  server.tool(
    "sodax_refresh_glossary",
    "Force refresh the cached glossary data from both Notion sources (System Concepts & System Components). Use this if you need the latest updates.",
    {},
    async () => {
      const result = await refreshGlossary();

      return {
        content: [{
          type: "text" as const,
          text: result.success
            ? `✅ ${result.message}`
            : `❌ ${result.message}`
        }],
        isError: !result.success
      };
    }
  );
}
