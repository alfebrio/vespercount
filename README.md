# VesperCount

![Solana](https://img.shields.io/badge/Solana-Devnet-31D0AA?style=flat-square&logo=solana)
![Anchor](https://img.shields.io/badge/Anchor-Framework-000000?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)

A full-stack Solana Decentralized Application (DApp) built utilizing the Anchor framework and React. VesperCount serves as a comprehensive reference architecture demonstrating core Solana blockchain primitives, including stateful Account management (PDAs), SPL Token operations, and Metaplex NFT minting.

![VesperCount Preview](./image.png)

## 📌 Architecture Overview

The system is decoupled into isolated on-chain Anchor programs and an event-driven frontend application. 

### On-Chain Programs (`/programs`)

1. **`vespercount`**: Demonstrates Program Derived Addresses (PDAs) with stateful counters. Features bulk operations (`increment`, `decrement`) to optimize transaction compute and manage state safely per-wallet.
2. **`spl_token_minter`**: Implements Cross-Program Invocation (CPI) against the native SPL Token Program to mint and burn custom fungible tokens.
3. **`nft_minter`**: Demonstrates the Metaplex Token Metadata program (Master Edition V3). Capable of minting NFTs with on-chain metadata pointers, incorporating treasury fee processing and hard supply caps.

### Frontend Application (`/app`)

The frontend is a Vite-powered React/TypeScript application designed with a focus on UI responsiveness and seamless wallet integration (`@solana/wallet-adapter`).

- **Global Event Sync**: Employs an event-driven pub-sub architecture (`utils/stats.ts`) to immediately synchronize UI state globally without redundant RPC polling.
- **Unified Transaction History**: Caches temporal transaction data locally to construct a seamless user experience.
- **Error Handling**: Implements client-side transaction simulations and resilient RPC fallback mechanisms handling standard Solana congestion exceptions.

## 📂 Directory Structure

```text
vespercount/
├── app/                        # React frontend application
│   ├── src/
│   │   ├── components/         # Modular UI components (Cards, Navbar)
│   │   ├── hooks/              # Custom React hooks (Anchor client abstractions)
│   │   └── utils/              # Event busses and persistent global stores
│   └── index.html              # Frontend entrypoint
├── migrations/                 # Anchor deployment and setup scripts
├── programs/                   # Rust smart contracts
│   ├── nft_minter/             # SPL Metadata & Treasury pattern
│   ├── spl_token_minter/       # SPL Token pattern
│   └── vespercount/            # PDA State pattern
└── tests/                      # Mocha + Chai unit & integration tests
```

## 🚀 Quick Start

Ensure you have [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools), [Anchor](https://www.anchor-lang.com/docs/installation), and [Node.js](https://nodejs.org/) installed. For detailed installation guidance, please refer to the included [`run.txt`](./run.txt) walkthrough.

1. **Clone the Repository**
   ```bash
   git clone https://github.com/alfebrio/vespercount.git
   cd vespercount
   yarn install
   ```

2. **Build and Deploy Smart Contracts**
   Ensure your local Solana config is pointed to devnet (`solana config set --url devnet`).
   ```bash
   anchor keys sync
   anchor build
   anchor deploy
   ```

3. **Launch the Frontend**
   ```bash
   cd app
   npm install
   npm run dev
   ```
   Navigate to `http://localhost:5173` to interact with the dashboard.

## 🧠 Tech Stack

- **Smart Contracts**: Rust, Anchor Framework `0.29.0`, Solana Web3 `1.18.x`
- **Frontend Core**: React 18, Vite, TypeScript
- **Web3 Integration**: `@solana/web3.js`, `@coral-xyz/anchor`, `@solana/wallet-adapter`
- **Testing Methodology**: `ts-mocha`, Chai assertions against a local test validator
- **Styling**: Vanilla CSS tailored with advanced Flexbox grid architectures

## 📜 License
Developed by **alfebrio**. Powered by Solana and Antigravity.
