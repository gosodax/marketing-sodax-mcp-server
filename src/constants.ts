/**
 * Constants for the Brand Bible, Glossary, and Marketing Stats services
 */

// Notion Brand Bible — fetched via the Notion API (page with blocks)
export const BRAND_BIBLE_PAGE_ID = "1848c1d2-979c-801e-a841-d6ff58a45cfb";
export const BRAND_BIBLE_URL = "https://www.notion.so/iconfoundation/Brand-Bible-v1-1-2-1848c1d2979c801ea841d6ff58a45cfb";

// Notion Technical Glossary — fetched via the Notion API
// The glossary is split into two Notion databases: system concepts and system components
export const GLOSSARY_SYSTEM_CONCEPTS_DB = "2fe8c1d2-979c-808b-8213-edc54b17e8b3";
export const GLOSSARY_SYSTEM_COMPONENTS_DB = "2c68c1d2-979c-806c-8153-f7009b55418d";

// Public page URLs (used for linking, not fetching)
export const GLOSSARY_SYSTEM_CONCEPTS_URL = "https://iconfoundation.notion.site/system-concepts";
export const GLOSSARY_SYSTEM_COMPONENTS_URL = "https://iconfoundation.notion.site/system-components";

// SODAX Backend API — for marketing stats
export const SODAX_API_BASE_URL = "https://api.sodax.com/v1/be";

// Cache duration in milliseconds (5 minutes)
export const CACHE_DURATION_MS = 5 * 60 * 1000;
export const GLOSSARY_CACHE_DURATION_MS = 5 * 60 * 1000;
export const STATS_CACHE_DURATION_MS = 5 * 60 * 1000;

// Brand Bible section structure
export const BRAND_SECTIONS = {
  "1": "Introduction & Brand Overview",
  "2": "Brand Voice & Tone",
  "3": "Visual Identity",
  "4": "Messaging Framework",
  "5": "Content Guidelines",
  "6": "Brand Applications"
} as const;

// SODAX Brand Colors
export const BRAND_COLORS = {
  cherry: "#E53935",
  cream: "#FFF8E7",
  espresso: "#1A1A1A",
  accent: "#FFD54F"
} as const;
