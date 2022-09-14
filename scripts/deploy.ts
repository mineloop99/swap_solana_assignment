import config from "../config.json"
import config_swap_state_account from "../.account/swap_state.json"
import config_operator_wallet from "../.account/operator_wallet.json"
import { SystemProgram, Connection, clusterApiUrl } from "@solana/web3.js" 

import * as anchor from "@project-serum/anchor"; 
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
// Get init 
describe("Initializing", () => {
  console.log("Init State!")
  const connection = new Connection(
    clusterApiUrl('testnet'),
    'confirmed'
  );
  const provider = anchor.AnchorProvider.env()
  // Configure client to use the provider.
  anchor.setProvider(provider);
  const programId = new anchor.web3.PublicKey(config["program_id"]);

  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/swap.json", "utf8")
  );
  anchor.setProvider(provider);
  const program = new anchor.Program(idl, programId, provider);
  const swap_state_account = anchor.web3.Keypair.fromSecretKey(new Uint8Array(config_swap_state_account));

  const mint_pubkey = new anchor.web3.PublicKey(config["mint_token_account"]);
  const operator = anchor.web3.Keypair.fromSecretKey(new Uint8Array(config_operator_wallet));
  it("Init data to " + swap_state_account.publicKey.toBase58() + ":...", async () => {
    await program.rpc.initialize({
      accounts: {
        swapStateAccount: swap_state_account.publicKey,
        user: operator.publicKey,
        authority: operator.publicKey,
        mintAccount: mint_pubkey, 
        systemProgram: SystemProgram.programId,
      },
        signers: [swap_state_account]
      }); 
  }) 
  it("Init Associate:...", async () => {
    const pda_accounts = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("token_holder")],
      programId
    );
    console.log("Program Wallet: ", pda_accounts[0].toBase58());
    await getOrCreateAssociatedTokenAccount(
      connection,
      operator,
      mint_pubkey,
      pda_accounts[0],
      true
    );
  });
})