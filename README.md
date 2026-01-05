# x402 DeFi Intelligence

Pay-per-call access to real-time DeFi yields (Kamino/Marginfi/Drift), wallet portfolio TVL, and risk scores — optimized for autonomous agents.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quickstart

This API is **deployed and live** — no local setup needed for testing.

## Live Demo (Recommended)

Call the deployed endpoints directly:

```bash
# Best yields (real or mock fallback)
curl "https://your-vercel-url.vercel.app/best-yield"

# Portfolio analytics
curl "https://your-vercel-url.vercel.app/portfolio-analytics/So11111111111111111111111111111111111111112"

# Unified DeFi intel
curl "https://your-vercel-url.vercel.app/api/defi-intel?type=all&wallet=So111...y7"


git clone https://github.com/elmoxbt/x402-defi-yield-api.git
cd x402-defi-yield-api
npm install
cp .env.example .env
# Add your devnet RECIPIENT_WALLET

npm run dev

npm run client
```


## Endpoints

- `GET /best-yield` — Top yield opportunities across Kamino, Marginfi, Drift ($0.05)
- `GET /portfolio-analytics/:wallet` — Wallet balances, positions, and TVL ($0.10)
- `GET /risk-score/:wallet` — Health factor, liquidation risk, and diversification metrics ($0.075)
- `GET /api/defi-intel` — Unified job: yields, portfolio, and/or risk via `?type=yield|portfolio|risk|all&wallet=...` ($0.10)

- x402 payments in devnet USDC
- Real protocol data where available; graceful mock fallback

## Integrations

- Kamino Finance • Marginfi v6 • Drift Protocol • Pyth Hermes • x402-solana

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Solana Foundation
- Pyth Network
- Kamino Finance, Marginfi, Drift Protocol
- x402 Working Group

Built by [@elmoxbt](https://twitter.com/elmoxbt)