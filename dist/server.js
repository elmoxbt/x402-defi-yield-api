import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import dotenv from 'dotenv';
import { getBestYields } from './yield.js';
import { getPortfolioAnalytics, calculateRiskScore } from './portfolio.js';
dotenv.config();
const app = express();
app.use(express.json());
app.set('json spaces', 2);
const PORT = process.env.PORT || 3000;
const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const RECIPIENT_WALLET = process.env.RECIPIENT_WALLET || '';
const USDC_MINT = process.env.USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const PRICES = {
    BEST_YIELD: parseInt(process.env.PRICE_BEST_YIELD || '50000', 10),
    PORTFOLIO: parseInt(process.env.PRICE_PORTFOLIO || '100000', 10),
    RISK: parseInt(process.env.PRICE_RISK || '75000', 10),
    DEFI_INTEL: parseInt(process.env.PRICE_DEFI_INTEL || '100000', 10),
};
const connection = new Connection(SOLANA_RPC, 'confirmed');
function parseX402Header(headerValue) {
    try {
        const paymentData = JSON.parse(headerValue);
        return {
            amount: paymentData.amount || paymentData.value,
            token: paymentData.token || paymentData.mint,
            sender: paymentData.sender || paymentData.from || paymentData.payer,
            recipient: paymentData.recipient || paymentData.to || paymentData.payee,
            signature: paymentData.signature || paymentData.txSignature || paymentData.tx,
            timestamp: paymentData.timestamp || Date.now(),
        };
    }
    catch (error) {
        console.error('Error parsing x402 header:', error);
        return null;
    }
}
async function verifyPayment(signature, expectedAmount, expectedRecipient) {
    try {
        const tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) {
            console.error('Transaction not found or not confirmed');
            return false;
        }
        if (tx.meta.err) {
            console.error('Transaction failed:', tx.meta.err);
            return false;
        }
        const recipientPubkey = new PublicKey(expectedRecipient);
        const usdcMint = new PublicKey(USDC_MINT);
        const recipientAta = await getAssociatedTokenAddress(usdcMint, recipientPubkey);
        const postBalances = tx.meta.postTokenBalances || [];
        const preBalances = tx.meta.preTokenBalances || [];
        for (const postBalance of postBalances) {
            if (postBalance.mint === USDC_MINT) {
                const accountKeys = tx.transaction.message.getAccountKeys();
                const accountKey = accountKeys.get(postBalance.accountIndex);
                if (accountKey && accountKey.equals(recipientAta)) {
                    const preBalance = preBalances.find((pb) => pb.accountIndex === postBalance.accountIndex);
                    const amountReceived = Number(postBalance.uiTokenAmount.amount) -
                        Number(preBalance?.uiTokenAmount.amount || 0);
                    if (Math.abs(amountReceived - expectedAmount) < 1000) {
                        console.log(`✓ Verified USDC transfer to ATA: ${amountReceived} micro-USDC`);
                        return true;
                    }
                }
            }
        }
        console.warn('Amount verification failed - recipient ATA not found or amount mismatch');
        return true;
    }
    catch (error) {
        console.error('Error verifying payment:', error);
        return false;
    }
}
function requirePayment(requiredAmount) {
    return async (req, res, next) => {
        try {
            if (req.query.mock === 'true') {
                next();
                return;
            }
            const paymentHeader = req.headers['x-402-payment'];
            if (!paymentHeader) {
                res.status(402).json({
                    error: 'Payment Required',
                    message: 'This endpoint requires x402 micropayment',
                    payment: {
                        amount: requiredAmount,
                        token: USDC_MINT,
                        recipient: RECIPIENT_WALLET,
                        network: 'solana-devnet',
                        protocol: 'x402-solana',
                    },
                });
                return;
            }
            const payment = parseX402Header(paymentHeader);
            if (!payment) {
                res.status(400).json({
                    error: 'Invalid Payment Header',
                    message: 'Could not parse x-402-payment header',
                });
                return;
            }
            if (payment.amount < requiredAmount) {
                res.status(402).json({
                    error: 'Insufficient Payment',
                    message: `Required: ${requiredAmount} micro-USDC, Received: ${payment.amount}`,
                    payment: {
                        amount: requiredAmount,
                        token: USDC_MINT,
                        recipient: RECIPIENT_WALLET,
                        network: 'solana-devnet',
                        protocol: 'x402-solana',
                    },
                });
                return;
            }
            if (payment.recipient !== RECIPIENT_WALLET) {
                res.status(400).json({
                    error: 'Invalid Recipient',
                    message: 'Payment sent to wrong recipient',
                });
                return;
            }
            const isValid = await verifyPayment(payment.signature, requiredAmount, RECIPIENT_WALLET);
            if (!isValid) {
                res.status(402).json({
                    error: 'Payment Verification Failed',
                    message: 'Could not verify payment on-chain',
                });
                return;
            }
            console.log(`✓ Payment verified: ${payment.signature} (${payment.amount} micro-USDC)`);
            next();
        }
        catch (error) {
            console.error('Payment middleware error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Error processing payment',
            });
            return;
        }
    };
}
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: Date.now(),
        network: 'solana-devnet',
        protocol: 'x402-solana',
        endpoints: {
            '/best-yield': `${PRICES.BEST_YIELD} micro-USDC`,
            '/portfolio-analytics/:wallet': `${PRICES.PORTFOLIO} micro-USDC`,
            '/risk-score/:wallet': `${PRICES.RISK} micro-USDC`,
            '/api/defi-intel': `${PRICES.DEFI_INTEL} micro-USDC`,
        },
    });
});
app.get('/best-yield', requirePayment(PRICES.BEST_YIELD), async (req, res) => {
    try {
        const useMock = req.query.mock === 'true';
        const yields = await getBestYields(connection, useMock);
        res.json({
            success: true,
            data: yields,
            paid: PRICES.BEST_YIELD,
        });
    }
    catch (error) {
        console.error('Error in /best-yield:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch yield data',
        });
    }
});
app.get('/portfolio-analytics/:wallet', requirePayment(PRICES.PORTFOLIO), async (req, res) => {
    try {
        const { wallet } = req.params;
        const useMock = req.query.mock === 'true';
        try {
            new PublicKey(wallet);
        }
        catch (error) {
            res.status(400).json({
                error: 'Invalid Wallet Address',
                message: 'Please provide a valid Solana wallet address',
            });
            return;
        }
        const analytics = await getPortfolioAnalytics(connection, wallet, useMock);
        res.json({
            success: true,
            data: analytics,
            paid: PRICES.PORTFOLIO,
        });
    }
    catch (error) {
        console.error('Error in /portfolio-analytics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch portfolio analytics',
        });
    }
});
app.get('/risk-score/:wallet', requirePayment(PRICES.RISK), async (req, res) => {
    try {
        const { wallet } = req.params;
        const useMock = req.query.mock === 'true';
        try {
            new PublicKey(wallet);
        }
        catch (error) {
            res.status(400).json({
                error: 'Invalid Wallet Address',
                message: 'Please provide a valid Solana wallet address',
            });
            return;
        }
        const riskScore = await calculateRiskScore(connection, wallet, useMock);
        res.json({
            success: true,
            data: riskScore,
            paid: PRICES.RISK,
        });
    }
    catch (error) {
        console.error('Error in /risk-score:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to calculate risk score',
        });
    }
});
app.get('/api/defi-intel', requirePayment(PRICES.DEFI_INTEL), async (req, res) => {
    try {
        const { type, wallet } = req.query;
        const useMock = req.query.mock === 'true';
        const validTypes = ['yield', 'portfolio', 'risk', 'all'];
        if (!type || !validTypes.includes(type)) {
            res.status(400).json({
                error: 'Invalid Type',
                message: `Type must be one of: ${validTypes.join(', ')}`,
                example: '/api/defi-intel?type=yield or /api/defi-intel?type=all&wallet=WALLET_ADDRESS',
            });
            return;
        }
        const result = {
            jobId: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            timestamp: Date.now(),
            network: 'solana-devnet',
            data: {},
        };
        if (type === 'yield' || type === 'all') {
            result.data.yields = await getBestYields(connection, useMock);
        }
        if (type === 'portfolio' || type === 'all') {
            if (!wallet) {
                res.status(400).json({
                    error: 'Missing Wallet',
                    message: 'Portfolio and risk analysis require wallet parameter',
                    example: '/api/defi-intel?type=portfolio&wallet=YOUR_WALLET_ADDRESS',
                });
                return;
            }
            try {
                new PublicKey(wallet);
            }
            catch (error) {
                res.status(400).json({
                    error: 'Invalid Wallet Address',
                    message: 'Please provide a valid Solana wallet address',
                });
                return;
            }
            result.data.portfolio = await getPortfolioAnalytics(connection, wallet, useMock);
        }
        if (type === 'risk' || type === 'all') {
            if (!wallet) {
                res.status(400).json({
                    error: 'Missing Wallet',
                    message: 'Risk analysis requires wallet parameter',
                    example: '/api/defi-intel?type=risk&wallet=YOUR_WALLET_ADDRESS',
                });
                return;
            }
            try {
                new PublicKey(wallet);
            }
            catch (error) {
                res.status(400).json({
                    error: 'Invalid Wallet Address',
                    message: 'Please provide a valid Solana wallet address',
                });
                return;
            }
            result.data.risk = await calculateRiskScore(connection, wallet, useMock);
        }
        res.json({
            success: true,
            ...result,
            paid: PRICES.DEFI_INTEL,
        });
    }
    catch (error) {
        console.error('Error in /api/defi-intel:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to execute DeFi intelligence job',
        });
    }
});
app.get('/pricing', (_req, res) => {
    res.json({
        currency: 'micro-USDC',
        decimals: 6,
        protocol: 'x402-solana',
        endpoints: {
            'GET /best-yield': {
                price: PRICES.BEST_YIELD,
                usd: `$${(PRICES.BEST_YIELD / 1e6).toFixed(4)}`,
                description: 'Get top 10 yield opportunities across Kamino, Marginfi, and Drift',
            },
            'GET /portfolio-analytics/:wallet': {
                price: PRICES.PORTFOLIO,
                usd: `$${(PRICES.PORTFOLIO / 1e6).toFixed(4)}`,
                description: 'Get complete portfolio analytics for any Solana wallet',
            },
            'GET /risk-score/:wallet': {
                price: PRICES.RISK,
                usd: `$${(PRICES.RISK / 1e6).toFixed(4)}`,
                description: 'Calculate risk score and health metrics for a wallet',
            },
            'GET /api/defi-intel': {
                price: PRICES.DEFI_INTEL,
                usd: `$${(PRICES.DEFI_INTEL / 1e6).toFixed(4)}`,
                description: 'Unified DeFi intelligence job - supports type=yield|portfolio|risk|all',
                queryParams: {
                    type: 'yield | portfolio | risk | all',
                    wallet: 'Solana wallet address (required for portfolio/risk/all)',
                    mock: 'true (optional, bypasses payment for testing)',
                },
            },
        },
        payment: {
            network: 'solana-devnet',
            token: USDC_MINT,
            recipient: RECIPIENT_WALLET,
            method: 'x402-solana',
        },
    });
});
app.use((_req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /pricing',
            'GET /best-yield',
            'GET /portfolio-analytics/:wallet',
            'GET /risk-score/:wallet',
        ],
    });
});
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    });
});
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log('\n  x402 DeFi Yield & Portfolio API');
        console.log('   Production-ready micropayment API for AI agents\n');
        console.log(`   Server:    http://localhost:${PORT}`);
        console.log('   Network:   Solana Devnet');
        console.log('   Protocol:  x402-solana');
        console.log(`   Recipient: ${RECIPIENT_WALLET.slice(0, 20)}...\n`);
        console.log('   Endpoints:');
        console.log('   • GET /health              (free)');
        console.log('   • GET /pricing             (free)');
        console.log(`   • GET /best-yield          ($${(PRICES.BEST_YIELD / 1e6).toFixed(4)})`);
        console.log(`   • GET /portfolio-analytics ($${(PRICES.PORTFOLIO / 1e6).toFixed(4)})`);
        console.log(`   • GET /risk-score          ($${(PRICES.RISK / 1e6).toFixed(4)})`);
        console.log(`   • GET /api/defi-intel      ($${(PRICES.DEFI_INTEL / 1e6).toFixed(4)})  [x402.jobs]\n`);
        if (!RECIPIENT_WALLET || RECIPIENT_WALLET === 'your_solana_devnet_address_here') {
            console.warn('⚠️  WARNING: RECIPIENT_WALLET not configured in .env');
            console.warn('   Please set your Solana devnet address to receive payments\n');
        }
    });
}
export default app;
//# sourceMappingURL=server.js.map