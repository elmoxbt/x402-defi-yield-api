/**
 * Pyth Price Service Helper
 * Fetches real-time token prices from Pyth Network using Hermes client
 */

import { HermesClient } from '@pythnetwork/hermes-client';

// Pyth price feed IDs for devnet/mainnet (these are mainnet IDs, work for both)
export const PRICE_FEED_IDS = {
  SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  USDT_USD: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  BONK_USD: '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  JUP_USD: '0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
};

export interface TokenPrice {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
}

export class PythPriceService {
  private client: HermesClient;

  constructor(hermesUrl = 'https://hermes.pyth.network') {
    this.client = new HermesClient(hermesUrl);
  }

  /**
   * Get current price for a specific token
   */
  async getPrice(symbol: string): Promise<TokenPrice | null> {
    try {
      const feedId = this.getFeedId(symbol);
      if (!feedId) {
        console.warn(`No price feed ID found for ${symbol}`);
        return null;
      }

      // Get latest price updates from Hermes
      const priceUpdates = await this.client.getLatestPriceUpdates([feedId]);

      if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
        return null;
      }

      const priceData = priceUpdates.parsed[0];
      const priceInfo = priceData.price;

      // Check if price is fresh (within last 60 seconds)
      const now = Math.floor(Date.now() / 1000);
      if (priceInfo.publish_time && now - priceInfo.publish_time > 60) {
        console.warn(`Price for ${symbol} is stale (${now - priceInfo.publish_time}s old)`);
      }

      return {
        symbol,
        price: parseFloat(priceInfo.price) * Math.pow(10, priceInfo.expo),
        confidence: parseFloat(priceInfo.conf) * Math.pow(10, priceInfo.expo),
        timestamp: priceInfo.publish_time,
      };
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(symbols: string[]): Promise<Map<string, TokenPrice>> {
    const prices = new Map<string, TokenPrice>();

    try {
      const feedIds = symbols
        .map((symbol) => this.getFeedId(symbol))
        .filter((id): id is string => id !== null);

      if (feedIds.length === 0) {
        return prices;
      }

      // Get latest price updates for all feeds
      const priceUpdates = await this.client.getLatestPriceUpdates(feedIds);

      if (!priceUpdates || !priceUpdates.parsed) {
        return prices;
      }

      for (let i = 0; i < priceUpdates.parsed.length; i++) {
        const priceData = priceUpdates.parsed[i];
        const symbol = symbols[i];
        const priceInfo = priceData.price;

        if (priceInfo) {
          prices.set(symbol, {
            symbol,
            price: parseFloat(priceInfo.price) * Math.pow(10, priceInfo.expo),
            confidence: parseFloat(priceInfo.conf) * Math.pow(10, priceInfo.expo),
            timestamp: priceInfo.publish_time,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
    }

    return prices;
  }

  /**
   * Get mock price for testing when Pyth is unavailable
   */
  getMockPrice(symbol: string): TokenPrice {
    const mockPrices: Record<string, number> = {
      SOL: 98.50,
      USDC: 1.00,
      USDT: 1.00,
      BTC: 42000,
      ETH: 2200,
      BONK: 0.000015,
      JUP: 0.85,
    };

    return {
      symbol,
      price: mockPrices[symbol] || 1.0,
      confidence: 0.01,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Get price feed ID for a symbol
   */
  private getFeedId(symbol: string): string | null {
    const key = `${symbol.toUpperCase()}_USD` as keyof typeof PRICE_FEED_IDS;
    return PRICE_FEED_IDS[key] || null;
  }

  /**
   * Calculate USD value of token amount
   */
  async calculateUsdValue(
    symbol: string,
    amount: number,
    useMock: boolean = false
  ): Promise<number> {
    try {
      const priceData = useMock
        ? this.getMockPrice(symbol)
        : await this.getPrice(symbol);

      if (!priceData) {
        console.warn(`Failed to get price for ${symbol}, using mock`);
        return amount * this.getMockPrice(symbol).price;
      }

      return amount * priceData.price;
    } catch (error) {
      console.error(`Error calculating USD value for ${symbol}:`, error);
      return amount * this.getMockPrice(symbol).price;
    }
  }
}

// Singleton instance
let pythService: PythPriceService | null = null;

export function getPythService(hermesUrl?: string): PythPriceService {
  if (!pythService) {
    pythService = new PythPriceService(hermesUrl);
  }
  return pythService;
}
