import { useMemo, useState, useEffect } from "react";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

// ⚠️ Import default styles wallet adapter
import "@solana/wallet-adapter-react-ui/styles.css";

import { CounterCard } from "./components/CounterCard";
import { TokenCard } from "./components/TokenCard";
import { NftCard } from "./components/NftCard";
import { WalletButton } from "./components/WalletButton";
import { ToastProvider } from "./components/ToastContext";

// ─── Hero Stats Helper ──────────────────────────────────────────────────────
function getStatCounts(): { txCount: number; tokensMinted: number; nftsCreated: number } {
  let txCount = 0;
  let tokensMinted = 0;
  let nftsCreated = 0;
  try {
    const counterTx = JSON.parse(localStorage.getItem("counter_tx_history") || "[]");
    const tokenTx = JSON.parse(localStorage.getItem("token_tx_history") || "[]");
    const nftTx = JSON.parse(localStorage.getItem("nft_mint_history") || "[]");
    txCount = counterTx.length + tokenTx.length + nftTx.length;
    tokensMinted = tokenTx.filter((t: any) => t.type === "mint").length;
    nftsCreated = nftTx.length;
  } catch { /* ignore */ }
  return { txCount, tokensMinted, nftsCreated };
}

// ─── SOL Balance Display ────────────────────────────────────────────────────
function SolBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) { setBalance(null); return; }
    let mounted = true;
    connection.getBalance(publicKey).then((lamports) => {
      if (mounted) setBalance(lamports / LAMPORTS_PER_SOL);
    }).catch(() => {
      if (mounted) setBalance(null);
    });
    // Refresh balance every 20s
    const iv = setInterval(() => {
      connection.getBalance(publicKey).then((lamports) => {
        if (mounted) setBalance(lamports / LAMPORTS_PER_SOL);
      }).catch(() => { });
    }, 20000);
    return () => { mounted = false; clearInterval(iv); };
  }, [connected, publicKey, connection]);

  if (!connected || balance === null) return null;
  return (
    <span className="sol-balance" title={`${balance} SOL`}>
      ◎ {balance.toFixed(2)}
    </span>
  );
}

// ─── Devnet Warning Banner ──────────────────────────────────────────────────
function DevnetBanner() {
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("devnet_banner_dismissed") === "1";
  });

  if (dismissed) return null;

  return (
    <div className="devnet-banner">
      <span>⚠ You are on Devnet — transactions use test SOL only</span>
      <button
        className="devnet-banner-close"
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("devnet_banner_dismissed", "1");
        }}
        aria-label="Dismiss devnet warning"
      >
        ✕
      </button>
    </div>
  );
}

// ─── App Inner (needs wallet context for SolBalance) ─────────────────────────
function AppInner() {
  const stats = useMemo(() => getStatCounts(), []);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <div className="bg-layer-1" />
      <div className="bg-layer-2" />
      
      <div className="app-container">
        {/* ─── Navbar ──────────────────────────────────────────────── */}
        <nav className={`navbar animate-up ${isScrolled ? "navbar-scrolled" : ""}`}>
          <div className="brand">
            <div className="brand-icon">⌘</div>
            VesperCount
          </div>

          <div className="navbar-right">
            <SolBalance />
            <div className="network-badge network-badge-devnet">
              <div className="network-dot-pulse" />
              ⚠ Devnet
            </div>
            <WalletButton />
          </div>
        </nav>

        {/* ─── Devnet Banner ───────────────────────────────────────── */}
        <DevnetBanner />

        {/* ─── Hero ────────────────────────────────────────────────── */}
        <header className="hero-header">
          <div className="hero-bg-dots" />
        <h1 className="hero-title hero-animate-1">
          The Starter for <span className="hero-highlight">On-Chain</span> Interactions
        </h1>
        <p className="hero-subtitle hero-animate-2">
          Interact with counters, mint SPL tokens, and create NFTs with precision on Solana.
        </p>

        {/* Stats Bar */}
        <div className="hero-stats hero-animate-3">
          <div className="hero-stat">
            <span className="hero-stat-value">{stats.txCount}</span>
            <span className="hero-stat-label">Transactions</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">{stats.tokensMinted}</span>
            <span className="hero-stat-label">Tokens Minted</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat">
            <span className="hero-stat-value">{stats.nftsCreated}</span>
            <span className="hero-stat-label">NFTs Created</span>
          </div>
        </div>
      </header>

      {/* ─── Dashboard Grid ──────────────────────────────────────── */}
      <div className="dashboard-grid">
        <div className="card-entrance card-entrance-1">
          <CounterCard />
        </div>
        <div className="card-entrance card-entrance-2">
          <TokenCard />
        </div>
        <div className="card-entrance card-entrance-3">
          <NftCard />
        </div>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="app-footer">
        <div className="footer-border" />
        <div className="footer-content">
          <div className="footer-col footer-brand-col">
            <div className="brand" style={{ marginBottom: 8 }}>
              <div className="brand-icon">⌘</div>
              VesperCount
            </div>
            <p className="footer-tagline">Precision tools for the Solana ecosystem.</p>
          </div>

          <div className="footer-col footer-links-col">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">Changelog</a>
          </div>

          <div className="footer-col footer-solana-col">
            <div className="footer-solana-badge">
              <svg width="16" height="16" viewBox="0 0 128 128" fill="currentColor">
                <path d="M25.3 105.7a4.4 4.4 0 0 1 3.1-1.3h95.2a2.2 2.2 0 0 1 1.6 3.8l-18.8 18.8a4.4 4.4 0 0 1-3.1 1.3H8.1a2.2 2.2 0 0 1-1.6-3.8l18.8-18.8ZM25.3 1.3A4.5 4.5 0 0 1 28.4 0h95.2a2.2 2.2 0 0 1 1.6 3.8L106.4 22.6a4.4 4.4 0 0 1-3.1 1.3H8.1a2.2 2.2 0 0 1-1.6-3.8L25.3 1.3ZM106.4 53.2a4.4 4.4 0 0 0-3.1-1.3H8.1a2.2 2.2 0 0 0-1.6 3.8l18.8 18.8a4.4 4.4 0 0 0 3.1 1.3h95.2a2.2 2.2 0 0 0 1.6-3.8L106.4 53.2Z" />
              </svg>
              Built on Solana
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}

// ─── App Root ───────────────────────────────────────────────────────────────
export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(
    () =>
      import.meta.env.VITE_RPC_URL ?? clusterApiUrl(network),
    [network]
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
