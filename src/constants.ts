/**
 * Constants for the Brand Bible and Glossary services
 */

// Notion Brand Bible URL (public page)
export const BRAND_BIBLE_URL = "https://sodax.notion.site/SODAX-Brand-Bible-1f68c0bdbc7480758727e00a21ce8d9d";

// Notion Technical Glossary URL (public page)
export const GLOSSARY_URL = "https://iconfoundation.notion.site/2c68c1d2979c806c8153f7009b55418d?v=2c68c1d2979c807db856000c98ac13dd";

// Cache duration in milliseconds (5 minutes)
export const CACHE_DURATION_MS = 5 * 60 * 1000;
export const GLOSSARY_CACHE_DURATION_MS = 5 * 60 * 1000;

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
