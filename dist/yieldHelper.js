import axios from 'axios';
import { Keypair } from '@solana/web3.js';
import { DriftClient } from '@drift-labs/sdk';
async function fetchKaminoYields() {
    try {
        const response = await axios.get('https://api.kamino.finance/strategies', {
            timeout: 5000,
        });
        const strategies = response.data || [];
        const opportunities = [];
        for (const strategy of strategies.slice(0, 10)) {
            const apy = strategy.apy || strategy.aprLatest || 0;
            if (apy > 0) {
                opportunities.push({
                    protocol: 'Kamino',
                    token: strategy.symbol || strategy.tokenSymbol || 'LP',
                    apy: apy * 100,
                    tvl: strategy.tvl || 0,
                    type: 'liquidity',
                    vault: strategy.name || strategy.strategyName || 'Strategy',
                    riskLevel: (strategy.tvl || 0) > 1000000 ? 'low' :
                        (strategy.tvl || 0) > 100000 ? 'medium' : 'high',
                });
            }
        }
        return opportunities.length > 0 ? opportunities : getMockKaminoYields();
    }
    catch (error) {
        console.warn('Kamino API unavailable, using fallback:', error.message);
        return getMockKaminoYields();
    }
}
async function fetchMarginfiYields(_connection) {
    return getMockMarginfiYields();
}
async function fetchDriftYields(connection) {
    try {
        const dummyKeypair = Keypair.generate();
        const wallet = {
            publicKey: dummyKeypair.publicKey,
            payer: dummyKeypair,
            signTransaction: async (tx) => tx,
            signAllTransactions: async (txs) => txs,
            signVersionedTransaction: async (tx) => tx,
            signAllVersionedTransactions: async (txs) => txs,
        };
        const driftClient = new DriftClient({
            connection,
            wallet,
            env: 'devnet',
        });
        await driftClient.subscribe();
        const opportunities = [];
        const markets = driftClient.getSpotMarketAccounts();
        for (const market of markets.slice(0, 5)) {
            const depositBalance = market.depositBalance ? Number(market.depositBalance) : 0;
            const borrowBalance = market.borrowBalance ? Number(market.borrowBalance) : 0;
            if (depositBalance > 0) {
                const utilization = borrowBalance / depositBalance;
                const estimatedApy = utilization * 15;
                opportunities.push({
                    protocol: 'Drift',
                    token: String(market.name || 'UNKNOWN'),
                    apy: estimatedApy,
                    tvl: depositBalance,
                    type: 'lending',
                    riskLevel: 'medium',
                });
            }
        }
        await driftClient.unsubscribe();
        return opportunities;
    }
    catch (error) {
        console.warn('Drift SDK unavailable, using fallback:', error.message);
        return getMockDriftYields();
    }
}
export async function getBestYields(connection, useMock = false) {
    if (useMock) {
        return {
            topOpportunities: [
                ...getMockKaminoYields(),
                ...getMockMarginfiYields(),
                ...getMockDriftYields(),
            ]
                .sort((a, b) => b.apy - a.apy)
                .slice(0, 10),
            timestamp: Date.now(),
            source: 'mock',
        };
    }
    try {
        const [kaminoYields, marginfiYields, driftYields] = await Promise.allSettled([
            fetchKaminoYields(),
            fetchMarginfiYields(connection),
            fetchDriftYields(connection),
        ]);
        const allOpportunities = [];
        if (kaminoYields.status === 'fulfilled') {
            allOpportunities.push(...kaminoYields.value);
        }
        if (marginfiYields.status === 'fulfilled') {
            allOpportunities.push(...marginfiYields.value);
        }
        if (driftYields.status === 'fulfilled') {
            allOpportunities.push(...driftYields.value);
        }
        const topOpportunities = allOpportunities
            .sort((a, b) => b.apy - a.apy)
            .slice(0, 10);
        return {
            topOpportunities,
            timestamp: Date.now(),
            source: allOpportunities.length > 0 ? 'live' : 'mock',
        };
    }
    catch (error) {
        console.error('Error fetching yields:', error);
        return {
            topOpportunities: [
                ...getMockKaminoYields(),
                ...getMockMarginfiYields(),
                ...getMockDriftYields(),
            ]
                .sort((a, b) => b.apy - a.apy)
                .slice(0, 10),
            timestamp: Date.now(),
            source: 'mock',
        };
    }
}
function getMockKaminoYields() {
    return [
        {
            protocol: 'Kamino',
            token: 'SOL',
            apy: 7.85,
            tvl: 15420000,
            type: 'liquidity',
            vault: 'SOL-USDC Concentrated Liquidity',
            riskLevel: 'low',
        },
        {
            protocol: 'Kamino',
            token: 'USDC',
            apy: 12.3,
            tvl: 8750000,
            type: 'lending',
            vault: 'USDC Lending Vault',
            riskLevel: 'low',
        },
        {
            protocol: 'Kamino',
            token: 'JUP',
            apy: 18.5,
            tvl: 2100000,
            type: 'liquidity',
            vault: 'JUP-SOL Auto-Compound',
            riskLevel: 'medium',
        },
    ];
}
function getMockMarginfiYields() {
    return [
        {
            protocol: 'Marginfi',
            token: 'SOL',
            apy: 6.2,
            tvl: 12300000,
            type: 'lending',
            riskLevel: 'low',
        },
        {
            protocol: 'Marginfi',
            token: 'USDC',
            apy: 9.8,
            tvl: 18500000,
            type: 'lending',
            riskLevel: 'low',
        },
        {
            protocol: 'Marginfi',
            token: 'USDT',
            apy: 9.5,
            tvl: 6200000,
            type: 'lending',
            riskLevel: 'low',
        },
    ];
}
function getMockDriftYields() {
    return [
        {
            protocol: 'Drift',
            token: 'SOL',
            apy: 5.8,
            tvl: 9800000,
            type: 'lending',
            riskLevel: 'medium',
        },
        {
            protocol: 'Drift',
            token: 'USDC',
            apy: 11.2,
            tvl: 14200000,
            type: 'lending',
            riskLevel: 'medium',
        },
        {
            protocol: 'Drift',
            token: 'BTC',
            apy: 4.5,
            tvl: 3500000,
            type: 'lending',
            riskLevel: 'medium',
        },
    ];
}
export async function getYieldsByToken(connection, token, useMock = false) {
    const { topOpportunities } = await getBestYields(connection, useMock);
    return topOpportunities.filter((opp) => opp.token.toLowerCase() === token.toLowerCase());
}
export async function getYieldsByProtocol(connection, protocol, useMock = false) {
    const { topOpportunities } = await getBestYields(connection, useMock);
    return topOpportunities.filter((opp) => opp.protocol.toLowerCase() === protocol.toLowerCase());
}
//# sourceMappingURL=yieldHelper.js.map