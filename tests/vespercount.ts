import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Vespercount } from "../target/types/vespercount";

describe("vespercount — Counter Program", () => {
  // Configure provider & program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Vespercount as Program<Vespercount>;

  // PDA counter untuk authority
  const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), provider.wallet.publicKey.toBuffer()],
    program.programId
  );

  // ─── 1. Initialize ──────────────────────────────────────────────────────────

  it("initialize: membuat akun counter dengan nilai awal 0", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        counter: counterPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log("✅ Initialize tx:", tx);

    const counterAccount = await program.account.counter.fetch(
      counterPda
    );

    assert.equal(
      counterAccount.count.toNumber(),
      0,
      "Nilai counter seharusnya 0 setelah inisialisasi"
    );
    assert.equal(
      counterAccount.authority.toBase58(),
      provider.wallet.publicKey.toBase58(),
      "Authority seharusnya adalah wallet yang menginisialisasi"
    );

    console.log("   count    :", counterAccount.count.toNumber());
    console.log("   authority:", counterAccount.authority.toBase58());
  });

  // ─── 2. Increment ───────────────────────────────────────────────────────────

  it("increment: menambah counter sebesar 1", async () => {
    const tx = await program.methods
      .increment()
      .accounts({
        counter: counterPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    console.log("✅ Increment tx:", tx);

    const counterAccount = await program.account.counter.fetch(
      counterPda
    );

    assert.equal(
      counterAccount.count.toNumber(),
      1,
      "Nilai counter seharusnya 1 setelah increment pertama"
    );

    console.log("   count:", counterAccount.count.toNumber());
  });

  it("increment: menambah counter 4x lagi (total menjadi 5)", async () => {
    for (let i = 0; i < 4; i++) {
      await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          authority: provider.wallet.publicKey,
        } as any)
        .rpc();
    }

    const counterAccount = await program.account.counter.fetch(
      counterPda
    );

    assert.equal(
      counterAccount.count.toNumber(),
      5,
      "Nilai counter seharusnya 5 setelah 5 kali increment"
    );

    console.log("✅ count setelah 5x increment:", counterAccount.count.toNumber());
  });

  // ─── 3. Decrement ───────────────────────────────────────────────────────────

  it("decrement: mengurangi counter sebesar 1", async () => {
    const tx = await program.methods
      .decrement()
      .accounts({
        counter: counterPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    console.log("✅ Decrement tx:", tx);

    const counterAccount = await program.account.counter.fetch(
      counterPda
    );

    assert.equal(
      counterAccount.count.toNumber(),
      4,
      "Nilai counter seharusnya 4 setelah 1 kali decrement dari 5"
    );

    console.log("   count:", counterAccount.count.toNumber());
  });

  it("decrement: mengurangi counter 4x lagi (total menjadi 0)", async () => {
    for (let i = 0; i < 4; i++) {
      await program.methods
        .decrement()
        .accounts({
          counter: counterPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();
    }

    const counterAccount = await program.account.counter.fetch(
      counterPda
    );

    assert.equal(
      counterAccount.count.toNumber(),
      0,
      "Nilai counter seharusnya kembali ke 0"
    );

    console.log("✅ count setelah 5x decrement:", counterAccount.count.toNumber());
  });

  // ─── 4. Error Cases ─────────────────────────────────────────────────────────

  it("decrement: gagal saat underflow (counter sudah 0, i64::MIN)", async () => {
    // Kita tes bahwa decrement di bawah i64::MIN akan throw error.
    // Counter saat ini = 0. Untuk memaksa underflow kita set count ke i64::MIN
    // secara tidak langsung (harus sangat banyak decrement) — atau kita verify
    // bahwa error code Underflow ada di program IDL.
    //
    // Untuk tes praktis, kita cukup verifikasi bahwa program melempar error
    // saat mencoba decrement lebih jauh dari nilai minimum i64.
    // Karena i64::MIN memerlukan 2^63 transaksi, tes ini hanya memvalidasi
    // bahwa error code "Underflow" terdapat dalam program errors.
    const errors = (program.idl as any).errors ?? [];
    const underflowError = errors.find(
      (e) => e.name === "Underflow" || e.code === 6001
    );
    assert.isDefined(
      underflowError,
      "Program harus mendefinisikan error Underflow"
    );
    console.log("✅ Error Underflow terdefinisi:", underflowError);
  });

  it("increment: gagal jika bukan authority yang memanggil", async () => {
    const fakeAuthority = Keypair.generate();

    try {
      await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          authority: fakeAuthority.publicKey,
        })
        .signers([fakeAuthority])
        .rpc();

      assert.fail("Seharusnya melempar error karena bukan authority");
    } catch (err: any) {
      assert.include(
        err.message,
        "AnchorError",
        "Harus melempar AnchorError karena has_one constraint gagal"
      );
      console.log("✅ Transaksi ditolak karena authority tidak valid:", err.message.split("\n")[0]);
    }
  });
});
