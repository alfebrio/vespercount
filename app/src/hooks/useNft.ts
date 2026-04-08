import { useState, useCallback } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program, Idl } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import idl from '../../../target/idl/nft_minter.json';

const PROGRAM_ID = new PublicKey("69B6zaEvJA78VWBzWdhbS2xDPGoSQ3qy4eKNubcvMSk6");
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export function useNft() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProgram = useCallback(() => {
    if (!wallet) return null;
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return new Program(idl as Idl, provider);
  }, [connection, wallet]);

  const mintNft = useCallback(async (name: string, symbol: string, uri: string, royalties: number, maxSupply: number | null) => {
    const program = getProgram();
    if (!wallet || !program) return;
    setLoading(true);
    setError(null);
    try {
      const mintKeypair = Keypair.generate();
      const tokenAddress = getAssociatedTokenAddressSync(mintKeypair.publicKey, wallet.publicKey);
      
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [masterEditionAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer(), Buffer.from("edition")],
        TOKEN_METADATA_PROGRAM_ID
      );

      const TREASURY_ADDRESS = new PublicKey("HQ4yY5sLhHntJzUWe7nDBXp8H2K2S4aXWz8S1L4H4Bqw");

      // Anchor Option<u64> translates to BN | null in ts.
      const supplyParam = maxSupply === null ? null : new anchor.BN(maxSupply);

      const tx = await program.methods
        .mintNft(name, symbol, uri, royalties * 100, supplyParam)
        .accounts({
          signer: wallet.publicKey,
          treasury: TREASURY_ADDRESS,
          mint: mintKeypair.publicKey,
          tokenAccount: tokenAddress,
          metadata: metadataAddress,
          masterEdition: masterEditionAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([mintKeypair])
        .rpc();

      setLoading(false);
      console.log("NFT Minting Tx:", tx);
      return mintKeypair.publicKey.toString();
    } catch (err: any) {
      console.error("NFT Mint Error:", err);
      // Store full error message — component handles display/truncation
      const msg = err?.message || String(err);
      setError(msg);
      setLoading(false);
      return null;
    }
  }, [getProgram, wallet]);

  return { mintNft, loading, error };
}
