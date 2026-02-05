# SODAX MCP Server Split - Build Plans

Two lightweight, focused MCP servers split by audience.

---

## 🎨 Server 1: `marketing-sodax-mcp-server`

**Audience:** Marketing, Content, Design teams  
**URL:** `https://brand.sodax.com/mcp`

### Purpose
Give marketing/content teams AI-powered access to brand guidelines for:
- Reviewing content for brand alignment
- Generating on-brand copy
- Checking visual identity guidelines
- Technical concept translation for non-technical audiences

### Tools Included (6 tools)
| Tool | Description |
|------|-------------|
| `sodax_get_brand_overview` | High-level overview of brand bible |
| `sodax_get_section` | Get specific section (1-6) |
| `sodax_get_subsection` | Get specific subsection (e.g., 3.1) |
| `sodax_search_brand_bible` | Search brand guidelines by keyword |
| `sodax_refresh_brand_bible` | Force refresh cached data |
| `sodax_list_subsections` | List all subsections for reference |

### Project Structure
```
marketing-sodax-mcp-server/
├── .skills/
│   └── mcp-builder/           # From skills.sh
├── src/
│   ├── index.ts               # Entry point (brand tools only)
│   ├── constants.ts           # Brand bible config
│   ├── types.ts               # TypeScript types
│   ├── services/
│   │   └── brandBible.ts      # Notion fetching/parsing
│   ├── tools/
│   │   └── brandBible.ts      # Tool definitions
│   └── public/
│       ├── index.html         # Styled landing page
│       └── images/
│           └── symbol.png     # SODAX logo
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── nixpacks.toml
└── README.md
```

### Build Steps

```bash
# 1. Create repo
mkdir marketing-sodax-mcp-server && cd marketing-sodax-mcp-server
git init

# 2. Add MCP builder skill
npx skills add https://github.com/anthropics/skills --skill mcp-builder

# 3. Initialize package.json
pnpm init

# 4. Install dependencies
pnpm add @modelcontextprotocol/sdk express zod axios cheerio node-html-parser
pnpm add -D typescript tsx @types/node @types/express

# 5. Copy from original repo
# - src/services/brandBible.ts
# - src/tools/brandBible.ts  
# - src/types.ts
# - src/constants.ts (keep only brand bible constants)
# - tsconfig.json
# - Dockerfile
# - docker-compose.yml
# - nixpacks.toml

# 6. Create new index.ts (brand tools only)
# 7. Create new public/index.html (marketing-focused landing page)
# 8. Update package.json with correct name/scripts

# 9. Build and test
pnpm build
pnpm start
```

### package.json
```json
{
  "name": "marketing-sodax-mcp-server",
  "version": "1.0.0",
  "description": "SODAX MCP server for marketing teams - brand bible and guidelines",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc && cp -r src/public dist/",
    "clean": "rm -rf dist"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=18" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "axios": "^1.7.9",
    "cheerio": "^1.0.0",
    "express": "^4.21.2",
    "node-html-parser": "^6.1.13",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### index.ts (Entry Point)
```typescript
#!/usr/bin/env node
/**
 * SODAX Marketing MCP Server
 * 
 * Brand guidelines and marketing resources for content teams.
 * Brand bible is fetched from Notion (auto-updates every 5 min).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerBrandBibleTools } from "./tools/brandBible.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new McpServer({
  name: "marketing-sodax-mcp-server",
  version: "1.0.0"
});

// Register ONLY brand bible tools
registerBrandBibleTools(server);

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SODAX Marketing MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "public")));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "healthy", 
      service: "marketing-sodax-mcp-server",
      version: "1.0.0"
    });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
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
      description: "Brand guidelines and marketing resources for content teams",
      endpoints: { mcp: "/mcp", health: "/health", api: "/api" },
      tools: [
        "sodax_get_brand_overview",
        "sodax_get_section",
        "sodax_get_subsection",
        "sodax_search_brand_bible",
        "sodax_refresh_brand_bible",
        "sodax_list_subsections"
      ]
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
```

### Landing Page Highlights
- **Hero:** "Brand Guidelines at Your Fingertips"
- **Subtitle:** "AI-powered brand alignment for marketing teams"
- **Use cases displayed:**
  - "Does this tweet match our brand voice?"
  - "What colors should I use?"
  - "Review this blog post for brand alignment"
  - "What's our positioning statement?"
- **Colors:** Use existing SODAX brand colors (cherry, cream, espresso)

---

## 🔧 Server 2: `builders-sodax-mcp-server`

**Audience:** Developers, Integration Partners, Technical Teams  
**URL:** `https://api.sodax.com/mcp` or `https://builders.sodax.com/mcp`

### Purpose
Give developers AI-powered access to:
- Live API data (chains, tokens, transactions, volume)
- SDK documentation (via GitBook MCP reference)
- Integration support

### Tools Included (10 tools)
| Tool | Description |
|------|-------------|
| `sodax_get_supported_chains` | List all supported blockchain networks |
| `sodax_get_swap_tokens` | Get available tokens for swapping |
| `sodax_get_transaction` | Look up transaction by hash |
| `sodax_get_user_transactions` | Get user's transaction history |
| `sodax_get_volume` | Get trading volume data |
| `sodax_get_orderbook` | Get current orderbook entries |
| `sodax_get_money_market_assets` | List lending/borrowing assets |
| `sodax_get_user_position` | Get user's money market position |
| `sodax_get_partners` | List SODAX integration partners |
| `sodax_get_token_supply` | Get SODA token supply info |

### Project Structure
```
builders-sodax-mcp-server/
├── .skills/
│   └── mcp-builder/           # From skills.sh
├── src/
│   ├── index.ts               # Entry point (API tools only)
│   ├── types.ts               # TypeScript types
│   ├── services/
│   │   └── sodaxApi.ts        # API client
│   ├── tools/
│   │   └── sodaxApi.ts        # Tool definitions
│   └── public/
│       ├── index.html         # Styled landing page
│       └── images/
│           └── symbol.png     # SODAX logo
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── nixpacks.toml
└── README.md
```

### Build Steps

```bash
# 1. Create repo
mkdir builders-sodax-mcp-server && cd builders-sodax-mcp-server
git init

# 2. Add MCP builder skill
npx skills add https://github.com/anthropics/skills --skill mcp-builder

# 3. Initialize package.json
pnpm init

# 4. Install dependencies
pnpm add @modelcontextprotocol/sdk express zod axios
pnpm add -D typescript tsx @types/node @types/express

# 5. Copy from original repo
# - src/services/sodaxApi.ts
# - src/tools/sodaxApi.ts
# - src/types.ts (ResponseFormat enum only)
# - tsconfig.json
# - Dockerfile
# - docker-compose.yml
# - nixpacks.toml

# 6. Create new index.ts (API tools only)
# 7. Create new public/index.html (developer-focused landing page)
# 8. Update package.json with correct name/scripts

# 9. Build and test
pnpm build
pnpm start
```

### package.json
```json
{
  "name": "builders-sodax-mcp-server",
  "version": "1.0.0",
  "description": "SODAX MCP server for developers - live API data and integration support",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc && cp -r src/public dist/",
    "clean": "rm -rf dist"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=18" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "axios": "^1.7.9",
    "express": "^4.21.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### index.ts (Entry Point)
```typescript
#!/usr/bin/env node
/**
 * SODAX Builders MCP Server
 * 
 * Live API data for developers and integration partners.
 * Data fetched live from api.sodax.com.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerSodaxApiTools } from "./tools/sodaxApi.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = new McpServer({
  name: "builders-sodax-mcp-server",
  version: "1.0.0"
});

// Register ONLY API tools
registerSodaxApiTools(server);

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SODAX Builders MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "public")));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "healthy", 
      service: "builders-sodax-mcp-server",
      version: "1.0.0"
    });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
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
      name: "SODAX Builders MCP Server",
      version: "1.0.0",
      description: "Live API data for developers and integration partners",
      endpoints: { mcp: "/mcp", health: "/health", api: "/api" },
      tools: [
        "sodax_get_supported_chains",
        "sodax_get_swap_tokens",
        "sodax_get_transaction",
        "sodax_get_user_transactions",
        "sodax_get_volume",
        "sodax_get_orderbook",
        "sodax_get_money_market_assets",
        "sodax_get_user_position",
        "sodax_get_partners",
        "sodax_get_token_supply"
      ],
      relatedServers: {
        sdkDocs: {
          url: "https://docs.sodax.com/~gitbook/mcp",
          description: "SDK documentation and code examples"
        }
      }
    });
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, "0.0.0.0", () => {
    console.error(`SODAX Builders MCP server running on http://0.0.0.0:${port}`);
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
```

### Landing Page Highlights
- **Hero:** "Build with SODAX"
- **Subtitle:** "Live API data for your AI coding assistant"
- **Use cases displayed:**
  - "What chains does SODAX support?"
  - "Show me today's trading volume"
  - "Get available swap tokens on Base"
  - "Look up this transaction hash"
- **Also connect to:** SDK Docs link to `https://docs.sodax.com/~gitbook/mcp`
- **Colors:** Darker/more technical feel - espresso, cream, accent yellow

---

## 📋 Checklist for Both Repos

### Initial Setup
- [ ] Create GitHub repo
- [ ] `npx skills add https://github.com/anthropics/skills --skill mcp-builder`
- [ ] Copy relevant files from original repo
- [ ] Create `index.ts` with single tool registration
- [ ] Create styled `public/index.html` landing page
- [ ] Update `package.json` with correct name
- [ ] Update `README.md` with specific docs

### Testing
- [ ] `pnpm dev` - verify hot reload works
- [ ] `pnpm build` - verify TypeScript compiles
- [ ] Visit `http://localhost:3000` - verify landing page
- [ ] Test MCP endpoint with Claude Desktop
- [ ] Test `TRANSPORT=stdio` mode

### Deployment
- [ ] Push to GitHub
- [ ] Deploy to Coolify/Railway/etc
- [ ] Set `PORT` and `NODE_ENV=production`
- [ ] Verify health check endpoint
- [ ] Update DNS records

### Documentation
- [ ] Update README with connection instructions
- [ ] Add example prompts for each tool
- [ ] Link to the other MCP server

---

## 🔗 Final MCP Ecosystem

After both are deployed:

| MCP Server | URL | Audience |
|------------|-----|----------|
| **Marketing** | `https://brand.sodax.com/mcp` | Marketing, Content, Design |
| **Builders** | `https://builders.sodax.com/mcp` | Developers, Partners |
| **SDK Docs** | `https://docs.sodax.com/~gitbook/mcp` | Developers (GitBook) |

### Claude Desktop Config (Full Stack)
```json
{
  "mcpServers": {
    "sodax-brand": {
      "url": "https://brand.sodax.com/mcp"
    },
    "sodax-api": {
      "url": "https://builders.sodax.com/mcp"
    },
    "sodax-docs": {
      "url": "https://docs.sodax.com/~gitbook/mcp"
    }
  }
}
```

### Marketing Team Config
```json
{
  "mcpServers": {
    "sodax-brand": {
      "url": "https://brand.sodax.com/mcp"
    }
  }
}
```

### Developer Config
```json
{
  "mcpServers": {
    "sodax-api": {
      "url": "https://builders.sodax.com/mcp"
    },
    "sodax-docs": {
      "url": "https://docs.sodax.com/~gitbook/mcp"
    }
  }
}
```
