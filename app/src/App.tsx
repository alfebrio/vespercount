import { useMemo, useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// ⚠️ Import default styles wallet adapter
import "@solana/wallet-adapter-react-ui/styles.css";

import { CounterCard } from "./components/CounterCard";
import { TokenCard } from "./components/TokenCard";
import { NftCard } from "./components/NftCard";
import { WalletButton } from "./components/WalletButton";

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(
    () =>
      import.meta.env.VITE_RPC_URL ?? clusterApiUrl(network),
    [network]
  );

  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [isLightMode]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app-container animate-up">
            <nav className="navbar">
              <div className="brand">
                <div className="brand-icon">⌘</div>
                VesperCount
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={() => setIsLightMode(!isLightMode)}
                  className="btn-outline"
                  style={{ padding: '8px 16px', borderRadius: '99px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--border)' }}
                  title="Toggle Theme"
                >
                  {isLightMode ? '🌙' : '☀️'}
                </button>
                <div className="network-badge">
                  <div className="network-dot" />
                  Devnet
                </div>
                <WalletButton />
              </div>
            </nav>

            <header className="hero-header">
              <h1 className="hero-title">
                The New Standard for On-Chain Interactions
              </h1>
              <p className="hero-subtitle">
                Interact with counters, mint SPL tokens, and create Master Edition NFTs with brutalist precision on Solana.
              </p>
            </header>

            <div className="dashboard-grid">
              <CounterCard />
              <TokenCard />
              <NftCard />
            </div>

            <footer style={{ padding: '40px 0', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Built with precision for the Solana ecosystem. &copy; 2026 VesperCount
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
