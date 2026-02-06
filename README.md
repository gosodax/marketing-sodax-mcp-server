# SODAX Marketing MCP Server 🎨

AI-powered brand guidelines and technical translation for marketing teams. Connect your AI assistant to the SODAX Brand Bible and Technical Glossary for instant brand alignment.

## Overview

This MCP server provides marketing, content, and design teams with AI-powered access to:
- Brand voice and tone guidelines
- Visual identity specifications
- Messaging framework
- Content guidelines
- Brand applications
- **Technical translation glossary** - simplify complex concepts for non-technical audiences

Data is fetched from Notion and auto-refreshes every 5 minutes.

## Tools

### Brand Bible (6 tools)

| Tool | Description |
|------|-------------|
| `sodax_get_brand_overview` | High-level overview of brand bible |
| `sodax_get_section` | Get specific section (1-6) |
| `sodax_get_subsection` | Get specific subsection (e.g., 3.1) |
| `sodax_search_brand_bible` | Search brand guidelines by keyword |
| `sodax_refresh_brand_bible` | Force refresh cached data |
| `sodax_list_subsections` | List all subsections for reference |

### Technical Glossary (7 tools)

| Tool | Description |
|------|-------------|
| `sodax_get_glossary_overview` | Overview of available terms and tags |
| `sodax_list_glossary_terms` | List all technical terms with definitions |
| `sodax_get_glossary_term` | Look up a specific technical term |
| `sodax_search_glossary` | Search by keyword or concept |
| `sodax_translate_term` | Translate technical terms to simple language |
| `sodax_get_terms_by_tag` | Get terms by category tag |
| `sodax_refresh_glossary` | Force refresh glossary data |

### Marketing Stats (6 tools)

| Tool | Description |
|------|-------------|
| `sodax_get_stats_overview` | High-level marketing stats summary |
| `sodax_get_networks` | List all supported destination networks |
| `sodax_get_partners` | List integration partners with details |
| `sodax_get_token_supply` | SODA token supply breakdown |
| `sodax_get_money_market_assets` | Supported assets and TVL data |
| `sodax_refresh_stats` | Force refresh stats cache |

## Quick Start

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sodax-brand": {
      "url": "https://brand.sodax.com/mcp"
    }
  }
}
```

### Local Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `TRANSPORT` | `http` | Transport mode (`http` or `stdio`) |
| `NODE_ENV` | - | Set to `production` for deployment |
| `NOTION_TOKEN` | - | Notion integration token for live glossary sync (falls back to hardcoded data if unset) |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Landing page |
| `GET /api` | Server info and tool list |
| `GET /health` | Health check |
| `POST /mcp` | MCP endpoint |

## Example Prompts

Once connected, try asking:

### Brand
- *"What's our brand voice like?"*
- *"Review this tweet for brand alignment: [tweet text]"*
- *"What colors should I use for marketing materials?"*
- *"What's our positioning statement?"*

### Technical Translation
- *"Explain what a Solver does in simple terms"*
- *"Translate 'cross-network liquidity' for a blog post"*
- *"What terms relate to the Money Market feature?"*
- *"List all technical concepts I should know about"*

### Marketing Stats
- *"How many networks does SODAX support?"*
- *"Who are our integration partners?"*
- *"What's the current SODA token supply?"*
- *"Give me a stats overview for a press release"*

## Deployment

### Docker

```bash
docker build -t marketing-sodax-mcp-server .
docker run -p 3000:3000 marketing-sodax-mcp-server
```

### Docker Compose

```bash
docker-compose up -d
```

### Railway/Coolify

The included `nixpacks.toml` handles deployment automatically. Set these environment variables:
- `PORT=3000`
- `NODE_ENV=production`
- `NOTION_TOKEN=<your-notion-integration-token>`

## Project Structure

```
marketing-sodax-mcp-server/
├── src/
│   ├── index.ts               # Entry point
│   ├── constants.ts           # Configuration
│   ├── types.ts               # TypeScript types
│   ├── services/
│   │   ├── brandBible.ts      # Notion Brand Bible
│   │   ├── glossary.ts        # Notion Glossary
│   │   └── stats.ts           # SODAX API stats
│   ├── tools/
│   │   ├── brandBible.ts      # Brand Bible tools
│   │   ├── glossary.ts        # Glossary tools
│   │   └── stats.ts           # Stats tools
│   └── public/
│       └── index.html         # Landing page
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── nixpacks.toml
```

## Related

- **Builders MCP Server** - For developers: `https://builders.sodax.com/mcp`
- **SDK Documentation** - GitBook MCP: `https://docs.sodax.com/~gitbook/mcp`

## License

MIT
