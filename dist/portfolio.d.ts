import { Connection } from '@solana/web3.js';
export interface TokenBalance {
    mint: string;
    symbol: string;
    balance: number;
    decimals: number;
    uiAmount: number;
    usdValue: number;
}
export interface PortfolioPosition {
    protocol: string;
    type: 'lending' | 'borrowing' | 'liquidity' | 'staking';
    token: string;
    amount: number;
    usdValue: number;
    apy?: number;
}
export interface PortfolioAnalytics {
    wallet: string;
    solBalance: number;
    solUsdValue: number;
    tokenBalances: TokenBalance[];
    defiPositions: PortfolioPosition[];
    totalUsdValue: number;
    timestamp: number;
}
export interface RiskScore {
    wallet: string;
    overallScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    factors: {
        healthFactor?: number;
        concentrationRisk: number;
        liquidationRisk: number;
        protocolDiversification: number;
    };
    warnings: string[];
    timestamp: number;
}
export declare function getPortfolioAnalytics(connection: Connection, walletAddress: string, useMock?: boolean): Promise<PortfolioAnalytics>;
export declare function calculateRiskScore(connection: Connection, walletAddress: string, useMock?: boolean): Promise<RiskScore>;
//# sourceMappingURL=portfolio.d.ts.map