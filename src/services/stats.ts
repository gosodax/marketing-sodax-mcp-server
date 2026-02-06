/**
 * Marketing Stats Service
 *
 * Fetches live marketing statistics from the SODAX Backend API.
 * Provides data on:
 *   - Integrated networks/chains
 *   - Partner integrations
 *   - SODAX token supply
 *   - Money market assets
 *   - Recent trading activity (orderbook)
 *
 * Implements caching with auto-refresh every 5 minutes.
 */

import axios from "axios";
import { SODAX_API_BASE_URL, STATS_CACHE_DURATION_MS } from "../constants.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NetworkInfo {
  id: string;
  name: string;
}

export interface PartnerInfo {
  address: string;
}

export interface TokenSupply {
  totalSupply: string;
  circulatingSupply: string;
  lockedSupply: string;
  daoFund?: string;
  blockNumber?: string;
}

export interface MoneyMarketAsset {
  symbol: string;
  reserveAddress: string;
  totalSupplied: string;
  totalBorrowed: string;
  totalSuppliers: number;
  totalBorrowers: number;
}

export interface MarketingStats {
  networks: NetworkInfo[];
  networkCount: number;
  partners: PartnerInfo[];
  partnerCount: number;
  tokenSupply: TokenSupply;
  moneyMarketAssets: MoneyMarketAsset[];
  recentIntentsCount: number;
  lastUpdated: Date;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cachedStats: MarketingStats | null = null;
let lastStatsFetchTime: Date | null = null;

function isStatsCacheValid(): boolean {
  if (!cachedStats || !lastStatsFetchTime) return false;
  return Date.now() - lastStatsFetchTime.getTime() < STATS_CACHE_DURATION_MS;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const AXIOS_CONFIG = {
  headers: {
    "User-Agent": "SODAX-Marketing-MCP/1.0",
    Accept: "application/json",
  },
  timeout: 15000,
};

/** Human-readable chain names */
const CHAIN_NAMES: Record<string, string> = {
  sonic: "Sonic",
  solana: "Solana",
  "0xa86a.avax": "Avalanche",
  "0xa4b1.arbitrum": "Arbitrum",
  "0x2105.base": "Base",
  "0xa.optimism": "Optimism",
  "0x38.bsc": "BNB Chain",
  "0x89.polygon": "Polygon",
  hyper: "Hyperliquid",
  lightlink: "LightLink",
  "injective-1": "Injective",
  stellar: "Stellar",
  sui: "Sui",
  "0x1.icon": "ICON",
  ethereum: "Ethereum",
};

function getChainName(chainId: string): string {
  return CHAIN_NAMES[chainId] || chainId;
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

async function fetchNetworks(): Promise<NetworkInfo[]> {
  try {
    const response = await axios.get<string[]>(`${SODAX_API_BASE_URL}/config/spoke/chains`, AXIOS_CONFIG);
    return response.data.map((id) => ({
      id,
      name: getChainName(id),
    }));
  } catch (error) {
    console.error("Error fetching networks:", error);
    return [];
  }
}

async function fetchPartners(): Promise<PartnerInfo[]> {
  try {
    const response = await axios.get<{ partners: string[] }>(`${SODAX_API_BASE_URL}/partners`, AXIOS_CONFIG);
    return response.data.partners.map((address) => ({ address }));
  } catch (error) {
    console.error("Error fetching partners:", error);
    return [];
  }
}

async function fetchTokenSupply(): Promise<TokenSupply> {
  try {
    const response = await axios.get<{
      totalSupply: string;
      circulatingSupply: string;
      lockedSupply: string;
      daoFund?: string;
      block?: string;
    }>(`${SODAX_API_BASE_URL}/sodax/supply`, AXIOS_CONFIG);

    return {
      totalSupply: response.data.totalSupply,
      circulatingSupply: response.data.circulatingSupply,
      lockedSupply: response.data.lockedSupply,
      daoFund: response.data.daoFund,
      blockNumber: response.data.block,
    };
  } catch (error) {
    console.error("Error fetching token supply:", error);
    return {
      totalSupply: "0",
      circulatingSupply: "0",
      lockedSupply: "0",
    };
  }
}

async function fetchMoneyMarketAssets(): Promise<MoneyMarketAsset[]> {
  try {
    const response = await axios.get<
      Array<{
        symbol: string;
        reserveAddress: string;
        totalATokenBalance: string;
        totalVariableDebtTokenBalance: string;
        totalSuppliers: number;
        totalBorrowers: number;
      }>
    >(`${SODAX_API_BASE_URL}/moneymarket/asset/all`, AXIOS_CONFIG);

    return response.data.map((asset) => ({
      symbol: asset.symbol,
      reserveAddress: asset.reserveAddress,
      totalSupplied: asset.totalATokenBalance,
      totalBorrowed: asset.totalVariableDebtTokenBalance,
      totalSuppliers: asset.totalSuppliers,
      totalBorrowers: asset.totalBorrowers,
    }));
  } catch (error) {
    console.error("Error fetching money market assets:", error);
    return [];
  }
}

async function fetchRecentIntentsCount(): Promise<number> {
  try {
    const response = await axios.get<{ total: number }>(`${SODAX_API_BASE_URL}/solver/orderbook?limit=1`, AXIOS_CONFIG);
    return response.data.total || 0;
  } catch (error) {
    console.error("Error fetching orderbook total:", error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Main fetch
// ---------------------------------------------------------------------------

export async function fetchMarketingStats(forceRefresh = false): Promise<MarketingStats> {
  if (!forceRefresh && isStatsCacheValid() && cachedStats) {
    return cachedStats;
  }

  try {
    const [networks, partners, tokenSupply, moneyMarketAssets, recentIntentsCount] = await Promise.all([
      fetchNetworks(),
      fetchPartners(),
      fetchTokenSupply(),
      fetchMoneyMarketAssets(),
      fetchRecentIntentsCount(),
    ]);

    const stats: MarketingStats = {
      networks,
      networkCount: networks.length,
      partners,
      partnerCount: partners.length,
      tokenSupply,
      moneyMarketAssets,
      recentIntentsCount,
      lastUpdated: new Date(),
    };

    cachedStats = stats;
    lastStatsFetchTime = new Date();
    console.error(
      `Marketing stats fetched at ${lastStatsFetchTime.toISOString()} — ` +
        `${stats.networkCount} networks, ${stats.partnerCount} partners`
    );
    return stats;
  } catch (error) {
    console.error("Error fetching marketing stats:", error);

    if (cachedStats) {
      console.error("Returning cached stats due to fetch error");
      return cachedStats;
    }

    // Return empty stats
    return {
      networks: [],
      networkCount: 0,
      partners: [],
      partnerCount: 0,
      tokenSupply: { totalSupply: "0", circulatingSupply: "0", lockedSupply: "0" },
      moneyMarketAssets: [],
      recentIntentsCount: 0,
      lastUpdated: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Public helpers consumed by tools
// ---------------------------------------------------------------------------

export async function getStatsOverview(): Promise<{
  networkCount: number;
  partnerCount: number;
  totalSupply: string;
  circulatingSupply: string;
  moneyMarketAssetCount: number;
  recentIntentsCount: number;
  lastUpdated: string;
}> {
  const stats = await fetchMarketingStats();
  return {
    networkCount: stats.networkCount,
    partnerCount: stats.partnerCount,
    totalSupply: stats.tokenSupply.totalSupply,
    circulatingSupply: stats.tokenSupply.circulatingSupply,
    moneyMarketAssetCount: stats.moneyMarketAssets.length,
    recentIntentsCount: stats.recentIntentsCount,
    lastUpdated: stats.lastUpdated.toISOString(),
  };
}

export async function getNetworks(): Promise<NetworkInfo[]> {
  const stats = await fetchMarketingStats();
  return stats.networks;
}

export async function getPartners(): Promise<PartnerInfo[]> {
  const stats = await fetchMarketingStats();
  return stats.partners;
}

export async function getTokenSupply(): Promise<TokenSupply> {
  const stats = await fetchMarketingStats();
  return stats.tokenSupply;
}

export async function getMoneyMarketAssets(): Promise<MoneyMarketAsset[]> {
  const stats = await fetchMarketingStats();
  return stats.moneyMarketAssets;
}

export async function refreshStats(): Promise<{ success: boolean; message: string }> {
  try {
    const stats = await fetchMarketingStats(true);
    return {
      success: true,
      message: `Stats refreshed at ${lastStatsFetchTime?.toISOString()} — ${stats.networkCount} networks, ${stats.partnerCount} partners`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
