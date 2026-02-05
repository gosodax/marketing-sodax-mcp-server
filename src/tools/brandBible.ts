/**
 * Brand Bible MCP Tools
 * 
 * Tool definitions for interacting with the SODAX Brand Bible.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getBrandOverview,
  getSection,
  getSubsection,
  listSubsections,
  searchBrandBible,
  refreshBrandBible,
  getCacheStatus
} from "../services/brandBible.js";
import { BRAND_SECTIONS } from "../constants.js";
import { ResponseFormat } from "../types.js";

/**
 * Register all brand bible tools with the MCP server
 */
export function registerBrandBibleTools(server: McpServer): void {
  
  // Tool 1: Get Marketing Overview
  server.tool(
    "sodax_get_marketing_overview",
    "Get a high-level overview of the SODAX Marketing Guidelines (Brand Bible), including all sections and their structure. Use this first to understand what's available.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ format = "markdown" }) => {
      const overview = await getBrandOverview();
      const cacheStatus = getCacheStatus();
      
      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...overview, cacheStatus }, null, 2)
          }]
        };
      }

      // Markdown format
      let markdown = `# ${overview.title}\n\n`;
      markdown += `**Last Updated:** ${overview.lastUpdated}\n`;
      markdown += `**Total Sections:** ${overview.sectionCount}\n\n`;
      markdown += `## Sections\n\n`;
      
      for (const section of overview.sections) {
        markdown += `### ${section.id}. ${section.title}\n`;
        if (section.subsectionCount > 0) {
          markdown += `   - ${section.subsectionCount} subsection(s)\n`;
        }
        markdown += `\n`;
      }

      markdown += `---\n*Cache: ${cacheStatus.cached ? "Valid" : "Expired"} | Expires in: ${cacheStatus.expiresIn}s*`;

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 2: Get Section
  server.tool(
    "sodax_get_section",
    "Get a specific section of the SODAX Brand Bible by section number (1-6). Sections include: 1-Introduction, 2-Voice & Tone, 3-Visual Identity, 4-Messaging, 5-Content Guidelines, 6-Applications.",
    {
      sectionId: z.string().describe("Section number (1-6)"),
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ sectionId, format = "markdown" }) => {
      const section = await getSection(sectionId);
      
      if (!section) {
        return {
          content: [{
            type: "text" as const,
            text: `Section "${sectionId}" not found. Valid sections are 1-6:\n${Object.entries(BRAND_SECTIONS).map(([id, title]) => `${id}: ${title}`).join("\n")}`
          }],
          isError: true
        };
      }

      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(section, null, 2)
          }]
        };
      }

      // Markdown format
      let markdown = `# Section ${section.id}: ${section.title}\n\n`;
      markdown += section.content + "\n\n";
      
      if (section.subsections.length > 0) {
        markdown += `## Subsections\n\n`;
        for (const sub of section.subsections) {
          markdown += `### ${sub.id} ${sub.title}\n\n`;
          markdown += sub.content + "\n\n";
        }
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 3: Get Subsection
  server.tool(
    "sodax_get_subsection",
    "Get a specific subsection of the SODAX Brand Bible by ID (e.g., '3.1' for Visual Identity > Logo Guidelines).",
    {
      subsectionId: z.string().describe("Subsection ID in format 'X.Y' (e.g., '3.1')"),
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ subsectionId, format = "markdown" }) => {
      const subsection = await getSubsection(subsectionId);
      
      if (!subsection) {
        const allSubsections = await listSubsections();
        return {
          content: [{
            type: "text" as const,
            text: `Subsection "${subsectionId}" not found.\n\nAvailable subsections:\n${allSubsections.map(s => `${s.id}: ${s.title} (in ${s.parentSection})`).join("\n")}`
          }],
          isError: true
        };
      }

      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(subsection, null, 2)
          }]
        };
      }

      // Markdown format
      let markdown = `# ${subsection.id} ${subsection.title}\n\n`;
      markdown += subsection.content;

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 4: Search Marketing Guidelines
  server.tool(
    "sodax_search_marketing",
    "Search the SODAX Marketing Guidelines (Brand Bible) for specific topics, keywords, or guidelines. Returns the most relevant sections matching your query.",
    {
      query: z.string().describe("Search query (keywords or phrase)"),
      maxResults: z.number().optional().describe("Maximum results to return (default: 5)")
    },
    async ({ query, maxResults = 5 }) => {
      const results = await searchBrandBible(query, maxResults);
      
      if (results.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No results found for "${query}". Try different keywords or use sodax_get_marketing_overview to see available sections.`
          }]
        };
      }

      let markdown = `# Search Results for "${query}"\n\n`;
      markdown += `Found ${results.length} result(s):\n\n`;
      
      for (const result of results) {
        if (result.subsectionId) {
          markdown += `## ${result.subsectionId} ${result.subsectionTitle}\n`;
          markdown += `*In Section ${result.sectionId}: ${result.sectionTitle}*\n\n`;
        } else {
          markdown += `## Section ${result.sectionId}: ${result.sectionTitle}\n\n`;
        }
        markdown += `${result.matchedContent}\n\n`;
        markdown += `---\n\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );

  // Tool 5: Refresh Marketing Data
  server.tool(
    "sodax_refresh_marketing",
    "Force refresh the cached Marketing Guidelines (Brand Bible) data from Notion. Use this if you need the latest updates.",
    {},
    async () => {
      const result = await refreshBrandBible();
      
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

  // Tool 6: List Subsections
  server.tool(
    "sodax_list_subsections",
    "List all subsections in the SODAX Brand Bible with their IDs. Useful for finding specific content to retrieve.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)")
    },
    async ({ format = "markdown" }) => {
      const subsections = await listSubsections();
      
      if (format === "json") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(subsections, null, 2)
          }]
        };
      }

      // Markdown format
      let markdown = `# Brand Bible Subsections\n\n`;
      let currentParent = "";
      
      for (const sub of subsections) {
        if (sub.parentSection !== currentParent) {
          currentParent = sub.parentSection;
          markdown += `## ${currentParent}\n\n`;
        }
        markdown += `- **${sub.id}**: ${sub.title}\n`;
      }

      markdown += `\n---\n*Use sodax_get_subsection with any ID to get full content*`;

      return {
        content: [{ type: "text" as const, text: markdown }]
      };
    }
  );
}
