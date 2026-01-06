import { Connection } from '@solana/web3.js';
export interface YieldOpportunity {
    protocol: string;
    token: string;
    apy: number;
    tvl?: number;
    type: 'lending' | 'staking' | 'liquidity';
    vault?: string;
    riskLevel?: 'low' | 'medium' | 'high';
}
export interface BestYieldResponse {
    topOpportunities: YieldOpportunity[];
    timestamp: number;
    source: 'live' | 'cached' | 'mock';
}
export declare function getBestYields(connection: Connection, useMock?: boolean): Promise<BestYieldResponse>;
export declare function getYieldsByToken(connection: Connection, token: string, useMock?: boolean): Promise<YieldOpportunity[]>;
export declare function getYieldsByProtocol(connection: Connection, protocol: string, useMock?: boolean): Promise<YieldOpportunity[]>;
//# sourceMappingURL=yield.d.ts.map