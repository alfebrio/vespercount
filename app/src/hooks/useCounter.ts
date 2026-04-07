import { useCallback, useEffect, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../../../target/idl/vespercount.json";

// Program ID dari IDL
const PROGRAM_ID = new PublicKey("96xYKxDbPLnbE1mZmUXJvksn74QUEx7Evh6WmNt9VeM1");

// Tipe yang di-derive dari IDL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CounterProgram = Program<any>;

export type CounterState = {
  count: number;
  counterPda: PublicKey | null;
  initialized: boolean;
  loading: boolean;
  txLoading: "increment" | "decrement" | "initialize" | null;
  error: string | null;
  lastTx: string | null;
};

export function useCounter() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [state, setState] = useState<CounterState>({
    count: 0,
    counterPda: null,
    initialized: false,
    loading: false,
    txLoading: null,
    error: null,
    lastTx: null,
  });

  // Helper: dapatkan program instance
  const getProgram = useCallback((): CounterProgram | null => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program(idl as any, provider);
  }, [connection, wallet]);

  // Helper: hitung PDA untuk wallet yang aktif
  const getCounterPda = useCallback(
    async (walletPubkey: PublicKey): Promise<PublicKey> => {
      const [pda] = await PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), walletPubkey.toBuffer()],
        PROGRAM_ID
      );
      return pda;
    },
    []
  );

  // Ambil nilai counter dari chain
  const fetchCounter = useCallback(async () => {
    if (!wallet) return;
    const program = getProgram();
    if (!program) return;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const pda = await getCounterPda(wallet.publicKey);
      const info = await connection.getAccountInfo(pda);

      if (!info) {
        // Akun belum diinisialisasi
        setState((s) => ({
          ...s,
          counterPda: pda,
          initialized: false,
          loading: false,
        }));
        return;
      }

      // Akun ada — fetch & decode
      const account = await (program.account as any).counter.fetch(pda);
      setState((s) => ({
        ...s,
        count: (account.count as BN).toNumber(),
        counterPda: pda,
        initialized: true,
        loading: false,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: err?.message ?? "Gagal membaca counter",
        loading: false,
      }));
    }
  }, [wallet, getProgram, getCounterPda, connection]);

  // Fetch counter saat wallet berubah
  useEffect(() => {
    fetchCounter();
  }, [fetchCounter]);

  // ─── Real-time WebSocket Sync ──────────────────────────────────────────────
  useEffect(() => {
    if (!wallet) return;
    let subscriptionId: number;
    let mounted = true;

    getCounterPda(wallet.publicKey).then((pda) => {
      if (!mounted) return;
      subscriptionId = connection.onAccountChange(
        pda,
        async () => {
          const program = getProgram();
          if (!program) return;
          try {
            const account = await (program.account as any).counter.fetch(pda);
            setState((s) => ({
              ...s,
              count: (account.count as any).toNumber(),
              initialized: true,
            }));
          } catch {
            // account might not exist yet, ignore
          }
        },
        "confirmed"
      );
    });

    return () => {
      mounted = false;
      if (subscriptionId !== undefined) {
        connection.removeAccountChangeListener(subscriptionId);
      }
    };
  }, [wallet, connection, getCounterPda, getProgram]);

  // ─── Initialize ────────────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    const program = getProgram();
    if (!program || !wallet) return;

    setState((s) => ({ ...s, txLoading: "initialize", error: null, lastTx: null }));
    try {
      const tx = await (program.methods as any)
        .initialize()
        .accounts({ authority: wallet.publicKey })
        .rpc();

      setState((s) => ({ ...s, lastTx: tx }));
      await fetchCounter();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: parseAnchorError(err),
        txLoading: null,
      }));
      return;
    }
    setState((s) => ({ ...s, txLoading: null }));
  }, [getProgram, wallet, fetchCounter]);

  // ─── Increment (with optional step) ───────────────────────────────────────
  const increment = useCallback(async (step: number = 1) => {
    const program = getProgram();
    if (!program || !wallet) return;

    setState((s) => ({ ...s, txLoading: "increment", error: null, lastTx: null }));
    try {
      // Call increment `step` times sequentially
      let lastSig = "";
      for (let i = 0; i < step; i++) {
        lastSig = await (program.methods as any)
          .increment()
          .accounts({ authority: wallet.publicKey })
          .rpc();
      }

      setState((s) => ({ ...s, lastTx: lastSig }));
      await fetchCounter();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: parseAnchorError(err),
        txLoading: null,
      }));
      return;
    }
    setState((s) => ({ ...s, txLoading: null }));
  }, [getProgram, wallet, fetchCounter]);

  // ─── Decrement (with optional step) ───────────────────────────────────────
  const decrement = useCallback(async (step: number = 1) => {
    const program = getProgram();
    if (!program || !wallet) return;

    setState((s) => ({ ...s, txLoading: "decrement", error: null, lastTx: null }));
    try {
      let lastSig = "";
      for (let i = 0; i < step; i++) {
        lastSig = await (program.methods as any)
          .decrement()
          .accounts({ authority: wallet.publicKey })
          .rpc();
      }

      setState((s) => ({ ...s, lastTx: lastSig }));
      await fetchCounter();
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: parseAnchorError(err),
        txLoading: null,
      }));
      return;
    }
    setState((s) => ({ ...s, txLoading: null }));
  }, [getProgram, wallet, fetchCounter]);

  return { state, initialize, increment, decrement, fetchCounter };
}

// ─── Helper: parse Anchor error message ────────────────────────────────────
export function parseAnchorError(err: any): string {
  const msg: string = err?.message ?? String(err);
  // Cari pesan custom error Anchor
  const customMatch = msg.match(/Error Message: (.+)/);
  if (customMatch) return customMatch[1];
  // Friendly Solana error messages
  if (msg.toLowerCase().includes("insufficient funds")) return "Your wallet doesn't have enough SOL";
  if (msg.toLowerCase().includes("blockhash not found")) return "Network congestion, please retry";
  if (msg.includes("Overflow")) return "❌ Counter sudah di nilai maksimum!";
  if (msg.includes("Underflow")) return "❌ Counter sudah di nilai minimum!";
  if (msg.includes("already in use")) return "⚠️ Counter sudah diinisialisasi.";
  if (msg.includes("0x1")) return "⚠️ Saldo SOL tidak cukup untuk membayar transaksi.";
  return msg.length > 100 ? msg.slice(0, 100) + "…" : msg;
}
