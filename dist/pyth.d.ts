export declare const PRICE_FEED_IDS: {
    SOL_USD: string;
    USDC_USD: string;
    USDT_USD: string;
    BTC_USD: string;
    ETH_USD: string;
    BONK_USD: string;
    JUP_USD: string;
};
export interface TokenPrice {
    symbol: string;
    price: number;
    confidence: number;
    timestamp: number;
}
export declare class PythPriceService {
    private client;
    constructor(hermesUrl?: string);
    getPrice(symbol: string): Promise<TokenPrice | null>;
    getPrices(symbols: string[]): Promise<Map<string, TokenPrice>>;
    getMockPrice(symbol: string): TokenPrice;
    private getFeedId;
    calculateUsdValue(symbol: string, amount: number, useMock?: boolean): Promise<number>;
}
export declare function getPythService(hermesUrl?: string): PythPriceService;
//# sourceMappingURL=pyth.d.ts.map