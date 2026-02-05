/**
 * TypeScript types for the Marketing SODAX MCP Server
 */

export interface BrandSection {
  id: string;
  title: string;
  content: string;
  subsections: BrandSubsection[];
}

export interface BrandSubsection {
  id: string;
  parentId: string;
  title: string;
  content: string;
}

export interface BrandBible {
  title: string;
  lastUpdated: Date;
  sections: BrandSection[];
}

export interface BrandOverview {
  title: string;
  lastUpdated: string;
  sectionCount: number;
  sections: {
    id: string;
    title: string;
    subsectionCount: number;
  }[];
}

export interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  subsectionId?: string;
  subsectionTitle?: string;
  matchedContent: string;
  relevanceScore: number;
}

export enum ResponseFormat {
  JSON = "json",
  MARKDOWN = "markdown"
}
