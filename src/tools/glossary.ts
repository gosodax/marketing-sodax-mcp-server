/**
 * Technical Glossary MCP Tools
 * 
 * Tool definitions for translating technical concepts for marketing teams.
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

/**
 * Register all glossary tools with the MCP server
 */
export function registerGlossaryTools(server: McpServer): void {
  
  // Tool 1: Get Glossary Overview
  server.tool(
    "sodax_get_glossary_overview",
    "Get an overview of the SODAX Technical Translation Glossary, including available terms and tags. Use this to see what technical concepts are documented.",
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
      markdown += `**Total Terms:** ${overview.termCount}\n\n`;
      markdown += `## Available Tags\n\n`;
      markdown += overview.allTags.map(tag => `\`${tag}\``).join(", ");
      markdown += `\n\n---\n*Use sodax_list_glossary_terms to see all terms*`;

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 2: List All Glossary Terms
  server.tool(
    "sodax_list_glossary_terms",
    "List all terms in the SODAX Technical Translation Glossary with their definitions. Great for understanding SODAX terminology.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ format = "markdown" }) => {
      const terms = await getAllTerms();
      
      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(terms, null, 2)
          }]
        };
      }

      let markdown = `# SODAX Technical Glossary\n\n`;
      markdown += `Found ${terms.length} terms:\n\n`;
      
      for (const term of terms) {
        markdown += `## ${term.title}\n\n`;
        markdown += `${term.summary}\n\n`;
        if (term.tags.length > 0) {
          markdown += `**Tags:** ${term.tags.map(t => `\`${t}\``).join(", ")}\n\n`;
        }
        markdown += `---\n\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 3: Get Specific Term
  server.tool(
    "sodax_get_glossary_term",
    "Look up a specific technical term in the SODAX glossary. Returns the definition and related information.",
    {
      term: z.string().describe("The technical term to look up (e.g., 'Solver', 'AMM', 'Liquidity')")
    },
    async ({ term }) => {
      const result = await getTerm(term);
      
      if (!result) {
        const allTerms = await getAllTerms();
        return {
          content: [{
            type: "text" as const,
            text: `Term "${term}" not found.\n\nAvailable terms:\n${allTerms.map(t => `- ${t.title}`).join("\n")}`
          }],
          isError: true
        };
      }

      let markdown = `# ${result.title}\n\n`;
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
    "Search the technical glossary by keyword, concept, or tag. Useful for finding terms related to specific topics.",
    {
      query: z.string().describe("Search query (keyword, concept, or tag)"),
      maxResults: z.number().optional().describe("Maximum results (default: 10)")
    },
    async ({ query, maxResults = 10 }) => {
      const results = await searchGlossary(query);
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No results found for "${query}". Try different keywords or use sodax_list_glossary_terms to see all available terms.`
          }]
        };
      }

      const limited = results.slice(0, maxResults);
      
      let markdown = `# Search Results for "${query}"\n\n`;
      markdown += `Found ${results.length} result(s)${results.length > maxResults ? ` (showing ${maxResults})` : ""}:\n\n`;
      
      for (const term of limited) {
        markdown += `## ${term.title}\n\n`;
        markdown += `${term.summary}\n\n`;
        markdown += `---\n\n`;
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
      term: z.string().describe("The technical term to translate (e.g., 'Solver', 'cross-network')")
    },
    async ({ term }) => {
      const result = await translateTerm(term);
      
      if (!result) {
        const allTerms = await getAllTerms();
        return {
          content: [{
            type: "text" as const,
            text: `Term "${term}" not found in glossary.\n\nAvailable terms:\n${allTerms.map(t => `- ${t.title}`).join("\n")}`
          }],
          isError: true
        };
      }

      let markdown = `# Translation: ${result.term}\n\n`;
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
    "Get all glossary terms that have a specific tag. Useful for exploring related concepts.",
    {
      tag: z.string().describe("Tag to filter by (e.g., 'solver', 'liquidity', 'cross-network')")
    },
    async ({ tag }) => {
      const terms = await getTermsByTag(tag);
      
      if (terms.length === 0) {
        const overview = await getGlossaryOverview();
        return {
          content: [{
            type: "text" as const,
            text: `No terms found with tag "${tag}".\n\nAvailable tags:\n${overview.allTags.map(t => `\`${t}\``).join(", ")}`
          }]
        };
      }

      let markdown = `# Terms Tagged: "${tag}"\n\n`;
      markdown += `Found ${terms.length} term(s):\n\n`;
      
      for (const term of terms) {
        markdown += `## ${term.title}\n\n`;
        markdown += `${term.summary}\n\n`;
        markdown += `---\n\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 7: Refresh Glossary
  server.tool(
    "sodax_refresh_glossary",
    "Force refresh the cached glossary data from Notion. Use this if you need the latest updates.",
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
