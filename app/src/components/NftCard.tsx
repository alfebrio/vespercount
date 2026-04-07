import { useState, useEffect, useRef, useCallback } from "react";
import { useNft } from "../hooks/useNft";
import { useToast } from "./ToastContext";

// ─── Types ──────────────────────────────────────────────────────────────────
type MintHistoryItem = {
  mintAddress: string;
  name: string;
  symbol: string;
  image: string;
  timestamp: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const MINT_HISTORY_KEY = "nft_mint_history";

function loadMintHistory(): MintHistoryItem[] {
  try {
    const raw = localStorage.getItem(MINT_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MintHistoryItem[];
  } catch {
    return [];
  }
}

function saveMintHistory(items: MintHistoryItem[]) {
  localStorage.setItem(MINT_HISTORY_KEY, JSON.stringify(items.slice(0, 5)));
}

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseFriendlyError(error: string): { friendly: string; isRaw: boolean } {
  const lower = error.toLowerCase();
  if (lower.includes("insufficient funds"))
    return { friendly: "Wallet doesn't have enough SOL to mint", isRaw: false };
  if (lower.includes("user rejected"))
    return { friendly: "Transaction was cancelled", isRaw: false };
  return { friendly: error, isRaw: true };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function NftCard() {
  const [name, setName] = useState("Vesper ART");
  const [symbol, setSymbol] = useState("VESP");
  const [uri, setUri] = useState("https://...");

  const { mintNft, loading, error } = useNft();
  const { toast } = useToast();
  const [successMint, setSuccessMint] = useState<string | null>(null);

  // URI validation
  const [uriValid, setUriValid] = useState<boolean | null>(null);

  // Image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Metadata auto-fill
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const lastAutoFillUri = useRef("");
  const userEditedName = useRef(false);
  const userEditedSymbol = useRef(false);

  // Confirmation modal
  const [showConfirm, setShowConfirm] = useState(false);

  // Error expand
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mint history
  const [mintHistory, setMintHistory] = useState<MintHistoryItem[]>(loadMintHistory);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Refresh relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n: number) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ─── URI validation on change ─────────────────────────────────────────────
  useEffect(() => {
    if (!uri.trim()) {
      setUriValid(null);
      return;
    }
    setUriValid(isValidUrl(uri));
  }, [uri]);

  // ─── Debounced metadata + image fetch ─────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Reset states
    setMetadataLoaded(false);
    setPreviewUrl(null);
    setPreviewError(false);

    if (!uri.trim() || !isValidUrl(uri)) {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(uri, { signal: AbortSignal.timeout(5000) });
        const contentType = res.headers.get("content-type") || "";

        // Try as JSON first (Metaplex metadata)
        if (contentType.includes("json") || contentType.includes("text")) {
          try {
            const json = await res.json();
            // Auto-fill name/symbol if present and user hasn't manually edited
            if (json.name && json.symbol) {
              if (!userEditedName.current && lastAutoFillUri.current !== uri) {
                setName(json.name);
              }
              if (!userEditedSymbol.current && lastAutoFillUri.current !== uri) {
                setSymbol(json.symbol);
              }
              lastAutoFillUri.current = uri;
              setMetadataLoaded(true);
              // Reset manual edit flags after auto-fill
              userEditedName.current = false;
              userEditedSymbol.current = false;
            }
            // Use image field for preview
            if (json.image && isValidUrl(json.image)) {
              setPreviewUrl(json.image);
              setPreviewLoading(false);
              return;
            }
          } catch {
            // Not valid JSON, try as image
          }
        }

        // Try as image directly
        if (contentType.includes("image")) {
          setPreviewUrl(uri);
        } else {
          // Try loading it as image anyway in case content-type is wrong
          setPreviewUrl(uri);
        }
      } catch {
        setPreviewError(true);
      }
      setPreviewLoading(false);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [uri]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleNameChange = (val: string) => {
    setName(val);
    userEditedName.current = true;
  };

  const handleSymbolChange = (val: string) => {
    setSymbol(val);
    userEditedSymbol.current = true;
  };

  const handleMintClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmMint = async () => {
    setShowConfirm(false);
    setSuccessMint(null);
    setErrorExpanded(false);
    const mintAddress = await mintNft(name, symbol, uri);
    if (mintAddress) {
      setSuccessMint(mintAddress);
      // Save to history
      const newItem: MintHistoryItem = {
        mintAddress,
        name,
        symbol,
        image: previewUrl || "",
        timestamp: Date.now(),
      };
      setMintHistory((prev: MintHistoryItem[]) => {
        const updated = [newItem, ...prev].slice(0, 5);
        saveMintHistory(updated);
        return updated;
      });
      toast.success(`NFT "${name}" minted successfully!`);
    }
  };

  const handleCancelMint = () => {
    setShowConfirm(false);
  };

  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [error]);

  const handleClearHistory = () => {
    setMintHistory([]);
    localStorage.removeItem(MINT_HISTORY_KEY);
  };

  const isMintDisabled = loading || uriValid === false || !name.trim() || !symbol.trim();

  // ─── Image preview render ─────────────────────────────────────────────────
  const renderPreview = () => {
    if (!uri.trim() || uriValid === false) return null;

    if (previewLoading) {
      return <div className="nft-preview-skeleton skeleton" />;
    }

    if (previewError || !previewUrl) {
      return (
        <div className="nft-preview-placeholder">
          <span>No Preview Available</span>
        </div>
      );
    }

    return (
      <img
        src={previewUrl}
        alt="NFT Preview"
        className="nft-preview-image"
        onError={() => {
          setPreviewError(true);
          setPreviewUrl(null);
        }}
      />
    );
  };

  // ─── Error render ─────────────────────────────────────────────────────────
  const renderError = () => {
    if (!error) return null;
    const { friendly, isRaw } = parseFriendlyError(error);
    const showToggle = isRaw && friendly.length > 100;
    const displayText = showToggle && !errorExpanded ? friendly.slice(0, 100) + "…" : friendly;

    return (
      <div className="nft-error" role="status" aria-live="polite">
        <div className="nft-error-content">
          <span>⚠️ {displayText}</span>
        </div>
        <div className="nft-error-actions">
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

  // ─── Confirmation panel ───────────────────────────────────────────────────
  const renderConfirmPanel = () => {
    if (!showConfirm) return null;

    return (
      <div className="nft-confirm-panel">
        <div className="nft-confirm-title">Confirm Mint</div>
        {previewUrl && (
          <img
            src={previewUrl}
            alt="NFT to mint"
            className="nft-confirm-image"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="nft-confirm-details">
          <div className="nft-confirm-row">
            <span className="nft-confirm-label">Name</span>
            <span>{name}</span>
          </div>
          <div className="nft-confirm-row">
            <span className="nft-confirm-label">Symbol</span>
            <span>{symbol}</span>
          </div>
          <div className="nft-confirm-row">
            <span className="nft-confirm-label">URI</span>
            <span className="nft-confirm-uri">
              {uri.length > 40 ? uri.slice(0, 20) + "…" + uri.slice(-16) : uri}
            </span>
          </div>
        </div>
        <div className="nft-confirm-buttons">
          <button
            className="btn-premium btn-outline"
            onClick={handleCancelMint}
          >
            Cancel
          </button>
          <button
            className="btn-premium btn-primary"
            onClick={handleConfirmMint}
          >
            Confirm Mint
          </button>
        </div>
      </div>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="glass-card card-accent-nft">
      <h3 className="card-title">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.25 12a7.25 7.25 0 1 1-14.5 0 7.25 7.25 0 0 1 14.5 0Z" />
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 12a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0Z" />
        </svg>
        NFT Studio
      </h3>

      {/* NFT Name */}
      <div className="input-group">
        <label className="input-label" htmlFor="nft-name">NFT Name</label>
        <input
          id="nft-name"
          type="text"
          className={`input-field ${!name.trim() ? "input-invalid" : ""}`}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          aria-required="true"
          aria-invalid={!name.trim()}
          aria-describedby={!name.trim() ? "nft-name-error" : undefined}
        />
        {!name.trim() && (
          <span id="nft-name-error" className="input-hint input-hint-error">
            Name is required
          </span>
        )}
      </div>

      {/* Symbol */}
      <div className="input-group">
        <label className="input-label" htmlFor="nft-symbol">Symbol</label>
        <input
          id="nft-symbol"
          type="text"
          className={`input-field ${!symbol.trim() ? "input-invalid" : ""}`}
          value={symbol}
          onChange={(e) => handleSymbolChange(e.target.value)}
          aria-required="true"
          aria-invalid={!symbol.trim()}
          aria-describedby={!symbol.trim() ? "nft-symbol-error" : undefined}
        />
        {!symbol.trim() && (
          <span id="nft-symbol-error" className="input-hint input-hint-error">
            Symbol is required
          </span>
        )}
      </div>

      {/* Metadata URI */}
      <div className="input-group">
        <label className="input-label" htmlFor="nft-uri">
          Metadata URI
          {metadataLoaded && (
            <span className="nft-metadata-badge">Metadata loaded ✓</span>
          )}
        </label>
        <div className="nft-uri-wrapper">
          <input
            id="nft-uri"
            type="text"
            className={`input-field nft-uri-input ${uriValid === false ? "input-invalid" : ""}`}
            value={uri}
            onChange={(e) => {
              setUri(e.target.value);
              setMetadataLoaded(false);
              userEditedName.current = false;
              userEditedSymbol.current = false;
            }}
            aria-required="true"
            aria-invalid={uriValid === false}
            aria-describedby={uriValid === false ? "nft-uri-error" : undefined}
          />
          {uriValid !== null && (
            <span className={`nft-uri-status ${uriValid ? "nft-uri-valid" : "nft-uri-invalid"}`}>
              {uriValid ? "✓" : "✕"}
            </span>
          )}
        </div>
        {uriValid === false && (
          <span id="nft-uri-error" className="input-hint input-hint-error">
            Please enter a valid URL
          </span>
        )}
      </div>

      {/* Image Preview */}
      {renderPreview()}

      {/* Mint button + Confirmation */}
      {showConfirm ? (
        renderConfirmPanel()
      ) : (
        <button
          className="btn-premium btn-primary"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={handleMintClick}
          disabled={isMintDisabled}
          aria-label="Mint NFT"
        >
          {loading ? "Minting..." : "Mint Premium NFT"}
        </button>
      )}

      {/* Success message */}
      {successMint && (
        <div className="nft-success" role="status" aria-live="polite">
          <p style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>✓ NFT Minted!</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', wordBreak: 'break-all', marginTop: 4 }}>
            {successMint.slice(0, 8)}...{successMint.slice(-8)}
          </p>
          <a
            href={`https://solscan.io/token/${successMint}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', marginTop: 6, fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}
          >
            ↗ View NFT on Solscan
          </a>
        </div>
      )}

      {/* Error message */}
      {renderError()}

      {/* Footer info */}
      <div style={{ marginTop: 24, padding: '12px 0', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <p>Currently supporting standard Metaplex Master Editions.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, opacity: 0.6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(45deg, #12c2e9, #c471ed, #f64f59)' }} />
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(45deg, #00b09b, #96c93d)' }} />
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(45deg, #f83600, #f9d423)' }} />
        </div>
      </div>

      {/* Mint History — always fills bottom */}
      <div className="card-fill-section" style={{ marginTop: 'auto' }}>
        {mintHistory.length > 0 ? (
          <div className="nft-history" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
            <button
              className="nft-history-toggle"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <span>Recent Mints ({mintHistory.length})</span>
              <span className={`nft-history-chevron ${historyOpen ? "open" : ""}`}>▾</span>
            </button>

            {historyOpen && (
              <>
                <div className="nft-history-list scrollable-list" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {mintHistory.map((item, i) => (
                    <a
                      key={`${item.mintAddress}-${i}`}
                      href={`https://solscan.io/token/${item.mintAddress}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="nft-history-item"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="nft-history-thumb"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="nft-history-thumb-placeholder" />
                      )}
                      <div className="nft-history-info">
                        <span className="nft-history-name">{item.name}</span>
                        <span className="nft-history-addr">
                          {item.mintAddress.slice(0, 4)}…{item.mintAddress.slice(-4)}
                        </span>
                      </div>
                      <span className="nft-history-time">{relativeTime(item.timestamp)}</span>
                    </a>
                  ))}
                </div>
                <button
                  className="nft-history-clear"
                  onClick={handleClearHistory}
                >
                  Clear History
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="card-empty-state">
            <p>No mints yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
