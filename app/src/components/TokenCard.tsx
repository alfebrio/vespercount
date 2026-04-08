import { useState, useEffect, useRef, useCallback } from "react";
import { useToken } from "../hooks/useToken";
import { useToast } from "./ToastContext";
import { incrementStat } from "../utils/stats";

// ─── Types ──────────────────────────────────────────────────────────────────
type TxHistoryItem = {
  type: "mint" | "burn";
  amount: number;
  mintAddress: string;
  txSignature: string;
  timestamp: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const TX_HISTORY_KEY = "token_tx_history";

function loadTxHistory(): TxHistoryItem[] {
  try {
    const raw = localStorage.getItem(TX_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TxHistoryItem[];
  } catch {
    return [];
  }
}

function saveTxHistory(items: TxHistoryItem[]) {
  localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function isValidBase58(str: string): boolean {
  if (!str || str.length < 32 || str.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

function parseFriendlyError(error: string): { friendly: string; isRaw: boolean } {
  const lower = error.toLowerCase();
  if (lower.includes("insufficient funds"))
    return { friendly: "SOL tidak cukup untuk biaya transaksi", isRaw: false };
  if (lower.includes("owner does not match"))
    return { friendly: "Mint address bukan milik wallet ini", isRaw: false };
  if (lower.includes("user rejected"))
    return { friendly: "Transaksi dibatalkan", isRaw: false };
  return { friendly: error, isRaw: true };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function TokenCard() {
  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"mint" | "burn">("mint");
  const [tabFade, setTabFade] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [mintAmount, setMintAmount] = useState(100);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [burnAmount, setBurnAmount] = useState(50);
  const [burnMintAddress, setBurnMintAddress] = useState("");

  // ── Hook ──────────────────────────────────────────────────────────────────
  const { mintTokens, burnTokens, loading, error } = useToken();
  const { toast } = useToast();

  // ── Separate loading states (derived from hook + local tracking) ──────────
  const [mintLoading, setMintLoading] = useState(false);
  const [burnLoading, setBurnLoading] = useState(false);

  // ── Result state ──────────────────────────────────────────────────────────
  const [successMint, setSuccessMint] = useState<string | null>(null);
  const [successBurn, setSuccessBurn] = useState<string | null>(null);

  // ── Burn confirmation ─────────────────────────────────────────────────────
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

  // ── Validation Tracking ───────────────────────────────────────────────────
  const [mintFormSubmitted, setMintFormSubmitted] = useState(false);
  const [burnSubmitted, setBurnSubmitted] = useState(false);

  // ── Error expand ──────────────────────────────────────────────────────────
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Copy mint address ─────────────────────────────────────────────────────
  const [addressCopied, setAddressCopied] = useState(false);

  // ── Tx history ────────────────────────────────────────────────────────────
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>(loadTxHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Refresh relative times ────────────────────────────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n: number) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Tab switching with fade animation ─────────────────────────────────────
  const switchTab = (tab: "mint" | "burn") => {
    if (tab === activeTab) return;
    setTabFade(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTabFade(false);
    }, 150);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const mintAmountValid = mintAmount >= 1;
  const burnAmountValid = burnAmount >= 1;
  const burnAddressValid = isValidBase58(burnMintAddress);
  const burnAddressTouched = useRef(false);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleMint = useCallback(async () => {
    setMintFormSubmitted(true);
    if (!tokenName.trim() || !tokenSymbol.trim() || !mintAmountValid) return;
    setSuccessMint(null);
    setSuccessBurn(null);
    setErrorExpanded(false);
    setMintLoading(true);
    const mintAddress = await mintTokens(mintAmount, tokenName, tokenSymbol);
    setMintLoading(false);
    if (mintAddress) {
      const addr = mintAddress.toBase58();
      setSuccessMint(addr);
      setBurnMintAddress(addr);
      burnAddressTouched.current = false;
      // Save to history
      const newItem: TxHistoryItem = {
        type: "mint",
        amount: mintAmount,
        mintAddress: addr,
        txSignature: addr, // mint tx uses mint address as identifier
        timestamp: Date.now(),
      };
      setTxHistory((prev: TxHistoryItem[]) => {
        const updated = [newItem, ...prev].slice(0, 5);
        saveTxHistory(updated);
        return updated;
      });
      incrementStat("txCount");
      incrementStat("tokensMinted");
      toast.success(`${formatNumber(mintAmount)} tokens minted!`);
    }
  }, [mintTokens, mintAmount, tokenName, tokenSymbol, mintAmountValid, toast]);

  const handleBurnClick = () => {
    setShowBurnConfirm(true);
  };

  const handleBurnConfirm = useCallback(async () => {
    setShowBurnConfirm(false);
    setSuccessMint(null);
    setSuccessBurn(null);
    setErrorExpanded(false);
    setBurnLoading(true);
    const signature = await burnTokens(burnMintAddress, burnAmount);
    setBurnLoading(false);
    if (signature) {
      setSuccessBurn(signature);
      // Save to history
      const newItem: TxHistoryItem = {
        type: "burn",
        amount: burnAmount,
        mintAddress: burnMintAddress,
        txSignature: signature,
        timestamp: Date.now(),
      };
      setTxHistory((prev: TxHistoryItem[]) => {
        const updated = [newItem, ...prev].slice(0, 5);
        saveTxHistory(updated);
        return updated;
      });
      incrementStat("txCount");
      toast.success(`${formatNumber(burnAmount)} tokens burned!`);
    }
  }, [burnTokens, burnMintAddress, burnAmount, toast]);

  const handleCopyAddress = useCallback(() => {
    if (burnMintAddress) {
      navigator.clipboard.writeText(burnMintAddress);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    }
  }, [burnMintAddress]);

  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [error]);

  const handleClearHistory = () => {
    setTxHistory([]);
    localStorage.removeItem(TX_HISTORY_KEY);
  };

  // ── Slider sync helpers ───────────────────────────────────────────────────
  const handleMintSlider = (val: number) => setMintAmount(Math.max(1, Math.min(1000000, val)));
  const handleMintInput = (val: number) => setMintAmount(Math.max(0, Math.min(1000000, val || 0)));
  const handleBurnSlider = (val: number) => setBurnAmount(Math.max(1, Math.min(1000000, val)));
  const handleBurnInput = (val: number) => setBurnAmount(Math.max(0, Math.min(1000000, val || 0)));

  // ── Error render ──────────────────────────────────────────────────────────
  const renderError = () => {
    if (!error) return null;
    const { friendly, isRaw } = parseFriendlyError(error);
    const showToggle = isRaw && friendly.length > 100;
    const displayText = showToggle && !errorExpanded ? friendly.slice(0, 100) + "…" : friendly;

    return (
      <div className="token-error" role="status" aria-live="polite">
        <div className="token-error-content">
          <span>⚠️ {displayText}</span>
        </div>
        <div className="token-error-actions">
          {showToggle && (
            <button
              className="btn-toggle-error"
              onClick={() => setErrorExpanded(!errorExpanded)}
            >
              {errorExpanded ? "Show less" : "Show more"}
            </button>
          )}
          {isRaw && (
            <button className="btn-copy-error" onClick={handleCopyError}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Burn confirm panel ────────────────────────────────────────────────────
  const renderBurnConfirm = () => {
    if (!showBurnConfirm) return null;
    return (
      <div className="token-confirm-panel">
        <div className="token-confirm-title">⚠ Confirm Burn</div>
        <div className="token-confirm-details">
          <div className="token-confirm-row">
            <span className="token-confirm-label">Mint</span>
            <span className="token-confirm-addr">
              {burnMintAddress.slice(0, 8)}…{burnMintAddress.slice(-6)}
            </span>
          </div>
          <div className="token-confirm-row">
            <span className="token-confirm-label">Amount</span>
            <span>{formatNumber(burnAmount)}</span>
          </div>
        </div>
        <p className="token-confirm-warning">This action is irreversible</p>
        <div className="token-confirm-buttons">
          <button
            className="btn-premium btn-outline"
            onClick={() => setShowBurnConfirm(false)}
            aria-label="Cancel burn"
          >
            Cancel
          </button>
          <button
            className="btn-premium btn-danger-fill"
            onClick={handleBurnConfirm}
            aria-label="Confirm burn tokens"
          >
            Confirm Burn
          </button>
        </div>
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="glass-card card-accent-token">
      {/* Title */}
      <h3 className="card-title">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.25 8.75h-3a1.5 1.5 0 0 0 0 3h1.5a1.5 1.5 0 0 1 0 3h-3M12 7.75v1M12 15.25v1" />
        </svg>
        Token Factory
      </h3>

      {/* Tab Switcher */}
      <div className="token-tabs" role="tablist" aria-label="Token actions">
        <button
          className={`token-tab ${activeTab === "mint" ? "token-tab-active-mint" : ""}`}
          onClick={() => switchTab("mint")}
          role="tab"
          aria-selected={activeTab === "mint"}
          aria-controls="token-panel-mint"
          aria-label="Mint tokens tab"
        >
          Mint
        </button>
        <button
          className={`token-tab ${activeTab === "burn" ? "token-tab-active-burn" : ""}`}
          onClick={() => switchTab("burn")}
          role="tab"
          aria-selected={activeTab === "burn"}
          aria-controls="token-panel-burn"
          aria-label="Burn tokens tab"
        >
          Burn
        </button>
      </div>

      {/* Tab Content */}
      <div className={`token-tab-content ${tabFade ? "token-tab-fade" : ""}`}>

        {/* ─── Mint Panel ───────────────────────────────────────────────── */}
        {activeTab === "mint" && (
          <div id="token-panel-mint" role="tabpanel" aria-labelledby="Mint tokens">
            {/* Token Name and Symbol */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div className="input-group" style={{ flex: 2, marginBottom: 0 }}>
                <label className="input-label" htmlFor="token-name">Token Name</label>
                <input
                  id="token-name"
                  type="text"
                  className={`input-field ${mintFormSubmitted && !tokenName.trim() ? "input-invalid" : ""}`}
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  maxLength={32}
                  placeholder="Vesper Token"
                />
                {mintFormSubmitted && !tokenName.trim() && (
                  <span className="input-hint input-hint-error" style={{ position: 'absolute', bottom: -18, left: 0 }}>
                    Name is required
                  </span>
                )}
              </div>
              <div className="input-group" style={{ flex: 1, marginBottom: 0, position: 'relative' }}>
                <label className="input-label" htmlFor="token-symbol">Symbol</label>
                <input
                  id="token-symbol"
                  type="text"
                  className={`input-field ${mintFormSubmitted && !tokenSymbol.trim() ? "input-invalid" : ""}`}
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  maxLength={10}
                  placeholder="VESP"
                />
                {mintFormSubmitted && !tokenSymbol.trim() && (
                  <span className="input-hint input-hint-error" style={{ position: 'absolute', bottom: -18, left: 0 }}>
                    Required
                  </span>
                )}
              </div>
            </div>

            {/* Amount slider + input */}
            <div className="input-group">
              <label className="input-label" htmlFor="mint-amount">Amount</label>
              <div className="token-slider-group">
                <input
                  type="range"
                  className="token-slider token-slider-mint"
                  min={1}
                  max={1000000}
                  step={1}
                  value={mintAmount}
                  onChange={(e) => handleMintSlider(Number(e.target.value))}
                  aria-label="Mint amount slider"
                />
                <input
                  id="mint-amount"
                  type="number"
                  className={`input-field token-amount-input ${!mintAmountValid ? "input-invalid" : ""}`}
                  value={mintAmount}
                  min={1}
                  max={1000000}
                  onChange={(e) => handleMintInput(Number(e.target.value))}
                  aria-label="Mint amount"
                  aria-required="true"
                  aria-invalid={!mintAmountValid}
                  aria-describedby={!mintAmountValid ? "mint-amount-error" : undefined}
                />
              </div>
              {!mintAmountValid && (
                <span id="mint-amount-error" className="input-hint input-hint-error">
                  Amount must be at least 1
                </span>
              )}
              <div className="token-slider-range">
                <span>1</span>
                <span>{formatNumber(mintAmount)}</span>
                <span>1,000,000</span>
              </div>
            </div>

            {/* Mint Button */}
            <button
              className="btn-premium btn-primary"
              style={{ width: '100%' }}
              onClick={handleMint}
              disabled={mintLoading}
              aria-label="Mint tokens"
            >
              {mintLoading ? "Minting..." : "Mint Tokens"}
            </button>

            {/* Mint success */}
            {successMint && (
              <div className="token-success" role="status" aria-live="polite">
                <p style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>✓ Successfully Minted!</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', wordBreak: 'break-all', marginTop: 4 }}>
                  Mint: {successMint.slice(0, 8)}...{successMint.slice(-8)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── Burn Panel ───────────────────────────────────────────────── */}
        {activeTab === "burn" && (
          <div id="token-panel-burn" role="tabpanel" aria-labelledby="Burn tokens">
            {/* Mint Address with Copy */}
            <div className="input-group">
              <label className="input-label" htmlFor="burn-address">Mint Address</label>
              <div className="token-address-wrapper">
                <input
                  id="burn-address"
                  type="text"
                  className={`input-field token-address-input ${burnAddressTouched.current && !burnAddressValid && burnMintAddress ? "input-invalid" : ""}`}
                  value={burnMintAddress}
                  onChange={(e) => {
                    setBurnMintAddress(e.target.value);
                    burnAddressTouched.current = true;
                  }}
                  placeholder="Paste mint address"
                  aria-label="Token mint address to burn"
                  aria-required="true"
                  aria-invalid={burnAddressTouched.current && !burnAddressValid && !!burnMintAddress}
                  aria-describedby={burnAddressTouched.current && !burnAddressValid && burnMintAddress ? "burn-address-error" : undefined}
                />
                <button
                  className="token-copy-btn"
                  onClick={handleCopyAddress}
                  disabled={!burnMintAddress}
                  title={addressCopied ? "Copied!" : "Copy address"}
                  aria-label="Copy mint address"
                >
                  {addressCopied ? "✓" : "⧉"}
                </button>
              </div>
              {burnAddressTouched.current && burnMintAddress && !burnAddressValid && (
                <span id="burn-address-error" className="input-hint input-hint-error">
                  Invalid Solana address format
                </span>
              )}
            </div>

            {/* Burn Amount slider + input */}
            <div className="input-group">
              <label className="input-label" htmlFor="burn-amount">Amount</label>
              <div className="token-slider-group">
                <input
                  type="range"
                  className="token-slider token-slider-burn"
                  min={1}
                  max={1000000}
                  step={1}
                  value={burnAmount}
                  onChange={(e) => handleBurnSlider(Number(e.target.value))}
                  aria-label="Burn amount slider"
                />
                <input
                  id="burn-amount"
                  type="number"
                  className={`input-field token-amount-input ${!burnAmountValid ? "input-invalid" : ""}`}
                  value={burnAmount}
                  min={1}
                  max={1000000}
                  onChange={(e) => handleBurnInput(Number(e.target.value))}
                  aria-label="Burn amount"
                  aria-required="true"
                  aria-invalid={!burnAmountValid}
                  aria-describedby={!burnAmountValid ? "burn-amount-error" : undefined}
                />
              </div>
              {!burnAmountValid && (
                <span id="burn-amount-error" className="input-hint input-hint-error">
                  Amount must be at least 1
                </span>
              )}
              <div className="token-slider-range">
                <span>1</span>
                <span>{formatNumber(burnAmount)}</span>
                <span>1,000,000</span>
              </div>
            </div>

            {/* Burn Button or Confirm Panel */}
            {showBurnConfirm ? (
              renderBurnConfirm()
            ) : (
              <button
                className="btn-premium btn-danger-fill"
                style={{ width: '100%' }}
                onClick={handleBurnClick}
                disabled={burnLoading || !burnAmountValid || !burnAddressValid}
                aria-label="Burn tokens"
              >
                {burnLoading ? "Burning..." : "Burn Tokens"}
              </button>
            )}

            {/* Burn success */}
            {successBurn && (
              <div className="token-success" role="status" aria-live="polite" style={{ marginTop: 12 }}>
                <p style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>✓ Successfully Burned!</p>
                <a
                  href={`https://solscan.io/tx/${successBurn}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}
                >
                  ↗ View Tx on Solscan
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {renderError()}

      {/* Transaction History — always fills bottom */}
      <div className="card-fill-section" style={{ marginTop: 'auto' }}>
        {txHistory.length > 0 ? (
          <div className="token-history" style={{ marginTop: 4, borderTop: 'none', paddingTop: 0 }}>
            <button
              className="token-history-toggle"
              onClick={() => setHistoryOpen(!historyOpen)}
              aria-expanded={historyOpen}
            >
              <span>Recent Transactions ({txHistory.length})</span>
              <span className={`token-history-chevron ${historyOpen ? "open" : ""}`}>▾</span>
            </button>

            {historyOpen && (
              <>
                <div className="token-history-list scrollable-list" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {txHistory.map((item, i) => (
                    <a
                      key={`${item.txSignature}-${i}`}
                      href={`https://solscan.io/tx/${item.txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="token-history-item"
                    >
                      <span className={`token-history-badge token-history-badge-${item.type}`}>
                        {item.type === "mint" ? "M" : "B"}
                      </span>
                      <span className="token-history-amount">
                        {item.type === "mint" ? "+" : "−"}{formatNumber(item.amount)}
                      </span>
                      <span className="token-history-time">{relativeTime(item.timestamp)}</span>
                    </a>
                  ))}
                </div>
                <button
                  className="token-history-clear"
                  onClick={handleClearHistory}
                  aria-label="Clear transaction history"
                >
                  Clear History
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="card-empty-state">
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
