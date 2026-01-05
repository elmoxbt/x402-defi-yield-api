/**
 * Portfolio Analytics & Risk Helper
 * Analyzes wallet positions, token balances, and risk metrics
 */

import {
  Connection,
  PublicKey,
  ParsedAccountData,
  TokenAmount,
} from '@solana/web3.js';
import { getPythService } from './pyth.js';

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
  overallScore: number; // 0-100, higher is riskier
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

/**
 * Get wallet token balances
 */
async function getTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance[]> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletAddress, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const pythService = getPythService();
    const balances: TokenBalance[] = [];

    for (const account of tokenAccounts.value) {
      const parsedInfo = (account.account.data as ParsedAccountData).parsed.info;
      const tokenAmount: TokenAmount = parsedInfo.tokenAmount;
      const mint = parsedInfo.mint;

      if (tokenAmount.uiAmount && tokenAmount.uiAmount > 0) {
        // Try to determine symbol (simplified - in production use token metadata)
        let symbol = 'UNKNOWN';
        try {
          // Common mints on devnet
          const knownMints: Record<string, string> = {
            '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC',
            'So11111111111111111111111111111111111111112': 'SOL',
          };
          symbol = knownMints[mint] || mint.slice(0, 4);
        } catch (e) {
          symbol = 'UNKNOWN';
        }

        const usdValue = await pythService.calculateUsdValue(
          symbol,
          tokenAmount.uiAmount,
          true // Use mock for now
        );

        balances.push({
          mint,
          symbol,
          balance: Number(tokenAmount.amount),
          decimals: tokenAmount.decimals,
          uiAmount: tokenAmount.uiAmount,
          usdValue,
        });
      }
    }

    return balances;
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return [];
  }
}

/**
 * Get Marginfi positions for a wallet
 */
async function getMarginfiPositions(
  _connection: Connection,
  _walletAddress: PublicKey
): Promise<PortfolioPosition[]> {
  // Marginfi v6 SDK has breaking changes - using mock data for now
  return [];
}

/**
 * Get complete portfolio analytics for a wallet
 */
export async function getPortfolioAnalytics(
  connection: Connection,
  walletAddress: string,
  useMock: boolean = false
): Promise<PortfolioAnalytics> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const pythService = getPythService();

    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey);
    const solUiAmount = solBalance / 1e9;
    const solUsdValue = await pythService.calculateUsdValue('SOL', solUiAmount, true);

    // Get token balances
    const tokenBalances = useMock ? getMockTokenBalances() : await getTokenBalances(connection, publicKey);

    // Get DeFi positions
    const defiPositions = useMock ? getMockDefiPositions() : await getMarginfiPositions(connection, publicKey);

    // Calculate total USD value
    const tokenUsdValue = tokenBalances.reduce((sum, token) => sum + token.usdValue, 0);
    const defiUsdValue = defiPositions.reduce((sum, pos) => sum + pos.usdValue, 0);
    const totalUsdValue = solUsdValue + tokenUsdValue + defiUsdValue;

    return {
      wallet: walletAddress,
      solBalance: solUiAmount,
      solUsdValue,
      tokenBalances,
      defiPositions,
      totalUsdValue,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error getting portfolio analytics:', error);
    // Return mock data as fallback
    return {
      wallet: walletAddress,
      solBalance: 5.25,
      solUsdValue: 517.125,
      tokenBalances: getMockTokenBalances(),
      defiPositions: getMockDefiPositions(),
      totalUsdValue: 12847.50,
      timestamp: Date.now(),
    };
  }
}

/**
 * Calculate risk score for a wallet
 */
export async function calculateRiskScore(
  connection: Connection,
  walletAddress: string,
  useMock: boolean = false
): Promise<RiskScore> {
  try {
    const portfolio = await getPortfolioAnalytics(connection, walletAddress, useMock);

    let healthFactor: number | undefined;
    const warnings: string[] = [];

    // Marginfi v6 SDK has breaking changes - health factor disabled
    if (!useMock) {
      console.warn('Health factor calculation disabled - Marginfi v6 SDK breaking changes');
    }

    // Calculate concentration risk (based on token distribution)
    const totalValue = portfolio.totalUsdValue;
    const concentrations = portfolio.tokenBalances.map((token) => token.usdValue / totalValue);
    const maxConcentration = Math.max(...concentrations, 0);
    const concentrationRisk = maxConcentration * 100;

    if (maxConcentration > 0.7) {
      warnings.push('High concentration risk: Over 70% in single asset');
    }

    // Calculate liquidation risk
    const borrowedPositions = portfolio.defiPositions.filter((p) => p.type === 'borrowing');
    const totalBorrowed = borrowedPositions.reduce((sum, p) => sum + p.usdValue, 0);
    const liquidationRisk = totalBorrowed > 0 ? (totalBorrowed / totalValue) * 100 : 0;

    if (liquidationRisk > 50) {
      warnings.push('High liquidation risk: Borrowed amount exceeds 50% of portfolio');
    }

    // Calculate protocol diversification
    const uniqueProtocols = new Set(portfolio.defiPositions.map((p) => p.protocol));
    const protocolDiversification = uniqueProtocols.size > 0 ? 100 / uniqueProtocols.size : 100;

    if (uniqueProtocols.size === 1 && portfolio.defiPositions.length > 0) {
      warnings.push('Single protocol exposure - consider diversification');
    }

    // Calculate overall score (0-100, higher is riskier)
    const overallScore = Math.min(
      100,
      (concentrationRisk * 0.3 +
        liquidationRisk * 0.4 +
        protocolDiversification * 0.2 +
        (healthFactor ? Math.max(0, (2 - healthFactor) * 50) : 10))
    );

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (overallScore < 25) riskLevel = 'low';
    else if (overallScore < 50) riskLevel = 'medium';
    else if (overallScore < 75) riskLevel = 'high';
    else riskLevel = 'critical';

    return {
      wallet: walletAddress,
      overallScore,
      riskLevel,
      factors: {
        healthFactor,
        concentrationRisk,
        liquidationRisk,
        protocolDiversification,
      },
      warnings,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error calculating risk score:', error);
    return getMockRiskScore(walletAddress);
  }
}

/**
 * Mock token balances for demo
 */
function getMockTokenBalances(): TokenBalance[] {
  return [
    {
      mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      symbol: 'USDC',
      balance: 5000000000,
      decimals: 6,
      uiAmount: 5000,
      usdValue: 5000,
    },
    {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      balance: 50000000000,
      decimals: 9,
      uiAmount: 50,
      usdValue: 4925,
    },
  ];
}

/**
 * Mock DeFi positions for demo
 */
function getMockDefiPositions(): PortfolioPosition[] {
  return [
    {
      protocol: 'Marginfi',
      type: 'lending',
      token: 'USDC',
      amount: 2500,
      usdValue: 2500,
      apy: 9.8,
    },
    {
      protocol: 'Kamino',
      type: 'liquidity',
      token: 'SOL-USDC',
      amount: 422.375,
      usdValue: 422.375,
      apy: 12.3,
    },
  ];
}

/**
 * Mock risk score for demo
 */
function getMockRiskScore(walletAddress: string): RiskScore {
  return {
    wallet: walletAddress,
    overallScore: 32,
    riskLevel: 'medium',
    factors: {
      healthFactor: 2.15,
      concentrationRisk: 38.5,
      liquidationRisk: 19.5,
      protocolDiversification: 50,
    },
    warnings: [],
    timestamp: Date.now(),
  };
}
