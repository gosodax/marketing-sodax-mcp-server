/**
 * Marketing Stats MCP Tools
 *
 * Tool definitions for accessing live SODAX marketing statistics.
 * Data is fetched from the SODAX Backend API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getStatsOverview,
  getNetworks,
  getPartners,
  getTokenSupply,
  getMoneyMarketAssets,
  refreshStats,
} from "../services/stats.js";

/**
 * Register all marketing stats tools with the MCP server
 */
export function registerStatsTools(server: McpServer): void {
  // Tool 1: Get Stats Overview
  server.tool(
    "sodax_get_stats_overview",
    "Get a high-level overview of SODAX marketing stats: integrated networks count, partner count, token supply, and recent activity. Great for marketing copy and fact-checking.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)"),
    },
    async ({ format = "markdown" }) => {
      const overview = await getStatsOverview();

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(overview, null, 2),
            },
          ],
        };
      }

      const supplyInMillions = (parseInt(overview.totalSupply) / 1_000_000).toFixed(0);
      const circulatingInMillions = (parseInt(overview.circulatingSupply) / 1_000_000).toFixed(0);

      let markdown = `# SODAX Marketing Stats\n\n`;
      markdown += `**Last Updated:** ${overview.lastUpdated}\n\n`;
      markdown += `## Key Metrics\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| Integrated Networks | ${overview.networkCount} |\n`;
      markdown += `| Partner Integrations | ${overview.partnerCount} |\n`;
      markdown += `| Total Token Supply | ${supplyInMillions}M SODA |\n`;
      markdown += `| Circulating Supply | ${circulatingInMillions}M SODA |\n`;
      markdown += `| Money Market Assets | ${overview.moneyMarketAssetCount} |\n`;
      markdown += `| Recent Intents (Orderbook) | ${overview.recentIntentsCount} |\n`;
      markdown += `\n---\n*Use specific tools for detailed network, partner, or token data*`;

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );

  // Tool 2: Get Networks
  server.tool(
    "sodax_get_networks",
    "Get the list of blockchain networks integrated with SODAX. Returns network IDs and human-readable names.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)"),
    },
    async ({ format = "markdown" }) => {
      const networks = await getNetworks();

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(networks, null, 2),
            },
          ],
        };
      }

      let markdown = `# SODAX Integrated Networks\n\n`;
      markdown += `**Total:** ${networks.length} networks\n\n`;
      markdown += `| Network | ID |\n`;
      markdown += `|---------|----|\n`;
      for (const net of networks) {
        markdown += `| ${net.name} | \`${net.id}\` |\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );

  // Tool 3: Get Partners
  server.tool(
    "sodax_get_partners",
    "Get the list of partner addresses currently integrated with SODAX.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)"),
    },
    async ({ format = "markdown" }) => {
      const partners = await getPartners();

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(partners, null, 2),
            },
          ],
        };
      }

      let markdown = `# SODAX Partners\n\n`;
      markdown += `**Total:** ${partners.length} partner integrations\n\n`;
      if (partners.length > 0) {
        markdown += `| # | Address |\n`;
        markdown += `|---|----------|\n`;
        partners.forEach((p, i) => {
          markdown += `| ${i + 1} | \`${p.address}\` |\n`;
        });
      } else {
        markdown += `_No partners found._`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );

  // Tool 4: Get Token Supply
  server.tool(
    "sodax_get_token_supply",
    "Get detailed SODA token supply information: total supply, circulating supply, locked supply, and DAO fund balance.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)"),
    },
    async ({ format = "markdown" }) => {
      const supply = await getTokenSupply();

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(supply, null, 2),
            },
          ],
        };
      }

      const fmt = (val: string) => {
        const num = parseInt(val);
        if (isNaN(num)) return val;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
        if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
        return num.toLocaleString();
      };

      let markdown = `# SODA Token Supply\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| Total Supply | ${fmt(supply.totalSupply)} SODA |\n`;
      markdown += `| Circulating Supply | ${fmt(supply.circulatingSupply)} SODA |\n`;
      markdown += `| Locked Supply | ${fmt(supply.lockedSupply)} SODA |\n`;
      if (supply.daoFund) {
        markdown += `| DAO Fund | ${fmt(supply.daoFund)} SODA |\n`;
      }
      if (supply.blockNumber) {
        markdown += `| Block Number | ${supply.blockNumber} |\n`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );

  // Tool 5: Get Money Market Assets
  server.tool(
    "sodax_get_money_market_assets",
    "Get the list of assets available in the SODAX Money Market, including supply and borrow totals.",
    {
      format: z.enum(["json", "markdown"]).optional().describe("Response format (default: markdown)"),
    },
    async ({ format = "markdown" }) => {
      const assets = await getMoneyMarketAssets();

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(assets, null, 2),
            },
          ],
        };
      }

      let markdown = `# SODAX Money Market Assets\n\n`;
      markdown += `**Total Assets:** ${assets.length}\n\n`;

      if (assets.length > 0) {
        markdown += `| Symbol | Suppliers | Borrowers |\n`;
        markdown += `|--------|-----------|----------|\n`;
        for (const asset of assets) {
          markdown += `| ${asset.symbol} | ${asset.totalSuppliers} | ${asset.totalBorrowers} |\n`;
        }
      } else {
        markdown += `_No money market assets found._`;
      }

      return {
        content: [{ type: "text" as const, text: markdown }],
      };
    }
  );

  // Tool 6: Refresh Stats
  server.tool(
    "sodax_refresh_stats",
    "Force refresh the cached marketing stats from the SODAX API. Use this if you need the latest data.",
    {},
    async () => {
      const result = await refreshStats();

      return {
        content: [
          {
            type: "text" as const,
            text: result.success ? `✅ ${result.message}` : `❌ ${result.message}`,
          },
        ],
        isError: !result.success,
      };
    }
  );
}
