#!/usr/bin/env node
/**
 * SODAX Marketing MCP Server
 * 
 * Brand guidelines and marketing resources for content teams.
 * Brand bible is fetched from Notion (auto-updates every 5 min).
 * Technical glossary helps translate complex concepts for marketing.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerBrandBibleTools } from "./tools/brandBible.js";
import { registerGlossaryTools } from "./tools/glossary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new McpServer({
  name: "marketing-sodax-mcp-server",
  version: "1.0.0"
});

// Register brand bible tools
registerBrandBibleTools(server);

// Register technical glossary tools
registerGlossaryTools(server);

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SODAX Marketing MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    }
  }));
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
  });
  app.use(limiter);
  
  // Stricter rate limit for MCP endpoint
  const mcpLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // 60 MCP requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many MCP requests, please try again later." }
  });
  
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(join(__dirname, "public")));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "healthy", 
      service: "marketing-sodax-mcp-server",
      version: "1.0.0"
    });
  });

  app.post("/mcp", mcpLimiter, async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/", (_req: Request, res: Response) => {
    try {
      const html = readFileSync(join(__dirname, "public", "index.html"), "utf-8");
      res.type("html").send(html);
    } catch {
      res.redirect("/api");
    }
  });

  app.get("/api", (_req: Request, res: Response) => {
    res.json({
      name: "SODAX Marketing MCP Server",
      version: "1.0.0",
      description: "Brand guidelines, technical glossary, and marketing resources for content teams",
      endpoints: { mcp: "/mcp", health: "/health", api: "/api" },
      tools: {
        brandBible: [
          "sodax_get_brand_overview",
          "sodax_get_section",
          "sodax_get_subsection",
          "sodax_search_brand_bible",
          "sodax_refresh_brand_bible",
          "sodax_list_subsections"
        ],
        glossary: [
          "sodax_get_glossary_overview",
          "sodax_list_glossary_terms",
          "sodax_get_glossary_term",
          "sodax_search_glossary",
          "sodax_translate_term",
          "sodax_get_terms_by_tag",
          "sodax_refresh_glossary"
        ]
      }
    });
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, "0.0.0.0", () => {
    console.error(`SODAX Marketing MCP server running on http://0.0.0.0:${port}`);
  });
}

async function main(): Promise<void> {
  const transport = process.env.TRANSPORT || "http";
  if (transport === "stdio") {
    await runStdio();
  } else {
    await runHTTP();
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
