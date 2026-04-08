/**
 * VesperCount Global Stats Utility
 * Handles persistent cumulative counters and real-time update notifications.
 */

export type GlobalStats = {
  txCount: number;
  tokensMinted: number;
  nftsCreated: number;
};

const STATS_KEY = "vesper_global_stats_v1";
const UPDATE_EVENT = "vespercount:stats-update";

export function getGlobalStats(): GlobalStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      // Initialize from legacy history lengths once if possible
      const counterH = JSON.parse(localStorage.getItem("counter_history_v2") || "[]").length;
      const tokenH = JSON.parse(localStorage.getItem("token_tx_history") || "[]");
      const nftH = JSON.parse(localStorage.getItem("nft_mint_history") || "[]").length;
      
      const tokensCount = tokenH.filter((t: any) => t.type === "mint").length;
      const totalTx = counterH + tokenH.length + nftH;

      const initial = { txCount: totalTx, tokensMinted: tokensCount, nftsCreated: nftH };
      localStorage.setItem(STATS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as GlobalStats;
  } catch {
    return { txCount: 0, tokensMinted: 0, nftsCreated: 0 };
  }
}

export function incrementStat(type: keyof GlobalStats, amount: number = 1) {
  const stats = getGlobalStats();
  stats[type] += amount;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  notifyStatsUpdate();
}

export function notifyStatsUpdate() {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

export function subscribeToStats(callback: () => void) {
  window.addEventListener(UPDATE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}
