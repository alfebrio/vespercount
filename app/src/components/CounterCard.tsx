import { useEffect, useRef, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCounter } from "../hooks/useCounter";
import { useToast } from "./ToastContext";

// ─── Activity Types ─────────────────────────────────────────────────────────
type ActivityItem = {
  direction: "up" | "down";
  step: number;
  timestamp: number;
};

const ACTIVITY_KEY = "counter_activity";

function loadActivity(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityItem[];
  } catch {
    return [];
  }
}

function saveActivity(items: ActivityItem[]) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items.slice(0, 5)));
}

// ─── Types ──────────────────────────────────────────────────────────────────
type TxHistoryItem = {
  type: "increment" | "decrement";
  txHash: string;
  timestamp: number;
};

type FailedAction = {
  type: "increment" | "decrement";
  step: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const TX_HISTORY_KEY = "counter_tx_history";

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

function parseFriendlyError(error: string): { friendly: string; isRaw: boolean } {
  const lower = error.toLowerCase();
  if (lower.includes("insufficient funds"))
    return { friendly: "Your wallet doesn't have enough SOL", isRaw: false };
  if (lower.includes("blockhash not found"))
    return { friendly: "Network congestion, please retry", isRaw: false };
  return { friendly: error, isRaw: true };
}

// ─── Component ──────────────────────────────────────────────────────────────
export function CounterCard() {
  const { connected } = useWallet();
  const { state, initialize, increment, decrement, fetchCounter } = useCounter();
  const { count, initialized, loading, txLoading, error, lastTx, counterPda } = state;
  const { toast } = useToast();

  // Activity tracking
  const [activity, setActivity] = useState<ActivityItem[]>(loadActivity);

  // Direction + animation
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [colorFlash, setColorFlash] = useState<"green" | "red" | null>(null);
  const prevCount = useRef(count);

  // Step input
  const [step, setStep] = useState(1);

  // Transaction history
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>(loadTxHistory);

  // Auto-refresh & last synced
  const [lastSynced, setLastSynced] = useState<number>(Date.now());
  const [syncAgo, setSyncAgo] = useState(0);

  // Retry on failure
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // ─── Directional animation + color flash ──────────────────────────────────
  useEffect(() => {
    if (count !== prevCount.current) {
      const dir = count > prevCount.current ? "up" : "down";
      setDirection(dir);
      setColorFlash(dir === "up" ? "green" : "red");
      prevCount.current = count;

      const t1 = setTimeout(() => setDirection(null), 400);
      const t2 = setTimeout(() => setColorFlash(null), 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [count]);

  // ─── Track tx history ─────────────────────────────────────────────────────
  const prevTx = useRef(lastTx);
  const prevTxLoading = useRef(txLoading);
  useEffect(() => {
    // When a tx completes (txLoading goes from increment/decrement to null and lastTx changes)
    if (
      lastTx &&
      lastTx !== prevTx.current &&
      prevTxLoading.current &&
      prevTxLoading.current !== "initialize"
    ) {
      const newItem: TxHistoryItem = {
        type: prevTxLoading.current as "increment" | "decrement",
        txHash: lastTx,
        timestamp: Date.now(),
      };
      setTxHistory((prev: TxHistoryItem[]) => {
        const updated = [newItem, ...prev].slice(0, 5);
        saveTxHistory(updated);
        return updated;
      });
      // Clear failed action on success
      setFailedAction(null);
      // Save activity
      const actItem: ActivityItem = {
        direction: newItem.type === "increment" ? "up" : "down",
        step: 1,
        timestamp: Date.now(),
      };
      setActivity((prev: ActivityItem[]) => {
        const updated = [actItem, ...prev].slice(0, 5);
        saveActivity(updated);
        return updated;
      });
      // Toast
      toast.success(newItem.type === "increment" ? "Counter incremented!" : "Counter decremented!");
    }
    prevTx.current = lastTx;
    prevTxLoading.current = txLoading;
  }, [lastTx, txLoading]);

  // ─── Auto-refresh every 15 seconds ────────────────────────────────────────
  useEffect(() => {
    if (!connected || !initialized) return;

    const pollInterval = setInterval(() => {
      fetchCounter();
      setLastSynced(Date.now());
    }, 15000);

    const tickInterval = setInterval(() => {
      setSyncAgo(Math.floor((Date.now() - lastSynced) / 1000));
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [connected, initialized, fetchCounter, lastSynced]);

  // Update syncAgo on lastSynced change
  useEffect(() => {
    setSyncAgo(0);
  }, [lastSynced]);

  // Refresh relative times in history
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n: number) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // ─── Action handlers ─────────────────────────────────────────────────────
  const handleIncrement = useCallback(async () => {
    setFailedAction(null);
    try {
      await increment(step);
    } catch {
      setFailedAction({ type: "increment", step });
    }
  }, [increment, step]);

  const handleDecrement = useCallback(async () => {
    setFailedAction(null);
    try {
      await decrement(step);
    } catch {
      setFailedAction({ type: "decrement", step });
    }
  }, [decrement, step]);

  // Track errors for retry
  useEffect(() => {
    if (error && prevTxLoading.current) {
      setFailedAction({
        type: prevTxLoading.current as "increment" | "decrement",
        step,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleRetry = useCallback(async () => {
    if (!failedAction) return;
    if (failedAction.type === "increment") {
      await increment(failedAction.step);
    } else {
      await decrement(failedAction.step);
    }
  }, [failedAction, increment, decrement]);

  const handleCopyError = useCallback(() => {
    if (error) {
      navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [error]);

  const isLoading = loading || txLoading !== null;
  const isDecrementDisabled = isLoading || count === 0;

  // ─── Disconnected state ───────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="glass-card card-accent-counter">
        <h3 className="card-title">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.75 12a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Z" />
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.25 12c0 4.004-3.246 7.25-7.25 7.25S4.75 16.004 4.75 12 7.996 4.75 12 4.75s7.25 3.246 7.25 7.25Z" />
          </svg>
          Counter Engine
        </h3>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 20 }}>Connect wallet to interact with on-chain counter.</p>
        </div>
      </div>
    );
  }

  // ─── Uninitialized state ──────────────────────────────────────────────────
  if (!initialized && !loading) {
    return (
      <div className="glass-card card-accent-counter">
        <h3 className="card-title">Counter Engine</h3>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>No counter found for this wallet. Initialize to start!</p>
          <button
            className="btn-premium btn-primary"
            style={{ width: '100%' }}
            onClick={initialize}
            disabled={!!txLoading}
            aria-label="Initialize counter"
          >
            {txLoading === "initialize" ? "Initializing..." : "Initialize Counter"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Error display helper ─────────────────────────────────────────────────
  const renderError = () => {
    if (!error) return null;
    const { friendly, isRaw } = parseFriendlyError(error);
    return (
      <div className="counter-error" role="status">
        <div className="counter-error-content">
          <span>⚠️ {friendly}</span>
          {isRaw && (
            <button
              className="btn-copy-error"
              onClick={handleCopyError}
              title="Copy error"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>
        {failedAction && (
          <button
            className="btn-premium btn-retry"
            onClick={handleRetry}
            disabled={isLoading}
          >
            ↻ Retry {failedAction.type}
          </button>
        )}
      </div>
    );
  };

  // ─── Skeleton loading state ───────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="counter-skeleton-wrap">
      <div className="counter-hero">
        <div className="skeleton skeleton-counter" />
        <div className="skeleton skeleton-label" />
      </div>
      <div className="button-rows" style={{ marginBottom: 24 }}>
        <div className="skeleton skeleton-button" />
        <div className="skeleton skeleton-button" />
      </div>
    </div>
  );

  // ─── Counter value class ──────────────────────────────────────────────────
  const counterClass = [
    "counter-val",
    direction === "up" ? "slide-up" : "",
    direction === "down" ? "slide-down" : "",
    colorFlash === "green" ? "flash-green" : "",
    colorFlash === "red" ? "flash-red" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="glass-card card-accent-counter">
      <h3 className="card-title">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.75 8.75a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V8.75Z" />
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.75 4.75v4M15.25 4.75v4" />
        </svg>
        Counter Engine
      </h3>

      {loading ? (
        renderSkeleton()
      ) : (
        <>
          {/* Counter display */}
          <div className="counter-hero">
            <div
              className={counterClass}
              aria-live="polite"
              aria-atomic="true"
            >
              {count}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Current Value
            </p>
          </div>

          {/* Step input + buttons */}
          <div className="counter-controls">
            <div className="step-input-group">
              <label className="step-label" htmlFor="counter-step">Step</label>
              <input
                id="counter-step"
                type="number"
                className="step-input"
                value={step}
                min={1}
                max={100}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                  setStep(v);
                }}
                aria-label="Step value"
              />
            </div>
            <div className="button-rows" style={{ flex: 1 }}>
              <div className="decrement-wrapper">
                <button
                  className="btn-premium btn-outline"
                  onClick={handleDecrement}
                  disabled={isDecrementDisabled}
                  aria-label="Decrement counter"
                >
                  {txLoading === "decrement" ? "Wait..." : step > 1 ? `− ${step}` : "−"}
                </button>
                {count === 0 && (
                  <span className="tooltip-zero" role="tooltip">Counter cannot go below 0</span>
                )}
              </div>
              <button
                className="btn-premium btn-secondary"
                onClick={handleIncrement}
                disabled={isLoading}
                aria-label="Increment counter"
              >
                {txLoading === "increment" ? "Wait..." : step > 1 ? `+ ${step}` : "+"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Info rows */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Status</span>
          <span style={{ color: 'var(--secondary)' }}>Live on Devnet</span>
        </div>
        {counterPda && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Address</span>
            <span style={{ fontSize: '0.7rem' }}>{counterPda.toBase58().slice(0, 4)}...{counterPda.toBase58().slice(-4)}</span>
          </div>
        )}
        {initialized && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Synced</span>
            <span className="sync-indicator">
              <span className="sync-dot" />
              {syncAgo < 2 ? "just now" : `${syncAgo}s ago`}
            </span>
          </div>
        )}
      </div>

      {/* Error display */}
      {renderError()}

      {/* Last tx link */}
      {lastTx && (
        <a
          href={`https://solscan.io/tx/${lastTx}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'block', marginTop: 12, fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}
        >
          ↗ View Last Tx on Solscan
        </a>
      )}

      {/* Transaction history */}
      {txHistory.length > 0 && (
        <div className="tx-history">
          <div className="tx-history-title">Recent Transactions</div>
          <div className="tx-history-list">
            {txHistory.map((item, i) => (
              <a
                key={`${item.txHash}-${i}`}
                href={`https://solscan.io/tx/${item.txHash}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="tx-history-item"
              >
                <span className={`tx-type tx-type-${item.type}`}>
                  {item.type === "increment" ? "+" : "−"}
                </span>
                <span className="tx-hash">
                  {item.txHash.slice(0, 6)}…{item.txHash.slice(-4)}
                </span>
                <span className="tx-time">{relativeTime(item.timestamp)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Activity Mini-panel — always fills remaining space */}
      <div className="counter-activity">
        <div className="counter-activity-title">Recent Activity</div>
        {activity.length > 0 ? (
          <div className="counter-activity-list scrollable-list">
            {activity.map((a, i) => (
              <div key={`act-${a.timestamp}-${i}`} className="counter-activity-row">
                <span className={a.direction === "up" ? "activity-arrow-up" : "activity-arrow-down"}>
                  {a.direction === "up" ? "↑" : "↓"}
                </span>
                <span className="activity-step">{a.direction === "up" ? "+" : "−"}{a.step}</span>
                <span className="activity-time">{relativeTime(a.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-empty-state">
            <p>No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
