# x402 DeFi Intelligence API

**Micropayment-gated DeFi data for AI agents.** Real-time yields, portfolio analytics, and risk scores from Kamino, Marginfi, and Drift — pay per call with USDC on Solana.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![x402](https://img.shields.io/badge/x402-solana-00D4AA)](https://github.com/x402/x402-solana)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live API:** [https://x402-defi-yield-api.vercel.app](https://x402-defi-yield-api.vercel.app)

---

## Quickstart

### 1. Test the Live API (No Setup Required)

```bash
# Check health
curl https://x402-defi-yield-api.vercel.app/health

# View pricing
curl https://x402-defi-yield-api.vercel.app/pricing

# Request best yields (requires payment)
curl https://x402-defi-yield-api.vercel.app/best-yield
# → Returns 402 Payment Required with payment details
```

### 2. Make Your First Paid Request

```bash
git clone https://github.com/yourusername/x402-defi-yield-api.git
cd x402-defi-yield-api
npm install

# Create and fund a wallet
solana-keygen new -o wallet.json
solana airdrop 2 $(solana address -k wallet.json) --url devnet

Get devnet USDC from https://faucet.circle.com/

# Run the payment client
npm run client
```

The client automatically:
1. Requests data (receives 402 payment requirement)
2. Sends USDC payment on Solana
3. Retries request with payment proof
4. Receives the data

### 3. Run Your Own Instance (Optional)

```bash
cp .env.example .env
# Set RECIPIENT_WALLET to your Solana address

npm run dev
# Server runs on http://localhost:3000
```

---

## API Endpoints

| Endpoint | Description | Price |
|----------|-------------|-------|
| `GET /best-yield` | Top 10 yield opportunities (Kamino/Marginfi/Drift) | $0.05 |
| `GET /portfolio-analytics/:wallet` | Wallet balances, positions, TVL | $0.10 |
| `GET /risk-score/:wallet` | Health factor, liquidation risk, diversification | $0.075 |
| `GET /api/defi-intel` | Unified endpoint with `?type=yield\|portfolio\|risk\|all` | $0.10 |

**Free endpoints:** `/health`, `/pricing`

### Example: Unified DeFi Intel

```bash
# Get everything for a wallet
curl "https://x402-defi-yield-api.vercel.app/api/defi-intel?type=all&wallet=YOUR_WALLET"

# Just yields
curl "https://x402-defi-yield-api.vercel.app/api/defi-intel?type=yield"

# Test with mock data (bypasses payment)
curl "https://x402-defi-yield-api.vercel.app/api/defi-intel?type=yield&mock=true"
```

---

## How x402 Payments Work

1. **Client requests endpoint** → Server returns `402 Payment Required` with payment details
2. **Client sends USDC** on Solana to the specified recipient address
3. **Client retries request** with `x-402-payment` header containing transaction signature
4. **Server verifies payment** on-chain and returns data

Payment verification happens in real-time using Solana RPC. All payments are in devnet USDC (micro-USDC amounts, 6 decimals).

---

## Features

- **Production-ready micropayments:** x402-solana protocol with ATA-to-ATA USDC transfers
- **Real DeFi data:** Live integrations with Kamino Finance, Marginfi v6, Drift Protocol
- **Graceful fallbacks:** Returns mock data when protocol APIs are unavailable
- **AI agent optimized:** Simple JSON responses, clear error messages, sub-$0.10 pricing
- **Vercel deployed:** Serverless, auto-scaling, global edge network
- **Type-safe:** Full TypeScript codebase with strict null checks

---

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- Solana Web3.js + SPL Token
- x402-solana payment verification

**DeFi Integrations:**
- Kamino Finance SDK
- Marginfi v6 Client
- Drift Protocol SDK
- Pyth Hermes (price feeds)

**Infrastructure:**
- Vercel (serverless deployment)
- Solana Devnet (RPC + payments)

---

## Use Cases

- **AI Trading Agents:** Get real-time yields to optimize DeFi allocations
- **Portfolio Dashboards:** Pay-per-query wallet analytics without API keys
- **Risk Monitors:** Track health factors and liquidation risk across protocols
- **DeFi Aggregators:** Unified data source with micropayment monetization

---
## Contributing

Open to collaborations on:
- Additional DeFi protocol integrations
- Payment optimization and caching strategies
- AI agent tooling and SDKs

Reach out: [@elmoxbt](https://twitter.com/elmoxbt)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built by [@elmoxbt](https://twitter.com/elmoxbt)** • Powered by Solana + x402