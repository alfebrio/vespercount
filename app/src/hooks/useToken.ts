import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  Transaction,
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
  createInitializeMintInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import idl from "../../../target/idl/spl_token_minter.json";

const PROGRAM_ID = new PublicKey("GQdn6CgBfknHDQvo7HLjiUHA5YEGWJxLoUUFC2kZ3cJR");
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export function useToken() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintTokens = useCallback(async (amount: number, name: string, symbol: string) => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new anchor.AnchorProvider(connection, (window as any).solana, {});
      const program = new Program(idl as Idl, provider);

      const mintKeypair = Keypair.generate();
      const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, publicKey);
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9, // 9 decimals for standard SPL token
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          publicKey, // payer
          ata, // ata
          publicKey, // owner
          mintKeypair.publicKey, // mint
        )
      );

      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
      );

      const mintIx = await program.methods
        .mintTokens(
          new anchor.BN(amount * 10 ** 9), 
          name, 
          symbol, 
          "https://example.com/token.json" // default dummy URI
        )
        .accounts({
          mint: mintKeypair.publicKey,
          destination: ata,
          authority: publicKey,
          metadata: metadataAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      tx.add(mintIx);

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = publicKey;

      const signature = await provider.sendAndConfirm(tx, [mintKeypair]);
      console.log("Mint Transaction Signature:", signature);

      setLoading(false);
      return mintKeypair.publicKey;
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  }, [publicKey, connection]);

  const burnTokens = useCallback(async (mintAddress: string, amount: number) => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new anchor.AnchorProvider(connection, (window as any).solana, {});
      const program = new Program(idl as Idl, provider);
      const mintPubkey = new PublicKey(mintAddress);
      
      const ata = getAssociatedTokenAddressSync(mintPubkey, publicKey);

      const signature = await program.methods
        .burnTokens(new anchor.BN(amount * 10 ** 9))
        .accounts({
          mint: mintPubkey,
          source: ata,
          authority: publicKey,
        })
        .rpc();

      console.log("Burn Transaction Signature:", signature);
      setLoading(false);
      return signature;
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [publicKey, connection]);

  return { mintTokens, burnTokens, loading, error };
}
