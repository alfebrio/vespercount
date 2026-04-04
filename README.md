# VesperCount

A full-stack **Solana Decentralized Application (DApp)** built with the **Anchor** framework for on-chain programs (Rust) and **React + Vite** for the frontend (TypeScript).

This monorepo bundles three independent smart contract programs and a unified web interface to interact with all of them on the Solana **Devnet**.

---

## Architecture Overview

The project is split into two main layers: **Backend (Anchor Programs)** and **Frontend (React App)**.

### Backend — Smart Contracts (`/programs/`)

Three separate Anchor programs, each demonstrating a different pattern on Solana:

| Program | Description |
|---|---|
| `vespercount` | Stateful on-chain counter using **PDA** — supports initialize, increment, and decrement per wallet |
| `spl_token_minter` | Mint and burn **SPL Tokens** via Cross-Program Invocation (CPI) with the Token Program |
| `nft_minter` | Mint **Metaplex Master Edition NFTs** with on-chain metadata; includes a 0.05 SOL treasury fee per mint |

### Frontend — Web App (`/app/`)

A React + Vite + TypeScript application that connects to the deployed programs via Anchor's IDL.

- **Wallet Support:** Phantom & Solflare via `@solana/wallet-adapter-react`
- **Network:** Solana Devnet (configurable via `VITE_RPC_URL`)
- **Components:**
  - `<CounterCard />` — Interacts with the `vespercount` program
  - `<TokenCard />` — Mints and burns SPL Tokens via `spl_token_minter`
  - `<NftCard />` — Creates NFTs via `nft_minter`

---

## Directory Structure

```text
vespercount/
│
├── .vscode/                        # VS Code workspace settings
│
├── app/                            # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/
│   │   │   ├── CounterCard.tsx     # UI for vespercount program
│   │   │   ├── NftCard.tsx         # UI for nft_minter program
│   │   │   ├── TokenCard.tsx       # UI for spl_token_minter program
│   │   │   └── WalletButton.tsx    # Wallet connect button
│   │   ├── hooks/
│   │   │   └── useCounter.ts       # Anchor provider + counter state hook
│   │   ├── idl/                    # Generated IDL JSON files (ABI bridge)
│   │   ├── App.tsx                 # Root layout, wallet providers, dark mode
│   │   ├── index.css               # Global styles & design tokens
│   │   └── main.tsx                # React entry point
│   ├── index.html                  # HTML shell
│   ├── package.json                # Frontend dependencies
│   ├── tsconfig.json               # TypeScript config (frontend)
│   └── vite.config.ts              # Vite + Node polyfills config
│
├── migrations/                     # Anchor deploy migration scripts
│
├── programs/                       # Rust smart contracts (Anchor)
│   ├── nft_minter/
│   │   └── src/lib.rs              # NFT minting logic + treasury fee
│   ├── spl_token_minter/
│   │   └── src/lib.rs              # SPL token mint/burn logic
│   └── vespercount/
│       └── src/lib.rs              # PDA counter logic
│
├── target/                         # Anchor build output (auto-generated)
│   ├── deploy/                     # Compiled .so binaries
│   ├── idl/                        # Generated IDL JSON files
│   └── types/                      # Generated TypeScript types
│
├── tests/                          # Integration tests (ts-mocha)
│   ├── nft_minter.ts
│   ├── spl_token_minter.ts
│   └── vespercount.ts
│
├── .gitignore
├── Anchor.toml                     # Anchor workspace config (program IDs, cluster, wallet)
├── Cargo.lock                      # Rust dependency lockfile
├── Cargo.toml                      # Rust workspace manifest
├── package.json                    # Root scripts & Anchor test dependencies
├── package-lock.json
├── rust-toolchain.toml             # Pinned Rust toolchain version
├── run.txt                         # Step-by-step setup & run guide
├── tsconfig.json                   # TypeScript config (Anchor tests)
└── yarn.lock
```

---

## How It Works

```
1. Write smart contract logic in Rust  →  programs/<name>/src/lib.rs
           ↓
2. Compile with `anchor build`
           ↓
3. Anchor generates IDL (.json) + TypeScript types  →  target/idl/ & target/types/
           ↓
4. Frontend imports IDL  →  Creates typed Program instance via Anchor client
           ↓
5. User clicks button in React UI  →  Transaction built & signed by wallet (Phantom)
           ↓
6. Transaction sent to Solana Devnet  →  Smart contract executes on-chain
```

---

## Quick Start

See [`run.txt`](./run.txt) for the full step-by-step setup guide.

```bash
# Clone and install
git clone https://github.com/alfebrio/vespercount.git
cd vespercount
yarn install

# Build & deploy to Devnet
anchor build
anchor deploy

# Run frontend
cd app && npm install && npm run dev
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Rust, Anchor Framework |
| Blockchain | Solana (Devnet) |
| Frontend | React 18, Vite, TypeScript |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| NFT Standard | Metaplex Token Metadata (Master Edition V3) |
| Token Standard | SPL Token Program |
| Testing | ts-mocha, Chai |

```text
vesperswap/
├── Anchor.toml           # Konfigurasi workspace Anchor (IDs program, provider network)
├── Cargo.toml            # Konfigurasi package Rust untuk backend
├── programs/             # RUST SMART CONTRACTS
│   ├── nft_minter/       # Program pencetak NFT + Metaplex logic + treasury logic
│   ├── spl_token_minter/ # Program SPL token dasar
│   └── vesperswap/       # Program Counter stateful (PDA)
├── app/                  # UI FRONTEND (REACT + VITE)
│   ├── src/
│   │   ├── components/   # UI logic pemanggilan smart contract (Counter, Token, NFT)
│   │   ├── hooks/        # React Hooks untuk koneksi anchor provider
│   │   ├── idl/          # File IDL JSON (Jembatan komunikasi antara Frontend dan Backend)
│   │   └── App.tsx       # Root layout aplikasi (Dark mode, Wallet Providers)
│   ├── package.json
│   └── vite.config.ts
├── tests/                # Folder ts-mocha untuk menguji script rust saat perintah `anchor test`
├── package.json          # Root npm configurations (scripts & dependencies)
└── run.txt               # Step-by-step tutorial untuk menjalankan proyek di komputer lokal
```
